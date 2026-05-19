from app.schemas.user import (
    UserBase, UserCreate, UserRegister, UserUpdate, UserResponse, PasswordChange, AdminResetPassword
)
from app.schemas.auth import LoginRequest, Token, TokenData
from app.schemas.course import (
    CourseBase, CourseCreate, CourseUpdate, CourseResponse, CourseListItem
)