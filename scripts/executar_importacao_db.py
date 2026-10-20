"""Executa a importação dos dados de /app/uploads/dados_importacao.json para o SQLite financas.db.

Deve ser executado dentro do container financas-backend:
    docker exec financas-backend python /app/scripts/executar_importacao_db.py
"""

import json
import os
import sys

sys.path.insert(0, "/app")
sys.path.insert(0, ".")

import unicodedata
from datetime import datetime
from decimal import Decimal

from app import create_app, db
from app.models import Transacao, Categoria, FormaPagamento
from services.fatura_service import aplicar_competencia_transacao
from services.categorization import salvar_ou_atualizar_alias

def normalizar(texto):
    if not texto:
        return ""
    s = unicodedata.normalize("NFD", str(texto))
    return "".join(c for c in s if unicodedata.category(c) != "Mn").lower().strip()

def main():
    json_path = "/app/uploads/dados_importacao.json"
    if not os.path.exists(json_path):
        # Fallback local se rodar fora do docker
        json_path = os.path.join("uploads", "dados_importacao.json")
        if not os.path.exists(json_path):
            print(f"ERRO: Arquivo {json_path} não encontrado!")
            sys.exit(1)

    with open(json_path, "r", encoding="utf-8") as f:
        payload = json.load(f)

    transacoes = payload.get("transacoes", [])
    print(f"Iniciando importação de {len(transacoes)} transações...\n")

    app = create_app()
    with app.app_context():
        # Lookups
        categorias = Categoria.query.all()
        cat_map = {}
        for c in categorias:
            cat_map[(normalizar(c.nome), c.tipo)] = c.id
            cat_map[normalizar(c.nome)] = c.id

        formas = FormaPagamento.query.all()
        fp_map = {normalizar(f.nome): f for f in formas}

        inseridas = 0
        atualizadas = 0
        erros = []

        for item in transacoes:
            identificador = item.get("identificador_externo")
            tipo = item.get("tipo")
            cat_nome = item.get("categoria_nome")
            fp_nome = item.get("forma_pagamento_nome")
            desc = item.get("descricao")
            val = Decimal(str(item.get("valor")))
            dt_str = item.get("data_transacao")
            dt_obj = datetime.strptime(dt_str, "%Y-%m-%d").date()
            status = item.get("status", "Pago")
            obs = item.get("observacoes")
            comp_str = item.get("competencia_fatura")
            comp_obj = datetime.strptime(comp_str, "%Y-%m-%d").date() if comp_str else None

            # Resolução de Categoria ID
            cid = cat_map.get((normalizar(cat_nome), tipo)) or cat_map.get(normalizar(cat_nome))
            if not cid:
                if tipo == "Receita":
                    cid = cat_map.get(("salario", "Receita"))
                elif tipo == "Investimento":
                    cid = cat_map.get(("reserva de emergencia", "Investimento"))
                else:
                    cid = cat_map.get(("diversos", "Despesa"))

            # Resolução de Forma de Pagamento
            fp = fp_map.get(normalizar(fp_nome))
            if not fp:
                erros.append(f"Forma de pagamento não encontrada: {fp_nome} ({desc})")
                continue

            # Idempotência: verificar por identificador_externo
            tx_existente = None
            if identificador:
                tx_existente = Transacao.query.filter_by(identificador_externo=identificador).first()

            # Caso não tenha identificador_externo no banco antigo, buscar por (data, desc, valor, tipo)
            if not tx_existente:
                tx_existente = Transacao.query.filter_by(
                    data_transacao=dt_obj,
                    descricao=desc,
                    valor=val,
                    tipo=tipo
                ).first()

            if tx_existente:
                # Atualiza campos se necessário
                tx_existente.status = status
                if obs and not tx_existente.observacoes:
                    tx_existente.observacoes = obs
                if not tx_existente.identificador_externo:
                    tx_existente.identificador_externo = identificador
                atualizadas += 1
            else:
                nova_tx = Transacao(
                    tipo=tipo,
                    categoria_id=cid,
                    descricao=desc,
                    valor=val,
                    data_transacao=dt_obj,
                    forma_pagamento_id=fp.id,
                    status=status,
                    recorrente=False,
                    observacoes=obs,
                    competencia_fatura=comp_obj,
                    identificador_externo=identificador
                )

                if fp.cartao_credito and not comp_obj:
                    aplicar_competencia_transacao(nova_tx, fp)

                db.session.add(nova_tx)

                # Salvar alias para categorização automática
                try:
                    salvar_ou_atualizar_alias(
                        descricao_original=desc,
                        categoria_id=cid,
                        origem="planilha",
                        confianca=1.0,
                        commit=False
                    )
                except Exception:
                    pass

                inseridas += 1

        db.session.commit()
        print(f"Sucesso na gravação:")
        print(f"  - Inseridas:   {inseridas}")
        print(f"  - Atualizadas: {atualizadas}")
        if erros:
            print(f"  - Erros ({len(erros)}): {erros[:5]}")

        # Conferência dos totais no banco de dados por mês
        print("\n" + "="*70)
        print("CONFERÊNCIA DOS TOTAIS NO SISTEMA (2026-01 a 2026-10)")
        print("="*70)
        from sqlalchemy import func
        for mes in range(1, 11):
            mes_str = f"2026-{mes:02d}"
            q = db.session.query(
                Transacao.tipo,
                func.sum(Transacao.valor),
                func.count(Transacao.id)
            ).filter(
                func.strftime("%Y-%m", Transacao.data_transacao) == mes_str
            ).group_by(Transacao.tipo).all()

            rec = next((float(r[1]) for r in q if r[0] == "Receita"), 0.0)
            desp = next((float(r[1]) for r in q if r[0] == "Despesa"), 0.0)
            inv = next((float(r[1]) for r in q if r[0] == "Investimento"), 0.0)
            saldo = rec - desp - inv
            print(f"Mês {mes:02d}/2026: Receitas=R$ {rec:>11,.2f} | Despesas=R$ {desp:>11,.2f} | Invest=R$ {inv:>9,.2f} | Saldo Líquido=R$ {saldo:>11,.2f}")

if __name__ == "__main__":
    main()
