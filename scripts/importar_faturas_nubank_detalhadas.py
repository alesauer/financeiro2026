"""Importação e Categorização Detalhada dos Extratos do Cartão Nubank (Mai..Ago 2026).

Substitui as 4 faturas temporárias consolidadas (Mai/26 a Ago/26) pelas transações
reais e detalhadas do extrato CSV recebido do Nubank, categorizando cada compra.

Competências atendidas:
  - Fatura Mai/26 (Vencimento 03/05/2026 - Competência 2026-05-01)
  - Fatura Jun/26 (Vencimento 03/06/2026 - Competência 2026-06-01)
  - Fatura Jul/26 (Vencimento 03/07/2026 - Competência 2026-07-01)
  - Fatura Ago/26 (Vencimento 03/08/2026 - Competência 2026-08-01)
"""

import csv
import sys
from datetime import datetime, date
from decimal import Decimal

sys.path.insert(0, "/app")
sys.path.insert(0, ".")

from app import create_app, db
from app.models import Transacao, FormaPagamento, Categoria
from services.categorization import categorizar_transacao, salvar_ou_atualizar_alias
from scripts.importar_historico import (
    preprocessar_extrato, parse_valor, detectar_parcelamento,
    classificar, normalizar_texto
)

# Regras complementares específicas de estabelecimentos identificados no extrato
REGRAS_EXTRAS = [
    (["wholefds", "whole foods"], "Mercado"),
    (["subway", "dallas bbq", "doces de portugal"], "Restaurante"),
    (["njt bus", "njtransit", "impark"], "Transporte"),
    (["apple store"], "Eletrônicos"),
    (["maciel festas"], "Lazer"),
    (["esim.io", "avianca", "ripley"], "Viagem"),
    (["five below", "dollarama", "target"], "Compras Online"),
    (["corujao som"], "Carro"),
    (["barbeariabh", "barbearia", "barbers"], "Cuidados Pessoais"),
]

def obter_categoria(desc_limpa, cats_by_name):
    # 1. Categorization Engine (Aliases + Fuzzy + Regras do banco)
    cat_res = categorizar_transacao(desc_limpa)
    cat_nome = cat_res.categoria if cat_res else None
    cat_id = cat_res.categoria_id if cat_res else None

    # 2. Regras extras específicas se caiu em Diversos/Outros ou sem ID
    d = normalizar_texto(desc_limpa)
    if not cat_id or cat_nome in ("Diversos", "Outros"):
        for palavras, c_nome in REGRAS_EXTRAS:
            if any(p in d for p in palavras):
                cat_obj = cats_by_name.get(c_nome.lower())
                if cat_obj:
                    return cat_obj.id, cat_obj.nome

    # 3. Regras por palavra-chave padrão de importar_historico
    if not cat_id or cat_nome in ("Diversos", "Outros"):
        c_nome = classificar(desc_limpa)
        if c_nome and c_nome not in ("Diversos", "Outros"):
            cat_obj = cats_by_name.get(c_nome.lower())
            if cat_obj:
                return cat_obj.id, cat_obj.nome

    # 4. Fallback
    if cat_id and cat_nome:
        return cat_id, cat_nome

    fallback = cats_by_name.get("diversos") or cats_by_name.get("outros")
    return fallback.id, fallback.nome


