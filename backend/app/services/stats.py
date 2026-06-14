"""Heavy aggregate queries behind the admin dashboard.

The routers in app/routers/admin_stats.py keep the HTTP concerns (auth,
cache headers, CSV download responses); the multi-query assembly lives here.
"""
import csv
import io
from collections import defaultdict
from datetime import datetime, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.certificate import Certificate
from app.models.course import Course, Module
from app.models.enrollment import Enrollment
from app.models.lesson import Lesson
from app.models.progress import LessonProgress
from app.models.quiz import QuizAttempt
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


def _is_valid_certificate(cert: Certificate, now: datetime) -> bool:
    if cert.is_revoked:
        return False
    if not cert.expires_at:
        return True
    expires_at = cert.expires_at if cert.expires_at.tzinfo else cert.expires_at.replace(tzinfo=timezone.utc)
    return expires_at > now


def _format_date(value) -> str:
    return value.strftime("%Y-%m-%d") if value else ""


def _format_datetime(value) -> str:
    return value.isoformat() if value else ""


def department_member_report_rows(db: Session, department: str) -> list[dict]:
    """Rich per-member report rows for the department CSV export.

    The JSON member table stays intentionally compact; CSV is where admins
    expect report-grade columns that can be filtered, pivoted, or joined with
    HR spreadsheets.
    """
    users = (
        db.query(User)
        .filter(User.department == department)
        .order_by(User.is_active.desc(), User.full_name)
        .all()
    )
    if not users:
        return []

    user_ids = [u.id for u in users]
    now = datetime.now(timezone.utc)

    courses = db.query(Course).all()
    course_map = {c.id: c for c in courses}
    published_mandatory_course_ids = {
        c.id for c in courses if c.is_published and c.is_mandatory
    }
    published_mandatory_count = len(published_mandatory_course_ids)

    lesson_counts = dict(
        db.query(Module.course_id, func.count(Lesson.id))
        .join(Lesson, Lesson.module_id == Module.id)
        .group_by(Module.course_id)
        .all()
    )

    enrollments_by_user: dict[int, list[Enrollment]] = defaultdict(list)
    for enrollment in db.query(Enrollment).filter(Enrollment.user_id.in_(user_ids)).all():
        enrollments_by_user[enrollment.user_id].append(enrollment)

    completed_lessons = {
        (user_id, course_id): int(n or 0)
        for user_id, course_id, n in (
            db.query(
                LessonProgress.user_id,
                Module.course_id,
                func.count(LessonProgress.id),
            )
            .join(Lesson, Lesson.id == LessonProgress.lesson_id)
            .join(Module, Module.id == Lesson.module_id)
            .filter(
                LessonProgress.user_id.in_(user_ids),
                LessonProgress.completed == True,
            )
            .group_by(LessonProgress.user_id, Module.course_id)
            .all()
        )
    }

    started_courses_by_user: dict[int, set[int]] = defaultdict(set)
    for user_id, course_id in (
        db.query(LessonProgress.user_id, Module.course_id)
        .join(Lesson, Lesson.id == LessonProgress.lesson_id)
        .join(Module, Module.id == Lesson.module_id)
        .filter(LessonProgress.user_id.in_(user_ids))
        .distinct()
        .all()
    ):
        started_courses_by_user[user_id].add(course_id)

    last_access_by_user = dict(
        db.query(LessonProgress.user_id, func.max(LessonProgress.last_accessed_at))
        .filter(LessonProgress.user_id.in_(user_ids))
        .group_by(LessonProgress.user_id)
        .all()
    )

    certificates_by_user: dict[int, list[Certificate]] = defaultdict(list)
    for cert in db.query(Certificate).filter(Certificate.user_id.in_(user_ids)).all():
        certificates_by_user[cert.user_id].append(cert)

    attempts_by_user: dict[int, list[QuizAttempt]] = defaultdict(list)
    for attempt in db.query(QuizAttempt).filter(QuizAttempt.user_id.in_(user_ids)).all():
        attempts_by_user[attempt.user_id].append(attempt)

    rows = []
    for user in users:
        user_enrollments = enrollments_by_user.get(user.id, [])
        enrollment_count = len(user_enrollments)
        course_progress_values = []
        completed_course_count = 0
        mandatory_enrolled_count = 0
        first_enrolled_at = None
        latest_enrolled_at = None

        for enrollment in user_enrollments:
            course = course_map.get(enrollment.course_id)
            if course and course.is_mandatory:
                mandatory_enrolled_count += 1

            if enrollment.enrolled_at:
                first_enrolled_at = (
                    enrollment.enrolled_at
                    if first_enrolled_at is None or enrollment.enrolled_at < first_enrolled_at
                    else first_enrolled_at
                )
                latest_enrolled_at = (
                    enrollment.enrolled_at
                    if latest_enrolled_at is None or enrollment.enrolled_at > latest_enrolled_at
                    else latest_enrolled_at
                )

            total_lessons = int(lesson_counts.get(enrollment.course_id, 0) or 0)
            completed = int(completed_lessons.get((user.id, enrollment.course_id), 0))
            progress = int(round((completed / total_lessons) * 100)) if total_lessons > 0 else 0
            course_progress_values.append(progress)
            if total_lessons > 0 and completed >= total_lessons:
                completed_course_count += 1

        started_count = sum(
            1
            for enrollment in user_enrollments
            if enrollment.course_id in started_courses_by_user.get(user.id, set())
        )
        not_started_count = max(enrollment_count - started_count, 0)
        in_progress_count = max(enrollment_count - completed_course_count - not_started_count, 0)
        average_progress = (
            round(sum(course_progress_values) / len(course_progress_values), 1)
            if course_progress_values
            else 0
        )

        certs = certificates_by_user.get(user.id, [])
        valid_certs = [cert for cert in certs if _is_valid_certificate(cert, now)]
        expired_certs = [
            cert
            for cert in certs
            if (not cert.is_revoked and cert.expires_at and not _is_valid_certificate(cert, now))
        ]
        revoked_certs = [cert for cert in certs if cert.is_revoked]
        valid_mandatory_course_ids = {
            cert.course_id
            for cert in valid_certs
            if cert.course_id in published_mandatory_course_ids
        }
        latest_certificate_issued_at = max(
            (cert.issued_at for cert in certs if cert.issued_at),
            default=None,
        )

        attempts = attempts_by_user.get(user.id, [])
        best_per_quiz: dict[int, tuple[int, bool]] = {}
        latest_quiz_attempt_at = None
        for attempt in attempts:
            score = int(attempt.score or 0)
            current = best_per_quiz.get(attempt.quiz_id)
            if current is None or score > current[0]:
                best_per_quiz[attempt.quiz_id] = (score, bool(attempt.is_passed))
            if attempt.attempted_at:
                latest_quiz_attempt_at = (
                    attempt.attempted_at
                    if latest_quiz_attempt_at is None or attempt.attempted_at > latest_quiz_attempt_at
                    else latest_quiz_attempt_at
                )
        unique_quiz_count = len(best_per_quiz)
        quiz_passed_count = sum(1 for _, passed in best_per_quiz.values() if passed)
        average_best_quiz_score = (
            round(sum(score for score, _ in best_per_quiz.values()) / unique_quiz_count, 1)
            if unique_quiz_count
            else 0
        )

        mandatory_required_count = published_mandatory_count if user.is_active else 0
        mandatory_completed_count = len(valid_mandatory_course_ids)
        mandatory_completion_percent = (
            int(round((mandatory_completed_count / mandatory_required_count) * 100))
            if mandatory_required_count
            else 0
        )
        if not user.is_active:
            learning_status = "inactive"
        elif mandatory_required_count and mandatory_completed_count < mandatory_required_count:
            learning_status = "mandatory_gap"
        elif enrollment_count == 0:
            learning_status = "not_started"
        elif completed_course_count >= enrollment_count:
            learning_status = "all_enrolled_completed"
        else:
            learning_status = "in_progress"

        rows.append({
            "user_id": user.id,
            "username": user.username,
            "full_name": user.full_name,
            "email": user.email,
            "department": user.department,
            "role": user.role.value if user.role else "",
            "position": user.position or "",
            "phone": user.phone or "",
            "responsibility": (user.responsibility or "").replace("\n", " "),
            "motivation": (user.motivation or "").replace("\n", " "),
            "is_active": bool(user.is_active),
            "profile_image": user.profile_image or "",
            "created_at": _format_date(user.created_at),
            "enrollment_count": enrollment_count,
            "completed_course_count": completed_course_count,
            "in_progress_course_count": in_progress_count,
            "not_started_course_count": not_started_count,
            "average_progress_percent": average_progress,
            "mandatory_required_count": mandatory_required_count,
            "mandatory_enrolled_count": mandatory_enrolled_count,
            "mandatory_completed_count": mandatory_completed_count,
            "mandatory_completion_percent": mandatory_completion_percent,
            "certificate_total_count": len(certs),
            "valid_certificate_count": len(valid_certs),
            "expired_certificate_count": len(expired_certs),
            "revoked_certificate_count": len(revoked_certs),
            "quiz_attempt_count": len(attempts),
            "unique_quiz_count": unique_quiz_count,
            "quiz_passed_count": quiz_passed_count,
            "average_best_quiz_score": average_best_quiz_score,
            "first_enrolled_at": _format_date(first_enrolled_at),
            "latest_enrolled_at": _format_date(latest_enrolled_at),
            "last_learning_activity_at": _format_datetime(last_access_by_user.get(user.id)),
            "latest_quiz_attempt_at": _format_datetime(latest_quiz_attempt_at),
            "latest_certificate_issued_at": _format_datetime(latest_certificate_issued_at),
            "learning_status": learning_status,
        })

    return rows


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
            "profile_image": u.profile_image,
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


