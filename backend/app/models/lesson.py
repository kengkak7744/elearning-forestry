from sqlalchemy import Column, Integer, String, Text, DateTime, Enum, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.database import Base


class ContentType(str, enum.Enum):
    VIDEO = "video"
    PDF = "pdf"


class Lesson(Base):
    __tablename__ = "lessons"
    
    id = Column(Integer, primary_key=True, index=True)
    module_id = Column(Integer, ForeignKey("modules.id"), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    content_type = Column(Enum(ContentType), nullable=False)
    
    # สำหรับวิดีโอ
    video_url = Column(String(500), nullable=True)
    duration_seconds = Column(Integer, nullable=True)
    
    # สำหรับ PDF
    pdf_url = Column(String(500), nullable=True)
    total_pages = Column(Integer, nullable=True)
    
    # เนื้อหาประกอบ (Markdown)
    notes_content = Column(Text, nullable=True)
    
    order_index = Column(Integer, default=0)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    module = relationship("Module", back_populates="lessons")
    progresses = relationship("LessonProgress", back_populates="lesson", cascade="all, delete-orphan")
    quizzes = relationship("Quiz", back_populates="lesson", cascade="all, delete-orphan")
    resources = relationship("LessonResource", back_populates="lesson", cascade="all, delete-orphan")


class LessonResource(Base):
    """เอกสารแนบของบทเรียน เช่น PDF คู่มือ ลิงก์ภายนอก"""
    __tablename__ = "lesson_resources"
    
    id = Column(Integer, primary_key=True, index=True)
    lesson_id = Column(Integer, ForeignKey("lessons.id"), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    resource_type = Column(String(20))  # 'pdf', 'slide', 'link'
    url = Column(String(500), nullable=False)
    file_size = Column(String(20), nullable=True)
    
    lesson = relationship("Lesson", back_populates="resources")