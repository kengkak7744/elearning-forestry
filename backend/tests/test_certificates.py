"""Characterization tests for /api/certificates — eligibility, issuance,
public verification (+ rate limit), revocation, download."""
from tests.conftest import auth_client, make_user
from tests.factories import (
    complete_all_lessons,
    completed_course,
    enroll,
    make_course,
    make_lesson,
    make_module,
    make_quiz,
    pass_quiz,
)


class TestEligibility:
    def test_not_enrolled(self, learner_client, db):
        course = make_course(db)
        res = learner_client.get(f"/api/certificates/course/{course.id}/eligibility")
        assert res.status_code == 200
        body = res.json()
        assert body["eligible"] is False
        assert body["reason"] == "ยังไม่ได้ลงทะเบียนหลักสูตรนี้"
        assert body["has_certificate"] is False

    def test_course_without_lessons(self, learner_client, db, learner_user):
        course = make_course(db)
        enroll(db, learner_user, course)
        res = learner_client.get(f"/api/certificates/course/{course.id}/eligibility")
        assert res.json()["reason"] == "หลักสูตรยังไม่มีบทเรียน"

    def test_incomplete_lessons(self, learner_client, db, learner_user):
        course = make_course(db)
        module = make_module(db, course)
        lesson1 = make_lesson(db, module)
        make_lesson(db, module, title="บทเรียนที่ 2", order_index=1)
        enroll(db, learner_user, course)
        from tests.factories import complete_lesson

        complete_lesson(db, learner_user, lesson1)
        res = learner_client.get(f"/api/certificates/course/{course.id}/eligibility")
        assert res.json()["reason"] == "เรียนยังไม่ครบ (1/2 บทเรียน)"

    def test_final_quiz_not_passed(self, learner_client, db, learner_user):
        course = make_course(db)
        module = make_module(db, course)
        make_lesson(db, module)
        make_quiz(db, course=course)
        enroll(db, learner_user, course)
        complete_all_lessons(db, learner_user, course)
        res = learner_client.get(f"/api/certificates/course/{course.id}/eligibility")
        assert res.json()["reason"] == "ยังไม่ผ่านแบบทดสอบสุดท้าย"

    def test_eligible_with_final_score(self, learner_client, db, learner_user):
        course = make_course(db)
        module = make_module(db, course)
        make_lesson(db, module)
        quiz = make_quiz(db, course=course)
        enroll(db, learner_user, course)
        complete_all_lessons(db, learner_user, course)
        pass_quiz(db, learner_user, quiz, score=85)
        res = learner_client.get(f"/api/certificates/course/{course.id}/eligibility")
        body = res.json()
        assert body["eligible"] is True
        assert body["reason"] is None
        assert body["final_score"] == 85.0


class TestIssue:
    def test_issue_when_eligible(self, learner_client, db, learner_user, fake_pdf_render):
        course = completed_course(db, learner_user)
        res = learner_client.post(f"/api/certificates/course/{course.id}/issue")
        assert res.status_code == 201
        body = res.json()
        assert body["certificate_number"].startswith("CERT-")
        assert body["already_existed"] is False
        assert body["expires_at"] is None  # no recertification policy

    def test_reissue_returns_existing(self, learner_client, db, learner_user, fake_pdf_render):
        course = completed_course(db, learner_user)
        first = learner_client.post(f"/api/certificates/course/{course.id}/issue").json()
        second = learner_client.post(f"/api/certificates/course/{course.id}/issue").json()
        assert second["already_existed"] is True
        assert second["certificate_number"] == first["certificate_number"]

    def test_issue_with_recertification_sets_expiry(
        self, learner_client, db, learner_user, fake_pdf_render
    ):
        course = completed_course(db, learner_user, recertify_after_days=365)
        res = learner_client.post(f"/api/certificates/course/{course.id}/issue")
        assert res.json()["expires_at"] is not None

    def test_issue_denied_when_ineligible(self, learner_client, db):
        course = make_course(db)
        res = learner_client.post(f"/api/certificates/course/{course.id}/issue")
        assert res.status_code == 400
        assert res.json()["detail"] == "ยังไม่ได้ลงทะเบียนหลักสูตรนี้"

    def test_unknown_course(self, learner_client):
        res = learner_client.post("/api/certificates/course/99999/issue")
        assert res.status_code == 404
        assert res.json()["detail"] == "ไม่พบหลักสูตร"


class TestMyCertificates:
    def test_list_shape(self, learner_client, db, learner_user, fake_pdf_render):
        course = completed_course(db, learner_user)
        learner_client.post(f"/api/certificates/course/{course.id}/issue")
        res = learner_client.get("/api/certificates/me")
        assert res.status_code == 200
        rows = res.json()
        assert len(rows) == 1
        assert rows[0]["course"]["title"] == course.title
        assert rows[0]["is_expired"] is False
        assert rows[0]["is_revoked"] is False


