from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class ProgressUpdate(BaseModel):
    lesson_id: int
    current_position: int = Field(..., ge=0)  # seconds for video, page for pdf
    is_completed: bool = False

class ProgressResponse(BaseModel):
    id: int
    user_id: int
    lesson_id: int
    current_position: int
    is_completed: bool
    last_accessed_at: Optional[datetime]
    
    class Config:
        from_attributes = True