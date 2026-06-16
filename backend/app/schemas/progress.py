from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class ProgressUpdate(BaseModel):
    lesson_id: int
    current_position: int = Field(0, ge=0)  # seconds watched/read metric
    # Deprecated client hints kept for backward compatibility. The server
    # derives completion and content type from the lesson record.
    is_completed: bool = False
    content_type: Optional[str] = None

class ProgressResponse(BaseModel):
    id: int
    user_id: int
    lesson_id: int
    current_position: int
    is_completed: bool
    last_accessed_at: Optional[datetime]
    
    class Config:
        from_attributes = True
