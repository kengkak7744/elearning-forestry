import logging
import os
import shutil
import uuid
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, Response
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import func
from typing import Optional
from app.config import settings
from app.database import get_db
from app.models.bookmark import Bookmark
from app.models.course import Course, Module, CourseCategory
from app.models.lesson import Lesson, LessonResource, ContentType
from app.models.lesson_note import LessonNote
from app.models.quiz import Quiz, Question, QuizAttempt
from app.models.enrollment import Enrollment
from app.models.user import User
from app.schemas.course import (
    CourseCreate, CourseUpdate, CourseResponse, CourseListItem
)
from app.core.helpers import get_or_404
from app.dependencies import get_current_user, require_instructor_or_admin
from app.services.audit import log_action
from app.services.quiz_delivery import quiz_to_learner_dict
from fastapi import Request


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/courses", tags=["Courses"])

IMAGE_DIR = Path(settings.IMAGE_DIR)
MAX_IMAGE_SIZE = settings.MAX_IMAGE_SIZE
ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}

# Duplicate-course media copy uses the same dirs as the upload paths in lessons.py.
_VIDEO_DIR = Path(settings.VIDEO_DIR)
_PDF_DIR = Path(settings.PDF_DIR)


def _copy_media_file(content_url: Optional[str]) -> Optional[str]:
    """Return a new content_url pointing at a fresh copy of the source file.

    If the source file is missing on disk, return the original URL unchanged —
    a clone with a broken link is still better than failing the whole duplicate
    operation (the admin can re-upload to fix it).
    """
    if not content_url:
        return content_url
    name = Path(content_url).name
    if content_url.startswith("/videos/"):
        src_dir, url_prefix = _VIDEO_DIR, "/videos"
    elif content_url.startswith("/pdfs/"):
        src_dir, url_prefix = _PDF_DIR, "/pdfs"
    else:
        # External link or unknown path scheme — share as-is.
        return content_url
    src_path = src_dir / name
    if not src_path.exists():
        logger.warning("clone: source media missing, sharing URL: %s", content_url)
        return content_url
    ext = Path(name).suffix
    new_name = f"{uuid.uuid4().hex}{ext}"
    dest_path = src_dir / new_name
    try:
        shutil.copy2(src_path, dest_path)
    except OSError:
        logger.exception("clone: failed to copy %s", src_path)
        return content_url
    return f"{url_prefix}/{new_name}"


def _clone_quiz_into(source_quiz: Quiz, db: Session, *, new_course_id=None, new_lesson_id=None) -> Quiz:
    """Deep-copy a quiz including all its questions."""
    new_quiz = Quiz(
        course_id=new_course_id,
        lesson_id=new_lesson_id,
        title=source_quiz.title,
        placement=source_quiz.placement,
        trigger_time=source_quiz.trigger_time,
        can_skip=source_quiz.can_skip,
        show_correct_answer=source_quiz.show_correct_answer,
        passing_score=source_quiz.passing_score,
        order_index=source_quiz.order_index,
        randomize_questions=source_quiz.randomize_questions,
        questions_per_attempt=source_quiz.questions_per_attempt,
    )
    db.add(new_quiz)
    db.flush()  # need new_quiz.id for child Questions
    for src_q in source_quiz.questions:
        db.add(Question(
            quiz_id=new_quiz.id,
            question_text=src_q.question_text,
            question_type=src_q.question_type,
            choices=src_q.choices,
            correct_text=src_q.correct_text,
            explanation=src_q.explanation,
            points=src_q.points,
            order_index=src_q.order_index,
        ))
    return new_quiz


