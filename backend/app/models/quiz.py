from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, JSON, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.database import Base


class QuizType(str, enum.Enum):
    QUICK = "quick"          # แบบทดสอบย่อยระหว่างเรียน
    FINAL = "final"          # สอบประเมินผลท้ายหลักสูตร


class Quiz(Base):
    __tablename__ = "quizzes"
    
    id = Column(Integer, primary_key=True, index=True)
    lesson_id = Column(Integer, ForeignKey("lessons.id"), nullable=False, index=True)
    quiz_type = Column(Enum(QuizType), default=QuizType.QUICK)
    question = Column(Text, nullable=False)
    options = Column(JSON, nullable=False)  # ["ตัวเลือก A", "ตัวเลือก B", ...]
    correct_answer = Column(Integer, nullable=False)  # index 0-based
    explanation = Column(Text, nullable=True)
    order_index = Column(Integer, default=0)
    
    lesson = relationship("Lesson", back_populates="quizzes")
    attempts = relationship("QuizAttempt", back_populates="quiz", cascade="all, delete-orphan")


class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    quiz_id = Column(Integer, ForeignKey("quizzes.id"), nullable=False, index=True)
    selected_answer = Column(Integer, nullable=False)
    is_correct = Column(Boolean, nullable=False)
    attempted_at = Column(DateTime(timezone=True), server_default=func.now())
    
    user = relationship("User", back_populates="quiz_attempts")
    quiz = relationship("Quiz", back_populates="attempts")