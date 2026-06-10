"""Small query helpers shared by the routers.

These replace the get-object-or-404 / enrollment-gate blocks that used to be
copy-pasted across every router. Each call site passes its own Thai detail
string so user-visible messages stay exactly as they were.
"""
from typing import Optional, Type, TypeVar

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.enrollment import Enrollment
from app.models.user import User

T = TypeVar("T")


def get_or_404(db: Session, model: Type[T], obj_id: int, detail: str) -> T:
    """Fetch a row by primary key or raise 404 with the caller's message."""
    obj = db.query(model).filter(model.id == obj_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail=detail)
    return obj


def require_enrollment(db: Session, user_id: int, course_id: int, detail: str) -> Enrollment:
    """Raise 403 with the caller's message unless the user is enrolled."""
    enrollment = (
        db.query(Enrollment)
        .filter(Enrollment.user_id == user_id, Enrollment.course_id == course_id)
        .first()
    )
    if not enrollment:
        raise HTTPException(status_code=403, detail=detail)
    return enrollment


def ensure_unique_user_fields(
    db: Session,
    *,
    username: Optional[str] = None,
    email: Optional[str] = None,
) -> None:
    """Raise 400 when the username or email already exists (registration and
    admin user creation share the same messages)."""
    if username and db.query(User).filter(User.username == username).first():
        raise HTTPException(
            status_code=400,
            detail=f"ชื่อผู้ใช้ '{username}' มีอยู่ในระบบแล้ว",
        )
    if email and db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=400, detail="อีเมลนี้มีอยู่ในระบบแล้ว")
