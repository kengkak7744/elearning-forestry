import asyncio
import logging
import re
import tempfile
import uuid
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask
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
MAX_SPLIT_PDF_SIZE = settings.MAX_SPLIT_PDF_SIZE


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
# Auto-split a PDF into lessons by its table of contents, capped at
# settings.SPLIT_MAX_DEPTH levels so a deep TOC doesn't over-fragment.
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


def _pdf_sections_paths(reader, max_depth: int) -> list[tuple[list[str], int]]:
    """Read a PDF's outline ("table of contents") down to `max_depth` levels and
    return (path, start_page_index) per section, sorted by page. `path` is the
    breadcrumb of ancestor titles (e.g. ["บทที่ 1", "1.1"]) — keeping the list
    (not a joined string) lets callers group by the top level for module mode.

    `max_depth` caps how deep the split goes: a bookmark deeper than max_depth
    does NOT start its own section — its pages fold into the nearest ancestor at
    max_depth (e.g. with max_depth=2, "1.1.1" stays inside the "1.1" lesson
    instead of becoming its own). Without the cap a deeply nested TOC explodes
    into dozens of tiny lessons. max_depth <= 0 means no cap (every level
    splits). When several kept bookmarks share a start page only one section
    starts there — the deepest (most specific) wins.
    """
    try:
        outline = reader.outline
    except Exception:  # malformed / unreadable outline
        return []

    flat = _flatten_outline(reader, outline, [])
    if not flat:
        return []

    # Cap split depth: drop bookmarks below max_depth so they don't start a new
    # section — the surviving ancestor's page range simply spans their pages.
    # Fall back to the uncapped set if the cap would empty everything (e.g. a
    # malformed TOC where only deep leaves carry page destinations) — better to
    # over-split than to reject a PDF that genuinely has a table of contents.
    if max_depth and max_depth > 0:
        capped = [(path, page) for (path, page) in flat if len(path) <= max_depth]
        if capped:
            flat = capped

    # One section per distinct start page; keep the deepest bookmark on a page.
    by_page: dict[int, list[str]] = {}
    for path, page in flat:
        existing = by_page.get(page)
        if existing is None or len(path) > len(existing):
            by_page[page] = path

    return [(by_page[page], page) for page in sorted(by_page)]


def _breadcrumb(path: list[str]) -> str:
    """Join a TOC path into a display title, dropping empty ancestor titles."""
    return " › ".join(p for p in path if p)


class _PdfSplitError(Exception):
    """Raised by the threaded splitter with a user-facing Thai message."""


def _split_pdf_file(src_path: Path) -> list[dict]:
    """Parse the PDF at `src_path`, split it by its table of contents, write one
    PDF per section into PDF_DIR, and return [{path, content_url, total_pages}]
    in page order (`path` is the section's TOC breadcrumb list).

    Runs in a worker thread (via asyncio.to_thread) — the pypdf parse/write is
    synchronous CPU work, and doing it on the event loop blocks gunicorn's
    heartbeat, so the master kills the worker mid-request → the proxy returns
    502. Reads from a file handle (not an in-memory buffer) so RAM stays flat
    for large PDFs. On any failure, removes the partial split files it wrote.
    """
    from pypdf import PdfReader, PdfWriter

    written: list[Path] = []
    try:
        with src_path.open("rb") as fh:
            reader = PdfReader(fh)
            if reader.is_encrypted:
                # Try an empty owner password (common for "print-protected" PDFs).
                try:
                    reader.decrypt("")
                except Exception:
                    raise _PdfSplitError("ไฟล์ PDF ถูกเข้ารหัส ไม่สามารถแยกอัตโนมัติได้")

            total_pages = len(reader.pages)
            if total_pages == 0:
                raise _PdfSplitError("ไฟล์ PDF ว่างเปล่า")

            sections = _pdf_sections_paths(reader, settings.SPLIT_MAX_DEPTH)
            if not sections:
                raise _PdfSplitError(
                    "ไฟล์ PDF นี้ไม่มีสารบัญ (bookmarks) — ปิดสวิตช์แยกอัตโนมัติ แล้วอัปโหลดเป็นบทเรียนเดียวแทน"
                )

            # Page ranges: section i covers [start_i, start_{i+1}-1]; the last
            # runs to the final page. Force the first section to start at page 0
            # so a cover/preface before the first bookmark isn't dropped.
            starts = [p for (_, p) in sections]
            starts[0] = 0
            ranges: list[tuple[list[str], int, int]] = []
            for i, (path, _) in enumerate(sections):
                start = starts[i]
                end = (starts[i + 1] - 1) if i + 1 < len(sections) else (total_pages - 1)
                if end < start:
                    continue
                ranges.append((path, start, end))
            if not ranges:
                raise _PdfSplitError("แยกบทเรียนจากสารบัญไม่ได้")

            PDF_DIR.mkdir(parents=True, exist_ok=True)
            meta: list[dict] = []
            for path, start, end in ranges:
                writer = PdfWriter()
                for page_no in range(start, end + 1):
                    writer.add_page(reader.pages[page_no])
                unique_name = f"{uuid.uuid4().hex}.pdf"
                out_path = PDF_DIR / unique_name
                with out_path.open("wb") as out:
                    writer.write(out)
                written.append(out_path)
                meta.append({
                    "path": path,
                    "content_url": f"/pdfs/{unique_name}",
                    "total_pages": end - start + 1,
                })
            return meta
    except _PdfSplitError:
        for p in written:
            try: p.unlink()
            except OSError: pass
        raise
    except Exception:
        for p in written:
            try: p.unlink()
            except OSError: pass
        logger.exception("split worker failed for %s", src_path)
        raise _PdfSplitError("อ่านไฟล์ PDF ไม่ได้ — ไฟล์อาจเสียหาย")


