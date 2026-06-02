from sqlalchemy import (
    Column,
    Integer,
    Text,
    DateTime,
    ForeignKey,
    UniqueConstraint,
    CheckConstraint,
)
from sqlalchemy.sql import func
from app.database import Base


class CourseFeedback(Base):
    """
    One row per (user, course). Submitted after a learner finishes a course —
    star rating 1-5 + optional free-text comment. Unique constraint means a
    learner can update their feedback (we upsert in the router) but can't post
    multiple rows for the same course.

    CHECK constraint on rating is belt-and-braces; the Pydantic schema also
    bounds it. Both layers because direct DB writes (admin shell, migrations)
    bypass Pydantic.
    """
    __tablename__ = "course_feedback"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True)
    rating = Column(Integer, nullable=False)
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint("user_id", "course_id", name="uq_course_feedback_user_course"),
        CheckConstraint("rating BETWEEN 1 AND 5", name="ck_course_feedback_rating_range"),
    )
