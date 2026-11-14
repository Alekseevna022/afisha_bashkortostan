import uuid
import json
from datetime import datetime
from sqlalchemy import Column, String, Text, Integer, Boolean, Numeric, DateTime, ARRAY, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from app.database import Base


class Event(Base):
    __tablename__ = "events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(Text, nullable=False)
    normalized_title = Column(Text, nullable=False)
    category = Column(String(32), nullable=False)
    tags = Column(ARRAY(Text), default=list)

    date_start = Column(DateTime, nullable=False)
    date_end = Column(DateTime)
    duration_min = Column(Integer)

    city = Column(Text, nullable=False)
    venue = Column(Text)
    address = Column(Text)
    lat = Column(Numeric(9, 6))
    lon = Column(Numeric(9, 6))

    description = Column(Text)
    price_min = Column(Integer, default=0)
    price_max = Column(Integer, default=0)
    is_free = Column(Boolean, default=False)
    age_limit = Column(Integer, default=0)
    language = Column(Text)

    org_link = Column(Text)
    source_url = Column(Text)
    source_type = Column(String(16), nullable=False, default="manual")
    source_hash = Column(Text)
    verified_at = Column(DateTime)
    confidence = Column(Numeric(3, 2), default=1.0)

    # Статусы: published, draft, cancelled
    status = Column(String(16), default="published")
    dedup_key = Column(Text, unique=True, index=True)

    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())


class Source(Base):
    """Хранение сырых данных для возможности переиграть нормализацию"""
    __tablename__ = "sources"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_url = Column(Text, nullable=False)
    source_type = Column(String(16), nullable=False)
    raw_data = Column(JSONB, nullable=False)
    fetched_at = Column(DateTime, default=func.now())
    processed = Column(Boolean, default=False)
    event_id = Column(UUID(as_uuid=True), ForeignKey("events.id"), nullable=True)


class AuditLog(Base):
    """Журнал изменений событий"""
    __tablename__ = "audit_log"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    entity_type = Column(String(32), nullable=False)  # 'event'
    entity_id = Column(UUID(as_uuid=True), nullable=False)
    action = Column(String(16), nullable=False)  # 'create', 'update', 'cancel', 'import'
    changed_by = Column(String(64), default="system")
    old_data = Column(JSONB)
    new_data = Column(JSONB)
    created_at = Column(DateTime, default=func.now())

class AgentTrace(Base):
    __tablename__ = "agent_traces"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(String(64), nullable=False, index=True)
    user_message = Column(Text, nullable=False)
    plan = Column(Text)
    tool_calls = Column(Text)
    response = Column(Text, nullable=False)
    event_ids = Column(ARRAY(UUID(as_uuid=True)))
    latency_ms = Column(Integer)
    tokens_used = Column(Integer)
    cost_rub = Column(Numeric(6, 4))
    
    model = Column(String(128)) 
    
    created_at = Column(DateTime, default=func.now())