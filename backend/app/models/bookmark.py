from sqlalchemy import Column, Integer, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.sql import func
from app.database import Base


class Bookmark(Base):
    """
    Save-for-later. A user can bookmark any course without enrolling — useful
    while scanning the catalog. One row per (user, course); both FKs cascade
    on delete so user-delete and course-delete clean up automatically.
    """
    __tablename__ = "bookmarks"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("user_id", "course_id", name="uq_bookmarks_user_course"),
    )
