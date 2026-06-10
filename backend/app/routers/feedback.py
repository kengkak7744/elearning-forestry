"""Post-completion course feedback (star rating + free text).

Endpoints:
  POST   /api/courses/{course_id}/feedback          submit/upsert my feedback
  GET    /api/courses/{course_id}/feedback/me       my own feedback (if any)
  GET    /api/courses/{course_id}/feedback/summary  aggregate (avg, count, dist)
  GET    /api/courses/{course_id}/feedback          list — admin/instructor only

Submission is gated on full course completion (every lesson done + final quiz
passed if one exists) — same eligibility as certificate issuance.
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.helpers import get_or_404
from app.database import get_db
from app.dependencies import get_current_user
from app.models.course import Course
from app.models.course_feedback import CourseFeedback
from app.models.user import User
# Reuse the cert eligibility check so "completed" means the same thing
# everywhere — single source of truth for what counts as finishing a course.
from app.services.completion import course_completion


router = APIRouter(prefix="/api/courses", tags=["Course feedback"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/{course_id}/feedback", status_code=status.HTTP_201_CREATED)
def submit_feedback(
    course_id: int,
    payload: FeedbackIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upsert this learner's feedback for a course.

    Gated on completion — anyone trying earlier gets a 400 explaining why
    (matches what the certificate endpoint returns).
    """
    course = get_or_404(db, Course, course_id, "ไม่พบหลักสูตร")

    eligible, _final_score, reason = course_completion(db, current_user.id, course_id)
    if not eligible:
        raise HTTPException(
            status_code=400,
            detail=reason or "ยังไม่ครบเงื่อนไขในการให้คะแนน — ต้องเรียนจบหลักสูตรก่อน",
        )

    comment = (payload.comment or "").strip() or None

    existing = (
        db.query(CourseFeedback)
        .filter(
            CourseFeedback.user_id == current_user.id,
            CourseFeedback.course_id == course_id,
        )
        .first()
    )
    if existing:
        existing.rating = payload.rating
        existing.comment = comment
        db.commit()
        db.refresh(existing)
        row = existing
    else:
        row = CourseFeedback(
            user_id=current_user.id,
            course_id=course_id,
            rating=payload.rating,
            comment=comment,
        )
        db.add(row)
        db.commit()
        db.refresh(row)

    return {
        "id": row.id,
        "rating": row.rating,
        "comment": row.comment,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


@router.get("/{course_id}/feedback/me")
def my_feedback(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return my feedback if I've submitted one; null fields otherwise.

    Also returns `can_submit` so the client can choose whether to show the
    form before bothering the user with the completion-gate error.
    """
    row = (
        db.query(CourseFeedback)
        .filter(
            CourseFeedback.user_id == current_user.id,
            CourseFeedback.course_id == course_id,
        )
        .first()
    )
    eligible, _score, reason = course_completion(db, current_user.id, course_id)
    return {
        "has_feedback": row is not None,
        "rating": row.rating if row else None,
        "comment": row.comment if row else None,
        "updated_at": (
            row.updated_at.isoformat() if row and row.updated_at else None
        ),
        "can_submit": eligible,
        "blocked_reason": None if eligible else reason,
    }


@router.get("/{course_id}/feedback/summary")
def feedback_summary(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Public aggregate — anyone who can see the course can see this.

    Distribution is a list of 5 ints: stars 1, 2, 3, 4, 5 (in that order).
    """
    course = get_or_404(db, Course, course_id, "ไม่พบหลักสูตร")
    if current_user.role.value in ("learner", "manager") and not course.is_published:
        raise HTTPException(status_code=404, detail="ไม่พบหลักสูตร")

    rows = (
        db.query(CourseFeedback.rating, func.count(CourseFeedback.id))
        .filter(CourseFeedback.course_id == course_id)
        .group_by(CourseFeedback.rating)
        .all()
    )
    distribution = [0, 0, 0, 0, 0]
    total = 0
    weighted = 0
    for rating, n in rows:
        idx = max(1, min(5, int(rating))) - 1
        distribution[idx] = int(n)
        total += int(n)
        weighted += int(rating) * int(n)
    average = round(weighted / total, 2) if total > 0 else None
    return {
        "count": total,
        "average": average,
        "distribution": distribution,
    }


@router.get("/{course_id}/feedback")
def list_feedback(
    course_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Full feedback list with author info — admin/instructor only."""
    if current_user.role.value not in ("admin", "instructor"):
        raise HTTPException(status_code=403, detail="ไม่มีสิทธิ์เข้าถึง")
    course = get_or_404(db, Course, course_id, "ไม่พบหลักสูตร")

    rows = (
        db.query(CourseFeedback, User)
        .join(User, User.id == CourseFeedback.user_id)
        .filter(CourseFeedback.course_id == course_id)
        .order_by(CourseFeedback.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return [
        {
            "id": f.id,
            "rating": f.rating,
            "comment": f.comment,
            "created_at": f.created_at.isoformat() if f.created_at else None,
            "updated_at": f.updated_at.isoformat() if f.updated_at else None,
            "user": {
                "id": u.id,
                "full_name": u.full_name,
                "department": u.department,
                "role": u.role.value if u.role else None,
            },
        }
        for f, u in rows
    ]
