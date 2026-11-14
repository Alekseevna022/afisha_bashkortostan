"""increase model name length in agent_traces

Revision ID: 004
Revises: 003
Create Date: 2026-11-13
"""
from alembic import op
import sqlalchemy as sa

revision = '004'
down_revision = '003'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Увеличиваем длину колонки model с 32 до 128
    op.alter_column(
        'agent_traces',
        'model',
        existing_type=sa.String(32),
        type_=sa.String(128),
        existing_nullable=True
    )


def downgrade() -> None:
    # Возвращаем как было (на случай отката)
    op.alter_column(
        'agent_traces',
        'model',
        existing_type=sa.String(128),
        type_=sa.String(32),
        existing_nullable=True
    )