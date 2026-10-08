import sys
sys.path.insert(0, r'c:\scripts\python\financas')
from app import create_app, db
from app.models import Transacao, FormaPagamento, Categoria
from sqlalchemy import func, extract

app = create_app()
with app.app_context():
    print("=== FORMAS DE PAGAMENTO ===")
    for fp in FormaPagamento.query.all():
        print(f"ID {fp.id}: {fp.nome} | Tipo: {fp.tipo} | CC: {fp.cartao_credito} | Fech: {fp.dia_fechamento} | Venc: {fp.dia_vencimento}")

    print("\n=== CATEGORIAS ===")
    for c in Categoria.query.order_by(Categoria.tipo, Categoria.nome).all():
        print(f"ID {c.id}: {c.nome} ({c.tipo})")

    print("\n=== TRANSAÇÕES 2026 POR MÊS E TIPO ===")
    res = (
        db.session.query(
            extract('month', Transacao.data_transacao).label('mes'),
            Transacao.tipo,
            func.count(Transacao.id).label('qtd'),
            func.sum(Transacao.valor).label('total')
        )
        .filter(extract('year', Transacao.data_transacao) == 2026)
        .group_by('mes', Transacao.tipo)
        .order_by('mes', Transacao.tipo)
        .all()
    )
    for r in res:
        print(f"Mês {int(r[0]):02d} | {r[1]:12} | Qtd: {r[2]:4} | Total: R$ {float(r[3]):10.2f}")
