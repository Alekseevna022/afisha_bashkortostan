from datetime import datetime
from typing import Optional, List, Literal
from urllib.parse import urlparse
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

# Те же значения, что в CATEGORY_LABELS на фронтенде (frontend/app/lib/events.ts)
EventCategory = Literal[
    "concert", "play", "exhibition", "festival", "cinema", "tour", "other"
]


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

class EventCreate(BaseModel):
    """Данные для ручного добавления мероприятия (форма на сайте)."""

    # Пробелы по краям срезаем до проверки длины: «   » не пройдёт как название
    model_config = ConfigDict(str_strip_whitespace=True)

    title: str = Field(..., min_length=1, max_length=300)
    category: EventCategory
    date_start: datetime
    date_end: Optional[datetime] = None
    city: str = Field(..., min_length=1, max_length=100)
    venue: Optional[str] = Field(None, max_length=300)
    address: Optional[str] = Field(None, max_length=300)
    description: Optional[str] = Field(None, max_length=5000)
    price_min: int = Field(0, ge=0, le=1_000_000)
    price_max: int = Field(0, ge=0, le=1_000_000)
    is_free: bool = False
    age_limit: int = Field(0, ge=0, le=21)
    language: Optional[str] = Field(None, max_length=50)
    org_link: Optional[str] = Field(None, max_length=500)
    tags: List[str] = Field(default_factory=list, max_length=20)
    duration_min: Optional[int] = Field(None, ge=1, le=100_000)
    lat: Optional[float] = Field(None, ge=-90, le=90)
    lon: Optional[float] = Field(None, ge=-180, le=180)

    @field_validator("venue", "address", "description", "language", "org_link")
    @classmethod
    def empty_to_none(cls, v: Optional[str]) -> Optional[str]:
        return v or None

    @field_validator("date_start", "date_end")
    @classmethod
    def drop_timezone(cls, v: Optional[datetime]) -> Optional[datetime]:
        # В БД колонки без часового пояса (время местное) — храним «как введено»
        return v.replace(tzinfo=None) if v else v

    @field_validator("org_link")
    @classmethod
    def check_link(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        parsed = urlparse(v)
        if parsed.scheme not in ("http", "https") or not parsed.netloc:
            raise ValueError("Ссылка должна начинаться с http:// или https://")
        return v

    @field_validator("tags")
    @classmethod
    def clean_tags(cls, v: List[str]) -> List[str]:
        seen: List[str] = []
        for tag in v:
            tag = tag.strip()
            if tag and tag.lower() not in (t.lower() for t in seen):
                seen.append(tag)
        return seen

    @model_validator(mode="after")
    def check_consistency(self) -> "EventCreate":
        if self.date_end and self.date_end < self.date_start:
            raise ValueError("Дата окончания раньше даты начала")
        if self.is_free:
            self.price_min = 0
            self.price_max = 0
        elif self.price_max and self.price_max < self.price_min:
            raise ValueError("Максимальная цена меньше минимальной")
        return self    