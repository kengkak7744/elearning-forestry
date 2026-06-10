"""Single source of truth for "has this user finished this course?".

Used by certificate issuance AND feedback gating so "completed" means the
same thing everywhere.
"""
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.course import Module
from app.models.enrollment import Enrollment
from app.models.lesson import Lesson
from app.models.progress import LessonProgress
from app.models.quiz import Quiz, QuizAttempt


def course_completion(db: Session, user_id: int, course_id: int):
    """Return (eligible, final_score_or_None, reason_if_not).

    Eligible iff: enrolled, all lessons completed, and the course's final quiz
    (if it has one) has been passed. final_score is the best final-exam attempt
    when a final exists, otherwise None (course without a final still issues).
    """
    enrolled = db.query(Enrollment).filter(
        Enrollment.user_id == user_id,
        Enrollment.course_id == course_id,
    ).first()
    if not enrolled:
        return False, None, "ยังไม่ได้ลงทะเบียนหลักสูตรนี้"

    total_lessons = (
        db.query(func.count(Lesson.id))
        .join(Module, Lesson.module_id == Module.id)
        .filter(Module.course_id == course_id)
        .scalar()
    ) or 0
    if total_lessons == 0:
        return False, None, "หลักสูตรยังไม่มีบทเรียน"

    completed_lessons = (
        db.query(func.count(LessonProgress.id))
        .join(Lesson, Lesson.id == LessonProgress.lesson_id)
        .join(Module, Module.id == Lesson.module_id)
        .filter(
            Module.course_id == course_id,
            LessonProgress.user_id == user_id,
            LessonProgress.completed == True,
        )
        .scalar()
    ) or 0
    if completed_lessons < total_lessons:
        return False, None, f"เรียนยังไม่ครบ ({completed_lessons}/{total_lessons} บทเรียน)"

    final_score = None
    final_quiz = (
        db.query(Quiz)
        .filter(Quiz.course_id == course_id, Quiz.placement == "final")
        .first()
    )
    if final_quiz:
        best = (
            db.query(QuizAttempt)
            .filter(
                QuizAttempt.user_id == user_id,
                QuizAttempt.quiz_id == final_quiz.id,
                QuizAttempt.is_passed == True,
            )
            .order_by(QuizAttempt.score.desc())
            .first()
        )
        if not best:
            return False, None, "ยังไม่ผ่านแบบทดสอบสุดท้าย"
        final_score = float(best.score)

    return True, final_score, None
