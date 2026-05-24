from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List
from app.schemas.lesson import LessonListItem


class ModuleBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    order_index: int = 0


class ModuleCreate(ModuleBase):
    course_id: int


class ModuleUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    order_index: Optional[int] = None


class ModuleResponse(ModuleBase):
    id: int
    course_id: int
    lessons: List[LessonListItem] = []
    
    class Config:
        from_attributes = True