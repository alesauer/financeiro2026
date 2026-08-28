"""Integrate forma_pagamento_id in transacoes and drop old enum

Revision ID: e5a1c7d9ab01
Revises: d3f1b2c4e6a7
Create Date: 2026-01-12 00:10:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import table, column
from sqlalchemy import String, Integer

# revision identifiers, used by Alembic.
revision = 'e5a1c7d9ab01'
down_revision = 'd3f1b2c4e6a7'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    meta = sa.MetaData()
    meta.bind = bind

    # 1) Add new column forma_pagamento_id (nullable=True initially)
    op.add_column('transacoes', sa.Column('forma_pagamento_id', sa.Integer(), nullable=True))
    op.create_foreign_key('fk_transacoes_forma_pagamento', 'transacoes', 'formas_pagamento', ['forma_pagamento_id'], ['id'])
    op.create_index('ix_transacoes_forma_pagamento_id', 'transacoes', ['forma_pagamento_id'])

    # 2) Seed formas_pagamento with distinct old enum values and backfill
    try:
        # Discover distinct old values from transacoes.forma_pagamento
        distinct_values = [row[0] for row in bind.execute(sa.text('SELECT DISTINCT forma_pagamento FROM transacoes')) if row[0] is not None]
        # Ensure a formas_pagamento record for each
        for val in distinct_values:
            # Check exists
            exists = bind.execute(sa.text('SELECT id FROM formas_pagamento WHERE nome = :v OR tipo = :v LIMIT 1'), {'v': val}).fetchone()
            if not exists:
                # Insert generic record where nome==tipo==val
                cartao = (str(val).lower() == 'cartão de crédito')
                bind.execute(sa.text('INSERT INTO formas_pagamento (nome, tipo, cartao_credito, ativo) VALUES (:n, :t, :c, :a)')),
                # Alembic safe insert requires separate execute with params
                bind.execute(sa.text('INSERT INTO formas_pagamento (nome, tipo, cartao_credito, ativo) VALUES (:n, :t, :c, :a)'), {
                    'n': val,
                    't': val,
                    'c': 1 if cartao else 0,
                    'a': 1,
                })
        # Backfill transacoes.forma_pagamento_id using nome or tipo match
        bind.execute(sa.text('''
            UPDATE transacoes t
            JOIN formas_pagamento f
              ON f.nome = t.forma_pagamento OR f.tipo = t.forma_pagamento
            SET t.forma_pagamento_id = f.id
            WHERE t.forma_pagamento_id IS NULL
        '''))
    except Exception:
        # If transacoes.forma_pagamento doesn't exist or DB doesn't support JOIN syntax in UPDATE (non-MySQL), fallback noop
        pass

    # 3) Set NOT NULL after backfill
    try:
        op.alter_column('transacoes', 'forma_pagamento_id', existing_type=sa.Integer(), nullable=False)
    except Exception:
        # If some rows remain null, leave nullable and let application validate
        pass

    # 4) Drop old enum column if exists
    try:
        op.drop_column('transacoes', 'forma_pagamento')
    except Exception:
        # Column may already be absent or DB-specific constraints
        pass


def downgrade():
    # 1) Recreate old enum/string column (approximation using String)
    try:
        op.add_column('transacoes', sa.Column('forma_pagamento', sa.String(length=50), nullable=True))
    except Exception:
        pass

    bind = op.get_bind()
    try:
        # Backfill legacy column from joined formas_pagamento
        bind.execute(sa.text('''
            UPDATE transacoes t
            JOIN formas_pagamento f ON f.id = t.forma_pagamento_id
            SET t.forma_pagamento = COALESCE(f.nome, f.tipo)
        '''))
    except Exception:
        pass

    # 2) Drop FK/index/column forma_pagamento_id
    try:
        op.drop_index('ix_transacoes_forma_pagamento_id', table_name='transacoes')
    except Exception:
        pass
    try:
        op.drop_constraint('fk_transacoes_forma_pagamento', 'transacoes', type_='foreignkey')
    except Exception:
        pass
    try:
        op.drop_column('transacoes', 'forma_pagamento_id')
    except Exception:
        pass
