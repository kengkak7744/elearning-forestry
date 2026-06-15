import io
import logging
import uuid
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.course import Module
from app.models.lesson import Lesson, LessonResource, ContentType
from app.models.lesson_note import LessonNote
from app.models.user import User
from app.schemas.lesson import (
    LessonCreate,
    LessonNoteResponse,
    LessonNoteUpdate,
    LessonResourceCreate,
    LessonResourceResponse,
    LessonUpdate,
    LessonResponse,
)
from app.config import settings
from app.core.helpers import get_or_404, require_enrollment
from app.dependencies import get_current_user, require_instructor_or_admin


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/lessons", tags=["Lessons"])

# Storage paths
VIDEO_DIR = Path(settings.VIDEO_DIR)
PDF_DIR = Path(settings.PDF_DIR)

# Max file sizes (bytes)
MAX_VIDEO_SIZE = settings.MAX_VIDEO_SIZE
MAX_PDF_SIZE = settings.MAX_PDF_SIZE


def _require_lesson_access(db: Session, current_user: User, lesson_id: int) -> None:
    row = (
        db.query(Module.course_id)
        .join(Lesson, Lesson.module_id == Module.id)
        .filter(Lesson.id == lesson_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="ไม่พบบทเรียน")
    if current_user.role.value in ("admin", "instructor"):
        return
    require_enrollment(db, current_user.id, row.course_id, "ต้องลงทะเบียนหลักสูตรก่อนเข้าถึงบทเรียน")

ALLOWED_VIDEO_EXTENSIONS = {".mp4", ".webm", ".mov", ".avi", ".mkv"}
ALLOWED_PDF_EXTENSIONS = {".pdf"}

CHUNK_SIZE = 1024 * 1024  # 1 MB


async def _stream_upload_to_disk(file: UploadFile, dest: Path, max_size: int) -> None:
    """Stream UploadFile chunks to disk; raise 400 if max_size exceeded. Deletes partial file on failure."""
    total = 0
    dest.parent.mkdir(parents=True, exist_ok=True)
    try:
        with dest.open("wb") as out:
            while True:
                chunk = await file.read(CHUNK_SIZE)
                if not chunk:
                    break
                total += len(chunk)
                if total > max_size:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"ไฟล์ใหญ่เกิน {max_size // (1024*1024)} MB"
                    )
                out.write(chunk)
    except HTTPException:
        if dest.exists():
            try: dest.unlink()
            except Exception: pass
        raise
    except Exception:
        if dest.exists():
            try: dest.unlink()
            except Exception: pass
        raise


@router.post("", response_model=LessonResponse, status_code=status.HTTP_201_CREATED)
def create_lesson(
    data: LessonCreate,
    db: Session = Depends(get_db),
    _user: User = Depends(require_instructor_or_admin)
):
    """สร้างบทเรียนใหม่ (สำหรับ YouTube link หรือ lesson ที่จะ upload file ทีหลัง)"""
    get_or_404(db, Module, data.module_id, "ไม่พบโมดูล")

    new_lesson = Lesson(**data.model_dump())
    db.add(new_lesson)
    db.commit()
    db.refresh(new_lesson)
    return new_lesson


@router.put("/{lesson_id}", response_model=LessonResponse)
def update_lesson(
    lesson_id: int,
    data: LessonUpdate,
    db: Session = Depends(get_db),
    _user: User = Depends(require_instructor_or_admin)
):
    lesson = get_or_404(db, Lesson, lesson_id, "ไม่พบบทเรียน")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(lesson, field, value)
    
    db.commit()
    db.refresh(lesson)
    return lesson


@router.delete("/{lesson_id}", status_code=status.HTTP_200_OK)
def delete_lesson(
    lesson_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(require_instructor_or_admin)
):
    lesson = get_or_404(db, Lesson, lesson_id, "ไม่พบบทเรียน")

    # Delete associated file
    if lesson.content_url and lesson.content_type != ContentType.VIDEO_YOUTUBE:
        try:
            file_path = Path(lesson.content_url.lstrip("/"))
            if lesson.content_type == ContentType.VIDEO_FILE:
                file_path = VIDEO_DIR / Path(lesson.content_url).name
            elif lesson.content_type == ContentType.PDF:
                file_path = PDF_DIR / Path(lesson.content_url).name
            
            if file_path.exists():
                file_path.unlink()
        except Exception:
            logger.exception("Failed to delete lesson file for lesson_id=%s", lesson_id)
    
    db.delete(lesson)
    db.commit()
    return {"message": "ลบบทเรียนเรียบร้อย"}