@router.get("", response_model=list[CourseListItem])
def list_courses(
    response: Response,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    category: Optional[str] = None,
    is_mandatory: Optional[bool] = None,
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Catalog rarely changes per-user; cache in browser for 30s to dedupe back-navigation.
    response.headers["Cache-Control"] = "private, max-age=30"
    query = db.query(Course)
    
    if current_user.role.value in ("learner", "manager"):
        query = query.filter(Course.is_published == True)
    
    if category:
        query = query.filter(Course.category == category)
    
    if is_mandatory is not None:
        query = query.filter(Course.is_mandatory == is_mandatory)
    
    if search:
        # Match the term against title OR description so a phrase like
        # "ดับไฟป่า" surfaces courses whose title doesn't mention it directly
        # but whose summary does.
        from sqlalchemy import or_ as _or
        like = f"%{search}%"
        query = query.filter(_or(Course.title.ilike(like), Course.description.ilike(like)))
    
    courses = query.order_by(Course.created_at.desc()).offset(skip).limit(limit).all()

    # Enrollment count per course for this page. One grouped query keyed by the
    # ids actually being returned (no N+1), then stamp the non-mapped attribute
    # CourseListItem serialises from. Without this the schema default of 0 ships
    # for every row, so the admin "ผู้ลงทะเบียน" column always read 0.
    if courses:
        counts = dict(
            db.query(Enrollment.course_id, func.count(Enrollment.id))
            .filter(Enrollment.course_id.in_([c.id for c in courses]))
            .group_by(Enrollment.course_id)
            .all()
        )
        for c in courses:
            c.enrolled_count = counts.get(c.id, 0)

    return courses


@router.get("/{course_id}")
def get_course(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # selectinload (not joinedload): avoids cartesian module×lesson row explosion;
    # each relationship loads via a single IN query. Also chain into
    # Lesson.resources so the admin editor and learner viewer both see the
    # full attached-document list without N+1 queries.
    course = db.query(Course).options(
        selectinload(Course.modules)
        .selectinload(Module.lessons)
        .selectinload(Lesson.resources)
    ).filter(Course.id == course_id).first()
    
    if not course:
        raise HTTPException(status_code=404, detail="ไม่พบหลักสูตร")
    
    if current_user.role.value in ("learner", "manager") and not course.is_published:
        raise HTTPException(status_code=404, detail="ไม่พบหลักสูตร")
    
    total_modules = len(course.modules)
    total_lessons = sum(len(m.lessons) for m in course.modules)
    enrolled_count = db.query(func.count(Enrollment.id)).filter(Enrollment.course_id == course_id).scalar()
    
    is_enrolled = db.query(Enrollment).filter(
        Enrollment.user_id == current_user.id,
        Enrollment.course_id == course_id
    ).first() is not None

    is_bookmarked = db.query(Bookmark).filter(
        Bookmark.user_id == current_user.id,
        Bookmark.course_id == course_id,
    ).first() is not None
    can_access_content = is_enrolled or current_user.role.value in ("admin", "instructor")
    lesson_ids = [lesson.id for module in course.modules for lesson in module.lessons]
    lesson_quizzes_by_lesson: dict[int, list[dict]] = {}
    if can_access_content and lesson_ids:
        lesson_quizzes = (
            db.query(Quiz)
            .options(selectinload(Quiz.questions))
            .filter(Quiz.lesson_id.in_(lesson_ids))
            .order_by(Quiz.order_index)
            .all()
        )
        quiz_ids = [quiz.id for quiz in lesson_quizzes]
        best_by_quiz = {}
        if quiz_ids:
            attempts = (
                db.query(QuizAttempt)
                .filter(
                    QuizAttempt.user_id == current_user.id,
                    QuizAttempt.quiz_id.in_(quiz_ids),
                )
                .all()
            )
            for attempt in attempts:
                existing = best_by_quiz.get(attempt.quiz_id)
                if not existing or attempt.score > existing["score"]:
                    best_by_quiz[attempt.quiz_id] = {
                        "score": attempt.score,
                        "is_passed": attempt.is_passed,
                    }
        for quiz in lesson_quizzes:
            lesson_quizzes_by_lesson.setdefault(quiz.lesson_id, []).append(
                quiz_to_learner_dict(
                    quiz,
                    current_user,
                    include_status=True,
                    best=best_by_quiz.get(quiz.id),
                )
            )

    modules_data = []
    for module in sorted(course.modules, key=lambda m: m.order_index):
        lessons_data = []
        for lesson in sorted(module.lessons, key=lambda l: l.order_index):
            lessons_data.append({
                "id": lesson.id,
                "module_id": lesson.module_id,
                "title": lesson.title,
                "description": lesson.description,
                "content_type": lesson.content_type.value if lesson.content_type else None,
                "content_url": lesson.content_url if can_access_content else None,
                "caption_url": lesson.caption_url if can_access_content else None,
                "transcript": lesson.transcript if can_access_content else None,
                "duration_seconds": lesson.duration_seconds,
                "total_pages": lesson.total_pages,
                "notes_content": lesson.notes_content if can_access_content else None,
                "order_index": lesson.order_index,
                "min_view_seconds": lesson.min_view_seconds,
                "quizzes": lesson_quizzes_by_lesson.get(lesson.id, []),
                # Supplementary downloads / external links attached to this
                # lesson. The admin editor and the learner viewer both
                # consume this field — adding it here means a single
                # course-fetch shows everything that's actually saved.
                "resources": [
                    {
                        "id": r.id,
                        "title": r.title,
                        "url": r.url,
                        "resource_type": r.resource_type,
                        "file_size": r.file_size,
                    }
                    for r in ((lesson.resources or []) if can_access_content else [])
                ],
            })
        modules_data.append({
            "id": module.id,
            "course_id": module.course_id,
            "title": module.title,
            "description": module.description,
            "order_index": module.order_index,
            "lessons": lessons_data,
        })
    
    return {
        "id": course.id,
        "title": course.title,
        "description": course.description,
        "category": course.category,
        "is_mandatory": course.is_mandatory,
        "cover_image": course.cover_image,
        "estimated_hours": course.estimated_hours,
        "instructor_name": course.instructor_name,
        "is_published": course.is_published,
        "allow_downloads": course.allow_downloads,
        "created_at": course.created_at.isoformat() if course.created_at else None,
        "updated_at": course.updated_at.isoformat() if course.updated_at else None,
        "total_modules": total_modules,
        "total_lessons": total_lessons,
        "enrolled_count": enrolled_count or 0,
        "is_enrolled": is_enrolled,
        "is_bookmarked": is_bookmarked,
        "modules": modules_data,
    }


def _validate_category(db: Session, value: str) -> None:
    """Reject course writes whose category isn't in course_categories —
    a plain string column means the DB no longer enforces this itself."""
    if not db.query(CourseCategory).filter(CourseCategory.value == value).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ไม่พบหมวดหมู่นี้ กรุณาเลือกจากรายการหมวดหมู่",
        )


@router.post("", response_model=CourseResponse, status_code=status.HTTP_201_CREATED)
def create_course(
    course_data: CourseCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_instructor_or_admin)
):
    _validate_category(db, course_data.category)
    new_course = Course(**course_data.model_dump())
    db.add(new_course)
    db.flush()
    log_action(
        db, user, "course.create",
        target_type="course", target_id=new_course.id, target_label=new_course.title,
        summary=f"สร้างหลักสูตร {new_course.title}",
        request=request,
    )
    db.commit()
    db.refresh(new_course)
    return {
        **new_course.__dict__,
        "total_modules": 0,
        "total_lessons": 0,
        "enrolled_count": 0,
        "is_enrolled": False,
    }


