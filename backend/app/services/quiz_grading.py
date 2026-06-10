"""Quiz grading — moved out of the submit route so the scoring rules are
unit-testable and reusable."""
from sqlalchemy.orm import Session

from app.models.quiz import Quiz, QuizAttempt, QuestionType
from app.models.user import User
from app.schemas.quiz import AnswerSubmit


def grade_attempt(db: Session, quiz: Quiz, payload: AnswerSubmit, user: User):
    """Grade a submission, persist the attempt, and return (attempt, results).

    Count-based scoring: every non-opinion question weights equally (1 each).
    Opinion questions don't count in either direction — they're feedback only.
    `results` is per-question feedback for the UI; it is not stored.
    """
    graded_count = 0
    correct_count = 0
    results = {}

    # With randomization, the learner saw a subset. Score against the IDs they
    # were served (passed by the client), not the full bank — otherwise total
    # points includes unseen questions and the score caps below 100%.
    if payload.question_ids:
        served_ids = set(payload.question_ids)
        questions_to_score = [q for q in quiz.questions if q.id in served_ids]
    else:
        # Back-compat: legacy clients don't send question_ids → score full bank.
        questions_to_score = list(quiz.questions)

    for q in questions_to_score:
        # Opinion: recorded in `answers` for admin review, never counted.
        if q.question_type == QuestionType.OPINION:
            results[q.id] = {"correct": True, "correct_answer": None}
            continue

        graded_count += 1
        user_answer = payload.answers.get(str(q.id))
        if user_answer is None:
            user_answer = payload.answers.get(q.id)

        is_correct = False
        correct_answer = None

        if q.question_type == QuestionType.SINGLE_CHOICE:
            correct_idx = next((i for i, c in enumerate(q.choices or []) if c.get("is_correct")), None)
            correct_answer = correct_idx
            if user_answer is not None and int(user_answer) == correct_idx:
                is_correct = True

        elif q.question_type == QuestionType.MULTIPLE_CHOICE:
            correct_set = {i for i, c in enumerate(q.choices or []) if c.get("is_correct")}
            correct_answer = sorted(list(correct_set))
            user_set = set(int(x) for x in (user_answer or []))
            if user_set == correct_set:
                is_correct = True

        elif q.question_type == QuestionType.WRITTEN:
            # Auto-grade: exact match (case-insensitive)
            correct_answer = q.correct_text
            if q.correct_text and user_answer:
                if str(user_answer).strip().lower() == q.correct_text.strip().lower():
                    is_correct = True

        if is_correct:
            correct_count += 1

        results[q.id] = {
            "correct": is_correct,
            "correct_answer": correct_answer if quiz.show_correct_answer else None,
            # Show explanation when the quiz is configured to reveal answers OR
            # the learner got it wrong (so they always get the "why" on misses,
            # even on stricter quizzes that hide the correct answer).
            "explanation": q.explanation if (quiz.show_correct_answer or not is_correct) else None,
        }

    # Score = % of graded (non-opinion) questions answered correctly.
    score = int((correct_count / graded_count) * 100) if graded_count > 0 else 0
    # An all-opinion quiz (e.g. course feedback survey) is "passed" automatically.
    is_passed = score >= quiz.passing_score if graded_count > 0 else True

    attempt = QuizAttempt(
        user_id=user.id,
        quiz_id=quiz.id,
        score=score,
        answers=payload.answers,
        is_passed=is_passed,
    )
    db.add(attempt)
    db.commit()
    db.refresh(attempt)

    return attempt, results
