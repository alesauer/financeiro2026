"""add campos extras em viagens_custos

Revision ID: 1f2e3d4c5b6a
Revises: 13579bdf2468
Create Date: 2026-02-03 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '1f2e3d4c5b6a'
down_revision = '13579bdf2468'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('viagens_custos', sa.Column('nome', sa.String(length=120), nullable=True))
    op.add_column('viagens_custos', sa.Column('observacao', sa.Text(), nullable=True))
    op.add_column('viagens_custos', sa.Column('link', sa.String(length=255), nullable=True))
    op.execute("UPDATE viagens_custos SET nome = descricao WHERE nome IS NULL")
    op.alter_column('viagens_custos', 'nome', existing_type=sa.String(length=120), nullable=False)


def downgrade():
    op.drop_column('viagens_custos', 'link')
    op.drop_column('viagens_custos', 'observacao')
    op.drop_column('viagens_custos', 'nome')
