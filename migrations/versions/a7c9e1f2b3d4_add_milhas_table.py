"""Add milhas table

Revision ID: a7c9e1f2b3d4
Revises: f1a2b3c4d5e6
Create Date: 2026-01-13 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'a7c9e1f2b3d4'
down_revision = 'f1a2b3c4d5e6'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'milhas',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('usuario_id', sa.Integer(), nullable=False),
        sa.Column('programa', sa.String(length=100), nullable=False),
        sa.Column('tipo', sa.String(length=10), nullable=False),  # entrada | saida
        sa.Column('quantidade', sa.Integer(), nullable=False),
        sa.Column('origem', sa.String(length=120), nullable=True),
        sa.Column('data_movimentacao', sa.Date(), nullable=False),
        sa.Column('data_expiracao', sa.Date(), nullable=True),
        sa.Column('descricao', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=True, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['usuario_id'], ['usuarios.id'], name='fk_milhas_usuario', ondelete='CASCADE'),
    )
    op.create_index('ix_milhas_usuario', 'milhas', ['usuario_id'])
    op.create_index('ix_milhas_programa', 'milhas', ['programa'])
    op.create_index('ix_milhas_tipo', 'milhas', ['tipo'])
    op.create_index('ix_milhas_data_movimentacao', 'milhas', ['data_movimentacao'])


def downgrade():
    try:
        op.drop_index('ix_milhas_data_movimentacao', table_name='milhas')
    except Exception:
        pass
    try:
        op.drop_index('ix_milhas_tipo', table_name='milhas')
    except Exception:
        pass
    try:
        op.drop_index('ix_milhas_programa', table_name='milhas')
    except Exception:
        pass
    try:
        op.drop_index('ix_milhas_usuario', table_name='milhas')
    except Exception:
        pass
    try:
        op.drop_table('milhas')
    except Exception:
        pass
