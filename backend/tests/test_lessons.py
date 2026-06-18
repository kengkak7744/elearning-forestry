import io
import uuid

from pypdf import PdfReader, PdfWriter

from app.routers import lessons as lessons_router
from app.routers.lessons import _adaptive_sections, _pdf_sections_paths
from tests.factories import make_course, make_lesson, make_module


def _nested_outline_reader() -> PdfReader:
    """A 6-page PDF whose table of contents nests three levels deep:

        บทที่ 1 (p0)
          1.1 (p1)
            1.1.1 (p2)
          1.2 (p3)
        บทที่ 2 (p4)
          2.1 (p5)
    """
    writer = PdfWriter()
    for _ in range(6):
        writer.add_blank_page(width=200, height=200)
    c1 = writer.add_outline_item("บทที่ 1", 0)
    s11 = writer.add_outline_item("1.1", 1, parent=c1)
    writer.add_outline_item("1.1.1", 2, parent=s11)
    writer.add_outline_item("1.2", 3, parent=c1)
    c2 = writer.add_outline_item("บทที่ 2", 4)
    writer.add_outline_item("2.1", 5, parent=c2)
    buf = io.BytesIO()
    writer.write(buf)
    buf.seek(0)
    return PdfReader(buf)


class TestPdfSplitDepth:
    def test_depth_2_folds_deeper_headings_into_parent(self):
        """Default depth (2): 1.1.1 does NOT start its own section — it stays
        inside the 1.1 lesson, whose page range therefore spans pages 1–2."""
        reader = _nested_outline_reader()
        sections = _pdf_sections_paths(reader, max_depth=2)

        paths = [path for path, _ in sections]
        assert paths == [
            ["บทที่ 1"],
            ["บทที่ 1", "1.1"],
            ["บทที่ 1", "1.2"],
            ["บทที่ 2"],
            ["บทที่ 2", "2.1"],
        ]
        # 1.1 starts at page 1; the next kept section (1.2) starts at page 3,
        # so 1.1 covers pages 1–2 — i.e. it absorbed 1.1.1.
        start_by_leaf = {tuple(path): page for path, page in sections}
        assert start_by_leaf[("บทที่ 1", "1.1")] == 1
        assert start_by_leaf[("บทที่ 1", "1.2")] == 3

    def test_depth_1_keeps_only_top_level(self):
        reader = _nested_outline_reader()
        sections = _pdf_sections_paths(reader, max_depth=1)
        assert [path for path, _ in sections] == [["บทที่ 1"], ["บทที่ 2"]]

    def test_depth_0_means_no_cap(self):
        """The old behaviour: every bookmark at every level becomes a section."""
        reader = _nested_outline_reader()
        sections = _pdf_sections_paths(reader, max_depth=0)
        assert len(sections) == 6


class TestAdaptiveSplitDepth:
    def test_reduces_depth_when_over_limit(self):
        """depth-2 yields 5 sections; a cap of 3 forces a drop to depth-1 (the
        two top-level chapters), mirroring the 182 MB manual that explodes into
        101 level-2 lessons and is pulled back to 20 chapter lessons."""
        reader = _nested_outline_reader()
        secs = _adaptive_sections(reader, max_depth=2, max_sections=3)
        assert [path for path, _ in secs] == [["บทที่ 1"], ["บทที่ 2"]]

    def test_keeps_depth_when_within_limit(self):
        reader = _nested_outline_reader()
        secs = _adaptive_sections(reader, max_depth=2, max_sections=50)
        assert len(secs) == 5

    def test_zero_limit_disables_reduction(self):
        reader = _nested_outline_reader()
        secs = _adaptive_sections(reader, max_depth=2, max_sections=0)
        assert len(secs) == 5


class TestChunkedPdfSplitUpload:
    def test_module_split_completes_from_uploaded_chunks(self, admin_client, db, monkeypatch):
        course = make_course(db)
        module = make_module(db, course)
        upload_id = str(uuid.uuid4())
        payload = b"%PDF-1.4 chunked upload"

        def fake_split(path):
            assert path.read_bytes() == payload
            return [{"path": ["บทที่ 1"], "content_url": "/pdfs/chunked.pdf", "total_pages": 2}]

        monkeypatch.setattr(lessons_router, "_split_pdf_file", fake_split)

        chunks = [payload[:10], payload[10:]]
        for idx, chunk in enumerate(chunks):
            res = admin_client.post(
                f"/api/lessons/split-pdf/uploads/{upload_id}/chunks",
                data={
                    "chunk_index": str(idx),
                    "total_chunks": str(len(chunks)),
                    "total_size": str(len(payload)),
                    "filename": "manual.pdf",
                },
                files={"file": ("chunk.bin", chunk, "application/octet-stream")},
            )
            assert res.status_code == 200
            assert res.json()["received_chunks"] == idx + 1

        res = admin_client.post(
            f"/api/lessons/module/{module.id}/split-pdf/uploads/{upload_id}/complete"
        )

        assert res.status_code == 200
        body = res.json()
        assert body["created_count"] == 1
        assert body["lessons"][0]["title"] == "บทที่ 1"
        assert body["lessons"][0]["content_url"] == "/pdfs/chunked.pdf"
        assert not lessons_router._split_upload_dir(upload_id).exists()

    def test_course_split_completes_from_uploaded_chunks(self, admin_client, db, monkeypatch):
        course = make_course(db)
        upload_id = str(uuid.uuid4())
        payload = b"%PDF-1.4 course chunks"

        def fake_split(path):
            assert path.read_bytes() == payload
            return [
                {"path": ["บทที่ 1"], "content_url": "/pdfs/chapter-1.pdf", "total_pages": 1},
                {"path": ["บทที่ 1", "1.1"], "content_url": "/pdfs/chapter-1-1.pdf", "total_pages": 3},
                {"path": ["บทที่ 2"], "content_url": "/pdfs/chapter-2.pdf", "total_pages": 2},
            ]

        monkeypatch.setattr(lessons_router, "_split_pdf_file", fake_split)

        for idx, chunk in enumerate([payload[:8], payload[8:16], payload[16:]]):
            res = admin_client.post(
                f"/api/lessons/split-pdf/uploads/{upload_id}/chunks",
                data={
                    "chunk_index": str(idx),
                    "total_chunks": "3",
                    "total_size": str(len(payload)),
                    "filename": "manual.pdf",
                },
                files={"file": ("chunk.bin", chunk, "application/octet-stream")},
            )
            assert res.status_code == 200

        res = admin_client.post(
            f"/api/lessons/course/{course.id}/split-pdf/uploads/{upload_id}/complete"
        )

        assert res.status_code == 200
        body = res.json()
        assert body["created_modules"] == 2
        assert body["created_lessons"] == 3
        assert [m["title"] for m in body["modules"]] == ["บทที่ 1", "บทที่ 2"]


class TestLessonAccessibilityFields:
    def test_update_lesson_caption_and_transcript(self, instructor_client, db):
        course = make_course(db)
        module = make_module(db, course)
        lesson = make_lesson(db, module)

        res = instructor_client.put(
            f"/api/lessons/{lesson.id}",
            json={
                "caption_url": "/videos/lesson-1-th.vtt",
                "transcript": "Transcript text for learners who cannot use audio.",
            },
        )

        assert res.status_code == 200
        body = res.json()
        assert body["caption_url"] == "/videos/lesson-1-th.vtt"
        assert body["transcript"] == "Transcript text for learners who cannot use audio."
