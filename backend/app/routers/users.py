from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import Optional
from app.database import get_db
from app.models.user import User, UserRole
from app.schemas.user import UserCreate, UserUpdate, UserResponse, AdminResetPassword
from app.core.security import hash_password
from app.dependencies import get_current_user, require_admin


router = APIRouter(prefix="/api/users", tags=["Users"])


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    user_data: UserCreate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin)
):
    """สร้างผู้ใช้ใหม่ (admin only)"""
    if db.query(User).filter(User.username == user_data.username).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"ชื่อผู้ใช้ '{user_data.username}' มีอยู่ในระบบแล้ว"
        )
    
    if db.query(User).filter(User.email == user_data.email).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="อีเมลนี้มีอยู่ในระบบแล้ว"
        )
    
    new_user = User(
        username=user_data.username,
        email=user_data.email,
        full_name=user_data.full_name,
        hashed_password=hash_password(user_data.password),
        role=user_data.role,
        department=user_data.department,
        position=user_data.position,
        phone=user_data.phone,                          
        responsibility=user_data.responsibility,        
        motivation=user_data.motivation,                
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@router.get("", response_model=list[UserResponse])
def list_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    search: Optional[str] = Query(None, description="ค้นหาจากชื่อ username หรืออีเมล"),
    role: Optional[UserRole] = None,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin)
):
    query = db.query(User)
    
    if search:
        query = query.filter(or_(
            User.full_name.ilike(f"%{search}%"),
            User.username.ilike(f"%{search}%"),
            User.email.ilike(f"%{search}%"),
        ))
    
    if role:
        query = query.filter(User.role == role)
    
    return query.offset(skip).limit(limit).all()


@router.get("/{user_id}", response_model=UserResponse)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.id != user_id and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="ไม่มีสิทธิ์ดูข้อมูลผู้ใช้คนอื่น"
        )
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="ไม่พบผู้ใช้")
    return user


@router.put("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    user_data: UserUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="ไม่พบผู้ใช้")

    update_data = user_data.model_dump(exclude_unset=True)

    # Prevent admin from downgrading their own role (locks them out)
    if user.id == admin.id and "role" in update_data and update_data["role"] != admin.role:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ไม่สามารถเปลี่ยนบทบาทของตัวเองได้",
        )

    for field, value in update_data.items():
        setattr(user, field, value)

    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=status.HTTP_200_OK)
def deactivate_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    if user_id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ไม่สามารถระงับบัญชีของตัวเองได้"
        )
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="ไม่พบผู้ใช้")
    
    user.is_active = False
    db.commit()
    
    return {"message": f"ระงับบัญชี {user.full_name} เรียบร้อย"}

@router.post("/{user_id}/reset-password", status_code=status.HTTP_200_OK)
def reset_user_password(
    user_id: int,
    data: AdminResetPassword,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """รีเซ็ตรหัสผ่านของผู้ใช้ (admin only)"""
    if user_id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ไม่สามารถรีเซ็ตรหัสผ่านของตัวเองได้ ใช้หน้า Profile แทน"
        )
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="ไม่พบผู้ใช้")
    
    user.hashed_password = hash_password(data.new_password)
    db.commit()
    
    return {
        "message": f"รีเซ็ตรหัสผ่านของ {user.full_name} สำเร็จ",
        "username": user.username
    }