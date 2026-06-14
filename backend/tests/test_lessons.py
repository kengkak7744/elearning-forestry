from tests.factories import make_course, make_lesson, make_module


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
