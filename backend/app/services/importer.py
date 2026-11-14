import json
from datetime import datetime
from typing import List, Dict, Any, Set
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.events import Event, Source, AuditLog
from app.services.normalize import generate_dedup_key, normalize_title

def _parse_dt(value: str) -> datetime:
    """ISO-строка -> naive datetime (колонки в БД без часового пояса)."""
    return datetime.fromisoformat(value.replace('Z', '+00:00')).replace(tzinfo=None)

async def import_events_from_json(
    db: AsyncSession, 
    raw_items: List[Dict[str, Any]], 
    source_type: str = "import",
    source_url: str = "manual_upload"
) -> Dict[str, Any]:
    """
    Импортирует события, обеспечивая идемпотентность и дедупликацию.
    Возвращает отчёт: сколько добавлено, обновлено, пропущено.
    """
    report = {"added": 0, "updated": 0, "skipped": 0, "errors": []}
    
    # Отслеживаем dedup_key в рамках этого файла, чтобы не дублировать внутри одного импорта
    seen_in_this_file: Set[str] = set()

    for idx, item in enumerate(raw_items):
        try:
            # 1. Нормализация и подготовка данных
            title = (item.get("title") or "").strip()
            normalized_title = normalize_title(item.get("normalized_title") or title)
            date_start_str = item.get("date_start")
            venue = (item.get("venue") or "").strip()
            
            if not title or not date_start_str:
                report["errors"].append(f"Row {idx}: Missing title or date_start")
                continue

            # Парсинг даты
            date_start = _parse_dt(date_start_str)
            date_end = _parse_dt(item["date_end"]) if item.get("date_end") else None

            # 2. Дедупликация
            dedup_key = generate_dedup_key(normalized_title, date_start_str, venue)
            
            # Проверяем, не встречался ли этот dedup_key уже в ЭТОМ файле
            if dedup_key in seen_in_this_file:
                report["skipped"] += 1
                continue
            
            seen_in_this_file.add(dedup_key)
            
            # Проверяем, есть ли уже такое событие в БД
            stmt = select(Event).where(Event.dedup_key == dedup_key)
            result = await db.execute(stmt)
            existing_event = result.scalar_one_or_none()

            # 3. Сохраняем сырые данные
            source_record = Source(
                source_url=source_url,
                source_type=source_type,
                raw_data=item,
                processed=True
            )
            db.add(source_record)

            if existing_event:
                # Событие уже существует в БД — обновляем (идемпотентность)
                existing_event.title = title
                existing_event.normalized_title = normalized_title
                existing_event.category = item.get("category", "other")
                existing_event.city = item.get("city", "Не указан")
                existing_event.venue = venue
                existing_event.address = item.get("address")
                existing_event.description = item.get("description")
                existing_event.price_min = item.get("price_min", 0)
                existing_event.price_max = item.get("price_max", 0)
                existing_event.is_free = item.get("is_free", False)
                existing_event.age_limit = item.get("age_limit", 0)
                existing_event.source_url = source_url
                existing_event.date_end = date_end
                for field in ("org_link", "language", "tags", "duration_min"):
                    if field in item:
                        setattr(existing_event, field, item[field])
                existing_event.updated_at = datetime.utcnow()
                
                source_record.event_id = existing_event.id
                
                # Логируем обновление
                audit = AuditLog(
                    entity_type="event",
                    entity_id=existing_event.id,
                    action="update",
                    changed_by="import_script",
                    new_data={"title": title, "date_start": date_start_str}
                )
                db.add(audit)
                report["updated"] += 1
            else:
                # Создаём новое событие
                new_event = Event(
                    title=title,
                    normalized_title=normalized_title,
                    category=item.get("category", "other"),
                    date_start=date_start,
                    date_end=date_end,
                    city=item.get("city", "Не указан"),
                    venue=venue,
                    address=item.get("address"),
                    description=item.get("description"),
                    price_min=item.get("price_min", 0),
                    price_max=item.get("price_max", 0),
                    is_free=item.get("is_free", False),
                    age_limit=item.get("age_limit", 0),
                    org_link=item.get("org_link"),
                    language=item.get("language"),
                    tags=item.get("tags") or [],
                    duration_min=item.get("duration_min"),
                    status="published",
                    source_type=source_type,
                    source_url=source_url,
                    dedup_key=dedup_key,
                )
                db.add(new_event)
                await db.flush()  # Чтобы получить ID
                
                source_record.event_id = new_event.id
                
                # Логируем создание
                audit = AuditLog(
                    entity_type="event",
                    entity_id=new_event.id,
                    action="create",
                    changed_by="import_script",
                    new_data={"title": title, "date_start": date_start_str}
                )
                db.add(audit)
                report["added"] += 1

        except Exception as e:
            report["errors"].append(f"Row {idx}: {str(e)}")
            report["skipped"] += 1

    await db.commit()
    return report