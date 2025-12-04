from flask import Blueprint, request, jsonify
from marshmallow import ValidationError
from datetime import datetime
from app import db
from app.models import Transacao
from app.schemas import TransacaoSchema
from sqlalchemy import exc, func, case

bp_transacoes = Blueprint("transacoes", __name__)
schema = TransacaoSchema()
schemas = TransacaoSchema(many=True)

@bp_transacoes.route("/", methods=["POST"])
def criar():
    data = request.get_json()
    try:
        validado = schema.load(data)
    except ValidationError as err:
        return jsonify(err.messages), 400

    transacao = Transacao(**validado)
    if transacao.parcelado and transacao.total_parcelas:
        transacao.valor_parcela = transacao.valor / transacao.total_parcelas

    db.session.add(transacao)
    db.session.commit()
    return jsonify(schema.dump(transacao)), 201

@bp_transacoes.route("/", methods=["GET"])
def listar():
    query = Transacao.query

    # 1. Obter e validar os parâmetros da URL
    filtros = {
        "tipo": request.args.get("tipo"),
        "categoria_id": request.args.get("categoria_id"),
        "forma_pagamento": request.args.get("forma_pagamento"),
        "status": request.args.get("status"),
        "recorrente": request.args.get("recorrente"),
        "parcelado": request.args.get("parcelado"),
    }

    inicio_str = request.args.get("inicio")
    fim_str = request.args.get("fim")
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 10, type=int)

    # 2. Aplicar os filtros na query
    for campo, valor in filtros.items():
        if valor is not None:
            # Converte valores de string para booleanos, se necessário
            if valor.lower() in ["true", "false"]:
                valor = valor.lower() == "true"
            try:
                # Aplica o filtro dinamicamente
                query = query.filter(getattr(Transacao, campo) == valor)
            except (exc.InvalidRequestError, AttributeError):
                return jsonify({"error": f"Filtro inválido: {campo}"}), 400

    # 3. Tratar filtro de data
    if inicio_str and fim_str:
        try:
            inicio_dt = datetime.strptime(inicio_str, "%Y-%m-%d").date()
            fim_dt = datetime.strptime(fim_str, "%Y-%m-%d").date()
            query = query.filter(Transacao.data_transacao.between(inicio_dt, fim_dt))
        except ValueError:
            return jsonify({"error": "Datas inválidas (use YYYY-MM-DD)"}), 400

    # 4. Adicionar paginação e obter os resultados
    # --- Ordenação segura (recebe sort_field e sort_order) ---
    sort_field = request.args.get("sort_field")
    sort_order = request.args.get("sort_order", "asc").lower()  # 'asc' ou 'desc'
    ALLOWED_SORT_FIELDS = {"id", "data_transacao", "valor", "descricao", "tipo", "status", "categoria_id"}
    if sort_field:
        if sort_field not in ALLOWED_SORT_FIELDS:
            return jsonify({"error": f"Campo de ordenação inválido: {sort_field}"}), 400
        sort_col = getattr(Transacao, sort_field, None)
        if sort_col is not None:
            if sort_order == "desc":
                query = query.order_by(sort_col.desc())
            else:
                query = query.order_by(sort_col.asc())
    # --- fim da ordenação ---

    paginated_results = query.paginate(page=page, per_page=per_page, error_out=False)

    # 5. Formatar a resposta
    response = {
        "items": schemas.dump(paginated_results.items),
        "total_items": paginated_results.total,
        "total_pages": paginated_results.pages,
        "current_page": paginated_results.page,
        "per_page": paginated_results.per_page,
        "has_next": paginated_results.has_next,
        "has_prev": paginated_results.has_prev,
    }

    return jsonify(response), 200

@bp_transacoes.route("/<int:id>", methods=["GET"])
def obter(id):
    transacao = Transacao.query.get_or_404(id)
    return jsonify(schema.dump(transacao)), 200

@bp_transacoes.route("/<int:id>", methods=["PUT"])
def atualizar(id):
    transacao = Transacao.query.get_or_404(id)
    data = request.get_json()
    try:
        validado = schema.load(data, partial=True)
    except ValidationError as err:
        return jsonify(err.messages), 400

    for key, value in validado.items():
        setattr(transacao, key, value)

    if transacao.parcelado and transacao.total_parcelas:
        transacao.valor_parcela = transacao.valor / transacao.total_parcelas

    db.session.commit()
    return jsonify(schema.dump(transacao)), 200

@bp_transacoes.route("/<int:id>", methods=["DELETE"])
def deletar(id):
    transacao = Transacao.query.get_or_404(id)
    db.session.delete(transacao)
    db.session.commit()
    return jsonify({"message": "Transação deletada com sucesso"}), 200

# Novo endpoint: resumo (summary) para um período (inicio/fim)
@bp_transacoes.route("/summary", methods=["GET"])
def resumo_mes():
    inicio_str = request.args.get("inicio")
    fim_str = request.args.get("fim")

    if not inicio_str or not fim_str:
        return jsonify({"error": "Parâmetros 'inicio' e 'fim' são obrigatórios (YYYY-MM-DD)."}), 400

    try:
        inicio_dt = datetime.strptime(inicio_str, "%Y-%m-%d").date()
        fim_dt = datetime.strptime(fim_str, "%Y-%m-%d").date()
    except ValueError:
        return jsonify({"error": "Datas inválidas (use YYYY-MM-DD)"}), 400

    # Soma receitas: usa valor_parcela quando parcelado, caso exista
    receita_sum = db.session.query(func.coalesce(func.sum(
        case(
            (Transacao.parcelado == True, Transacao.valor_parcela),
            else_=Transacao.valor
        )
    ), 0)).filter(
        Transacao.tipo.ilike('receita'),
        Transacao.data_transacao.between(inicio_dt, fim_dt)
    ).scalar() or 0

    despesa_sum = db.session.query(func.coalesce(func.sum(
        case(
            (Transacao.parcelado == True, Transacao.valor_parcela),
            else_=Transacao.valor
        )
    ), 0)).filter(
        Transacao.tipo.ilike('despesa'),
        Transacao.data_transacao.between(inicio_dt, fim_dt)
    ).scalar() or 0

    # Garantir que despesas exibidas como valor positivo
    try:
        despesas_val = abs(float(despesa_sum))
    except Exception:
        despesas_val = float(despesa_sum or 0)

    receitas_val = float(receita_sum or 0)
    saldo = receitas_val - despesas_val

    return jsonify({
        "receitas": receitas_val,
        "despesas": despesas_val,
        "saldo": saldo
    }), 200
