from flask import Blueprint, request, jsonify
from marshmallow import ValidationError
from datetime import datetime
from app import db
from app.models import Transacao
from app.schemas import TransacaoSchema
from sqlalchemy import exc, func, case
from app.models import FormaPagamento
from flask_jwt_extended import jwt_required
import uuid

bp_transacoes = Blueprint("transacoes", __name__)
schema = TransacaoSchema()
schemas = TransacaoSchema(many=True)

@bp_transacoes.route("/", methods=["POST"])
@jwt_required()
def criar():
    data = request.get_json()
    try:
        validado = schema.load(data)
    except ValidationError as err:
        return jsonify(err.messages), 400

    from dateutil.relativedelta import relativedelta

    transacoes_geradas = []
    recorrente = validado.get('recorrente', False)
    tipo_rec = validado.get('recorrencia_tipo')
    frequencia = validado.get('frequencia')
    data_fim = validado.get('data_fim')
    data_inicial = validado.get('data_transacao')

    # Se for recorrente com tipo Assinatura e tiver frequência e data_fim, gera múltiplas transações
    if recorrente and tipo_rec == "Assinatura" and frequencia and data_fim and data_inicial:
        data_atual = data_inicial
        while data_atual <= data_fim:
            dados_nova = dict(validado)
            dados_nova['data_transacao'] = data_atual
            # Remove data_transacao duplicado se existir
            if 'data_transacao' in dados_nova and dados_nova['data_transacao'] != data_atual:
                dados_nova['data_transacao'] = data_atual
            nova = Transacao(**dados_nova)
            if nova.parcelado and nova.total_parcelas:
                nova.valor_parcela = nova.valor / nova.total_parcelas
            transacoes_geradas.append(nova)
            # Avança para próxima recorrência
            if frequencia == "Mensal":
                data_atual += relativedelta(months=1)
            elif frequencia == "Semanal":
                data_atual += relativedelta(weeks=1)
            elif frequencia == "Diária":
                data_atual += relativedelta(days=1)
            elif frequencia == "Semestral":
                data_atual += relativedelta(months=6)
            elif frequencia == "Anual":
                data_atual += relativedelta(years=1)
            else:
                break
        db.session.add_all(transacoes_geradas)
        db.session.commit()
        return jsonify(schemas.dump(transacoes_geradas)), 201
    # Parcelamento recorrente: gerar N parcelas mensais
    elif recorrente and tipo_rec == "Parcelamento" and data_inicial and validado.get('total_parcelas'):
        total = int(validado.get('total_parcelas'))
        valor_total = float(validado.get('valor'))
        valor_parcela = valor_total / total if total > 0 else valor_total
        grupo_id = str(uuid.uuid4())
        data_atual = data_inicial
        for p in range(1, total + 1):
            dados_parc = dict(validado)
            dados_parc['data_transacao'] = data_atual
            dados_parc['parcelado'] = True
            dados_parc['parcela_atual'] = p
            dados_parc['valor_parcela'] = valor_parcela
            dados_parc['parcelamento_id'] = grupo_id
            nova = Transacao(**dados_parc)
            transacoes_geradas.append(nova)
            # incrementa mês a mês
            data_atual += relativedelta(months=1)
        db.session.add_all(transacoes_geradas)
        db.session.commit()
        return jsonify(schemas.dump(transacoes_geradas)), 201
    else:
        transacao = Transacao(**validado)
        if transacao.parcelado and transacao.total_parcelas:
            transacao.valor_parcela = transacao.valor / transacao.total_parcelas
        db.session.add(transacao)
        db.session.commit()
        return jsonify(schema.dump(transacao)), 201

