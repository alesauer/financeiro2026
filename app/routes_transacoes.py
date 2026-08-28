from flask import Blueprint, request, jsonify
from marshmallow import ValidationError
from datetime import datetime, date
from decimal import Decimal, ROUND_HALF_UP
from dateutil.relativedelta import relativedelta
from app import db
from app.models import Transacao
from app.schemas import TransacaoSchema
from sqlalchemy import exc, func, case, or_
from app.models import FormaPagamento, Categoria
from flask_jwt_extended import jwt_required
import uuid
from services.fatura_service import aplicar_competencia_transacao
from app.utils.datas import parse_dia_override

bp_transacoes = Blueprint("transacoes", __name__)
schema = TransacaoSchema()
schemas = TransacaoSchema(many=True)

# Teto de segurança para geração de assinaturas em lote (ex.: diária por 10 anos).
LIMITE_OCORRENCIAS_ASSINATURA = 240

DELTA_FREQUENCIA = {
    "Diária": lambda: relativedelta(days=1),
    "Semanal": lambda: relativedelta(weeks=1),
    "Mensal": lambda: relativedelta(months=1),
    "Semestral": lambda: relativedelta(months=6),
    "Anual": lambda: relativedelta(years=1),
}


def _quebrar_valor(valor_total, total_parcelas):
    """Divide o total em N parcelas de 2 casas, jogando a diferença na última."""
    total_decimal = Decimal(str(valor_total))
    parcela = (total_decimal / Decimal(total_parcelas)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    parcelas = [parcela] * total_parcelas
    parcelas[-1] = total_decimal - parcela * (total_parcelas - 1)
    return parcelas


@bp_transacoes.route("/", methods=["POST"])
@jwt_required()
def criar():
    data = request.get_json()
    try:
        validado = schema.load(data)
    except ValidationError as err:
        return jsonify(err.messages), 400

    transacoes_geradas = []
    recorrente = validado.get('recorrente', False)
    tipo_rec = validado.get('recorrencia_tipo')
    frequencia = validado.get('frequencia')
    data_fim = validado.get('data_fim')
    data_inicial = validado.get('data_transacao')
    forma_pagamento = None
    if validado.get('forma_pagamento_id'):
        forma_pagamento = FormaPagamento.query.get(validado['forma_pagamento_id'])

    # Se for recorrente com tipo Assinatura e tiver frequência e data_fim, gera múltiplas transações
    if recorrente and tipo_rec == "Assinatura" and frequencia and data_fim and data_inicial:
        if data_fim < data_inicial:
            return jsonify({"data_fim": ["Deve ser posterior à data da transação."]}), 400

        avancar = DELTA_FREQUENCIA.get(frequencia)
        if avancar is None:
            return jsonify({"frequencia": ["Frequência inválida."]}), 400

        data_atual = data_inicial
        while data_atual <= data_fim:
            if len(transacoes_geradas) >= LIMITE_OCORRENCIAS_ASSINATURA:
                return jsonify({
                    "data_fim": [
                        f"O período gera mais de {LIMITE_OCORRENCIAS_ASSINATURA} ocorrências "
                        f"na frequência {frequencia}. Reduza a data fim."
                    ]
                }), 400

            dados_nova = dict(validado)
            dados_nova['data_transacao'] = data_atual
            nova = Transacao(**dados_nova)
            if nova.parcelado and nova.total_parcelas:
                nova.valor_parcela = nova.valor
            aplicar_competencia_transacao(nova, forma_pagamento)
            transacoes_geradas.append(nova)
            data_atual += avancar()

        db.session.add_all(transacoes_geradas)
        db.session.commit()
        return jsonify(schemas.dump(transacoes_geradas)), 201
    # Parcelamento recorrente: gerar N parcelas mensais
    elif recorrente and tipo_rec == "Parcelamento" and data_inicial and validado.get('total_parcelas'):
        total = int(validado.get('total_parcelas'))
        # O usuário informa o valor total da compra; cada parcela recebe a fração correspondente.
        valores = _quebrar_valor(validado.get('valor'), total)
        grupo_id = str(uuid.uuid4())
        data_atual = data_inicial
        for p in range(1, total + 1):
            dados_parc = dict(validado)
            dados_parc['data_transacao'] = data_atual
            dados_parc['parcelado'] = True
            dados_parc['parcela_atual'] = p
            # `valor` guarda o desembolso do mês; `valor_parcela` fica como espelho por compatibilidade.
            dados_parc['valor'] = valores[p - 1]
            dados_parc['valor_parcela'] = valores[p - 1]
            dados_parc['parcelamento_id'] = grupo_id
            nova = Transacao(**dados_parc)
            transacoes_geradas.append(nova)
            aplicar_competencia_transacao(nova, forma_pagamento)
            # incrementa mês a mês
            data_atual += relativedelta(months=1)
        db.session.add_all(transacoes_geradas)
        db.session.commit()
        return jsonify(schemas.dump(transacoes_geradas)), 201
    else:
        transacao = Transacao(**validado)
        if transacao.parcelado and transacao.total_parcelas:
            transacao.valor_parcela = transacao.valor
        aplicar_competencia_transacao(transacao, forma_pagamento)
        db.session.add(transacao)
        db.session.commit()
        return jsonify(schema.dump(transacao)), 201

@bp_transacoes.route("/", methods=["GET"])
@jwt_required()
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
        "recorrencia_tipo": request.args.get("recorrencia_tipo"),
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
        if sort_field == "tipo_prioridade":
            prioridade_tipo = case(
                (Transacao.tipo.ilike("Receita"), 0),
                (Transacao.tipo.ilike("Despesa"), 1),
                else_=2,
            )
            if sort_order == "desc":
                query = query.order_by(prioridade_tipo.desc(), Transacao.data_transacao.desc(), Transacao.id.desc())
            else:
                query = query.order_by(prioridade_tipo.asc(), Transacao.data_transacao.desc(), Transacao.id.desc())
        else:
            if sort_field not in ALLOWED_SORT_FIELDS:
                return jsonify({"error": f"Campo de ordenação inválido: {sort_field}"}), 400
            sort_col = getattr(Transacao, sort_field, None)
            if sort_col is not None:
                if sort_order == "desc":
                    query = query.order_by(sort_col.desc())
                else:
                    query = query.order_by(sort_col.asc())
    else:
        # Ordenação padrão por data (mais recentes primeiro)
        query = query.order_by(Transacao.data_transacao.desc(), Transacao.id.desc())
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
    try:
        validado = schema.load(data, partial=True)
    except ValidationError as err:
        return jsonify(err.messages), 400

    for key, value in validado.items():
        setattr(transacao, key, value)

    # Em updates parciais o schema pode receber só um dos campos; valida o par final.
    if 'tipo' in validado or 'categoria_id' in validado:
        categoria = db.session.get(Categoria, transacao.categoria_id)
        if categoria is None:
            db.session.rollback()
            return jsonify({"categoria_id": ["Categoria não encontrada."]}), 400
        if categoria.tipo != transacao.tipo:
            db.session.rollback()
            return jsonify({"categoria_id": [
                f"A categoria '{categoria.nome}' é do tipo {categoria.tipo} "
                f"e não pode ser usada em uma transação do tipo {transacao.tipo}."
            ]}), 400

    # `valor` já representa o desembolso da parcela; só espelhamos em valor_parcela.
    if transacao.parcelado:
        transacao.valor_parcela = transacao.valor

    forma_pagamento = transacao.forma_pagamento
    if 'forma_pagamento_id' in validado:
        forma_pagamento = None
        if transacao.forma_pagamento_id:
            forma_pagamento = FormaPagamento.query.get(transacao.forma_pagamento_id)
    aplicar_competencia_transacao(transacao, forma_pagamento)

    db.session.commit()
    return jsonify(schema.dump(transacao)), 200

@bp_transacoes.route("/<int:id>", methods=["DELETE"])
@jwt_required()
def deletar(id):
    transacao = Transacao.query.get_or_404(id)
    apagar_assinaturas_futuras = request.args.get("assinaturas_futuras", "false").lower() == "true"
    apagar_parcelamentos_futuros = request.args.get("parcelamentos_futuros", "false").lower() == "true"

    if apagar_assinaturas_futuras and transacao.recorrente and transacao.recorrencia_tipo == "Assinatura":
        filtros = [
            Transacao.recorrente.is_(True),
            Transacao.recorrencia_tipo == "Assinatura",
            Transacao.tipo == transacao.tipo,
            Transacao.categoria_id == transacao.categoria_id,
            Transacao.forma_pagamento_id == transacao.forma_pagamento_id,
            Transacao.descricao == transacao.descricao,
            Transacao.data_transacao >= transacao.data_transacao
        ]

        if transacao.frequencia:
            filtros.append(Transacao.frequencia == transacao.frequencia)
        if transacao.data_fim:
            filtros.append(Transacao.data_fim == transacao.data_fim)
        if transacao.valor is not None:
            filtros.append(Transacao.valor == transacao.valor)

        deletadas = Transacao.query.filter(*filtros).delete(synchronize_session=False)
        db.session.commit()
        return jsonify({"message": "Assinaturas futuras deletadas com sucesso", "qtd": deletadas}), 200

    if transacao.parcelado:
        if apagar_parcelamentos_futuros:
            deletadas = 0
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
            return jsonify({"message": "Parcela deletada com sucesso"}), 200

    db.session.delete(transacao)
    db.session.commit()
    return jsonify({"message": "Transação deletada com sucesso"}), 200

# Novo endpoint: resumo (summary) para um período (inicio/fim)
@bp_transacoes.route("/summary", methods=["GET"])
@jwt_required()
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

    # `valor` é a fonte única: em parcelamentos cada linha já contém o valor da parcela.
    receita_sum = db.session.query(func.coalesce(func.sum(Transacao.valor), 0)).filter(
        Transacao.tipo.ilike('receita'),
        Transacao.data_transacao.between(inicio_dt, fim_dt)
    ).scalar() or 0

    despesa_sum = db.session.query(func.coalesce(func.sum(Transacao.valor), 0)).filter(
        Transacao.tipo.ilike('despesa'),
        Transacao.data_transacao.between(inicio_dt, fim_dt)
    ).scalar() or 0

    competencia_ou_data = func.coalesce(Transacao.competencia_fatura, Transacao.data_transacao)

    cartao_credito_sum = db.session.query(func.coalesce(func.sum(Transacao.valor), 0)).join(FormaPagamento).filter(
        FormaPagamento.cartao_credito.is_(True),
        Transacao.tipo.ilike('despesa'),
        competencia_ou_data.between(inicio_dt, fim_dt)
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


@bp_transacoes.route("/assinaturas/summary", methods=["GET"])
@jwt_required()
def resumo_assinaturas():
    inicio_str = request.args.get("inicio")
    fim_str = request.args.get("fim")

    if not inicio_str or not fim_str:
        return jsonify({"error": "Parâmetros 'inicio' e 'fim' são obrigatórios (YYYY-MM-DD)."}), 400

    try:
        inicio_dt = datetime.strptime(inicio_str, "%Y-%m-%d").date()
        fim_dt = datetime.strptime(fim_str, "%Y-%m-%d").date()
    except ValueError:
        return jsonify({"error": "Datas inválidas (use YYYY-MM-DD)"}), 400

    base_filters = [
        Transacao.recorrente.is_(True),
        Transacao.recorrencia_tipo == "Assinatura",
        Transacao.tipo == "Despesa",
        Transacao.data_transacao.between(inicio_dt, fim_dt),
        or_(Transacao.data_fim.is_(None), Transacao.data_fim >= inicio_dt)
    ]

    # `valor` já contém o desembolso da parcela; não há mais necessidade de case.
    valor_case = Transacao.valor

    total_ativas = Transacao.query.filter(*base_filters).count()
    total_valor = db.session.query(func.coalesce(func.sum(valor_case), 0)).filter(*base_filters).scalar() or 0

    encerrando_filters = [
        Transacao.recorrente.is_(True),
        Transacao.recorrencia_tipo == "Assinatura",
        Transacao.tipo == "Despesa",
        Transacao.data_fim.isnot(None),
        Transacao.data_fim.between(inicio_dt, fim_dt)
    ]
    encerrando = Transacao.query.filter(*encerrando_filters).count()

    return jsonify({
        "vigentes": total_ativas,
        "valor_total": float(total_valor or 0),
        "encerrando": encerrando
    }), 200


@bp_transacoes.route("/assinaturas/annual", methods=["GET"])
@jwt_required()
def resumo_assinaturas_anual():
    ano = request.args.get("ano", type=int)
    if not ano:
        ano = datetime.utcnow().year

    inicio_dt = date(ano, 1, 1)
    fim_dt = date(ano, 12, 31)

    # `valor` já contém o desembolso da parcela; não há mais necessidade de case.
    valor_case = Transacao.valor

    filtros = [
        Transacao.recorrente.is_(True),
        Transacao.recorrencia_tipo == "Assinatura",
        Transacao.tipo == "Despesa",
        or_(Transacao.data_fim.is_(None), Transacao.data_fim >= inicio_dt),
        Transacao.data_transacao.between(inicio_dt, fim_dt)
    ]

    transacoes = Transacao.query.filter(*filtros).order_by(Transacao.descricao.asc()).all()

    mensal_totais = {str(m): 0.0 for m in range(1, 13)}
    linhas_dict = {}

    for tx in transacoes:
        if not tx.data_transacao:
            continue
        mes_idx = str(tx.data_transacao.month)
        valor = tx.valor_parcela if (tx.parcelado and tx.valor_parcela is not None) else tx.valor
        valor_float = float(valor or 0)
        mensal_totais[mes_idx] += valor_float

        chave = tx.descricao or f"Assinatura #{tx.id}"
        if chave not in linhas_dict:
            linhas_dict[chave] = {
                "descricao": chave,
                "categoria": tx.categoria.nome if tx.categoria else None,
                "mensal": {str(m): 0.0 for m in range(1, 13)},
                "total": 0.0
            }
        linhas_dict[chave]["mensal"][mes_idx] += valor_float
        linhas_dict[chave]["total"] += valor_float

    linhas = sorted(linhas_dict.values(), key=lambda item: item["descricao"].lower())
    total_ano = sum(mensal_totais.values())

    return jsonify({
        "ano": ano,
        "linhas": linhas,
        "mensal": mensal_totais,
        "total": total_ano
    }), 200


@bp_transacoes.route("/parcelamentos/summary", methods=["GET"])
@jwt_required()
def resumo_parcelamentos():
    inicio_str = request.args.get("inicio")
    fim_str = request.args.get("fim")

    if not inicio_str or not fim_str:
        return jsonify({"error": "Parâmetros 'inicio' e 'fim' são obrigatórios (YYYY-MM-DD)."}), 400

    try:
        inicio_dt = datetime.strptime(inicio_str, "%Y-%m-%d").date()
        fim_dt = datetime.strptime(fim_str, "%Y-%m-%d").date()
    except ValueError:
        return jsonify({"error": "Datas inválidas (use YYYY-MM-DD)"}), 400

    base_filters = [
        Transacao.recorrente.is_(True),
        Transacao.recorrencia_tipo == "Parcelamento",
        Transacao.tipo == "Despesa",
        Transacao.parcelado.is_(True),
        Transacao.data_transacao.between(inicio_dt, fim_dt)
    ]

    # `valor` já contém o desembolso da parcela; não há mais necessidade de case.
    valor_case = Transacao.valor

    identificador = func.coalesce(
        Transacao.parcelamento_id,
        func.concat("TX-", Transacao.id)
    )

    vigentes = db.session.query(
        func.count(func.distinct(identificador))
    ).filter(*base_filters).scalar() or 0

    total_valor = db.session.query(
        func.coalesce(func.sum(valor_case), 0)
    ).filter(*base_filters).scalar() or 0

    encerrando_filters = base_filters + [Transacao.parcela_atual == Transacao.total_parcelas]
    encerrando = db.session.query(
        func.count(func.distinct(identificador))
    ).filter(*encerrando_filters).scalar() or 0

    return jsonify({
        "vigentes": int(vigentes or 0),
        "valor_total": float(total_valor or 0),
        "encerrando": int(encerrando or 0)
    }), 200


@bp_transacoes.route("/parcelamentos/annual", methods=["GET"])
@jwt_required()
def resumo_parcelamentos_anual():
    ano = request.args.get("ano", type=int)
    if not ano:
        ano = datetime.utcnow().year

    inicio_dt = date(ano, 1, 1)
    fim_dt = date(ano, 12, 31)

    # `valor` já contém o desembolso da parcela; não há mais necessidade de case.
    valor_case = Transacao.valor

    filtros = [
        Transacao.recorrente.is_(True),
        Transacao.recorrencia_tipo == "Parcelamento",
        Transacao.tipo == "Despesa",
        Transacao.parcelado.is_(True),
        Transacao.data_transacao.between(inicio_dt, fim_dt)
    ]

    transacoes = Transacao.query.filter(*filtros).order_by(Transacao.descricao.asc()).all()

    mensal_totais = {str(m): 0.0 for m in range(1, 13)}
    linhas_dict = {}

    for tx in transacoes:
        if not tx.data_transacao:
            continue
        mes_idx = str(tx.data_transacao.month)
        valor = tx.valor_parcela if (tx.parcelado and tx.valor_parcela is not None) else tx.valor
        valor_float = float(valor or 0)
        mensal_totais[mes_idx] += valor_float

        chave = tx.parcelamento_id or f"Parcelamento #{tx.id}"
        descricao = tx.descricao or "Parcelamento"
        if tx.total_parcelas:
            descricao = f"{descricao} ({tx.total_parcelas}x)"

        if chave not in linhas_dict:
            linhas_dict[chave] = {
                "descricao": descricao,
                "categoria": tx.categoria.nome if tx.categoria else None,
                "mensal": {str(m): 0.0 for m in range(1, 13)},
                "total": 0.0
            }
        linhas_dict[chave]["mensal"][mes_idx] += valor_float
        linhas_dict[chave]["total"] += valor_float

    linhas = sorted(linhas_dict.values(), key=lambda item: item["descricao"].lower())
    total_ano = sum(mensal_totais.values())

    return jsonify({
        "ano": ano,
        "linhas": linhas,
        "mensal": mensal_totais,
        "total": total_ano
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

    competencia_ou_data = func.coalesce(Transacao.competencia_fatura, Transacao.data_transacao)

    query = Transacao.query.join(FormaPagamento).filter(
        FormaPagamento.cartao_credito.is_(True),
        Transacao.tipo.ilike('despesa'),
        competencia_ou_data.between(inicio_dt, fim_dt)
    ).order_by(
        Transacao.forma_pagamento_id.asc(),
        competencia_ou_data.asc(),
        Transacao.id.asc()
    )

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
                "total_pagas": 0.0,
                "total_pendentes": 0.0,
                "ultima_data": None
            }

        entry = agregados[forma_id]
        entry["quantidade"] += 1
        status_lower = (tx.status or "").lower()
        valor = tx.valor_parcela if (tx.parcelado and tx.valor_parcela is not None) else tx.valor
        valor_float = float(valor or 0)
        if status_lower == "pago":
            entry["pagas"] += 1
            entry["total_pagas"] += valor_float
        else:
            entry["pendentes"] += 1
            entry["total_pendentes"] += valor_float

        entry["total"] = entry["total_pagas"] + entry["total_pendentes"]

        if tx.data_transacao and (entry["ultima_data"] is None or tx.data_transacao > entry["ultima_data"]):
            entry["ultima_data"] = tx.data_transacao

    cartoes = []
    total_geral = 0.0
    total_geral_pendentes = 0.0
    for entry in agregados.values():
        total_geral += entry["total"]
        total_geral_pendentes += entry["total_pendentes"]
        if entry["ultima_data"]:
            entry["ultima_data"] = entry["ultima_data"].isoformat()
        cartoes.append(entry)

    return jsonify({
        "transacoes": payload,
        "cartoes": cartoes,
        "total_geral": total_geral,
        "total_geral_pendentes": total_geral_pendentes
    }), 200


@bp_transacoes.route("/recalcular_competencia", methods=["POST"])
@jwt_required()
def recalcular_competencia():
    data = request.get_json() or {}
    forma_pagamento_id = data.get("forma_pagamento_id")
    if not forma_pagamento_id:
        return jsonify({"erro": "forma_pagamento_id é obrigatório"}), 400

    forma_pagamento = FormaPagamento.query.get(forma_pagamento_id)
    if not forma_pagamento:
        return jsonify({"erro": "Forma de pagamento não encontrada"}), 404

    try:
        dia_fechamento_override = parse_dia_override(data.get("dia_fechamento_override"), "dia_fechamento_override")
        dia_vencimento_override = parse_dia_override(data.get("dia_vencimento_override"), "dia_vencimento_override")
    except ValueError as exc:
        return jsonify({"erro": str(exc)}), 400

    query = Transacao.query.filter(Transacao.forma_pagamento_id == forma_pagamento.id)

    transacoes_ids = data.get("transacoes_ids")
    if isinstance(transacoes_ids, str):
        transacoes_ids = [item.strip() for item in transacoes_ids.split(",") if item.strip()]
    if transacoes_ids:
        try:
            ids_int = [int(i) for i in transacoes_ids]
        except ValueError:
            return jsonify({"erro": "transacoes_ids deve conter apenas números"}), 400
        query = query.filter(Transacao.id.in_(ids_int))

    inicio_str = data.get("inicio")
    fim_str = data.get("fim")
    try:
        if inicio_str:
            inicio_dt = datetime.strptime(inicio_str, "%Y-%m-%d").date()
            query = query.filter(Transacao.data_transacao >= inicio_dt)
        if fim_str:
            fim_dt = datetime.strptime(fim_str, "%Y-%m-%d").date()
            query = query.filter(Transacao.data_transacao <= fim_dt)
    except ValueError:
        return jsonify({"erro": "Datas inválidas (use YYYY-MM-DD)"}), 400

    if data.get("apenas_sem_competencia"):
        query = query.filter(Transacao.competencia_fatura.is_(None))

    status_filtro = data.get("status")
    if status_filtro:
        if isinstance(status_filtro, str):
            status_filtro = [status_filtro]
        query = query.filter(Transacao.status.in_(status_filtro))

    transacoes = query.order_by(Transacao.data_transacao.asc(), Transacao.id.asc()).all()
    total_considerado = len(transacoes)
    if total_considerado == 0:
        return jsonify({
            "atualizados": 0,
            "total_considerado": 0,
            "erros": [],
            "mensagem": "Nenhuma transação encontrada para os filtros informados."
        }), 200

    atualizados = 0
    erros = []
    for tx in transacoes:
        try:
            aplicar_competencia_transacao(
                tx,
                forma_pagamento,
                dia_fechamento_override=dia_fechamento_override,
                dia_vencimento_override=dia_vencimento_override
            )
            atualizados += 1
        except Exception as exc:  # pragma: no cover - logging futuro
            erros.append({"id": tx.id, "erro": str(exc)})

    if atualizados:
        db.session.commit()

    return jsonify({
        "total_considerado": total_considerado,
        "atualizados": atualizados,
        "erros": erros,
        "dia_fechamento_utilizado": dia_fechamento_override or getattr(forma_pagamento, "dia_fechamento", None)
    }), 200
