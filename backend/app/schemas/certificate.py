from pydantic import BaseModel, Field


class RevokeIn(BaseModel):
    reason: str = Field(..., min_length=1, max_length=500)
