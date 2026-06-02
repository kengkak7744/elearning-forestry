from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Certificate(Base):
    __tablename__ = "certificates"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False, index=True)

    # Public verification key — printed on the PDF and used as the lookup id
    # on the public /verify endpoint. Indexed explicitly (UNIQUE alone is
    # enough on Postgres, but the index name makes the access pattern obvious).
    certificate_number = Column(String(50), unique=True, nullable=False, index=True)
    final_score = Column(Float, nullable=True)
    pdf_path = Column(String(500), nullable=True)

    issued_at = Column(DateTime(timezone=True), server_default=func.now())
    # Snapshot from course.recertify_after_days at issue time. NULL = permanent.
    # Recorded as a snapshot so changing the course policy later doesn't
    # retroactively invalidate previously-issued certificates.
    expires_at = Column(DateTime(timezone=True), nullable=True)

    # Revocation. is_revoked is the load-bearing flag for verification; the
    # other three are context the admin/auditor needs but the verify endpoint
    # never returns to the public (no admin names leak).
    is_revoked = Column(Boolean, nullable=False, server_default="false", default=False)
    revoked_reason = Column(String(500), nullable=True)
    revoked_at = Column(DateTime(timezone=True), nullable=True)
    revoked_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # `foreign_keys` is required because there are two FKs to users.id
    # (user_id = holder, revoked_by_id = admin who pulled it).
    user = relationship("User", back_populates="certificates", foreign_keys=[user_id])
    course = relationship("Course", back_populates="certificates")
    revoked_by = relationship("User", foreign_keys=[revoked_by_id])