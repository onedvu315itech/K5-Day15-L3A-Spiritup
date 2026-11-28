"""Thêm bảng users và auth_refresh_tokens cho đăng nhập bằng cookie (docs/DATABASE.md v0.5).

Revision ID: 0003
Revises: 0002
Create Date: 2026-11-28
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import app.db.base

revision: str = '0003'
down_revision: Union[str, None] = '0002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'users',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('email', sa.Text(), nullable=False),
        sa.Column('password_hash', sa.Text(), nullable=False),
        sa.Column('display_name', sa.Text(), nullable=True),
        sa.Column('created_at', app.db.base.UTCDateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('email', name='uq_users_email'),
    )
    op.create_table(
        'auth_refresh_tokens',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('token_hash', sa.Text(), nullable=False),
        sa.Column('expires_at', app.db.base.UTCDateTime(timezone=True), nullable=False),
        sa.Column('revoked_at', app.db.base.UTCDateTime(timezone=True), nullable=True),
        sa.Column('created_at', app.db.base.UTCDateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('token_hash', name='uq_auth_refresh_tokens_hash'),
    )
    op.create_index('ix_auth_refresh_tokens_user_id', 'auth_refresh_tokens', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_auth_refresh_tokens_user_id', table_name='auth_refresh_tokens')
    op.drop_table('auth_refresh_tokens')
    op.drop_table('users')
