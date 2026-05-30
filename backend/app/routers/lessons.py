import logging
import uuid
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.course import Module
from app.models.lesson import Lesson, LessonResource, ContentType
from app.models.user import User
from app.schemas.lesson import (
    LessonCreate,
    LessonResourceCreate,
    LessonResourceResponse,
    LessonUpdate,
    LessonResponse,
)
from app.dependencies import get_current_user, require_instructor_or_admin


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/lessons", tags=["Lessons"])

# Storage paths
VIDEO_DIR = Path("/app/videos")
PDF_DIR = Path("/app/pdf_documents")

VIDEO_DIR.mkdir(parents=True, exist_ok=True)
PDF_DIR.mkdir(parents=True, exist_ok=True)

# Max file sizes (bytes)
MAX_VIDEO_SIZE = 2000 * 1024 * 1024  # 2 GB
MAX_PDF_SIZE = 500 * 1024 * 1024     # 500 MB

ALLOWED_VIDEO_EXTENSIONS = {".mp4", ".webm", ".mov", ".avi", ".mkv"}
ALLOWED_PDF_EXTENSIONS = {".pdf"}

CHUNK_SIZE = 1024 * 1024  # 1 MB


async def _stream_upload_to_disk(file: UploadFile, dest: Path, max_size: int) -> None:
    """Stream UploadFile chunks to disk; raise 400 if max_size exceeded. Deletes partial file on failure."""
    total = 0
    try:
        with dest.open("wb") as out:
            while True:
                chunk = await file.read(CHUNK_SIZE)
                if not chunk:
                    break
                total += len(chunk)
                if total > max_size:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"ไฟล์ใหญ่เกิน {max_size // (1024*1024)} MB"
                    )
                out.write(chunk)
    except HTTPException:
        if dest.exists():
            try: dest.unlink()
            except Exception: pass
        raise
    except Exception:
        if dest.exists():
            try: dest.unlink()
            except Exception: pass
        raise


@router.post("", response_model=LessonResponse, status_code=status.HTTP_201_CREATED)
def create_lesson(
    data: LessonCreate,
    db: Session = Depends(get_db),
    _user: User = Depends(require_instructor_or_admin)
):
    """สร้างบทเรียนใหม่ (สำหรับ YouTube link หรือ lesson ที่จะ upload file ทีหลัง)"""
    module = db.query(Module).filter(Module.id == data.module_id).first()
    if not module:
        raise HTTPException(status_code=404, detail="ไม่พบโมดูล")
    
    new_lesson = Lesson(**data.model_dump())
    db.add(new_lesson)
    db.commit()
    db.refresh(new_lesson)
    return new_lesson


@router.put("/{lesson_id}", response_model=LessonResponse)
def update_lesson(
    lesson_id: int,
    data: LessonUpdate,
    db: Session = Depends(get_db),
    _user: User = Depends(require_instructor_or_admin)
):
    lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="ไม่พบบทเรียน")
    
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(lesson, field, value)
    
    db.commit()
    db.refresh(lesson)
    return lesson


@router.delete("/{lesson_id}", status_code=status.HTTP_200_OK)
def delete_lesson(
    lesson_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(require_instructor_or_admin)
):
    lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="ไม่พบบทเรียน")
    
    # Delete associated file
    if lesson.content_url and lesson.content_type != ContentType.VIDEO_YOUTUBE:
        try:
            file_path = Path(lesson.content_url.lstrip("/"))
            if lesson.content_type == ContentType.VIDEO_FILE:
                file_path = VIDEO_DIR / Path(lesson.content_url).name
            elif lesson.content_type == ContentType.PDF:
                file_path = PDF_DIR / Path(lesson.content_url).name
            
            if file_path.exists():
                file_path.unlink()
        except Exception:
            logger.exception("Failed to delete lesson file for lesson_id=%s", lesson_id)
    
    db.delete(lesson)
    db.commit()
    return {"message": "ลบบทเรียนเรียบร้อย"}


