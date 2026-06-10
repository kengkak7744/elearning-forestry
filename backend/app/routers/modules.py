from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.course import Module, Course
from app.models.user import User
from app.schemas.module import ModuleCreate, ModuleUpdate, ModuleResponse
from app.core.helpers import get_or_404
from app.dependencies import require_instructor_or_admin


router = APIRouter(prefix="/api/modules", tags=["Modules"])


@router.post("", response_model=ModuleResponse, status_code=status.HTTP_201_CREATED)
def create_module(
    data: ModuleCreate,
    db: Session = Depends(get_db),
    _user: User = Depends(require_instructor_or_admin)
):
    get_or_404(db, Course, data.course_id, "ไม่พบหลักสูตร")

    new_module = Module(**data.model_dump())
    db.add(new_module)
    db.commit()
    db.refresh(new_module)
    return new_module


@router.put("/{module_id}", response_model=ModuleResponse)
def update_module(
    module_id: int,
    data: ModuleUpdate,
    db: Session = Depends(get_db),
    _user: User = Depends(require_instructor_or_admin)
):
    module = get_or_404(db, Module, module_id, "ไม่พบโมดูล")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(module, field, value)

    db.commit()
    db.refresh(module)
    return module


@router.delete("/{module_id}", status_code=status.HTTP_200_OK)
def delete_module(
    module_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(require_instructor_or_admin)
):
    module = get_or_404(db, Module, module_id, "ไม่พบโมดูล")

    db.delete(module)
    db.commit()
    return {"message": "ลบโมดูลเรียบร้อย"}
