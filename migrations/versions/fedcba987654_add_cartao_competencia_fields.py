"""add cartao fechamento and competencia fields

Revision ID: fedcba987654
Revises: eef0b1234abc
Create Date: 2026-01-15 17:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'fedcba987654'
down_revision = 'eef0b1234abc'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('formas_pagamento') as batch_op:
        batch_op.add_column(sa.Column('dia_fechamento', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('dia_vencimento', sa.Integer(), nullable=True))

    with op.batch_alter_table('transacoes') as batch_op:
        batch_op.add_column(sa.Column('competencia_fatura', sa.Date(), nullable=True))


def downgrade():
    with op.batch_alter_table('transacoes') as batch_op:
        batch_op.drop_column('competencia_fatura')

    with op.batch_alter_table('formas_pagamento') as batch_op:
        batch_op.drop_column('dia_vencimento')
        batch_op.drop_column('dia_fechamento')