@router.post("/{lesson_id}/upload-video", response_model=LessonResponse)
async def upload_video(
    lesson_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _user: User = Depends(require_instructor_or_admin)
):
    """อัปโหลดไฟล์วิดีโอสำหรับบทเรียน"""
    lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="ไม่พบบทเรียน")
    
    # Validate file extension
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_VIDEO_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"รองรับเฉพาะไฟล์ {', '.join(ALLOWED_VIDEO_EXTENSIONS)}"
        )

    # Stream to disk (chunked, with size limit enforced during streaming)
    unique_name = f"{uuid.uuid4().hex}{ext}"
    file_path = VIDEO_DIR / unique_name
    await _stream_upload_to_disk(file, file_path, MAX_VIDEO_SIZE)

    # Delete old file if exists
    if lesson.content_url and lesson.content_type == ContentType.VIDEO_FILE:
        old_path = VIDEO_DIR / Path(lesson.content_url).name
        if old_path.exists():
            old_path.unlink()

    lesson.content_type = ContentType.VIDEO_FILE
    lesson.content_url = f"/videos/{unique_name}"
    db.commit()
    db.refresh(lesson)
    return lesson


@router.post("/{lesson_id}/upload-pdf", response_model=LessonResponse)
async def upload_pdf(
    lesson_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _user: User = Depends(require_instructor_or_admin)
):
    """อัปโหลดไฟล์ PDF สำหรับบทเรียน"""
    lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="ไม่พบบทเรียน")
    
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_PDF_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="รองรับเฉพาะไฟล์ PDF"
        )

    unique_name = f"{uuid.uuid4().hex}{ext}"
    file_path = PDF_DIR / unique_name
    await _stream_upload_to_disk(file, file_path, MAX_PDF_SIZE)

    if lesson.content_url and lesson.content_type == ContentType.PDF:
        old_path = PDF_DIR / Path(lesson.content_url).name
        if old_path.exists():
            old_path.unlink()

    lesson.content_type = ContentType.PDF
    lesson.content_url = f"/pdfs/{unique_name}"
    db.commit()
    db.refresh(lesson)
    return lesson


# =====================================================================
# Lesson resources (supplementary downloads / external links)
# =====================================================================

@router.get("/{lesson_id}/resources", response_model=list[LessonResourceResponse])
def list_lesson_resources(
    lesson_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """List supplementary materials for a lesson — visible to any logged-in learner."""
    lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="ไม่พบบทเรียน")
    return (
        db.query(LessonResource)
        .filter(LessonResource.lesson_id == lesson_id)
        .order_by(LessonResource.id)
        .all()
    )


@router.post(
    "/{lesson_id}/resources",
    response_model=LessonResourceResponse,
    status_code=status.HTTP_201_CREATED,
)
def add_lesson_resource(
    lesson_id: int,
    data: LessonResourceCreate,
    db: Session = Depends(get_db),
    _user: User = Depends(require_instructor_or_admin),
):
    lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="ไม่พบบทเรียน")
    resource = LessonResource(lesson_id=lesson_id, **data.model_dump())
    db.add(resource)
    db.commit()
    db.refresh(resource)
    return resource


@router.delete("/resources/{resource_id}", status_code=status.HTTP_200_OK)
def delete_lesson_resource(
    resource_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(require_instructor_or_admin),
):
    resource = db.query(LessonResource).filter(LessonResource.id == resource_id).first()
    if not resource:
        raise HTTPException(status_code=404, detail="ไม่พบเอกสาร")
    db.delete(resource)
    db.commit()
    return {"message": "ลบเอกสารเรียบร้อย"}


# File serving moved to app.routers.files (with auth and path-traversal hardening).


# === Lesson resources (supplementary materials/links) ===
# Learners read their own enrolled lessons' resources via the embedded list in
# LessonResponse / course responses. The endpoints below are for admin CRUD.

@router.get("/{lesson_id}/resources", response_model=list[LessonResourceResponse])
def list_lesson_resources(
    lesson_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Any logged-in user can read a lesson's resource list."""
    lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="ไม่พบบทเรียน")
    return lesson.resources


@router.post(
    "/{lesson_id}/resources",
    response_model=LessonResourceResponse,
    status_code=status.HTTP_201_CREATED,
)
def add_lesson_resource(
    lesson_id: int,
    data: LessonResourceCreate,
    db: Session = Depends(get_db),
    _user: User = Depends(require_instructor_or_admin),
):
    lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="ไม่พบบทเรียน")
    resource = LessonResource(lesson_id=lesson_id, **data.model_dump())
    db.add(resource)
    db.commit()
    db.refresh(resource)
    return resource


@router.delete("/resources/{resource_id}", status_code=status.HTTP_200_OK)
def delete_lesson_resource(
    resource_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(require_instructor_or_admin),
):
    resource = db.query(LessonResource).filter(LessonResource.id == resource_id).first()
    if not resource:
        raise HTTPException(status_code=404, detail="ไม่พบเอกสารประกอบ")
    db.delete(resource)
    db.commit()
    return {"message": "ลบเอกสารประกอบเรียบร้อย"}