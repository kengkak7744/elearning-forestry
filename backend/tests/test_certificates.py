"""Characterization tests for /api/certificates — eligibility, issuance,
public verification (+ rate limit), revocation, download."""
from datetime import datetime, timezone

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


class TestRecertification:
    """Expired cert → must retake the course before a new cert issues."""

    def _expired_setup(self, db, user):
        """A recertifiable course completed long ago, with a now-expired cert.
        Lesson completion + final pass are dated before the cert lapsed (stale)."""
        from datetime import timedelta
        from app.models.certificate import Certificate
        from app.models.progress import LessonProgress
        from app.models.quiz import QuizAttempt

        long_ago = datetime.now(timezone.utc) - timedelta(days=400)
        lapsed = datetime.now(timezone.utc) - timedelta(days=35)

        course = make_course(db, recertify_after_days=365)
        module = make_module(db, course)
        lesson = make_lesson(db, module)
        quiz = make_quiz(db, course=course)
        enroll(db, user, course)
        db.add(LessonProgress(
            user_id=user.id, lesson_id=lesson.id, completed=True, completed_at=long_ago,
        ))
        db.add(QuizAttempt(
            user_id=user.id, quiz_id=quiz.id, score=90, answers={},
            is_passed=True, attempted_at=long_ago,
        ))
        db.add(Certificate(
            user_id=user.id, course_id=course.id, certificate_number="CERT-OLD-000001",
            final_score=90, issued_at=long_ago, expires_at=lapsed,
        ))
        db.commit()
        return course, lesson, quiz

    def test_expired_cert_is_not_renewable_on_stale_progress(
        self, learner_client, db, learner_user
    ):
        course, _, _ = self._expired_setup(db, learner_user)
        body = learner_client.get(
            f"/api/certificates/course/{course.id}/eligibility"
        ).json()
        assert body["is_expired"] is True
        assert body["needs_recertification"] is True
        # The original completion predates the lapse, so it no longer counts.
        assert body["eligible"] is False
        assert "เรียนยังไม่ครบ" in body["reason"]

    def test_issue_blocked_before_retake(self, learner_client, db, learner_user):
        course, _, _ = self._expired_setup(db, learner_user)
        res = learner_client.post(f"/api/certificates/course/{course.id}/issue")
        assert res.status_code == 400

    def test_recertify_then_renew(
        self, learner_client, db, learner_user, fake_pdf_render
    ):
        from app.models.progress import LessonProgress
        from app.models.quiz import QuizAttempt

        course, lesson, quiz = self._expired_setup(db, learner_user)

        # Start the retake — stale completion gets reset.
        res = learner_client.post(f"/api/certificates/course/{course.id}/recertify")
        assert res.status_code == 200
        assert res.json()["reset_lessons"] == 1

        prog = (
            db.query(LessonProgress)
            .filter_by(user_id=learner_user.id, lesson_id=lesson.id)
            .first()
        )
        assert prog.completed is False

        # Re-watch the lesson + re-pass the final (fresh, post-lapse timestamps).
        prog.completed = True
        prog.completed_at = datetime.now(timezone.utc)
        db.add(QuizAttempt(
            user_id=learner_user.id, quiz_id=quiz.id, score=88, answers={},
            is_passed=True, attempted_at=datetime.now(timezone.utc),
        ))
        db.commit()

        body = learner_client.get(
            f"/api/certificates/course/{course.id}/eligibility"
        ).json()
        assert body["eligible"] is True

        res = learner_client.post(f"/api/certificates/course/{course.id}/issue")
        assert res.status_code == 201
        assert res.json()["already_existed"] is False
        assert res.json()["expires_at"] is not None

    def test_recertify_requires_an_expired_cert(
        self, learner_client, db, learner_user, fake_pdf_render
    ):
        # Freshly completed, no expired cert → nothing to recertify.
        course = completed_course(db, learner_user, recertify_after_days=365)
        res = learner_client.post(f"/api/certificates/course/{course.id}/recertify")
        assert res.status_code == 400
        assert res.json()["detail"] == "ไม่มีใบรับรองที่หมดอายุสำหรับหลักสูตรนี้"


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

    def test_admin_can_download_another_users_certificate(
        self, admin_client, learner_client, db, learner_user, fake_pdf_render
    ):
        cert_id = self._issued_cert_id(learner_client, db, learner_user, fake_pdf_render)
        res = admin_client.get(f"/api/certificates/{cert_id}/download")
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
