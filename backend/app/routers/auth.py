import uuid
from datetime import timedelta
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Response, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.database import get_db
from app.models.user import User, UserRole
from app.schemas.auth import LoginRequest, Token
from app.schemas.user import UserResponse, UserRegister, PasswordChange, UserSelfUpdate
from app.core.helpers import ensure_unique_user_fields
from app.core.security import verify_password, hash_password, create_access_token
from app.config import settings
from app.dependencies import get_current_user, ACCESS_COOKIE_NAME


def _set_auth_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=ACCESS_COOKIE_NAME,
        value=token,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite="lax",
        path="/",
    )


# Profile-picture uploads land in the same media dir as other images and are
# served through the auth-gated /images route (see app.routers.files).
_IMAGE_DIR = Path(settings.IMAGE_DIR)
_ALLOWED_AVATAR_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}


def _delete_avatar_file(stored_url: Optional[str]) -> None:
    """Best-effort delete of a previously-uploaded avatar so files don't pile up.

    Only touches files under our own IMAGE_DIR; anything that doesn't look like
    one of our media URLs is left alone.
    """
    if not stored_url or "/images/" not in stored_url:
        return
    old_path = _IMAGE_DIR / Path(stored_url).name
    try:
        if old_path.exists():
            old_path.unlink()
    except OSError:
        pass


router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(data: UserRegister, db: Session = Depends(get_db)):
    """
    สมัครสมาชิกสำหรับเจ้าหน้าที่กรมป่าไม้
    
    ต้องกรอก: username, ชื่อ-นามสกุล, อีเมล, รหัสผ่าน, หน่วยงาน, ตำแหน่ง
    บทบาทเริ่มต้น: learner (admin สามารถเปลี่ยนได้ภายหลัง)
    """
    # ตรวจรหัสผ่านตรงกัน
    if data.password != data.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน"
        )
    
    # ตรวจ username / อีเมลซ้ำ
    ensure_unique_user_fields(db, username=data.username, email=data.email)

    new_user = User(
        username=data.username,
        email=data.email,
        full_name=data.full_name,
        hashed_password=hash_password(data.password),
        role=UserRole.LEARNER,
        department=data.department,
        position=data.position,
        phone=data.phone,                          
        responsibility=data.responsibility,        
        motivation=data.motivation,                
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@router.post("/login", response_model=Token)
def login(credentials: LoginRequest, response: Response, db: Session = Depends(get_db)):
    """เข้าสู่ระบบด้วย username หรือ email และรหัสผ่าน — sets httpOnly auth cookie."""
    user = db.query(User).filter(or_(
        User.username == credentials.identifier,
        User.email == credentials.identifier,
    )).first()

    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="บัญชีผู้ใช้ถูกระงับ"
        )

    access_token = create_access_token(
        data={"sub": str(user.id)},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )

    _set_auth_cookie(response, access_token)

    return Token(
        access_token=access_token,  # also returned in body for API clients
        token_type="bearer",
        user=UserResponse.model_validate(user)
    )


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.patch("/me", response_model=UserResponse)
def update_me(
    data: UserSelfUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    update_data = data.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(current_user, field, value)

    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/me/avatar", response_model=UserResponse)
async def upload_my_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """อัปโหลด/เปลี่ยนรูปโปรไฟล์ของตัวเอง (optional). ทำได้เฉพาะเจ้าของบัญชี."""
    ext = Path(file.filename or "").suffix.lower()
    if ext not in _ALLOWED_AVATAR_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"รองรับเฉพาะไฟล์ {', '.join(sorted(_ALLOWED_AVATAR_EXTENSIONS))}",
        )

    # Stream to disk with a hard size cap enforced mid-stream (don't trust
    # Content-Length). Mirrors the course cover-image upload path.
    _IMAGE_DIR.mkdir(parents=True, exist_ok=True)
    unique_name = f"{uuid.uuid4().hex}{ext}"
    file_path = _IMAGE_DIR / unique_name
    total = 0
    CHUNK = 1024 * 256  # 256 KB
    try:
        with file_path.open("wb") as out:
            while True:
                chunk = await file.read(CHUNK)
                if not chunk:
                    break
                total += len(chunk)
                if total > settings.MAX_IMAGE_SIZE:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"ไฟล์ใหญ่เกิน {settings.MAX_IMAGE_SIZE // (1024 * 1024)} MB",
                    )
                out.write(chunk)
    except HTTPException:
        if file_path.exists():
            try: file_path.unlink()
            except OSError: pass
        raise

    _delete_avatar_file(current_user.profile_image)
    current_user.profile_image = f"/elearning/images/{unique_name}"
    db.commit()
    db.refresh(current_user)
    return current_user


@router.delete("/me/avatar", response_model=UserResponse)
def delete_my_avatar(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """ลบรูปโปรไฟล์ กลับไปใช้รูปตัวอักษรย่อ."""
    _delete_avatar_file(current_user.profile_image)
    current_user.profile_image = None
    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/change-password", status_code=status.HTTP_200_OK)
def change_password(
    data: PasswordChange,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not verify_password(data.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="รหัสผ่านปัจจุบันไม่ถูกต้อง"
        )
    
    current_user.hashed_password = hash_password(data.new_password)
    db.commit()
    
    return {"message": "เปลี่ยนรหัสผ่านสำเร็จ"}


@router.post("/logout", status_code=status.HTTP_200_OK)
def logout(response: Response, current_user: User = Depends(get_current_user)):
    response.delete_cookie(ACCESS_COOKIE_NAME, path="/")
    return {"message": f"ออกจากระบบสำเร็จ ลาก่อนคุณ {current_user.full_name}"}