def main():
    app = create_app()
    with app.app_context():
        fp_nubank = FormaPagamento.query.filter_by(nome="Nubank").first()
        if not fp_nubank:
            print("ERRO: Forma de pagamento Nubank não encontrada!")
            return

        cats_by_name = {c.nome.lower(): c for c in Categoria.query.filter_by(tipo="Despesa").all()}
        cat_diversos = cats_by_name.get("diversos") or cats_by_name.get("outros")

        caminho_csv = "uploads/nubank_extratos_recebidos.csv"
        with open(caminho_csv, encoding="utf-8") as f:
            text = f.read()

        blocks = text.split("date,title,amount")

        # Fontes de dados para cada mês (Jan..Ago 2026):
        # - Jan..Abr: arquivos CSV em importacao/Nubank_2026-MM-03.csv
        # - Mai..Ago: blocos 1..4 de uploads/nubank_extratos_recebidos.csv
        faturas_fontes = []
        for mes_arq in (1, 2, 3, 4):
            arq_path = f"importacao/Nubank_2026-{mes_arq:02d}-03.csv"
            with open(arq_path, encoding="utf-8-sig") as fh:
                content = fh.read()
                if "date,title,amount" in content:
                    content = content.split("date,title,amount", 1)[1]
                faturas_fontes.append((mes_arq, date(2026, mes_arq, 1), content))

        for b_idx, mes_bloco in [(1, 5), (2, 6), (3, 7), (4, 8)]:
            faturas_fontes.append((mes_bloco, date(2026, mes_bloco, 1), blocks[b_idx]))

        print("=" * 75)
        print("INICIANDO IMPORTAÇÃO DETALHADA DAS FATURAS DO CARTÃO NUBANK (JAN..AGO 2026)")
        print("=" * 75)

        total_removidas = 0
        total_inseridas = 0
        resumo_faturas = {}

        for mes, comp, raw_block in faturas_fontes:
            # 1. Remover qualquer lançamento anterior daquela competência no cartão Nubank para garantir idempotência
            rem = Transacao.query.filter(
                Transacao.forma_pagamento_id == fp_nubank.id,
                Transacao.competencia_fatura == comp,
            ).delete(synchronize_session=False)
            total_removidas += rem

            lines = [l.strip() for l in raw_block.strip().splitlines() if l.strip()]
            b_idx = mes
            raw_rows = []
            for r in csv.reader(lines):
                if not r or len(r) < 3:
                    continue
                dt_s, title, amt_s = r[0].strip(), r[1].strip(), r[2].strip()
                val = parse_valor(amt_s)
                if val is None:
                    continue
                raw_rows.append({"date": dt_s, "title": title, "amount": val})

            # Pré-processamento: cancela pares IOF/estorno e separa pagamentos
            validas, pagamentos, pares, soltos = preprocessar_extrato(raw_rows)

            # Pagamentos de quitação regular ocorrem entre dias 1 e 7.
            # Pagamentos após dia 7 são antecipações mantidas para abater da fatura.
            antecipacoes = []
            for p in pagamentos:
                dt_p = datetime.strptime(p["date"], "%Y-%m-%d").date()
                if dt_p.day > 7:
                    antecipacoes.append(p)

            soma_compras = Decimal("0.00")
            soma_antecipacoes = Decimal("0.00")
            dist_categorias = {}

            # Inserir compras válidas
            for idx_item, item in enumerate(validas, 1):
                dt_compra = datetime.strptime(item["date"], "%Y-%m-%d").date()
                parc_info = detectar_parcelamento(item["title"], item["amount"], item["date"])
                desc_limpa = parc_info["descricao_limpa"]

                cat_id, cat_nome = obter_categoria(desc_limpa, cats_by_name)
                dist_categorias[cat_nome] = dist_categorias.get(cat_nome, 0) + 1

                val_dec = Decimal(str(item["amount"]))
                soma_compras += val_dec

                identificador = f"nubank-csv-{item['date']}-{b_idx}-{idx_item:04d}-{abs(val_dec)}"

                tx = Transacao(
                    tipo="Despesa",
                    categoria_id=cat_id,
                    descricao=desc_limpa or item["title"],
                    valor=val_dec,
                    data_transacao=dt_compra,
                    forma_pagamento_id=fp_nubank.id,
                    status="Pago",
                    recorrente=bool(parc_info["parcelado"]),
                    recorrencia_tipo="Parcelamento" if parc_info["parcelado"] else None,
                    parcelado=bool(parc_info["parcelado"]),
                    parcela_atual=parc_info["parcela_atual"],
                    total_parcelas=parc_info["total_parcelas"],
                    valor_parcela=Decimal(str(parc_info["valor_parcela"])) if parc_info["valor_parcela"] else val_dec,
                    parcelamento_id=parc_info["parcelamento_id"],
                    competencia_fatura=comp,
                    identificador_externo=identificador,
                    observacoes=f"Extrato Nubank Fatura {mes:02d}/2026"
                )
                db.session.add(tx)
                total_inseridas += 1

                # Salvar alias para aprendizado contínuo
                if desc_limpa and cat_id:
                    salvar_ou_atualizar_alias(
                        descricao_original=desc_limpa,
                        categoria_id=cat_id,
                        origem="usuario",
                        confianca=1.0,
                        commit=False
                    )

            # Inserir antecipações
            for idx_a, a in enumerate(antecipacoes, 1):
                dt_a = datetime.strptime(a["date"], "%Y-%m-%d").date()
                val_a = Decimal(str(a["amount"])) # valor negativo
                soma_antecipacoes += val_a
                dist_categorias["Diversos"] = dist_categorias.get("Diversos", 0) + 1

                ident_a = f"nubank-csv-antecipacao-{a['date']}-{b_idx}-{idx_a}-{abs(val_a)}"
                tx_a = Transacao(
                    tipo="Despesa",
                    categoria_id=cat_diversos.id,
                    descricao="Pagamento antecipado de fatura",
                    valor=val_a,
                    data_transacao=dt_a,
                    forma_pagamento_id=fp_nubank.id,
                    status="Pago",
                    recorrente=False,
                    competencia_fatura=comp,
                    identificador_externo=ident_a,
                    observacoes=f"Antecipação da fatura Nubank {mes:02d}/2026"
                )
                db.session.add(tx_a)
                total_inseridas += 1

            total_liquido = soma_compras + soma_antecipacoes
            resumo_faturas[mes] = {
                "compras_qtd": len(validas),
                "antecipacoes_qtd": len(antecipacoes),
                "soma_compras": soma_compras,
                "soma_antecipacoes": soma_antecipacoes,
                "total_liquido": total_liquido,
                "categorias": dist_categorias
            }

            print(f"Mês {mes:02d}/2026 (Comp {comp}):")
            print(f"  Placeholder removido: 1 | Compras inseridas: {len(validas)} | Antecipações: {len(antecipacoes)}")
            print(f"  Soma compras: R$ {soma_compras:>11,.2f} | Antecipações: R$ {soma_antecipacoes:>10,.2f}")
            print(f"  Total líquido: R$ {total_liquido:>11,.2f}")

        db.session.commit()
        print(f"\nTotal placeholders removidos: {total_removidas}")
        print(f"Total transações detalhadas inseridas: {total_inseridas}")

        # Conferência final com os saldos do resumo
        print("\n" + "="*75)
        print("CONFERÊNCIA FINAL DOS SALDOS MENSAIS (JANEIRO A AGOSTO/2026)")
        print("="*75)
        for mes in range(1, 9):
            ini = f"2026-{mes:02d}-01"
            fim = f"2026-02-28" if mes == 2 else (f"2026-{mes:02d}-31" if mes in (1,3,5,7,8) else f"2026-{mes:02d}-30")
            
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
            qtd_nubank = Transacao.query.filter(
                Transacao.forma_pagamento_id == fp_nubank.id,
                Transacao.competencia_fatura == date(2026, mes, 1)
            ).count()

            print(f"Mês {mes:02d}/2026:")
            print(f"  Receitas:     R$ {rec:>11,.2f}")
            print(f"  Desp. Contas: R$ {desp_conta:>11,.2f}")
            print(f"  Nubank:       R$ {cart_nubank:>11,.2f} ({qtd_nubank} lançamentos)")
            print(f"  C6 Bank:      R$ {cart_c6:>11,.2f}")
            print(f"  Total Saídas: R$ {total_desp:>11,.2f}")
            print(f"  Saldo Líquido:R$ {saldo:>11,.2f}")
            print()

if __name__ == "__main__":
    main()
