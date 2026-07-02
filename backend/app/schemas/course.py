from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


class CategoryCreate(BaseModel):
    label: str = Field(..., min_length=1, max_length=100)


class CategoryResponse(BaseModel):
    id: int
    value: str
    label: str
    course_count: int = 0

    class Config:
        from_attributes = True


class CourseBase(BaseModel):
    title: str = Field(..., min_length=3, max_length=200)
    description: Optional[str] = None
    category: str = Field(..., min_length=1, max_length=100)
    is_mandatory: bool = False
    cover_image: Optional[str] = None
    estimated_hours: Optional[int] = Field(None, ge=0)
    instructor_name: Optional[str] = Field(None, max_length=150)
    # Toggle for the course-level downloads section. True = learners see the
    # consolidated download list on the detail page; False = no downloads.
    allow_downloads: bool = True
    # Periodic recertification window in days. None / 0 → permanent certificate.
    recertify_after_days: Optional[int] = Field(None, ge=0)


class CourseCreate(CourseBase):
    is_published: bool = False


class CourseUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=3, max_length=200)
    description: Optional[str] = None
    category: Optional[str] = Field(None, min_length=1, max_length=100)
    is_mandatory: Optional[bool] = None
    cover_image: Optional[str] = None
    estimated_hours: Optional[int] = Field(None, ge=0)
    instructor_name: Optional[str] = Field(None, max_length=150)
    is_published: Optional[bool] = None
    allow_downloads: Optional[bool] = None
    recertify_after_days: Optional[int] = Field(None, ge=0)


class CourseResponse(CourseBase):
    id: int
    is_published: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    total_lessons: int = 0
    total_modules: int = 0
    enrolled_count: int = 0
    is_enrolled: bool = False
    is_bookmarked: bool = False

    class Config:
        from_attributes = True


class CourseListItem(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    category: str
    is_mandatory: bool
    cover_image: Optional[str] = None
    estimated_hours: Optional[int] = None
    is_published: bool
    instructor_name: Optional[str] = None
    created_at: datetime
    recertify_after_days: Optional[int] = None
    enrolled_count: int = 0

    class Config:
        from_attributes = True