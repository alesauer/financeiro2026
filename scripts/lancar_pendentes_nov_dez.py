"""Lança as receitas e despesas fixas recorrentes de Outubro/2026 para Novembro e Dezembro de 2026 com status 'Pendente'.

Regras:
- Base: Itens de Outubro/2026 da planilha Contas 2026 (1).xlsx.
- 4 Receitas (ALMG, Férias Prêmio, Cotemig, Aluguel Apto) = R$ 27.731,00 / mês.
- 18 Despesas Fixas (incluindo R$ 3.000,00 de Investimento) = R$ 12.352,55 / mês.
- Status obrigatório: 'Pendente'.
- Idempotência: Cada lançamento possui identificador_externo único.
"""

import sys
sys.path.insert(0, "/app")
sys.path.insert(0, ".")

import re
import unicodedata
from datetime import date
from decimal import Decimal

from app import create_app, db
from app.models import Transacao, FormaPagamento, Categoria

def normalizar(texto):
    if not texto:
        return ""
    s = unicodedata.normalize("NFD", str(texto))
    return "".join(c for c in s if unicodedata.category(c) != "Mn").lower().strip()

def slugify(texto):
    norm = normalizar(texto)
    return re.sub(r"[^a-z0-9]+", "-", norm).strip("-")

# Template de Outubro/2026
RECEITAS_TEMPLATE = [
    {"dia": 1, "desc": "ALMG", "cat": "Salário", "tipo": "Receita", "val": Decimal("21430.00"), "fp": "Transferência", "obs": None},
    {"dia": 14, "desc": "ALMG FÉRIA PREMIO", "cat": "Salário", "tipo": "Receita", "val": Decimal("3073.00"), "fp": "Transferência", "obs": None},
    {"dia": 1, "desc": "COTEMIG", "cat": "Salário", "tipo": "Receita", "val": Decimal("2278.00"), "fp": "Transferência", "obs": None},
    {"dia": 10, "desc": "ALUGUEL APTO", "cat": "Aluguel", "tipo": "Receita", "val": Decimal("950.00"), "fp": "Transferência", "obs": None},
]

DESPESAS_TEMPLATE = [
    {"dia": 1, "desc": "Investimento", "cat": "Reserva de Emergência", "tipo": "Investimento", "val": Decimal("3000.00"), "fp": "Pix", "obs": None},
    {"dia": 7, "desc": "Batista (Matrícula e mensalidade)", "cat": "Educação", "tipo": "Despesa", "val": Decimal("2176.00"), "fp": "Pix", "obs": None},
    {"dia": 5, "desc": "Seguro", "cat": "Carro", "tipo": "Despesa", "val": Decimal("129.69"), "fp": "Pix", "obs": None, "parcela_base": 7, "total_parcelas": 12},
    {"dia": 5, "desc": "Kiki", "cat": "Temp", "tipo": "Despesa", "val": Decimal("1000.00"), "fp": "Pix", "obs": None},
    {"dia": 5, "desc": "Mei Kiki", "cat": "Imposto", "tipo": "Despesa", "val": Decimal("80.90"), "fp": "Débito Automático", "obs": None},
    {"dia": 5, "desc": "Vivo Kiki", "cat": "Celular", "tipo": "Despesa", "val": Decimal("75.00"), "fp": "Débito Automático", "obs": None},
    {"dia": 5, "desc": "Faxineira", "cat": "Moradia", "tipo": "Despesa", "val": Decimal("400.00"), "fp": "Pix", "obs": None},
    {"dia": 9, "desc": "Condomínio", "cat": "Moradia", "tipo": "Despesa", "val": Decimal("739.07"), "fp": "Débito Automático", "obs": None},
    {"dia": 15, "desc": "IPTU - Link", "cat": "Moradia", "tipo": "Despesa", "val": Decimal("189.77"), "fp": "Débito Automático", "obs": None},
    {"dia": 4, "desc": "CEMIG (Link)", "cat": "Energia", "tipo": "Despesa", "val": Decimal("105.54"), "fp": "Débito Automático", "obs": None},
    {"dia": 10, "desc": "Blink", "cat": "Internet", "tipo": "Despesa", "val": Decimal("118.90"), "fp": "Débito Automático", "obs": None},
    {"dia": 10, "desc": "ÓRIGO", "cat": "Energia", "tipo": "Despesa", "val": Decimal("337.68"), "fp": "Débito Automático", "obs": None},
    {"dia": 5, "desc": "Natação tico", "cat": "Recreativo", "tipo": "Despesa", "val": Decimal("280.00"), "fp": "Pix", "obs": "lucabonesi3@gmail.com"},
    {"dia": 5, "desc": "Psicóloga (Pix - 31998855177)", "cat": "Filho", "tipo": "Despesa", "val": Decimal("990.00"), "fp": "Pix", "obs": None},
    {"dia": 5, "desc": "Integrar", "cat": "Educação", "tipo": "Despesa", "val": Decimal("880.00"), "fp": "Pix", "obs": None},
    {"dia": 1, "desc": "IPRF", "cat": "Imposto", "tipo": "Despesa", "val": Decimal("300.00"), "fp": "Pix", "obs": None},
    {"dia": 1, "desc": "FORMATURA THEUS", "cat": "Educação", "tipo": "Despesa", "val": Decimal("350.00"), "fp": "Pix", "obs": "anna.faria@gmail.com", "parcela_base": 7, "total_parcelas": 8},
    {"dia": 5, "desc": "Pagamento Mãe", "cat": "Repasse", "tipo": "Despesa", "val": Decimal("1200.00"), "fp": "Pix", "obs": None},
]

