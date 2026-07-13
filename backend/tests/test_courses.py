"""Characterization tests for /api/courses (catalog, enrollment, bookmarks)."""
import pytest
from sqlalchemy.orm import Session as SQLAlchemySession

from tests.factories import enroll, make_course, make_lesson, make_module, make_question, make_quiz
from app.models.certificate import Certificate
from app.models.course import Course
from app.models.lesson import ContentType, LessonResource
from app.models.quiz import QuizPlacement
from app.routers import courses as courses_router


def course_payload(**overrides):
    payload = {
        "title": "หลักสูตรใหม่",
        "description": "รายละเอียด",
        "category": "technical",
        "is_mandatory": False,
        "is_published": True,
    }
    payload.update(overrides)
    return payload


class TestCreateUpdateDelete:
    def test_admin_creates_course(self, admin_client):
        res = admin_client.post("/api/courses", json=course_payload())
        assert res.status_code == 201
        body = res.json()
        assert body["title"] == "หลักสูตรใหม่"
        assert body["total_modules"] == 0
        assert body["enrolled_count"] == 0

    def test_instructor_allowed(self, instructor_client):
        res = instructor_client.post("/api/courses", json=course_payload())
        assert res.status_code == 201

    def test_learner_denied(self, learner_client):
        res = learner_client.post("/api/courses", json=course_payload())
        assert res.status_code == 403
        assert res.json()["detail"] == "ต้องเป็นวิทยากรหรือผู้ดูแลระบบเท่านั้น"

    def test_update_course(self, admin_client, db):
        course = make_course(db)
        res = admin_client.put(
            f"/api/courses/{course.id}", json={"title": "ชื่อใหม่กว่าเดิม"}
        )
        assert res.status_code == 200
        assert res.json()["title"] == "ชื่อใหม่กว่าเดิม"

    def test_update_unknown_course(self, admin_client):
        res = admin_client.put("/api/courses/99999", json={"title": "ไม่มีอยู่จริง"})
        assert res.status_code == 404
        assert res.json()["detail"] == "ไม่พบหลักสูตร"

    def test_delete_course(self, admin_client, db):
        course = make_course(db)
        res = admin_client.delete(f"/api/courses/{course.id}")
        assert res.status_code == 200
        assert res.json()["message"] == f"ลบหลักสูตร '{course.title}' เรียบร้อย"

    def test_delete_course_with_certificate(self, admin_client, db, learner_user):
        course = make_course(db)
        certificate = Certificate(
            user_id=learner_user.id,
            course_id=course.id,
            certificate_number='CERT-DELETE-000001',
        )
        db.add(certificate)
        db.commit()
        course_id = course.id
        certificate_id = certificate.id

        res = admin_client.delete(f'/api/courses/{course_id}')

        assert res.status_code == 200
        db.expire_all()
        assert db.get(Course, course_id) is None
        assert db.get(Certificate, certificate_id) is None

    def test_delete_course_removes_owned_local_files(
        self, admin_client, db, learner_user, tmp_path, monkeypatch
    ):
        video_dir = tmp_path / "videos"
        pdf_dir = tmp_path / "pdfs"
        image_dir = tmp_path / "images"
        cert_dir = tmp_path / "certificates"
        for directory in (video_dir, pdf_dir, image_dir, cert_dir):
            directory.mkdir()

        monkeypatch.setattr(courses_router, "_VIDEO_DIR", video_dir)
        monkeypatch.setattr(courses_router, "_PDF_DIR", pdf_dir)
        monkeypatch.setattr(courses_router, "IMAGE_DIR", image_dir)
        monkeypatch.setattr(courses_router, "_CERT_DIR", cert_dir)

        course = make_course(db, cover_image="/elearning/images/cover.png")
        module = make_module(db, course)
        make_lesson(
            db,
            module,
            content_url="/videos/lesson.mp4",
            caption_url="/elearning/videos/lesson.vtt",
        )
        make_lesson(
            db,
            module,
            content_type=ContentType.PDF,
            content_url="/elearning/pdfs/handbook.pdf",
            order_index=1,
        )
        certificate_path = cert_dir / "CERT-FILES.pdf"
        db.add(Certificate(
            user_id=learner_user.id,
            course_id=course.id,
            certificate_number="CERT-FILES-000001",
            pdf_path=str(certificate_path),
        ))
        db.commit()

        owned_paths = [
            video_dir / "lesson.mp4",
            video_dir / "lesson.vtt",
            pdf_dir / "handbook.pdf",
            image_dir / "cover.png",
            certificate_path,
        ]
        for path in owned_paths:
            path.write_bytes(b"owned")
        sentinels = [
            video_dir / "keep.mp4",
            pdf_dir / "keep.pdf",
            image_dir / "keep.png",
            cert_dir / "keep.pdf",
        ]
        for path in sentinels:
            path.write_bytes(b"keep")

        res = admin_client.delete(f"/api/courses/{course.id}")

        assert res.status_code == 200
        assert all(not path.exists() for path in owned_paths)
        assert all(path.exists() for path in sentinels)

    def test_delete_course_preserves_shared_files(
        self, admin_client, db, tmp_path, monkeypatch
    ):
        video_dir = tmp_path / "videos"
        image_dir = tmp_path / "images"
        video_dir.mkdir()
        image_dir.mkdir()
        monkeypatch.setattr(courses_router, "_VIDEO_DIR", video_dir)
        monkeypatch.setattr(courses_router, "IMAGE_DIR", image_dir)

        shared_video = video_dir / "shared.mp4"
        shared_cover = image_dir / "shared.png"
        shared_video.write_bytes(b"video")
        shared_cover.write_bytes(b"cover")

        doomed = make_course(db, cover_image="/images/shared.png")
        doomed_module = make_module(db, doomed)
        make_lesson(db, doomed_module, content_url="/videos/shared.mp4")

        keeper = make_course(db, title="keeper", cover_image="/elearning/images/shared.png")
        keeper_module = make_module(db, keeper)
        keeper_lesson = make_lesson(
            db, keeper_module, content_url="https://example.com/video"
        )
        db.add(LessonResource(
            lesson_id=keeper_lesson.id,
            title="shared video",
            url="/elearning/videos/shared.mp4",
        ))
        db.commit()

        res = admin_client.delete(f"/api/courses/{doomed.id}")

        assert res.status_code == 200
        assert shared_video.exists()
        assert shared_cover.exists()

    def test_delete_course_keeps_files_when_commit_fails(
        self, admin_client, db, tmp_path, monkeypatch
    ):
        video_dir = tmp_path / "videos"
        video_dir.mkdir()
        monkeypatch.setattr(courses_router, "_VIDEO_DIR", video_dir)
        course = make_course(db)
        module = make_module(db, course)
        make_lesson(db, module, content_url="/videos/lesson.mp4")
        video_path = video_dir / "lesson.mp4"
        video_path.write_bytes(b"video")

        def fail_commit(_session):
            raise RuntimeError("commit failed")

        monkeypatch.setattr(SQLAlchemySession, "commit", fail_commit)

        with pytest.raises(RuntimeError, match="commit failed"):
            admin_client.delete(f"/api/courses/{course.id}")

        assert video_path.exists()
        db.expire_all()
        assert db.get(Course, course.id) is not None

    def test_duplicate_course(self, admin_client, db):
        course = make_course(db, title="ต้นฉบับ")
        module = make_module(db, course)
        make_lesson(db, module)
        res = admin_client.post(f"/api/courses/{course.id}/duplicate")
        assert res.status_code == 201
        body = res.json()
        assert body["title"] == "[สำเนา] ต้นฉบับ"

        # Clone is a draft with the same structure.
        clone = admin_client.get(f"/api/courses/{body['id']}").json()
        assert clone["is_published"] is False
        assert clone["total_lessons"] == 1


