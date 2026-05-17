from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from typing import Optional
from app.models.user import UserRole


class UserBase(BaseModel):
    email: EmailStr
    full_name: str = Field(..., min_length=2, max_length=150)
    department: Optional[str] = None
    position: Optional[str] = None


class UserCreate(UserBase):
    """สำหรับ admin สร้าง user (มี employee_id)"""
    employee_id: str = Field(..., min_length=3, max_length=20)
    password: str = Field(..., min_length=6, max_length=100)
    role: UserRole = UserRole.LEARNER


class UserRegister(UserBase):
    """สำหรับบุคคลทั่วไปสมัครเอง — ไม่มี employee_id, ไม่เลือก role ได้"""
    password: str = Field(..., min_length=6, max_length=100)
    confirm_password: str = Field(..., min_length=6, max_length=100)


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    department: Optional[str] = None
    position: Optional[str] = None
    role: Optional[UserRole] = None


class UserResponse(UserBase):
    id: int
    employee_id: Optional[str] = None
    role: UserRole
    is_active: int
    created_at: datetime
    
    class Config:
        from_attributes = True


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=6, max_length=100)