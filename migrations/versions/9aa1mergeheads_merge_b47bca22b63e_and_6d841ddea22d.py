"""Merge heads b47bca22b63e and 6d841ddea22d

Revision ID: 9aa1mergeheads
Revises: b47bca22b63e, 6d841ddea22d
Create Date: 2026-01-12 00:12:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '9aa1mergeheads'
down_revision = ('b47bca22b63e', '6d841ddea22d')
branch_labels = None
depends_on = None


def upgrade():
    # This is a merge migration; no schema changes needed.
    pass


def downgrade():
    # Downgrade to either parent head isn't supported by this noop merge.
    pass
