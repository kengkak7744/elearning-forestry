"""Characterization tests for /api/quizzes — CRUD, answer-key stripping, grading."""
from tests.factories import (
    enroll,
    make_course,
    make_lesson,
    make_module,
    make_question,
    make_quiz,
)
from app.models.quiz import QuestionType, QuizPlacement


def quiz_payload(**overrides):
    payload = {
        "title": "แบบทดสอบสุดท้าย",
        "placement": "final",
        "passing_score": 70,
    }
    payload.update(overrides)
    return payload


class TestQuizCrud:
    def test_admin_creates_quiz(self, admin_client, db):
        course = make_course(db)
        res = admin_client.post("/api/quizzes/", json=quiz_payload(course_id=course.id))
        assert res.status_code == 200
        assert res.json()["title"] == "แบบทดสอบสุดท้าย"

    def test_instructor_allowed(self, instructor_client, db):
        course = make_course(db)
        res = instructor_client.post(
            "/api/quizzes/", json=quiz_payload(course_id=course.id)
        )
        assert res.status_code == 200

    def test_learner_denied(self, learner_client, db):
        course = make_course(db)
        res = learner_client.post(
            "/api/quizzes/", json=quiz_payload(course_id=course.id)
        )
        assert res.status_code == 403
        assert res.json()["detail"] == "ไม่มีสิทธิ์"

    def test_update_quiz(self, admin_client, db):
        quiz = make_quiz(db, course=make_course(db))
        res = admin_client.patch(
            f"/api/quizzes/{quiz.id}", json={"passing_score": 80}
        )
        assert res.status_code == 200
        assert res.json()["passing_score"] == 80

    def test_update_unknown_quiz(self, admin_client):
        res = admin_client.patch("/api/quizzes/99999", json={"passing_score": 80})
        assert res.status_code == 404
        assert res.json()["detail"] == "ไม่พบแบบทดสอบ"

    def test_delete_quiz(self, admin_client, db):
        quiz = make_quiz(db, course=make_course(db))
        res = admin_client.delete(f"/api/quizzes/{quiz.id}")
        assert res.status_code == 200
        assert res.json() == {"deleted": True}

    def test_question_crud(self, admin_client, db):
        quiz = make_quiz(db, course=make_course(db))
        res = admin_client.post(
            f"/api/quizzes/{quiz.id}/questions",
            json={
                "question_text": "ข้อใดถูกต้อง",
                "question_type": "single_choice",
                "choices": [
                    {"text": "ก", "is_correct": False},
                    {"text": "ข", "is_correct": True},
                ],
            },
        )
        assert res.status_code == 200
        question_id = res.json()["id"]

        res = admin_client.patch(
            f"/api/quizzes/questions/{question_id}", json={"points": 5}
        )
        assert res.json()["points"] == 5

        res = admin_client.delete(f"/api/quizzes/questions/{question_id}")
        assert res.json() == {"deleted": True}

    def test_question_crud_learner_denied(self, learner_client, db):
        quiz = make_quiz(db, course=make_course(db))
        res = learner_client.post(
            f"/api/quizzes/{quiz.id}/questions",
            json={"question_text": "x", "question_type": "opinion"},
        )
        assert res.status_code == 403


class TestAnswerKeyStripping:
    def _lesson_quiz(self, db):
        course = make_course(db)
        module = make_module(db, course)
        lesson = make_lesson(db, module)
        quiz = make_quiz(db, lesson=lesson, placement=QuizPlacement.END_OF_LESSON)
        make_question(db, quiz, correct_text=None)
        return course, lesson, quiz

    def test_learner_endpoint_strips_answers(self, learner_client, db):
        _, lesson, _ = self._lesson_quiz(db)
        res = learner_client.get(f"/api/quizzes/lesson/{lesson.id}")
        assert res.status_code == 200
        question = res.json()[0]["questions"][0]
        assert question["correct_text"] is None
        assert all(set(c.keys()) == {"text"} for c in question["choices"])

    def test_admin_endpoint_includes_answers(self, admin_client, db):
        _, lesson, _ = self._lesson_quiz(db)
        res = admin_client.get(f"/api/quizzes/admin/lesson/{lesson.id}")
        assert res.status_code == 200
        question = res.json()[0]["questions"][0]
        assert any(c.get("is_correct") for c in question["choices"])

    def test_admin_lesson_endpoint_denied_for_learner(self, learner_client, db):
        _, lesson, _ = self._lesson_quiz(db)
        res = learner_client.get(f"/api/quizzes/admin/lesson/{lesson.id}")
        assert res.status_code == 403

    def test_final_quiz_endpoints(self, learner_client, db, learner_user):
        course = make_course(db)
        res = learner_client.get(f"/api/quizzes/course/{course.id}/final")
        assert res.status_code == 404
        assert res.json()["detail"] == "ยังไม่มีแบบทดสอบสุดท้าย"

        quiz = make_quiz(db, course=course)
        make_question(db, quiz)
        res = learner_client.get(f"/api/quizzes/course/{course.id}/final")
        assert res.status_code == 200
        assert res.json()["id"] == quiz.id


