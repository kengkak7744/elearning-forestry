from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from typing import Optional
from app.database import get_db
from app.models.user import User, UserRole
from app.models.progress import LessonProgress
from app.models.certificate import Certificate
from app.models.quiz import Quiz, QuizAttempt
from app.models.enrollment import Enrollment
from app.models.course import Course, Module
from app.models.lesson import Lesson
from app.models.lesson_note import LessonNote
from app.schemas.user import UserCreate, UserUpdate, UserResponse, AdminResetPassword
from app.core.security import hash_password
from app.dependencies import get_current_user, require_admin


router = APIRouter(prefix="/api/users", tags=["Users"])


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    user_data: UserCreate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin)
):
    """สร้างผู้ใช้ใหม่ (admin only)"""
    if db.query(User).filter(User.username == user_data.username).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"ชื่อผู้ใช้ '{user_data.username}' มีอยู่ในระบบแล้ว"
        )
    
    if db.query(User).filter(User.email == user_data.email).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="อีเมลนี้มีอยู่ในระบบแล้ว"
        )
    
    new_user = User(
        username=user_data.username,
        email=user_data.email,
        full_name=user_data.full_name,
        hashed_password=hash_password(user_data.password),
        role=user_data.role,
        department=user_data.department,
        position=user_data.position,
        phone=user_data.phone,                          
        responsibility=user_data.responsibility,        
        motivation=user_data.motivation,                
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@router.get("", response_model=list[UserResponse])
def list_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    search: Optional[str] = Query(None, description="ค้นหาจากชื่อ username หรืออีเมล"),
    role: Optional[UserRole] = None,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin)
):
    query = db.query(User)
    
    if search:
        query = query.filter(or_(
            User.full_name.ilike(f"%{search}%"),
            User.username.ilike(f"%{search}%"),
            User.email.ilike(f"%{search}%"),
        ))
    
    if role:
        query = query.filter(User.role == role)
    
    return query.offset(skip).limit(limit).all()


@router.get("/{user_id}", response_model=UserResponse)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.id != user_id and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="ไม่มีสิทธิ์ดูข้อมูลผู้ใช้คนอื่น"
        )
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="ไม่พบผู้ใช้")
    return user


@router.put("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    user_data: UserUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="ไม่พบผู้ใช้")

    update_data = user_data.model_dump(exclude_unset=True)

    # Prevent admin from downgrading their own role (locks them out)
    if user.id == admin.id and "role" in update_data and update_data["role"] != admin.role:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ไม่สามารถเปลี่ยนบทบาทของตัวเองได้",
        )

    for field, value in update_data.items():
        setattr(user, field, value)

    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=status.HTTP_200_OK)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """
    Hard-delete a user and all their learning records.

    SQLAlchemy's default cascade behavior on a `back_populates` relationship is
    to UPDATE the child's FK to NULL when the parent is deleted (orphan it).
    That fails on any child whose user_id column is NOT NULL — which is all of
    them here. So we bypass the ORM cascade by issuing bulk DELETEs against
    each child table explicitly before deleting the user row.

    enrollments is the one exception: User.enrollments has
    cascade="all, delete-orphan" which makes SQLAlchemy issue DELETEs (not
    UPDATEs) when the parent is removed, so we don't need to touch them here.
    """
    if user_id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ไม่สามารถลบบัญชีของตัวเองได้"
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="ไม่พบผู้ใช้")

    name = user.full_name

    db.query(QuizAttempt).filter(QuizAttempt.user_id == user_id).delete(synchronize_session=False)
    db.query(LessonProgress).filter(LessonProgress.user_id == user_id).delete(synchronize_session=False)
    db.query(Certificate).filter(Certificate.user_id == user_id).delete(synchronize_session=False)
    # LessonNote has DB-level ON DELETE CASCADE, but we delete explicitly to
    # match the surrounding pattern and stay defensive against ORM cascade quirks.
    db.query(LessonNote).filter(LessonNote.user_id == user_id).delete(synchronize_session=False)
    db.delete(user)
    db.commit()

    return {"message": f"ลบบัญชี {name} เรียบร้อย"}