class TestDownload:
    def _issued_cert_id(self, client, db, user, fake_pdf_render):
        course = completed_course(db, user)
        client.post(f"/api/certificates/course/{course.id}/issue")
        return client.get("/api/certificates/me").json()[0]["id"]

    def test_owner_can_download(self, learner_client, db, learner_user, fake_pdf_render):
        cert_id = self._issued_cert_id(learner_client, db, learner_user, fake_pdf_render)
        res = learner_client.get(f"/api/certificates/{cert_id}/download")
        assert res.status_code == 200
        assert res.headers["content-type"] == "application/pdf"

    def test_other_learner_denied(self, learner_client, db, learner_user, fake_pdf_render):
        cert_id = self._issued_cert_id(learner_client, db, learner_user, fake_pdf_render)
        other = auth_client(make_user(db, username="snoop1"))
        res = other.get(f"/api/certificates/{cert_id}/download")
        assert res.status_code == 403
        assert res.json()["detail"] == "ไม่มีสิทธิ์ดูใบรับรองนี้"

    def test_unknown_cert(self, learner_client):
        res = learner_client.get("/api/certificates/99999/download")
        assert res.status_code == 404
        assert res.json()["detail"] == "ไม่พบใบรับรอง"


class TestVerify:
    def _issue(self, client, db, user, fake_pdf_render, **course_kw):
        course = completed_course(db, user, **course_kw)
        return client.post(f"/api/certificates/course/{course.id}/issue").json()

    def test_valid_certificate(self, client, learner_client, db, learner_user, fake_pdf_render):
        cert = self._issue(learner_client, db, learner_user, fake_pdf_render)
        res = client.get(f"/api/certificates/verify/{cert['certificate_number']}")
        assert res.status_code == 200
        body = res.json()
        assert body["status"] == "valid"
        assert body["holder_name"] == learner_user.full_name
        # PII must not leak on the public endpoint.
        assert "email" not in body
        assert "department" not in body

    def test_normalizes_case_and_whitespace(
        self, client, learner_client, db, learner_user, fake_pdf_render
    ):
        cert = self._issue(learner_client, db, learner_user, fake_pdf_render)
        res = client.get(
            f"/api/certificates/verify/ {cert['certificate_number'].lower()} "
        )
        assert res.json()["status"] == "valid"

    def test_not_found_is_200(self, client, db):
        res = client.get("/api/certificates/verify/CERT-19990101-FFFFFF")
        assert res.status_code == 200
        assert res.json()["status"] == "not_found"

    def test_rate_limited_after_30(self, client, db):
        for _ in range(30):
            assert client.get("/api/certificates/verify/CERT-X").status_code == 200
        res = client.get("/api/certificates/verify/CERT-X")
        assert res.status_code == 429
        assert res.json()["detail"] == "ตรวจสอบบ่อยเกินไป — กรุณาลองใหม่อีกครั้งในอีก 1 นาที"


class TestRevoke:
    def _issued(self, learner_client, db, learner_user, fake_pdf_render):
        course = completed_course(db, learner_user)
        learner_client.post(f"/api/certificates/course/{course.id}/issue")
        return learner_client.get("/api/certificates/me").json()[0]

    def test_admin_revokes_and_unrevokes(
        self, admin_client, client, learner_client, db, learner_user, fake_pdf_render
    ):
        cert = self._issued(learner_client, db, learner_user, fake_pdf_render)
        res = admin_client.post(
            f"/api/certificates/{cert['id']}/revoke", json={"reason": "ออกผิดคน"}
        )
        assert res.status_code == 200
        assert res.json()["is_revoked"] is True

        res = client.get(f"/api/certificates/verify/{cert['certificate_number']}")
        assert res.json()["status"] == "revoked"

        res = admin_client.post(f"/api/certificates/{cert['id']}/unrevoke")
        assert res.json()["is_revoked"] is False
        res = client.get(f"/api/certificates/verify/{cert['certificate_number']}")
        assert res.json()["status"] == "valid"

    def test_learner_cannot_revoke(
        self, learner_client, db, learner_user, fake_pdf_render
    ):
        cert = self._issued(learner_client, db, learner_user, fake_pdf_render)
        res = learner_client.post(
            f"/api/certificates/{cert['id']}/revoke", json={"reason": "x"}
        )
        assert res.status_code == 403
        assert res.json()["detail"] == "ต้องเป็นผู้ดูแลระบบเท่านั้น"

    def test_instructor_cannot_revoke(
        self, instructor_client, learner_client, db, learner_user, fake_pdf_render
    ):
        cert = self._issued(learner_client, db, learner_user, fake_pdf_render)
        res = instructor_client.post(
            f"/api/certificates/{cert['id']}/revoke", json={"reason": "x"}
        )
        assert res.status_code == 403


class TestAdminList:
    def test_admin_only(self, learner_client, admin_client, db):
        res = learner_client.get("/api/certificates/admin/all")
        assert res.status_code == 403

        res = admin_client.get("/api/certificates/admin/all")
        assert res.status_code == 200
        assert res.json() == []
