import json
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.services.importer import import_events_from_json
from app.services.events import create_event, DuplicateEventError
from app.schemas.events import EventCreate, EventResponse
from app.models.events import Event, AuditLog
from sqlalchemy import select

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])

@router.post("/events", response_model=EventResponse, status_code=201)
async def create_event_manually(
    payload: EventCreate,
    db: AsyncSession = Depends(get_db)
):
    """Ручное добавление одного мероприятия (форма на сайте)"""
    try:
        event = await create_event(db, payload)
    except DuplicateEventError as exc:
        raise HTTPException(
            status_code=409,
            detail={
                "message": "Такое мероприятие уже есть: совпали название, дата начала и площадка",
                "event_id": str(exc.event_id) if exc.event_id else None,
            },
        )
    return EventResponse.model_validate(event)


@router.post("/import/json")
async def import_json_events(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    """Импорт событий из JSON файла с дедупликацией и отчётом"""
    if not (file.filename or '').lower().endswith('.json'):
        raise HTTPException(status_code=400, detail="Только JSON файлы поддерживаются")
    
    content = await file.read()
    try:
        data = json.loads(content)
        if not isinstance(data, list):
            data = [data] # Поддержка одиночного объекта
        
        report = await import_events_from_json(db, data, source_type="import", source_url=f"upload:{file.filename}")
        return {"message": "Импорт завершён", "report": report}
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Невалидный JSON")


@router.patch("/events/{event_id}/status")
async def update_event_status(
    event_id: str,
    new_status: str,  # published, draft, cancelled
    db: AsyncSession = Depends(get_db)
):
    """Изменение статуса события (например, отмена)"""
    if new_status not in ["published", "draft", "cancelled"]:
        raise HTTPException(status_code=400, detail="Недопустимый статус")
    
    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Событие не найдено")
    
    old_status = event.status
    event.status = new_status
    
    # Логируем изменение
    from app.models.events import AuditLog
    audit = AuditLog(
        entity_type="event",
        entity_id=event.id,
        action="status_change",
        changed_by="admin_api",
        old_data={"status": old_status},
        new_data={"status": new_status}
    )
    db.add(audit)
    await db.commit()
    
    return {"message": f"Статус изменён на {new_status}", "event_id": event_id}


@router.get("/audit")
async def get_audit_log(limit: int = 50, db: AsyncSession = Depends(get_db)):
    """Просмотр журнала изменений"""
    result = await db.execute(
        select(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit)
    )
    logs = result.scalars().all()
    return {
        "logs": [
            {
                "id": str(log.id),
                "entity_type": log.entity_type,
                "action": log.action,
                "changed_by": log.changed_by,
                "created_at": log.created_at.isoformat(),
                "old_data": log.old_data,
                "new_data": log.new_data
            }
            for log in logs
        ]
    }