@router.post("/{lesson_id}/upload-video", response_model=LessonResponse)
async def upload_video(
    lesson_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _user: User = Depends(require_instructor_or_admin)
):
    """อัปโหลดไฟล์วิดีโอสำหรับบทเรียน"""
    lesson = get_or_404(db, Lesson, lesson_id, "ไม่พบบทเรียน")

    # Validate file extension
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_VIDEO_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"รองรับเฉพาะไฟล์ {', '.join(ALLOWED_VIDEO_EXTENSIONS)}"
        )

    # Stream to disk (chunked, with size limit enforced during streaming)
    unique_name = f"{uuid.uuid4().hex}{ext}"
    file_path = VIDEO_DIR / unique_name
    await _stream_upload_to_disk(file, file_path, MAX_VIDEO_SIZE)

    # Delete old file if exists
    if lesson.content_url and lesson.content_type == ContentType.VIDEO_FILE:
        old_path = VIDEO_DIR / Path(lesson.content_url).name
        if old_path.exists():
            old_path.unlink()

    lesson.content_type = ContentType.VIDEO_FILE
    lesson.content_url = f"/videos/{unique_name}"
    db.commit()
    db.refresh(lesson)
    return lesson


@router.post("/{lesson_id}/upload-pdf", response_model=LessonResponse)
async def upload_pdf(
    lesson_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _user: User = Depends(require_instructor_or_admin)
):
    """อัปโหลดไฟล์ PDF สำหรับบทเรียน"""
    lesson = get_or_404(db, Lesson, lesson_id, "ไม่พบบทเรียน")

    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_PDF_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="รองรับเฉพาะไฟล์ PDF"
        )

    unique_name = f"{uuid.uuid4().hex}{ext}"
    file_path = PDF_DIR / unique_name
    await _stream_upload_to_disk(file, file_path, MAX_PDF_SIZE)

    if lesson.content_url and lesson.content_type == ContentType.PDF:
        old_path = PDF_DIR / Path(lesson.content_url).name
        if old_path.exists():
            old_path.unlink()

    lesson.content_type = ContentType.PDF
    lesson.content_url = f"/pdfs/{unique_name}"
    db.commit()
    db.refresh(lesson)
    return lesson


# =====================================================================
# Auto-split a PDF into one lesson per table-of-contents entry
# =====================================================================

def _flatten_outline(reader, items, ancestors) -> list[tuple[list[str], int]]:
    """Recursively flatten a pypdf outline into (path, start_page_index) entries
    for bookmarks at EVERY level. `path` is the breadcrumb of ancestor titles
    ending with this node's own title.

    pypdf represents the outline as a flat list where a nested list immediately
    follows its parent item and holds that item's children — so we look one step
    ahead for a child list after each Destination.
    """
    out: list[tuple[list[str], int]] = []
    i = 0
    n = len(items)
    while i < n:
        node = items[i]
        if isinstance(node, list):
            # Orphan child list with no preceding parent here — flatten as-is.
            out.extend(_flatten_outline(reader, node, ancestors))
            i += 1
            continue
        try:
            title = (node.title or "").strip()
        except Exception:
            title = ""
        try:
            page = reader.get_destination_page_number(node)
        except Exception:
            page = None
        path = ancestors + [title]
        if page is not None:
            out.append((path, int(page)))
        # The next element, if a list, is this node's children.
        if i + 1 < n and isinstance(items[i + 1], list):
            out.extend(_flatten_outline(reader, items[i + 1], path))
            i += 2
        else:
            i += 1
    return out