@router.put("/{course_id}", response_model=CourseResponse)
def update_course(
    course_id: int,
    course_data: CourseUpdate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_instructor_or_admin)
):
    course = get_or_404(db, Course, course_id, "ไม่พบหลักสูตร")

    update_data = course_data.model_dump(exclude_unset=True)
    if "category" in update_data:
        _validate_category(db, update_data["category"])

    # Snapshot the bits regulators care about — publish state + mandatory flag.
    before = {k: getattr(course, k) for k in update_data}
    for field, value in update_data.items():
        setattr(course, field, value)

    notable_changes = []
    if "is_published" in update_data and before.get("is_published") != update_data["is_published"]:
        notable_changes.append("เผยแพร่" if update_data["is_published"] else "ถอนเผยแพร่")
    if "is_mandatory" in update_data and before.get("is_mandatory") != update_data["is_mandatory"]:
        notable_changes.append(
            "ตั้งเป็นบังคับ" if update_data["is_mandatory"] else "ปลดสถานะบังคับ"
        )
    summary = (
        f"แก้ไขหลักสูตร {course.title}"
        + (" — " + ", ".join(notable_changes) if notable_changes else "")
    )
    log_action(
        db, user, "course.update",
        target_type="course", target_id=course.id, target_label=course.title,
        summary=summary,
        details={"changed_fields": list(update_data.keys())},
        request=request,
    )

    db.commit()
    db.refresh(course)
    return get_course(course_id, db, user)


