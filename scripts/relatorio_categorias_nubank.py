from app import create_app, db
from app.models import Transacao, FormaPagamento
from datetime import date
from collections import defaultdict

app = create_app()
with app.app_context():
    fp = FormaPagamento.query.filter_by(nome='Nubank').first()
    for mes in [5, 6, 7, 8]:
        comp = date(2026, mes, 1)
        txs = Transacao.query.filter_by(forma_pagamento_id=fp.id, competencia_fatura=comp).all()
        cats = defaultdict(lambda: {'count': 0, 'total': 0.0})
        for t in txs:
            c = t.categoria.nome if t.categoria else 'Sem Categoria'
            cats[c]['count'] += 1
            cats[c]['total'] += float(t.valor)
        print(f"=== FATURA {mes:02d}/2026 (Nubank) - {len(txs)} lançamentos ===")
        for c, data in sorted(cats.items(), key=lambda x: -x[1]['total']):
            print(f"  {c:<20} | {data['count']:>3} itens | R$ {data['total']:>10,.2f}")
        print()
