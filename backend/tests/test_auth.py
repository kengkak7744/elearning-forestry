"""Characterization tests for /api/auth — lock in current behavior."""
from tests.conftest import PASSWORD, make_user
from tests.factories import register_payload
from app.models.user import UserRole


class TestRegister:
    def test_register_creates_learner(self, client):
        res = client.post("/api/auth/register", json=register_payload())
        assert res.status_code == 201
        body = res.json()
        assert body["username"] == "newuser1"
        assert body["role"] == "learner"
        assert "hashed_password" not in body

    def test_password_mismatch(self, client):
        res = client.post(
            "/api/auth/register",
            json=register_payload(confirm_password="different1"),
        )
        assert res.status_code == 400
        assert res.json()["detail"] == "รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน"

    def test_duplicate_username(self, client, learner_user):
        res = client.post(
            "/api/auth/register",
            json=register_payload(username=learner_user.username),
        )
        assert res.status_code == 400
        assert res.json()["detail"] == f"ชื่อผู้ใช้ '{learner_user.username}' มีอยู่ในระบบแล้ว"

    def test_duplicate_email(self, client, learner_user):
        res = client.post(
            "/api/auth/register",
            json=register_payload(email=learner_user.email),
        )
        assert res.status_code == 400
        assert res.json()["detail"] == "อีเมลนี้มีอยู่ในระบบแล้ว"


class TestLogin:
    def test_login_with_username_sets_cookie(self, client, learner_user):
        res = client.post(
            "/api/auth/login",
            json={"identifier": learner_user.username, "password": PASSWORD},
        )
        assert res.status_code == 200
        body = res.json()
        assert body["token_type"] == "bearer"
        assert body["access_token"]
        assert body["user"]["username"] == learner_user.username
        assert "access_token" in res.cookies
        set_cookie = res.headers["set-cookie"].lower()
        assert "httponly" in set_cookie
        assert "samesite=lax" in set_cookie

    def test_login_with_email(self, client, learner_user):
        res = client.post(
            "/api/auth/login",
            json={"identifier": learner_user.email, "password": PASSWORD},
        )
        assert res.status_code == 200

    def test_wrong_password(self, client, learner_user):
        res = client.post(
            "/api/auth/login",
            json={"identifier": learner_user.username, "password": "wrongpass"},
        )
        assert res.status_code == 401
        assert res.json()["detail"] == "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง"

    def test_unknown_user(self, client):
        res = client.post(
            "/api/auth/login",
            json={"identifier": "nobody", "password": "whatever1"},
        )
        assert res.status_code == 401

    def test_inactive_user(self, client, db):
        make_user(db, username="inactive1", is_active=False)
        res = client.post(
            "/api/auth/login",
            json={"identifier": "inactive1", "password": PASSWORD},
        )
        assert res.status_code == 400
        assert res.json()["detail"] == "บัญชีผู้ใช้ถูกระงับ"


class TestMe:
    def test_me_requires_auth(self, client):
        res = client.get("/api/auth/me")
        assert res.status_code == 401
        assert res.json()["detail"] == "ไม่สามารถตรวจสอบสิทธิ์ได้"

    def test_me_returns_current_user(self, learner_client, learner_user):
        res = learner_client.get("/api/auth/me")
        assert res.status_code == 200
        assert res.json()["id"] == learner_user.id

    def test_session_returns_unauthenticated_without_401(self, client):
        res = client.get("/api/auth/session")
        assert res.status_code == 200
        assert res.json() == {"authenticated": False, "user": None}

    def test_session_returns_current_user(self, learner_client, learner_user):
        res = learner_client.get("/api/auth/session")
        assert res.status_code == 200
        body = res.json()
        assert body["authenticated"] is True
        assert body["user"]["id"] == learner_user.id

    def test_patch_me_updates_fields(self, learner_client):
        res = learner_client.patch(
            "/api/auth/me",
            json={"full_name": "ชื่อใหม่ นามสกุลใหม่", "position": "หัวหน้าฝ่าย"},
        )
        assert res.status_code == 200
        body = res.json()
        assert body["full_name"] == "ชื่อใหม่ นามสกุลใหม่"
        assert body["position"] == "หัวหน้าฝ่าย"


class TestChangePassword:
    def test_wrong_current_password(self, learner_client):
        res = learner_client.post(
            "/api/auth/change-password",
            json={"current_password": "nope-wrong", "new_password": "newpass123"},
        )
        assert res.status_code == 400
        assert res.json()["detail"] == "รหัสผ่านปัจจุบันไม่ถูกต้อง"

    def test_change_password_then_login(self, client, learner_client, learner_user):
        res = learner_client.post(
            "/api/auth/change-password",
            json={"current_password": PASSWORD, "new_password": "newpass123"},
        )
        assert res.status_code == 200
        assert res.json()["message"] == "เปลี่ยนรหัสผ่านสำเร็จ"

        res = client.post(
            "/api/auth/login",
            json={"identifier": learner_user.username, "password": "newpass123"},
        )
        assert res.status_code == 200


class TestLogout:
    def test_logout(self, learner_client, learner_user):
        res = learner_client.post("/api/auth/logout")
        assert res.status_code == 200
        assert res.json()["message"] == f"ออกจากระบบสำเร็จ ลาก่อนคุณ {learner_user.full_name}"
