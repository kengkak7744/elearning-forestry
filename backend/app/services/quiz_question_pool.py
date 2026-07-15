'''Resolve the effective question bank for authored and sourced quizzes.'''

from sqlalchemy.orm import Session, aliased

from app.models.course import Module
from app.models.lesson import Lesson
from app.models.quiz import Question, QuestionType, Quiz


OWN_POOL = 'own'
ALL_LESSONS_POOL = 'all_lessons'
SELECTED_POOL = 'selected'
QUESTION_POOL_MODES = {OWN_POOL, ALL_LESSONS_POOL, SELECTED_POOL}


def normalized_pool_mode(quiz: Quiz) -> str:
    mode = getattr(quiz, 'question_pool_mode', None) or OWN_POOL
    return mode if mode in QUESTION_POOL_MODES else OWN_POOL


def available_question_rows(db: Session, quiz: Quiz):
    '''Return gradable lesson questions and their course hierarchy metadata.'''
    if quiz.course_id is None:
        return []

    source_quiz = aliased(Quiz)
    return (
        db.query(Question, source_quiz, Lesson, Module)
        .join(source_quiz, Question.quiz_id == source_quiz.id)
        .join(Lesson, source_quiz.lesson_id == Lesson.id)
        .join(Module, Lesson.module_id == Module.id)
        .filter(
            Module.course_id == quiz.course_id,
            Question.question_type != QuestionType.OPINION,
        )
        .order_by(
            Module.order_index,
            Module.id,
            Lesson.order_index,
            Lesson.id,
            source_quiz.order_index,
            source_quiz.id,
            Question.order_index,
            Question.id,
        )
        .all()
    )


def available_lesson_questions(db: Session, quiz: Quiz) -> list[Question]:
    return [row[0] for row in available_question_rows(db, quiz)]


def effective_question_bank(db: Session, quiz: Quiz) -> list[Question]:
    '''Return the only questions this quiz is permitted to deliver and grade.'''
    mode = normalized_pool_mode(quiz)
    if mode == OWN_POOL:
        return sorted(
            list(quiz.questions or []),
            key=lambda question: (question.order_index or 0, question.id or 0),
        )

    available = available_lesson_questions(db, quiz)
    if mode == ALL_LESSONS_POOL:
        return available

    selected_ids = {question.id for question in (quiz.source_questions or [])}
    return [question for question in available if question.id in selected_ids]


def selected_questions_for_ids(
    db: Session,
    quiz: Quiz,
    question_ids: list[int],
) -> list[Question]:
    '''Validate and resolve an ordered, same-course selected source list.'''
    normalized_ids = [int(question_id) for question_id in question_ids]
    if len(normalized_ids) != len(set(normalized_ids)):
        raise ValueError('Question ids must be unique')

    by_id = {
        question.id: question
        for question in available_lesson_questions(db, quiz)
    }
    invalid_ids = [question_id for question_id in normalized_ids if question_id not in by_id]
    if invalid_ids:
        raise ValueError('Selected questions must belong to lesson quizzes in this course')
    return [by_id[question_id] for question_id in normalized_ids]
