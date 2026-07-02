"""Characterization tests for /api/categories (dynamic course categories)."""
from tests.factories import make_course


class TestListCategories:
    def test_requires_auth(self, client):
        res = client.get("/api/categories")
        assert res.status_code == 401

    def test_learner_sees_seeded_categories(self, learner_client):
        res = learner_client.get("/api/categories")
        assert res.status_code == 200
        values = [c["value"] for c in res.json()]
        assert values == ["compliance", "technical", "safety", "skill"]

    def test_course_count_reflects_usage(self, admin_client, db):
        make_course(db, category="safety")
        make_course(db, category="safety")
        res = admin_client.get("/api/categories")
        counts = {c["value"]: c["course_count"] for c in res.json()}
        assert counts["safety"] == 2
        assert counts["technical"] == 0


class TestCreateCategory:
    def test_instructor_creates(self, instructor_client):
        res = instructor_client.post("/api/categories", json={"label": "การจัดการไฟป่า"})
        assert res.status_code == 201
        body = res.json()
        assert body["label"] == "การจัดการไฟป่า"
        # New categories store the Thai name in both fields.
        assert body["value"] == "การจัดการไฟป่า"
        assert body["course_count"] == 0

    def test_learner_denied(self, learner_client):
        res = learner_client.post("/api/categories", json={"label": "แอบเพิ่ม"})
        assert res.status_code == 403

    def test_manager_denied(self, manager_client):
        res = manager_client.post("/api/categories", json={"label": "แอบเพิ่ม"})
        assert res.status_code == 403

    def test_duplicate_rejected(self, admin_client):
        assert admin_client.post("/api/categories", json={"label": "ซ้ำ"}).status_code == 201
        res = admin_client.post("/api/categories", json={"label": "ซ้ำ"})
        assert res.status_code == 400
        assert res.json()["detail"] == "มีหมวดหมู่นี้อยู่แล้ว"

    def test_duplicate_of_legacy_label_rejected(self, admin_client):
        res = admin_client.post("/api/categories", json={"label": "ความปลอดภัย"})
        assert res.status_code == 400

    def test_blank_label_rejected(self, admin_client):
        res = admin_client.post("/api/categories", json={"label": "   "})
        assert res.status_code == 400

    def test_new_category_usable_on_course(self, admin_client):
        admin_client.post("/api/categories", json={"label": "หมวดใหม่"})
        res = admin_client.post("/api/courses", json={
            "title": "หลักสูตรหมวดใหม่",
            "category": "หมวดใหม่",
        })
        assert res.status_code == 201
        assert res.json()["category"] == "หมวดใหม่"

    def test_unknown_category_rejected_on_course(self, admin_client):
        res = admin_client.post("/api/courses", json={
            "title": "หลักสูตรหมวดผี",
            "category": "ไม่มีอยู่จริง",
        })
        assert res.status_code == 400
        assert res.json()["detail"] == "ไม่พบหมวดหมู่นี้ กรุณาเลือกจากรายการหมวดหมู่"


class TestDeleteCategory:
    def _id_of(self, client, value):
        return next(c["id"] for c in client.get("/api/categories").json() if c["value"] == value)

    def test_delete_unused(self, admin_client):
        admin_client.post("/api/categories", json={"label": "ชั่วคราว"})
        cat_id = self._id_of(admin_client, "ชั่วคราว")
        res = admin_client.delete(f"/api/categories/{cat_id}")
        assert res.status_code == 200
        values = [c["value"] for c in admin_client.get("/api/categories").json()]
        assert "ชั่วคราว" not in values

    def test_delete_in_use_blocked(self, admin_client, db):
        make_course(db, category="skill")
        cat_id = self._id_of(admin_client, "skill")
        res = admin_client.delete(f"/api/categories/{cat_id}")
        assert res.status_code == 400
        assert "มีหลักสูตรใช้หมวดหมู่นี้อยู่" in res.json()["detail"]

    def test_learner_denied(self, learner_client, admin_client):
        cat_id = self._id_of(admin_client, "technical")
        res = learner_client.delete(f"/api/categories/{cat_id}")
        assert res.status_code == 403

    def test_unknown_id(self, admin_client):
        res = admin_client.delete("/api/categories/99999")
        assert res.status_code == 404
        assert res.json()["detail"] == "ไม่พบหมวดหมู่"
