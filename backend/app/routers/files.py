"""Auth-protected static file serving.

These routes replace the previous public StaticFiles mounts at /videos, /pdfs, /images.
Browsers cannot attach the Authorization header to <video>/<iframe>/<img> requests, so
we accept the JWT either via the Authorization header OR a ?t= query param. See
`require_media_token` in app.dependencies.
"""
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse, Response
from sqlalchemy import or_
from sqlalchemy.orm import Session
from starlette.responses import StreamingResponse
from app.core.helpers import require_enrollment
from app.config import settings
from app.database import get_db
from app.dependencies import require_media_token
from app.models.course import Module
from app.models.lesson import Lesson, LessonResource
from app.models.user import User


router = APIRouter(tags=["Files"])

VIDEO_DIR = Path(settings.VIDEO_DIR)
PDF_DIR = Path(settings.PDF_DIR)
IMAGE_DIR = Path(settings.IMAGE_DIR)
MEDIA_CACHE_CONTROL = "private, max-age=3600, stale-while-revalidate=86400"


def _safe_resolve(base: Path, name: str) -> Path:
    """Resolve `name` inside `base`. Reject any traversal attempts."""
    candidate = (base / name).resolve()
    if base.resolve() not in candidate.parents and candidate != base.resolve():
        raise HTTPException(status_code=404, detail="ไม่พบไฟล์")
    if not candidate.exists() or not candidate.is_file():
        raise HTTPException(status_code=404, detail="ไม่พบไฟล์")
    return candidate


def _media_candidates(prefix: str, filename: str) -> list[str]:
    return [f"/{prefix}/{filename}", f"/elearning/{prefix}/{filename}"]


def _allow_course_media(db: Session, user: User, course_id: int) -> None:
    if user.role.value in ("admin", "instructor"):
        return
    require_enrollment(db, user.id, course_id, "ต้องลงทะเบียนหลักสูตรก่อนเข้าถึงไฟล์")


def _require_media_access(
    db: Session,
    user: User,
    *,
    prefix: str,
    filename: str,
    allow_unlinked: bool = False,
) -> None:
    candidates = _media_candidates(prefix, filename)

    lesson_row = (
        db.query(Module.course_id)
        .join(Lesson, Lesson.module_id == Module.id)
        .filter(or_(Lesson.content_url.in_(candidates), Lesson.caption_url.in_(candidates)))
        .first()
    )
    if lesson_row:
        _allow_course_media(db, user, lesson_row.course_id)
        return

    resource_row = (
        db.query(Module.course_id)
        .join(Lesson, Lesson.module_id == Module.id)
        .join(LessonResource, LessonResource.lesson_id == Lesson.id)
        .filter(LessonResource.url.in_(candidates))
        .first()
    )
    if resource_row:
        _allow_course_media(db, user, resource_row.course_id)
        return

    if allow_unlinked or user.role.value in ("admin", "instructor"):
        return
    raise HTTPException(status_code=403, detail="ไม่มีสิทธิ์เข้าถึงไฟล์นี้")


def _media_response(path: Path, media_type: str | None = None) -> FileResponse:
    response = FileResponse(path, media_type=media_type)
    response.headers.setdefault("Cache-Control", MEDIA_CACHE_CONTROL)
    return response


@router.get("/videos/{filename}")
def serve_video(
    filename: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_media_token),
):
    path = _safe_resolve(VIDEO_DIR, filename)
    _require_media_access(db, user, prefix="videos", filename=filename)
    if path.suffix.lower() == ".vtt":
        return _media_response(path, media_type="text/vtt")
    return _media_response(path)


@router.get("/pdfs/{filename}")
def serve_pdf(
    filename: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_media_token),
):
    path = _safe_resolve(PDF_DIR, filename)
    _require_media_access(db, user, prefix="pdfs", filename=filename)
    return _media_response(path, media_type="application/pdf")


@router.get("/images/{filename}")
def serve_image(
    filename: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_media_token),
):
    path = _safe_resolve(IMAGE_DIR, filename)
    _require_media_access(db, user, prefix="images", filename=filename, allow_unlinked=True)
    return _media_response(path)
