from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.sql import func
from app.database import Base


class AuditLog(Base):
    """
    Sensitive-action audit trail. One row per logged action (user CRUD, course
    CRUD, bulk imports, password resets, ...).

    Snapshots actor_username/actor_role and target_label so a row stays readable
    even after the actor or target gets deleted. actor_id FK uses SET NULL on
    delete so deleting an admin doesn't take their audit history with them.
    """
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    actor_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    actor_username = Column(String(100), nullable=False)
    actor_role = Column(String(50), nullable=False)
    # Dot-namespaced verb: "user.create", "course.update", "course.duplicate"
    action = Column(String(64), nullable=False, index=True)
    target_type = Column(String(32), nullable=True)
    target_id = Column(Integer, nullable=True)
    target_label = Column(String(200), nullable=True)
    summary = Column(Text, nullable=True)
    details = Column(JSON, nullable=True)
    ip_address = Column(String(64), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
