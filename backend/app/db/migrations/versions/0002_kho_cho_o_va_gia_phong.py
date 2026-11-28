"""Kho có chỗ ở (category `lodging`) và khoảng giá phòng/đêm tra web lúc thu kho (docs/DATABASE.md v0.4).

Revision ID: 0002
Revises: 0001
Create Date: 2026-11-28
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '0002'
down_revision: Union[str, None] = '0001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

OLD = "category IN ('food', 'snack', 'cafe', 'sightseeing', 'activity')"
NEW = "category IN ('food', 'snack', 'cafe', 'sightseeing', 'activity', 'lodging')"


def upgrade() -> None:
    with op.batch_alter_table('places', schema=None) as batch_op:
        batch_op.add_column(sa.Column('price_min_vnd', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('price_max_vnd', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('price_source_url', sa.Text(), nullable=True))
        batch_op.drop_constraint('ck_places_category', type_='check')
        batch_op.create_check_constraint('ck_places_category', NEW)


def downgrade() -> None:
    op.execute("DELETE FROM places WHERE category = 'lodging'")
    with op.batch_alter_table('places', schema=None) as batch_op:
        batch_op.drop_constraint('ck_places_category', type_='check')
        batch_op.create_check_constraint('ck_places_category', OLD)
        batch_op.drop_column('price_source_url')
        batch_op.drop_column('price_max_vnd')
        batch_op.drop_column('price_min_vnd')