@router.get("/{user_id}/learning-summary")
def user_learning_summary(
    user_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Admin view of a learner's full activity: enrollments, certificates, quiz stats."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="ไม่พบผู้ใช้")

    enrollments = (
        db.query(Enrollment)
        .filter(Enrollment.user_id == user_id)
        .order_by(Enrollment.enrolled_at.desc())
        .all()
    )

    course_ids = [e.course_id for e in enrollments]
    courses_map = (
        {c.id: c for c in db.query(Course).filter(Course.id.in_(course_ids)).all()}
        if course_ids else {}
    )

    lesson_counts = dict(
        db.query(Module.course_id, func.count(Lesson.id))
        .join(Lesson, Lesson.module_id == Module.id)
        .filter(Module.course_id.in_(course_ids))
        .group_by(Module.course_id)
        .all()
    ) if course_ids else {}

    completed_counts = dict(
        db.query(Module.course_id, func.count(LessonProgress.id))
        .join(Lesson, Lesson.module_id == Module.id)
        .join(LessonProgress, LessonProgress.lesson_id == Lesson.id)
        .filter(
            Module.course_id.in_(course_ids),
            LessonProgress.user_id == user_id,
            LessonProgress.completed == True,
        )
        .group_by(Module.course_id)
        .all()
    ) if course_ids else {}

    last_access = dict(
        db.query(Module.course_id, func.max(LessonProgress.last_accessed_at))
        .join(Lesson, Lesson.module_id == Module.id)
        .join(LessonProgress, LessonProgress.lesson_id == Lesson.id)
        .filter(
            Module.course_id.in_(course_ids),
            LessonProgress.user_id == user_id,
        )
        .group_by(Module.course_id)
        .all()
    ) if course_ids else {}

    enrollments_out = []
    for e in enrollments:
        c = courses_map.get(e.course_id)
        if not c:
            continue
        total = lesson_counts.get(c.id, 0)
        done = completed_counts.get(c.id, 0)
        pct = int((done / total) * 100) if total > 0 else 0
        enrollments_out.append({
            "course_id": c.id,
            "title": c.title,
            "category": c.category.value if c.category else None,
            "cover_image": c.cover_image,
            "is_mandatory": c.is_mandatory,
            "enrolled_at": e.enrolled_at.isoformat() if e.enrolled_at else None,
            "total_lessons": total,
            "completed_lessons": done,
            "progress_percent": pct,
            "last_accessed_at": last_access[c.id].isoformat() if last_access.get(c.id) else None,
        })

    certificates = (
        db.query(Certificate)
        .filter(Certificate.user_id == user_id)
        .order_by(Certificate.issued_at.desc())
        .all()
    )
    cert_course_ids = [c.course_id for c in certificates]
    cert_courses_map = (
        {c.id: c for c in db.query(Course).filter(Course.id.in_(cert_course_ids)).all()}
        if cert_course_ids else {}
    )
    certificates_out = [
        {
            "id": c.id,
            "course_id": c.course_id,
            "course_title": cert_courses_map.get(c.course_id).title if cert_courses_map.get(c.course_id) else None,
            "certificate_number": c.certificate_number,
            "final_score": c.final_score,
            "issued_at": c.issued_at.isoformat() if c.issued_at else None,
        }
        for c in certificates
    ]

    # Quiz stats: best-score-per-quiz to avoid double counting retries.
    attempts = (
        db.query(QuizAttempt)
        .filter(QuizAttempt.user_id == user_id)
        .all()
    )
    total_attempts = len(attempts)
    best_per_quiz = {}
    for a in attempts:
        cur = best_per_quiz.get(a.quiz_id)
        if cur is None or (a.score or 0) > cur[0]:
            best_per_quiz[a.quiz_id] = (a.score or 0, bool(a.is_passed))
    unique_quizzes = len(best_per_quiz)
    passed_count = sum(1 for _, passed in best_per_quiz.values() if passed)
    average_score = round(
        sum(score for score, _ in best_per_quiz.values()) / unique_quizzes
    ) if unique_quizzes else 0

    return {
        "user": {
            "id": user.id,
            "username": user.username,
            "full_name": user.full_name,
            "email": user.email,
            "role": user.role.value,
            "department": user.department,
            "position": user.position,
            "created_at": user.created_at.isoformat() if user.created_at else None,
        },
        "enrollments": enrollments_out,
        "certificates": certificates_out,
        "quiz_stats": {
            "total_attempts": total_attempts,
            "unique_quizzes": unique_quizzes,
            "passed_count": passed_count,
            "average_score": average_score,
        },
    }


@router.post("/{user_id}/reset-password", status_code=status.HTTP_200_OK)
def reset_user_password(
    user_id: int,
    data: AdminResetPassword,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """รีเซ็ตรหัสผ่านของผู้ใช้ (admin only)"""
    if user_id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ไม่สามารถรีเซ็ตรหัสผ่านของตัวเองได้ ใช้หน้า Profile แทน"
        )
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="ไม่พบผู้ใช้")
    
    user.hashed_password = hash_password(data.new_password)
    db.commit()
    
    return {
        "message": f"รีเซ็ตรหัสผ่านของ {user.full_name} สำเร็จ",
        "username": user.username
    }