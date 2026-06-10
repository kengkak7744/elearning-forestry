"""Heavy aggregate queries behind the admin dashboard.

The routers in app/routers/admin_stats.py keep the HTTP concerns (auth,
cache headers, CSV download responses); the multi-query assembly lives here.
"""
import csv
import io
from datetime import datetime, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.certificate import Certificate
from app.models.course import Course, Module
from app.models.enrollment import Enrollment
from app.models.lesson import Lesson
from app.models.progress import LessonProgress
from app.models.user import User


def overview_stats(db: Session) -> dict:
    """High-level numbers for the dashboard cards."""
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


def department_members_rows(db: Session, department: str):
    """Per-member (User, enrollment_count, cert_count) rows for one department.
    Shared by the JSON and CSV member listings."""
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
    return (
        db.query(User, enroll_sub.c.n, cert_sub.c.n)
        .outerjoin(enroll_sub, enroll_sub.c.user_id == User.id)
        .outerjoin(cert_sub, cert_sub.c.user_id == User.id)
        .filter(User.department == department)
        .order_by(User.is_active.desc(), User.full_name)
        .all()
    )


def department_course_members_data(db: Session, department: str, course: Course) -> dict:
    """Department members crossed with one specific course: enrollment state,
    progress %, and current-cert status per member."""
    total_lessons = (
        db.query(func.count(Lesson.id))
        .join(Module, Module.id == Lesson.module_id)
        .filter(Module.course_id == course.id)
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
        .filter(Module.course_id == course.id, LessonProgress.completed == True)
        .group_by(LessonProgress.user_id)
        .subquery()
    )
    enrollment_sub = (
        db.query(
            Enrollment.user_id,
            Enrollment.enrolled_at,
        )
        .filter(Enrollment.course_id == course.id)
        .subquery()
    )
    # The most recent cert per (user, course) — recertification flows can
    # have historical certs, but for this view we care about the current one.
    cert_sub = (
        db.query(
            Certificate.user_id,
            func.max(Certificate.id).label("cert_id"),
        )
        .filter(Certificate.course_id == course.id)
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

    now = datetime.now(timezone.utc)
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
                exp = expires_at if expires_at.tzinfo else expires_at.replace(tzinfo=timezone.utc)
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


def department_compliance_data(db: Session) -> dict:
    """Per-department completion rate against published mandatory courses.

    "Completed" = the user holds a non-expired certificate for that course.
    (Strict measure — what regulators / HR audit against.)
    """
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


def build_department_members_csv(rows) -> str:
    """CSV body for a department member listing. UTF-8 + BOM so Excel opens
    the Thai headers without garbling."""
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
    return buf.getvalue()


def build_department_compliance_csv(payload: dict) -> str:
    """CSV body for the compliance report. Thai headers, UTF-8 BOM."""
    buf = io.StringIO()
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
    return buf.getvalue()
