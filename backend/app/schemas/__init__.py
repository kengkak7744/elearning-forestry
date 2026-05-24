from app.schemas.user import (
    UserBase, UserCreate, UserRegister, UserUpdate, UserResponse, UserSelfUpdate, PasswordChange, AdminResetPassword
)
from app.schemas.auth import LoginRequest, Token, TokenData
from app.schemas.course import (
    CourseBase, CourseCreate, CourseUpdate, CourseResponse, CourseListItem
)
from app.schemas.module import ModuleBase, ModuleCreate, ModuleUpdate, ModuleResponse
from app.schemas.lesson import (
    LessonBase, LessonCreate, LessonUpdate, LessonResponse, LessonListItem,
)