from pydantic import BaseModel
from app.schemas.user import UserResponse


class LoginRequest(BaseModel):
    """Log in with either a username or an email."""
    identifier: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class SessionStatus(BaseModel):
    authenticated: bool
    user: UserResponse | None = None


class TokenData(BaseModel):
    user_id: int | None = None
