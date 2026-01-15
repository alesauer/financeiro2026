from flask import Blueprint, request, jsonify
from app import db
from app.models import Transacao, Categoria, FormaPagamento, CategoriaAlias
from app.schemas import TransacaoSchema
from datetime import datetime
from app.utils.texto import normalizar_texto

bp_importacao = Blueprint("importacao", __name__)

@bp_importacao.route("/importar_transacoes", methods=["POST"])
def importar_transacoes():
    data = request.get_json()
    transacoes = data.get("transacoes", [])
    inseridas = []
    erros = []
    for idx, t in enumerate(transacoes):
        try:
            # Busca categoria pelo nome
            categoria = Categoria.query.filter_by(nome=t.get("categoria")).first()
            if not categoria:
                raise Exception(f"Categoria '{t.get('categoria')}' não encontrada.")
            # Mapeia forma de pagamento (aqui assumimos cartão de crédito)
            fp = FormaPagamento.query.filter_by(tipo="Cartão de Crédito").first()
            if not fp:
                fp = FormaPagamento(nome="Cartão de Crédito", tipo="Cartão de Crédito", cartao_credito=True)
                db.session.add(fp)
                db.session.flush()

            descricao_original = t.get("title") or ""
            transacao = Transacao(
                tipo=categoria.tipo,  # Usa o tipo da categoria
                categoria_id=categoria.id,
                descricao=descricao_original,
                valor=float(t.get("amount")),
                data_transacao=datetime.strptime(t.get("date"), "%Y-%m-%d").date() if t.get("date") else None,
                forma_pagamento_id=fp.id,
                status="Pago"
            )
            db.session.add(transacao)
            chave_normalizada = normalizar_texto(descricao_original)
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