@bp_transacoes.route("/", methods=["GET"])
def listar():
    query = Transacao.query
    forma_pagamento_joined = False

    # 1. Obter e validar os parâmetros da URL
    filtros = {
        "tipo": request.args.get("tipo"),
        "categoria_id": request.args.get("categoria_id"),
        # nova coluna FK
        "forma_pagamento_id": request.args.get("forma_pagamento_id"),
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

    # Filtro legado: forma_pagamento por nome/tipo (ex.: ?forma_pagamento=Pix)
    forma_pagamento_legacy = request.args.get("forma_pagamento")
    if forma_pagamento_legacy:
        try:
            # Faz join com FormaPagamento e filtra por nome OU tipo
            query = query.join(Transacao.forma_pagamento)
            forma_pagamento_joined = True
            query = query.filter(
                (FormaPagamento.nome == forma_pagamento_legacy) | (FormaPagamento.tipo == forma_pagamento_legacy)
            )
        except Exception:
            return jsonify({"error": "Filtro de forma_pagamento inválido"}), 400

    cartao_credito_flag = request.args.get("cartao_credito")
    if cartao_credito_flag is not None:
        flag_value = cartao_credito_flag.lower() == "true"
        if not forma_pagamento_joined:
            query = query.join(Transacao.forma_pagamento)
            forma_pagamento_joined = True
        query = query.filter(FormaPagamento.cartao_credito.is_(flag_value))

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
    else:
        # Ordenação padrão por tipo (desc) para a grid de transações
        query = query.order_by(Transacao.tipo.desc())
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
@jwt_required()
def obter(id):
    transacao = Transacao.query.get_or_404(id)
    return jsonify(schema.dump(transacao)), 200

@bp_transacoes.route("/<int:id>", methods=["PUT"])
@jwt_required()
def atualizar(id):
    transacao = Transacao.query.get_or_404(id)
    data = request.get_json()
    print(f"[PUT TRANSACAO] id={id}, payload recebido:", data)
    try:
        validado = schema.load(data, partial=True)
    except ValidationError as err:
        print(f"[PUT TRANSACAO] Erro de validação:", err.messages)
        return jsonify(err.messages), 400

    for key, value in validado.items():
        setattr(transacao, key, value)

    if transacao.parcelado and transacao.total_parcelas:
        transacao.valor_parcela = transacao.valor / transacao.total_parcelas

    db.session.commit()
    return jsonify(schema.dump(transacao)), 200

@bp_transacoes.route("/<int:id>", methods=["DELETE"])
@jwt_required()
def deletar(id):
    transacao = Transacao.query.get_or_404(id)
    deletadas = 0
    if transacao.parcelado:
        # Se tiver parcelamento_id, deletar todas as futuras (inclui a atual)
        if transacao.parcelamento_id:
            q = Transacao.query.filter(
                Transacao.parcelamento_id == transacao.parcelamento_id,
                Transacao.parcela_atual >= transacao.parcela_atual
            )
            deletadas = q.delete(synchronize_session=False)
        else:
            # Fallback: tentar identificar pelo conjunto de campos (menos robusto)
            from sqlalchemy import and_
            q = Transacao.query.filter(and_(
                Transacao.parcelado == True,
                Transacao.tipo == transacao.tipo,
                Transacao.categoria_id == transacao.categoria_id,
                Transacao.forma_pagamento_id == transacao.forma_pagamento_id,
                Transacao.descricao == transacao.descricao,
                Transacao.total_parcelas == transacao.total_parcelas,
                Transacao.valor_parcela == transacao.valor_parcela,
                Transacao.parcela_atual >= transacao.parcela_atual
            ))
            deletadas = q.delete(synchronize_session=False)
        db.session.commit()
        return jsonify({"message": "Parcelas futuras deletadas com sucesso", "qtd": deletadas}), 200
    else:
        db.session.delete(transacao)
        db.session.commit()
        return jsonify({"message": "Transação deletada com sucesso"}), 200

# Novo endpoint: resumo (summary) para um período (inicio/fim)
@bp_transacoes.route("/summary", methods=["GET"])
@jwt_required()
def resumo_mes():
    inicio_str = request.args.get("inicio")
    fim_str = request.args.get("fim")
    print(f"[SUMMARY] inicio={inicio_str}, fim={fim_str}")

    if not inicio_str or not fim_str:
        return jsonify({"error": "Parâmetros 'inicio' e 'fim' são obrigatórios (YYYY-MM-DD)."}), 400

    try:
        inicio_dt = datetime.strptime(inicio_str, "%Y-%m-%d").date()
        fim_dt = datetime.strptime(fim_str, "%Y-%m-%d").date()
    except ValueError as e:
        print(f"[SUMMARY] Erro ao parsear datas: {e}")
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

    cartao_credito_sum = db.session.query(func.coalesce(func.sum(
        case(
            (Transacao.parcelado == True, Transacao.valor_parcela),
            else_=Transacao.valor
        )
    ), 0)).join(FormaPagamento).filter(
        FormaPagamento.cartao_credito.is_(True),
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
        "saldo": saldo,
        "cartao_credito_total": float(cartao_credito_sum or 0)
    }), 200


@bp_transacoes.route("/cartao_credito", methods=["GET"])
@jwt_required()
def listar_cartao_credito():
    inicio_str = request.args.get("inicio")
    fim_str = request.args.get("fim")

    if not inicio_str or not fim_str:
        return jsonify({"error": "Parâmetros 'inicio' e 'fim' são obrigatórios (YYYY-MM-DD)."}), 400

    try:
        inicio_dt = datetime.strptime(inicio_str, "%Y-%m-%d").date()
        fim_dt = datetime.strptime(fim_str, "%Y-%m-%d").date()
    except ValueError:
        return jsonify({"error": "Datas inválidas (use YYYY-MM-DD)"}), 400

    query = Transacao.query.join(FormaPagamento).filter(
        FormaPagamento.cartao_credito.is_(True),
        Transacao.data_transacao.between(inicio_dt, fim_dt)
    ).order_by(Transacao.forma_pagamento_id.asc(), Transacao.data_transacao.asc(), Transacao.id.asc())

    transacoes = query.all()
    payload = schemas.dump(transacoes)

    agregados = {}
    for tx, dados in zip(transacoes, payload):
        forma_id = tx.forma_pagamento_id
        if forma_id not in agregados:
            agregados[forma_id] = {
                "forma_pagamento_id": forma_id,
                "forma_pagamento_nome": (tx.forma_pagamento.nome if tx.forma_pagamento else dados.get("forma_pagamento_nome")),
                "quantidade": 0,
                "pagas": 0,
                "pendentes": 0,
                "total": 0.0,
                "ultima_data": None
            }

        entry = agregados[forma_id]
        entry["quantidade"] += 1
        status_lower = (tx.status or "").lower()
        if status_lower == "pago":
            entry["pagas"] += 1
        else:
            entry["pendentes"] += 1

        valor = tx.valor_parcela if (tx.parcelado and tx.valor_parcela is not None) else tx.valor
        entry["total"] += float(valor or 0)

        if tx.data_transacao and (entry["ultima_data"] is None or tx.data_transacao > entry["ultima_data"]):
            entry["ultima_data"] = tx.data_transacao

    cartoes = []
    total_geral = 0.0
    for entry in agregados.values():
        total_geral += entry["total"]
        if entry["ultima_data"]:
            entry["ultima_data"] = entry["ultima_data"].isoformat()
        cartoes.append(entry)

    return jsonify({
        "transacoes": payload,
        "cartoes": cartoes,
        "total_geral": total_geral
    }), 200
