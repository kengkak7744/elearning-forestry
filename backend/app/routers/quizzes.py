import random
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.quiz import Quiz, Question, QuizAttempt, QuestionType
from app.models.lesson import Lesson
from app.models.course import Course, Module
from app.models.enrollment import Enrollment
from app.schemas.quiz import (
    QuizCreate, QuizUpdate, QuizResponse,
    QuestionCreate, QuestionUpdate, QuestionResponse,
    AnswerSubmit, AttemptResponse,
)

router = APIRouter()


def require_admin(current_user: User):
    if current_user.role.value not in ("admin", "instructor"):
        raise HTTPException(status_code=403, detail="ไม่มีสิทธิ์")


def _strip_question_answers(q):
    """Hide answer keys from learners. Returns a question dict safe to send to the client."""
    safe_choices = None
    if q.choices:
        safe_choices = [{"text": c.get("text", "")} for c in q.choices]
    return {
        "id": q.id,
        "quiz_id": q.quiz_id,
        "question_text": q.question_text,
        "question_type": q.question_type.value if q.question_type else None,
        "choices": safe_choices,
        "correct_text": None,
        "points": q.points,
        "order_index": q.order_index,
    }


def _serve_questions(quiz):
    """Return the question subset to show the learner.

    Non-random: full bank, sorted by order_index (stable, authoring order).
    Random: random.sample of size `questions_per_attempt` (capped at bank size).
            Each fetch re-rolls — refresh during an attempt is fine because the
            client locks the set when it submits via `question_ids`.
    """
    ordered = sorted(quiz.questions, key=lambda x: x.order_index)
    if quiz.randomize_questions and quiz.questions_per_attempt:
        n = min(quiz.questions_per_attempt, len(ordered))
        if n > 0:
            return random.sample(ordered, n)
    return ordered


def _quiz_to_safe_dict(q, include_status=False, best=None):
    """Quiz dict with stripped question answers."""
    served = _serve_questions(q)
    base = {
        "id": q.id,
        "lesson_id": q.lesson_id,
        "course_id": q.course_id,
        "title": q.title,
        "placement": q.placement.value if q.placement else None,
        "trigger_time": q.trigger_time,
        "can_skip": q.can_skip,
        "show_correct_answer": q.show_correct_answer,
        "passing_score": q.passing_score,
        "order_index": q.order_index,
        "randomize_questions": q.randomize_questions,
        "questions_per_attempt": q.questions_per_attempt,
        "questions": [_strip_question_answers(qu) for qu in served],
    }
    if include_status:
        base["best_score"] = best["score"] if best else None
        base["is_passed"] = best["is_passed"] if best else False
    return base


# === Quiz CRUD ===

