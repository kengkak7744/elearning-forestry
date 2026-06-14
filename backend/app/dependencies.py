from typing import Optional
from fastapi import Depends, HTTPException, status, Query, Header, Cookie
from sqlalchemy.orm import Session
from app.database import get_db
from app.core.security import decode_access_token
from app.models.user import User, UserRole


ACCESS_COOKIE_NAME = "access_token"


def _extract_token(authorization: Optional[str], cookie_token: Optional[str]) -> Optional[str]:
    """Prefer the httpOnly cookie; fall back to Authorization: Bearer for API clients."""
    if cookie_token:
        return cookie_token
    if authorization:
        scheme, _, value = authorization.partition(" ")
        if scheme.lower() == "bearer" and value:
            return value
    return None


def get_current_user(
    authorization: Optional[str] = Header(None),
    access_token: Optional[str] = Cookie(None),
    db: Session = Depends(get_db),
) -> User:
    """check JWT (cookie preferred, header fallback) and get current user"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="ไม่สามารถตรวจสอบสิทธิ์ได้",
        headers={"WWW-Authenticate": "Bearer"},
    )

    token = _extract_token(authorization, access_token)
    if not token:
        raise credentials_exception

    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception

    # A forged JWT can put anything in `sub` — coerce defensively. ValueError
    # on non-integer must NOT bubble as a 500.
    try:
        user_id = int(payload.get("sub"))
    except (TypeError, ValueError):
        raise credentials_exception

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise credentials_exception

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="บัญชีผู้ใช้ถูกระงับ"
        )

    return user


def get_optional_current_user(
    authorization: Optional[str] = Header(None),
    access_token: Optional[str] = Cookie(None),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """Return the current user when a valid token exists; otherwise return None.

    This is for non-authorizing session probes. Protected endpoints must keep
    using get_current_user so missing/invalid credentials still return 401.
    """
    token = _extract_token(authorization, access_token)
    if not token:
        return None

    payload = decode_access_token(token)
    if payload is None:
        return None

    try:
        user_id = int(payload.get("sub"))
    except (TypeError, ValueError):
        return None

    user = db.query(User).filter(User.id == user_id).first()
    if user is None or not user.is_active:
        return None

    return user


def require_roles(*roles: UserRole, detail: str):
    """Factory for role-gate dependencies. Each call site keeps its own Thai
    403 message — do NOT merge messages across routes when consolidating."""

    def checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=detail)
        return current_user

    return checker


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """require admin"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="ต้องเป็นผู้ดูแลระบบเท่านั้น"
        )
    return current_user


def require_instructor_or_admin(current_user: User = Depends(get_current_user)) -> User:
    """require instructor or admin"""
    if current_user.role not in [UserRole.INSTRUCTOR, UserRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="ต้องเป็นวิทยากรหรือผู้ดูแลระบบเท่านั้น"
        )
    return current_user


def require_manager_or_above(current_user: User = Depends(get_current_user)) -> User:
    """require manager or above"""
    if current_user.role == UserRole.LEARNER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="ต้องเป็นหัวหน้างานขึ้นไป"
        )
    return current_user


def require_media_token(
    t: Optional[str] = Query(None, description="Optional JWT for non-cookie clients"),
    authorization: Optional[str] = Header(None),
    access_token: Optional[str] = Cookie(None),
    db: Session = Depends(get_db),
) -> User:
    """For <video>/<iframe>/<img> requests. Prefers the httpOnly cookie (auto-sent by the browser).
    Falls back to Authorization header or ?t= query param so API clients still work.
    """
    raw = access_token or t
    if not raw and authorization:
        scheme, _, value = authorization.partition(" ")
        if scheme.lower() == "bearer" and value:
            raw = value

    if not raw:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="ต้องล็อกอินก่อนเข้าถึงไฟล์")

    payload = decode_access_token(raw)
    if not payload or not payload.get("sub"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="โทเค็นไม่ถูกต้องหรือหมดอายุ")

    try:
        user_id = int(payload["sub"])
    except (TypeError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="โทเค็นไม่ถูกต้องหรือหมดอายุ")

    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="ผู้ใช้ไม่พร้อมใช้งาน")
    return user
