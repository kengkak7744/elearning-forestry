from app.models.quiz import QuestionType, Quiz, QuizAttempt, QuizPlacement
from tests.factories import (
    enroll,
    make_course,
    make_lesson,
    make_module,
    make_question,
    make_quiz,
)


def _course_with_question_pool(db):
    course = make_course(db)
    module_one = make_module(db, course, title="โมดูล 1", order_index=0)
    lesson_one = make_lesson(db, module_one, title="บทเรียน 1", order_index=0)
    quiz_one = make_quiz(
        db,
        lesson=lesson_one,
        placement=QuizPlacement.END_OF_LESSON,
        title="ท้ายบท 1",
    )
    answer_kor = make_question(
        db,
        quiz_one,
        question_text="คำตอบข้อ ก",
        choices=[
            {"text": "ถูก", "is_correct": True},
            {"text": "ผิด", "is_correct": False},
        ],
        order_index=0,
    )
    opinion = make_question(
        db,
        quiz_one,
        question_type=QuestionType.OPINION,
        question_text="ความคิดเห็น",
        choices=None,
        order_index=1,
    )

    module_two = make_module(db, course, title="โมดูล 2", order_index=1)
    lesson_two = make_lesson(db, module_two, title="บทเรียน 2", order_index=0)
    quiz_two = make_quiz(
        db,
        lesson=lesson_two,
        placement=QuizPlacement.MID_VIDEO,
        title="กลางบท 2",
    )
    answer_khor = make_question(
        db,
        quiz_two,
        question_text="คำตอบข้อ ข",
        order_index=0,
    )
    answer_khor_two = make_question(
        db,
        quiz_two,
        question_text="คำตอบข้อ ข อีกข้อ",
        order_index=1,
    )

    final = make_quiz(db, course=course, title="แบบทดสอบสุดท้าย")
    final_own_question = make_question(
        db,
        final,
        question_text="คำถามเฉพาะแบบทดสอบสุดท้าย",
    )

    other_course = make_course(db, title="หลักสูตรอื่น")
    other_module = make_module(db, other_course)
    other_lesson = make_lesson(db, other_module)
    other_quiz = make_quiz(
        db,
        lesson=other_lesson,
        placement=QuizPlacement.END_OF_LESSON,
    )
    other_question = make_question(db, other_quiz, question_text="ห้ามนำเข้าข้ามหลักสูตร")

    return {
        "course": course,
        "final": final,
        "gradable": [answer_kor, answer_khor, answer_khor_two],
        "answer_kor": answer_kor,
        "opinion": opinion,
        "final_own": final_own_question,
        "other": other_question,
        "lesson_quiz": quiz_one,
    }


def _correct_choice_index(question):
    return next(
        index
        for index, choice in enumerate(question.choices or [])
        if choice.get("is_correct")
    )


def test_all_lesson_pool_serves_secure_random_subset(
    admin_client,
    learner_client,
    learner_user,
    db,
):
    rows = _course_with_question_pool(db)
    enroll(db, learner_user, rows["course"])

    updated = admin_client.patch(
        f'/api/quizzes/{rows["final"].id}',
        json={
            "question_pool_mode": "all_lessons",
            "selected_question_ids": [],
            "randomize_questions": True,
            "questions_per_attempt": 2,
        },
    )
    assert updated.status_code == 200
    assert updated.json()["question_pool_mode"] == "all_lessons"
    assert updated.json()["randomize_questions"] is True

    pool = admin_client.get(
        f'/api/quizzes/admin/{rows["final"].id}/question-pool'
    )
    assert pool.status_code == 200
    pool_body = pool.json()
    assert pool_body["question_pool_size"] == 3
    available_ids = {question["id"] for question in pool_body["available_questions"]}
    assert available_ids == {question.id for question in rows["gradable"]}
    assert rows["opinion"].id not in available_ids
    assert rows["final_own"].id not in available_ids
    assert rows["other"].id not in available_ids

    delivered = learner_client.get(
        f'/api/quizzes/course/{rows["course"].id}/final'
    )
    assert delivered.status_code == 200
    delivered_body = delivered.json()
    assert len(delivered_body["questions"]) == 2
    assert delivered_body["question_set_token"]
    assert all(
        set(choice) == {"text"}
        for question in delivered_body["questions"]
        for choice in question["choices"]
    )

    by_id = {question.id: question for question in rows["gradable"]}
    answers = {
        str(question["id"]): _correct_choice_index(by_id[question["id"]])
        for question in delivered_body["questions"]
    }
    submitted = learner_client.post(
        f'/api/quizzes/{rows["final"].id}/submit',
        json={
            "answers": answers,
            "question_set_token": delivered_body["question_set_token"],
        },
    )
    assert submitted.status_code == 200
    assert submitted.json()["score"] == 100
    assert set(submitted.json()["question_ids"]) == {
        question["id"] for question in delivered_body["questions"]
    }