async def _receive_and_split_pdf(file: UploadFile) -> list[dict]:
    """Validate the upload, stream it to a temp file (≤ MAX_SPLIT_PDF_SIZE), then
    run the threaded splitter. Returns section metadata. Shared by the
    module-level and course-level split endpoints. Raises HTTPException on any
    user-facing error.
    """
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_PDF_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="รองรับเฉพาะไฟล์ PDF",
        )

    # Stream to a temp file (not memory) so RAM stays flat for large PDFs.
    tmp = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
    tmp_path = Path(tmp.name)
    total = 0
    try:
        try:
            while True:
                chunk = await file.read(CHUNK_SIZE)
                if not chunk:
                    break
                total += len(chunk)
                if total > MAX_SPLIT_PDF_SIZE:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"ไฟล์ใหญ่เกิน {MAX_SPLIT_PDF_SIZE // (1024 * 1024)} MB",
                    )
                tmp.write(chunk)
        finally:
            tmp.close()

        if total == 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="ไฟล์ว่างเปล่า")

        # Heavy parse/split runs off the event loop so gunicorn's heartbeat keeps
        # firing — otherwise a big PDF blocks it and the worker is killed (→ 502).
        try:
            return await asyncio.to_thread(_split_pdf_file, tmp_path)
        except _PdfSplitError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    finally:
        try:
            tmp_path.unlink()
        except OSError:
            pass


def _cleanup_split_files(sections_meta: list[dict]) -> None:
    """Delete the split PDFs a worker wrote — used to roll back on a DB failure."""
    for meta in sections_meta:
        try:
            (PDF_DIR / Path(meta["content_url"]).name).unlink()
        except OSError:
            pass


@router.post("/module/{module_id}/split-pdf")
async def split_pdf_into_lessons(
    module_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _user: User = Depends(require_instructor_or_admin),
):
    """อัปโหลด PDF หนึ่งไฟล์ แล้วแยกออกเป็นหลายบทเรียนอัตโนมัติตามสารบัญ (bookmarks).

    แยกตามหัวข้อในสารบัญลึกถึง settings.SPLIT_MAX_DEPTH ระดับ (ค่าเริ่มต้น 2) — หัวข้อ
    ที่ลึกกว่านั้นถูกรวมเข้าบทเรียนแม่แทนการแตกเป็นบทเรียนใหม่ ชื่อบทเรียนเป็น breadcrumb
    ของลำดับชั้น เช่น "บทที่ 1 › 1.1 บทนำ" โดยตัด PDF เป็นไฟล์ย่อยจริงต่อบทเรียน และ
    ต่อท้ายบทเรียนเดิมในโมดูล (order_index ต่อเนื่อง).
    """
    get_or_404(db, Module, module_id, "ไม่พบโมดูล")

    sections_meta = await _receive_and_split_pdf(file)

    existing_count = (
        db.query(func.count(Lesson.id)).filter(Lesson.module_id == module_id).scalar() or 0
    )
    created: list[Lesson] = []
    try:
        for idx, meta in enumerate(sections_meta):
            lesson = Lesson(
                module_id=module_id,
                title=(_breadcrumb(meta["path"]) or f"ตอนที่ {idx + 1}")[:200],
                content_type=ContentType.PDF,
                content_url=meta["content_url"],
                total_pages=meta["total_pages"],
                order_index=existing_count + idx,
            )
            db.add(lesson)
            created.append(lesson)
        db.commit()
    except Exception:
        db.rollback()
        _cleanup_split_files(sections_meta)
        logger.exception("split-pdf db write failed for module_id=%s", module_id)
        raise HTTPException(status_code=500, detail="สร้างบทเรียนจากการแยก PDF ไม่สำเร็จ")

    for lesson in created:
        db.refresh(lesson)

    return {
        "created_count": len(created),
        "lessons": [LessonResponse.model_validate(lesson) for lesson in created],
    }


