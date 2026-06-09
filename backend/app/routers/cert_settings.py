"""Admin endpoint for editing the certificate template variables —
organization name and the two signer blocks at the bottom of the PDF.
"""
from typing import Optional

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_admin
from app.models.cert_settings import CertSettings
from app.models.user import User
from app.services.audit import log_action


router = APIRouter(prefix="/api/admin/cert-settings", tags=["Cert Settings"])


def get_or_create_cert_settings(db: Session) -> CertSettings:
    s = db.query(CertSettings).first()
    if s is None:
        s = CertSettings(
            id=1,
            organization_name="กรมป่าไม้",
            left_signer_name="",
            left_signer_title="",
            right_signer_name="",
            right_signer_title="",
        )
        db.add(s)
        db.commit()
        db.refresh(s)
    return s


class CertSettingsOut(BaseModel):
    organization_name: str
    left_signer_name: str
    left_signer_title: str
    right_signer_name: str
    right_signer_title: str

    class Config:
        from_attributes = True


class CertSettingsUpdate(BaseModel):
    organization_name: Optional[str] = Field(None, max_length=100)
    left_signer_name: Optional[str] = Field(None, max_length=150)
    left_signer_title: Optional[str] = Field(None, max_length=250)
    right_signer_name: Optional[str] = Field(None, max_length=150)
    right_signer_title: Optional[str] = Field(None, max_length=250)


@router.get("", response_model=CertSettingsOut)
def get_cert_settings(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    return get_or_create_cert_settings(db)


@router.put("", response_model=CertSettingsOut)
def update_cert_settings(
    payload: CertSettingsUpdate,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    s = get_or_create_cert_settings(db)
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(s, k, v)
    log_action(
        db, admin, "cert_settings.update",
        target_type="cert_settings",
        target_id=s.id,
        target_label="ตั้งค่าใบรับรอง",
        summary="ปรับปรุงข้อมูลผู้ลงนามใบรับรอง",
        details={"changed_fields": list(data.keys())},
        request=request,
    )
    db.commit()
    db.refresh(s)
    return s
