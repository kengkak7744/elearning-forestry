from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Certificate(Base):
    __tablename__ = "certificates"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False, index=True)
    
    certificate_number = Column(String(50), unique=True, nullable=False)  # เลขใบรับรอง
    final_score = Column(Float, nullable=True)                            # คะแนนรวม
    pdf_path = Column(String(500), nullable=True)                         # ที่อยู่ไฟล์ PDF
    
    issued_at = Column(DateTime(timezone=True), server_default=func.now())
    # Snapshot from course.recertify_after_days at issue time. NULL = permanent.
    # Recorded as a snapshot so changing the course policy later doesn't
    # retroactively invalidate previously-issued certificates.
    expires_at = Column(DateTime(timezone=True), nullable=True)
    
    user = relationship("User", back_populates="certificates")
    course = relationship("Course", back_populates="certificates")