"""add categoria alias table

Revision ID: c7e8f3d2a1b0
Revises: ba98dc76fe54
Create Date: 2026-01-15 15:45:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'c7e8f3d2a1b0'
down_revision = 'ba98dc76fe54'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'categorias_alias',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('descricao_normalizada', sa.String(length=255), nullable=False),
        sa.Column('descricao_exemplo', sa.String(length=255), nullable=False),
        sa.Column('categoria_id', sa.Integer(), nullable=False),
        sa.Column('ocorrencias', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('atualizado_em', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
        sa.ForeignKeyConstraint(['categoria_id'], ['categorias.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('descricao_normalizada', name='uq_categoria_alias_descricao')
    )
    op.create_index('ix_categorias_alias_descricao_normalizada', 'categorias_alias', ['descricao_normalizada'])


def downgrade():
    op.drop_index('ix_categorias_alias_descricao_normalizada', table_name='categorias_alias')
    op.drop_table('categorias_alias')