@router.post("/course/{course_id}/split-pdf")
async def split_pdf_into_modules(
    course_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _user: User = Depends(require_instructor_or_admin),
):
    """อัปโหลด PDF หนึ่งไฟล์ แล้วแยกตามสารบัญเป็น "โมดูล + บทเรียน" อัตโนมัติ.

    หัวข้อระดับบนสุดของสารบัญ = โมดูล, หัวข้อย่อยระดับ 2 = บทเรียนในโมดูลนั้น (จำกัดความลึก
    ที่ settings.SPLIT_MAX_DEPTH ระดับ — หัวข้อที่ลึกกว่านั้นถูกรวมเข้าบทเรียนแม่ ไม่แตกเพิ่ม).
    ตัด PDF เป็นไฟล์ย่อยจริงต่อบทเรียน และต่อท้ายโมดูลเดิมในคอร์ส (order_index ต่อเนื่อง).
    ถ้าหัวข้อระดับบนสุดมีเนื้อหานำก่อนหัวข้อย่อยแรก เนื้อหานั้นจะกลายเป็นบทเรียนแรกของโมดูล.
    """
    from app.models.course import Course

    get_or_404(db, Course, course_id, "ไม่พบหลักสูตร")

    sections_meta = await _receive_and_split_pdf(file)

    existing_modules = (
        db.query(func.count(Module.id)).filter(Module.course_id == course_id).scalar() or 0
    )

    # Group consecutive sections by their top-level TOC title → one module each.
    # Sections arrive in page order, so a module's sections are contiguous.
    groups: list[tuple[str, list[dict]]] = []
    for meta in sections_meta:
        path = meta["path"]
        top = path[0] if path else ""
        if not groups or groups[-1][0] != top:
            groups.append((top, [meta]))
        else:
            groups[-1][1].append(meta)

    created: list[tuple[Module, list[Lesson]]] = []
    try:
        for m_idx, (top_title, metas) in enumerate(groups):
            module = Module(
                course_id=course_id,
                title=(top_title or f"โมดูล {existing_modules + m_idx + 1}")[:200],
                order_index=existing_modules + m_idx,
            )
            db.add(module)
            db.flush()  # need module.id for its lessons

            lessons: list[Lesson] = []
            for l_idx, meta in enumerate(metas):
                path = meta["path"]
                # Lesson title = breadcrumb BELOW the module; the module-intro
                # section (path == [top]) falls back to the module title.
                lesson_title = _breadcrumb(path[1:]) or top_title or f"ตอนที่ {l_idx + 1}"
                lesson = Lesson(
                    module_id=module.id,
                    title=lesson_title[:200],
                    content_type=ContentType.PDF,
                    content_url=meta["content_url"],
                    total_pages=meta["total_pages"],
                    order_index=l_idx,
                )
                db.add(lesson)
                lessons.append(lesson)
            created.append((module, lessons))
        db.commit()
    except Exception:
        db.rollback()
        _cleanup_split_files(sections_meta)
        logger.exception("split-pdf (modules) db write failed for course_id=%s", course_id)
        raise HTTPException(status_code=500, detail="สร้างโมดูลจากการแยก PDF ไม่สำเร็จ")

    total_lessons = 0
    modules_out = []
    for module, lessons in created:
        db.refresh(module)
        for lesson in lessons:
            db.refresh(lesson)
        total_lessons += len(lessons)
        modules_out.append({
            "id": module.id,
            "course_id": module.course_id,
            "title": module.title,
            "description": module.description,
            "order_index": module.order_index,
            "lessons": [LessonResponse.model_validate(lesson) for lesson in lessons],
        })

    return {
        "created_modules": len(created),
        "created_lessons": total_lessons,
        "modules": modules_out,
    }


# =====================================================================
# Merge all of a course's PDF lessons into ONE downloadable PDF
# =====================================================================

