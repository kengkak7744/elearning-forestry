"""Lesson-progress persistence shared by the progress router and tests."""
import math
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.lesson import ContentType, Lesson
from app.models.progress import LessonProgress
from app.models.user import User


FIRST_UPDATE_MAX_SECONDS = 10
CLOCK_GRACE_AFTER_SECONDS = 5
CLOCK_GRACE_SECONDS = 2
PDF_DEFAULT_MIN_SECONDS = 5
VIDEO_DEFAULT_MIN_SECONDS = 10
VIDEO_COMPLETION_RATIO = 0.9


def _as_aware_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _elapsed_seconds_since(value: datetime | None, now: datetime) -> int:
    previous = _as_aware_utc(value)
    if previous is None:
        return 0
    return max(0, int((now - previous).total_seconds()))


def _positive_int(value: int | None) -> int | None:
    if value is None or value <= 0:
        return None
    return int(value)


def required_seconds_for_completion(lesson: Lesson) -> int:
    """Return the server-side watch/read threshold for completing a lesson."""
    min_view = _positive_int(lesson.min_view_seconds)
    if lesson.content_type == ContentType.PDF:
        return min_view or PDF_DEFAULT_MIN_SECONDS

    duration = _positive_int(lesson.duration_seconds)
    duration_threshold = (
        math.ceil(duration * VIDEO_COMPLETION_RATIO) if duration is not None else None
    )
    thresholds = [v for v in (duration_threshold, min_view) if v is not None]
    if thresholds:
        return max(thresholds)
    return VIDEO_DEFAULT_MIN_SECONDS


def _progress_metric(progress: LessonProgress, lesson: Lesson) -> int:
    if lesson.content_type == ContentType.PDF:
        return progress.current_page or 0
    return progress.position_seconds or 0


def current_position_for_lesson(progress: LessonProgress, lesson: Lesson) -> int:
    """Expose the stored metric using the API's legacy current_position field."""
    return _progress_metric(progress, lesson)


def _bounded_metric(
    *,
    claimed_metric: int,
    previous_metric: int,
    elapsed_seconds: int,
    is_new: bool,
) -> int:
    claimed_metric = max(0, int(claimed_metric or 0))
    if is_new:
        allowed_metric = FIRST_UPDATE_MAX_SECONDS
    else:
        grace = CLOCK_GRACE_SECONDS if elapsed_seconds >= CLOCK_GRACE_AFTER_SECONDS else 0
        allowed_metric = previous_metric + elapsed_seconds + grace
    return max(previous_metric, min(claimed_metric, allowed_metric))


def upsert_lesson_progress(
    db: Session,
    user: User,
    lesson: Lesson,
    *,
    current_position: int,
) -> LessonProgress:
    """Create or update the (user, lesson) progress row.

    Videos track position_seconds; PDFs reuse current_page as the elapsed
    reading metric expected by the current frontend. Completion is server
    derived and sticky; client-sent completion flags are intentionally ignored.
    """
    progress = db.query(LessonProgress).filter(
        LessonProgress.user_id == user.id,
        LessonProgress.lesson_id == lesson.id,
    ).first()

    now = datetime.now(timezone.utc)
    threshold = required_seconds_for_completion(lesson)

    if progress:
        previous_metric = _progress_metric(progress, lesson)
        elapsed = _elapsed_seconds_since(progress.last_accessed_at, now)
        bounded_metric = _bounded_metric(
            claimed_metric=current_position,
            previous_metric=previous_metric,
            elapsed_seconds=elapsed,
            is_new=False,
        )
        if lesson.content_type == ContentType.PDF:
            progress.current_page = bounded_metric
        else:
            progress.position_seconds = bounded_metric

        if not progress.completed and bounded_metric >= threshold:
            progress.completed = True
            progress.completed_at = now

        progress.last_accessed_at = now
    else:
        bounded_metric = _bounded_metric(
            claimed_metric=current_position,
            previous_metric=0,
            elapsed_seconds=0,
            is_new=True,
        )
        progress = LessonProgress(
            user_id=user.id,
            lesson_id=lesson.id,
            position_seconds=bounded_metric if lesson.content_type != ContentType.PDF else 0,
            current_page=bounded_metric if lesson.content_type == ContentType.PDF else 1,
            completed=False,
            completed_at=None,
            last_accessed_at=now,
        )
        db.add(progress)

    db.commit()
    db.refresh(progress)
    return progress
