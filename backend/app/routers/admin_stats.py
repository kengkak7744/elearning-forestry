"""Aggregate statistics for the admin dashboard.

Heavy multi-query assembly lives in app/services/stats.py; this router keeps
auth, cache headers, and CSV download responses.
"""
from datetime import datetime

from fastapi import APIRouter, Depends, Query, Response
from fastapi.responses import StreamingResponse
from sqlalchemy import func, desc
from sqlalchemy.orm import Session
from app.core.helpers import get_or_404
from app.database import get_db
from app.dependencies import require_admin
from app.models.user import User
from app.models.course import Course
from app.models.enrollment import Enrollment
from app.models.course_feedback import CourseFeedback
from app.services.stats import (
    build_department_compliance_csv,
    build_department_members_csv,
    department_compliance_data,
    department_course_members_data,
    department_members_rows,
    overview_stats,
)


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
    return overview_stats(db)


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


@router.get("/course-feedback")
def course_feedback_stats(
    response: Response,
    min_count: int = Query(3, ge=1, le=50),
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Per-course feedback aggregate, sorted worst-rating first.

    `min_count` is a noise floor — a course with a single 1-star review isn't
    a meaningful signal, so we only flag underperformance once it has at
    least N ratings. Courses with fewer ratings still appear in the response
    but with `is_underperforming=False`.

    "Underperforming" = average rating < 3.0 AND count >= min_count.
    Threshold of 3.0 because the scale is 1-5 and 3 is the midpoint —
    anything below means a clear majority of dissatisfied responses.
    """
    response.headers["Cache-Control"] = _STATS_CACHE
    rows = (
        db.query(
            Course.id,
            Course.title,
            Course.category,
            Course.is_published,
            func.count(CourseFeedback.id).label("count"),
            func.avg(CourseFeedback.rating).label("avg_rating"),
        )
        .outerjoin(CourseFeedback, CourseFeedback.course_id == Course.id)
        .group_by(Course.id, Course.title, Course.category, Course.is_published)
        .all()
    )
    courses = []
    for r in rows:
        count = int(r.count or 0)
        avg = float(r.avg_rating) if r.avg_rating is not None else None
        courses.append({
            "id": r.id,
            "title": r.title,
            "category": r.category.value if r.category else None,
            "is_published": r.is_published,
            "count": count,
            "average": round(avg, 2) if avg is not None else None,
            "is_underperforming": (avg is not None and avg < 3.0 and count >= min_count),
        })
    # Worst-rating-first ordering for the underperforming card; courses with
    # no ratings sink to the bottom (sentinel 99 for avg=None).
    courses.sort(key=lambda c: (c["average"] if c["average"] is not None else 99, -c["count"]))
    return {
        "min_count_threshold": min_count,
        "courses": courses,
    }


@router.get("/departments")
def departments_overview(
    response: Response,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Every department in the system with aggregate metrics.

    Used by the admin "หน่วยงาน" page as the top-level browsable list.
    Returns one row per distinct `department` value, including a
    role-breakdown count so admins can see at a glance whether a
    department has e.g. instructors but no learners.
    """
    response.headers["Cache-Control"] = _STATS_CACHE
    # Step 1 — base per-dept counts (users + active users).
    base_rows = (
        db.query(
            User.department,
            func.count(User.id).label("user_count"),
            func.count(User.id).filter(User.is_active == True).label("active_count"),
        )
        .filter(User.department.isnot(None), User.department != "")
        .group_by(User.department)
        .all()
    )
    # Step 2 — role breakdown per dept. Single query, then bucketed in Python.
    role_rows = (
        db.query(User.department, User.role, func.count(User.id))
        .filter(User.department.isnot(None), User.department != "")
        .group_by(User.department, User.role)
        .all()
    )
    role_breakdown_by_dept: dict[str, dict[str, int]] = {}
    for dept, role, n in role_rows:
        role_breakdown_by_dept.setdefault(dept, {})[role.value if role else "unknown"] = int(n)

    # Step 3 — enrollment count + certs held, per dept.
    enroll_rows = dict(
        db.query(User.department, func.count(Enrollment.id))
        .join(Enrollment, Enrollment.user_id == User.id)
        .filter(User.department.isnot(None), User.department != "")
        .group_by(User.department)
        .all()
    )
    from app.models.certificate import Certificate
    cert_rows = dict(
        db.query(User.department, func.count(Certificate.id))
        .join(Certificate, Certificate.user_id == User.id)
        .filter(User.department.isnot(None), User.department != "")
        .filter(Certificate.is_revoked == False)
        .group_by(User.department)
        .all()
    )

    out = []
    for dept, user_count, active_count in base_rows:
        out.append({
            "name": dept,
            "user_count": int(user_count or 0),
            "active_count": int(active_count or 0),
            "role_breakdown": role_breakdown_by_dept.get(dept, {}),
            "enrollment_count": int(enroll_rows.get(dept, 0)),
            "cert_count": int(cert_rows.get(dept, 0)),
        })
    out.sort(key=lambda d: (-d["active_count"], d["name"]))
    return out


@router.get("/departments/{department}/members")
def department_members(
    department: str,
    response: Response,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """All members of a department with the organizational metadata
    available in the User model.

    Includes the deliberately-omitted-from-csv fields (responsibility,
    motivation) on the JSON path because they're useful for an admin
    inspecting a single user from the browser, but are too long-form
    for a spreadsheet column.
    """
    response.headers["Cache-Control"] = _STATS_CACHE
    rows = department_members_rows(db, department)
    return [
        {
            "id": u.id,
            "username": u.username,
            "full_name": u.full_name,
            "email": u.email,
            "role": u.role.value if u.role else None,
            "position": u.position,
            "phone": u.phone,
            "responsibility": u.responsibility,
            "motivation": u.motivation,
            "is_active": u.is_active,
            "created_at": u.created_at.isoformat() if u.created_at else None,
            "enrollment_count": int(enroll_n or 0),
            "cert_count": int(cert_n or 0),
        }
        for u, enroll_n, cert_n in rows
    ]


@router.get("/departments/{department}/courses")
def department_course_performance(
    department: str,
    response: Response,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Per-course performance for one department.

    For every published course, count how many members of this department
    enrolled and how many hold a non-revoked certificate. The
    `certification_pct` field is the load-bearing one — sorted ascending
    so courses where the dept is lagging surface at the top of the table.

    Courses with zero enrollments in this department are still returned
    (with certification_pct = 0) when they're mandatory, so admins can see
    "we haven't started this required course at all". Non-mandatory courses
    with zero enrollments are filtered out as noise.
    """
    response.headers["Cache-Control"] = _STATS_CACHE
    from app.models.certificate import Certificate

    # Per-course enrollment count restricted to this department.
    enrolled_rows = dict(
        db.query(Enrollment.course_id, func.count(func.distinct(Enrollment.user_id)))
        .join(User, User.id == Enrollment.user_id)
        .filter(User.department == department)
        .group_by(Enrollment.course_id)
        .all()
    )
    cert_rows = dict(
        db.query(Certificate.course_id, func.count(func.distinct(Certificate.user_id)))
        .join(User, User.id == Certificate.user_id)
        .filter(User.department == department, Certificate.is_revoked == False)
        .group_by(Certificate.course_id)
        .all()
    )
    courses = (
        db.query(Course)
        .filter(Course.is_published == True)
        .all()
    )
    out = []
    for c in courses:
        enrolled_n = int(enrolled_rows.get(c.id, 0))
        cert_n = int(cert_rows.get(c.id, 0))
        if enrolled_n == 0 and not c.is_mandatory:
            continue
        pct = int(round((cert_n / enrolled_n) * 100)) if enrolled_n > 0 else 0
        out.append({
            "id": c.id,
            "title": c.title,
            "category": c.category.value if c.category else None,
            "is_mandatory": c.is_mandatory,
            "enrolled_count": enrolled_n,
            "certified_count": cert_n,
            "certification_pct": pct,
        })
    # Worst-first: low certification first. Within ties, mandatory > optional,
    # and within those, higher enrollment first (more impact).
    out.sort(key=lambda r: (r["certification_pct"], not r["is_mandatory"], -r["enrolled_count"]))
    return out


@router.get("/departments/{department}/courses/{course_id}/members")
def department_course_members(
    department: str,
    course_id: int,
    response: Response,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Department members crossed with one specific course.

    Returns every member of the department + their relationship to the
    course: enrolled or not, progress %, cert status. Admins use this to
    answer "who in my team hasn't started the mandatory fire-safety course
    yet?".

    Members who aren't enrolled in the course are returned with
    `is_enrolled = false` and zeroed counters so the UI can render a
    single "ยังไม่ลงทะเบียน" list without needing a second fetch.
    """
    response.headers["Cache-Control"] = _STATS_CACHE
    course = get_or_404(db, Course, course_id, "ไม่พบหลักสูตร")
    return department_course_members_data(db, department, course)


@router.get("/departments/{department}/members.csv")
def department_members_csv(
    department: str,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """CSV download of a department's members. UTF-8 + BOM so Excel
    opens the Thai headers without garbling, matching the existing
    compliance CSV pattern."""
    rows = department_members_rows(db, department)
    body = build_department_members_csv(rows)
    stamp = datetime.now().strftime("%Y%m%d")
    # Department name may contain spaces / Thai chars; ASCII-fallback the
    # filename because HTTP headers are latin-1 only (Thai chars in the
    # Content-Disposition header used to crash this endpoint with a 500).
    safe_name = "".join(
        c if (c.isascii() and c.isalnum()) else "_" for c in department
    )[:60]
    filename = f"department-{safe_name}-{stamp}.csv"
    return StreamingResponse(
        iter([body]),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-store",
        },
    )


@router.get("/department-compliance")
def department_compliance(
    response: Response,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Per-department completion rate against published mandatory courses.

    "Completed" = the user holds a non-expired certificate for that course.
    (Strict measure — what regulators / HR audit against.)

    Returns a list sorted by completion_rate ascending (worst-compliance
    departments surfaced first) so admins can prioritise nudging.
    """
    response.headers["Cache-Control"] = _STATS_CACHE
    return department_compliance_data(db)


@router.get("/department-compliance.csv")
def department_compliance_csv(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """
    Same data as /department-compliance but as a downloadable CSV. Thai
    headers, UTF-8 BOM so Excel double-click opens without garbling.
    """
    body = build_department_compliance_csv(department_compliance_data(db))
    stamp = datetime.now().strftime("%Y%m%d")
    filename = f"department-compliance-{stamp}.csv"
    return StreamingResponse(
        iter([body]),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-store",
        },
    )