def build_department_members_csv(rows: list[dict]) -> str:
    """CSV body for a detailed department member report."""
    buf = io.StringIO()
    buf.write("﻿")  # BOM for Excel
    writer = csv.writer(buf)
    columns = [
        ("user_id", "รหัสผู้ใช้"),
        ("username", "ชื่อผู้ใช้"),
        ("full_name", "ชื่อ-สกุล"),
        ("email", "อีเมล"),
        ("department", "หน่วยงาน"),
        ("role", "บทบาท"),
        ("position", "ตำแหน่ง"),
        ("phone", "เบอร์โทร"),
        ("responsibility", "ความรับผิดชอบ"),
        ("motivation", "เป้าหมายการเรียน"),
        ("is_active", "สถานะใช้งาน"),
        ("profile_image", "รูปโปรไฟล์"),
        ("created_at", "วันที่สร้างบัญชี"),
        ("enrollment_count", "จำนวนหลักสูตรที่ลงทะเบียน"),
        ("completed_course_count", "จำนวนหลักสูตรที่เรียนจบ"),
        ("in_progress_course_count", "จำนวนหลักสูตรที่กำลังเรียน"),
        ("not_started_course_count", "จำนวนหลักสูตรที่ยังไม่เริ่ม"),
        ("average_progress_percent", "ความคืบหน้าเฉลี่ย (%)"),
        ("mandatory_required_count", "หลักสูตรบังคับที่ต้องผ่าน"),
        ("mandatory_enrolled_count", "หลักสูตรบังคับที่ลงทะเบียน"),
        ("mandatory_completed_count", "หลักสูตรบังคับที่ผ่านแล้ว"),
        ("mandatory_completion_percent", "ความครบถ้วนหลักสูตรบังคับ (%)"),
        ("certificate_total_count", "ใบรับรองทั้งหมด"),
        ("valid_certificate_count", "ใบรับรองที่ใช้ได้"),
        ("expired_certificate_count", "ใบรับรองหมดอายุ"),
        ("revoked_certificate_count", "ใบรับรองถูกเพิกถอน"),
        ("quiz_attempt_count", "จำนวนครั้งที่ทำแบบทดสอบ"),
        ("unique_quiz_count", "จำนวนแบบทดสอบที่เคยทำ"),
        ("quiz_passed_count", "จำนวนแบบทดสอบที่ผ่าน"),
        ("average_best_quiz_score", "คะแนนแบบทดสอบเฉลี่ยจากคะแนนดีที่สุด (%)"),
        ("first_enrolled_at", "วันที่ลงทะเบียนครั้งแรก"),
        ("latest_enrolled_at", "วันที่ลงทะเบียนล่าสุด"),
        ("last_learning_activity_at", "เข้าเรียนล่าสุด"),
        ("latest_quiz_attempt_at", "ทำแบบทดสอบล่าสุด"),
        ("latest_certificate_issued_at", "ออกใบรับรองล่าสุด"),
        ("learning_status", "สถานะการเรียนสำหรับรายงาน"),
    ]
    writer.writerow([label for _, label in columns])
    for row in rows:
        writer.writerow([
            "ใช้งานอยู่" if key == "is_active" and row.get(key) else
            "ปิดใช้งาน" if key == "is_active" else
            row.get(key, "")
            for key, _ in columns
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
