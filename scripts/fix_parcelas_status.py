from datetime import date
from pathlib import Path
import sys

proj_root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(proj_root))

from app import create_app, db
from app.models import Transacao, FormaPagamento

app = create_app()
with app.app_context():
    hoje = date.today()
    query = (
        Transacao.query
        .join(FormaPagamento, Transacao.forma_pagamento_id == FormaPagamento.id)
        .filter(FormaPagamento.cartao_credito.is_(True))
        .filter(Transacao.recorrencia_tipo == "Parcelamento")
        .filter(Transacao.status == "Pago")
        .filter(Transacao.data_transacao > hoje)
    )
    ids = [tx.id for tx in query]
    afetadas = len(ids)
    if ids:
        Transacao.query.filter(Transacao.id.in_(ids)).update({"status": "Pendente"}, synchronize_session=False)
    db.session.commit()
    print(f"Transações atualizadas para 'Pendente': {afetadas}")
