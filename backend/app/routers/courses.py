from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import Optional
from app.database import get_db
from app.models.course import Course, CourseCategory
from app.models.user import User
from app.schemas.course import (
    CourseCreate, CourseUpdate, CourseResponse, CourseListItem
)
from app.dependencies import get_current_user, require_instructor_or_admin


router = APIRouter(prefix="/api/courses", tags=["Courses"])


@router.get("", response_model=list[CourseListItem])
def list_courses(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    category: Optional[CourseCategory] = None,
    is_mandatory: Optional[bool] = None,
    search: Optional[str] = Query(None, description="ค้นหาจากชื่อหลักสูตร"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    รายการหลักสูตรทั้งหมด
    - learner เห็นเฉพาะที่ published แล้ว
    - instructor/admin เห็นทั้งหมด (รวม draft)
    """
    query = db.query(Course)
    
    # กรองตาม role
    if current_user.role.value in ("learner", "manager"):
        query = query.filter(Course.is_published == True)
    
    # Filters
    if category:
        query = query.filter(Course.category == category)
    
    if is_mandatory is not None:
        query = query.filter(Course.is_mandatory == is_mandatory)
    
    if search:
        query = query.filter(Course.title.ilike(f"%{search}%"))
    
    return query.order_by(Course.created_at.desc()).offset(skip).limit(limit).all()


@router.get("/{course_id}", response_model=CourseResponse)
def get_course(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """รายละเอียดหลักสูตร"""
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="ไม่พบหลักสูตร")
    
    # learner ไม่เห็นหลักสูตรที่ยังไม่ published
    if current_user.role.value in ("learner", "manager") and not course.is_published:
        raise HTTPException(status_code=404, detail="ไม่พบหลักสูตร")
    
    return course


@router.post("", response_model=CourseResponse, status_code=status.HTTP_201_CREATED)
def create_course(
    course_data: CourseCreate,
    db: Session = Depends(get_db),
    _user: User = Depends(require_instructor_or_admin)
):
    """สร้างหลักสูตรใหม่ (instructor/admin only)"""
    new_course = Course(**course_data.model_dump())
    db.add(new_course)
    db.commit()
    db.refresh(new_course)
    return new_course


@router.put("/{course_id}", response_model=CourseResponse)
def update_course(
    course_id: int,
    course_data: CourseUpdate,
    db: Session = Depends(get_db),
    _user: User = Depends(require_instructor_or_admin)
):
    """แก้ไขหลักสูตร"""
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="ไม่พบหลักสูตร")
    
    update_data = course_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(course, field, value)
    
    db.commit()
    db.refresh(course)
    return course


@router.delete("/{course_id}", status_code=status.HTTP_200_OK)
def delete_course(
    course_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(require_instructor_or_admin)
):
    """ลบหลักสูตร"""
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="ไม่พบหลักสูตร")
    
    db.delete(course)
    db.commit()
    
    return {"message": f"ลบหลักสูตร '{course.title}' เรียบร้อย"}