"""Characterization tests for /api/admin/cert-settings."""
import io


class TestGetSettings:
    def test_lazy_singleton_with_defaults(self, admin_client):
        res = admin_client.get("/api/admin/cert-settings")
        assert res.status_code == 200
        body = res.json()
        assert body["organization_name"] == "กรมป่าไม้"
        assert body["left_signer_name"] == ""
        assert body["signature_mode"] == "two"
        assert body["left_signer_image"] is None

    def test_learner_denied(self, learner_client):
        res = learner_client.get("/api/admin/cert-settings")
        assert res.status_code == 403
        assert res.json()["detail"] == "ต้องเป็นผู้ดูแลระบบเท่านั้น"


class TestUpdateSettings:
    def test_partial_update_persists(self, admin_client):
        res = admin_client.put(
            "/api/admin/cert-settings",
            json={
                "left_signer_name": "นายสมชาย ใจดี",
                "left_signer_title": "อธิบดีกรมป่าไม้",
                "signature_mode": "one",
            },
        )
        assert res.status_code == 200
        body = res.json()
        assert body["left_signer_name"] == "นายสมชาย ใจดี"
        assert body["signature_mode"] == "one"
        # Untouched fields keep their values.
        assert body["organization_name"] == "กรมป่าไม้"

        body = admin_client.get("/api/admin/cert-settings").json()
        assert body["left_signer_name"] == "นายสมชาย ใจดี"

    def test_invalid_signature_mode(self, admin_client):
        res = admin_client.put(
            "/api/admin/cert-settings", json={"signature_mode": "three"}
        )
        assert res.status_code == 422


class TestSignatureUpload:
    def test_upload_and_delete_png(self, admin_client):
        png_stub = b"\x89PNG\r\n\x1a\n" + b"0" * 32
        res = admin_client.post(
            "/api/admin/cert-settings/upload-signature/left",
            files={"file": ("sig.png", io.BytesIO(png_stub), "image/png")},
        )
        assert res.status_code == 200
        url = res.json()["left_signer_image"]
        assert url and url.startswith("/images/signatures/")

        res = admin_client.delete("/api/admin/cert-settings/signature/left")
        assert res.status_code == 200
        assert res.json()["left_signer_image"] is None

    def test_non_png_rejected(self, admin_client):
        res = admin_client.post(
            "/api/admin/cert-settings/upload-signature/left",
            files={"file": ("sig.jpg", io.BytesIO(b"xx"), "image/jpeg")},
        )
        assert res.status_code == 400
        assert res.json()["detail"] == "รองรับเฉพาะไฟล์ PNG เท่านั้น"
