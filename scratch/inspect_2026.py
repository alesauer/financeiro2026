import sys
sys.path.insert(0, r'c:\scripts\python\financas')
from app import create_app, db
from app.models import Transacao, FormaPagamento, Categoria
from sqlalchemy import func, extract

app = create_app()
with app.app_context():
    # Amostra de transações atuais em 2026
    txs = Transacao.query.filter(extract('year', Transacao.data_transacao) == 2026).all()
    print(f"Total transações em 2026 no banco: {len(txs)}")
    
    # Quantas vieram de importação de cartão vs manuais?
    cc_count = sum(1 for t in txs if t.forma_pagamento and t.forma_pagamento.cartao_credito)
    non_cc_count = len(txs) - cc_count
    print(f"Transações de Cartão de Crédito (Nubank/C6): {cc_count}")
    print(f"Transações que NÃO são Cartão de Crédito: {non_cc_count}")

    print("\nAmostra de transações não-cartão em 2026:")
    for t in [t for t in txs if not (t.forma_pagamento and t.forma_pagamento.cartao_credito)][:20]:
        cat_nome = t.categoria.nome if t.categoria else "Sem cat"
        fp_nome = t.forma_pagamento.nome if t.forma_pagamento else "Sem FP"
        print(f"ID {t.id} | {t.data_transacao} | {t.tipo:10} | {t.descricao[:30]:30} | R$ {float(t.valor):8.2f} | {cat_nome} | {fp_nome}")
