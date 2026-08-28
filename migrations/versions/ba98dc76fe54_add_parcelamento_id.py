"""Add parcelamento_id column and index to transacoes

Revision ID: ba98dc76fe54
Revises: ab12cd34ef56
Create Date: 2026-01-14 11:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'ba98dc76fe54'
down_revision = 'ab12cd34ef56'
branch_labels = None
depends_on = None


def upgrade():
    try:
        op.add_column('transacoes', sa.Column('parcelamento_id', sa.String(length=36), nullable=True))
        op.create_index('ix_transacoes_parcelamento_id', 'transacoes', ['parcelamento_id'])
    except Exception:
        # Caso já exista, ignorar
        pass


def downgrade():
    try:
        op.drop_index('ix_transacoes_parcelamento_id', table_name='transacoes')
    except Exception:
        pass
    try:
        op.drop_column('transacoes', 'parcelamento_id')
    except Exception:
        pass
