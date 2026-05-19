from sqlalchemy import Column, Integer, String, DateTime, Enum, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.database import Base


class UserRole(str, enum.Enum):
    LEARNER = "learner"          
    MANAGER = "manager"           
    INSTRUCTOR = "instructor"    
    ADMIN = "admin"              


class User(Base):
    __tablename__ = "users"
    
    ##Register
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(100), unique=True, nullable=False, index=True)
    full_name = Column(String(150), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), default=UserRole.LEARNER, nullable=False)
    department = Column(String(150), nullable=False)  #require
    position = Column(String(100), nullable=False)    #require
    phone = Column(String(20), nullable=False)
    responsibility = Column(Text, nullable=False)
    motivation = Column(Text, nullable=False)
    ##end Register

    ##auto implement
    is_active = Column(Integer, default=1)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    ##end auto implement
    
    progresses = relationship("LessonProgress", back_populates="user")
    quiz_attempts = relationship("QuizAttempt", back_populates="user")
    certificates = relationship("Certificate", back_populates="user")