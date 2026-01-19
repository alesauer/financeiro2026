import sys
from pathlib import Path

proj_root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(proj_root))

from app import create_app, db
from app.models import Transacao, FormaPagamento
from sqlalchemy import func, text
from sqlalchemy import text

app = create_app()
with app.app_context():
    print('--- Totais por competência ---')
    rows = (
        db.session.query(
            FormaPagamento.nome,
            Transacao.competencia_fatura,
            func.sum(Transacao.valor)
        )
        .join(Transacao, Transacao.forma_pagamento_id == FormaPagamento.id)
        .filter(FormaPagamento.cartao_credito.is_(True))
        .filter(Transacao.competencia_fatura.isnot(None))
        .group_by(FormaPagamento.nome, Transacao.competencia_fatura)
        .order_by(Transacao.competencia_fatura)
        .all()
    )
    if not rows:
        print('Sem dados de competência.\n')
    else:
        for nome, comp, total in rows:
            print(f"{comp} - {nome}: {float(total or 0):.2f}")

    print('\n--- Totais por data da transação ---')
    rows = (
        db.session.query(
            FormaPagamento.nome,
            func.date_format(Transacao.data_transacao, '%Y-%m').label('mes'),
            func.sum(Transacao.valor)
        )
        .join(Transacao, Transacao.forma_pagamento_id == FormaPagamento.id)
        .filter(FormaPagamento.cartao_credito.is_(True))
        .group_by(FormaPagamento.nome, 'mes')
        .order_by('mes')
        .limit(40)
        .all()
    )
    if not rows:
        print('Sem dados de transação.')
    else:
        for nome, mes, total in rows:
            print(f"{mes or 's/mes'} - {nome}: {float(total or 0):.2f}")
