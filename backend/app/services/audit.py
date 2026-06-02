"""
Tiny helper for writing audit log rows from endpoint handlers.

Design notes:
- Snapshots actor username/role + target label so rows stay readable after
  the referenced rows are deleted (see AuditLog model docstring).
- `details` is freeform JSON — store the diff or before/after dict when it
  actually helps reconstruct what happened. Skip it for trivial actions.
- Never raises: a logging failure must not bubble up and fail the user-visible
  operation. The whole point is to be a passive sidecar.
"""
from __future__ import annotations

import logging
from typing import Any, Optional

from fastapi import Request
from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog
from app.models.user import User


logger = logging.getLogger(__name__)


def _client_ip(request: Optional[Request]) -> Optional[str]:
    """Pull the originating IP from common reverse-proxy headers, falling back
    to the direct peer. Trusts the proxy because the FastAPI app sits behind
    Traefik — adjust if exposed directly to the public internet."""
    if request is None:
        return None
    xff = request.headers.get("x-forwarded-for")
    if xff:
        # Leftmost IP is the original client per RFC 7239 conventions.
        return xff.split(",")[0].strip()[:64]
    real = request.headers.get("x-real-ip")
    if real:
        return real.strip()[:64]
    return request.client.host[:64] if request.client else None


def log_action(
    db: Session,
    actor: User,
    action: str,
    *,
    target_type: Optional[str] = None,
    target_id: Optional[int] = None,
    target_label: Optional[str] = None,
    summary: Optional[str] = None,
    details: Optional[dict[str, Any]] = None,
    request: Optional[Request] = None,
) -> None:
    """
    Append one audit-log row. Caller is responsible for the surrounding commit
    — this just `db.add`s, so it lands in the same transaction as the action
    being audited (atomic: either both persist or neither does).
    """
    try:
        db.add(AuditLog(
            actor_id=actor.id if actor else None,
            # Snapshot the actor — survives later deletion of the user row.
            actor_username=(actor.username if actor else "system")[:100],
            actor_role=(actor.role.value if actor and actor.role else "system")[:50],
            action=action[:64],
            target_type=target_type[:32] if target_type else None,
            target_id=target_id,
            target_label=target_label[:200] if target_label else None,
            summary=summary,
            details=details,
            ip_address=_client_ip(request),
        ))
    except Exception:
        # Logging is non-critical — never block the real action.
        logger.exception("audit: failed to record action=%s target=%s/%s", action, target_type, target_id)
