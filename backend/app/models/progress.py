from sqlalchemy import Column, Integer, Boolean, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class LessonProgress(Base):
    """ความคืบหน้าการเรียน — ตารางที่ update บ่อยที่สุด"""
    __tablename__ = "lesson_progress"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    lesson_id = Column(Integer, ForeignKey("lessons.id"), nullable=False, index=True)
    
    # สำหรับวิดีโอ — update ทุก 10 วิ
    position_seconds = Column(Integer, default=0)
    
    # สำหรับ PDF
    current_page = Column(Integer, default=1)
    pages_read_count = Column(Integer, default=0)
    
    completed = Column(Boolean, default=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    
    last_accessed_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # ป้องกันการสร้าง record ซ้ำ — สำคัญสำหรับ UPSERT
    __table_args__ = (
        UniqueConstraint('user_id', 'lesson_id', name='uq_user_lesson'),
    )
    
    user = relationship("User", back_populates="progresses")
    lesson = relationship("Lesson", back_populates="progresses")