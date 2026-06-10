"""Lesson-progress persistence — the upsert logic shared by the progress
router (and unit-testable without HTTP)."""
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.progress import LessonProgress
from app.models.user import User


def upsert_lesson_progress(
    db: Session,
    user: User,
    lesson_id: int,
    *,
    current_position: int,
    is_completed: bool,
    content_type: str,
) -> LessonProgress:
    """Create or update the (user, lesson) progress row.

    Videos track position_seconds; PDFs track current_page. Completion is
    sticky — a later non-completed update never un-completes a lesson.
    """
    progress = db.query(LessonProgress).filter(
        LessonProgress.user_id == user.id,
        LessonProgress.lesson_id == lesson_id,
    ).first()

    now = datetime.now(timezone.utc)

    if progress:
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
            user_id=user.id,
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
    return progress
