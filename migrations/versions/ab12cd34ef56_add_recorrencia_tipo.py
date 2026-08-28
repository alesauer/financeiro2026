"""Add column recorrencia_tipo to transacoes

Revision ID: ab12cd34ef56
Revises: fe12ab34cd57
Create Date: 2026-01-14 11:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'ab12cd34ef56'
down_revision = 'fe12ab34cd57'
branch_labels = None
depends_on = None


def upgrade():
    try:
        op.execute(
            """
            ALTER TABLE transacoes
            ADD COLUMN recorrencia_tipo ENUM('Assinatura','Parcelamento') NULL
            """
        )
    except Exception:
        # Em bancos sem suporte a ENUM, criar como VARCHAR
        try:
            op.add_column('transacoes', sa.Column('recorrencia_tipo', sa.String(length=20), nullable=True))
        except Exception:
            pass


def downgrade():
    try:
        op.execute(
            """
            ALTER TABLE transacoes
            DROP COLUMN recorrencia_tipo
            """
        )
    except Exception:
        try:
            op.drop_column('transacoes', 'recorrencia_tipo')
        except Exception:
            pass
