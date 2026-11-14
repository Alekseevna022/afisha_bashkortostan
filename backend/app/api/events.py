from fastapi import APIRouter, Depends, Query, HTTPException, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional
from app.database import get_db
from app.models.events import Event
from app.schemas.events import EventResponse, EventListResponse
from datetime import datetime, timedelta

router = APIRouter(prefix="/api/v1/events", tags=["events"])


@router.get("", response_model=EventListResponse)
async def list_events(
    response: Response,
    city: Optional[str] = None,
    category: Optional[str] = None,
    is_free: Optional[bool] = None,
    age_limit: Optional[int] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    # Кэширование на 5 минут для списков
    response.headers["Cache-Control"] = "public, max-age=300"
    
    query = select(Event).where(Event.status == "published")

    if city:
        query = query.where(Event.city.ilike(f"%{city}%"))
    if category:
        query = query.where(Event.category == category)
    if is_free is not None:
        query = query.where(Event.is_free == is_free)
    if age_limit is not None:
        query = query.where(Event.age_limit <= age_limit)
    
    # Фильтрация по дате (опционально, полезно для хакатона)
    if date_from:
        query = query.where(Event.date_start >= datetime.fromisoformat(date_from))
    if date_to:
        query = query.where(Event.date_start <= datetime.fromisoformat(date_to))

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    query = query.order_by(Event.date_start).offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    items = result.scalars().all()

    return EventListResponse(
        items=[EventResponse.model_validate(e) for e in items],
        total=total,
        page=page,
        per_page=per_page,
    )


@router.get("/{event_id}", response_model=EventResponse)
async def get_event(
    response: Response,
    event_id: str, 
    db: AsyncSession = Depends(get_db)
):
    # Кэширование на 1 час для карточек
    response.headers["Cache-Control"] = "public, max-age=3600"
    
    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    # ТЗ: "Отменённое событие не попадает в выдачу, но остаётся доступным по прямой ссылке"
    # Мы просто возвращаем его, а фронтенд/бот увидит status="cancelled" и покажет плашку.
    return EventResponse.model_validate(event)