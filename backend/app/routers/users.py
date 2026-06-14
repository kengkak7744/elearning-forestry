import csv
import io
import re
import secrets
from fastapi import APIRouter, Depends, File, HTTPException, Request, status, Query, UploadFile
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
from app.core.helpers import ensure_unique_user_fields, get_or_404
from app.core.security import hash_password
from app.dependencies import get_current_user, require_admin
from app.services.audit import log_action


router = APIRouter(prefix="/api/users", tags=["Users"])


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    user_data: UserCreate,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """สร้างผู้ใช้ใหม่ (admin only)"""
    ensure_unique_user_fields(db, username=user_data.username, email=user_data.email)

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
    db.flush()
    log_action(
        db, admin, "user.create",
        target_type="user", target_id=new_user.id, target_label=new_user.full_name,
        summary=f"สร้างผู้ใช้ {new_user.username} ({new_user.role.value})",
        request=request,
    )
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
    
    user = get_or_404(db, User, user_id, "ไม่พบผู้ใช้")
    return user


@router.put("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    user_data: UserUpdate,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    user = get_or_404(db, User, user_id, "ไม่พบผู้ใช้")

    update_data = user_data.model_dump(exclude_unset=True)

    # Prevent admin from downgrading their own role (locks them out)
    if user.id == admin.id and "role" in update_data and update_data["role"] != admin.role:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ไม่สามารถเปลี่ยนบทบาทของตัวเองได้",
        )

    # Snapshot before mutating so we can describe the diff in the audit log.
    before = {k: getattr(user, k) for k in update_data}
    for field, value in update_data.items():
        setattr(user, field, value)

    # Highlight the bits regulators care about — role + active flag — in the
    # one-line summary; the full diff goes in `details`.
    notable_changes = []
    if "role" in update_data and before.get("role") != update_data["role"]:
        before_role = before["role"].value if hasattr(before["role"], "value") else str(before["role"])
        after_role = update_data["role"].value if hasattr(update_data["role"], "value") else str(update_data["role"])
        notable_changes.append(f"role {before_role} → {after_role}")
    if "is_active" in update_data and before.get("is_active") != update_data["is_active"]:
        notable_changes.append(
            f"สถานะ {'เปิดใช้งาน' if update_data['is_active'] else 'ระงับ'}"
        )
    summary = (
        f"แก้ไขผู้ใช้ {user.username}"
        + (" — " + ", ".join(notable_changes) if notable_changes else "")
    )
    log_action(
        db, admin, "user.update",
        target_type="user", target_id=user.id, target_label=user.full_name,
        summary=summary,
        details={"changed_fields": list(update_data.keys())},
        request=request,
    )

    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=status.HTTP_200_OK)
