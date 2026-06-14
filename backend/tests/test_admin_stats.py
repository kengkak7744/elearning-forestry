"""Characterization tests for /api/admin/stats."""
import csv
import io

import pytest

from tests.conftest import make_user
from tests.factories import (
    complete_all_lessons,
    enroll,
    make_course,
    make_lesson,
    make_module,
    make_quiz,
    pass_quiz,
)
from app.models.certificate import Certificate
from app.models.user import UserRole


class TestOverview:
    def test_counts_and_completion_rate(self, admin_client, db, learner_user):
        course = make_course(db)
        module = make_module(db, course)
        make_lesson(db, module)
        enroll(db, learner_user, course)
        complete_all_lessons(db, learner_user, course)

        res = admin_client.get("/api/admin/stats/overview")
        assert res.status_code == 200
        body = res.json()
        assert body["total_users"] == 2  # admin + learner fixtures
        assert body["active_users"] == 2
        assert body["total_courses"] == 1
        assert body["published_courses"] == 1
        assert body["total_enrollments"] == 1
        assert body["completed_enrollments"] == 1
        assert body["completion_rate"] == 100

    def test_learner_denied(self, learner_client):
        res = learner_client.get("/api/admin/stats/overview")
        assert res.status_code == 403
        assert res.json()["detail"] == "ต้องเป็นผู้ดูแลระบบเท่านั้น"


class TestRankings:
    def test_top_courses(self, admin_client, db, learner_user):
        course = make_course(db)
        enroll(db, learner_user, course)
        res = admin_client.get("/api/admin/stats/top-courses")
        assert res.status_code == 200
        assert res.json()[0]["enrolled_count"] == 1

    def test_top_departments(self, admin_client, db, learner_user):
        course = make_course(db)
        enroll(db, learner_user, course)
        res = admin_client.get("/api/admin/stats/top-departments")
        rows = res.json()
        assert rows[0]["department"] == learner_user.department
        assert rows[0]["enrolled_count"] == 1

    def test_recent_enrollments(self, admin_client, db, learner_user):
        course = make_course(db)
        enroll(db, learner_user, course)
        res = admin_client.get("/api/admin/stats/recent-enrollments")
        rows = res.json()
        assert rows[0]["user"]["full_name"] == learner_user.full_name
        assert rows[0]["course"]["id"] == course.id


