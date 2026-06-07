"""Aggregate statistics for the admin dashboard."""
import csv
import io
from datetime import datetime

from fastapi import APIRouter, Depends, Query, Response
from fastapi.responses import StreamingResponse
from sqlalchemy import func, desc
from sqlalchemy.orm import Session
from app.database import get_db
from app.dependencies import require_admin
from app.models.user import User, UserRole
from app.models.course import Course, Module
from app.models.lesson import Lesson
from app.models.enrollment import Enrollment
from app.models.progress import LessonProgress
from app.models.course_feedback import CourseFeedback


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


def _department_members_query(db: Session, department: str):
    """Shared helper for the JSON + CSV member listings."""
    from app.models.certificate import Certificate
    # Subqueries for per-user enrollment + non-revoked cert counts. Done as
    # subqueries (not joined groups) to avoid duplicating user rows.
    enroll_sub = (
        db.query(Enrollment.user_id, func.count(Enrollment.id).label("n"))
        .group_by(Enrollment.user_id)
        .subquery()
    )
    cert_sub = (
        db.query(Certificate.user_id, func.count(Certificate.id).label("n"))
        .filter(Certificate.is_revoked == False)
        .group_by(Certificate.user_id)
        .subquery()
    )
    rows = (
        db.query(User, enroll_sub.c.n, cert_sub.c.n)
        .outerjoin(enroll_sub, enroll_sub.c.user_id == User.id)
        .outerjoin(cert_sub, cert_sub.c.user_id == User.id)
        .filter(User.department == department)
        .order_by(User.is_active.desc(), User.full_name)
        .all()
    )
    return rows


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
    rows = _department_members_query(db, department)
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
    from datetime import datetime as _dt, timezone as _tz
    from app.models.certificate import Certificate
    from app.models.lesson import Lesson
    from app.models.course import Module
    from app.models.progress import LessonProgress

    response.headers["Cache-Control"] = _STATS_CACHE
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="ไม่พบหลักสูตร")

    total_lessons = (
        db.query(func.count(Lesson.id))
        .join(Module, Module.id == Lesson.module_id)
        .filter(Module.course_id == course_id)
        .scalar()
    ) or 0

    # Per-user completed-lesson count, scoped to this course.
    completed_sub = (
        db.query(
            LessonProgress.user_id,
            func.count(LessonProgress.id).label("n"),
        )
        .join(Lesson, Lesson.id == LessonProgress.lesson_id)
        .join(Module, Module.id == Lesson.module_id)
        .filter(Module.course_id == course_id, LessonProgress.completed == True)
        .group_by(LessonProgress.user_id)
        .subquery()
    )
    enrollment_sub = (
        db.query(
            Enrollment.user_id,
            Enrollment.enrolled_at,
        )
        .filter(Enrollment.course_id == course_id)
        .subquery()
    )
    # The most recent cert per (user, course) — recertification flows can
    # have historical certs, but for this view we care about the current one.
    cert_sub = (
        db.query(
            Certificate.user_id,
            func.max(Certificate.id).label("cert_id"),
        )
        .filter(Certificate.course_id == course_id)
        .group_by(Certificate.user_id)
        .subquery()
    )
    rows = (
        db.query(
            User,
            enrollment_sub.c.enrolled_at,
            completed_sub.c.n,
            cert_sub.c.cert_id,
        )
        .outerjoin(enrollment_sub, enrollment_sub.c.user_id == User.id)
        .outerjoin(completed_sub, completed_sub.c.user_id == User.id)
        .outerjoin(cert_sub, cert_sub.c.user_id == User.id)
        .filter(User.department == department)
        .order_by(User.is_active.desc(), User.full_name)
        .all()
    )
    # Pull current-cert details for everyone who has one — one extra query
    # rather than joining the whole row through a sub.
    cert_ids = [r[3] for r in rows if r[3] is not None]
    cert_info: dict[int, tuple] = {}
    if cert_ids:
        for c in db.query(Certificate).filter(Certificate.id.in_(cert_ids)).all():
            cert_info[c.id] = (c.is_revoked, c.expires_at)

    now = _dt.now(_tz.utc)
    members = []
    for u, enrolled_at, completed_n, cert_id in rows:
        is_enrolled = enrolled_at is not None
        completed_n = int(completed_n or 0)
        progress = (
            int(round((completed_n / total_lessons) * 100))
            if (total_lessons > 0 and is_enrolled)
            else 0
        )
        cert_status = None
        if cert_id is not None:
            is_revoked, expires_at = cert_info.get(cert_id, (False, None))
            if is_revoked:
                cert_status = "revoked"
            elif expires_at:
                exp = expires_at if expires_at.tzinfo else expires_at.replace(tzinfo=_tz.utc)
                cert_status = "expired" if exp < now else "valid"
            else:
                cert_status = "valid"
        members.append({
            "id": u.id,
            "full_name": u.full_name,
            "username": u.username,
            "email": u.email,
            "position": u.position,
            "phone": u.phone,
            "role": u.role.value if u.role else None,
            "is_active": u.is_active,
            "is_enrolled": is_enrolled,
            "enrolled_at": enrolled_at.isoformat() if enrolled_at else None,
            "progress_percent": progress,
            "completed_lessons": completed_n if is_enrolled else 0,
            "total_lessons": total_lessons,
            "cert_status": cert_status,
            "cert_id": cert_id,
        })
    return {
        "course": {
            "id": course.id,
            "title": course.title,
            "is_mandatory": course.is_mandatory,
            "category": course.category.value if course.category else None,
            "total_lessons": total_lessons,
        },
        "members": members,
    }


