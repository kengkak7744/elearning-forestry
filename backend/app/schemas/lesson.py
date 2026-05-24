from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional
from app.models.lesson import ContentType


class LessonBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    content_type: ContentType
    content_url: Optional[str] = None
    duration_seconds: Optional[int] = Field(None, ge=0)
    total_pages: Optional[int] = Field(None, ge=0)
    notes_content: Optional[str] = None
    order_index: int = 0


class LessonCreate(LessonBase):
    module_id: int


class LessonUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    content_type: Optional[ContentType] = None
    content_url: Optional[str] = None
    duration_seconds: Optional[int] = None
    total_pages: Optional[int] = None
    notes_content: Optional[str] = None
    order_index: Optional[int] = None


class LessonResponse(LessonBase):
    id: int
    module_id: int
    created_at: datetime
    
    class Config:
        from_attributes = True


class LessonListItem(BaseModel):
    id: int
    title: str
    content_type: ContentType
    duration_seconds: Optional[int] = None
    total_pages: Optional[int] = None
    order_index: int
    
    class Config:
        from_attributes = True