"""Characterization tests for /api/users (admin user management)."""
import io

from tests.conftest import PASSWORD, make_user
from tests.factories import (
    completed_course,
    enroll,
    make_course,
    register_payload,
)
from app.models.user import UserRole


def user_create_payload(**overrides):
    payload = register_payload()
    payload.pop("confirm_password")
    payload.setdefault("role", "learner")
    payload.update(overrides)
    return payload


class TestCreateUser:
    def test_admin_creates_user(self, admin_client):
        res = admin_client.post("/api/users", json=user_create_payload(role="instructor"))
        assert res.status_code == 201
        assert res.json()["role"] == "instructor"

    def test_learner_denied(self, learner_client):
        res = learner_client.post("/api/users", json=user_create_payload())
        assert res.status_code == 403
        assert res.json()["detail"] == "ต้องเป็นผู้ดูแลระบบเท่านั้น"

    def test_duplicate_username(self, admin_client, learner_user):
        res = admin_client.post(
            "/api/users", json=user_create_payload(username=learner_user.username)
        )
        assert res.status_code == 400
        assert res.json()["detail"] == f"ชื่อผู้ใช้ '{learner_user.username}' มีอยู่ในระบบแล้ว"

    def test_duplicate_email(self, admin_client, learner_user):
        res = admin_client.post(
            "/api/users", json=user_create_payload(email=learner_user.email)
        )
        assert res.status_code == 400
        assert res.json()["detail"] == "อีเมลนี้มีอยู่ในระบบแล้ว"


class TestListGetUsers:
    def test_list_users_admin_only(self, admin_client, learner_client, learner_user):
        res = learner_client.get("/api/users")
        assert res.status_code == 403

        res = admin_client.get("/api/users")
        assert res.status_code == 200
        usernames = [u["username"] for u in res.json()]
        assert learner_user.username in usernames

    def test_list_users_search(self, admin_client, db):
        make_user(db, username="somchai", full_name="สมชาย ใจดี")
        res = admin_client.get("/api/users", params={"search": "somchai"})
        assert res.status_code == 200
        assert len(res.json()) == 1

    def test_get_self_allowed(self, learner_client, learner_user):
        res = learner_client.get(f"/api/users/{learner_user.id}")
        assert res.status_code == 200
        assert res.json()["id"] == learner_user.id

    def test_get_other_user_denied_for_learner(self, learner_client, db):
        other = make_user(db, username="other1")
        res = learner_client.get(f"/api/users/{other.id}")
        assert res.status_code == 403
        assert res.json()["detail"] == "ไม่มีสิทธิ์ดูข้อมูลผู้ใช้คนอื่น"

    def test_get_unknown_user(self, admin_client):
        res = admin_client.get("/api/users/99999")
        assert res.status_code == 404
        assert res.json()["detail"] == "ไม่พบผู้ใช้"


class TestUpdateUser:
    def test_admin_updates_user(self, admin_client, learner_user):
        res = admin_client.put(
            f"/api/users/{learner_user.id}",
            json={"full_name": "ชื่อ แก้ไขแล้ว", "role": "manager"},
        )
        assert res.status_code == 200
        body = res.json()
        assert body["full_name"] == "ชื่อ แก้ไขแล้ว"
        assert body["role"] == "manager"

    def test_admin_cannot_change_own_role(self, admin_client, admin_user):
        res = admin_client.put(
            f"/api/users/{admin_user.id}", json={"role": "learner"}
        )
        assert res.status_code == 400
        assert res.json()["detail"] == "ไม่สามารถเปลี่ยนบทบาทของตัวเองได้"


class TestDeleteUser:
    def test_admin_cannot_delete_self(self, admin_client, admin_user):
        res = admin_client.delete(f"/api/users/{admin_user.id}")
        assert res.status_code == 400
        assert res.json()["detail"] == "ไม่สามารถลบบัญชีของตัวเองได้"

    def test_delete_user_with_history(self, admin_client, db, learner_user):
        # User has enrollment + progress + cert-less history; delete must cascade.
        completed_course(db, learner_user)
        res = admin_client.delete(f"/api/users/{learner_user.id}")
        assert res.status_code == 200
        assert res.json()["message"] == f"ลบบัญชี {learner_user.full_name} เรียบร้อย"

        res = admin_client.get(f"/api/users/{learner_user.id}")
        assert res.status_code == 404

    def test_delete_unknown_user(self, admin_client):
        res = admin_client.delete("/api/users/99999")
        assert res.status_code == 404