def _pdf_sections(reader) -> list[tuple[str, int]]:
    """Read a PDF's outline ("table of contents") at ALL levels and return
    (title, start_page_index) per section, sorted by page. Sub-headings become
    their own sections too. Titles are breadcrumbs of ancestors joined by " › "
    (e.g. "บทที่ 1 › 1.1 บทนำ"). When several bookmarks point at the same page
    only one section starts there — the deepest (most specific) one wins.
    """
    try:
        outline = reader.outline
    except Exception:  # malformed / unreadable outline
        return []

    flat = _flatten_outline(reader, outline, [])
    if not flat:
        return []

    # One section per distinct start page; keep the deepest bookmark on a page.
    by_page: dict[int, list[str]] = {}
    for path, page in flat:
        existing = by_page.get(page)
        if existing is None or len(path) > len(existing):
            by_page[page] = path

    sections: list[tuple[str, int]] = []
    for page in sorted(by_page):
        title = " › ".join(p for p in by_page[page] if p)
        sections.append((title, page))
    return sections


@router.post("/module/{module_id}/split-pdf")
async def split_pdf_into_lessons(
    module_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _user: User = Depends(require_instructor_or_admin),
):
    """อัปโหลด PDF หนึ่งไฟล์ แล้วแยกออกเป็นหลายบทเรียนอัตโนมัติตามสารบัญ (bookmarks).

    รองรับสารบัญหลายระดับ — ทุกหัวข้อทุกชั้น (รวมหัวข้อย่อย) = 1 บทเรียน ชื่อบทเรียน
    เป็น breadcrumb ของลำดับชั้น เช่น "บทที่ 1 › 1.1 บทนำ" โดยตัด PDF เป็นไฟล์ย่อย
    จริงต่อบทเรียน และต่อท้ายบทเรียนเดิมในโมดูล (order_index ต่อเนื่อง).
    """
    from pypdf import PdfReader, PdfWriter

    get_or_404(db, Module, module_id, "ไม่พบโมดูล")

    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_PDF_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="รองรับเฉพาะไฟล์ PDF",
        )

    # Read the whole file into memory (bounded by MAX_PDF_SIZE) — we need random
    # page access to split, which a streamed file doesn't give us.
    data = bytearray()
    while True:
        chunk = await file.read(CHUNK_SIZE)
        if not chunk:
            break
        data.extend(chunk)
        if len(data) > MAX_PDF_SIZE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"ไฟล์ใหญ่เกิน {MAX_PDF_SIZE // (1024 * 1024)} MB",
            )

    try:
        reader = PdfReader(io.BytesIO(bytes(data)))
        if reader.is_encrypted:
            # Try an empty owner password (common for "print-protected" PDFs).
            try:
                reader.decrypt("")
            except Exception:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="ไฟล์ PDF ถูกเข้ารหัส ไม่สามารถแยกอัตโนมัติได้",
                )
        total_pages = len(reader.pages)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="อ่านไฟล์ PDF ไม่ได้ — ไฟล์อาจเสียหาย",
        )

    if total_pages == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="ไฟล์ PDF ว่างเปล่า")

    sections = _pdf_sections(reader)
    if not sections:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ไฟล์ PDF นี้ไม่มีสารบัญ (bookmarks) — ปิดสวิตช์แยกอัตโนมัติ แล้วอัปโหลดเป็นบทเรียนเดียวแทน",
        )

    # Build page ranges: section i covers [start_i, start_{i+1}-1]; the last runs
    # to the final page. Force the first section to start at page 0 so a cover /
    # preface page that precedes the first bookmark isn't dropped.
    starts = [p for (_, p) in sections]
    starts[0] = 0
    ranges: list[tuple[str, int, int]] = []
    for i, (title, _) in enumerate(sections):
        start = starts[i]
        end = (starts[i + 1] - 1) if i + 1 < len(sections) else (total_pages - 1)
        if end < start:
            continue  # defensive: skip an empty range
        ranges.append((title, start, end))

    if not ranges:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="แยกบทเรียนจากสารบัญไม่ได้",
        )

    existing_count = (
        db.query(func.count(Lesson.id)).filter(Lesson.module_id == module_id).scalar() or 0
    )

    PDF_DIR.mkdir(parents=True, exist_ok=True)
    created: list[Lesson] = []
    written_paths: list[Path] = []
    try:
        for idx, (title, start, end) in enumerate(ranges):
            writer = PdfWriter()
            for page_no in range(start, end + 1):
                writer.add_page(reader.pages[page_no])
            unique_name = f"{uuid.uuid4().hex}.pdf"
            out_path = PDF_DIR / unique_name
            with out_path.open("wb") as out:
                writer.write(out)
            written_paths.append(out_path)

            lesson = Lesson(
                module_id=module_id,
                title=(title or f"ตอนที่ {idx + 1}")[:200],
                content_type=ContentType.PDF,
                content_url=f"/pdfs/{unique_name}",
                total_pages=(end - start + 1),
                order_index=existing_count + idx,
            )
            db.add(lesson)
            created.append(lesson)
        db.commit()
    except Exception:
        db.rollback()
        # Clean up any split files we already wrote so they don't orphan on disk.
        for p in written_paths:
            try:
                p.unlink()
            except OSError:
                pass
        logger.exception("split-pdf failed for module_id=%s", module_id)
        raise HTTPException(status_code=500, detail="สร้างบทเรียนจากการแยก PDF ไม่สำเร็จ")

    for lesson in created:
        db.refresh(lesson)

    return {
        "created_count": len(created),
        "lessons": [LessonResponse.model_validate(lesson) for lesson in created],
    }


