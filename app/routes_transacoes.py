from flask import Blueprint, request, jsonify
from marshmallow import ValidationError
from datetime import datetime, date
from decimal import Decimal, ROUND_HALF_UP
from dateutil.relativedelta import relativedelta
from app import db
from app.models import Transacao, FormaPagamento, Categoria, OpenFinanceContaMap, OpenFinanceFatura
from app.schemas import TransacaoSchema
from sqlalchemy import exc, func, case, or_
from flask_jwt_extended import jwt_required
import uuid
from services.fatura_service import (
    aplicar_competencia_transacao,
    calcular_competencia_fatura,
    calcular_vencimento_fatura,
    calcular_ciclo_compras,
)
from app.utils.datas import parse_dia_override
from services.categorization import salvar_ou_atualizar_alias

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
        if transacao.descricao and transacao.categoria_id:
            salvar_ou_atualizar_alias(
                descricao_original=transacao.descricao,
                categoria_id=transacao.categoria_id,
                origem="usuario",
                confianca=1.0,
                commit=False
            )
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

    origem = request.args.get("origem")
    cartao_credito_flag = request.args.get("cartao_credito")
    if origem == "cartao" or (cartao_credito_flag and cartao_credito_flag.lower() == "true"):
        if not forma_pagamento_joined:
            query = query.outerjoin(Transacao.forma_pagamento)
            forma_pagamento_joined = True
        query = query.filter(FormaPagamento.cartao_credito.is_(True))
    elif origem == "contas":
        if not forma_pagamento_joined:
            query = query.outerjoin(Transacao.forma_pagamento)
            forma_pagamento_joined = True
        query = query.filter(db.or_(FormaPagamento.cartao_credito.is_(False), FormaPagamento.id.is_(None)))

    # 3. Tratar filtro de data
    if inicio_str and fim_str:
        try:
            inicio_dt = datetime.strptime(inicio_str, "%Y-%m-%d").date()
            fim_dt = datetime.strptime(fim_str, "%Y-%m-%d").date()
            if not forma_pagamento_joined:
                query = query.outerjoin(Transacao.forma_pagamento)
                forma_pagamento_joined = True

            # No regime financeiro do app, compras no cartão vinculadas à fatura do mês (competência)
            # ou lançamentos com data_transacao no período devem ser retornados.
            query = query.filter(
                db.or_(
                    db.and_(
                        FormaPagamento.cartao_credito.is_(True),
                        Transacao.competencia_fatura.between(inicio_dt, fim_dt),
                    ),
                    db.and_(
                        db.or_(FormaPagamento.cartao_credito.is_(False), FormaPagamento.id.is_(None)),
                        Transacao.data_transacao.between(inicio_dt, fim_dt),
                    ),
                    Transacao.data_transacao.between(inicio_dt, fim_dt),
                )
            )
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

    if transacao.descricao and transacao.categoria_id:
        salvar_ou_atualizar_alias(
            descricao_original=transacao.descricao,
            categoria_id=transacao.categoria_id,
            origem="usuario",
            confianca=1.0,
            commit=False
        )

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

