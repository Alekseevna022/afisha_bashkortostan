from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.events import AuditLog, Event, Source
from app.schemas.events import EventCreate
from app.services.normalize import generate_dedup_key, normalize_title


class DuplicateEventError(Exception):
    """Мероприятие с тем же названием, датой начала и площадкой уже есть."""

    def __init__(self, event_id: Optional[UUID]):
        super().__init__("Duplicate event")
        self.event_id = event_id


async def _find_by_dedup_key(db: AsyncSession, dedup_key: str) -> Optional[UUID]:
    result = await db.execute(select(Event.id).where(Event.dedup_key == dedup_key))
    return result.scalar_one_or_none()


async def create_event(
    db: AsyncSession,
    data: EventCreate,
    changed_by: str = "admin_form",
) -> Event:
    """
    Создаёт одно мероприятие из формы.

    Ключ дедупликации тот же, что при импорте JSON, поэтому одно и то же
    мероприятие нельзя добавить дважды ни формой, ни файлом. В отличие от
    импорта, дубль здесь не перезаписывает существующую запись, а вызывает
    DuplicateEventError: человек, заполнивший форму, должен узнать об этом.
    """
    normalized_title = normalize_title(data.title)
    dedup_key = generate_dedup_key(
        normalized_title, data.date_start.isoformat(), data.venue or ""
    )

    existing_id = await _find_by_dedup_key(db, dedup_key)
    if existing_id:
        raise DuplicateEventError(existing_id)

    event = Event(
        title=data.title,
        normalized_title=normalized_title,
        category=data.category,
        tags=data.tags,
        date_start=data.date_start,
        date_end=data.date_end,
        duration_min=data.duration_min,
        city=data.city,
        venue=data.venue,
        address=data.address,
        lat=data.lat,
        lon=data.lon,
        description=data.description,
        price_min=data.price_min,
        price_max=data.price_max,
        is_free=data.is_free,
        age_limit=data.age_limit,
        language=data.language,
        org_link=data.org_link,
        status="published",
        source_type="manual",
        dedup_key=dedup_key,
    )
    db.add(event)

    try:
        await db.flush()  # получаем id; здесь сработает unique по dedup_key
    except IntegrityError:
        # Гонка: такое же мероприятие добавили между проверкой и вставкой
        await db.rollback()
        existing_id = await _find_by_dedup_key(db, dedup_key)
        if existing_id:
            raise DuplicateEventError(existing_id)
        raise

    db.add(
        Source(
            source_url="manual:form",
            source_type="manual",
            raw_data=data.model_dump(mode="json"),
            processed=True,
            event_id=event.id,
        )
    )
    db.add(
        AuditLog(
            entity_type="event",
            entity_id=event.id,
            action="create",
            changed_by=changed_by,
            new_data={
                "title": data.title,
                "date_start": data.date_start.isoformat(),
            },
        )
    )
    await db.commit()
    await db.refresh(event)
    return event