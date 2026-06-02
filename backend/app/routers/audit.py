"""Admin viewer for the audit log.

Read-only. Writes happen via services.audit.log_action from inside the
endpoints whose actions deserve recording.
"""
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_admin
from app.models.audit_log import AuditLog
from app.models.user import User


router = APIRouter(prefix="/api/admin/audit-logs", tags=["Audit"])


@router.get("")
def list_audit_logs(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    action: Optional[str] = Query(None, description="Exact action name, e.g. 'user.delete'"),
    target_type: Optional[str] = Query(None, description="'user' or 'course'"),
    actor_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Paginated audit log, newest first. All filters are AND-ed."""
    q = db.query(AuditLog)
    if action:
        q = q.filter(AuditLog.action == action)
    if target_type:
        q = q.filter(AuditLog.target_type == target_type)
    if actor_id:
        q = q.filter(AuditLog.actor_id == actor_id)
    rows = q.order_by(AuditLog.created_at.desc()).offset(skip).limit(limit).all()
    return [
        {
            "id": r.id,
            "actor_id": r.actor_id,
            "actor_username": r.actor_username,
            "actor_role": r.actor_role,
            "action": r.action,
            "target_type": r.target_type,
            "target_id": r.target_id,
            "target_label": r.target_label,
            "summary": r.summary,
            "details": r.details,
            "ip_address": r.ip_address,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]


@router.get("/actions")
def list_action_types(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Distinct action names currently present in the log — populates the
    filter dropdown without hardcoding the list on the frontend."""
    rows = db.query(AuditLog.action).distinct().order_by(AuditLog.action).all()
    return {"actions": [r[0] for r in rows]}
