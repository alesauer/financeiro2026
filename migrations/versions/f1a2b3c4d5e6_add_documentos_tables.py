"""Add documentos tables (tipos_documentos, documentos, documentos_anexos) and seed initial tipos

Revision ID: f1a2b3c4d5e6
Revises: e5a1c7d9ab01
Create Date: 2026-01-12 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'f1a2b3c4d5e6'
down_revision = 'e5a1c7d9ab01'
branch_labels = None
depends_on = None


def upgrade():
    # tipos_documentos
    op.create_table(
        'tipos_documentos',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('nome', sa.String(length=100), nullable=False, unique=True),
        sa.Column('descricao', sa.String(length=255), nullable=True),
        sa.Column('ativo', sa.Boolean(), nullable=False, server_default=sa.text('1')),
        sa.Column('created_at', sa.DateTime(), nullable=True, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=True, server_default=sa.func.now()),
    )

    # documentos
    op.create_table(
        'documentos',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('usuario_id', sa.Integer(), nullable=False),
        sa.Column('tipo_documento_id', sa.Integer(), nullable=False),
        sa.Column('nome', sa.String(length=150), nullable=False),
        sa.Column('registro', sa.String(length=120), nullable=True),
        sa.Column('outras_informacoes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=True, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['usuario_id'], ['usuarios.id'], name='fk_documentos_usuario', ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['tipo_documento_id'], ['tipos_documentos.id'], name='fk_documentos_tipo', ondelete='RESTRICT'),
    )
    op.create_index('ix_documentos_usuario', 'documentos', ['usuario_id'])
    op.create_index('ix_documentos_tipo', 'documentos', ['tipo_documento_id'])

    # documentos_anexos
    op.create_table(
        'documentos_anexos',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('documento_id', sa.Integer(), nullable=False),
        sa.Column('original_name', sa.String(length=255), nullable=False),
        sa.Column('stored_name', sa.String(length=255), nullable=False),
        sa.Column('mime_type', sa.String(length=100), nullable=False),
        sa.Column('size_bytes', sa.Integer(), nullable=False),
        sa.Column('storage_path', sa.String(length=500), nullable=False),
        sa.Column('uploaded_at', sa.DateTime(), nullable=True, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['documento_id'], ['documentos.id'], name='fk_anexos_documento', ondelete='CASCADE'),
    )
    op.create_index('ix_documentos_anexos_documento', 'documentos_anexos', ['documento_id'])

    # Seed inicial para tipos_documentos
    bind = op.get_bind()
    try:
        tipos = [
            ('CPF', 'Cadastro de Pessoas Físicas'),
            ('RG', 'Registro Geral'),
            ('Título de Eleitor', 'Documento eleitoral'),
            ('Passaporte', 'Documento de viagem'),
            ('CNH', 'Carteira Nacional de Habilitação'),
            ('Carteira de Trabalho', 'CTPS'),
        ]
        for nome, desc in tipos:
            bind.execute(sa.text('INSERT INTO tipos_documentos (nome, descricao, ativo) VALUES (:n, :d, 1)'), {'n': nome, 'd': desc})
    except Exception:
        # Se falhar, ignorar seed para evitar erro em bancos sem tabela existente no momento
        pass


def downgrade():
    try:
        op.drop_index('ix_documentos_anexos_documento', table_name='documentos_anexos')
    except Exception:
        pass
    try:
        op.drop_table('documentos_anexos')
    except Exception:
        pass
    try:
        op.drop_index('ix_documentos_usuario', table_name='documentos')
    except Exception:
        pass
    try:
        op.drop_index('ix_documentos_tipo', table_name='documentos')
    except Exception:
        pass
    try:
        op.drop_table('documentos')
    except Exception:
        pass
    try:
        op.drop_table('tipos_documentos')
    except Exception:
        pass
