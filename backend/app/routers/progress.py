from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.progress import LessonProgress
from app.models.lesson import Lesson
from sqlalchemy import select

router = APIRouter()


@router.post("/")
def update_progress(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    lesson_id = payload.get("lesson_id")
    current_position = payload.get("current_position", 0)
    is_completed = payload.get("is_completed", False)
    content_type = payload.get("content_type", "video")  # optional hint

    lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="ไม่พบบทเรียน")

    progress = db.query(LessonProgress).filter(
        LessonProgress.user_id == current_user.id,
        LessonProgress.lesson_id == lesson_id,
    ).first()

    now = datetime.now(timezone.utc)

    if progress:
        # Update correct field based on content type
        if content_type == "pdf":
            progress.current_page = current_position
        else:
            progress.position_seconds = current_position

        if is_completed and not progress.completed:
            progress.completed = True
            progress.completed_at = now

        progress.last_accessed_at = now
    else:
        progress = LessonProgress(
            user_id=current_user.id,
            lesson_id=lesson_id,
            position_seconds=current_position if content_type != "pdf" else 0,
            current_page=current_position if content_type == "pdf" else 1,
            completed=is_completed,
            completed_at=now if is_completed else None,
            last_accessed_at=now,
        )
        db.add(progress)

    db.commit()
    db.refresh(progress)

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