from sqlalchemy import Column, Integer, String, Text, Boolean, ForeignKey, DateTime, JSON, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum

from app.database import Base


class QuizPlacement(str, enum.Enum):
    MID_VIDEO = "mid_video"
    END_OF_LESSON = "end_of_lesson"
    FINAL = "final"


class QuestionType(str, enum.Enum):
    SINGLE_CHOICE = "single_choice"
    MULTIPLE_CHOICE = "multiple_choice"
    WRITTEN = "written"
    # Free-response feedback/opinion. Always scored as correct (full points)
    # regardless of what the learner types — including blank.
    OPINION = "opinion"


class Quiz(Base):
    __tablename__ = "quizzes"

    id = Column(Integer, primary_key=True, index=True)
    lesson_id = Column(Integer, ForeignKey("lessons.id", ondelete="CASCADE"), nullable=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), nullable=True, index=True)
    title = Column(String(200), nullable=False)
    placement = Column(SQLEnum(QuizPlacement, name="quizplacement"), nullable=False)
    trigger_time = Column(Integer, nullable=True)  # seconds, for mid_video only
    can_skip = Column(Boolean, default=True, nullable=False)
    show_correct_answer = Column(Boolean, default=True, nullable=False)
    passing_score = Column(Integer, default=70)  # percentage
    order_index = Column(Integer, default=0)
    # Pull a random subset from the question bank on each attempt.
    # When False, all questions in the bank are served in order_index order.
    randomize_questions = Column(Boolean, default=False, nullable=False)
    # How many to serve when randomize_questions is True. If null or ≥ bank size,
    # the whole bank is served (in random order).
    questions_per_attempt = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    lesson = relationship("Lesson", back_populates="quizzes")
    course = relationship("Course")
    questions = relationship("Question", back_populates="quiz", cascade="all, delete-orphan", order_by="Question.order_index")
    attempts = relationship("QuizAttempt", back_populates="quiz", cascade="all, delete-orphan")


class Question(Base):
    __tablename__ = "questions"

    id = Column(Integer, primary_key=True, index=True)
    quiz_id = Column(Integer, ForeignKey("quizzes.id", ondelete="CASCADE"), nullable=False, index=True)
    question_text = Column(Text, nullable=False)
    question_type = Column(SQLEnum(QuestionType, name="questiontype"), nullable=False)
    choices = Column(JSON, nullable=True)  # [{"text": "...", "is_correct": true}, ...]
    correct_text = Column(Text, nullable=True)  # for written questions
    # Rationale shown to learners after they submit (esp. on wrong answers).
    # Optional — null means "no extra context", display falls back to just the
    # correct answer markup.
    explanation = Column(Text, nullable=True)
    points = Column(Integer, default=1)
    order_index = Column(Integer, default=0)

    quiz = relationship("Quiz", back_populates="questions")


class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    quiz_id = Column(Integer, ForeignKey("quizzes.id", ondelete="CASCADE"), nullable=False, index=True)
    score = Column(Integer, default=0)  # percentage 0-100
    answers = Column(JSON, nullable=True)  # {question_id: answer_value}
    is_passed = Column(Boolean, default=False)
    attempted_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User")
    quiz = relationship("Quiz", back_populates="attempts")