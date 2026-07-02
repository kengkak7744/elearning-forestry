from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.course import Course, CourseCategory
from app.models.user import User
from app.schemas.course import CategoryCreate, CategoryResponse
from app.core.helpers import get_or_404
from app.dependencies import get_current_user, require_instructor_or_admin
from app.services.audit import log_action


router = APIRouter(prefix="/api/categories", tags=["Categories"])


@router.get("", response_model=list[CategoryResponse])
def list_categories(
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """All categories with usage counts. Every role needs this — learners for
    catalog filter labels, instructors/admins for the course form + manage UI."""
    counts = dict(
        db.query(Course.category, func.count(Course.id))
        .group_by(Course.category)
        .all()
    )
    categories = db.query(CourseCategory).order_by(CourseCategory.id).all()
    for c in categories:
        c.course_count = counts.get(c.value, 0)
    return categories


@router.post("", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
def create_category(
    data: CategoryCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_instructor_or_admin),
):
    label = data.label.strip()
    if not label:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="กรุณาระบุชื่อหมวดหมู่")

    duplicate = db.query(CourseCategory).filter(
        (CourseCategory.value == label) | (CourseCategory.label == label)
    ).first()
    if duplicate:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="มีหมวดหมู่นี้อยู่แล้ว")

    category = CourseCategory(value=label, label=label)
    db.add(category)
    db.flush()
    log_action(
        db, user, "category.create",
        target_type="category", target_id=category.id, target_label=label,
        summary=f"เพิ่มหมวดหมู่ {label}",
        request=request,
    )
    db.commit()
    db.refresh(category)
    category.course_count = 0
    return category


@router.delete("/{category_id}", status_code=status.HTTP_200_OK)
def delete_category(
    category_id: int,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_instructor_or_admin),
):
    category = get_or_404(db, CourseCategory, category_id, "ไม่พบหมวดหมู่")

    in_use = db.query(func.count(Course.id)).filter(Course.category == category.value).scalar()
    if in_use:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"ลบไม่ได้ — มีหลักสูตรใช้หมวดหมู่นี้อยู่ {in_use} หลักสูตร",
        )

    label = category.label
    log_action(
        db, user, "category.delete",
        target_type="category", target_id=category.id, target_label=label,
        summary=f"ลบหมวดหมู่ {label}",
        request=request,
    )
    db.delete(category)
    db.commit()
    return {"message": f"ลบหมวดหมู่ '{label}' เรียบร้อย"}