@bp_transacoes.route("/lote", methods=["DELETE", "POST"])
@jwt_required()
def deletar_lote():
    data = request.get_json(silent=True) or {}
    transacoes_ids = data.get("ids", [])
    if not transacoes_ids:
        ids_arg = request.args.get("ids")
        if ids_arg:
            transacoes_ids = [int(x.strip()) for x in ids_arg.split(",") if x.strip().isdigit()]
    if not transacoes_ids:
        return jsonify({"error": "Nenhum ID informado para exclusão em lote."}), 400

    try:
        ids_int = [int(i) for i in transacoes_ids]
    except (ValueError, TypeError):
        return jsonify({"error": "Lista de IDs deve conter apenas números inteiros."}), 400

    deletadas = Transacao.query.filter(Transacao.id.in_(ids_int)).delete(synchronize_session=False)
    db.session.commit()
    return jsonify({"message": "Transações excluídas com sucesso.", "quantidade": deletadas}), 200

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

    # 1. Receitas do período (por data da transação)
    receita_sum = db.session.query(func.coalesce(func.sum(Transacao.valor), 0)).filter(
        Transacao.tipo.ilike('receita'),
        Transacao.data_transacao.between(inicio_dt, fim_dt)
    ).scalar() or 0

    # 2. Despesas de Conta Corrente / Dinheiro / Pix (não cartão de crédito)
    despesa_conta_sum = db.session.query(func.coalesce(func.sum(Transacao.valor), 0)).outerjoin(FormaPagamento).filter(
        Transacao.tipo.ilike('despesa'),
        or_(FormaPagamento.cartao_credito.is_(False), FormaPagamento.id.is_(None)),
        Transacao.data_transacao.between(inicio_dt, fim_dt)
    ).scalar() or 0

    # 3. Fatura de cartão de crédito cujo vencimento pertença ao período
    busca_inicio = inicio_dt - relativedelta(months=2)
    busca_fim = fim_dt + relativedelta(months=1)
    card_txs = (
        Transacao.query.join(FormaPagamento)
        .filter(
            FormaPagamento.cartao_credito.is_(True),
            Transacao.tipo.in_(["Despesa", "Receita"]),
            db.or_(
                Transacao.data_transacao.between(busca_inicio, busca_fim),
                Transacao.competencia_fatura.between(busca_inicio, busca_fim),
            ),
        )
        .all()
    )

    cartao_credito_sum = 0.0
    cartao_credito_pago_sum = 0.0
    cartao_credito_pendente_sum = 0.0

    for tx in card_txs:
        forma = tx.forma_pagamento
        dia_fech = forma.dia_fechamento or 28
        dia_venc = forma.dia_vencimento or 5
        comp = tx.competencia_fatura or calcular_competencia_fatura(tx.data_transacao, dia_fech, dia_venc)
        if not comp:
            continue
        data_venc = calcular_vencimento_fatura(comp, dia_fech, dia_venc)
        if not (inicio_dt <= data_venc <= fim_dt):
            continue
        raw_val = float(tx.valor_parcela if (tx.parcelado and tx.valor_parcela is not None) else (tx.valor or 0))
        val = -abs(raw_val) if tx.tipo == "Receita" else raw_val
        cartao_credito_sum += val
        if tx.status == "Pago":
            cartao_credito_pago_sum += val
        else:
            cartao_credito_pendente_sum += val

    # Se houver faturas oficiais do Open Finance cadastradas para o período, prioriza os valores oficiais fechados
    faturas_oficiais = (
        OpenFinanceFatura.query.join(OpenFinanceContaMap)
        .join(FormaPagamento, OpenFinanceContaMap.forma_pagamento_id == FormaPagamento.id)
        .filter(
            FormaPagamento.ativo.is_(True),
            db.or_(
                OpenFinanceFatura.data_vencimento.between(inicio_dt, fim_dt),
                OpenFinanceFatura.competencia.between(inicio_dt, fim_dt),
            ),
        )
        .all()
    )

    if faturas_oficiais:
        cartao_oficial_total = 0.0
        cartao_oficial_pago = 0.0
        cartao_oficial_pendente = 0.0
        for fo in faturas_oficiais:
            cartao_oficial_total += float(fo.valor_total)
            is_pago = fo.status == "PAGO" or fo.valor_pago >= (fo.valor_total - 0.05)
            if is_pago:
                cartao_oficial_pago += float(fo.valor_total)
            else:
                pago_parcial = float(fo.valor_pago or 0.0)
                cartao_oficial_pago += pago_parcial
                cartao_oficial_pendente += max(0.0, float(fo.valor_total) - pago_parcial)

        cartao_credito_sum = cartao_oficial_total
        cartao_credito_pago_sum = cartao_oficial_pago
        cartao_credito_pendente_sum = cartao_oficial_pendente

    cartao_val = round(float(cartao_credito_sum or 0), 2)
    despesas_conta_val = float(despesa_conta_sum or 0)
    despesas_val = despesas_conta_val + cartao_val
    receitas_val = float(receita_sum or 0)
    saldo = receitas_val - despesas_val

    return jsonify({
        "receitas": receitas_val,
        "despesas": despesas_val,
        "despesas_conta": despesas_conta_val,
        "saldo": saldo,
        "cartao_credito_total": cartao_val,
        "cartao_credito_pago": float(cartao_credito_pago_sum or 0),
        "cartao_credito_pendente": float(cartao_credito_pendente_sum or 0),
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


MESES_PT_NOMES = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
]


@bp_transacoes.route("/cartao_credito", methods=["GET"])
@jwt_required()
def listar_cartao_credito():
    """Retorna as faturas de cartão de crédito cujo VENCIMENTO cai no período solicitado (mês corrente)."""
    inicio_str = request.args.get("inicio")
    fim_str = request.args.get("fim")

    if not inicio_str or not fim_str:
        return jsonify({"error": "Parâmetros 'inicio' e 'fim' são obrigatórios (YYYY-MM-DD)."}), 400

    try:
        inicio_dt = datetime.strptime(inicio_str, "%Y-%m-%d").date()
        fim_dt = datetime.strptime(fim_str, "%Y-%m-%d").date()
    except ValueError:
        return jsonify({"error": "Datas inválidas (use YYYY-MM-DD)"}), 400

    # Busca em janela ampla (2 meses antes e 1 mês depois) para capturar compras de ciclos anteriores cujo boleto vence neste mês
    busca_inicio = inicio_dt - relativedelta(months=2)
    busca_fim = fim_dt + relativedelta(months=1)

    query = (
        Transacao.query.join(FormaPagamento)
        .filter(
            FormaPagamento.cartao_credito.is_(True),
            Transacao.tipo.in_(["Despesa", "Receita"]),
            db.or_(
                Transacao.data_transacao.between(busca_inicio, busca_fim),
                Transacao.competencia_fatura.between(busca_inicio, busca_fim),
            ),
        )
        .order_by(
            Transacao.forma_pagamento_id.asc(),
            Transacao.data_transacao.desc(),
            Transacao.id.asc(),
        )
    )

    transacoes_todas = query.all()

    # Mapear e agrupar por fatura (cartao + competencia)
    faturas_map = {}
    transacoes_filtradas = []

    for tx in transacoes_todas:
        forma = tx.forma_pagamento
        if not forma:
            continue

        dia_fech = forma.dia_fechamento or 28
        dia_venc = forma.dia_vencimento or 5

        competencia = (
            tx.competencia_fatura
            or calcular_competencia_fatura(tx.data_transacao, dia_fech, dia_venc)
            or (date(tx.data_transacao.year, tx.data_transacao.month, 1) if tx.data_transacao else None)
        )

        if not competencia:
            continue

        data_vencimento = calcular_vencimento_fatura(competencia, dia_fech, dia_venc)
        if not data_vencimento:
            continue

        # Verifica se o vencimento da fatura cai no mês/período solicitado pelo usuário
        if not (inicio_dt <= data_vencimento <= fim_dt):
            continue

        transacoes_filtradas.append(tx)
        fatura_key = f"{forma.id}|{competencia.isoformat()}"

        if fatura_key not in faturas_map:
            ciclo_ini, ciclo_fim = calcular_ciclo_compras(competencia, dia_fech, dia_venc)
            comp_label = f"{MESES_PT_NOMES[competencia.month - 1]} / {competencia.year}"
            venc_label = data_vencimento.strftime("%d/%m/%Y")
            ciclo_label = (
                f"Compras de {ciclo_ini.strftime('%d/%m')} a {ciclo_fim.strftime('%d/%m/%Y')} (Fechou em {ciclo_fim.strftime('%d/%m')})"
                if ciclo_ini and ciclo_fim
                else ""
            )

            faturas_map[fatura_key] = {
                "key": fatura_key,
                "forma_pagamento_id": forma.id,
                "forma_pagamento_nome": forma.nome,
                "cartao_nome": forma.nome,
                "forma_pagamento_icone": getattr(forma, "icone", None),
                "forma_pagamento_cor": getattr(forma, "cor", None),
                "competencia": competencia.isoformat(),
                "competencia_label": comp_label,
                "dia_fechamento": dia_fech,
                "dia_vencimento": dia_venc,
                "data_fechamento": ciclo_fim.isoformat() if ciclo_fim else None,
                "data_vencimento": data_vencimento.isoformat(),
                "data_vencimento_label": venc_label,
                "periodo_compras_inicio": ciclo_ini.isoformat() if ciclo_ini else None,
                "periodo_compras_fim": ciclo_fim.isoformat() if ciclo_fim else None,
                "periodo_compras_label": ciclo_label,
                "total": 0.0,
                "total_pagas": 0.0,
                "total_pendentes": 0.0,
                "qtd_transacoes": 0,
                "qtd_compras": 0,
                "qtd_estornos": 0,
                "soma_estornos": 0.0,
                "categorias_contagem": {},
                "items": [],
            }

        fatura = faturas_map[fatura_key]
        raw_valor = float(tx.valor_parcela if (tx.parcelado and tx.valor_parcela is not None) else (tx.valor or 0))
        # No cartão, transações do tipo Receita ou valores negativos representam estornos/créditos de fatura
        if tx.tipo == "Receita":
            valor_efetivo = -abs(raw_valor)
        else:
            valor_efetivo = raw_valor

        status_lower = (tx.status or "").lower()
        is_pago = status_lower == "pago"
        is_estorno = valor_efetivo < 0

        fatura["qtd_transacoes"] += 1
        if is_estorno:
            fatura["qtd_estornos"] += 1
            fatura["soma_estornos"] += abs(valor_efetivo)
        else:
            fatura["qtd_compras"] += 1

        fatura["total"] += valor_efetivo
        if is_pago:
            fatura["total_pagas"] += valor_efetivo
        else:
            fatura["total_pendentes"] += valor_efetivo

        cat_nome = tx.categoria.nome if tx.categoria else "Outros"
        fatura["categorias_contagem"][cat_nome] = fatura["categorias_contagem"].get(cat_nome, 0.0) + valor_efetivo

        fatura["items"].append(tx)

    # 1. Adiciona faturas oficiais que porventura não tenham transações individuais no período
    faturas_oficiais_extras = (
        OpenFinanceFatura.query.join(OpenFinanceContaMap)
        .join(FormaPagamento, OpenFinanceContaMap.forma_pagamento_id == FormaPagamento.id)
        .filter(
            FormaPagamento.ativo.is_(True),
            db.or_(
                OpenFinanceFatura.data_vencimento.between(inicio_dt, fim_dt),
                OpenFinanceFatura.competencia.between(inicio_dt, fim_dt),
            ),
        )
        .all()
    )

    for fo in faturas_oficiais_extras:
        forma = fo.conta_map.forma_pagamento if fo.conta_map else None
        if not forma:
            continue
        comp_iso = fo.competencia.isoformat()
        f_key = f"{forma.id}|{comp_iso}"
        if f_key not in faturas_map:
            dia_fech = forma.dia_fechamento or 28
            dia_venc = forma.dia_vencimento or 5
            ciclo_ini, ciclo_fim = calcular_ciclo_compras(fo.competencia, dia_fech, dia_venc)
            comp_label = f"{MESES_PT_NOMES[fo.competencia.month - 1]} / {fo.competencia.year}"
            venc_label = fo.data_vencimento.strftime("%d/%m/%Y")
            ciclo_label = (
                f"Compras de {ciclo_ini.strftime('%d/%m')} a {ciclo_fim.strftime('%d/%m/%Y')} (Fechou em {ciclo_fim.strftime('%d/%m')})"
                if ciclo_ini and ciclo_fim
                else ""
            )

            is_paga = fo.status == "PAGO" or fo.valor_pago >= (fo.valor_total - 0.05)
            faturas_map[f_key] = {
                "key": f_key,
                "forma_pagamento_id": forma.id,
                "forma_pagamento_nome": forma.nome,
                "cartao_nome": forma.nome,
                "forma_pagamento_icone": getattr(forma, "icone", None),
                "forma_pagamento_cor": getattr(forma, "cor", None),
                "competencia": comp_iso,
                "competencia_label": comp_label,
                "dia_fechamento": dia_fech,
                "dia_vencimento": dia_venc,
                "data_fechamento": fo.data_fechamento.isoformat() if fo.data_fechamento else (ciclo_fim.isoformat() if ciclo_fim else None),
                "data_vencimento": fo.data_vencimento.isoformat(),
                "data_vencimento_label": venc_label,
                "periodo_compras_inicio": ciclo_ini.isoformat() if ciclo_ini else None,
                "periodo_compras_fim": ciclo_fim.isoformat() if ciclo_fim else None,
                "periodo_compras_label": ciclo_label,
                "total": round(float(fo.valor_total), 2),
                "total_pagas": round(float(fo.valor_total), 2) if is_paga else round(float(fo.valor_pago or 0.0), 2),
                "total_pendentes": 0.0 if is_paga else round(max(0.0, float(fo.valor_total) - float(fo.valor_pago or 0.0)), 2),
                "qtd_transacoes": 0,
                "qtd_compras": 0,
                "qtd_estornos": 0,
                "soma_estornos": 0.0,
                "categorias_contagem": {},
                "items": [],
                "origem_oficial": True,
                "total_lancamentos": 0.0,
                "valor_oficial": round(float(fo.valor_total), 2),
                "valor_pago_oficial": round(float(fo.valor_pago or 0.0), 2),
                "status_fatura": "Pago" if is_paga else ("Parcial" if fo.valor_pago > 0 else "Pendente"),
            }

    # Formatar faturas e calcular resumos de categorias
    faturas_lista = []
    total_geral = 0.0
    total_geral_pendentes = 0.0

    for fatura in faturas_map.values():
        fatura["total"] = round(fatura["total"], 2)
        fatura["total_pagas"] = round(fatura["total_pagas"], 2)
        fatura["total_pendentes"] = round(max(0.0, fatura["total_pendentes"]), 2)
        fatura["soma_estornos"] = round(fatura["soma_estornos"], 2)

        # 2. Se a fatura ainda não tem origem_oficial definida, busca na base de faturas oficiais
        if not fatura.get("origem_oficial"):
            try:
                comp_date = date.fromisoformat(fatura["competencia"])
                fatura_oficial = (
                    OpenFinanceFatura.query.join(OpenFinanceContaMap)
                    .filter(
                        OpenFinanceContaMap.forma_pagamento_id == fatura["forma_pagamento_id"],
                        OpenFinanceFatura.competencia == comp_date,
                    )
                    .first()
                )
                if fatura_oficial:
                    fatura["origem_oficial"] = True
                    fatura["total_lancamentos"] = fatura["total"]
                    fatura["valor_oficial"] = round(float(fatura_oficial.valor_total), 2)
                    fatura["valor_pago_oficial"] = round(float(fatura_oficial.valor_pago or 0.0), 2)
                    fatura["total"] = fatura["valor_oficial"]

                    if fatura_oficial.status == "PAGO" or fatura_oficial.valor_pago >= (fatura_oficial.valor_total - 0.05):
                        fatura["status_fatura"] = "Pago"
                        fatura["total_pagas"] = fatura["valor_oficial"]
                        fatura["total_pendentes"] = 0.0
                    elif fatura_oficial.valor_pago > 0:
                        fatura["status_fatura"] = "Parcial"
                        fatura["total_pagas"] = round(float(fatura_oficial.valor_pago), 2)
                        fatura["total_pendentes"] = round(max(0.0, fatura["valor_oficial"] - fatura["total_pagas"]), 2)
                    else:
                        fatura["status_fatura"] = "Pendente"
                        fatura["total_pendentes"] = fatura["valor_oficial"]
                        fatura["total_pagas"] = 0.0

                    if fatura_oficial.data_vencimento:
                        fatura["data_vencimento"] = fatura_oficial.data_vencimento.isoformat()
                        fatura["data_vencimento_label"] = fatura_oficial.data_vencimento.strftime("%d/%m/%Y")
                    if fatura_oficial.data_fechamento:
                        fatura["data_fechamento"] = fatura_oficial.data_fechamento.isoformat()
            except Exception as e_fo:
                pass

        if not fatura.get("status_fatura"):
            if fatura["total_pendentes"] <= 0.01:
                fatura["status_fatura"] = "Pago"
            elif fatura["total_pagas"] > 0:
                fatura["status_fatura"] = "Parcial"
            else:
                fatura["status_fatura"] = "Pendente"

        # Categorias resumo
        categorias_resumo = []
        tot_fat = fatura["total"] if fatura["total"] > 0 else 1.0
        for cat_nome, cat_val in sorted(fatura["categorias_contagem"].items(), key=lambda x: x[1], reverse=True):
            if cat_val != 0:
                categorias_resumo.append({
                    "categoria": cat_nome,
                    "total": round(cat_val, 2),
                    "percentual": round((cat_val / tot_fat) * 100, 1),
                })
        fatura["categorias_resumo"] = categorias_resumo
        del fatura["categorias_contagem"]

        # Dump dos itens
        fatura["transacoes"] = schemas.dump(fatura["items"])
        del fatura["items"]

        total_geral += fatura["total"]
        total_geral_pendentes += fatura["total_pendentes"]
        faturas_lista.append(fatura)

    # Ordenar faturas por data de vencimento e nome do cartão
    faturas_lista.sort(key=lambda f: (f["data_vencimento"] or "", f["forma_pagamento_nome"] or ""))

    payload_transacoes = schemas.dump(transacoes_filtradas)

    return jsonify({
        "transacoes": payload_transacoes,
        "faturas": faturas_lista,
        "total_geral": round(total_geral, 2),
        "total_geral_pendentes": round(total_geral_pendentes, 2),
    }), 200


@bp_transacoes.route("/quitar_fatura", methods=["POST"])
@jwt_required()
def quitar_fatura():
    """Marca todas as compras de uma fatura específica como Pago (ou Pendente)."""
    data = request.get_json() or {}
    forma_pagamento_id = data.get("forma_pagamento_id")
    competencia_str = data.get("competencia")
    novo_status = data.get("status", "Pago")

    if not forma_pagamento_id or not competencia_str:
        return jsonify({"erro": "forma_pagamento_id e competencia são obrigatórios"}), 400

    try:
        competencia_dt = datetime.strptime(competencia_str[:10], "%Y-%m-%d").date()
    except ValueError:
        return jsonify({"erro": "Formato de competência inválido (use YYYY-MM-DD)"}), 400

    transacoes = Transacao.query.filter(
        Transacao.forma_pagamento_id == forma_pagamento_id,
        Transacao.competencia_fatura == competencia_dt,
    ).all()

    for tx in transacoes:
        tx.status = novo_status

    # Sincroniza também a fatura oficial se existir
    fatura_oficial = (
        OpenFinanceFatura.query.join(OpenFinanceContaMap)
        .filter(
            OpenFinanceContaMap.forma_pagamento_id == forma_pagamento_id,
            OpenFinanceFatura.competencia == competencia_dt,
        )
        .first()
    )
    if fatura_oficial:
        if novo_status == "Pago":
            fatura_oficial.status = "PAGO"
            fatura_oficial.valor_pago = fatura_oficial.valor_total
        else:
            fatura_oficial.status = "ABERTO"
            fatura_oficial.valor_pago = 0.0

    db.session.commit()
    return jsonify({
        "message": f"Fatura atualizada para {novo_status} com sucesso!",
        "quantidade": len(transacoes),
        "status": novo_status,
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
