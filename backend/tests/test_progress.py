"""Characterization tests for /api/progress."""
from datetime import datetime, timedelta, timezone

from tests.factories import enroll, make_course, make_lesson, make_module
from app.models.lesson import ContentType
from app.models.progress import LessonProgress


class TestUpdateProgress:
    def _setup(self, db, user=None, **lesson_overrides):
        course = make_course(db)
        module = make_module(db, course)
        lesson = make_lesson(db, module, **lesson_overrides)
        if user is not None:
            enroll(db, user, course)
        return course, lesson

    def test_video_progress_saved(self, learner_client, db, learner_user):
        _, lesson = self._setup(db, learner_user)
        res = learner_client.post(
            "/api/progress/",
            json={"lesson_id": lesson.id, "current_position": 10},
        )
        assert res.status_code == 200
        body = res.json()
        assert body["lesson_id"] == lesson.id
        assert body["current_position"] == 10
        assert body["is_completed"] is False

    def test_client_completion_flag_ignored_until_threshold(self, learner_client, db, learner_user):
        _, lesson = self._setup(db, learner_user, duration_seconds=100)
        res = learner_client.post(
            "/api/progress/",
            json={"lesson_id": lesson.id, "current_position": 100, "is_completed": True},
        )
        assert res.status_code == 200
        body = res.json()
        assert body["current_position"] == 15
        assert body["is_completed"] is False

    def test_completion_is_sticky(self, learner_client, db, learner_user):
        _, lesson = self._setup(db, learner_user, duration_seconds=100)
        first = learner_client.post(
            "/api/progress/",
            json={"lesson_id": lesson.id, "current_position": 100, "is_completed": True},
        )
        assert first.json()["is_completed"] is False

        progress = db.query(LessonProgress).filter(
            LessonProgress.user_id == learner_user.id,
            LessonProgress.lesson_id == lesson.id,
        ).one()
        progress.last_accessed_at = datetime.now(timezone.utc) - timedelta(seconds=100)
        db.commit()

        complete = learner_client.post(
            "/api/progress/",
            json={"lesson_id": lesson.id, "current_position": 100},
        )
        assert complete.json()["is_completed"] is True

        # A later non-completed update must not un-complete the lesson.
        res = learner_client.post(
            "/api/progress/",
            json={"lesson_id": lesson.id, "current_position": 10},
        )
        assert res.json()["is_completed"] is True

    def test_pdf_progress_tracks_page(self, learner_client, db, learner_user):
        course = make_course(db)
        module = make_module(db, course)
        lesson = make_lesson(db, module, content_type=ContentType.PDF, total_pages=10)
        enroll(db, learner_user, course)
        res = learner_client.post(
            "/api/progress/",
            json={"lesson_id": lesson.id, "current_position": 5, "content_type": "pdf"},
        )
        assert res.status_code == 200
        assert res.json()["current_position"] == 5

    def test_unenrolled_learner_denied(self, learner_client, db):
        _, lesson = self._setup(db)
        res = learner_client.post(
            "/api/progress/",
            json={"lesson_id": lesson.id, "current_position": 5},
        )
        assert res.status_code == 403
        assert res.json()["detail"] == "ต้องลงทะเบียนหลักสูตรก่อน"

    def test_admin_exempt_from_enrollment(self, admin_client, db):
        _, lesson = self._setup(db)
        res = admin_client.post(
            "/api/progress/",
            json={"lesson_id": lesson.id, "current_position": 5},
        )
        assert res.status_code == 200

    def test_unknown_lesson(self, learner_client):
        res = learner_client.post(
            "/api/progress/",
            json={"lesson_id": 99999, "current_position": 5},
        )
        assert res.status_code == 404
        assert res.json()["detail"] == "ไม่พบบทเรียน"


class TestCourseProgress:
    def test_lists_my_progress_for_course(self, learner_client, db, learner_user):
        course = make_course(db)
        module = make_module(db, course)
        lesson1 = make_lesson(db, module, duration_seconds=10)
        make_lesson(db, module, title="บทเรียนที่ 2", order_index=1)
        enroll(db, learner_user, course)
        learner_client.post(
            "/api/progress/",
            json={"lesson_id": lesson1.id, "current_position": 30, "is_completed": True},
        )
        progress = db.query(LessonProgress).filter(
            LessonProgress.user_id == learner_user.id,
            LessonProgress.lesson_id == lesson1.id,
        ).one()
        progress.last_accessed_at = datetime.now(timezone.utc) - timedelta(seconds=15)
        db.commit()
        learner_client.post(
            "/api/progress/",
            json={"lesson_id": lesson1.id, "current_position": 30},
        )
        res = learner_client.get(f"/api/progress/course/{course.id}")
        assert res.status_code == 200
        rows = res.json()
        assert len(rows) == 1
        assert rows[0]["lesson_id"] == lesson1.id
        assert rows[0]["is_completed"] is True

    def test_empty_for_untouched_course(self, learner_client, db):
        course = make_course(db)
        res = learner_client.get(f"/api/progress/course/{course.id}")
        assert res.status_code == 200
        assert res.json() == []
