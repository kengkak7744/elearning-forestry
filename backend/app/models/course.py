from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class CourseCategory(Base):
    """Admin/instructor-managed course category.

    `value` is the string stored in courses.category; `label` is the Thai
    display name. The four legacy rows keep their English slugs
    (compliance/technical/safety/skill) so existing courses keep working;
    categories created in the UI store the Thai name in both fields.
    """
    __tablename__ = "course_categories"

    id = Column(Integer, primary_key=True, index=True)
    value = Column(String(100), unique=True, index=True, nullable=False)
    label = Column(String(100), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Course(Base):
    __tablename__ = "courses"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    # Plain string matching CourseCategory.value — not a FK, so deleting a
    # category can be validated (blocked while in use) instead of cascading.
    category = Column(String(100), nullable=False)
    is_mandatory = Column(Boolean, default=False)
    cover_image = Column(String(500), nullable=True)
    estimated_hours = Column(Integer, nullable=True)
    instructor_name = Column(String(150), nullable=True)
    is_published = Column(Boolean, default=False)
    # Controls whether the "ดาวน์โหลดเอกสารประกอบหลักสูตร" section on the
    # course detail page is shown. Default True for backwards compatibility
    # with courses that existed before this flag was added — admins can
    # opt-out per-course (e.g. exam materials, copyrighted PDFs) by flipping
    # this off in the Settings tab.
    allow_downloads = Column(Boolean, default=True, nullable=False, server_default="true")
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
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False, index=True)  # the ForeignKey to courses
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    order_index = Column(Integer, default=0)
    
    course = relationship("Course", back_populates="modules")  # no explicit primaryjoin — let SQLAlchemy infer it
    lessons = relationship("Lesson", back_populates="module", cascade="all, delete-orphan")