from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from typing import Optional
from app.models.user import UserRole


class UserBase(BaseModel):
    email: EmailStr
    full_name: str = Field(..., min_length=2, max_length=150)
    department: str = Field(..., min_length=2, max_length=150)
    position: str = Field(..., min_length=2, max_length=100)
    phone: str = Field(..., min_length=9, max_length=20)              
    responsibility: str = Field(..., min_length=5, max_length=1000)    
    motivation: str = Field(..., min_length=5, max_length=1000)        


class UserRegister(UserBase):
    username: str = Field(..., min_length=3, max_length=50, pattern="^[a-zA-Z0-9_.-]+$")
    password: str = Field(..., min_length=6, max_length=100)
    confirm_password: str = Field(..., min_length=6, max_length=100)


class UserCreate(UserBase):
    username: str = Field(..., min_length=3, max_length=50, pattern="^[a-zA-Z0-9_.-]+$")
    password: str = Field(..., min_length=6, max_length=100)
    role: UserRole = UserRole.LEARNER


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    department: Optional[str] = None
    position: Optional[str] = None
    phone: Optional[str] = None          
    responsibility: Optional[str] = None    
    motivation: Optional[str] = None         
    role: Optional[UserRole] = None


class UserResponse(UserBase):
    id: int
    username: str
    role: UserRole
    is_active: int
    created_at: datetime
    
    class Config:
        from_attributes = True


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=6, max_length=100)