def delete_user(
    user_id: int,
    request: Request,
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

    user = get_or_404(db, User, user_id, "ไม่พบผู้ใช้")

    name = user.full_name
    deleted_username = user.username

    # Log BEFORE delete — target row needs to exist for the FK in the audit row
    # to make sense. actor_id stays valid because the actor is the admin, not
    # the deleted user.
    log_action(
        db, admin, "user.delete",
        target_type="user", target_id=user.id, target_label=user.full_name,
        summary=f"ลบบัญชี {deleted_username} ({name})",
        details={"deleted_role": user.role.value if user.role else None},
        request=request,
    )

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
    user = get_or_404(db, User, user_id, "ไม่พบผู้ใช้")

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
            "profile_image": user.profile_image,
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


# ----------------------------------------------------------------------------
# Bulk CSV import — staff onboarding
# ----------------------------------------------------------------------------

_USERNAME_RE = re.compile(r"^[a-zA-Z0-9_.\-]+$")
_VALID_ROLES = {r.value for r in UserRole}
_REQUIRED_COLUMNS = {"username", "email", "full_name", "department", "position", "phone"}
_OPTIONAL_COLUMNS = {"responsibility", "motivation", "role", "password"}
_KNOWN_COLUMNS = _REQUIRED_COLUMNS | _OPTIONAL_COLUMNS


def _generate_password(length: int = 10) -> str:
    """Random password admin will hand to the new user.

    Returned in plaintext to the admin once (in the import response) and
    immediately hashed before storage. Mixed-case alphanumeric, no easily-
    confused characters (0/O/l/I) so it's safe to read off a screen.
    """
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"
    return "".join(secrets.choice(alphabet) for _ in range(length))


@router.post("/bulk-import", status_code=status.HTTP_200_OK)
async def bulk_import_users(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """
    Create many users at once from a CSV upload.

    Required columns: username, email, full_name, department, position, phone
    Optional: responsibility, motivation, role (default learner), password
              (auto-generated when missing)

    All-or-nothing per row, never per file: a malformed row is reported in
    `errors` and the rest of the file continues. Pre-existing username/email
    collisions count as `skipped`.

    Response includes generated plaintext passwords for newly-created users
    so the admin can distribute them once. Plaintext is never persisted; only
    the bcrypt hash goes to the DB.
    """
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="กรุณาอัปโหลดไฟล์ .csv",
        )

    raw = await file.read()
    if len(raw) > 2 * 1024 * 1024:  # 2 MB ≈ ~20k rows of typical width
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ไฟล์ใหญ่เกิน 2 MB",
        )

    # utf-8-sig strips Excel's BOM transparently — Thai admins commonly export
    # CSVs from Excel which prepends one.
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="อ่านไฟล์ไม่ได้ — กรุณาบันทึกเป็น UTF-8",
        )

    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ไฟล์ CSV ไม่มีหัวคอลัมน์",
        )

    headers = {h.strip() for h in reader.fieldnames if h}
    missing = _REQUIRED_COLUMNS - headers
    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"ขาดคอลัมน์ที่จำเป็น: {', '.join(sorted(missing))}",
        )

    # Snapshot what already exists so we don't have to query per row for
    # large imports — a couple hundred rows × 2 queries each adds up.
    existing_rows = db.query(User.username, User.email).all()
    existing_usernames = {u for u, _ in existing_rows}
    existing_emails = {e.lower() for _, e in existing_rows}

    created = []          # [{username, email, full_name, generated_password|null}]
    skipped = []          # [{row, username|email, reason}]
    errors = []           # [{row, reason}]

    # csv.DictReader's line numbering starts at the data row, but we want
    # 1-indexed including the header so admins can match against their file.
    for idx, raw_row in enumerate(reader, start=2):
        row = {k: (v.strip() if isinstance(v, str) else v) for k, v in raw_row.items()}

        username = row.get("username") or ""
        email = (row.get("email") or "").lower()
        full_name = row.get("full_name") or ""

        # --- validation ---
        if not username or not email or not full_name:
            errors.append({"row": idx, "reason": "username/email/full_name ว่างเปล่า"})
            continue
        if len(username) < 3 or len(username) > 50:
            errors.append({"row": idx, "reason": "username ต้องมี 3-50 ตัวอักษร"})
            continue
        if not _USERNAME_RE.match(username):
            errors.append({"row": idx, "reason": "username ใช้ได้เฉพาะ a-z, 0-9, _ . -"})
            continue
        if "@" not in email or "." not in email.split("@")[-1]:
            errors.append({"row": idx, "reason": "รูปแบบอีเมลไม่ถูกต้อง"})
            continue

        if username in existing_usernames:
            skipped.append({"row": idx, "username": username, "reason": "username ซ้ำในระบบ"})
            continue
        if email in existing_emails:
            skipped.append({"row": idx, "email": email, "reason": "email ซ้ำในระบบ"})
            continue

        role_str = (row.get("role") or "learner").lower()
        if role_str not in _VALID_ROLES:
            errors.append({"row": idx, "reason": f"role ไม่ถูกต้อง (ต้องเป็น {', '.join(sorted(_VALID_ROLES))})"})
            continue

        password = row.get("password") or ""
        generated = False
        if not password:
            password = _generate_password()
            generated = True
        elif len(password) < 6:
            errors.append({"row": idx, "reason": "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร"})
            continue

        new_user = User(
            username=username,
            email=email,
            full_name=full_name,
            hashed_password=hash_password(password),
            role=UserRole(role_str),
            department=row.get("department") or "",
            position=row.get("position") or "",
            phone=row.get("phone") or "",
            responsibility=row.get("responsibility") or "-",
            motivation=row.get("motivation") or "-",
        )
        db.add(new_user)
        # Add to in-memory sets so a duplicate WITHIN the file also gets caught.
        existing_usernames.add(username)
        existing_emails.add(email)
        created.append({
            "row": idx,
            "username": username,
            "email": email,
            "full_name": full_name,
            "generated_password": password if generated else None,
        })

    # Commit once at the end — atomic block per import; bcrypt hashing is the
    # expensive part, the DB write itself is cheap.
    if created:
        log_action(
            db, admin, "user.bulk_import",
            target_type="user", target_label=f"{len(created)} ผู้ใช้",
            summary=f"นำเข้าผู้ใช้จาก CSV สำเร็จ {len(created)} คน (ข้าม {len(skipped)}, ผิดพลาด {len(errors)})",
            details={
                "created_count": len(created),
                "skipped_count": len(skipped),
                "error_count": len(errors),
                "filename": file.filename,
            },
            request=request,
        )
        db.commit()

    return {
        "created_count": len(created),
        "skipped_count": len(skipped),
        "error_count": len(errors),
        "created": created,
        "skipped": skipped,
        "errors": errors,
    }


@router.post("/{user_id}/reset-password", status_code=status.HTTP_200_OK)
def reset_user_password(
    user_id: int,
    data: AdminResetPassword,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """รีเซ็ตรหัสผ่านของผู้ใช้ (admin only)"""
    if user_id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ไม่สามารถรีเซ็ตรหัสผ่านของตัวเองได้ ใช้หน้า Profile แทน"
        )

    user = get_or_404(db, User, user_id, "ไม่พบผู้ใช้")

    user.hashed_password = hash_password(data.new_password)
    log_action(
        db, admin, "user.reset_password",
        target_type="user", target_id=user.id, target_label=user.full_name,
        summary=f"รีเซ็ตรหัสผ่านของ {user.username}",
        request=request,
    )
    db.commit()

    return {
        "message": f"รีเซ็ตรหัสผ่านของ {user.full_name} สำเร็จ",
        "username": user.username
    }
