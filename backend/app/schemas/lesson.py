from pydantic import BaseModel, Field, HttpUrl
from datetime import datetime
from typing import List, Optional
from app.models.lesson import ContentType


class LessonNoteResponse(BaseModel):
    content: str
    updated_at: Optional[datetime] = None


class LessonNoteUpdate(BaseModel):
    # 20k char ceiling — generous for a few hours of meeting-style notes but
    # bounded enough that someone can't paste a novel and tank our DB row size.
    content: str = Field(..., max_length=20000)


class LessonResourceBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    url: str = Field(..., min_length=1, max_length=500)
    resource_type: Optional[str] = Field(None, max_length=50)
    file_size: Optional[int] = Field(None, ge=0)


class LessonResourceCreate(LessonResourceBase):
    pass


class LessonResourceResponse(LessonResourceBase):
    id: int
    lesson_id: int

    class Config:
        from_attributes = True


class LessonBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    content_type: ContentType
    content_url: Optional[str] = None
    caption_url: Optional[str] = Field(None, max_length=500)
    transcript: Optional[str] = None
    duration_seconds: Optional[int] = Field(None, ge=0)
    total_pages: Optional[int] = Field(None, ge=0)
    notes_content: Optional[str] = None
    order_index: int = 0
    min_view_seconds: Optional[int] = Field(None, ge=0)


class LessonCreate(LessonBase):
    module_id: int


class LessonUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    content_type: Optional[ContentType] = None
    content_url: Optional[str] = None
    caption_url: Optional[str] = Field(None, max_length=500)
    transcript: Optional[str] = None
    duration_seconds: Optional[int] = None
    total_pages: Optional[int] = None
    notes_content: Optional[str] = None
    order_index: Optional[int] = None
    min_view_seconds: Optional[int] = None


class LessonResponse(LessonBase):
    id: int
    module_id: int
    created_at: datetime
    resources: List[LessonResourceResponse] = []

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
