"""Row factories used by the characterization tests. All commit immediately."""
from datetime import datetime, timezone

from app.models.course import Course, Module
from app.models.lesson import Lesson, ContentType
from app.models.enrollment import Enrollment
from app.models.progress import LessonProgress
from app.models.quiz import Quiz, Question, QuizAttempt, QuizPlacement, QuestionType


def make_course(db, *, title="หลักสูตรทดสอบ", published=True, **overrides):
    course = Course(
        title=title,
        description=overrides.pop("description", "คำอธิบายหลักสูตร"),
        category=overrides.pop("category", "technical"),
        is_published=published,
        **overrides,
    )
    db.add(course)
    db.commit()
    db.refresh(course)
    return course


def make_module(db, course, *, title="บทที่ 1", order_index=0):
    module = Module(course_id=course.id, title=title, order_index=order_index)
    db.add(module)
    db.commit()
    db.refresh(module)
    return module


def make_lesson(
    db,
    module,
    *,
    title="บทเรียนทดสอบ",
    content_type=ContentType.VIDEO_FILE,
    order_index=0,
    **overrides,
):
    lesson = Lesson(
        module_id=module.id,
        title=title,
        content_type=content_type,
        content_url=overrides.pop("content_url", "/videos/test.mp4"),
        order_index=order_index,
        **overrides,
    )
    db.add(lesson)
    db.commit()
    db.refresh(lesson)
    return lesson


def make_quiz(
    db,
    *,
    course=None,
    lesson=None,
    title="แบบทดสอบ",
    placement=QuizPlacement.FINAL,
    passing_score=70,
    **overrides,
):
    quiz = Quiz(
        course_id=course.id if course else None,
        lesson_id=lesson.id if lesson else None,
        title=title,
        placement=placement,
        passing_score=passing_score,
        **overrides,
    )
    db.add(quiz)
    db.commit()
    db.refresh(quiz)
    return quiz


def make_question(
    db,
    quiz,
    *,
    question_type=QuestionType.SINGLE_CHOICE,
    question_text="คำถามทดสอบ",
    choices=None,
    correct_text=None,
    order_index=0,
    **overrides,
):
    if choices is None and question_type in (
        QuestionType.SINGLE_CHOICE,
        QuestionType.MULTIPLE_CHOICE,
    ):
        choices = [
            {"text": "ตัวเลือกผิด", "is_correct": False},
            {"text": "ตัวเลือกถูก", "is_correct": True},
        ]
    question = Question(
        quiz_id=quiz.id,
        question_text=question_text,
        question_type=question_type,
        choices=choices,
        correct_text=correct_text,
        order_index=order_index,
        **overrides,
    )
    db.add(question)
    db.commit()
    db.refresh(question)
    return question


def enroll(db, user, course):
    enrollment = Enrollment(user_id=user.id, course_id=course.id)
    db.add(enrollment)
    db.commit()
    db.refresh(enrollment)
    return enrollment


def complete_lesson(db, user, lesson):
    progress = LessonProgress(
        user_id=user.id,
        lesson_id=lesson.id,
        completed=True,
        completed_at=datetime.now(timezone.utc),
    )
    db.add(progress)
    db.commit()
    return progress


def complete_all_lessons(db, user, course):
    lessons = (
        db.query(Lesson)
        .join(Module, Module.id == Lesson.module_id)
        .filter(Module.course_id == course.id)
        .all()
    )
    for lesson in lessons:
        complete_lesson(db, user, lesson)
    return lessons


def pass_quiz(db, user, quiz, *, score=100):
    attempt = QuizAttempt(
        user_id=user.id,
        quiz_id=quiz.id,
        score=score,
        answers={},
        is_passed=True,
    )
    db.add(attempt)
    db.commit()
    return attempt


def completed_course(db, user, *, with_final=False, lessons=1, **course_kw):
    """Course the user has fully completed (and passed the final if any)."""
    course = make_course(db, **course_kw)
    module = make_module(db, course)
    for i in range(lessons):
        make_lesson(db, module, title=f"บทเรียนที่ {i + 1}", order_index=i)
    enroll(db, user, course)
    complete_all_lessons(db, user, course)
    if with_final:
        quiz = make_quiz(db, course=course)
        pass_quiz(db, user, quiz)
    return course


def register_payload(**overrides):
    payload = {
        "username": "newuser1",
        "email": "newuser1@example.com",
        "full_name": "ผู้ใช้ ใหม่",
        "password": "secret123",
        "confirm_password": "secret123",
        "department": "กรมป่าไม้",
        "position": "เจ้าหน้าที่",
        "phone": "0812345678",
        "responsibility": "ดูแลพื้นที่ป่า",
        "motivation": "อยากพัฒนาความรู้",
    }
    payload.update(overrides)
    return payload
