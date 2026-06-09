"""Course-completion certificates.

Eligibility = every lesson in the course is marked is_completed for this user
AND (the course's final quiz, if any, has been passed by this user).
"""
import base64
import io
import logging
import os
import secrets
import threading
import time
from collections import deque
from datetime import datetime, timedelta, timezone
from pathlib import Path

import qrcode
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload
from weasyprint import HTML

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user, require_admin
from app.models.user import User
from app.models.course import Course, Module
from app.models.lesson import Lesson
from app.models.enrollment import Enrollment
from app.models.progress import LessonProgress
from app.models.quiz import Quiz, QuizAttempt
from app.models.certificate import Certificate
from app.services.audit import log_action


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/certificates", tags=["Certificates"])

CERT_DIR = Path("/app/certificates")
CERT_DIR.mkdir(parents=True, exist_ok=True)


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
_VERIFY_RATE_LIMIT = 30   # requests per window
_VERIFY_RATE_WINDOW = 60  # seconds
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
# Eligibility / scoring helpers
# ---------------------------------------------------------------------------

def _course_completion(db: Session, user_id: int, course_id: int):
    """Return (eligible, final_score_or_None, reason_if_not).

    Eligible iff: enrolled, all lessons completed, and the course's final quiz
    (if it has one) has been passed. final_score is the best final-exam attempt
    when a final exists, otherwise None (course without a final still issues).
    """
    enrolled = db.query(Enrollment).filter(
        Enrollment.user_id == user_id,
        Enrollment.course_id == course_id,
    ).first()
    if not enrolled:
        return False, None, "ยังไม่ได้ลงทะเบียนหลักสูตรนี้"

    total_lessons = (
        db.query(func.count(Lesson.id))
        .join(Module, Lesson.module_id == Module.id)
        .filter(Module.course_id == course_id)
        .scalar()
    ) or 0
    if total_lessons == 0:
        return False, None, "หลักสูตรยังไม่มีบทเรียน"

    completed_lessons = (
        db.query(func.count(LessonProgress.id))
        .join(Lesson, Lesson.id == LessonProgress.lesson_id)
        .join(Module, Module.id == Lesson.module_id)
        .filter(
            Module.course_id == course_id,
            LessonProgress.user_id == user_id,
            LessonProgress.completed == True,
        )
        .scalar()
    ) or 0
    if completed_lessons < total_lessons:
        return False, None, f"เรียนยังไม่ครบ ({completed_lessons}/{total_lessons} บทเรียน)"

    final_score = None
    final_quiz = (
        db.query(Quiz)
        .filter(Quiz.course_id == course_id, Quiz.placement == "final")
        .first()
    )
    if final_quiz:
        best = (
            db.query(QuizAttempt)
            .filter(
                QuizAttempt.user_id == user_id,
                QuizAttempt.quiz_id == final_quiz.id,
                QuizAttempt.is_passed == True,
            )
            .order_by(QuizAttempt.score.desc())
            .first()
        )
        if not best:
            return False, None, "ยังไม่ผ่านแบบทดสอบสุดท้าย"
        final_score = float(best.score)

    return True, final_score, None


def _gen_certificate_number() -> str:
    return f"CERT-{datetime.utcnow():%Y%m%d}-{secrets.token_hex(3).upper()}"


def _compute_expires_at(course: Course, issued_at: datetime | None = None) -> datetime | None:
    """Snapshot expiry for a freshly-issued certificate.

    None when the course has no recertification policy (permanent cert).
    Always uses UTC; comparisons elsewhere also use UTC-aware datetimes.
    """
    days = course.recertify_after_days
    if not days or days <= 0:
        return None
    base = issued_at or datetime.now(timezone.utc)
    if base.tzinfo is None:
        base = base.replace(tzinfo=timezone.utc)
    return base + timedelta(days=days)


def _is_expired(cert: Certificate) -> bool:
    if not cert.expires_at:
        return False
    exp = cert.expires_at
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    return exp < datetime.now(timezone.utc)


def _verify_url(cert_number: str) -> str:
    """The URL/text the QR code points at.

    With PUBLIC_BASE_URL set, the QR scans into a working verify link. Without
    it (dev, or before the prod domain is configured), we still encode the
    certificate number as plain text so a scanner shows something useful and
    the recipient can type it into the verify page manually.
    """
    base = (settings.PUBLIC_BASE_URL or "").rstrip("/")
    if base:
        return f"{base}/verify/{cert_number}"
    return cert_number


