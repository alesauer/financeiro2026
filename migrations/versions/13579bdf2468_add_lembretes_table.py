"""add lembretes table

Revision ID: 13579bdf2468
Revises: fedcba987654
Create Date: 2026-01-21 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '13579bdf2468'
down_revision = 'fedcba987654'
branch_labels = None
depends_on = None

status_enum = sa.Enum('Pendente', 'Concluído', name='status_lembrete')
prioridade_enum = sa.Enum('Baixa', 'Média', 'Alta', name='prioridade_lembrete')


def upgrade():
    bind = op.get_bind()
    status_enum.create(bind, checkfirst=True)
    prioridade_enum.create(bind, checkfirst=True)

    op.create_table(
        'lembretes',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('usuario_id', sa.Integer(), nullable=False),
        sa.Column('titulo', sa.String(length=120), nullable=False),
        sa.Column('descricao', sa.Text(), nullable=True),
        sa.Column('categoria', sa.String(length=50), nullable=True),
        sa.Column('data_lembrete', sa.Date(), nullable=True),
        sa.Column('hora_lembrete', sa.Time(), nullable=True),
        sa.Column('status', status_enum, nullable=False, server_default='Pendente'),
        sa.Column('prioridade', prioridade_enum, nullable=False, server_default='Média'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(['usuario_id'], ['usuarios.id'], name='fk_lembretes_usuario', ondelete='CASCADE')
    )

    op.create_index('ix_lembretes_usuario', 'lembretes', ['usuario_id'])
    op.create_index('ix_lembretes_status', 'lembretes', ['status'])
    op.create_index('ix_lembretes_data', 'lembretes', ['data_lembrete'])


def downgrade():
    op.drop_index('ix_lembretes_data', table_name='lembretes')
    op.drop_index('ix_lembretes_status', table_name='lembretes')
    op.drop_index('ix_lembretes_usuario', table_name='lembretes')
    op.drop_table('lembretes')

    bind = op.get_bind()
    prioridade_enum.drop(bind, checkfirst=True)
    status_enum.drop(bind, checkfirst=True)