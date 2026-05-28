"""Aggregate statistics for the admin dashboard."""
from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import func, desc
from sqlalchemy.orm import Session
from app.database import get_db
from app.dependencies import require_admin
from app.models.user import User, UserRole
from app.models.course import Course, Module
from app.models.lesson import Lesson
from app.models.enrollment import Enrollment
from app.models.progress import LessonProgress


router = APIRouter(prefix="/api/admin/stats", tags=["Admin Stats"])

# Admin stats are aggregate queries — browser cache for 60s eliminates duplicate hits
# from the dashboard's parallel Promise.all and from quick back-navigation.
_STATS_CACHE = "private, max-age=60"


@router.get("/overview")
def overview(
    response: Response,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """High-level numbers for the dashboard cards."""
    response.headers["Cache-Control"] = _STATS_CACHE
    total_users = db.query(func.count(User.id)).scalar() or 0
    total_active_users = db.query(func.count(User.id)).filter(User.is_active == True).scalar() or 0
    total_courses = db.query(func.count(Course.id)).scalar() or 0
    published_courses = db.query(func.count(Course.id)).filter(Course.is_published == True).scalar() or 0
    total_enrollments = db.query(func.count(Enrollment.id)).scalar() or 0

    # Completion rate: % of enrollments where the user has finished all lessons of that course
    lesson_count_per_course = (
        db.query(Module.course_id, func.count(Lesson.id).label("total"))
        .join(Lesson, Lesson.module_id == Module.id)
        .group_by(Module.course_id)
        .subquery()
    )
    completed_count_per_user_course = (
        db.query(
            LessonProgress.user_id,
            Module.course_id,
            func.count(LessonProgress.id).label("completed"),
        )
        .join(Lesson, Lesson.id == LessonProgress.lesson_id)
        .join(Module, Module.id == Lesson.module_id)
        .filter(LessonProgress.completed == True)
        .group_by(LessonProgress.user_id, Module.course_id)
        .subquery()
    )
    completed_enrollments = (
        db.query(func.count(Enrollment.id))
        .join(
            lesson_count_per_course,
            lesson_count_per_course.c.course_id == Enrollment.course_id,
        )
        .join(
            completed_count_per_user_course,
            (completed_count_per_user_course.c.user_id == Enrollment.user_id)
            & (completed_count_per_user_course.c.course_id == Enrollment.course_id),
        )
        .filter(completed_count_per_user_course.c.completed >= lesson_count_per_course.c.total)
        .scalar()
        or 0
    )
    completion_rate = int((completed_enrollments / total_enrollments) * 100) if total_enrollments else 0

    return {
        "total_users": total_users,
        "active_users": total_active_users,
        "total_courses": total_courses,
        "published_courses": published_courses,
        "total_enrollments": total_enrollments,
        "completed_enrollments": completed_enrollments,
        "completion_rate": completion_rate,
    }


@router.get("/top-courses")
def top_courses(
    response: Response,
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Courses ranked by enrollment count."""
    response.headers["Cache-Control"] = _STATS_CACHE
    rows = (
        db.query(
            Course.id,
            Course.title,
            Course.category,
            Course.cover_image,
            func.count(Enrollment.id).label("enrolled_count"),
        )
        .outerjoin(Enrollment, Enrollment.course_id == Course.id)
        .group_by(Course.id, Course.title, Course.category, Course.cover_image)
        .order_by(desc("enrolled_count"))
        .limit(limit)
        .all()
    )
    return [
        {
            "id": r.id,
            "title": r.title,
            "category": r.category.value if r.category else None,
            "cover_image": r.cover_image,
            "enrolled_count": int(r.enrolled_count or 0),
        }
        for r in rows
    ]


@router.get("/top-departments")
def top_departments(
    response: Response,
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Departments ranked by total enrollments (one user, many enrollments → all count)."""
    response.headers["Cache-Control"] = _STATS_CACHE
    rows = (
        db.query(
            User.department,
            func.count(Enrollment.id).label("enrolled_count"),
            func.count(func.distinct(Enrollment.user_id)).label("user_count"),
        )
        .join(Enrollment, Enrollment.user_id == User.id)
        .group_by(User.department)
        .order_by(desc("enrolled_count"))
        .limit(limit)
        .all()
    )
    return [
        {
            "department": r.department or "(ไม่ระบุ)",
            "enrolled_count": int(r.enrolled_count or 0),
            "user_count": int(r.user_count or 0),
        }
        for r in rows
    ]


@router.get("/recent-enrollments")
def recent_enrollments(
    response: Response,
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Latest enrollments — who enrolled in what, and when."""
    response.headers["Cache-Control"] = _STATS_CACHE
    rows = (
        db.query(Enrollment, User, Course)
        .join(User, User.id == Enrollment.user_id)
        .join(Course, Course.id == Enrollment.course_id)
        .order_by(desc(Enrollment.enrolled_at))
        .limit(limit)
        .all()
    )
    return [
        {
            "id": e.id,
            "enrolled_at": e.enrolled_at.isoformat() if e.enrolled_at else None,
            "user": {
                "id": u.id,
                "full_name": u.full_name,
                "department": u.department,
                "role": u.role.value if u.role else None,
            },
            "course": {
                "id": c.id,
                "title": c.title,
                "category": c.category.value if c.category else None,
            },
        }
        for e, u, c in rows
    ]
