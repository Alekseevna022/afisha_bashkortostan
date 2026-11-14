"""initial schema

Revision ID: 001
Revises:
Create Date: 2026-11-13
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, ARRAY

revision = '001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'events',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('title', sa.Text(), nullable=False),
        sa.Column('normalized_title', sa.Text(), nullable=False),
        sa.Column('category', sa.String(32), nullable=False),
        sa.Column('tags', ARRAY(sa.Text()), server_default='{}'),
        sa.Column('date_start', sa.DateTime(), nullable=False),
        sa.Column('date_end', sa.DateTime()),
        sa.Column('duration_min', sa.Integer()),
        sa.Column('city', sa.Text(), nullable=False),
        sa.Column('venue', sa.Text()),
        sa.Column('address', sa.Text()),
        sa.Column('lat', sa.Numeric(9, 6)),
        sa.Column('lon', sa.Numeric(9, 6)),
        sa.Column('description', sa.Text()),
        sa.Column('price_min', sa.Integer(), server_default='0'),
        sa.Column('price_max', sa.Integer(), server_default='0'),
        sa.Column('is_free', sa.Boolean(), server_default='false'),
        sa.Column('age_limit', sa.Integer(), server_default='0'),
        sa.Column('language', sa.Text()),
        sa.Column('org_link', sa.Text()),
        sa.Column('source_url', sa.Text()),
        sa.Column('source_type', sa.String(16), nullable=False, server_default='manual'),
        sa.Column('source_hash', sa.Text()),
        sa.Column('verified_at', sa.DateTime()),
        sa.Column('confidence', sa.Numeric(3, 2), server_default='1.0'),
        sa.Column('status', sa.String(16), server_default='published'),
        sa.Column('dedup_key', sa.Text(), unique=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index('idx_events_city', 'events', ['city'])
    op.create_index('idx_events_category', 'events', ['category'])
    op.create_index('idx_events_date', 'events', ['date_start'])
    op.create_index('idx_events_status', 'events', ['status'])
    op.create_index('idx_events_dedup', 'events', ['dedup_key'])

    op.create_table(
        'agent_traces',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('session_id', UUID(as_uuid=True), nullable=False),
        sa.Column('user_message', sa.Text(), nullable=False),
        sa.Column('plan', sa.Text()),
        sa.Column('tool_calls', sa.Text()),
        sa.Column('response', sa.Text(), nullable=False),
        sa.Column('event_ids', ARRAY(UUID(as_uuid=True))),
        sa.Column('latency_ms', sa.Integer()),
        sa.Column('tokens_used', sa.Integer()),
        sa.Column('cost_rub', sa.Numeric(6, 4)),
        sa.Column('model', sa.String(32)),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table('agent_traces')
    op.drop_table('events')