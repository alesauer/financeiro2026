"""merge categoria alias and config noop heads

Revision ID: eef0b1234abc
Revises: c7e8f3d2a1b0, deadbeef0001
Create Date: 2026-01-15 16:10:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'eef0b1234abc'
down_revision = ('c7e8f3d2a1b0', 'deadbeef0001')
branch_labels = None
depends_on = None


def upgrade():
    # Merge migration: no schema changes required.
    pass


def downgrade():
    # Downgrade to either parent head is not supported.
    pass
