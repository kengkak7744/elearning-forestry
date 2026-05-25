import os
import uuid
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import Optional
from app.database import get_db
from app.models.course import Course, Module, CourseCategory
from app.models.lesson import Lesson
from app.models.enrollment import Enrollment
from app.models.user import User
from app.schemas.course import (
    CourseCreate, CourseUpdate, CourseResponse, CourseListItem
)
from app.dependencies import get_current_user, require_instructor_or_admin


router = APIRouter(prefix="/api/courses", tags=["Courses"])

IMAGE_DIR = Path("/app/images")
IMAGE_DIR.mkdir(parents=True, exist_ok=True)
MAX_IMAGE_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}


@router.get("", response_model=list[CourseListItem])
def list_courses(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    category: Optional[CourseCategory] = None,
    is_mandatory: Optional[bool] = None,
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Course)
    
    if current_user.role.value in ("learner", "manager"):
        query = query.filter(Course.is_published == True)
    
    if category:
        query = query.filter(Course.category == category)
    
    if is_mandatory is not None:
        query = query.filter(Course.is_mandatory == is_mandatory)
    
    if search:
        query = query.filter(Course.title.ilike(f"%{search}%"))
    
    return query.order_by(Course.created_at.desc()).offset(skip).limit(limit).all()


@router.get("/{course_id}")
def get_course(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    course = db.query(Course).options(
        joinedload(Course.modules).joinedload(Module.lessons)
    ).filter(Course.id == course_id).first()
    
    if not course:
        raise HTTPException(status_code=404, detail="ไม่พบหลักสูตร")
    
    if current_user.role.value in ("learner", "manager") and not course.is_published:
        raise HTTPException(status_code=404, detail="ไม่พบหลักสูตร")
    
    total_modules = len(course.modules)
    total_lessons = sum(len(m.lessons) for m in course.modules)
    enrolled_count = db.query(func.count(Enrollment.id)).filter(Enrollment.course_id == course_id).scalar()
    
    is_enrolled = db.query(Enrollment).filter(
        Enrollment.user_id == current_user.id,
        Enrollment.course_id == course_id
    ).first() is not None
    
    modules_data = []
    for module in sorted(course.modules, key=lambda m: m.order_index):
        lessons_data = []
        for lesson in sorted(module.lessons, key=lambda l: l.order_index):
            lessons_data.append({
                "id": lesson.id,
                "module_id": lesson.module_id,
                "title": lesson.title,
                "description": lesson.description,
                "content_type": lesson.content_type.value if lesson.content_type else None,
                "content_url": lesson.content_url,
                "duration_seconds": lesson.duration_seconds,
                "total_pages": lesson.total_pages,
                "notes_content": lesson.notes_content,
                "order_index": lesson.order_index,
            })
        modules_data.append({
            "id": module.id,
            "course_id": module.course_id,
            "title": module.title,
            "description": module.description,
            "order_index": module.order_index,
            "lessons": lessons_data,
        })
    
    return {
        "id": course.id,
        "title": course.title,
        "description": course.description,
        "category": course.category.value if course.category else None,
        "is_mandatory": course.is_mandatory,
        "cover_image": course.cover_image,
        "estimated_hours": course.estimated_hours,
        "instructor_name": course.instructor_name,
        "is_published": course.is_published,
        "created_at": course.created_at.isoformat() if course.created_at else None,
        "updated_at": course.updated_at.isoformat() if course.updated_at else None,
        "total_modules": total_modules,
        "total_lessons": total_lessons,
        "enrolled_count": enrolled_count or 0,
        "is_enrolled": is_enrolled,
        "modules": modules_data,
    }
    return response_data


@router.post("", response_model=CourseResponse, status_code=status.HTTP_201_CREATED)
def create_course(
    course_data: CourseCreate,
    db: Session = Depends(get_db),
    _user: User = Depends(require_instructor_or_admin)
):
    new_course = Course(**course_data.model_dump())
    db.add(new_course)
    db.commit()
    db.refresh(new_course)
    return {
        **new_course.__dict__,
        "total_modules": 0,
        "total_lessons": 0,
        "enrolled_count": 0,
        "is_enrolled": False,
    }


@router.put("/{course_id}", response_model=CourseResponse)
def update_course(
    course_id: int,
    course_data: CourseUpdate,
    db: Session = Depends(get_db),
    _user: User = Depends(require_instructor_or_admin)
):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="ไม่พบหลักสูตร")
    
    update_data = course_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(course, field, value)
    
    db.commit()
    db.refresh(course)
    return get_course(course_id, db, _user)


@router.delete("/{course_id}", status_code=status.HTTP_200_OK)
def delete_course(
    course_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(require_instructor_or_admin)
):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="ไม่พบหลักสูตร")
    
    db.delete(course)
    db.commit()
    
    return {"message": f"ลบหลักสูตร '{course.title}' เรียบร้อย"}


@router.post("/{course_id}/upload-cover")
async def upload_cover_image(
    course_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _user: User = Depends(require_instructor_or_admin)
):
    """อัปโหลดรูปภาพปกหลักสูตร"""
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="ไม่พบหลักสูตร")

    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"รองรับเฉพาะไฟล์ {', '.join(ALLOWED_IMAGE_EXTENSIONS)}"
        )

    content = await file.read()
    if len(content) > MAX_IMAGE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"ไฟล์ใหญ่เกิน {MAX_IMAGE_SIZE // (1024*1024)} MB"
        )

    unique_name = f"{uuid.uuid4().hex}{ext}"
    file_path = IMAGE_DIR / unique_name
    file_path.write_bytes(content)

    if course.cover_image and course.cover_image.startswith("/images/"):
        old_path = IMAGE_DIR / Path(course.cover_image).name
        if old_path.exists():
            old_path.unlink()

    course.cover_image = f"/elearning/images/{unique_name}"
    db.commit()
    db.refresh(course)
    return {"cover_image": course.cover_image}


# Enrollment endpoints

@router.post("/{course_id}/enroll", status_code=status.HTTP_201_CREATED)
def enroll_course(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """ลงทะเบียนเรียนหลักสูตร"""
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="ไม่พบหลักสูตร")
    
    if not course.is_published and current_user.role.value in ("learner", "manager"):
        raise HTTPException(status_code=404, detail="ไม่พบหลักสูตร")
    
    existing = db.query(Enrollment).filter(
        Enrollment.user_id == current_user.id,
        Enrollment.course_id == course_id
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="คุณลงทะเบียนหลักสูตรนี้แล้ว"
        )
    
    enrollment = Enrollment(
        user_id=current_user.id,
        course_id=course_id,
    )
    db.add(enrollment)
    db.commit()
    
    return {
        "message": f"ลงทะเบียนหลักสูตร '{course.title}' สำเร็จ",
        "course_id": course_id,
    }


@router.delete("/{course_id}/enroll", status_code=status.HTTP_200_OK)
def unenroll_course(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """ยกเลิกการลงทะเบียนเรียน"""
    enrollment = db.query(Enrollment).filter(
        Enrollment.user_id == current_user.id,
        Enrollment.course_id == course_id
    ).first()
    
    if not enrollment:
        raise HTTPException(status_code=404, detail="คุณยังไม่ได้ลงทะเบียนหลักสูตรนี้")
    
    db.delete(enrollment)
    db.commit()
    
    return {"message": "ยกเลิกการลงทะเบียนเรียบร้อย"}