class TestDepartments:
    def test_departments_overview(self, admin_client, db):
        make_user(db, username="dept_a_user", department="ส่วนภูมิภาค")
        res = admin_client.get("/api/admin/stats/departments")
        assert res.status_code == 200
        names = {d["name"] for d in res.json()}
        assert {"กรมป่าไม้", "ส่วนภูมิภาค"} <= names
        row = next(d for d in res.json() if d["name"] == "ส่วนภูมิภาค")
        assert row["user_count"] == 1
        assert row["role_breakdown"] == {"learner": 1}

    def test_department_members(self, admin_client, db, learner_user):
        learner_user.profile_image = "/elearning/images/learner.png"
        db.commit()
        res = admin_client.get(
            f"/api/admin/stats/departments/{learner_user.department}/members"
        )
        assert res.status_code == 200
        member = next(m for m in res.json() if m["username"] == learner_user.username)
        assert member["profile_image"] == "/elearning/images/learner.png"

    def test_department_members_csv(self, admin_client, db):
        user = make_user(db, username="ascii_dept", department="Forest HQ")
        res = admin_client.get(
            f"/api/admin/stats/departments/{user.department}/members.csv"
        )
        assert res.status_code == 200
        assert res.headers["content-type"].startswith("text/csv")
        assert "ชื่อผู้ใช้" in res.text

    def test_department_members_csv_contains_report_metrics(self, admin_client, db):
        user = make_user(
            db,
            username="report_user",
            department="Report Dept",
            profile_image="/elearning/images/report.png",
        )
        course = make_course(db, is_mandatory=True)
        module = make_module(db, course)
        make_lesson(db, module)
        enroll(db, user, course)
        complete_all_lessons(db, user, course)
        quiz = make_quiz(db, course=course)
        pass_quiz(db, user, quiz, score=88)
        db.add(Certificate(
            user_id=user.id,
            course_id=course.id,
            certificate_number="CERT-REPORT-1",
            final_score=88,
        ))
        db.commit()

        res = admin_client.get("/api/admin/stats/departments/Report Dept/members.csv")
        assert res.status_code == 200

        rows = list(csv.DictReader(io.StringIO(res.content.decode("utf-8-sig"))))
        assert len(rows) == 1
        row = rows[0]
        assert row["ชื่อผู้ใช้"] == "report_user"
        assert row["รูปโปรไฟล์"] == "/elearning/images/report.png"
        assert row["จำนวนหลักสูตรที่ลงทะเบียน"] == "1"
        assert row["จำนวนหลักสูตรที่เรียนจบ"] == "1"
        assert row["หลักสูตรบังคับที่ผ่านแล้ว"] == "1"
        assert row["ใบรับรองที่ใช้ได้"] == "1"
        assert row["จำนวนแบบทดสอบที่ผ่าน"] == "1"
        assert row["คะแนนแบบทดสอบเฉลี่ยจากคะแนนดีที่สุด (%)"] == "88.0"
        assert row["สถานะการเรียนสำหรับรายงาน"] == "all_enrolled_completed"

    def test_department_members_csv_thai_name(self, admin_client, learner_user):
        # Thai department names used to 500 (Thai chars survived into the
        # latin-1-only Content-Disposition header); now ASCII-sanitized.
        res = admin_client.get(
            f"/api/admin/stats/departments/{learner_user.department}/members.csv"
        )
        assert res.status_code == 200
        assert "ชื่อผู้ใช้" in res.text

    def test_department_course_performance(self, admin_client, db, learner_user):
        course = make_course(db, is_mandatory=True)
        enroll(db, learner_user, course)
        res = admin_client.get(
            f"/api/admin/stats/departments/{learner_user.department}/courses"
        )
        assert res.status_code == 200
        row = res.json()[0]
        assert row["enrolled_count"] == 1
        assert row["certified_count"] == 0
        assert row["certification_pct"] == 0

    def test_department_course_members(self, admin_client, db, learner_user):
        learner_user.profile_image = "/elearning/images/course-member.png"
        db.commit()
        course = make_course(db)
        module = make_module(db, course)
        make_lesson(db, module)
        enroll(db, learner_user, course)
        res = admin_client.get(
            f"/api/admin/stats/departments/{learner_user.department}"
            f"/courses/{course.id}/members"
        )
        assert res.status_code == 200
        body = res.json()
        assert body["course"]["id"] == course.id
        member = next(m for m in body["members"] if m["id"] == learner_user.id)
        assert member["profile_image"] == "/elearning/images/course-member.png"
        assert member["is_enrolled"] is True
        assert member["progress_percent"] == 0

    def test_department_course_members_unknown_course(self, admin_client, learner_user):
        # Was a NameError/500 before the get_or_404 helper (HTTPException was
        # used without being imported); now a proper 404.
        res = admin_client.get(
            f"/api/admin/stats/departments/{learner_user.department}"
            "/courses/99999/members"
        )
        assert res.status_code == 404
        assert res.json()["detail"] == "ไม่พบหลักสูตร"


class TestCompliance:
    def test_no_mandatory_courses(self, admin_client, db, learner_user):
        res = admin_client.get("/api/admin/stats/department-compliance")
        assert res.status_code == 200
        assert res.json() == {"mandatory_courses_count": 0, "departments": []}

    def test_compliance_shape(self, admin_client, db, learner_user):
        make_course(db, is_mandatory=True)
        res = admin_client.get("/api/admin/stats/department-compliance")
        body = res.json()
        assert body["mandatory_courses_count"] == 1
        dept = body["departments"][0]
        assert dept["department"] == "กรมป่าไม้"
        assert dept["staff_count"] == 2  # admin + learner fixtures
        assert dept["required_completions"] == 2
        assert dept["actual_completions"] == 0
        assert dept["completion_rate"] == 0

    def test_compliance_csv(self, admin_client, db, learner_user):
        make_course(db, is_mandatory=True)
        res = admin_client.get("/api/admin/stats/department-compliance.csv")
        assert res.status_code == 200
        assert res.headers["content-type"].startswith("text/csv")
        assert "หน่วยงาน" in res.text


class TestCourseFeedbackStats:
    def test_shape(self, admin_client, db):
        make_course(db)
        res = admin_client.get("/api/admin/stats/course-feedback")
        assert res.status_code == 200
        body = res.json()
        assert body["min_count_threshold"] == 3
        course_row = body["courses"][0]
        assert course_row["count"] == 0
        assert course_row["average"] is None
        assert course_row["is_underperforming"] is False
