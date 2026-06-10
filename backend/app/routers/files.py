"""Auth-protected static file serving.

These routes replace the previous public StaticFiles mounts at /videos, /pdfs, /images.
Browsers cannot attach the Authorization header to <video>/<iframe>/<img> requests, so
we accept the JWT either via the Authorization header OR a ?t= query param. See
`require_media_token` in app.dependencies.
"""
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse, Response
from starlette.responses import StreamingResponse
from app.config import settings
from app.dependencies import require_media_token
from app.models.user import User


router = APIRouter(tags=["Files"])

VIDEO_DIR = Path(settings.VIDEO_DIR)
PDF_DIR = Path(settings.PDF_DIR)
IMAGE_DIR = Path(settings.IMAGE_DIR)


def _safe_resolve(base: Path, name: str) -> Path:
    """Resolve `name` inside `base`. Reject any traversal attempts."""
    candidate = (base / name).resolve()
    if base.resolve() not in candidate.parents and candidate != base.resolve():
        raise HTTPException(status_code=404, detail="ไม่พบไฟล์")
    if not candidate.exists() or not candidate.is_file():
        raise HTTPException(status_code=404, detail="ไม่พบไฟล์")
    return candidate


@router.get("/videos/{filename}")
def serve_video(filename: str, _user: User = Depends(require_media_token)):
    path = _safe_resolve(VIDEO_DIR, filename)
    return FileResponse(path)


@router.get("/pdfs/{filename}")
def serve_pdf(filename: str, _user: User = Depends(require_media_token)):
    path = _safe_resolve(PDF_DIR, filename)
    return FileResponse(path, media_type="application/pdf")


@router.get("/images/{filename}")
def serve_image(filename: str, _user: User = Depends(require_media_token)):
    path = _safe_resolve(IMAGE_DIR, filename)
    return FileResponse(path)
