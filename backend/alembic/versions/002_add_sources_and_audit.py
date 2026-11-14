"""add sources and audit_log tables

Revision ID: 002
Revises: 001
Create Date: 2026-11-13
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = '002'
down_revision = '001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Создаём таблицу сырых данных
    op.create_table(
        'sources',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('source_url', sa.Text(), nullable=False),
        sa.Column('source_type', sa.String(16), nullable=False),
        sa.Column('raw_data', JSONB, nullable=False),
        sa.Column('fetched_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('processed', sa.Boolean(), server_default='false'),
        sa.Column('event_id', UUID(as_uuid=True), nullable=True),
    )
    # Добавляем внешний ключ на таблицу events
    op.create_foreign_key('fk_sources_event_id', 'sources', 'events', ['event_id'], ['id'])

    # Создаём таблицу журнала аудита
    op.create_table(
        'audit_log',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('entity_type', sa.String(32), nullable=False),
        sa.Column('entity_id', UUID(as_uuid=True), nullable=False),
        sa.Column('action', sa.String(16), nullable=False),
        sa.Column('changed_by', sa.String(64), server_default='system'),
        sa.Column('old_data', JSONB),
        sa.Column('new_data', JSONB),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table('audit_log')
    op.drop_constraint('fk_sources_event_id', 'sources', type_='foreignkey')
    op.drop_table('sources')