def test_sourced_pool_can_disable_randomization_and_serves_all_in_stable_order(
    admin_client,
    learner_client,
    learner_user,
    db,
    monkeypatch,
):
    rows = _course_with_question_pool(db)
    enroll(db, learner_user, rows["course"])

    updated = admin_client.patch(
        f'/api/quizzes/{rows["final"].id}',
        json={
            "question_pool_mode": "all_lessons",
            "selected_question_ids": [],
            "randomize_questions": False,
            "questions_per_attempt": 1,
        },
    )
    assert updated.status_code == 200
    assert updated.json()["randomize_questions"] is False
    assert updated.json()["questions_per_attempt"] is None

    def fail_if_sampled(*_args, **_kwargs):
        raise AssertionError("random.sample must not run while randomization is off")

    monkeypatch.setattr(
        "app.services.quiz_delivery.random.sample",
        fail_if_sampled,
    )
    delivered = learner_client.get(
        f'/api/quizzes/course/{rows["course"].id}/final'
    )
    assert delivered.status_code == 200
    delivered_body = delivered.json()
    assert [question["id"] for question in delivered_body["questions"]] == [
        question.id for question in rows["gradable"]
    ]
    assert delivered_body["question_set_token"]


def test_selected_pool_grades_first_choice_kor_and_drives_stats(
    admin_client,
    learner_client,
    learner_user,
    db,
):
    rows = _course_with_question_pool(db)
    enroll(db, learner_user, rows["course"])
    question = rows["answer_kor"]

    updated = admin_client.patch(
        f'/api/quizzes/{rows["final"].id}',
        json={
            "question_pool_mode": "selected",
            "selected_question_ids": [question.id],
            "questions_per_attempt": 1,
        },
    )
    assert updated.status_code == 200
    assert updated.json()["selected_question_ids"] == [question.id]

    delivered = learner_client.get(
        f'/api/quizzes/course/{rows["course"].id}/final'
    ).json()
    assert [row["id"] for row in delivered["questions"]] == [question.id]

    missing_token = learner_client.post(
        f'/api/quizzes/{rows["final"].id}/submit',
        json={"answers": {str(question.id): 0}},
    )
    assert missing_token.status_code == 400

    submitted = learner_client.post(
        f'/api/quizzes/{rows["final"].id}/submit',
        json={
            "answers": {str(question.id): 0},
            "question_set_token": delivered["question_set_token"],
        },
    )
    assert submitted.status_code == 200
    assert submitted.json()["score"] == 100
    assert submitted.json()["results"][str(question.id)]["correct"] is True

    attempt = db.query(QuizAttempt).filter(QuizAttempt.quiz_id == rows["final"].id).one()
    assert attempt.question_ids == [question.id]

    stats = admin_client.get(f'/api/quizzes/admin/{rows["final"].id}/stats')
    assert stats.status_code == 200
    assert stats.json()["questions"][0]["id"] == question.id
    assert stats.json()["questions"][0]["correct_count"] == 1


