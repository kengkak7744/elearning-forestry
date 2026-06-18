import io

from pypdf import PdfReader, PdfWriter

from app.routers.lessons import _pdf_sections_paths
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
