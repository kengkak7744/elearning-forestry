"""Learner-safe quiz serialization and signed random question sets."""
import random
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import HTTPException

from app.config import settings
from app.models.quiz import Question, Quiz
from app.models.user import User


QUESTION_SET_TOKEN_MINUTES = 8 * 60
QUESTION_SET_TOKEN_TYPE = "quiz_question_set"


def strip_question_answers(question: Question) -> dict:
    choices = None
    if question.choices:
        choices = [{"text": c.get("text", "")} for c in question.choices]
    return {
        "id": question.id,
        "quiz_id": question.quiz_id,
        "question_text": question.question_text,
        "question_type": question.question_type.value if question.question_type else None,
        "choices": choices,
        "correct_text": None,
        "points": question.points,
        "order_index": question.order_index,
    }


def _question_bank(
    quiz: Quiz,
    question_bank: list[Question] | None = None,
) -> list[Question]:
    return list(quiz.questions or []) if question_bank is None else list(question_bank)


def served_questions(
    quiz: Quiz,
    question_bank: list[Question] | None = None,
) -> list[Question]:
    ordered = sorted(
        _question_bank(quiz, question_bank),
        key=lambda q: (q.order_index or 0, q.id or 0),
    )
    if quiz.randomize_questions and ordered:
        requested = quiz.questions_per_attempt or len(ordered)
        n = min(requested, len(ordered)) if requested > 0 else len(ordered)
        return random.sample(ordered, n)
    return ordered


def requires_question_set_token(
    quiz: Quiz,
    question_bank: list[Question] | None = None,
) -> bool:
    question_count = len(_question_bank(quiz, question_bank))
    sourced = (getattr(quiz, 'question_pool_mode', None) or 'own') != 'own'
    return bool(question_count and (sourced or quiz.randomize_questions))


def create_question_set_token(quiz: Quiz, user: User, question_ids: list[int]) -> str:
    payload = {
        "typ": QUESTION_SET_TOKEN_TYPE,
        "sub": str(user.id),
        "quiz_id": quiz.id,
        "question_ids": question_ids,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=QUESTION_SET_TOKEN_MINUTES),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def validate_question_set_token(
    token: str | None,
    quiz: Quiz,
    user: User,
    question_bank: list[Question] | None = None,
) -> list[int]:
    if not token:
        raise HTTPException(status_code=400, detail="Invalid quiz question set")
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status_code=400, detail="Invalid quiz question set") from exc

    if (
        payload.get("typ") != QUESTION_SET_TOKEN_TYPE
        or str(payload.get("sub")) != str(user.id)
        or payload.get("quiz_id") != quiz.id
    ):
        raise HTTPException(status_code=400, detail="Invalid quiz question set")

    try:
        question_ids = [int(qid) for qid in payload.get("question_ids") or []]
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail="Invalid quiz question set") from exc

    if len(question_ids) != len(set(question_ids)):
        raise HTTPException(status_code=400, detail="Invalid quiz question set")

    bank = _question_bank(quiz, question_bank)
    bank_ids = {q.id for q in bank}
    if not question_ids or any(qid not in bank_ids for qid in question_ids):
        raise HTTPException(status_code=400, detail="Invalid quiz question set")

    if requires_question_set_token(quiz, bank):
        expected = len(bank_ids)
        if quiz.randomize_questions and quiz.questions_per_attempt:
            expected = min(quiz.questions_per_attempt, len(bank_ids))
        if len(question_ids) != expected:
            raise HTTPException(status_code=400, detail="Invalid quiz question set")

    return question_ids


def quiz_to_learner_dict(
    quiz: Quiz,
    user: User,
    *,
    include_status: bool = False,
    best: dict | None = None,
    question_bank: list[Question] | None = None,
) -> dict:
    bank = _question_bank(quiz, question_bank)
    served = served_questions(quiz, bank)
    question_ids = [q.id for q in served]
    base = {
        "id": quiz.id,
        "lesson_id": quiz.lesson_id,
        "course_id": quiz.course_id,
        "title": quiz.title,
        "placement": quiz.placement.value if quiz.placement else None,
        "trigger_time": quiz.trigger_time,
        "can_skip": quiz.can_skip,
        "show_correct_answer": quiz.show_correct_answer,
        "passing_score": quiz.passing_score,
        "order_index": quiz.order_index,
        "randomize_questions": quiz.randomize_questions,
        "questions_per_attempt": quiz.questions_per_attempt,
        "question_pool_mode": getattr(quiz, "question_pool_mode", None) or "own",
        "question_set_token": (
            create_question_set_token(quiz, user, question_ids)
            if requires_question_set_token(quiz, bank)
            else None
        ),
        "questions": [strip_question_answers(q) for q in served],
    }
    if include_status:
        base["best_score"] = best["score"] if best else None
        base["is_passed"] = best["is_passed"] if best else False
    return base