@router.delete("/{course_id}", status_code=status.HTTP_200_OK)
def delete_course(
    course_id: int,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_instructor_or_admin)
):
    course = get_or_404(db, Course, course_id, "ไม่พบหลักสูตร")

    title = course.title
    log_action(
        db, user, "course.delete",
        target_type="course", target_id=course.id, target_label=title,
        summary=f"ลบหลักสูตร {title}",
        request=request,
    )
    db.delete(course)
    db.commit()

    return {"message": f"ลบหลักสูตร '{title}' เรียบร้อย"}


@router.post("/{course_id}/duplicate", status_code=status.HTTP_201_CREATED)
def duplicate_course(
    course_id: int,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_instructor_or_admin),
):
    """
    Deep-clone a course into a new draft (is_published=False).

    Copies: modules → lessons → lesson resources → quizzes → questions, plus
    a fresh physical copy of every uploaded video/PDF (so deleting either
    course later doesn't break the other one).

    Does NOT copy: enrollments, lesson progress, quiz attempts, certificates,
    bookmarks, learner notes — those are per-user history and shouldn't
    transfer to a brand new variant.

    Cover image is shared by URL — re-uploading is trivial if the admin wants
    a different cover for the variant.
    """
    source = (
        db.query(Course)
        .options(
            selectinload(Course.modules)
            .selectinload(Module.lessons)
            .selectinload(Lesson.resources),
            selectinload(Course.modules)
            .selectinload(Module.lessons)
            .selectinload(Lesson.quizzes)
            .selectinload(Quiz.questions),
        )
        .filter(Course.id == course_id)
        .first()
    )
    if not source:
        raise HTTPException(status_code=404, detail="ไม่พบหลักสูตร")

    new_course = Course(
        title=f"[สำเนา] {source.title}",
        description=source.description,
        category=source.category,
        is_mandatory=source.is_mandatory,
        cover_image=source.cover_image,
        estimated_hours=source.estimated_hours,
        instructor_name=source.instructor_name,
        is_published=False,
        recertify_after_days=source.recertify_after_days,
    )
    db.add(new_course)
    db.flush()

    # Course-level (final) quizzes attach via course_id, not via any lesson.
    course_level_quizzes = (
        db.query(Quiz)
        .options(selectinload(Quiz.questions))
        .filter(Quiz.course_id == source.id)
        .all()
    )
    for q in course_level_quizzes:
        _clone_quiz_into(q, db, new_course_id=new_course.id)

    for source_module in sorted(source.modules, key=lambda m: m.order_index or 0):
        new_module = Module(
            course_id=new_course.id,
            title=source_module.title,
            description=source_module.description,
            order_index=source_module.order_index,
        )
        db.add(new_module)
        db.flush()

        for source_lesson in sorted(source_module.lessons, key=lambda l: l.order_index or 0):
            # Physically copy uploaded media so the clone is independent.
            new_content_url = source_lesson.content_url
            if source_lesson.content_type in (ContentType.VIDEO_FILE, ContentType.PDF):
                new_content_url = _copy_media_file(source_lesson.content_url)
            new_caption_url = _copy_media_file(source_lesson.caption_url)

            new_lesson = Lesson(
                module_id=new_module.id,
                title=source_lesson.title,
                description=source_lesson.description,
                content_type=source_lesson.content_type,
                content_url=new_content_url,
                caption_url=new_caption_url,
                transcript=source_lesson.transcript,
                duration_seconds=source_lesson.duration_seconds,
                total_pages=source_lesson.total_pages,
                notes_content=source_lesson.notes_content,
                order_index=source_lesson.order_index,
                min_view_seconds=source_lesson.min_view_seconds,
            )
            db.add(new_lesson)
            db.flush()

            for src_res in source_lesson.resources:
                db.add(LessonResource(
                    lesson_id=new_lesson.id,
                    title=src_res.title,
                    resource_type=src_res.resource_type,
                    url=src_res.url,
                    file_size=src_res.file_size,
                ))

            for src_quiz in source_lesson.quizzes:
                _clone_quiz_into(src_quiz, db, new_lesson_id=new_lesson.id)

    log_action(
        db, user, "course.duplicate",
        target_type="course", target_id=new_course.id, target_label=new_course.title,
        summary=f"ทำสำเนาหลักสูตร {source.title} → {new_course.title}",
        details={"source_course_id": source.id},
        request=request,
    )
    db.commit()
    db.refresh(new_course)
    logger.info("clone: course %s → %s by user-action", source.id, new_course.id)
    return {
        "id": new_course.id,
        "title": new_course.title,
        "message": f"ทำสำเนาหลักสูตร '{source.title}' เรียบร้อย",
    }


