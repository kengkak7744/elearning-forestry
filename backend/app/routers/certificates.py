"""Course-completion certificates.

Eligibility = every lesson in the course is marked is_completed for this user
AND (the course's final quiz, if any, has been passed by this user).

Domain logic (eligibility, numbering, expiry, PDF rendering) lives in
app/services/completion.py and app/services/certificate.py; this router keeps
the HTTP concerns — auth, rate limiting, and response shaping.
"""
import logging
import threading
import time
from collections import deque
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session, joinedload

from app.config import settings
from app.core.helpers import get_or_404
from app.database import get_db
from app.dependencies import get_current_user, require_admin
from app.models.user import User
from app.models.course import Course
from app.models.certificate import Certificate
from app.schemas.certificate import RevokeIn
from app.services.audit import log_action
from app.services.completion import course_completion
from app.services.certificate import (
    compute_expires_at,
    generate_certificate_number,
    is_expired,
    render_certificate_pdf,
)


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/certificates", tags=["Certificates"])


# ---------------------------------------------------------------------------
# Rate limiting for the public verify endpoint
# ---------------------------------------------------------------------------
#
# Sliding-window per-IP counter, in-process. Purpose is to make the public
# verify endpoint useless as a name-enumeration oracle (cert numbers are
# predictable-ish: CERT-YYYYMMDD-{6 hex}). 30 attempts/minute lets a real human
# correct typos comfortably, but kills any practical brute-force.
#
# Caveats:
#  - In-memory: each gunicorn worker has its own counter, so the *effective*
#    limit is `_VERIFY_RATE_LIMIT * num_workers`. With the current 2-worker
#    setup that's 60/min, still well below useful-attack speeds.
#  - For stricter limits in prod, add a Traefik rate-limit middleware in front.
_VERIFY_RATE_LIMIT = settings.VERIFY_RATE_LIMIT
_VERIFY_RATE_WINDOW = settings.VERIFY_RATE_WINDOW
_verify_hits: dict[str, deque] = {}
_verify_hits_lock = threading.Lock()


def _client_ip(request: Request) -> str:
    """Trust X-Forwarded-For from the reverse proxy (Traefik). Falls back to
    the direct socket peer in dev."""
    xff = request.headers.get("X-Forwarded-For")
    if xff:
        return xff.split(",")[0].strip()
    real = request.headers.get("X-Real-IP")
    if real:
        return real
    return request.client.host if request.client else "unknown"