def _qr_data_uri(text: str) -> str:
    """Render a QR PNG and return a data: URI ready to drop into an <img src>.

    Inline rather than disk-write because WeasyPrint reads the HTML at render
    time — fetching from disk would require absolute paths and cleanup. Box-size
    of 4 + medium error correction renders a ~200px QR at print resolution,
    which scans reliably from a phone held 20cm away.
    """
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=4,
        border=2,
    )
    qr.add_data(text)
    qr.make(fit=True)
    img = qr.make_image(fill_color="#0F6E56", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("ascii")


_THAI_MONTHS = [
    "", "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
]
_THAI_DIGITS = str.maketrans("0123456789", "๐๑๒๓๔๕๖๗๘๙")


def _format_thai_date(d: datetime) -> str:
    """Render '๑๕ พฤศจิกายน พ.ศ. ๒๕๖๗' style dates — matches the official cert
    layout the department uses on paper."""
    day = str(d.day).translate(_THAI_DIGITS)
    month = _THAI_MONTHS[d.month]
    year = str(d.year + 543).translate(_THAI_DIGITS)
    return f"๑".replace("๑", day) + f" {month} พ.ศ. {year}"


def _build_certificate_html(cert, user, course, db=None) -> str:
    """Return the cert PDF as an HTML string. Split from
    `_render_certificate_pdf` so the preview endpoint can render to bytes
    without writing to disk. Accepts duck-typed cert/user/course (real
    ORM rows OR stub objects with the same attributes) — used to keep
    the preview path free of DB insertion.

    Layout intentionally mirrors the official Royal Forest Department
    paper certificate: gold layered border, organisation header, recipient
    name centred and oversized, course title, Thai-numeral Buddhist Era
    date, and two signature blocks at the bottom whose names and titles
    come from `cert_settings` (admin-editable). QR code sits in the
    bottom-right corner for public verification."""
    # Late import to avoid a circular dependency between routers.
    from app.models.cert_settings import CertSettings

    issued = cert.issued_at or datetime.utcnow()
    qr_uri = _qr_data_uri(_verify_url(cert.certificate_number))
    verify_label = (
        "สแกนเพื่อตรวจสอบความถูกต้อง"
        if settings.PUBLIC_BASE_URL
        else "สแกนเพื่อดูเลขที่ใบรับรอง"
    )

    cs: CertSettings | None = None
    if db is not None:
        cs = db.query(CertSettings).first()
    org = (cs.organization_name if cs else "") or "กรมป่าไม้"
    left_name = (cs.left_signer_name if cs else "") or ""
    left_title = (cs.left_signer_title if cs else "") or ""
    right_name = (cs.right_signer_name if cs else "") or ""
    right_title = (cs.right_signer_title if cs else "") or ""
    left_image_url = (cs.left_signer_image if cs else None) or None
    right_image_url = (cs.right_signer_image if cs else None) or None

    score_line = (
        f"<p class='score'>คะแนนสอบสุดท้าย <strong>{int(cert.final_score)}%</strong></p>"
        if cert.final_score is not None else ""
    )

    def _signature_image_uri(url: str | None) -> str | None:
        """Resolve a stored signature URL (e.g. '/images/signatures/abc.png')
        to a base64 data URI WeasyPrint can embed without any URL fetching
        gymnastics. Returns None if the file isn't on disk."""
        if not url:
            return None
        # All signature paths are under /app prefix on the filesystem.
        fs = Path("/app" + url) if url.startswith("/") else Path("/app/" + url)
        if not fs.exists() or not fs.is_file():
            return None
        try:
            data = fs.read_bytes()
        except OSError:
            return None
        return "data:image/png;base64," + base64.b64encode(data).decode("ascii")

    left_image_uri = _signature_image_uri(left_image_url)
    right_image_uri = _signature_image_uri(right_image_url)

    # Header crest: department logo above the org name. Picked up from a
    # known filesystem path so deploy is "drop the PNG in this folder" —
    # no DB row, no upload endpoint. /app/images is the same volume that
    # holds cover images, so existing infra carries it.
    logo_uri = None
    _logo_fs = Path("/app/images/forest_logo.png")
    if _logo_fs.exists() and _logo_fs.is_file():
        try:
            logo_uri = (
                "data:image/png;base64,"
                + base64.b64encode(_logo_fs.read_bytes()).decode("ascii")
            )
        except OSError:
            logo_uri = None
    logo_html = (
        f"<img class='header-logo' src='{logo_uri}' alt='' />"
        if logo_uri else ""
    )

    # Each signature block renders only when at least one of name / title /
    # image is set, so an un-configured cert just shows the body + date + QR
    # without empty signature lines hanging off the bottom. When an image is
    # uploaded we use it INSTEAD of the dotted line so the cert reads like a
    # genuinely-signed document.
    def _sig_block(name: str, title: str, image_uri: str | None) -> str:
        if not (name or title or image_uri):
            return ""
        if image_uri:
            line_html = f"<img class='sig-image' src='{image_uri}' alt='signature' />"
        else:
            line_html = "<div class='sig-line'></div>"
        name_html = f"<div class='sig-name'>({name})</div>" if name else ""
        title_html = f"<div class='sig-title'>{title}</div>" if title else ""
        return f"<div class='sig'>{line_html}{name_html}{title_html}</div>"

    left_sig = _sig_block(left_name, left_title, left_image_uri)
    right_sig = _sig_block(right_name, right_title, right_image_uri)
    issued_date_th = _format_thai_date(issued)

    html = f"""
    <!DOCTYPE html>
    <html lang="th">
    <head>
        <meta charset="UTF-8" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap"
        />
        <style>
            @page {{ size: A4 landscape; margin: 0; }}

            body {{
                margin: 0;
                font-family: 'Sarabun', 'DejaVu Sans', sans-serif;
                background: #FFFFFF;
                color: #1F2937;
            }}

            .outer {{
                margin: 5mm;
                padding: 3mm;
                height: calc(210mm - 10mm - 6mm);
                box-sizing: border-box;
            }}

            .mid {{
                padding: 2mm;
                height: 100%;
                box-sizing: border-box;
            }}

            .frame {{
                padding: 6mm 16mm 28mm 16mm;
                height: 100%;
                box-sizing: border-box;
                background: #FFFFFF;
                text-align: center;
                position: relative;
                overflow: hidden;
            }}

            .header-logo {{
                display: block;
                width: 32mm;
                height: 32mm;
                margin: 0 auto 1mm;
                object-fit: contain;
            }}

            .org {{
                font-size: 43pt;
                font-weight: 600;
                color: #0E4B36;
                margin: 0 0 1mm;
                letter-spacing: 0.02em;
                line-height: 1.1;
            }}

            .org-rule {{ 
                width: 60mm;
                height: 0;
                border-top: 2px solid #D4A017;
                margin: 1mm auto 4mm;
            }}

            .intro {{
                font-size: 18pt;
                margin: 0 0 3mm;
            }}

            /* Recipient name with flanking gold flourishes. Flex layout means
               the side rules grow / shrink to fill, so a short or long name
               both look balanced — no hard-coded widths to fight. */
            .recipient-row {{
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8mm;
                margin: 4mm 0 6mm;
            }}
            .flourish {{
                flex: 1 1 0;
                max-width: 50mm;
                min-width: 12mm;
                height: 0;
                border-top: 1.5px solid #D4A017;
                position: relative;
            }}
            .flourish::before,
            .flourish::after {{
                content: '';
                position: absolute;
                top: -1mm;
                width: 2mm;
                height: 2mm;
                background: #D4A017;
                transform: rotate(45deg);
            }}
            .flourish::before {{ left: 0; }}
            .flourish::after {{ right: 0; }}
            .recipient {{
                font-size: 28pt;
                color: #111827;
                letter-spacing: 0.01em;
                white-space: nowrap;
            }}

            .course-intro {{
                font-size: 18pt;
                font-weight: 600;
                margin: 0 0 2mm;
            }}

            /* Soft tinted card around the course title — gives the achievement
               visual weight without competing with the recipient name. */
            .course-card {{
                display: inline-block;
                padding: 4mm 12mm;
                margin: 0 auto 3mm;
                background: #F2F8F4;
                border: 1px solid #C9E0D0;
                border-radius: 4px;
            }}
            .course {{
                font-size: 18pt;
                font-weight: 600;
                color: #0E4B36;
                margin: 0;
                line-height: 1.35;
            }}

            .score {{
                font-size: 11pt;
                color: #4B5563;
                margin: 0 0 2mm;
            }}

            .score strong {{
                color: #0E4B36;
            }}

            .date {{
                font-size: 13pt;
                color: #374151;
                margin: 4mm 0 0;
            }}

            .sigs {{
                margin: 8mm 0 0;
                display: flex;
                justify-content: space-around;
                align-items: flex-start;
                gap: 10mm;
            }}

            .sig {{
                flex: 1;
                text-align: center;
                font-size: 13pt;
                color: #374151;
            }}

            .sig-line {{
                width: 60mm;
                margin: 0 auto 2mm;
                border-bottom: 1px dotted #6B7280;
                height: 12mm;
            }}

            .sig-image {{
                display: block;
                max-width: 60mm;
                max-height: 18mm;
                margin: 0 auto 1mm;
                object-fit: contain;
            }}

            .sig-name {{
                font-weight: 600;
                color: #1F2937;
            }}

            .sig-title {{
                font-size: 13pt;
                color: #4B5563;
                margin-top: 0.5mm;
            }}

            .footer-row {{
                position: absolute;
                left: 16mm;
                right: 16mm;
                bottom: 3mm;
                display: flex;
                justify-content: space-between;
                align-items: flex-end;
                font-size: 9pt;
                color: #6B7280;
            }}
            /* Small gold diamond centered between the cert-no (left) and the
               QR (right) — ties the corners together visually. */
            .footer-mark {{
                position: absolute;
                left: 50%;
                bottom: 6mm;
                transform: translateX(-50%) rotate(45deg);
                width: 2.5mm;
                height: 2.5mm;
                background: #D4A017;
            }}

            .cert-no {{
                text-align: left;
            }}

            .cert-no strong {{
                font-family: 'DejaVu Sans Mono', monospace;
                color: #1F2937;
            }}

            .qr {{
                text-align: right;
            }}

            .qr img {{
                margin-top: 2mm;
                width: 18mm;
                height: 18mm;
                display: inline-block;
            }}

            .qr .qr-label {{
                font-size: 7.5pt;
                color: #6B7280;
            }}
        </style>
    </head>
    <body>
      <div class="outer">
        <div class="mid">
          <div class="frame">
            {logo_html}
            <div class="org">{org}</div>
            <div class="org-rule"></div>
            <p class="intro">ขอมอบประกาศนียบัตรให้ไว้เพื่อแสดงว่า</p>
            <div class="recipient-row">
              <span class="flourish left"></span>
              <span class="recipient">{user.full_name}</span>
              <span class="flourish right"></span>
            </div>
            <p class="course-intro">ได้สำเร็จการฝึกอบรมหลักสูตร</p>
            <div class="course-card"><span class="course">{course.title}</span></div>
            {score_line}
            <p class="date">ให้ไว้ ณ วันที่ {issued_date_th}</p>

            <div class="sigs">
              {left_sig}
              {right_sig}
            </div>

            <div class="footer-mark"></div>
            <div class="footer-mark"></div>
            <div class="footer-row">
              <div class="cert-no">
                เลขที่ใบรับรอง <strong>{cert.certificate_number}</strong>
              </div>
              <div class="qr">
                <img src="{qr_uri}" alt="QR" />
                <div class="qr-label">{verify_label}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </body>
    </html>
    """

    return html


def _render_certificate_pdf(cert: Certificate, user: User, course: Course, db=None) -> Path:
    """Write a PDF for this certificate and return the path."""
    html = _build_certificate_html(cert, user, course, db=db)
    path = CERT_DIR / f"{cert.certificate_number}.pdf"
    HTML(string=html).write_pdf(target=str(path))
    return path


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
    eligible, final_score, reason = _course_completion(db, current_user.id, course_id)
    # The "current" cert is the most recent one — recertification flows can
    # have multiple historical certs per (user, course).
    existing = (
        db.query(Certificate)
        .filter(Certificate.user_id == current_user.id, Certificate.course_id == course_id)
        .order_by(Certificate.issued_at.desc())
        .first()
    )
    cert_expired = bool(existing) and _is_expired(existing)
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
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="ไม่พบหลักสูตร")

    existing = (
        db.query(Certificate)
        .filter(Certificate.user_id == current_user.id, Certificate.course_id == course_id)
        .order_by(Certificate.issued_at.desc())
        .first()
    )
    # A revoked cert counts as invalid here — a fresh one should be issued
    # (assuming the learner is still eligible). Treat it like an expired one.
    if existing and not _is_expired(existing) and not existing.is_revoked:
        # Regenerate the PDF if it's missing on disk (e.g. fresh container).
        if not existing.pdf_path or not Path(existing.pdf_path).exists():
            path = _render_certificate_pdf(existing, current_user, course, db=db)
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
    eligible, final_score, reason = _course_completion(db, current_user.id, course_id)
    if not eligible:
        raise HTTPException(status_code=400, detail=reason or "ยังไม่มีสิทธิ์รับใบรับรอง")

    cert = Certificate(
        user_id=current_user.id,
        course_id=course_id,
        certificate_number=_gen_certificate_number(),
        final_score=final_score,
        expires_at=_compute_expires_at(course),
    )
    db.add(cert)
    db.commit()
    db.refresh(cert)

    path = _render_certificate_pdf(cert, current_user, course, db=db)
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
            "is_expired": _is_expired(c),
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
        path = _render_certificate_pdf(cert, cert.user, cert.course, db=db)
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
            "is_expired": _is_expired(c),
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
    elif _is_expired(cert):
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

class RevokeIn(BaseModel):
    reason: str = Field(..., min_length=1, max_length=500)


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
