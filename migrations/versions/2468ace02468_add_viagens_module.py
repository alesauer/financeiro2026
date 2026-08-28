"""add viagens module

Revision ID: 2468ace02468
Revises: 13579bdf2468
Create Date: 2026-01-21 15:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '2468ace02468'
down_revision = '13579bdf2468'
branch_labels = None
depends_on = None

status_enum = sa.Enum('Planejada', 'Em andamento', 'Finalizada', 'Cancelada', name='status_viagem')
tipo_enum = sa.Enum('Transporte', 'Hospedagem', 'Alimentação', 'Passeios', 'Outros', name='tipo_custo_viagem')


def upgrade():
    bind = op.get_bind()
    status_enum.create(bind, checkfirst=True)
    tipo_enum.create(bind, checkfirst=True)

    op.create_table(
        'viagens',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('usuario_id', sa.Integer(), nullable=False),
        sa.Column('titulo', sa.String(length=120), nullable=False),
        sa.Column('destino', sa.String(length=120), nullable=False),
        sa.Column('data_inicio', sa.Date(), nullable=False),
        sa.Column('data_termino', sa.Date(), nullable=False),
        sa.Column('descricao', sa.Text(), nullable=True),
        sa.Column('status', status_enum, nullable=False, server_default='Planejada'),
        sa.Column('custo_total', sa.Numeric(12, 2), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(['usuario_id'], ['usuarios.id'], name='fk_viagens_usuario', ondelete='CASCADE')
    )

    op.create_index('ix_viagens_usuario', 'viagens', ['usuario_id'])
    op.create_index('ix_viagens_status', 'viagens', ['status'])
    op.create_index('ix_viagens_destino', 'viagens', ['destino'])

    op.create_table(
        'viagens_custos',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('viagem_id', sa.Integer(), nullable=False),
        sa.Column('tipo', tipo_enum, nullable=False),
        sa.Column('descricao', sa.String(length=255), nullable=False),
        sa.Column('data_gasto', sa.Date(), nullable=False),
        sa.Column('valor', sa.Numeric(12, 2), nullable=False),
        sa.Column('forma_pagamento', sa.String(length=80), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(['viagem_id'], ['viagens.id'], name='fk_custos_viagem', ondelete='CASCADE')
    )

    op.create_index('ix_viagens_custos_viagem', 'viagens_custos', ['viagem_id'])
    op.create_index('ix_viagens_custos_tipo', 'viagens_custos', ['tipo'])
    op.create_index('ix_viagens_custos_data', 'viagens_custos', ['data_gasto'])

    op.create_table(
        'viagens_custos_anexos',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('custo_id', sa.Integer(), nullable=False),
        sa.Column('original_name', sa.String(length=255), nullable=False),
        sa.Column('stored_name', sa.String(length=255), nullable=False),
        sa.Column('mime_type', sa.String(length=100), nullable=False),
        sa.Column('size_bytes', sa.Integer(), nullable=False),
        sa.Column('storage_path', sa.String(length=500), nullable=False),
        sa.Column('uploaded_at', sa.DateTime(), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(['custo_id'], ['viagens_custos.id'], name='fk_anexos_custo', ondelete='CASCADE')
    )

    op.create_index('ix_viagens_custos_anexos_custo', 'viagens_custos_anexos', ['custo_id'])


def downgrade():
    op.drop_index('ix_viagens_custos_anexos_custo', table_name='viagens_custos_anexos')
    op.drop_table('viagens_custos_anexos')

    op.drop_index('ix_viagens_custos_data', table_name='viagens_custos')
    op.drop_index('ix_viagens_custos_tipo', table_name='viagens_custos')
    op.drop_index('ix_viagens_custos_viagem', table_name='viagens_custos')
    op.drop_table('viagens_custos')

    op.drop_index('ix_viagens_destino', table_name='viagens')
    op.drop_index('ix_viagens_status', table_name='viagens')
    op.drop_index('ix_viagens_usuario', table_name='viagens')
    op.drop_table('viagens')

    bind = op.get_bind()
    tipo_enum.drop(bind, checkfirst=True)
    status_enum.drop(bind, checkfirst=True)
