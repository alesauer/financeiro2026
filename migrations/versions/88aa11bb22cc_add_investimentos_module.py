"""add investimentos module

Revision ID: 88aa11bb22cc
Revises: e320a8ad55cf, f4b8c2d1e9aa
Create Date: 2026-08-04 11:20:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "88aa11bb22cc"
down_revision = ("e320a8ad55cf", "f4b8c2d1e9aa")
branch_labels = None
depends_on = None

asset_type_enum = sa.Enum(
    "Ações",
    "FIIs",
    "ETFs",
    "BDRs",
    "Tesouro Direto",
    "CDB",
    "LCI",
    "LCA",
    "Debêntures",
    "Fundos",
    "Criptomoedas",
    "Previdência",
    name="investment_asset_type",
)

tx_type_enum = sa.Enum(
    "Compra",
    "Venda",
    "Dividendos",
    "JCP",
    "Bonificação",
    "Split",
    "Grupamento",
    "Aporte",
    "Resgate",
    name="investment_tx_type",
)


def upgrade():
    bind = op.get_bind()
    asset_type_enum.create(bind, checkfirst=True)
    tx_type_enum.create(bind, checkfirst=True)

    op.create_table(
        "investment_wallets",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("nome", sa.String(length=120), nullable=False),
        sa.Column("cor", sa.String(length=20), nullable=False, server_default="#2563eb"),
        sa.Column("moeda", sa.String(length=10), nullable=False, server_default="BRL"),
        sa.Column("observacoes", sa.Text(), nullable=True),
        sa.Column("ativo", sa.Boolean(), nullable=False, server_default=sa.text("1")),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=True),
    )

    op.create_index("ix_investment_wallets_nome", "investment_wallets", ["nome"])

    op.create_table(
        "investment_assets",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("wallet_id", sa.Integer(), nullable=False),
        sa.Column("codigo", sa.String(length=30), nullable=False),
        sa.Column("nome", sa.String(length=120), nullable=False),
        sa.Column("tipo", asset_type_enum, nullable=False),
        sa.Column("setor", sa.String(length=80), nullable=True),
        sa.Column("bolsa", sa.String(length=60), nullable=True),
        sa.Column("moeda", sa.String(length=10), nullable=False, server_default="BRL"),
        sa.Column("ativo", sa.Boolean(), nullable=False, server_default=sa.text("1")),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["wallet_id"], ["investment_wallets.id"], name="fk_invest_asset_wallet", ondelete="CASCADE"),
        sa.UniqueConstraint("wallet_id", "codigo", name="uq_investment_asset_wallet_codigo"),
    )

    op.create_index("ix_investment_assets_wallet", "investment_assets", ["wallet_id"])
    op.create_index("ix_investment_assets_codigo", "investment_assets", ["codigo"])

    op.create_table(
        "investment_transactions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("wallet_id", sa.Integer(), nullable=False),
        sa.Column("asset_id", sa.Integer(), nullable=True),
        sa.Column("tipo", tx_type_enum, nullable=False),
        sa.Column("data_movimentacao", sa.Date(), nullable=False),
        sa.Column("quantidade", sa.Numeric(18, 8), nullable=True),
        sa.Column("preco", sa.Numeric(18, 6), nullable=True),
        sa.Column("taxas", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("valor_total", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("corretora", sa.String(length=120), nullable=True),
        sa.Column("observacoes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["wallet_id"], ["investment_wallets.id"], name="fk_invest_tx_wallet", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["asset_id"], ["investment_assets.id"], name="fk_invest_tx_asset", ondelete="SET NULL"),
    )

    op.create_index("ix_investment_transactions_wallet", "investment_transactions", ["wallet_id"])
    op.create_index("ix_investment_transactions_asset", "investment_transactions", ["asset_id"])
    op.create_index("ix_investment_transactions_data", "investment_transactions", ["data_movimentacao"])

    op.create_table(
        "investment_quotes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("asset_id", sa.Integer(), nullable=False),
        sa.Column("provider", sa.String(length=50), nullable=False),
        sa.Column("preco", sa.Numeric(14, 6), nullable=False),
        sa.Column("variacao_percentual", sa.Numeric(8, 4), nullable=True),
        sa.Column("moeda", sa.String(length=10), nullable=False, server_default="BRL"),
        sa.Column("cotado_em", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["asset_id"], ["investment_assets.id"], name="fk_invest_quote_asset", ondelete="CASCADE"),
        sa.UniqueConstraint("asset_id", "provider", name="uq_investment_quote_asset_provider"),
    )

    op.create_index("ix_investment_quotes_asset", "investment_quotes", ["asset_id"])
    op.create_index("ix_investment_quotes_provider", "investment_quotes", ["provider"])

    op.create_table(
        "investment_providers",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("nome", sa.String(length=50), nullable=False, unique=True),
        sa.Column("ativo", sa.Boolean(), nullable=False, server_default=sa.text("1")),
        sa.Column("prioridade", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("config_json", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=True),
    )

    op.create_index("ix_investment_providers_nome", "investment_providers", ["nome"])


def downgrade():
    op.drop_index("ix_investment_providers_nome", table_name="investment_providers")
    op.drop_table("investment_providers")

    op.drop_index("ix_investment_quotes_provider", table_name="investment_quotes")
    op.drop_index("ix_investment_quotes_asset", table_name="investment_quotes")
    op.drop_table("investment_quotes")

    op.drop_index("ix_investment_transactions_data", table_name="investment_transactions")
    op.drop_index("ix_investment_transactions_asset", table_name="investment_transactions")
    op.drop_index("ix_investment_transactions_wallet", table_name="investment_transactions")
    op.drop_table("investment_transactions")

    op.drop_index("ix_investment_assets_codigo", table_name="investment_assets")
    op.drop_index("ix_investment_assets_wallet", table_name="investment_assets")
    op.drop_table("investment_assets")

    op.drop_index("ix_investment_wallets_nome", table_name="investment_wallets")
    op.drop_table("investment_wallets")

    bind = op.get_bind()
    tx_type_enum.drop(bind, checkfirst=True)
    asset_type_enum.drop(bind, checkfirst=True)
