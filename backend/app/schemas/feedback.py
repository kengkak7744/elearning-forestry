from typing import Optional

from pydantic import BaseModel, Field


class FeedbackIn(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    # Empty string is normalised to None server-side.
    comment: Optional[str] = Field(None, max_length=2000)


class FeedbackOut(BaseModel):
    id: int
    rating: int
    comment: Optional[str]
    created_at: Optional[str]
    updated_at: Optional[str]

    class Config:
        from_attributes = True