# =====================================================================
# Lesson resources (supplementary downloads / external links)
# =====================================================================

@router.get("/{lesson_id}/resources", response_model=list[LessonResourceResponse])
def list_lesson_resources(
    lesson_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List supplementary materials for a lesson — visible to any logged-in learner."""
    get_or_404(db, Lesson, lesson_id, "ไม่พบบทเรียน")
    _require_lesson_access(db, current_user, lesson_id)
    return (
        db.query(LessonResource)
        .filter(LessonResource.lesson_id == lesson_id)
        .order_by(LessonResource.id)
        .all()
    )


@router.post(
    "/{lesson_id}/resources",
    response_model=LessonResourceResponse,
    status_code=status.HTTP_201_CREATED,
)
def add_lesson_resource(
    lesson_id: int,
    data: LessonResourceCreate,
    db: Session = Depends(get_db),
    _user: User = Depends(require_instructor_or_admin),
):
    get_or_404(db, Lesson, lesson_id, "ไม่พบบทเรียน")
    resource = LessonResource(lesson_id=lesson_id, **data.model_dump())
    db.add(resource)
    db.commit()
    db.refresh(resource)
    return resource


@router.delete("/resources/{resource_id}", status_code=status.HTTP_200_OK)
def delete_lesson_resource(
    resource_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(require_instructor_or_admin),
):
    resource = get_or_404(db, LessonResource, resource_id, "ไม่พบเอกสาร")
    db.delete(resource)
    db.commit()
    return {"message": "ลบเอกสารเรียบร้อย"}


# =====================================================================
# Personal notes (per-user, per-lesson, upsert)
# =====================================================================

@router.get("/{lesson_id}/notes/me", response_model=LessonNoteResponse)
def get_my_note(
    lesson_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """My note for this lesson. Returns empty content if I've never written one."""
    _require_lesson_access(db, current_user, lesson_id)
    note = (
        db.query(LessonNote)
        .filter(LessonNote.user_id == current_user.id, LessonNote.lesson_id == lesson_id)
        .first()
    )
    if not note:
        return LessonNoteResponse(content="", updated_at=None)
    return LessonNoteResponse(content=note.content, updated_at=note.updated_at)


@router.put("/{lesson_id}/notes/me", response_model=LessonNoteResponse)
def upsert_my_note(
    lesson_id: int,
    data: LessonNoteUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Save my note for this lesson. Idempotent upsert — autosave-friendly."""
    _require_lesson_access(db, current_user, lesson_id)
    get_or_404(db, Lesson, lesson_id, "ไม่พบบทเรียน")

    note = (
        db.query(LessonNote)
        .filter(LessonNote.user_id == current_user.id, LessonNote.lesson_id == lesson_id)
        .first()
    )
    if note:
        note.content = data.content
    else:
        note = LessonNote(
            user_id=current_user.id,
            lesson_id=lesson_id,
            content=data.content,
        )
        db.add(note)
    db.commit()
    db.refresh(note)
    return LessonNoteResponse(content=note.content, updated_at=note.updated_at)


# File serving moved to app.routers.files (with auth and path-traversal hardening).
