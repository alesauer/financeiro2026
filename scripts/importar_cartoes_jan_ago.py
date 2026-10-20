"""Importação das faturas consolidadas de Cartão Nubank da planilha para Jan..Ago 2026.

Regra:
- Até Agosto/2026: Os valores de fatura do cartão Nubank vêm diretamente da planilha,
  pois o Open Finance não possui o histórico completo antes do fim de julho.
- As 74 transações parciais com competência de fatura <= 2026-08-01 são substituídas
  pela fatura oficial consolidada para bater exatamente com a planilha.
- A partir de Setembro/2026: Mantém-se as transações individuais do Open Finance / Pluggy.
"""

import sys
sys.path.insert(0, "/app")
sys.path.insert(0, ".")

from datetime import date
from decimal import Decimal

from app import create_app, db
from app.models import Transacao, FormaPagamento, Categoria

VALORES_NUBANK_PLANILHA = {
    1: {"sheet": "Jan26", "dia": 3, "valor": Decimal("17131.78"), "status": "Pago"},
    2: {"sheet": "Fev26", "dia": 3, "valor": Decimal("18000.00"), "status": "Pago"},
    3: {"sheet": "Mar26", "dia": 3, "valor": Decimal("19949.00"), "status": "Pago"},
    4: {"sheet": "Abr26", "dia": 3, "valor": Decimal("12954.82"), "status": "Pago"},
    5: {"sheet": "Mai26", "dia": 3, "valor": Decimal("16736.00"), "status": "Pago"},
    6: {"sheet": "Jun26", "dia": 3, "valor": Decimal("24000.00"), "status": "Pago"},
    7: {"sheet": "Jul26", "dia": 3, "valor": Decimal("14868.24"), "status": "Pago"},
    8: {"sheet": "Ago26", "dia": 3, "valor": Decimal("15332.75"), "status": "Pago"},
}

def main():
    app = create_app()
    with app.app_context():
        fp_nubank = FormaPagamento.query.filter_by(nome="Nubank").first()
        cat_diversos = Categoria.query.filter_by(nome="Diversos", tipo="Despesa").first()
        
        if not fp_nubank or not cat_diversos:
            print("ERRO: Forma de pagamento Nubank ou Categoria Diversos não encontrada!")
            return

        # 1. Remover transações parciais do Nubank com competência <= 2026-08-01
        # que causariam duplicidade com a fatura consolidada
        removidas = Transacao.query.filter(
            Transacao.forma_pagamento_id == fp_nubank.id,
            Transacao.competencia_fatura <= date(2026, 8, 1)
        ).delete(synchronize_session=False)
        print(f"Transações parciais do Nubank removidas (competência <= Ago/2026): {removidas}")

        # 2. Inserir ou atualizar as 8 faturas oficiais consolidadas da planilha
        inseridas = 0
        for mes, info in VALORES_NUBANK_PLANILHA.items():
            identificador = f"planilha-2026-{mes:02d}-nubank-fatura-{info['valor']}"
            dt_transacao = date(2026, mes, info["dia"])
            comp_fatura = date(2026, mes, 1)
            desc = f"Fatura Nubank ({info['sheet']})"

            tx = Transacao(
                tipo="Despesa",
                categoria_id=cat_diversos.id,
                descricao=desc,
                valor=info["valor"],
                data_transacao=dt_transacao,
                forma_pagamento_id=fp_nubank.id,
                status=info["status"],
                recorrente=False,
                observacoes=f"Fatura oficial da planilha {info['sheet']}",
                competencia_fatura=comp_fatura,
                identificador_externo=identificador
            )
            db.session.add(tx)
            inseridas += 1

        db.session.commit()
        print(f"Faturas oficiais do Nubank inseridas com sucesso: {inseridas}\n")

        # 3. Conferência com o resumo da API / summary
        print("="*75)
        print("CONFERÊNCIA DOS SALDOS MENSAIS (JANEIRO A AGOSTO/2026)")
        print("="*75)
        for mes in range(1, 9):
            ini = f"2026-{mes:02d}-01"
            fim = f"2026-02-28" if mes == 2 else (f"2026-{mes:02d}-31" if mes in (1,3,5,7,8) else f"2026-{mes:02d}-30")
            
            # Executa a mesma lógica do resumo
            from app.routes_transacoes import resumo_mes
            from flask import request
            # Fazer query direta com a lógica do summary
            rec = db.session.query(db.func.sum(Transacao.valor)).filter(
                Transacao.tipo == "Receita",
                Transacao.data_transacao.between(ini, fim)
            ).scalar() or Decimal("0.00")

            desp_conta = db.session.query(db.func.sum(Transacao.valor)).outerjoin(FormaPagamento).filter(
                Transacao.tipo.in_(["Despesa", "Investimento"]),
                db.or_(FormaPagamento.cartao_credito.is_(False), FormaPagamento.id.is_(None)),
                Transacao.data_transacao.between(ini, fim)
            ).scalar() or Decimal("0.00")

            cart_nubank = db.session.query(db.func.sum(Transacao.valor)).filter(
                Transacao.forma_pagamento_id == fp_nubank.id,
                Transacao.competencia_fatura == date(2026, mes, 1)
            ).scalar() or Decimal("0.00")

            cart_c6 = db.session.query(db.func.sum(Transacao.valor)).filter(
                Transacao.forma_pagamento_id == 6,
                Transacao.competencia_fatura == date(2026, mes, 1)
            ).scalar() or Decimal("0.00")

            total_desp = desp_conta + cart_nubank + cart_c6
            saldo = rec - total_desp
            print(f"Mês {mes:02d}/2026:")
            print(f"  Receitas:     R$ {rec:>11,.2f}")
            print(f"  Desp. Contas: R$ {desp_conta:>11,.2f}")
            print(f"  Nubank:       R$ {cart_nubank:>11,.2f}")
            print(f"  C6 Bank:      R$ {cart_c6:>11,.2f}")
            print(f"  Total Saídas: R$ {total_desp:>11,.2f}")
            print(f"  Saldo Líquido:R$ {saldo:>11,.2f}")
            print()

if __name__ == "__main__":
    main()
