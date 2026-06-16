"""Quiz grading rules."""
from sqlalchemy.orm import Session

from app.models.quiz import QuestionType, Quiz, QuizAttempt
from app.models.user import User
from app.schemas.quiz import AnswerSubmit
from app.services.quiz_delivery import (
    requires_question_set_token,
    validate_question_set_token,
)


def _submitted_questions(quiz: Quiz, payload: AnswerSubmit, user: User):
    if requires_question_set_token(quiz):
        served_ids = set(validate_question_set_token(payload.question_set_token, quiz, user))
        return [q for q in quiz.questions if q.id in served_ids]
    return list(quiz.questions)


def _as_int(value) -> int | None:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _as_int_set(value) -> set[int]:
    if value is None:
        return set()
    if isinstance(value, (str, bytes)):
        value = [value]
    try:
        return {int(item) for item in value}
    except (TypeError, ValueError):
        return set()


def grade_attempt(db: Session, quiz: Quiz, payload: AnswerSubmit, user: User):
    """Grade a submission, persist the attempt, and return (attempt, results).

    Count-based scoring: every non-opinion question weights equally (1 each).
    Opinion questions don't count in either direction; they're feedback only.
    """
    graded_count = 0
    correct_count = 0
    results = {}

    questions_to_score = _submitted_questions(quiz, payload, user)

    for q in questions_to_score:
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
            correct_idx = next(
                (i for i, c in enumerate(q.choices or []) if c.get("is_correct")),
                None,
            )
            correct_answer = correct_idx
            if _as_int(user_answer) == correct_idx:
                is_correct = True

        elif q.question_type == QuestionType.MULTIPLE_CHOICE:
            correct_set = {i for i, c in enumerate(q.choices or []) if c.get("is_correct")}
            correct_answer = sorted(list(correct_set))
            if _as_int_set(user_answer) == correct_set:
                is_correct = True

        elif q.question_type == QuestionType.WRITTEN:
            correct_answer = q.correct_text
            if q.correct_text and user_answer:
                if str(user_answer).strip().lower() == q.correct_text.strip().lower():
                    is_correct = True

        if is_correct:
            correct_count += 1

        results[q.id] = {
            "correct": is_correct,
            "correct_answer": correct_answer if quiz.show_correct_answer else None,
            "explanation": q.explanation if (quiz.show_correct_answer or not is_correct) else None,
        }

    score = int((correct_count / graded_count) * 100) if graded_count > 0 else 0
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
