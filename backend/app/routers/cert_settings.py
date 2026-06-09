"""Admin endpoint for editing the certificate template variables —
organization name and the two signer blocks at the bottom of the PDF.
"""
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Request, Response, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from weasyprint import HTML

from app.database import get_db
from app.dependencies import require_admin
from app.models.cert_settings import CertSettings
from app.models.user import User
from app.services.audit import log_action


# Signatures live alongside the existing /app/images cover-image storage,
# in a subfolder so they're easy to spot and back up separately.
_SIGNATURE_DIR = Path("/app/images/signatures")
_SIGNATURE_DIR.mkdir(parents=True, exist_ok=True)
_SIGNATURE_MAX_BYTES = 2 * 1024 * 1024  # 2 MB — signatures are small line art
_SIGNATURE_URL_PREFIX = "/images/signatures"


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


def _signature_field(side: str) -> str:
    """Map 'left' / 'right' to the matching model attribute name."""
    if side not in ("left", "right"):
        raise HTTPException(status_code=400, detail="ใส่ side เป็น left หรือ right เท่านั้น")
    return f"{side}_signer_image"


@router.post("/upload-signature/{side}", response_model=CertSettingsOut)
def upload_signature(
    side: Literal["left", "right"],
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Upload a PNG signature scan for the left or right signer.

    Constraints:
      - PNG only (transparent background recommended)
      - <= 2 MB

    Replaces the existing signature for that side. Old file is left on
    disk to avoid breaking previously-rendered certs that reference it
    by URL — same trade-off we make for cover images.
    """
    # Content-type check first; some browsers send the wrong one so we
    # also validate the file extension as a backstop.
    content_type = (file.content_type or "").lower()
    suffix = Path(file.filename or "").suffix.lower()
    if not (content_type == "image/png" or suffix == ".png"):
        raise HTTPException(
            status_code=400,
            detail="รองรับเฉพาะไฟล์ PNG เท่านั้น",
        )

    contents = file.file.read()
    if len(contents) > _SIGNATURE_MAX_BYTES:
        raise HTTPException(
            status_code=400,
            detail=f"ไฟล์ต้องไม่เกิน {_SIGNATURE_MAX_BYTES // (1024 * 1024)} MB",
        )

    new_name = f"{uuid.uuid4().hex}.png"
    dest = _SIGNATURE_DIR / new_name
    with open(dest, "wb") as f:
        f.write(contents)

    s = get_or_create_cert_settings(db)
    field = _signature_field(side)
    url = f"{_SIGNATURE_URL_PREFIX}/{new_name}"
    setattr(s, field, url)

    log_action(
        db, admin, "cert_settings.upload_signature",
        target_type="cert_settings",
        target_id=s.id,
        target_label=f"ลายเซ็น {side}",
        summary=f"อัปโหลดลายเซ็นฝั่ง {('ซ้าย' if side == 'left' else 'ขวา')}",
        details={"side": side, "url": url},
        request=request,
    )
    db.commit()
    db.refresh(s)
    return s


class _Stub:
    """Duck-typed stand-in for an ORM row. Used to feed the cert renderer
    placeholder values without inserting a real Certificate / Course / User."""
    def __init__(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)


@router.get("/preview")
def preview_certificate(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Render a placeholder certificate using the currently-saved cert
    settings (org name, signers, signature images) and return it as a
    PDF. Lets admins iterate on the template without issuing a real cert.

    The placeholder fields:
      - recipient name: "ผู้รับใบรับรอง (ตัวอย่าง)"
      - course title: a generic Thai sample
      - score: 100%
      - issued date: today, in Thai B.E.
      - certificate number: "CERT-PREVIEW-<random>" so each preview is
        traceable in the verify-rate-limit log if anyone scans the QR
    """
    # Late import to avoid a circular dependency between the two routers.
    from app.routers.certificates import _build_certificate_html

    now = datetime.now(timezone.utc)
    stamp = now.strftime("%Y%m%d")
    suffix = uuid.uuid4().hex[:6].upper()

    fake_user = _Stub(full_name="ผู้รับใบรับรอง (ตัวอย่าง)")
    fake_course = _Stub(
        title="ชื่อหลักสูตรตัวอย่าง — ระบบ e-Learning",
        instructor_name=None,
    )
    fake_cert = _Stub(
        certificate_number=f"CERT-PREVIEW-{stamp}-{suffix}",
        final_score=100.0,
        issued_at=now,
    )

    html_str = _build_certificate_html(fake_cert, fake_user, fake_course, db=db)
    pdf_bytes = HTML(string=html_str).write_pdf()
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": 'inline; filename="certificate-preview.pdf"',
            "Cache-Control": "no-store",
        },
    )


@router.delete("/signature/{side}", response_model=CertSettingsOut)
def delete_signature(
    side: Literal["left", "right"],
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Clear the stored signature URL for one side.

    The file on disk is left in place — certs already on disk reference
    it, and the disk cost of orphans is trivial. A future cleanup job
    can sweep up unreferenced files if it ever matters.
    """
    s = get_or_create_cert_settings(db)
    field = _signature_field(side)
    setattr(s, field, None)
    log_action(
        db, admin, "cert_settings.delete_signature",
        target_type="cert_settings",
        target_id=s.id,
        target_label=f"ลายเซ็น {side}",
        summary=f"ลบลายเซ็นฝั่ง {('ซ้าย' if side == 'left' else 'ขวา')}",
        details={"side": side},
        request=request,
    )
    db.commit()
    db.refresh(s)
    return s
