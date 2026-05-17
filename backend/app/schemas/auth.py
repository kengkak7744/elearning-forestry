from pydantic import BaseModel
from app.schemas.user import UserResponse


class LoginRequest(BaseModel):
    """เข้าสู่ระบบด้วยเลขประจำตัว (เจ้าหน้าที่) หรืออีเมล (บุคคลทั่วไป)"""
    identifier: str  # employee_id หรือ email
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class TokenData(BaseModel):
    user_id: int | None = None