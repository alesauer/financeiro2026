"""update tipo_custo_viagem enum

Revision ID: c8f1a2b3c4d5
Revises: 2468ace02468, 1f2e3d4c5b6a
Create Date: 2026-01-23 08:00:00.000000

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = "c8f1a2b3c4d5"
down_revision = ("2468ace02468", "1f2e3d4c5b6a")
branch_labels = None
depends_on = None


def upgrade():
    # Primeiro, adiciona valores novos e mantém "Alimentao" temporariamente
    op.execute(
        "ALTER TABLE viagens_custos "
        "MODIFY COLUMN tipo ENUM("
        "'Hospedagem',"
        "'Alimentao',"
        "'Alimentação',"
        "'Seguro Viagem',"
        "'Passagem Aérea',"
        "'Transportes (trem,metrô,etc)',"
        "'Transportes',"
        "'Compras',"
        "'Atrações / Parques',"
        "'Atrações',"
        "'Transporte',"
        "'Transporte Público',"
        "'Passeios',"
        "'Outros'"
        ") NOT NULL"
    )

    # Corrige registros antigos sem acento
    op.execute("UPDATE viagens_custos SET tipo='Alimentação' WHERE tipo='Alimentao'")
    op.execute("UPDATE viagens_custos SET tipo='Transportes' WHERE tipo='Transportes (trem,metrô,etc)'")
    op.execute("UPDATE viagens_custos SET tipo='Atrações' WHERE tipo='Atrações / Parques'")

    # Ajusta enum final sem a forma antiga
    op.execute(
        "ALTER TABLE viagens_custos "
        "MODIFY COLUMN tipo ENUM("
        "'Hospedagem',"
        "'Alimentação',"
        "'Seguro Viagem',"
        "'Passagem Aérea',"
        "'Transportes',"
        "'Compras',"
        "'Atrações',"
        "'Transporte',"
        "'Transporte Público',"
        "'Passeios',"
        "'Outros'"
        ") NOT NULL"
    )


def downgrade():
    # Antes de voltar, converte tipos novos para "Outros" e remove acentos
    op.execute(
        "UPDATE viagens_custos "
        "SET tipo='Outros' "
        "WHERE tipo NOT IN ('Transporte','Hospedagem','Alimentação','Passeios','Outros')"
    )
    op.execute("UPDATE viagens_custos SET tipo='Alimentao' WHERE tipo='Alimentação'")

    op.execute(
        "ALTER TABLE viagens_custos "
        "MODIFY COLUMN tipo ENUM("
        "'Transporte',"
        "'Hospedagem',"
        "'Alimentao',"
        "'Passeios',"
        "'Outros'"
        ") NOT NULL"
    )