class TestVisibility:
    def test_learner_sees_only_published(self, learner_client, db):
        published = make_course(db, title="เผยแพร่แล้ว")
        make_course(db, title="ฉบับร่าง", published=False)
        res = learner_client.get("/api/courses")
        assert res.status_code == 200
        titles = [c["title"] for c in res.json()]
        assert titles == [published.title]

    def test_admin_sees_drafts(self, admin_client, db):
        make_course(db, title="เผยแพร่แล้ว")
        make_course(db, title="ฉบับร่าง", published=False)
        res = admin_client.get("/api/courses")
        assert len(res.json()) == 2

    def test_draft_detail_hidden_from_learner(self, learner_client, admin_client, db):
        draft = make_course(db, published=False)
        res = learner_client.get(f"/api/courses/{draft.id}")
        assert res.status_code == 404
        assert res.json()["detail"] == "ไม่พบหลักสูตร"

        res = admin_client.get(f"/api/courses/{draft.id}")
        assert res.status_code == 200

    def test_detail_shape(self, learner_client, db, learner_user):
        course = make_course(db)
        module = make_module(db, course)
        make_lesson(db, module)
        enroll(db, learner_user, course)
        res = learner_client.get(f"/api/courses/{course.id}")
        assert res.status_code == 200
        body = res.json()
        assert body["total_modules"] == 1
        assert body["total_lessons"] == 1
        assert body["enrolled_count"] == 1
        assert body["is_enrolled"] is True
        assert body["is_bookmarked"] is False
        assert len(body["modules"][0]["lessons"]) == 1

    def test_detail_embeds_learner_safe_lesson_quizzes(self, learner_client, db, learner_user):
        course = make_course(db)
        module = make_module(db, course)
        lesson = make_lesson(db, module)
        quiz = make_quiz(
            db,
            lesson=lesson,
            placement=QuizPlacement.MID_VIDEO,
            trigger_time=20,
        )
        make_question(db, quiz)
        enroll(db, learner_user, course)

        res = learner_client.get(f"/api/courses/{course.id}")

        assert res.status_code == 200
        lesson_body = res.json()["modules"][0]["lessons"][0]
        embedded = lesson_body["quizzes"][0]
        assert embedded["placement"] == "mid_video"
        assert embedded["trigger_time"] == 20
        assert embedded["questions"][0]["correct_text"] is None
        assert set(embedded["questions"][0]["choices"][0].keys()) == {"text"}

    def test_search_filter(self, learner_client, db):
        make_course(db, title="การดับไฟป่าเบื้องต้น")
        make_course(db, title="ความปลอดภัยทั่วไป")
        res = learner_client.get("/api/courses", params={"search": "ไฟป่า"})
        titles = [c["title"] for c in res.json()]
        assert titles == ["การดับไฟป่าเบื้องต้น"]

    def test_list_reports_enrolled_count(self, learner_client, db, learner_user):
        """The catalog list must carry per-course enrollment counts, not the
        schema default of 0 — regression for the admin 'ผู้ลงทะเบียน' column."""
        enrolled = make_course(db, title="มีผู้ลงทะเบียน")
        make_course(db, title="ยังไม่มีผู้ลงทะเบียน")
        enroll(db, learner_user, enrolled)

        rows = {c["title"]: c["enrolled_count"] for c in learner_client.get("/api/courses").json()}
        assert rows["มีผู้ลงทะเบียน"] == 1
        assert rows["ยังไม่มีผู้ลงทะเบียน"] == 0


