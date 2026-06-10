"""Characterization tests for course feedback (completion-gated ratings)."""
from tests.factories import completed_course, make_course


class TestSubmitFeedback:
    def test_blocked_before_completion(self, learner_client, db):
        course = make_course(db)
        res = learner_client.post(
            f"/api/courses/{course.id}/feedback", json={"rating": 5}
        )
        assert res.status_code == 400
        assert res.json()["detail"] == "ยังไม่ได้ลงทะเบียนหลักสูตรนี้"

    def test_submit_after_completion(self, learner_client, db, learner_user):
        course = completed_course(db, learner_user)
        res = learner_client.post(
            f"/api/courses/{course.id}/feedback",
            json={"rating": 4, "comment": "  เนื้อหาดีมาก  "},
        )
        assert res.status_code == 201
        body = res.json()
        assert body["rating"] == 4
        assert body["comment"] == "เนื้อหาดีมาก"  # trimmed

    def test_upsert_overwrites(self, learner_client, db, learner_user):
        course = completed_course(db, learner_user)
        first = learner_client.post(
            f"/api/courses/{course.id}/feedback", json={"rating": 2}
        ).json()
        second = learner_client.post(
            f"/api/courses/{course.id}/feedback", json={"rating": 5, "comment": ""}
        ).json()
        assert second["id"] == first["id"]
        assert second["rating"] == 5
        assert second["comment"] is None  # empty string normalised to null

    def test_unknown_course(self, learner_client):
        res = learner_client.post("/api/courses/99999/feedback", json={"rating": 3})
        assert res.status_code == 404
        assert res.json()["detail"] == "ไม่พบหลักสูตร"


class TestMyFeedback:
    def test_before_completion(self, learner_client, db):
        course = make_course(db)
        res = learner_client.get(f"/api/courses/{course.id}/feedback/me")
        assert res.status_code == 200
        body = res.json()
        assert body["has_feedback"] is False
        assert body["can_submit"] is False
        assert body["blocked_reason"] == "ยังไม่ได้ลงทะเบียนหลักสูตรนี้"

    def test_after_submission(self, learner_client, db, learner_user):
        course = completed_course(db, learner_user)
        learner_client.post(f"/api/courses/{course.id}/feedback", json={"rating": 4})
        body = learner_client.get(f"/api/courses/{course.id}/feedback/me").json()
        assert body["has_feedback"] is True
        assert body["rating"] == 4
        assert body["can_submit"] is True
        assert body["blocked_reason"] is None


class TestSummary:
    def test_distribution(self, learner_client, db, learner_user):
        course = completed_course(db, learner_user)
        learner_client.post(f"/api/courses/{course.id}/feedback", json={"rating": 4})
        res = learner_client.get(f"/api/courses/{course.id}/feedback/summary")
        assert res.status_code == 200
        assert res.json() == {
            "count": 1,
            "average": 4.0,
            "distribution": [0, 0, 0, 1, 0],
        }

    def test_empty_summary(self, learner_client, db):
        course = make_course(db)
        res = learner_client.get(f"/api/courses/{course.id}/feedback/summary")
        assert res.json() == {"count": 0, "average": None, "distribution": [0, 0, 0, 0, 0]}

    def test_draft_course_hidden_from_learner(self, learner_client, db):
        course = make_course(db, published=False)
        res = learner_client.get(f"/api/courses/{course.id}/feedback/summary")
        assert res.status_code == 404


class TestListFeedback:
    def test_admin_sees_authors(self, admin_client, learner_client, db, learner_user):
        course = completed_course(db, learner_user)
        learner_client.post(
            f"/api/courses/{course.id}/feedback",
            json={"rating": 3, "comment": "พอใช้"},
        )
        res = admin_client.get(f"/api/courses/{course.id}/feedback")
        assert res.status_code == 200
        rows = res.json()
        assert len(rows) == 1
        assert rows[0]["user"]["full_name"] == learner_user.full_name

    def test_learner_denied(self, learner_client, db):
        course = make_course(db)
        res = learner_client.get(f"/api/courses/{course.id}/feedback")
        assert res.status_code == 403
        assert res.json()["detail"] == "ไม่มีสิทธิ์เข้าถึง"

    def test_instructor_allowed(self, instructor_client, db):
        course = make_course(db)
        res = instructor_client.get(f"/api/courses/{course.id}/feedback")
        assert res.status_code == 200
