"""Course-completion certificates.

Eligibility = every lesson in the course is marked is_completed for this user
AND (the course's final quiz, if any, has been passed by this user).
"""
import os
import secrets
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload
from weasyprint import HTML

from app.database import get_db
from app.dependencies import get_current_user, require_admin
from app.models.user import User
from app.models.course import Course, Module
from app.models.lesson import Lesson
from app.models.enrollment import Enrollment
from app.models.progress import LessonProgress
from app.models.quiz import Quiz, QuizAttempt
from app.models.certificate import Certificate


router = APIRouter(prefix="/api/certificates", tags=["Certificates"])

CERT_DIR = Path("/app/certificates")
CERT_DIR.mkdir(parents=True, exist_ok=True)


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


def _render_certificate_pdf(cert: Certificate, user: User, course: Course) -> Path:
    """Write a PDF for this certificate and return the path."""
    issued = cert.issued_at or datetime.utcnow()
    score_line = (
        f"<p class='score'>คะแนนสอบสุดท้าย: <strong>{int(cert.final_score)}%</strong></p>"
        if cert.final_score is not None else ""
    )
    instructor_line = (
        f"<p class='instructor'>วิทยากร: {course.instructor_name}</p>"
        if course.instructor_name else ""
    )

    html = f"""
    <!DOCTYPE html>
    <html lang="th">
    <head>
        <meta charset="UTF-8" />
        <!-- WeasyPrint fetches this at render time and uses the @font-face rules
             inside. Without it the container has no Thai-capable font and Thai
             glyphs draw as blank space. -->
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap"
        />
        <style>
            @page {{ size: A4 landscape; margin: 0; }}
            body {{
                margin: 0;
                font-family: 'Sarabun', 'DejaVu Sans', sans-serif;
                background: #F9F8F2;
                color: #1F2937;
            }}
            .frame {{
                margin: 20mm;
                border: 4px solid #0F6E56;
                border-radius: 12px;
                padding: 18mm 22mm;
                background: #FFFFFF;
                text-align: center;
                height: calc(297mm - 80mm);
            }}
            .eyebrow {{ font-size: 13pt; letter-spacing: 0.18em; color: #0F6E56; text-transform: uppercase; }}
            h1 {{ font-size: 36pt; margin: 8mm 0 4mm; color: #085041; letter-spacing: 0.04em; }}
            .recipient {{ font-size: 28pt; font-weight: 700; margin: 10mm 0 6mm; color: #111827; }}
            .body {{ font-size: 14pt; line-height: 1.6; color: #374151; }}
            .course {{ font-size: 20pt; font-weight: 600; color: #0F6E56; margin: 6mm 0; }}
            .score {{ font-size: 13pt; color: #374151; margin: 2mm 0; }}
            .instructor {{ font-size: 12pt; color: #6B7280; margin: 1mm 0; }}
            .meta {{ margin-top: 12mm; display: flex; justify-content: space-between; font-size: 11pt; color: #6B7280; }}
            .meta div {{ text-align: left; }}
            .meta .right {{ text-align: right; }}
        </style>
    </head>
    <body>
        <div class="frame">
            <p class="eyebrow">ใบรับรองการผ่านหลักสูตร</p>
            <h1>Certificate of Completion</h1>
            <p class="body">มอบให้แก่</p>
            <p class="recipient">{user.full_name}</p>
            <p class="body">เพื่อแสดงว่าได้ผ่านการอบรมหลักสูตร</p>
            <p class="course">{course.title}</p>
            {score_line}
            {instructor_line}
            <div class="meta">
                <div>
                    <div>เลขที่ใบรับรอง</div>
                    <strong>{cert.certificate_number}</strong>
                </div>
                <div class="right">
                    <div>ออกให้เมื่อ</div>
                    <strong>{issued:%d/%m/%Y}</strong>
                </div>
            </div>
        </div>
    </body>
    </html>
    """

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
    return {
        "eligible": eligible,
        "reason": reason,
        "final_score": final_score,
        "has_certificate": existing is not None,
        "certificate_id": existing.id if existing else None,
        "certificate_number": existing.certificate_number if existing else None,
        "expires_at": existing.expires_at.isoformat() if existing and existing.expires_at else None,
        "is_expired": cert_expired,
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
    if existing and not _is_expired(existing):
        # Regenerate the PDF if it's missing on disk (e.g. fresh container).
        if not existing.pdf_path or not Path(existing.pdf_path).exists():
            path = _render_certificate_pdf(existing, current_user, course)
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

    path = _render_certificate_pdf(cert, current_user, course)
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
        path = _render_certificate_pdf(cert, cert.user, cert.course)
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
            "user": {"id": u.id, "full_name": u.full_name, "department": u.department},
            "course": {"id": course.id, "title": course.title},
        }
        for c, u, course in rows
    ]
