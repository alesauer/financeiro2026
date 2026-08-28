"""noop migration to resolve duplicate revision id

Revision ID: deadbeef0001
Revises: c0ffee123456
Create Date: 2026-01-13 12:05:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'deadbeef0001'
down_revision = 'c0ffee123456'
branch_labels = None
depends_on = None


def upgrade():
    # No operation: this migration exists only to resolve a duplicate revision id left earlier
    pass


def downgrade():
    # No operation
    pass
