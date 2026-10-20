"""Cadastra as carteiras e ativos de investimento com base nos prints do Nubank, C6 Bank e XP.

Esclarecimento:
- O valor de R$ 105.216,65 na tela inicial da XP era o total consolidado do Open Finance da XP,
  que já estava puxando os saldos do Nubank (R$ 20.940,98) e C6 (R$ 14.726,13) somados com a XP (R$ 69.061,53).
- Portanto, o valor real investido na XP é de R$ 69.061,53 (100% Renda Fixa).
- Todos os investimentos das 3 instituições são Renda Fixa (CDBs, Tesouro IPCA e Pré).
"""

import sys
sys.path.insert(0, "/app")
sys.path.insert(0, ".")

from datetime import datetime, date
from decimal import Decimal
from app import create_app, db
from app.models import (
    InvestmentWallet,
    InvestmentAsset,
    InvestmentTransaction,
    InvestmentQuote,
)

def main():
    app = create_app()
    with app.app_context():
        hoje = date(2026, 10, 20)
        agora = datetime(2026, 10, 20, 10, 0, 0)

        # 1. Remover ativo XP-OUTROS se existir (era a duplicação do OpenFinance)
        xp_outros = InvestmentAsset.query.filter_by(codigo="XP-OUTROS").first()
        if xp_outros:
            InvestmentTransaction.query.filter_by(asset_id=xp_outros.id).delete()
            InvestmentQuote.query.filter_by(asset_id=xp_outros.id).delete()
            db.session.delete(xp_outros)
            db.session.commit()
            print("Ativo duplicado 'XP-OUTROS' removido com sucesso.")

        carteiras_dados = [
            {
                "nome": "XP Investimentos",
                "cor": "#f59e0b",
                "observacoes": "Conta XP - Alexandre Sauer (Total investido R$ 69.061,53)",
                "ativos": [
                    {
                        "codigo": "XP-POS-FIXADO",
                        "nome": "XP - Renda Fixa Pós-Fixada (CDI)",
                        "tipo": "CDB",
                        "custo": Decimal("34031.43"),
                        "saldo_atual": Decimal("34031.43"),
                        "variacao": Decimal("0.00"),
                    },
                    {
                        "codigo": "XP-INFLACAO",
                        "nome": "XP - Renda Fixa Inflação (IPCA+)",
                        "tipo": "Tesouro Direto",
                        "custo": Decimal("25020.27"),
                        "saldo_atual": Decimal("25020.27"),
                        "variacao": Decimal("0.00"),
                    },
                    {
                        "codigo": "XP-PREFIXADO",
                        "nome": "XP - Renda Fixa Prefixada",
                        "tipo": "CDB",
                        "custo": Decimal("10009.83"),
                        "saldo_atual": Decimal("10009.83"),
                        "variacao": Decimal("0.00"),
                    },
                ]
            },
            {
                "nome": "Nubank",
                "cor": "#820ad1",
                "observacoes": "Conta Nubank (Total investido R$ 20.940,98)",
                "ativos": [
                    {
                        "codigo": "NU-CAIXINHAS",
                        "nome": "Nubank - Caixinhas (RDB / Reserva)",
                        "tipo": "CDB",
                        "custo": Decimal("18889.07"),
                        "saldo_atual": Decimal("20097.72"),
                        "variacao": Decimal("6.40"),
                    },
                    {
                        "codigo": "NU-CARTEIRA",
                        "nome": "Nubank - Minha Carteira (Renda Fixa)",
                        "tipo": "CDB",
                        "custo": Decimal("731.05"),
                        "saldo_atual": Decimal("843.26"),
                        "variacao": Decimal("15.35"),
                    },
                ]
            },
            {
                "nome": "C6 Bank",
                "cor": "#1f2937",
                "observacoes": "C6 Invest Brasil (Renda Fixa R$ 14.726,13)",
                "ativos": [
                    {
                        "codigo": "C6-RENDA-FIXA",
                        "nome": "C6 Invest - Renda Fixa (CDBs)",
                        "tipo": "CDB",
                        "custo": Decimal("14503.19"),
                        "saldo_atual": Decimal("14726.13"),
                        "variacao": Decimal("1.54"),
                    },
                ]
            },
        ]

        for cart in carteiras_dados:
            wallet = InvestmentWallet.query.filter_by(nome=cart["nome"]).first()
            if not wallet:
                wallet = InvestmentWallet(
                    nome=cart["nome"],
                    cor=cart["cor"],
                    observacoes=cart["observacoes"],
                    moeda="BRL",
                    ativo=True
                )
                db.session.add(wallet)
                db.session.flush()
                print(f"Carteira criada: {wallet.nome} (ID {wallet.id})")
            else:
                wallet.cor = cart["cor"]
                wallet.observacoes = cart["observacoes"]
                wallet.ativo = True

            for at in cart["ativos"]:
                asset = InvestmentAsset.query.filter_by(wallet_id=wallet.id, codigo=at["codigo"]).first()
                if not asset:
                    asset = InvestmentAsset(
                        wallet_id=wallet.id,
                        codigo=at["codigo"],
                        nome=at["nome"],
                        tipo=at["tipo"],
                        setor="Renda Fixa",
                        bolsa=cart["nome"],
                        moeda="BRL",
                        ativo=True
                    )
                    db.session.add(asset)
                    db.session.flush()
                    print(f"  Ativo criado: {asset.codigo} - {asset.nome}")
                else:
                    asset.nome = at["nome"]
                    asset.tipo = at["tipo"]

                # Registrar movimentação de Compra / Aporte
                tx = InvestmentTransaction.query.filter_by(wallet_id=wallet.id, asset_id=asset.id).first()
                if not tx:
                    tx = InvestmentTransaction(
                        wallet_id=wallet.id,
                        asset_id=asset.id,
                        tipo="Compra",
                        data_movimentacao=hoje,
                        quantidade=Decimal("1.0"),
                        preco=at["custo"],
                        taxas=Decimal("0.00"),
                        valor_total=at["custo"],
                        corretora=cart["nome"],
                        observacoes=f"Posição inicial baseada em print da carteira {cart['nome']}"
                    )
                    db.session.add(tx)
                else:
                    tx.preco = at["custo"]
                    tx.valor_total = at["custo"]

                # Registrar Cotação atual (Preço atual / Saldo Bruto)
                quote = InvestmentQuote.query.filter_by(asset_id=asset.id, provider="Manual").first()
                if not quote:
                    quote = InvestmentQuote(
                        asset_id=asset.id,
                        provider="Manual",
                        preco=at["saldo_atual"],
                        variacao_percentual=at.get("variacao"),
                        moeda="BRL",
                        cotado_em=agora
                    )
                    db.session.add(quote)
                else:
                    quote.preco = at["saldo_atual"]
                    quote.variacao_percentual = at.get("variacao")
                    quote.cotado_em = agora

        db.session.commit()
        print("\nInvestimentos atualizados com sucesso (100% Renda Fixa)!")

if __name__ == "__main__":
    main()
