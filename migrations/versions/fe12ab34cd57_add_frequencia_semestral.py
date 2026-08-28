"""Add 'Semestral' to frequencia enum in transacoes

Revision ID: fe12ab34cd57
Revises: c0ffee123456
Create Date: 2026-01-14 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'fe12ab34cd57'
down_revision = 'c0ffee123456'
branch_labels = None
depends_on = None


def upgrade():
    # MySQL: alterar ENUM para incluir 'Semestral'
    try:
        op.execute(
            """
            ALTER TABLE transacoes
            MODIFY COLUMN frequencia ENUM('Diária','Semanal','Mensal','Semestral','Anual') NULL
            """
        )
    except Exception:
        # Para bancos que não suportam ENUM (ou já compatíveis), ignorar
        pass


def downgrade():
    # Reverter ENUM removendo 'Semestral'
    try:
        op.execute(
            """
            ALTER TABLE transacoes
            MODIFY COLUMN frequencia ENUM('Diária','Semanal','Mensal','Anual') NULL
            """
        )
    except Exception:
        pass