class TestSubmitGrading:
    def _graded_quiz(self, db, *, show_correct_answer=True):
        """Final quiz: single choice (correct=1), multiple choice (correct={0,2}),
        written ('กรุงเทพ'), opinion. 3 graded questions."""
        course = make_course(db)
        quiz = make_quiz(db, course=course, show_correct_answer=show_correct_answer)
        q1 = make_question(db, quiz, order_index=0)
        q2 = make_question(
            db,
            quiz,
            question_type=QuestionType.MULTIPLE_CHOICE,
            choices=[
                {"text": "ก", "is_correct": True},
                {"text": "ข", "is_correct": False},
                {"text": "ค", "is_correct": True},
            ],
            order_index=1,
        )
        q3 = make_question(
            db,
            quiz,
            question_type=QuestionType.WRITTEN,
            correct_text="กรุงเทพ",
            choices=None,
            order_index=2,
        )
        q4 = make_question(
            db, quiz, question_type=QuestionType.OPINION, choices=None, order_index=3
        )
        return course, quiz, (q1, q2, q3, q4)

    def test_all_correct_passes(self, learner_client, db, learner_user):
        course, quiz, (q1, q2, q3, q4) = self._graded_quiz(db)
        enroll(db, learner_user, course)
        res = learner_client.post(
            f"/api/quizzes/{quiz.id}/submit",
            json={
                "answers": {
                    str(q1.id): 1,
                    str(q2.id): [0, 2],
                    str(q3.id): " กรุงเทพ ",  # whitespace + case-insensitive match
                    str(q4.id): "ความเห็นอิสระ",
                }
            },
        )
        assert res.status_code == 200
        body = res.json()
        assert body["score"] == 100
        assert body["is_passed"] is True
        assert body["results"][str(q4.id)]["correct"] is True  # opinion always correct

    def test_partial_score_fails(self, learner_client, db, learner_user):
        course, quiz, (q1, q2, q3, q4) = self._graded_quiz(db)
        enroll(db, learner_user, course)
        res = learner_client.post(
            f"/api/quizzes/{quiz.id}/submit",
            json={
                "answers": {
                    str(q1.id): 1,        # correct
                    str(q2.id): [0],      # incomplete set → wrong
                    str(q3.id): "เชียงใหม่",  # wrong
                }
            },
        )
        body = res.json()
        # 1/3 graded correct → int(33.33) = 33 < 70
        assert body["score"] == 33
        assert body["is_passed"] is False
        # Correct answer revealed because show_correct_answer=True.
        assert body["results"][str(q1.id)]["correct_answer"] == 1

    def test_hidden_answers_when_configured(self, learner_client, db, learner_user):
        course, quiz, (q1, _, _, _) = self._graded_quiz(db, show_correct_answer=False)
        enroll(db, learner_user, course)
        res = learner_client.post(
            f"/api/quizzes/{quiz.id}/submit",
            json={"answers": {str(q1.id): 0}},
        )
        assert res.json()["results"][str(q1.id)]["correct_answer"] is None

    def test_question_ids_subset_scoring(self, learner_client, db, learner_user):
        course, quiz, (q1, q2, q3, q4) = self._graded_quiz(db)
        enroll(db, learner_user, course)
        # Served only q1; answered correctly → 100 despite unanswered bank.
        res = learner_client.post(
            f"/api/quizzes/{quiz.id}/submit",
            json={"answers": {str(q1.id): 1}, "question_ids": [q1.id]},
        )
        assert res.json()["score"] == 100

    def test_unenrolled_learner_denied(self, learner_client, db):
        course, quiz, _ = self._graded_quiz(db)
        res = learner_client.post(
            f"/api/quizzes/{quiz.id}/submit", json={"answers": {}}
        )
        assert res.status_code == 403
        assert res.json()["detail"] == "ต้องลงทะเบียนหลักสูตรก่อนทำแบบทดสอบ"

    def test_admin_exempt_from_enrollment(self, admin_client, db):
        course, quiz, (q1, _, _, _) = self._graded_quiz(db)
        res = admin_client.post(
            f"/api/quizzes/{quiz.id}/submit", json={"answers": {str(q1.id): 1}}
        )
        assert res.status_code == 200

    def test_unknown_quiz(self, learner_client):
        res = learner_client.post("/api/quizzes/99999/submit", json={"answers": {}})
        assert res.status_code == 404
        assert res.json()["detail"] == "ไม่พบแบบทดสอบ"


class TestCourseQuizStatus:
    def test_best_score_reported(self, learner_client, db, learner_user):
        course, quiz, (q1, q2, q3, q4) = TestSubmitGrading()._graded_quiz(db)
        enroll(db, learner_user, course)
        learner_client.post(
            f"/api/quizzes/{quiz.id}/submit",
            json={"answers": {str(q1.id): 1}, "question_ids": [q1.id]},
        )
        res = learner_client.get(f"/api/quizzes/course/{course.id}/all")
        assert res.status_code == 200
        row = res.json()[0]
        assert row["best_score"] == 100
        assert row["is_passed"] is True


class TestQuizStats:
    def test_course_stats_admin_only(self, learner_client, admin_client, db):
        course = make_course(db)
        res = learner_client.get(f"/api/quizzes/admin/course/{course.id}/stats")
        assert res.status_code == 403

        res = admin_client.get(f"/api/quizzes/admin/course/{course.id}/stats")
        assert res.status_code == 200
        assert res.json()["total_quizzes"] == 0

    def test_quiz_stats(self, admin_client, learner_client, db, learner_user):
        course, quiz, (q1, _, _, _) = TestSubmitGrading()._graded_quiz(db)
        enroll(db, learner_user, course)
        learner_client.post(
            f"/api/quizzes/{quiz.id}/submit",
            json={"answers": {str(q1.id): 1}, "question_ids": [q1.id]},
        )
        res = admin_client.get(f"/api/quizzes/admin/{quiz.id}/stats")
        assert res.status_code == 200
        body = res.json()
        assert body["total_attempts"] == 1
        q1_stats = body["questions"][0]
        assert q1_stats["answered_count"] == 1
        assert q1_stats["correct_count"] == 1
