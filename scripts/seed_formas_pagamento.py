from pathlib import Path
import sys

# Garantir import do pacote app
proj_root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(proj_root))

from app import create_app, db
from app.models import FormaPagamento

SEEDS = [
    {"nome": "Dinheiro", "tipo": "Dinheiro", "cartao_credito": False, "ativo": True},
    {"nome": "Pix", "tipo": "Pix", "cartao_credito": False, "ativo": True},
    {"nome": "Transferência", "tipo": "Transferência", "cartao_credito": False, "ativo": True},
    {"nome": "Boleto", "tipo": "Boleto", "cartao_credito": False, "ativo": True},
    {"nome": "Cartão de Débito", "tipo": "Cartão de Débito", "cartao_credito": False, "ativo": True},
    # Cartões solicitados
    {"nome": "Cartão Crédito Nubank", "tipo": "Cartão de Crédito", "cartao_credito": True, "ativo": True},
    {"nome": "Cartão C6", "tipo": "Cartão de Crédito", "cartao_credito": True, "ativo": True},
    {"nome": "Cartão Crédito Inter", "tipo": "Cartão de Crédito", "cartao_credito": True, "ativo": True},
]


def run():
    app = create_app()
    with app.app_context():
        created = 0
        for item in SEEDS:
            exists = (
                db.session.query(FormaPagamento)
                .filter_by(nome=item["nome"], tipo=item["tipo"]).first()
            )
            if exists:
                # Atualiza flags caso tenham mudado
                changed = False
                for k in ("cartao_credito", "ativo"):
                    if getattr(exists, k) != item[k]:
                        setattr(exists, k, item[k])
                        changed = True
                if changed:
                    db.session.add(exists)
                continue
            fp = FormaPagamento(**item)
            db.session.add(fp)
            created += 1
        db.session.commit()
        total = db.session.query(FormaPagamento).count()
        print(f"Seeds aplicados. Novos criados: {created}. Total agora: {total}.")
        for fp in db.session.query(FormaPagamento).order_by(FormaPagamento.nome).all():
            flag = "CC" if fp.cartao_credito else "-"
            print(f" - {fp.id} | {fp.nome} [{fp.tipo}] {flag}")


if __name__ == "__main__":
    run()
