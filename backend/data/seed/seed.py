import asyncio
import json
from pathlib import Path
from datetime import datetime
from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models.events import Event


async def seed():
    data_path = Path(__file__).parent / "sample_events.json"
    with open(data_path, "r", encoding="utf-8") as f:
        items = json.load(f)

    async with AsyncSessionLocal() as session:
        for item in items:
            dedup_key = f"{item['normalized_title']}|{item['date_start']}|{item.get('venue', '')}"
            
            # Проверяем на дубликаты
            existing = await session.execute(
                select(Event).where(Event.dedup_key == dedup_key)
            )
            if existing.scalar_one_or_none():
                print(f"Skip duplicate: {item['title']}")
                continue

            # ИСПРАВЛЕНО: Преобразуем строки ISO в объекты datetime
            date_start = datetime.fromisoformat(item["date_start"])
            date_end = datetime.fromisoformat(item["date_end"]) if item.get("date_end") else None

            event = Event(
                title=item["title"],
                normalized_title=item["normalized_title"],
                category=item["category"],
                date_start=date_start,
                date_end=date_end,
                city=item["city"],
                venue=item.get("venue"),
                address=item.get("address"),
                description=item.get("description"),
                price_min=item.get("price_min", 0),
                price_max=item.get("price_max", 0),
                is_free=item.get("is_free", False),
                age_limit=item.get("age_limit", 0),
                status=item.get("status", "published"),
                source_type=item.get("source_type", "manual"),
                dedup_key=dedup_key,
            )
            session.add(event)
            print(f"Added: {item['title']}")

        await session.commit()
    print("Seed complete")


if __name__ == "__main__":
    asyncio.run(seed())