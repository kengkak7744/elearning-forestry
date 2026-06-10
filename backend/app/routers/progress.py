from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.helpers import require_enrollment
from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.progress import LessonProgress
from app.models.lesson import Lesson
from app.models.course import Module
from app.schemas.progress import ProgressUpdate
from app.services.progress import upsert_lesson_progress

router = APIRouter()


@router.post("/")
def update_progress(
    payload: ProgressUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    lesson_id = payload.lesson_id
    current_position = payload.current_position
    is_completed = payload.is_completed
    content_type = payload.content_type or "video"

    # Validate lesson exists and find which course it belongs to
    lesson_row = (
        db.query(Lesson, Module.course_id)
        .join(Module, Module.id == Lesson.module_id)
        .filter(Lesson.id == lesson_id)
        .first()
    )
    if not lesson_row:
        raise HTTPException(status_code=404, detail="ไม่พบบทเรียน")
    lesson, course_id = lesson_row

    # Require enrollment (admin/instructor exempt — they may preview content)
    if current_user.role.value not in ("admin", "instructor"):
        require_enrollment(db, current_user.id, course_id, "ต้องลงทะเบียนหลักสูตรก่อน")

    progress = upsert_lesson_progress(
        db,
        current_user,
        lesson_id,
        current_position=current_position,
        is_completed=is_completed,
        content_type=content_type,
    )

    # Return normalized shape for frontend
    return {
        "id": progress.id,
        "user_id": progress.user_id,
        "lesson_id": progress.lesson_id,
        "current_position": progress.position_seconds,
        "is_completed": progress.completed,
        "last_accessed_at": progress.last_accessed_at,
    }


@router.get("/course/{course_id}")
def get_course_progress(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.models.course import Module

    progress = db.query(LessonProgress).join(Lesson).join(Module).filter(
        LessonProgress.user_id == current_user.id,
        Module.course_id == course_id,
    ).all()

    return [
        {
            "id": p.id,
            "user_id": p.user_id,
            "lesson_id": p.lesson_id,
            "current_position": p.position_seconds,
            "is_completed": p.completed,
            "last_accessed_at": p.last_accessed_at,
        }
        for p in progress
    ]