from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.database import Base


class ContentType(str, enum.Enum):
    VIDEO_FILE = "video_file"     
    VIDEO_YOUTUBE = "video_youtube"  
    PDF = "pdf"        


class Lesson(Base):
    __tablename__ = "lessons"
    
    id = Column(Integer, primary_key=True, index=True)
    module_id = Column(Integer, ForeignKey("modules.id"), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    content_type = Column(Enum(ContentType), nullable=False)
    
    content_url = Column(String(500), nullable=True)
    
    # For videos
    duration_seconds = Column(Integer, nullable=True)
    
    # For PDFs
    total_pages = Column(Integer, nullable=True)
    
    notes_content = Column(Text, nullable=True)  # Markdown notes
    order_index = Column(Integer, default=0, nullable=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    module = relationship("Module", back_populates="lessons")
    resources = relationship("LessonResource", back_populates="lesson", cascade="all, delete-orphan")
    progresses = relationship("LessonProgress", back_populates="lesson", cascade="all, delete-orphan")
    quizzes = relationship("Quiz", back_populates="lesson", cascade="all, delete-orphan")


class LessonResource(Base):
    __tablename__ = "lesson_resources"
    
    id = Column(Integer, primary_key=True, index=True)
    lesson_id = Column(Integer, ForeignKey("lessons.id"), nullable=False)
    title = Column(String(200), nullable=False)
    resource_type = Column(String(50), nullable=True) 
    url = Column(String(500), nullable=False)
    file_size = Column(Integer, nullable=True) 
    
    lesson = relationship("Lesson", back_populates="resources")