from sqlalchemy import Column, Integer, Text, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.sql import func
from app.database import Base


class LessonNote(Base):
    """
    Free-text per-user notes for a single lesson. One row per (user, lesson)
    — write path is upsert, not append. Both FKs cascade on delete so a user
    or lesson deletion takes notes with it.
    """
    __tablename__ = "lesson_notes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    lesson_id = Column(Integer, ForeignKey("lessons.id", ondelete="CASCADE"), nullable=False, index=True)
    content = Column(Text, nullable=False, default="", server_default="")
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint("user_id", "lesson_id", name="uq_lesson_notes_user_lesson"),
    )
