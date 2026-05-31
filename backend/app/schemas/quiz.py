from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import datetime
from app.models.quiz import QuizPlacement, QuestionType


class QuestionBase(BaseModel):
    question_text: str
    question_type: QuestionType
    choices: Optional[List[dict]] = None  # [{"text": str, "is_correct": bool}]
    correct_text: Optional[str] = None
    # Shown to the learner after they submit (esp. on wrong answers). Optional.
    explanation: Optional[str] = None
    points: int = 1
    order_index: int = 0


class QuestionCreate(QuestionBase):
    pass


class QuestionUpdate(BaseModel):
    question_text: Optional[str] = None
    question_type: Optional[QuestionType] = None
    choices: Optional[List[dict]] = None
    correct_text: Optional[str] = None
    explanation: Optional[str] = None
    points: Optional[int] = None
    order_index: Optional[int] = None


class QuestionResponse(QuestionBase):
    id: int
    quiz_id: int

    class Config:
        from_attributes = True


class QuizBase(BaseModel):
    title: str
    placement: QuizPlacement
    trigger_time: Optional[int] = None
    can_skip: bool = True
    show_correct_answer: bool = True
    passing_score: int = 70
    order_index: int = 0
    randomize_questions: bool = False
    questions_per_attempt: Optional[int] = None


class QuizCreate(QuizBase):
    lesson_id: Optional[int] = None
    course_id: Optional[int] = None


class QuizUpdate(BaseModel):
    title: Optional[str] = None
    trigger_time: Optional[int] = None
    can_skip: Optional[bool] = None
    show_correct_answer: Optional[bool] = None
    passing_score: Optional[int] = None
    order_index: Optional[int] = None
    randomize_questions: Optional[bool] = None
    questions_per_attempt: Optional[int] = None


class QuizResponse(QuizBase):
    id: int
    lesson_id: Optional[int]
    course_id: Optional[int]
    questions: List[QuestionResponse] = []

    class Config:
        from_attributes = True


class AnswerSubmit(BaseModel):
    answers: dict  # {question_id: answer_value}
    # IDs of the questions the learner was actually served. With randomization
    # the server doesn't know which subset the client saw, so the client must
    # tell us. If omitted, fallback = score against the full bank (back-compat).
    question_ids: Optional[List[int]] = None


class AttemptResponse(BaseModel):
    id: int
    user_id: int
    quiz_id: int
    score: int
    answers: dict
    is_passed: bool
    attempted_at: datetime
    # For UI display: which questions were right/wrong
    results: Optional[dict] = None  # {question_id: {"correct": bool, "correct_answer": ...}}

    class Config:
        from_attributes = True