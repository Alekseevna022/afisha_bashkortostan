"""session_id as string

Revision ID: 003
Revises: 002
Create Date: 2026-11-13
"""
from alembic import op
import sqlalchemy as sa

revision = '003'
down_revision = '002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Меняем тип session_id с UUID на String(64)
    op.alter_column(
        'agent_traces',
        'session_id',
        existing_type=sa.dialects.postgresql.UUID(),
        type_=sa.String(64),
        existing_nullable=False,
        postgresql_using='session_id::text',
    )
    # Добавляем индекс для быстрого поиска по сессии
    op.create_index('idx_agent_traces_session_id', 'agent_traces', ['session_id'])


def downgrade() -> None:
    op.drop_index('idx_agent_traces_session_id', table_name='agent_traces')
    op.alter_column(
        'agent_traces',
        'session_id',
        existing_type=sa.String(64),
        type_=sa.dialects.postgresql.UUID(),
        existing_nullable=False,
        postgresql_using='session_id::uuid',
    )