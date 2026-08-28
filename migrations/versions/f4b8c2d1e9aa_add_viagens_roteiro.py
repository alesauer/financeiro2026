"""add viagens roteiro

Revision ID: f4b8c2d1e9aa
Revises: c8f1a2b3c4d5
Create Date: 2026-01-23 16:22:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "f4b8c2d1e9aa"
down_revision = "c8f1a2b3c4d5"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "viagens_roteiros",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("viagem_id", sa.Integer(), nullable=False),
        sa.Column("data", sa.Date(), nullable=False),
        sa.Column("descricao", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["viagem_id"], ["viagens.id"], name="fk_roteiros_viagem", ondelete="CASCADE"),
    )

    op.create_index("ix_viagens_roteiros_viagem", "viagens_roteiros", ["viagem_id"])
    op.create_index("ix_viagens_roteiros_data", "viagens_roteiros", ["data"])


def downgrade():
    op.drop_index("ix_viagens_roteiros_data", table_name="viagens_roteiros")
    op.drop_index("ix_viagens_roteiros_viagem", table_name="viagens_roteiros")
    op.drop_table("viagens_roteiros")