@router.get("/departments/{department}/members.csv")
def department_members_csv(
    department: str,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """CSV download of a department's members. UTF-8 + BOM so Excel
    opens the Thai headers without garbling, matching the existing
    compliance CSV pattern."""
    rows = _department_members_query(db, department)
    buf = io.StringIO()
    buf.write("﻿")  # BOM for Excel
    writer = csv.writer(buf)
    writer.writerow([
        "ชื่อผู้ใช้",
        "ชื่อ-สกุล",
        "อีเมล",
        "บทบาท",
        "ตำแหน่ง",
        "เบอร์โทร",
        "ความรับผิดชอบ",
        "สถานะการใช้งาน",
        "ลงทะเบียน (ครั้ง)",
        "ใบรับรอง (ฉบับ)",
        "วันที่สร้างบัญชี",
    ])
    for u, enroll_n, cert_n in rows:
        writer.writerow([
            u.username,
            u.full_name,
            u.email,
            (u.role.value if u.role else "") or "",
            u.position or "",
            u.phone or "",
            (u.responsibility or "").replace("\n", " "),
            "ใช้งานอยู่" if u.is_active else "ปิดใช้งาน",
            int(enroll_n or 0),
            int(cert_n or 0),
            u.created_at.strftime("%Y-%m-%d") if u.created_at else "",
        ])
    buf.seek(0)
    stamp = datetime.now().strftime("%Y%m%d")
    # Department name may contain spaces / Thai chars; ASCII-fallback the
    # filename so old User-Agent headers don't mangle the download.
    safe_name = "".join(c if c.isalnum() else "_" for c in department)[:60]
    filename = f"department-{safe_name}-{stamp}.csv"
    return StreamingResponse(
        iter([buf.getvalue()]),
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
    from datetime import datetime, timezone
    from app.models.certificate import Certificate

    response.headers["Cache-Control"] = _STATS_CACHE

    mandatory_course_ids = [
        cid
        for (cid,) in db.query(Course.id)
        .filter(Course.is_published == True, Course.is_mandatory == True)
        .all()
    ]
    mandatory_count = len(mandatory_course_ids)

    # Per-department staff count (active users only).
    dept_rows = (
        db.query(User.department, func.count(User.id))
        .filter(User.is_active == True, User.department.isnot(None), User.department != "")
        .group_by(User.department)
        .all()
    )

    if mandatory_count == 0 or not dept_rows:
        return {
            "mandatory_courses_count": mandatory_count,
            "departments": [],
        }

    now = datetime.now(timezone.utc)

    # Per-(department, user) count of distinct mandatory courses they hold a
    # non-expired cert for. Aggregated up to department.
    valid_certs_per_dept = dict(
        db.query(
            User.department,
            func.count(func.distinct(Certificate.course_id)),
        )
        .join(Certificate, Certificate.user_id == User.id)
        .filter(
            User.is_active == True,
            User.department.isnot(None),
            User.department != "",
            Certificate.course_id.in_(mandatory_course_ids),
        )
        # NULL expires_at = permanent. expires_at > now = still valid.
        .filter((Certificate.expires_at.is_(None)) | (Certificate.expires_at > now))
        .group_by(User.department)
        .all()
    )

    departments = []
    for dept_name, staff_count in dept_rows:
        required = staff_count * mandatory_count
        actual = valid_certs_per_dept.get(dept_name, 0)
        rate = int(round((actual / required) * 100)) if required > 0 else 0
        departments.append({
            "department": dept_name,
            "staff_count": staff_count,
            "required_completions": required,
            "actual_completions": int(actual),
            "completion_rate": rate,
        })

    departments.sort(key=lambda d: (d["completion_rate"], -d["staff_count"]))

    return {
        "mandatory_courses_count": mandatory_count,
        "departments": departments,
    }


@router.get("/department-compliance.csv")
def department_compliance_csv(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """
    Same data as /department-compliance but as a downloadable CSV. Thai
    headers, UTF-8 BOM so Excel double-click opens without garbling.
    """
    # Reuse the same logic — call the JSON endpoint helper inline rather than
    # duplicating the queries. We pass a throwaway Response since the JSON
    # endpoint sets a Cache-Control on it; the CSV download doesn't need that.
    payload = department_compliance(response=Response(), db=db, _admin=_admin)

    buf = io.StringIO()
    # Write UTF-8 BOM so Excel detects encoding correctly on double-click open.
    buf.write("﻿")
    writer = csv.writer(buf)
    writer.writerow([
        "หน่วยงาน",
        "จำนวนเจ้าหน้าที่",
        "หลักสูตรบังคับทั้งหมด",
        "ต้องผ่าน (ครั้ง)",
        "ผ่านแล้ว (ครั้ง)",
        "ร้อยละ",
    ])
    mandatory_count = payload["mandatory_courses_count"]
    for d in payload["departments"]:
        writer.writerow([
            d["department"],
            d["staff_count"],
            mandatory_count,
            d["required_completions"],
            d["actual_completions"],
            d["completion_rate"],
        ])

    buf.seek(0)
    stamp = datetime.now().strftime("%Y%m%d")
    filename = f"department-compliance-{stamp}.csv"
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-store",
        },
    )