def main():
    app = create_app()
    with app.app_context():
        # Lookups
        cat_map = {(normalizar(c.nome), c.tipo): c.id for c in Categoria.query.all()}
        fp_map = {normalizar(f.nome): f.id for f in FormaPagamento.query.all()}

        meses_alvo = [
            (11, "Nov26", 30),
            (12, "Dez26", 31)
        ]

        total_inseridos = 0
        total_atualizados = 0

        for mes_num, sheet_label, max_dias in meses_alvo:
            offset_mes = mes_num - 10 # 1 para nov, 2 para dez

            # 1. Lançar Receitas
            for rec in RECEITAS_TEMPLATE:
                dia = min(rec["dia"], max_dias)
                dt_obj = date(2026, mes_num, dia)
                cid = cat_map.get((normalizar(rec["cat"]), rec["tipo"]))
                fpid = fp_map.get(normalizar(rec["fp"]))
                slug = slugify(rec["desc"])
                identificador = f"planilha-2026-{mes_num:02d}-{slug}-{dia:02d}-{rec['val']}"

                tx = Transacao.query.filter_by(identificador_externo=identificador).first()
                if not tx:
                    tx = Transacao.query.filter_by(
                        data_transacao=dt_obj,
                        descricao=rec["desc"],
                        valor=rec["val"],
                        tipo=rec["tipo"]
                    ).first()

                if tx:
                    tx.status = "Pendente"
                    tx.identificador_externo = identificador
                    total_atualizados += 1
                else:
                    nova_tx = Transacao(
                        tipo=rec["tipo"],
                        categoria_id=cid,
                        descricao=rec["desc"],
                        valor=rec["val"],
                        data_transacao=dt_obj,
                        forma_pagamento_id=fpid,
                        status="Pendente",
                        recorrente=False,
                        observacoes=rec["obs"],
                        identificador_externo=identificador
                    )
                    db.session.add(nova_tx)
                    total_inseridos += 1

            # 2. Lançar Despesas Fixas
            for desp in DESPESAS_TEMPLATE:
                # Se for formatura e ultrapassar 8/8, não lançar em dez
                if "parcela_base" in desp:
                    nova_parc = desp["parcela_base"] + offset_mes
                    if nova_parc > desp["total_parcelas"]:
                        continue
                    desc_final = f"{desp['desc']} ({nova_parc:02d}/{desp['total_parcelas']:02d})"
                else:
                    desc_final = desp["desc"]

                dia = min(desp["dia"], max_dias)
                dt_obj = date(2026, mes_num, dia)
                cid = cat_map.get((normalizar(desp["cat"]), desp["tipo"]))
                fpid = fp_map.get(normalizar(desp["fp"]))
                slug = slugify(desp["desc"])
                identificador = f"planilha-2026-{mes_num:02d}-{slug}-{dia:02d}-{desp['val']}"

                tx = Transacao.query.filter_by(identificador_externo=identificador).first()
                if not tx:
                    tx = Transacao.query.filter_by(
                        data_transacao=dt_obj,
                        descricao=desc_final,
                        valor=desp["val"],
                        tipo=desp["tipo"]
                    ).first()

                if tx:
                    tx.status = "Pendente"
                    tx.identificador_externo = identificador
                    total_atualizados += 1
                else:
                    nova_tx = Transacao(
                        tipo=desp["tipo"],
                        categoria_id=cid,
                        descricao=desc_final,
                        valor=desp["val"],
                        data_transacao=dt_obj,
                        forma_pagamento_id=fpid,
                        status="Pendente",
                        recorrente=False,
                        observacoes=desp["obs"],
                        identificador_externo=identificador
                    )
                    db.session.add(nova_tx)
                    total_inseridos += 1

        db.session.commit()
        print(f"Lançamento de Nov e Dez concluído!")
        print(f"  - Inseridas como Pendentes:   {total_inseridos}")
        print(f"  - Atualizadas como Pendentes: {total_atualizados}\n")

        # Exibir conferência por mês
        for m in [11, 12]:
            ini = f"2026-{m:02d}-01"
            fim = f"2026-{m:02d}-30" if m == 11 else f"2026-{m:02d}-31"
            rec_pend = db.session.query(db.func.sum(Transacao.valor)).filter(
                Transacao.tipo == "Receita",
                Transacao.data_transacao.between(ini, fim),
                Transacao.status == "Pendente"
            ).scalar() or Decimal("0.00")

            desp_pend = db.session.query(db.func.sum(Transacao.valor)).filter(
                Transacao.tipo.in_(["Despesa", "Investimento"]),
                Transacao.data_transacao.between(ini, fim),
                Transacao.status == "Pendente"
            ).scalar() or Decimal("0.00")

            saldo_proj = rec_pend - desp_pend
            print(f"Mês {m:02d}/2026 (Projetado Pendente):")
            print(f"  Receitas Pendentes:     R$ {rec_pend:>11,.2f}")
            print(f"  Despesas/Invest. Pend.: R$ {desp_pend:>11,.2f}")
            print(f"  Saldo Projetado:        R$ {saldo_proj:>11,.2f}")
            print()

if __name__ == "__main__":
    main()
