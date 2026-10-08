import sys, os
sys.path.insert(0, os.path.abspath('.'))
from sqlalchemy import extract, func
from app import create_app
from app.models import db, Transacao, Categoria, FormaPagamento

app = create_app()
with app.app_context():
    print("=== RESUMO 2026 NO BANCO DE DADOS ===")
    total_txs = Transacao.query.filter(extract('year', Transacao.data_transacao) == 2026).count()
    print(f"Total transações em 2026: {total_txs}")
    
    for m in range(1, 13):
        txs = Transacao.query.filter(
            extract('year', Transacao.data_transacao) == 2026,
            extract('month', Transacao.data_transacao) == m
        ).all()
        rec = sum(t.valor for t in txs if t.tipo == 'Receita')
        desp = sum(t.valor for t in txs if t.tipo == 'Despesa')
        inv = sum(t.valor for t in txs if t.tipo == 'Investimento')
        
        # Breakdown by group
        cards = [t for t in txs if t.forma_pagamento and t.forma_pagamento.cartao_credito]
        fixed = [t for t in txs if t.tipo == 'Despesa' and not (t.forma_pagamento and t.forma_pagamento.cartao_credito)]
        
        print(f"Mês {m:02d} | Txs: {len(txs):3d} | Receitas: R$ {rec:9.2f} | Despesas: R$ {desp:9.2f} (Fixas: R$ {sum(t.valor for t in fixed):9.2f}, Cartões: R$ {sum(t.valor for t in cards):9.2f}) | Saldo: R$ {rec-desp:9.2f}")