def test_pool_configuration_rejects_invalid_selection_and_amount(admin_client, db):
    rows = _course_with_question_pool(db)

    cross_course = admin_client.patch(
        f'/api/quizzes/{rows["final"].id}',
        json={
            "question_pool_mode": "selected",
            "selected_question_ids": [rows["other"].id],
            "questions_per_attempt": 1,
        },
    )
    assert cross_course.status_code == 400

    empty_selection = admin_client.patch(
        f'/api/quizzes/{rows["final"].id}',
        json={
            "question_pool_mode": "selected",
            "selected_question_ids": [],
            "questions_per_attempt": 1,
        },
    )
    assert empty_selection.status_code == 400

    too_many = admin_client.patch(
        f'/api/quizzes/{rows["final"].id}',
        json={
            "question_pool_mode": "all_lessons",
            "selected_question_ids": [],
            "randomize_questions": True,
            "questions_per_attempt": 4,
        },
    )
    assert too_many.status_code == 400

    lesson_pool = admin_client.patch(
        f'/api/quizzes/{rows["lesson_quiz"].id}',
        json={"question_pool_mode": "all_lessons"},
    )
    assert lesson_pool.status_code == 400


def test_random_all_shuffles_complete_pool(admin_client, learner_client, learner_user, db, monkeypatch):
    rows = _course_with_question_pool(db)
    enroll(db, learner_user, rows["course"])
    updated = admin_client.patch(
        f'/api/quizzes/{rows["final"].id}',
        json={
            "question_pool_mode": "all_lessons",
            "selected_question_ids": [],
            "randomize_questions": True,
            "questions_per_attempt": None,
        },
    )
    assert updated.status_code == 200

    monkeypatch.setattr(
        "app.services.quiz_delivery.random.sample",
        lambda questions, count: list(reversed(questions))[:count],
    )
    delivered = learner_client.get(
        f'/api/quizzes/course/{rows["course"].id}/final'
    ).json()
    assert [question["id"] for question in delivered["questions"]] == [
        question.id for question in reversed(rows["gradable"])
    ]
    assert delivered["question_set_token"]


def test_empty_sourced_pool_cannot_create_passing_attempt(
    admin_client,
    learner_client,
    learner_user,
    db,
):
    course = make_course(db)
    final = make_quiz(db, course=course)
    enroll(db, learner_user, course)
    updated = admin_client.patch(
        f"/api/quizzes/{final.id}",
        json={
            "question_pool_mode": "all_lessons",
            "selected_question_ids": [],
            "questions_per_attempt": None,
        },
    )
    assert updated.status_code == 200

    delivered = learner_client.get(f"/api/quizzes/course/{course.id}/final")
    assert delivered.status_code == 200
    assert delivered.json()["questions"] == []

    submitted = learner_client.post(
        f"/api/quizzes/{final.id}/submit",
        json={"answers": {}},
    )
    assert submitted.status_code == 400
    assert db.query(QuizAttempt).filter(QuizAttempt.quiz_id == final.id).count() == 0


def test_duplicate_course_remaps_selected_questions_to_the_clone(admin_client, db):
    rows = _course_with_question_pool(db)
    rows["final"].question_pool_mode = "selected"
    rows["final"].source_questions = [rows["answer_kor"]]
    rows["final"].randomize_questions = True
    rows["final"].questions_per_attempt = 1
    db.commit()

    duplicated = admin_client.post(
        f'/api/courses/{rows["course"].id}/duplicate'
    )
    assert duplicated.status_code == 201

    cloned_final = (
        db.query(Quiz)
        .filter(
            Quiz.course_id == duplicated.json()["id"],
            Quiz.placement == QuizPlacement.FINAL,
        )
        .one()
    )
    assert cloned_final.question_pool_mode == "selected"
    assert len(cloned_final.source_questions) == 1
    cloned_source = cloned_final.source_questions[0]
    assert cloned_source.id != rows["answer_kor"].id
    assert cloned_source.question_text == rows["answer_kor"].question_text
    assert cloned_source.quiz.lesson.module.course_id == duplicated.json()["id"]
