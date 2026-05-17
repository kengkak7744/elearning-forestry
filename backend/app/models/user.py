from sqlalchemy import Column, Integer, String, DateTime, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.database import Base


class UserRole(str, enum.Enum):
    PUBLIC = "public"
    LEARNER = "learner"          
    MANAGER = "manager"          
    INSTRUCTOR = "instructor"    
    ADMIN = "admin"              


class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(String(20), unique=True, nullable=True, index=True)  
    email = Column(String(100), unique=True, nullable=False, index=True)
    full_name = Column(String(150), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), default=UserRole.PUBLIC, nullable=False)
    department = Column(String(150), nullable=True)  
    position = Column(String(100), nullable=True)
    is_active = Column(Integer, default=1)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # relational
    progresses = relationship("LessonProgress", back_populates="user")
    quiz_attempts = relationship("QuizAttempt", back_populates="user")
    certificates = relationship("Certificate", back_populates="user")