@router.post("/{course_id}/upload-cover")
async def upload_cover_image(
    course_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _user: User = Depends(require_instructor_or_admin)
):
    """Upload a course cover image."""
    course = get_or_404(db, Course, course_id, "ไม่พบหลักสูตร")

    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"รองรับเฉพาะไฟล์ {', '.join(ALLOWED_IMAGE_EXTENSIONS)}"
        )

    # Stream to disk (chunked, with size limit enforced during streaming)
    IMAGE_DIR.mkdir(parents=True, exist_ok=True)
    unique_name = f"{uuid.uuid4().hex}{ext}"
    file_path = IMAGE_DIR / unique_name
    total = 0
    CHUNK = 1024 * 256  # 256 KB
    try:
        with file_path.open("wb") as out:
            while True:
                chunk = await file.read(CHUNK)
                if not chunk:
                    break
                total += len(chunk)
                if total > MAX_IMAGE_SIZE:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"ไฟล์ใหญ่เกิน {MAX_IMAGE_SIZE // (1024*1024)} MB"
                    )
                out.write(chunk)
    except HTTPException:
        if file_path.exists():
            try: file_path.unlink()
            except Exception: pass
        raise

    if course.cover_image and (course.cover_image.startswith("/images/") or course.cover_image.startswith("/elearning/images/")):
        old_path = IMAGE_DIR / Path(course.cover_image).name
        if old_path.exists():
            old_path.unlink()

    course.cover_image = f"/elearning/images/{unique_name}"
    db.commit()
    db.refresh(course)
    return {"cover_image": course.cover_image}


# Enrollment endpoints

