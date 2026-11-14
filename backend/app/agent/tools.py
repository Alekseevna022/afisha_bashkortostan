"""Инструменты ИИ-агента. Синхронные функции для избежания конфликтов event loop."""
import json
from datetime import datetime
from typing import Optional
from langchain_core.tools import tool
from sqlalchemy import select
from app.database_sync import SyncSessionLocal
from app.models.events import Event


# Список городов для подсказки агенту
KNOWN_CITIES = [
    "Уфа", "Стерлитамак", "Салават", "Нефтекамск", "Октябрьский",
    "Белебей", "Благовещенск", "Давлеканово", "Дюртюли", "Ишимбай",
    "Кумертау", "Мелеуз", "Сибай", "Туймазы", "Бирск", "Янаул",
]


def _serialize_event(e: Event) -> dict:
    return {
        "id": str(e.id),
        "title": e.title,
        "category": e.category,
        "date_start": e.date_start.isoformat() if e.date_start else None,
        "date_end": e.date_end.isoformat() if e.date_end else None,
        "duration_min": e.duration_min,
        "city": e.city,
        "venue": e.venue,
        "address": e.address,
        "description": (e.description or "")[:300],
        "price_min": e.price_min,
        "price_max": e.price_max,
        "is_free": e.is_free,
        "age_limit": e.age_limit,
        "org_link": e.org_link,
        "source_url": e.source_url,
        "status": e.status,
    }


@tool
def search_events(
    city: Optional[str] = None,
    category: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    price_max: Optional[int] = None,
    age_limit: Optional[int] = None,
    is_free: Optional[bool] = None,
    query: Optional[str] = None,
    limit: int = 10,
) -> str:
    """
    Поиск культурных мероприятий в базе данных Республики Башкортостан.
    Вызывай ПЕРВЫМ при любом запросе о мероприятиях.

    ВАЖНО про город:
    - "Башкортостан" — это РЕСПУБЛИКА, а не город. Не передавай city="Башкортостан".
    - Если пользователь не назвал конкретный город — НЕ передавай аргумент city вообще.
    - Названия городов: Уфа, Стерлитамак, Салават, Нефтекамск, Октябрьский, Белебей,
      Благовещенск, Давлеканово, Дюртюли, Ишимбай, Кумертау, Мелеуз, Сибай, Туймазы,
      Бирск, Янаул.
    - Если в запросе опечатка (например, "стерлитакмае") — исправь на ближайший город.

    Args:
        city: Город из списка выше (например, "Уфа"). НЕ передавай "Башкортостан".
        category: concert, play, exhibition, festival, cinema, tour, other
        date_from: Дата начала в формате YYYY-MM-DD
        date_to: Дата окончания в формате YYYY-MM-DD
        price_max: Максимальная цена в рублях
        age_limit: Максимальный возраст (например, 7 для ребёнка 7 лет)
        is_free: Только бесплатные (true/false)
        query: Текст для поиска по названию/описанию
        limit: Максимум результатов (по умолчанию 10)

    Returns:
        JSON со списком событий или пустой список.
    """
    try:
        with SyncSessionLocal() as session:
            stmt = select(Event).where(Event.status == "published")

            # Защита: если агент всё-таки передал "Башкортостан" — игнорируем city
            if city and city.strip().lower() not in ("башкортостан", "рб", "республика"):
                stmt = stmt.where(Event.city.ilike(f"%{city.strip()}%"))
            if category:
                stmt = stmt.where(Event.category == category)
            if date_from:
                try:
                    stmt = stmt.where(Event.date_start >= datetime.fromisoformat(date_from))
                except ValueError:
                    pass
            if date_to:
                try:
                    stmt = stmt.where(Event.date_start <= datetime.fromisoformat(date_to + "T23:59:59"))
                except ValueError:
                    pass
            if price_max is not None:
                stmt = stmt.where((Event.price_min <= price_max) | (Event.is_free == True))
            if age_limit is not None:
                stmt = stmt.where(Event.age_limit <= age_limit)
            if is_free:
                stmt = stmt.where(Event.is_free == True)
            if query:
                stmt = stmt.where(
                    Event.title.ilike(f"%{query}%") | Event.description.ilike(f"%{query}%")
                )

            stmt = stmt.order_by(Event.date_start).limit(limit)
            events = session.execute(stmt).scalars().all()
            data = [_serialize_event(e) for e in events]

        if not data:
            return json.dumps({"found": 0, "events": [], "message": "Ничего не найдено"}, ensure_ascii=False)

        return json.dumps({"found": len(data), "events": data}, ensure_ascii=False)
    except Exception as e:
        return json.dumps({"error": str(e), "found": 0, "events": []}, ensure_ascii=False)


@tool
def get_event(event_id: str) -> str:
    """Полная карточка события по UUID."""
    try:
        with SyncSessionLocal() as session:
            event = session.execute(select(Event).where(Event.id == event_id)).scalar_one_or_none()
            if not event:
                return json.dumps({"error": "Событие не найдено"}, ensure_ascii=False)
            return json.dumps(_serialize_event(event), ensure_ascii=False)
    except Exception as e:
        return json.dumps({"error": str(e)}, ensure_ascii=False)


@tool
def find_similar(event_id: str, limit: int = 5) -> str:
    """Похожие события по категории и городу."""
    try:
        with SyncSessionLocal() as session:
            source = session.execute(select(Event).where(Event.id == event_id)).scalar_one_or_none()
            if not source:
                return json.dumps({"error": "Исходное событие не найдено"}, ensure_ascii=False)

            stmt = (
                select(Event)
                .where(
                    Event.status == "published",
                    Event.category == source.category,
                    Event.city == source.city,
                    Event.id != source.id,
                )
                .order_by(Event.date_start)
                .limit(limit)
            )
            events = session.execute(stmt).scalars().all()
            return json.dumps({
                "found": len(events),
                "events": [_serialize_event(e) for e in events]
            }, ensure_ascii=False)
    except Exception as e:
        return json.dumps({"error": str(e)}, ensure_ascii=False)


@tool
def get_venue_schedule(venue: str, date_from: Optional[str] = None, date_to: Optional[str] = None) -> str:
    """Расписание событий на площадке."""
    try:
        with SyncSessionLocal() as session:
            stmt = select(Event).where(
                Event.status == "published",
                Event.venue.ilike(f"%{venue}%")
            )
            if date_from:
                stmt = stmt.where(Event.date_start >= datetime.fromisoformat(date_from))
            if date_to:
                stmt = stmt.where(Event.date_start <= datetime.fromisoformat(date_to + "T23:59:59"))

            events = session.execute(stmt.order_by(Event.date_start).limit(20)).scalars().all()
            return json.dumps({
                "venue": venue,
                "found": len(events),
                "events": [_serialize_event(e) for e in events]
            }, ensure_ascii=False)
    except Exception as e:
        return json.dumps({"error": str(e)}, ensure_ascii=False)


ALL_TOOLS = [search_events, get_event, find_similar, get_venue_schedule]