@router.get("/lesson/{lesson_id}")
def get_lesson_quizzes(
    lesson_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Learner-safe: answer keys stripped."""
    quizzes = db.query(Quiz).options(joinedload(Quiz.questions)).filter(
        Quiz.lesson_id == lesson_id
    ).order_by(Quiz.order_index).all()
    return [_quiz_to_safe_dict(q) for q in quizzes]


@router.get("/admin/course/{course_id}/stats")
def get_course_stats(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Aggregate stats across every quiz in a course — per-quiz summary,
    per-learner roll-up, and overall numbers."""
    require_admin(current_user)

    # All quizzes in this course (lesson-bound + the course-level final).
    lesson_quizzes = (
        db.query(Quiz)
        .join(Lesson, Quiz.lesson_id == Lesson.id)
        .join(Module, Lesson.module_id == Module.id)
        .filter(Module.course_id == course_id)
        .all()
    )
    final_quiz = (
        db.query(Quiz)
        .filter(Quiz.course_id == course_id, Quiz.placement == "final")
        .first()
    )
    all_quizzes = lesson_quizzes + ([final_quiz] if final_quiz else [])
    if not all_quizzes:
        return {
            "course_id": course_id,
            "total_quizzes": 0,
            "total_attempts": 0,
            "unique_learners": 0,
            "overall_average": 0,
            "overall_pass_rate": 0,
            "quizzes": [],
            "learners": [],
        }

    quiz_ids = [q.id for q in all_quizzes]
    attempts = (
        db.query(QuizAttempt)
        .options(joinedload(QuizAttempt.user))
        .filter(QuizAttempt.quiz_id.in_(quiz_ids))
        .all()
    )

    # Per-quiz summary — counted off all attempts.
    by_quiz = {}
    for a in attempts:
        by_quiz.setdefault(a.quiz_id, []).append(a)

    quiz_summary = []
    for q in all_quizzes:
        qa = by_quiz.get(q.id, [])
        ta = len(qa)
        avg = int(sum(a.score for a in qa) / ta) if ta else 0
        pass_count = sum(1 for a in qa if a.is_passed)
        pass_rate = int((pass_count / ta) * 100) if ta else 0
        unique = len({a.user_id for a in qa})
        quiz_summary.append({
            "id": q.id,
            "title": q.title,
            "placement": q.placement.value if q.placement else None,
            "lesson_id": q.lesson_id,
            "passing_score": q.passing_score,
            "total_attempts": ta,
            "unique_learners": unique,
            "average_score": avg,
            "pass_rate": pass_rate,
            "pass_count": pass_count,
        })

    # Per-learner roll-up: best score per (user, quiz), then averaged across quizzes the learner took.
    best = {}  # (user_id, quiz_id) -> attempt
    for a in attempts:
        key = (a.user_id, a.quiz_id)
        prev = best.get(key)
        if not prev or a.score > prev.score:
            best[key] = a

    learners = {}
    for (user_id, _), a in best.items():
        L = learners.setdefault(user_id, {
            "user_id": user_id,
            "user_name": a.user.full_name if a.user else f"#{a.user_id}",
            "user_department": a.user.department if a.user else None,
            "quizzes_taken": 0,
            "quizzes_passed": 0,
            "_score_sum": 0,
        })
        L["quizzes_taken"] += 1
        if a.is_passed:
            L["quizzes_passed"] += 1
        L["_score_sum"] += a.score

    learner_list = []
    for L in learners.values():
        L["average_score"] = int(L["_score_sum"] / L["quizzes_taken"]) if L["quizzes_taken"] else 0
        L.pop("_score_sum", None)
        learner_list.append(L)
    learner_list.sort(key=lambda x: x["average_score"], reverse=True)

    # Overall (all attempts pooled)
    total_attempts = len(attempts)
    overall_avg = int(sum(a.score for a in attempts) / total_attempts) if total_attempts else 0
    overall_pass = sum(1 for a in attempts if a.is_passed)
    overall_pass_rate = int((overall_pass / total_attempts) * 100) if total_attempts else 0

    return {
        "course_id": course_id,
        "total_quizzes": len(all_quizzes),
        "total_attempts": total_attempts,
        "unique_learners": len({a.user_id for a in attempts}),
        "overall_average": overall_avg,
        "overall_pass_rate": overall_pass_rate,
        "quizzes": quiz_summary,
        "learners": learner_list,
    }


@router.get("/admin/{quiz_id}/stats")
def get_quiz_stats(
    quiz_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Aggregate analytics for a quiz — per-question correctness rates,
    choice distributions, and free-text responses (written / opinion)."""
    require_admin(current_user)
    quiz = (
        db.query(Quiz)
        .options(joinedload(Quiz.questions))
        .filter(Quiz.id == quiz_id)
        .first()
    )
    if not quiz:
        raise HTTPException(status_code=404, detail="ไม่พบแบบทดสอบ")

    attempts = (
        db.query(QuizAttempt)
        .options(joinedload(QuizAttempt.user))
        .filter(QuizAttempt.quiz_id == quiz_id)
        .all()
    )
    total_attempts = len(attempts)
    avg_score = int(sum(a.score for a in attempts) / total_attempts) if total_attempts else 0
    pass_count = sum(1 for a in attempts if a.is_passed)
    pass_rate = int((pass_count / total_attempts) * 100) if total_attempts else 0

    question_stats = []
    for q in sorted(quiz.questions, key=lambda x: x.order_index):
        answered_count = 0
        correct_count = 0
        choice_dist = None
        responses = None

        if q.question_type in (QuestionType.SINGLE_CHOICE, QuestionType.MULTIPLE_CHOICE):
            choice_dist = {i: 0 for i in range(len(q.choices or []))}
            correct_set = {i for i, c in enumerate(q.choices or []) if c.get("is_correct")}
        elif q.question_type in (QuestionType.WRITTEN, QuestionType.OPINION):
            responses = []

        for a in attempts:
            ans = (a.answers or {}).get(str(q.id))
            if ans is None:
                ans = (a.answers or {}).get(q.id)
            if ans is None:
                continue
            answered_count += 1
            user_name = a.user.full_name if a.user else f"#{a.user_id}"

            if q.question_type == QuestionType.SINGLE_CHOICE:
                try:
                    idx = int(ans)
                    if idx in choice_dist:
                        choice_dist[idx] += 1
                    correct_idx = next(iter(correct_set), None)
                    if idx == correct_idx:
                        correct_count += 1
                except (ValueError, TypeError):
                    pass

            elif q.question_type == QuestionType.MULTIPLE_CHOICE:
                try:
                    selected = {int(x) for x in (ans or [])}
                    for idx in selected:
                        if idx in choice_dist:
                            choice_dist[idx] += 1
                    if selected == correct_set:
                        correct_count += 1
                except (ValueError, TypeError):
                    pass

            elif q.question_type == QuestionType.WRITTEN:
                text = str(ans).strip()
                is_match = bool(
                    q.correct_text and text.lower() == q.correct_text.strip().lower()
                )
                if is_match:
                    correct_count += 1
                responses.append({
                    "user_name": user_name,
                    "text": text,
                    "correct": is_match,
                    "attempted_at": a.attempted_at.isoformat() if a.attempted_at else None,
                })

            elif q.question_type == QuestionType.OPINION:
                correct_count += 1  # opinions are always correct
                responses.append({
                    "user_name": user_name,
                    "text": str(ans),
                    "attempted_at": a.attempted_at.isoformat() if a.attempted_at else None,
                })

        correct_rate = int((correct_count / answered_count) * 100) if answered_count else 0

        question_stats.append({
            "id": q.id,
            "question_text": q.question_text,
            "question_type": q.question_type.value,
            "points": q.points,
            "choices": q.choices,
            "correct_text": q.correct_text,
            "answered_count": answered_count,
            "correct_count": correct_count,
            "correct_rate": correct_rate,
            "choice_distribution": choice_dist,
            "responses": responses,
        })

    return {
        "quiz_id": quiz.id,
        "title": quiz.title,
        "passing_score": quiz.passing_score,
        "total_attempts": total_attempts,
        "average_score": avg_score,
        "pass_rate": pass_rate,
        "pass_count": pass_count,
        "questions": question_stats,
    }


@router.get("/admin/lesson/{lesson_id}", response_model=List[QuizResponse])
def get_lesson_quizzes_admin(
    lesson_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Admin/instructor only: includes answer keys for editing."""
    require_admin(current_user)
    quizzes = db.query(Quiz).options(joinedload(Quiz.questions)).filter(
        Quiz.lesson_id == lesson_id
    ).order_by(Quiz.order_index).all()
    return quizzes


@router.get("/course/{course_id}/all")
def get_course_quizzes_with_status(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """All quizzes in a course (lesson + final) with the current user's best score and pass status."""
    lesson_quizzes = db.query(Quiz).options(joinedload(Quiz.questions)).join(
        Lesson, Quiz.lesson_id == Lesson.id
    ).join(
        Module, Lesson.module_id == Module.id
    ).filter(Module.course_id == course_id).all()

    final_quiz = db.query(Quiz).options(joinedload(Quiz.questions)).filter(
        Quiz.course_id == course_id,
        Quiz.placement == "final"
    ).first()

    all_quizzes = lesson_quizzes + ([final_quiz] if final_quiz else [])

    quiz_ids = [q.id for q in all_quizzes]
    attempts = []
    if quiz_ids:
        attempts = db.query(QuizAttempt).filter(
            QuizAttempt.user_id == current_user.id,
            QuizAttempt.quiz_id.in_(quiz_ids)
        ).all()

    best_by_quiz = {}
    for a in attempts:
        existing = best_by_quiz.get(a.quiz_id)
        if not existing or a.score > existing["score"]:
            best_by_quiz[a.quiz_id] = {"score": a.score, "is_passed": a.is_passed}

    return [_quiz_to_safe_dict(q, include_status=True, best=best_by_quiz.get(q.id)) for q in all_quizzes]


@router.get("/course/{course_id}/final")
def get_course_final_quiz(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Learner-safe: answer keys stripped."""
    quiz = db.query(Quiz).options(joinedload(Quiz.questions)).filter(
        Quiz.course_id == course_id,
        Quiz.placement == "final"
    ).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="ยังไม่มีแบบทดสอบสุดท้าย")
    return _quiz_to_safe_dict(quiz)


@router.get("/admin/course/{course_id}/final", response_model=QuizResponse)
def get_course_final_quiz_admin(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Admin/instructor only: includes answer keys for editing."""
    require_admin(current_user)
    quiz = db.query(Quiz).options(joinedload(Quiz.questions)).filter(
        Quiz.course_id == course_id,
        Quiz.placement == "final"
    ).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="ยังไม่มีแบบทดสอบสุดท้าย")
    return quiz


@router.post("/", response_model=QuizResponse)
def create_quiz(
    payload: QuizCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_admin(current_user)
    quiz = Quiz(**payload.model_dump())
    db.add(quiz)
    db.commit()
    db.refresh(quiz)
    return quiz


@router.patch("/{quiz_id}", response_model=QuizResponse)
def update_quiz(
    quiz_id: int,
    payload: QuizUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_admin(current_user)
    quiz = db.query(Quiz).filter(Quiz.id == quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="ไม่พบแบบทดสอบ")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(quiz, key, value)
    db.commit()
    db.refresh(quiz)
    return quiz


@router.delete("/{quiz_id}")
def delete_quiz(
    quiz_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_admin(current_user)
    quiz = db.query(Quiz).filter(Quiz.id == quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="ไม่พบแบบทดสอบ")
    db.delete(quiz)
    db.commit()
    return {"deleted": True}


# === Question CRUD ===

@router.post("/{quiz_id}/questions", response_model=QuestionResponse)
def create_question(
    quiz_id: int,
    payload: QuestionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_admin(current_user)
    quiz = db.query(Quiz).filter(Quiz.id == quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="ไม่พบแบบทดสอบ")
    question = Question(quiz_id=quiz_id, **payload.model_dump())
    db.add(question)
    db.commit()
    db.refresh(question)
    return question


@router.patch("/questions/{question_id}", response_model=QuestionResponse)
def update_question(
    question_id: int,
    payload: QuestionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_admin(current_user)
    q = db.query(Question).filter(Question.id == question_id).first()
    if not q:
        raise HTTPException(status_code=404, detail="ไม่พบคำถาม")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(q, key, value)
    db.commit()
    db.refresh(q)
    return q


@router.delete("/questions/{question_id}")
def delete_question(
    question_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_admin(current_user)
    q = db.query(Question).filter(Question.id == question_id).first()
    if not q:
        raise HTTPException(status_code=404, detail="ไม่พบคำถาม")
    db.delete(q)
    db.commit()
    return {"deleted": True}


# === Submit answers ===

@router.post("/{quiz_id}/submit", response_model=AttemptResponse)
def submit_quiz(
    quiz_id: int,
    payload: AnswerSubmit,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    quiz = db.query(Quiz).options(joinedload(Quiz.questions)).filter(Quiz.id == quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="ไม่พบแบบทดสอบ")

    # Require enrollment in the parent course (admin/instructor exempt for previews)
    if current_user.role.value not in ("admin", "instructor"):
        if quiz.course_id is not None:
            target_course_id = quiz.course_id
        else:
            lesson_row = (
                db.query(Module.course_id)
                .join(Lesson, Lesson.module_id == Module.id)
                .filter(Lesson.id == quiz.lesson_id)
                .first()
            )
            target_course_id = lesson_row[0] if lesson_row else None
        if target_course_id is None or not db.query(Enrollment).filter(
            Enrollment.user_id == current_user.id,
            Enrollment.course_id == target_course_id,
        ).first():
            raise HTTPException(status_code=403, detail="ต้องลงทะเบียนหลักสูตรก่อนทำแบบทดสอบ")

    # Count-based scoring: every non-opinion question weights equally (1 each).
    # Opinion questions don't count in either direction — they're feedback only.
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

        # Opinion case is handled before this branch — no need to handle it here.

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
        user_id=current_user.id,
        quiz_id=quiz_id,
        score=score,
        answers=payload.answers,
        is_passed=is_passed,
    )
    db.add(attempt)
    db.commit()
    db.refresh(attempt)

    # Add results to response (not stored, just for UI)
    return {
        "id": attempt.id,
        "user_id": attempt.user_id,
        "quiz_id": attempt.quiz_id,
        "score": attempt.score,
        "answers": attempt.answers,
        "is_passed": attempt.is_passed,
        "attempted_at": attempt.attempted_at,
        "results": results,
    }