@router.get("/me/enrollments")
def my_enrollments(
    response: Response,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Courses I'm enrolled in + my progress on each."""
    # User-specific; short cache so dashboard back-nav doesn't refetch but progress still feels live.
    response.headers["Cache-Control"] = "private, max-age=10"
    from app.models.progress import LessonProgress
    from app.models.lesson import Lesson

    # All my enrollments
    enrollments = (
        db.query(Enrollment)
        .filter(Enrollment.user_id == current_user.id)
        .order_by(Enrollment.enrolled_at.desc())
        .all()
    )
    if not enrollments:
        return []

    course_ids = [e.course_id for e in enrollments]

    # Total lessons per course (one query)
    lesson_counts = dict(
        db.query(Module.course_id, func.count(Lesson.id))
        .join(Lesson, Lesson.module_id == Module.id)
        .filter(Module.course_id.in_(course_ids))
        .group_by(Module.course_id)
        .all()
    )

    # Completed lessons per course for this user (one query)
    completed_counts = dict(
        db.query(Module.course_id, func.count(LessonProgress.id))
        .join(Lesson, Lesson.module_id == Module.id)
        .join(LessonProgress, LessonProgress.lesson_id == Lesson.id)
        .filter(
            Module.course_id.in_(course_ids),
            LessonProgress.user_id == current_user.id,
            LessonProgress.completed == True,
        )
        .group_by(Module.course_id)
        .all()
    )

    # Most-recent lesson access per course
    last_access_rows = (
        db.query(Module.course_id, func.max(LessonProgress.last_accessed_at))
        .join(Lesson, Lesson.module_id == Module.id)
        .join(LessonProgress, LessonProgress.lesson_id == Lesson.id)
        .filter(
            Module.course_id.in_(course_ids),
            LessonProgress.user_id == current_user.id,
        )
        .group_by(Module.course_id)
        .all()
    )
    last_access = {cid: ts for cid, ts in last_access_rows}

    # Fetch course objects once
    courses = {c.id: c for c in db.query(Course).filter(Course.id.in_(course_ids)).all()}

    result = []
    for e in enrollments:
        c = courses.get(e.course_id)
        if not c:
            continue
        total = lesson_counts.get(c.id, 0)
        done = completed_counts.get(c.id, 0)
        pct = int((done / total) * 100) if total > 0 else 0
        result.append({
            "course_id": c.id,
            "title": c.title,
            "category": c.category,
            "cover_image": c.cover_image,
            "is_mandatory": c.is_mandatory,
            "instructor_name": c.instructor_name,
            "estimated_hours": c.estimated_hours,
            "enrolled_at": e.enrolled_at.isoformat() if e.enrolled_at else None,
            "total_lessons": total,
            "completed_lessons": done,
            "progress_percent": pct,
            "last_accessed_at": last_access.get(c.id).isoformat() if last_access.get(c.id) else None,
        })
    return result


@router.post("/{course_id}/enroll", status_code=status.HTTP_201_CREATED)
def enroll_course(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Enroll the current user in a course."""
    course = get_or_404(db, Course, course_id, "ไม่พบหลักสูตร")
    
    if not course.is_published and current_user.role.value in ("learner", "manager"):
        raise HTTPException(status_code=404, detail="ไม่พบหลักสูตร")
    
    existing = db.query(Enrollment).filter(
        Enrollment.user_id == current_user.id,
        Enrollment.course_id == course_id
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="คุณลงทะเบียนหลักสูตรนี้แล้ว"
        )
    
    enrollment = Enrollment(
        user_id=current_user.id,
        course_id=course_id,
    )
    db.add(enrollment)
    db.commit()
    
    return {
        "message": f"ลงทะเบียนหลักสูตร '{course.title}' สำเร็จ",
        "course_id": course_id,
    }


@router.delete("/{course_id}/enroll", status_code=status.HTTP_200_OK)
def unenroll_course(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Cancel the current user's course enrollment."""
    enrollment = db.query(Enrollment).filter(
        Enrollment.user_id == current_user.id,
        Enrollment.course_id == course_id
    ).first()
    
    if not enrollment:
        raise HTTPException(status_code=404, detail="คุณยังไม่ได้ลงทะเบียนหลักสูตรนี้")
    
    db.delete(enrollment)
    db.commit()
    
    return {"message": "ยกเลิกการลงทะเบียนเรียบร้อย"}


# ============================================================================
# Bookmarks (save-for-later)
# ============================================================================


@router.get("/me/bookmarks")
def my_bookmarks(
    response: Response,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Courses I've bookmarked. Returns the same shape as the catalog list."""
    # Private list, can change without warning — short cache for back-nav only.
    response.headers["Cache-Control"] = "private, max-age=10"
    rows = (
        db.query(Course)
        .join(Bookmark, Bookmark.course_id == Course.id)
        .filter(Bookmark.user_id == current_user.id)
        .order_by(Bookmark.created_at.desc())
        .all()
    )
    # Hide unpublished for learners/managers; a course unpublished after they
    # bookmarked it shouldn't haunt the list.
    if current_user.role.value in ("learner", "manager"):
        rows = [c for c in rows if c.is_published]
    return rows


@router.post("/{course_id}/bookmark", status_code=status.HTTP_201_CREATED)
def add_bookmark(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Idempotent: bookmarking an already-bookmarked course is a no-op."""
    course = get_or_404(db, Course, course_id, "ไม่พบหลักสูตร")
    if current_user.role.value in ("learner", "manager") and not course.is_published:
        raise HTTPException(status_code=404, detail="ไม่พบหลักสูตร")
    existing = (
        db.query(Bookmark)
        .filter(Bookmark.user_id == current_user.id, Bookmark.course_id == course_id)
        .first()
    )
    if not existing:
        db.add(Bookmark(user_id=current_user.id, course_id=course_id))
        db.commit()
    return {"message": "บันทึกหลักสูตรไว้แล้ว", "is_bookmarked": True}


@router.delete("/{course_id}/bookmark", status_code=status.HTTP_200_OK)
def remove_bookmark(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Idempotent: removing a non-existent bookmark returns success."""
    db.query(Bookmark).filter(
        Bookmark.user_id == current_user.id,
        Bookmark.course_id == course_id,
    ).delete(synchronize_session=False)
    db.commit()
    return {"message": "ยกเลิกการบันทึกเรียบร้อย", "is_bookmarked": False}
