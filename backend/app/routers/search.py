"""Search across lesson content.

Course-level search is handled by /api/courses?search=... and matches title +
description. This module adds the bit you can't get there: matches inside
lesson titles, descriptions, and notes — surfacing courses you'd otherwise
miss because the relevant content is one level deeper.
"""
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.dependencies import get_current_user
from app.models.course import Course, Module
from app.models.lesson import Lesson
from app.models.user import User


router = APIRouter(prefix="/api/search", tags=["Search"])


SNIPPET_RADIUS = 60
"""Characters of context before/after the matched term in a snippet."""


def _snippet(text: Optional[str], term: str) -> Optional[str]:
    """Return a short excerpt of `text` centered on the first case-insensitive
    occurrence of `term`. None if no match or no text."""
    if not text or not term:
        return None
    haystack = text.lower()
    needle = term.lower()
    idx = haystack.find(needle)
    if idx < 0:
        return None
    start = max(0, idx - SNIPPET_RADIUS)
    end = min(len(text), idx + len(term) + SNIPPET_RADIUS)
    snippet = text[start:end].strip()
    if start > 0:
        snippet = "…" + snippet
    if end < len(text):
        snippet = snippet + "…"
    return snippet


@router.get("/lessons")
def search_lessons(
    q: str = Query(..., min_length=2, max_length=100),
    limit: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Lesson-level search across title, description, and notes_content.

    Returns at most `limit` lessons (sorted by most recent course first), each
    annotated with its parent course/module and a snippet showing where the
    match landed. Learners only see lessons inside published courses.
    """
    like = f"%{q}%"

    base = (
        db.query(Lesson)
        .options(joinedload(Lesson.module).joinedload(Module.course))
        .join(Module, Module.id == Lesson.module_id)
        .join(Course, Course.id == Module.course_id)
        .filter(
            or_(
                Lesson.title.ilike(like),
                Lesson.description.ilike(like),
                Lesson.notes_content.ilike(like),
                Module.title.ilike(like),
            )
        )
    )

    # Learners/managers don't see lessons in unpublished courses.
    if current_user.role.value in ("learner", "manager"):
        base = base.filter(Course.is_published == True)

    lessons = base.order_by(Course.created_at.desc(), Lesson.order_index).limit(limit).all()

    results = []
    for lesson in lessons:
        # Pick the most informative snippet — title first (concise), then
        # description, then notes. Title gets no snippet wrapping since it's
        # already short enough to read whole.
        snippet = None
        match_field = None
        ql = q.lower()
        if lesson.title and ql in lesson.title.lower():
            match_field = "title"
        elif lesson.description and ql in lesson.description.lower():
            match_field = "description"
            snippet = _snippet(lesson.description, q)
        elif lesson.notes_content and ql in lesson.notes_content.lower():
            match_field = "notes"
            snippet = _snippet(lesson.notes_content, q)
        elif lesson.module and lesson.module.title and ql in lesson.module.title.lower():
            match_field = "module"

        course = lesson.module.course if lesson.module else None
        results.append({
            "id": lesson.id,
            "title": lesson.title,
            "content_type": lesson.content_type.value if lesson.content_type else None,
            "match_field": match_field,
            "snippet": snippet,
            "module": {
                "id": lesson.module.id if lesson.module else None,
                "title": lesson.module.title if lesson.module else None,
            },
            "course": {
                "id": course.id if course else None,
                "title": course.title if course else None,
                "is_published": course.is_published if course else False,
            },
        })

    return {"query": q, "count": len(results), "lessons": results}