class TestEnrollment:
    def test_enroll(self, learner_client, db):
        course = make_course(db)
        res = learner_client.post(f"/api/courses/{course.id}/enroll")
        assert res.status_code == 201
        assert res.json()["message"] == f"ลงทะเบียนหลักสูตร '{course.title}' สำเร็จ"

    def test_enroll_twice(self, learner_client, db, learner_user):
        course = make_course(db)
        enroll(db, learner_user, course)
        res = learner_client.post(f"/api/courses/{course.id}/enroll")
        assert res.status_code == 400
        assert res.json()["detail"] == "คุณลงทะเบียนหลักสูตรนี้แล้ว"

    def test_enroll_draft_hidden_from_learner(self, learner_client, db):
        draft = make_course(db, published=False)
        res = learner_client.post(f"/api/courses/{draft.id}/enroll")
        assert res.status_code == 404

    def test_unenroll(self, learner_client, db, learner_user):
        course = make_course(db)
        enroll(db, learner_user, course)
        res = learner_client.delete(f"/api/courses/{course.id}/enroll")
        assert res.status_code == 200
        assert res.json()["message"] == "ยกเลิกการลงทะเบียนเรียบร้อย"

    def test_unenroll_when_not_enrolled(self, learner_client, db):
        course = make_course(db)
        res = learner_client.delete(f"/api/courses/{course.id}/enroll")
        assert res.status_code == 404
        assert res.json()["detail"] == "คุณยังไม่ได้ลงทะเบียนหลักสูตรนี้"

    def test_my_enrollments_progress(self, learner_client, db, learner_user):
        course = make_course(db)
        module = make_module(db, course)
        make_lesson(db, module)
        make_lesson(db, module, title="บทเรียนที่ 2", order_index=1)
        enroll(db, learner_user, course)
        res = learner_client.get("/api/courses/me/enrollments")
        assert res.status_code == 200
        rows = res.json()
        assert len(rows) == 1
        assert rows[0]["total_lessons"] == 2
        assert rows[0]["completed_lessons"] == 0
        assert rows[0]["progress_percent"] == 0


class TestBookmarks:
    def test_add_and_list(self, learner_client, db):
        course = make_course(db)
        res = learner_client.post(f"/api/courses/{course.id}/bookmark")
        assert res.status_code == 201
        assert res.json() == {"message": "บันทึกหลักสูตรไว้แล้ว", "is_bookmarked": True}

        # Idempotent re-add.
        res = learner_client.post(f"/api/courses/{course.id}/bookmark")
        assert res.status_code == 201

        rows = learner_client.get("/api/courses/me/bookmarks").json()
        assert [c["id"] for c in rows] == [course.id]

    def test_remove_idempotent(self, learner_client, db):
        course = make_course(db)
        res = learner_client.delete(f"/api/courses/{course.id}/bookmark")
        assert res.status_code == 200
        assert res.json() == {"message": "ยกเลิกการบันทึกเรียบร้อย", "is_bookmarked": False}