class TestLearningSummary:
    def test_summary_shape(self, admin_client, db, learner_user):
        course = make_course(db)
        enroll(db, learner_user, course)
        res = admin_client.get(f"/api/users/{learner_user.id}/learning-summary")
        assert res.status_code == 200
        body = res.json()
        assert body["user"]["id"] == learner_user.id
        assert len(body["enrollments"]) == 1
        assert body["enrollments"][0]["course_id"] == course.id
        assert body["quiz_stats"] == {
            "total_attempts": 0,
            "unique_quizzes": 0,
            "passed_count": 0,
            "average_score": 0,
        }

    def test_summary_admin_only(self, learner_client, learner_user):
        res = learner_client.get(f"/api/users/{learner_user.id}/learning-summary")
        assert res.status_code == 403


class TestBulkImport:
    def _upload(self, client, csv_text, filename="users.csv"):
        return client.post(
            "/api/users/bulk-import",
            files={"file": (filename, io.BytesIO(csv_text.encode("utf-8")), "text/csv")},
        )

    def test_mixed_rows(self, admin_client, learner_user):
        csv_text = (
            "username,email,full_name,department,position,phone,role,password\n"
            "newstaff1,staff1@example.com,พนักงาน หนึ่ง,กรมป่าไม้,เจ้าหน้าที่,0811111111,learner,secret123\n"
            "autopass1,auto1@example.com,พนักงาน สอง,กรมป่าไม้,เจ้าหน้าที่,0822222222,,\n"
            f"{learner_user.username},dup@example.com,ซ้ำ ซ้อน,กรมป่าไม้,เจ้าหน้าที่,0833333333,learner,secret123\n"
            "bademail,not-an-email,อีเมล ผิด,กรมป่าไม้,เจ้าหน้าที่,0844444444,learner,secret123\n"
            "shortpw,short@example.com,รหัส สั้น,กรมป่าไม้,เจ้าหน้าที่,0855555555,learner,123\n"
            "badrole,role@example.com,บทบาท ผิด,กรมป่าไม้,เจ้าหน้าที่,0866666666,wizard,secret123\n"
        )
        res = self._upload(admin_client, csv_text)
        assert res.status_code == 200
        body = res.json()
        assert body["created_count"] == 2
        assert body["skipped_count"] == 1
        assert body["error_count"] == 3
        assert body["created"][0]["generated_password"] is None
        assert body["created"][1]["generated_password"]  # auto-generated

    def test_missing_columns(self, admin_client):
        res = self._upload(admin_client, "username,email\na,b@c.co\n")
        assert res.status_code == 400
        assert res.json()["detail"].startswith("ขาดคอลัมน์ที่จำเป็น:")

    def test_non_csv_rejected(self, admin_client):
        res = self._upload(admin_client, "whatever", filename="users.xlsx")
        assert res.status_code == 400
        assert res.json()["detail"] == "กรุณาอัปโหลดไฟล์ .csv"

    def test_admin_only(self, learner_client):
        res = self._upload(learner_client, "username,email\n")
        assert res.status_code == 403


class TestResetPassword:
    def test_reset_self_blocked(self, admin_client, admin_user):
        res = admin_client.post(
            f"/api/users/{admin_user.id}/reset-password",
            json={"new_password": "newpass123"},
        )
        assert res.status_code == 400
        assert res.json()["detail"] == "ไม่สามารถรีเซ็ตรหัสผ่านของตัวเองได้ ใช้หน้า Profile แทน"

    def test_reset_other_user(self, admin_client, client, learner_user):
        res = admin_client.post(
            f"/api/users/{learner_user.id}/reset-password",
            json={"new_password": "newpass123"},
        )
        assert res.status_code == 200
        assert res.json()["username"] == learner_user.username

        res = client.post(
            "/api/auth/login",
            json={"identifier": learner_user.username, "password": "newpass123"},
        )
        assert res.status_code == 200
