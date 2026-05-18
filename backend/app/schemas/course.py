from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional
from app.models.course import CourseCategory


class CourseBase(BaseModel):
    title: str = Field(..., min_length=3, max_length=200)
    description: Optional[str] = None
    category: CourseCategory
    is_mandatory: bool = False
    cover_image: Optional[str] = None
    estimated_hours: Optional[int] = Field(None, ge=0)


class CourseCreate(CourseBase):
    is_published: bool = False


class CourseUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=3, max_length=200)
    description: Optional[str] = None
    category: Optional[CourseCategory] = None
    is_mandatory: Optional[bool] = None
    cover_image: Optional[str] = None
    estimated_hours: Optional[int] = Field(None, ge=0)
    is_published: Optional[bool] = None


class CourseResponse(CourseBase):
    id: int
    is_published: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class CourseListItem(BaseModel):
    """ข้อมูลย่อสำหรับแสดงในรายการ"""
    id: int
    title: str
    description: Optional[str] = None
    category: CourseCategory
    is_mandatory: bool
    cover_image: Optional[str] = None
    estimated_hours: Optional[int] = None
    is_published: bool
    
    class Config:
        from_attributes = True