def _check_verify_rate(ip: str) -> bool:
    """Return True if this IP is still within the verify rate limit."""
    now = time.monotonic()
    cutoff = now - _VERIFY_RATE_WINDOW
    with _verify_hits_lock:
        bucket = _verify_hits.setdefault(ip, deque())
        # Drop expired hits.
        while bucket and bucket[0] < cutoff:
            bucket.popleft()
        if len(bucket) >= _VERIFY_RATE_LIMIT:
            return False
        bucket.append(now)
        # Opportunistic cleanup so the dict doesn't grow without bound.
        if len(_verify_hits) > 10_000:
            for k in [k for k, v in _verify_hits.items() if not v or v[-1] < cutoff]:
                _verify_hits.pop(k, None)
        return True


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/course/{course_id}/eligibility")
def eligibility(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Tell the client whether the learner can claim a certificate for this course,
    and whether one was already issued (and whether it's still valid)."""
    eligible, final_score, reason = course_completion(db, current_user.id, course_id)
    # The "current" cert is the most recent one — recertification flows can
    # have multiple historical certs per (user, course).
    existing = (
        db.query(Certificate)
        .filter(Certificate.user_id == current_user.id, Certificate.course_id == course_id)
        .order_by(Certificate.issued_at.desc())
        .first()
    )
    cert_expired = bool(existing) and is_expired(existing)
    cert_revoked = bool(existing) and existing.is_revoked
    return {
        "eligible": eligible,
        "reason": reason,
        "final_score": final_score,
        "has_certificate": existing is not None,
        "certificate_id": existing.id if existing else None,
        "certificate_number": existing.certificate_number if existing else None,
        "expires_at": existing.expires_at.isoformat() if existing and existing.expires_at else None,
        "is_expired": cert_expired,
        "is_revoked": cert_revoked,
    }


@router.post("/course/{course_id}/issue", status_code=status.HTTP_201_CREATED)
def issue(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Idempotent w.r.t. valid certificates: returns the existing cert if it's
    still valid, otherwise (no cert, or cert expired) creates a new one.

    For recertifiable courses, the old expired cert is kept in the DB as an
    audit-trail record; the new cert just shadows it for "current" lookups.
    """
    course = get_or_404(db, Course, course_id, "ไม่พบหลักสูตร")

    existing = (
        db.query(Certificate)
        .filter(Certificate.user_id == current_user.id, Certificate.course_id == course_id)
        .order_by(Certificate.issued_at.desc())
        .first()
    )
    # A revoked cert counts as invalid here — a fresh one should be issued
    # (assuming the learner is still eligible). Treat it like an expired one.
    if existing and not is_expired(existing) and not existing.is_revoked:
        # Regenerate the PDF if it's missing on disk (e.g. fresh container).
        if not existing.pdf_path or not Path(existing.pdf_path).exists():
            path = render_certificate_pdf(existing, current_user, course, db=db)
            existing.pdf_path = str(path)
            db.commit()
        return {
            "id": existing.id,
            "certificate_number": existing.certificate_number,
            "final_score": existing.final_score,
            "issued_at": existing.issued_at.isoformat() if existing.issued_at else None,
            "expires_at": existing.expires_at.isoformat() if existing.expires_at else None,
            "already_existed": True,
        }

    # Either no cert yet, or the most recent one expired → issue fresh.
    # Re-check eligibility — they may have retaken the final quiz between expiry
    # and now.
    eligible, final_score, reason = course_completion(db, current_user.id, course_id)
    if not eligible:
        raise HTTPException(status_code=400, detail=reason or "ยังไม่มีสิทธิ์รับใบรับรอง")

    cert = Certificate(
        user_id=current_user.id,
        course_id=course_id,
        certificate_number=generate_certificate_number(),
        final_score=final_score,
        expires_at=compute_expires_at(course),
    )
    db.add(cert)
    db.commit()
    db.refresh(cert)

    path = render_certificate_pdf(cert, current_user, course, db=db)
    cert.pdf_path = str(path)
    db.commit()

    return {
        "id": cert.id,
        "certificate_number": cert.certificate_number,
        "final_score": cert.final_score,
        "issued_at": cert.issued_at.isoformat() if cert.issued_at else None,
        "expires_at": cert.expires_at.isoformat() if cert.expires_at else None,
        "already_existed": False,
    }


@router.get("/me")
def my_certificates(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """All certificates issued to me."""
    rows = (
        db.query(Certificate, Course)
        .join(Course, Course.id == Certificate.course_id)
        .filter(Certificate.user_id == current_user.id)
        .order_by(Certificate.issued_at.desc())
        .all()
    )
    return [
        {
            "id": c.id,
            "certificate_number": c.certificate_number,
            "final_score": c.final_score,
            "issued_at": c.issued_at.isoformat() if c.issued_at else None,
            "expires_at": c.expires_at.isoformat() if c.expires_at else None,
            "is_expired": is_expired(c),
            "is_revoked": c.is_revoked,
            "course": {"id": course.id, "title": course.title},
        }
        for c, course in rows
    ]


@router.get("/{cert_id}/download")
def download(
    cert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Download the cert PDF. Owner only (admins can also fetch)."""
    cert = (
        db.query(Certificate)
        .options(joinedload(Certificate.user), joinedload(Certificate.course))
        .filter(Certificate.id == cert_id)
        .first()
    )
    if not cert:
        raise HTTPException(status_code=404, detail="ไม่พบใบรับรอง")

    is_owner = cert.user_id == current_user.id
    is_admin = current_user.role.value in ("admin", "instructor")
    if not (is_owner or is_admin):
        raise HTTPException(status_code=403, detail="ไม่มีสิทธิ์ดูใบรับรองนี้")

    # Regenerate if the PDF is missing (e.g. cert dir wiped on container rebuild).
    if not cert.pdf_path or not Path(cert.pdf_path).exists():
        path = render_certificate_pdf(cert, cert.user, cert.course, db=db)
        cert.pdf_path = str(path)
        db.commit()

    return FileResponse(
        cert.pdf_path,
        media_type="application/pdf",
        filename=f"{cert.certificate_number}.pdf",
    )


@router.get("/admin/all")
def admin_list(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """All issued certificates — admin view with user + course info."""
    rows = (
        db.query(Certificate, User, Course)
        .join(User, User.id == Certificate.user_id)
        .join(Course, Course.id == Certificate.course_id)
        .order_by(Certificate.issued_at.desc())
        .all()
    )
    return [
        {
            "id": c.id,
            "certificate_number": c.certificate_number,
            "final_score": c.final_score,
            "issued_at": c.issued_at.isoformat() if c.issued_at else None,
            "expires_at": c.expires_at.isoformat() if c.expires_at else None,
            "is_expired": is_expired(c),
            "is_revoked": c.is_revoked,
            "revoked_reason": c.revoked_reason,
            "revoked_at": c.revoked_at.isoformat() if c.revoked_at else None,
            "user": {"id": u.id, "full_name": u.full_name, "department": u.department},
            "course": {"id": course.id, "title": course.title},
        }
        for c, u, course in rows
    ]


# ---------------------------------------------------------------------------
# Public verification — no auth, rate limited
# ---------------------------------------------------------------------------

@router.get("/verify/{cert_number}")
def verify_certificate(
    cert_number: str,
    request: Request,
    db: Session = Depends(get_db),
):
    """Public certificate verification — no auth required.

    Returns the minimum information needed to confirm authenticity:
        - holder full name (visible on the printed cert anyway)
        - course title
        - issued_at, expires_at
        - status: 'valid' | 'expired' | 'revoked' | 'not_found'

    Does NOT return: email, department, user_id, internal IDs, revocation
    reason, or which admin revoked it. None of that helps a third-party
    verifier; it only leaks PII or makes the endpoint useful for enumeration.

    Rate-limited per IP — see _check_verify_rate. Cert numbers have a
    predictable prefix (CERT-YYYYMMDD-{6 hex}), so unbounded lookups are an
    enumeration risk we explicitly close.
    """
    ip = _client_ip(request)
    if not _check_verify_rate(ip):
        raise HTTPException(
            status_code=429,
            detail="ตรวจสอบบ่อยเกินไป — กรุณาลองใหม่อีกครั้งในอีก 1 นาที",
        )

    # Normalise — recipients copying from a printout might include whitespace
    # or paste with mixed case. The cert numbers we issue are uppercase.
    normalized = (cert_number or "").strip().upper()
    if not normalized:
        raise HTTPException(status_code=404, detail="ไม่พบใบรับรองนี้")

    row = (
        db.query(Certificate, User, Course)
        .join(User, User.id == Certificate.user_id)
        .join(Course, Course.id == Certificate.course_id)
        .filter(Certificate.certificate_number == normalized)
        .first()
    )
    if not row:
        # Same shape as the success response, just with status='not_found',
        # so the frontend's render path doesn't fork on HTTP status.
        return {"status": "not_found", "certificate_number": normalized}

    cert, user, course = row
    if cert.is_revoked:
        status_str = "revoked"
    elif is_expired(cert):
        status_str = "expired"
    else:
        status_str = "valid"

    return {
        "status": status_str,
        "certificate_number": cert.certificate_number,
        "holder_name": user.full_name,
        "course_title": course.title,
        "issued_at": cert.issued_at.isoformat() if cert.issued_at else None,
        "expires_at": cert.expires_at.isoformat() if cert.expires_at else None,
        "final_score": cert.final_score,
    }


# ---------------------------------------------------------------------------
# Admin revocation
# ---------------------------------------------------------------------------

@router.post("/{cert_id}/revoke")
def revoke_certificate(
    cert_id: int,
    payload: RevokeIn,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Mark a certificate as revoked.

    Idempotent — revoking an already-revoked cert is a no-op (with a fresh
    audit row each time the action is taken, so a re-attempt is traceable).
    The PDF on disk is left as-is so old downloads keep working; the QR scan
    on the printed cert will now show 'revoked' on the verify page, which is
    the authoritative source.
    """
    cert = (
        db.query(Certificate)
        .options(joinedload(Certificate.user), joinedload(Certificate.course))
        .filter(Certificate.id == cert_id)
        .first()
    )
    if not cert:
        raise HTTPException(status_code=404, detail="ไม่พบใบรับรอง")

    reason = payload.reason.strip()
    cert.is_revoked = True
    cert.revoked_reason = reason
    cert.revoked_at = datetime.now(timezone.utc)
    cert.revoked_by_id = admin.id
    log_action(
        db, admin, "certificate.revoke",
        target_type="certificate",
        target_id=cert.id,
        target_label=cert.certificate_number,
        summary=f"เพิกถอนใบรับรอง {cert.certificate_number} ({cert.user.full_name} / {cert.course.title})",
        details={"reason": reason},
        request=request,
    )
    db.commit()
    return {
        "id": cert.id,
        "certificate_number": cert.certificate_number,
        "is_revoked": True,
        "revoked_reason": cert.revoked_reason,
        "revoked_at": cert.revoked_at.isoformat() if cert.revoked_at else None,
    }


@router.post("/{cert_id}/unrevoke")
def unrevoke_certificate(
    cert_id: int,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Undo a revocation — for the case where an admin pulled the wrong cert.

    Clears all four revocation fields so the cert returns to indistinguishable-
    from-never-revoked state. The audit log still records both actions, which
    is the actual paper trail.
    """
    cert = (
        db.query(Certificate)
        .options(joinedload(Certificate.user), joinedload(Certificate.course))
        .filter(Certificate.id == cert_id)
        .first()
    )
    if not cert:
        raise HTTPException(status_code=404, detail="ไม่พบใบรับรอง")
    cert.is_revoked = False
    cert.revoked_reason = None
    cert.revoked_at = None
    cert.revoked_by_id = None
    log_action(
        db, admin, "certificate.unrevoke",
        target_type="certificate",
        target_id=cert.id,
        target_label=cert.certificate_number,
        summary=f"ยกเลิกการเพิกถอนใบรับรอง {cert.certificate_number} ({cert.user.full_name} / {cert.course.title})",
        request=request,
    )
    db.commit()
    return {
        "id": cert.id,
        "certificate_number": cert.certificate_number,
        "is_revoked": False,
    }
