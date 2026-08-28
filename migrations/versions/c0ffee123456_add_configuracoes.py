"""add configuracoes table

Revision ID: c0ffee123456
Revises: a7c9e1f2b3d4
Create Date: 2026-01-13 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'c0ffee123456'
down_revision = 'a7c9e1f2b3d4'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'configuracoes',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('chave', sa.String(length=100), nullable=False),
        sa.Column('valor', sa.Text(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('chave')
    )


def downgrade():
    op.drop_table('configuracoes')
