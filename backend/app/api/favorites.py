
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import get_current_user
from app.database import get_db
from app.models.events import Event
from app.models.favorites import Favorite
from app.models.users import User
from app.schemas.events import EventResponse


router = APIRouter(
    prefix="/api/v1/favorites",
    tags=["Избранное"],
)


@router.get("/ids")
async def get_favorite_ids(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Favorite.event_id)
        .where(Favorite.user_id == user.id)
    )

    return {
        "items": [str(event_id) for event_id in result.scalars().all()]
    }


@router.get("")
async def get_favorites(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Event)
        .join(Favorite, Favorite.event_id == Event.id)
        .where(Favorite.user_id == user.id)
        .order_by(Favorite.created_at.desc())
    )

    events = result.scalars().all()

    return {
        "items": [
            EventResponse.model_validate(event)
            for event in events
        ]
    }


@router.post("/{event_id}")
async def add_favorite(
    event_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    event = await db.get(Event, event_id)

    if not event:
        raise HTTPException(
            status_code=404,
            detail="Мероприятие не найдено",
        )

    statement = (
        insert(Favorite)
        .values(
            user_id=user.id,
            event_id=event_id,
        )
        .on_conflict_do_nothing(
            index_elements=["user_id", "event_id"]
        )
    )

    await db.execute(statement)
    await db.commit()

    return {"is_favorite": True}


@router.delete("/{event_id}")
async def remove_favorite(
    event_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await db.execute(
        delete(Favorite).where(
            Favorite.user_id == user.id,
            Favorite.event_id == event_id,
        )
    )

    await db.commit()

    return {"is_favorite": False}
