"""Add formas_pagamento table

Revision ID: d3f1b2c4e6a7
Revises: b47bca22b63e
Create Date: 2026-01-12 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'd3f1b2c4e6a7'
down_revision = '9aa1mergeheads'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'formas_pagamento',
        sa.Column('id', sa.Integer(), primary_key=True, nullable=False),
        sa.Column('nome', sa.String(length=120), nullable=False),
        sa.Column('tipo', sa.String(length=30), nullable=False),
        sa.Column('cartao_credito', sa.Boolean(), nullable=False, server_default=sa.sql.expression.false()),
        sa.Column('ativo', sa.Boolean(), nullable=False, server_default=sa.sql.expression.true()),
    )
    op.create_index('ix_formas_pagamento_tipo', 'formas_pagamento', ['tipo'])
    op.create_index('ix_formas_pagamento_ativo', 'formas_pagamento', ['ativo'])
    op.create_unique_constraint('uq_formas_pagamento_nome_tipo', 'formas_pagamento', ['nome', 'tipo'])


def downgrade():
    op.drop_constraint('uq_formas_pagamento_nome_tipo', 'formas_pagamento', type_='unique')
    op.drop_index('ix_formas_pagamento_ativo', table_name='formas_pagamento')
    op.drop_index('ix_formas_pagamento_tipo', table_name='formas_pagamento')
    op.drop_table('formas_pagamento')
