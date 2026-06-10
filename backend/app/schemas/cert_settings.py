from typing import Literal, Optional

from pydantic import BaseModel, Field


class CertSettingsOut(BaseModel):
    organization_name: str
    left_signer_name: str
    left_signer_title: str
    right_signer_name: str
    right_signer_title: str
    left_signer_image: Optional[str] = None
    right_signer_image: Optional[str] = None
    signature_mode: str = "two"

    class Config:
        from_attributes = True


class CertSettingsUpdate(BaseModel):
    organization_name: Optional[str] = Field(None, max_length=100)
    left_signer_name: Optional[str] = Field(None, max_length=150)
    left_signer_title: Optional[str] = Field(None, max_length=250)
    right_signer_name: Optional[str] = Field(None, max_length=150)
    right_signer_title: Optional[str] = Field(None, max_length=250)
    signature_mode: Optional[Literal["one", "two"]] = None
