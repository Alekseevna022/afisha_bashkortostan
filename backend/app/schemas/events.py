from datetime import datetime
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel


class EventBase(BaseModel):
    title: str
    category: str
    date_start: datetime
    city: str


class EventResponse(EventBase):
    id: UUID
    venue: Optional[str] = None
    address: Optional[str] = None
    description: Optional[str] = None
    price_min: int = 0
    price_max: int = 0
    is_free: bool = False
    age_limit: int = 0
    status: str
    org_link: Optional[str] = None
    source_url: Optional[str] = None

    class Config:
        from_attributes = True


class EventListResponse(BaseModel):
    items: List[EventResponse]
    total: int
    page: int
    per_page: int