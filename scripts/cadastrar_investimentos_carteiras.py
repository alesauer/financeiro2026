"""Cadastra as carteiras e ativos de investimento com base nos prints do Nubank, C6 Bank e XP.

Dados extraídos dos prints:
1. XP Investimentos:
   - Patrimônio Nacional Total: R$ 105.216,65
   - Detalhamento Renda Fixa:
     * Pós-Fixado: R$ 34.031,43 (48%)
     * Inflação:   R$ 25.020,27 (35%)
     * Prefixado:  R$ 10.009,83 (14%)
     * Outros Investimentos / Saldo: R$ 36.155,12
2. Nubank:
   - Total Investido / Saldo Bruto: R$ 20.940,98 (+ R$ 1.320,86 em 12m)
     * Caixinhas (6): Saldo R$ 20.097,72 (Investido R$ 18.889,07 | Rendimento + R$ 1.208,65)
     * Minha Carteira: Saldo R$ 843,26 (Investido R$ 731,05 | Rendimento + R$ 112,21)
3. C6 Bank (C6 Invest):
   - Total Renda Fixa: R$ 14.726,13 (Rendeu R$ 222,94 no mês)
     * Investido: R$ 14.503,19 | Saldo R$ 14.726,13
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

        # Limpar carteira dummy 'Sauer' se não tiver movimentações reais
        dummy = InvestmentWallet.query.filter_by(nome="Sauer").first()
        if dummy and len(dummy.movimentacoes) == 0:
            db.session.delete(dummy)
            db.session.commit()
            print("Carteira teste anterior removida.")

        carteiras_dados = [
            {
                "nome": "XP Investimentos",
                "cor": "#f59e0b",
                "observacoes": "Conta XP - Alexandre Sauer (Patrimônio Nacional R$ 105.216,65)",
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
                    {
                        "codigo": "XP-OUTROS",
                        "nome": "XP - Outros Investimentos / Saldo",
                        "tipo": "Fundos",
                        "custo": Decimal("36155.12"),
                        "saldo_atual": Decimal("36155.12"),
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
                        "nome": "Nubank - Minha Carteira",
                        "tipo": "Fundos",
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
                        setor="Renda Fixa / Fundos",
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

                # Registrar movimentação de Compra / Aporte (se ainda não tiver)
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
        print("\nTodas as carteiras, ativos, movimentações e cotações foram gravadas com sucesso!")

if __name__ == "__main__":
    main()
