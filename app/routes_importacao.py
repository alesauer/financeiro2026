from flask import Blueprint, request, jsonify
from app import db
from app.models import Transacao, Categoria, FormaPagamento, CategoriaAlias
from app.schemas import TransacaoSchema
from datetime import datetime
from app.utils.texto import normalizar_texto
from services.fatura_service import aplicar_competencia_transacao
from uuid import uuid4
import re

bp_importacao = Blueprint("importacao", __name__)


def limpar_marcador_parcela(texto: str | None) -> str:
    if not texto:
        return ""
    return re.sub(r"parc(?:ela)?\.?\s*(\(?\s*\d{1,2}\s*\/\s*\d{1,2}\s*\)?)", "", texto, flags=re.IGNORECASE).strip()

@bp_importacao.route("/importar_transacoes", methods=["POST"])
def importar_transacoes():
    data = request.get_json()
    transacoes = data.get("transacoes", [])
    forma_pagamento_id = data.get("forma_pagamento_id")
    forma_pagamento_padrao = None
    if forma_pagamento_id:
        forma_pagamento_padrao = FormaPagamento.query.get(forma_pagamento_id)
        if not forma_pagamento_padrao:
            return jsonify({"erro": "Forma de pagamento selecionada não encontrada"}), 400
    inseridas = []
    erros = []
    for idx, t in enumerate(transacoes):
        try:
            # Busca categoria pelo nome
            categoria = Categoria.query.filter_by(nome=t.get("categoria")).first()
            if not categoria:
                raise Exception(f"Categoria '{t.get('categoria')}' não encontrada.")
            # Mapeia forma de pagamento (aqui assumimos cartão de crédito)
            fp = forma_pagamento_padrao
            if not fp:
                fp = FormaPagamento.query.filter_by(tipo="Cartão de Crédito").first()
                if not fp:
                    fp = FormaPagamento(nome="Cartão de Crédito", tipo="Cartão de Crédito", cartao_credito=True)
                    db.session.add(fp)
                    db.session.flush()

            descricao_original = t.get("title") or ""
            descricao_limpa = t.get("descricao_limpa") or limpar_marcador_parcela(descricao_original)
            valor_transacao = float(t.get("amount"))

            parcelado = bool(t.get("parcelado"))
            parcela_atual = int(t.get("parcela_atual") or 1)
            total_parcelas = int(t.get("total_parcelas") or (parcela_atual if parcela_atual > 1 else 1))
            valor_parcela = float(t.get("valor_parcela")) if t.get("valor_parcela") is not None else valor_transacao
            parcelamento_id = t.get("parcelamento_id") if t.get("parcelamento_id") else (str(uuid4()) if parcelado else None)

            transacao = Transacao(
                tipo=categoria.tipo,  # Usa o tipo da categoria
                categoria_id=categoria.id,
                descricao=descricao_limpa or descricao_original,
                valor=valor_transacao,
                data_transacao=datetime.strptime(t.get("date"), "%Y-%m-%d").date() if t.get("date") else None,
                forma_pagamento_id=fp.id,
                status="Pago"
            )

            if parcelado and total_parcelas > 1:
                transacao.parcelado = True
                transacao.parcela_atual = parcela_atual
                transacao.total_parcelas = total_parcelas
                transacao.valor_parcela = valor_parcela
                transacao.parcelamento_id = parcelamento_id
                transacao.recorrente = True
                transacao.recorrencia_tipo = "Parcelamento"
            else:
                transacao.parcelado = False
                transacao.parcela_atual = 1
                transacao.total_parcelas = None
                transacao.valor_parcela = None
                transacao.parcelamento_id = None
                transacao.recorrente = False
                transacao.recorrencia_tipo = None

            aplicar_competencia_transacao(transacao, fp)
            db.session.add(transacao)
            chave_normalizada = normalizar_texto(descricao_limpa or descricao_original)
            if chave_normalizada:
                alias = CategoriaAlias.query.filter_by(descricao_normalizada=chave_normalizada).first()
                if alias:
                    alias.categoria_id = categoria.id
                    alias.descricao_exemplo = descricao_original[:255] if descricao_original else alias.descricao_exemplo
                    alias.ocorrencias = (alias.ocorrencias or 0) + 1
                else:
                    alias = CategoriaAlias(
                        descricao_normalizada=chave_normalizada,
                        descricao_exemplo=descricao_original[:255] if descricao_original else categoria.nome,
                        categoria_id=categoria.id,
                        ocorrencias=1
                    )
                    db.session.add(alias)
            inseridas.append(transacao)
        except Exception as e:
            erros.append({"linha": idx+1, "erro": str(e)})
    if inseridas:
        db.session.commit()
    return jsonify({"sucesso": len(inseridas), "erros": erros}), 200
