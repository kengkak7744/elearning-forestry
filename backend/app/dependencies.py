from typing import Optional
from fastapi import Depends, HTTPException, status, Query, Header
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.database import get_db
from app.core.security import decode_access_token
from app.models.user import User, UserRole


# OAuth2 scheme - บอก FastAPI ว่า token มาจากไหน
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    """check JWT and get current user"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="ไม่สามารถตรวจสอบสิทธิ์ได้",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception
    
    user_id: int = payload.get("sub")
    if user_id is None:
        raise credentials_exception
    
    user = db.query(User).filter(User.id == int(user_id)).first()
    if user is None:
        raise credentials_exception
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="บัญชีผู้ใช้ถูกระงับ"
        )
    
    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """require admin"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="ต้องเป็นผู้ดูแลระบบเท่านั้น"
        )
    return current_user


def require_instructor_or_admin(current_user: User = Depends(get_current_user)) -> User:
    """require instructor or admin"""
    if current_user.role not in [UserRole.INSTRUCTOR, UserRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="ต้องเป็นวิทยากรหรือผู้ดูแลระบบเท่านั้น"
        )
    return current_user


def require_manager_or_above(current_user: User = Depends(get_current_user)) -> User:
    """require manager or above"""
    if current_user.role == UserRole.LEARNER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="ต้องเป็นหัวหน้างานขึ้นไป"
        )
    return current_user


def is_staff(user: User) -> bool:
    """เช็คว่าเป็นเจ้าหน้าที่กรมป่าไม้หรือไม่ (ไม่ใช่บุคคลทั่วไป)"""
    return user.role != UserRole.PUBLIC


def require_staff(current_user: User = Depends(get_current_user)) -> User:
    """อนุญาตเฉพาะเจ้าหน้าที่ (ไม่ใช่บุคคลทั่วไป)"""
    if current_user.role == UserRole.PUBLIC:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="หลักสูตรนี้สำหรับเจ้าหน้าที่กรมป่าไม้เท่านั้น"
        )
    return current_user


def require_media_token(
    t: Optional[str] = Query(None, description="JWT token for file access"),
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
) -> User:
    """For <video>/<iframe>/<img> requests: accept token from ?t= query param OR Authorization header.

    The browser doesn't attach Authorization to media tag requests, so ?t= is the practical fallback.
    """
    raw = t
    if not raw and authorization:
        scheme, _, value = authorization.partition(" ")
        if scheme.lower() == "bearer" and value:
            raw = value

    if not raw:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="ต้องล็อกอินก่อนเข้าถึงไฟล์")

    payload = decode_access_token(raw)
    if not payload or not payload.get("sub"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="โทเค็นไม่ถูกต้องหรือหมดอายุ")

    user = db.query(User).filter(User.id == int(payload["sub"])).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="ผู้ใช้ไม่พร้อมใช้งาน")
    return user