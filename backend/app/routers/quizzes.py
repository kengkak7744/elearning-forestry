from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.quiz import Quiz, Question, QuizAttempt, QuestionType
from app.models.lesson import Lesson
from app.models.course import Course, Module
from app.schemas.quiz import (
    QuizCreate, QuizUpdate, QuizResponse,
    QuestionCreate, QuestionUpdate, QuestionResponse,
    AnswerSubmit, AttemptResponse,
)

router = APIRouter()


def require_admin(current_user: User):
    if current_user.role.value not in ("admin", "instructor"):
        raise HTTPException(status_code=403, detail="ไม่มีสิทธิ์")


# === Quiz CRUD ===

@router.get("/lesson/{lesson_id}", response_model=List[QuizResponse])
def get_lesson_quizzes(
    lesson_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
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

    result = []
    for q in all_quizzes:
        best = best_by_quiz.get(q.id)
        result.append({
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
            "questions": [
                {
                    "id": qu.id,
                    "quiz_id": qu.quiz_id,
                    "question_text": qu.question_text,
                    "question_type": qu.question_type.value if qu.question_type else None,
                    "choices": qu.choices,
                    "correct_text": qu.correct_text,
                    "points": qu.points,
                    "order_index": qu.order_index,
                } for qu in sorted(q.questions, key=lambda x: x.order_index)
            ],
            "best_score": best["score"] if best else None,
            "is_passed": best["is_passed"] if best else False,
        })

    return result


@router.get("/course/{course_id}/final", response_model=QuizResponse)
def get_course_final_quiz(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
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

    total_points = 0
    earned_points = 0
    results = {}

    for q in quiz.questions:
        total_points += q.points
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
            earned_points += q.points

        results[q.id] = {
            "correct": is_correct,
            "correct_answer": correct_answer if quiz.show_correct_answer else None,
        }

    score = int((earned_points / total_points) * 100) if total_points > 0 else 0
    is_passed = score >= quiz.passing_score

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