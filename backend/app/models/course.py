from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, Enum, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.database import Base


class CourseCategory(str, enum.Enum):
    COMPLIANCE = "compliance"
    TECHNICAL = "technical"
    SAFETY = "safety"
    SKILL = "skill"


class Course(Base):
    __tablename__ = "courses"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(Enum(CourseCategory), nullable=False)
    is_mandatory = Column(Boolean, default=False)
    cover_image = Column(String(500), nullable=True)
    estimated_hours = Column(Integer, nullable=True)
    instructor_name = Column(String(150), nullable=True)
    is_published = Column(Boolean, default=False)
    # Annual / periodic recertification. NULL = permanent (no recert).
    # When set, certificates issued for this course get expires_at = issued + N days.
    recertify_after_days = Column(Integer, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    modules = relationship("Module", back_populates="course", cascade="all, delete-orphan")
    certificates = relationship("Certificate", back_populates="course")
    enrollments = relationship("Enrollment", back_populates="course", cascade="all, delete-orphan")


class Module(Base):
    __tablename__ = "modules"
    
    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False, index=True)  # ⭐ เพิ่ม ForeignKey
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    order_index = Column(Integer, default=0)
    
    course = relationship("Course", back_populates="modules")  # ⭐ เอา primaryjoin ออก ให้ SQLAlchemy หาเอง
    lessons = relationship("Lesson", back_populates="module", cascade="all, delete-orphan")