"""Синхронный движок для инструментов агента.
Используется, чтобы избежать конфликтов event loop'ов asyncpg.
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.config import get_settings

settings = get_settings()

# Меняем драйвер с asyncpg на psycopg2
sync_url = settings.database_url.replace("+asyncpg", "+psycopg2")

# NullPool — каждое соединение создаётся и закрывается заново,
# никаких конфликтов с пулом async-движка
sync_engine = create_engine(sync_url, pool_pre_ping=True, future=True)

SyncSessionLocal = sessionmaker(bind=sync_engine, autoflush=False, expire_on_commit=False, future=True)