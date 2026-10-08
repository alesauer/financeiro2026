import sys
sys.path.insert(0, r'c:\scripts\python\financas')
from app import create_app, db
from app.models import Transacao, FormaPagamento, Categoria
from sqlalchemy import func, extract

app = create_app()
with app.app_context():
    print("=== TRANSAÇÕES DE CARTÃO POR MÊS EM 2026 ===")
    res = (
        db.session.query(
            extract('month', Transacao.data_transacao).label('mes'),
            FormaPagamento.nome,
            func.count(Transacao.id).label('qtd'),
            func.sum(Transacao.valor).label('total')
        )
        .join(FormaPagamento, Transacao.forma_pagamento_id == FormaPagamento.id)
        .filter(FormaPagamento.cartao_credito.is_(True))
        .filter(extract('year', Transacao.data_transacao) == 2026)
        .group_by('mes', FormaPagamento.nome)
        .order_by('mes', FormaPagamento.nome)
        .all()
    )
    for r in res:
        print(f"Mês {int(r[0]):02d} | {r[1]:25} | Qtd: {r[2]:4} | Total: R$ {float(r[3]):10.2f}")

    print("\n=== TRANSAÇÕES NÃO-CARTÃO POR MÊS EM 2026 ===")
    res2 = (
        db.session.query(
            extract('month', Transacao.data_transacao).label('mes'),
            Transacao.tipo,
            func.count(Transacao.id).label('qtd'),
            func.sum(Transacao.valor).label('total')
        )
        .outerjoin(FormaPagamento, Transacao.forma_pagamento_id == FormaPagamento.id)
        .filter((FormaPagamento.cartao_credito.is_(False)) | (Transacao.forma_pagamento_id.is_(None)))
        .filter(extract('year', Transacao.data_transacao) == 2026)
        .group_by('mes', Transacao.tipo)
        .order_by('mes', Transacao.tipo)
        .all()
    )
    for r in res2:
        print(f"Mês {int(r[0]):02d} | {r[1]:12} | Qtd: {r[2]:4} | Total: R$ {float(r[3]):10.2f}")