def _safe_download_name(title: str) -> str:
    """Sanitise a course title into a filesystem-safe download filename stem."""
    base = re.sub(r'[\\/:*?"<>|\x00-\x1f]+', "", (title or "").strip())
    return base[:120] or "course"


def _merge_course_pdfs(pdf_paths: list[Path], titles: list[str], dest_path: Path) -> int:
    """Concatenate the given PDF files into `dest_path`, adding one top-level
    bookmark (the lesson title) per source so the merged file has a clean table
    of contents. Returns the count actually merged. Best-effort: a corrupt or
    encrypted source is skipped rather than failing the whole download.

    Runs in a worker thread (via asyncio.to_thread) — pypdf's parse/write is
    synchronous CPU/IO work, and doing it on the event loop blocks gunicorn's
    heartbeat → the worker is killed mid-request → 502.
    """
    from pypdf import PdfWriter

    writer = PdfWriter()
    merged = 0
    try:
        for path, title in zip(pdf_paths, titles):
            try:
                writer.append(
                    str(path),
                    outline_item=(title.strip()[:200] or "เอกสาร"),
                    import_outline=False,
                )
                merged += 1
            except Exception:
                logger.exception("merge: skipped unreadable pdf %s", path)
                continue
        if merged == 0:
            raise _PdfSplitError("รวมไฟล์ PDF ไม่ได้ — ไฟล์อาจเสียหายหรือถูกเข้ารหัส")
        with dest_path.open("wb") as out:
            writer.write(out)
    finally:
        writer.close()
    return merged


@router.get("/course/{course_id}/merged-pdf")
async def download_course_merged_pdf(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """รวมไฟล์ PDF ของทุกบทเรียนในหลักสูตรเป็น PDF ไฟล์เดียวสำหรับดาวน์โหลด.

    เรียงตามลำดับโมดูล → บทเรียน และใส่ bookmark (สารบัญ) ต่อบทเรียนให้อัตโนมัติ
    แทนการโหลดทีละไฟล์. ใช้ได้เฉพาะหลักสูตรที่เปิดให้ดาวน์โหลด (allow_downloads)
    และผู้เรียนต้องลงทะเบียนก่อน (แอดมิน/ผู้สอนเข้าถึงได้ทุกหลักสูตร).
    """
    from app.models.course import Course

    course = get_or_404(db, Course, course_id, "ไม่พบหลักสูตร")
    if not course.allow_downloads:
        raise HTTPException(status_code=403, detail="หลักสูตรนี้ไม่อนุญาตให้ดาวน์โหลดเอกสาร")
    if current_user.role.value not in ("admin", "instructor"):
        require_enrollment(
            db, current_user.id, course_id, "ต้องลงทะเบียนหลักสูตรก่อนดาวน์โหลดเอกสาร"
        )

    modules = (
        db.query(Module)
        .filter(Module.course_id == course_id)
        .order_by(Module.order_index, Module.id)
        .all()
    )
    base = PDF_DIR.resolve()
    pdf_paths: list[Path] = []
    titles: list[str] = []
    for module in modules:
        for lesson in sorted(module.lessons, key=lambda l: (l.order_index or 0, l.id)):
            if lesson.content_type != ContentType.PDF or not lesson.content_url:
                continue
            path = (PDF_DIR / Path(lesson.content_url).name).resolve()
            # Guard against traversal / missing files; skip silently.
            if base not in path.parents or not path.is_file():
                continue
            pdf_paths.append(path)
            titles.append(lesson.title or "เอกสาร")

    if not pdf_paths:
        raise HTTPException(status_code=404, detail="หลักสูตรนี้ยังไม่มีไฟล์ PDF ให้ดาวน์โหลด")

    # Merge off the event loop into a temp file (flat memory for big courses).
    tmp = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
    tmp_path = Path(tmp.name)
    tmp.close()
    try:
        await asyncio.to_thread(_merge_course_pdfs, pdf_paths, titles, tmp_path)
    except _PdfSplitError as exc:
        tmp_path.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception:
        tmp_path.unlink(missing_ok=True)
        logger.exception("merge-pdf failed for course_id=%s", course_id)
        raise HTTPException(status_code=500, detail="รวมไฟล์ PDF ไม่สำเร็จ")

    return FileResponse(
        tmp_path,
        media_type="application/pdf",
        filename=f"{_safe_download_name(course.title)}.pdf",
        background=BackgroundTask(lambda: tmp_path.unlink(missing_ok=True)),
    )


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
