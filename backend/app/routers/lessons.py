import os
import uuid
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.course import Module
from app.models.lesson import Lesson, ContentType
from app.models.user import User
from app.schemas.lesson import LessonCreate, LessonUpdate, LessonResponse
from app.dependencies import require_instructor_or_admin, get_current_user


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
        except Exception as e:
            print(f"Failed to delete file: {e}")
    
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
    
    # Read and validate size
    content = await file.read()
    if len(content) > MAX_VIDEO_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"ไฟล์ใหญ่เกิน {MAX_VIDEO_SIZE // (1024*1024)} MB"
        )
    
    # Save with unique name
    unique_name = f"{uuid.uuid4().hex}{ext}"
    file_path = VIDEO_DIR / unique_name
    file_path.write_bytes(content)
    
    # Update lesson
    # Delete old file if exists
    if lesson.content_url and lesson.content_type == ContentType.VIDEO_FILE:
        old_path = VIDEO_DIR / Path(lesson.content_url).name
        if old_path.exists():
            old_path.unlink()
    
    lesson.content_type = ContentType.VIDEO_FILE
    lesson.content_url = f"/elearning/videos/{unique_name}"
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
    
    content = await file.read()
    if len(content) > MAX_PDF_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"ไฟล์ใหญ่เกิน {MAX_PDF_SIZE // (1024*1024)} MB"
        )
    
    unique_name = f"{uuid.uuid4().hex}{ext}"
    file_path = PDF_DIR / unique_name
    file_path.write_bytes(content)
    
    if lesson.content_url and lesson.content_type == ContentType.PDF:
        old_path = PDF_DIR / Path(lesson.content_url).name
        if old_path.exists():
            old_path.unlink()
    
    lesson.content_type = ContentType.PDF
    lesson.content_url = f"/elearning/pdfs/{unique_name}"
    db.commit()
    db.refresh(lesson)
    return lesson


# Serve uploaded files (private — requires auth)
@router.get("/files/video/{filename}")
def serve_video(
    filename: str,
    _user: User = Depends(get_current_user)
):
    file_path = VIDEO_DIR / filename
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="ไม่พบไฟล์")
    return FileResponse(file_path)


@router.get("/files/pdf/{filename}")
def serve_pdf(
    filename: str,
    _user: User = Depends(get_current_user)
):
    file_path = PDF_DIR / filename
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="ไม่พบไฟล์")
    return FileResponse(file_path, media_type="application/pdf")