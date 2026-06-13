"""Characterization tests for /api/courses (catalog, enrollment, bookmarks)."""
from tests.factories import enroll, make_course, make_lesson, make_module


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
