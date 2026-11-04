from flask import Blueprint, request, jsonify
from datetime import datetime, date
from calendar import monthrange
from dateutil.relativedelta import relativedelta
from sqlalchemy import func
from app import db
from app.models import Transacao, Categoria, FormaPagamento, OpenFinanceContaMap, OpenFinanceFatura
from flask_jwt_extended import jwt_required
from services.fatura_service import (
    calcular_competencia_fatura,
    calcular_vencimento_fatura,
)

bp_relatorios = Blueprint("relatorios", __name__)

MESES_PT = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
]


def _data_referencia_transacao(transacao, eh_cartao=False, dia_fechamento=None, dia_vencimento=None, usar_competencia=False):
    """Calcula a data de referência de uma transação para relatórios e matriz.

    Se eh_cartao:
      - base 'competencia' (usar_competencia=True): data de competência da fatura (dia 1 do ciclo de fechamento)
      - base 'data' / caixa (usar_competencia=False): data exata de vencimento do boleto da fatura
    Se não for cartão:
      - data da própria transação
    """
    if eh_cartao:
        dia_fech = dia_fechamento or 28
        dia_venc = dia_vencimento or 5
        comp = (
            getattr(transacao, "competencia_fatura", None)
            or calcular_competencia_fatura(transacao.data_transacao, dia_fech)
            or (date(transacao.data_transacao.year, transacao.data_transacao.month, 1) if transacao.data_transacao else None)
        )
        if usar_competencia:
            return comp or transacao.data_transacao
        else:
            venc = calcular_vencimento_fatura(comp, dia_fech, dia_venc)
            return venc or transacao.data_transacao
    return transacao.data_transacao


def _obter_transacoes_periodo(inicio_dt, fim_dt, tipo=None, status=None, apenas_cartao=None, base="data"):
    """Retorna lista de (Transacao, Categoria, FormaPagamento, data_efetiva) cuja data de referência cai entre inicio_dt e fim_dt."""
    usar_competencia = (base == "competencia")
    busca_ini = inicio_dt - relativedelta(months=2)
    busca_fim = fim_dt + relativedelta(months=1)

    query = (
        db.session.query(Transacao, Categoria, FormaPagamento)
        .outerjoin(Categoria, Transacao.categoria_id == Categoria.id)
        .outerjoin(FormaPagamento, Transacao.forma_pagamento_id == FormaPagamento.id)
        .filter(
            db.or_(
                Transacao.data_transacao.between(busca_ini, busca_fim),
                Transacao.competencia_fatura.between(busca_ini, busca_fim),
            )
        )
    )

    if tipo:
        query = query.filter(Transacao.tipo == tipo)
    if status:
        query = query.filter(Transacao.status == status)
    if apenas_cartao is True:
        query = query.filter(FormaPagamento.cartao_credito.is_(True))
    elif apenas_cartao is False:
        query = query.filter(db.or_(FormaPagamento.id.is_(None), FormaPagamento.cartao_credito.is_(False)))

    resultados = []
    for tx, cat, forma in query.all():
        eh_cartao = bool(forma and forma.cartao_credito)
        ref = _data_referencia_transacao(
            tx,
            eh_cartao=eh_cartao,
            dia_fechamento=getattr(forma, "dia_fechamento", None),
            dia_vencimento=getattr(forma, "dia_vencimento", None),
            usar_competencia=usar_competencia,
        )
        if ref and inicio_dt <= ref <= fim_dt:
            resultados.append((tx, cat, forma, ref))

    return resultados


# Resumo mensal: saldo diário e acúmulo de investimentos
@bp_relatorios.route("/resumo", methods=["GET"])
def resumo_mensal():
    ano = request.args.get("ano", type=int)
    mes = request.args.get("mes", type=int)
    if not ano or not mes:
        return jsonify({"error": "Informe ano e mes"}), 400

    num_dias = monthrange(ano, mes)[1]
    dias = [str(d).zfill(2) for d in range(1, num_dias + 1)]
    saldo = [0.0] * num_dias
    acum_invest = [0.0] * num_dias

    ini_mes = date(ano, mes, 1)
    fim_mes = date(ano, mes, num_dias)

    itens = _obter_transacoes_periodo(ini_mes, fim_mes, base="data")

    receitas_dia = [0.0] * num_dias
    despesas_dia = [0.0] * num_dias
    invest_dia = [0.0] * num_dias

    for tx, _, _, ref in itens:
        dia_idx = ref.day - 1
        val = float(tx.valor or 0)
        if tx.tipo == "Receita":
            receitas_dia[dia_idx] += val
        elif tx.tipo == "Despesa":
            despesas_dia[dia_idx] += val
        elif tx.tipo == "Investimento":
            invest_dia[dia_idx] += val

    total_invest = 0.0
    for d in range(num_dias):
        saldo[d] = round(receitas_dia[d] - despesas_dia[d], 2)
        total_invest += invest_dia[d]
        acum_invest[d] = round(total_invest, 2)

    return jsonify({
        "dias": dias,
        "receita": receitas_dia,
        "despesa": despesas_dia,
        "saldo": saldo,
        "acum_invest": acum_invest,
    })


@bp_relatorios.route("/evolucao_diaria", methods=["GET"])
@jwt_required()
def evolucao_diaria():
    """Retorna a evolução diária (receitas, despesas, saldo) de um mês específico."""
    hoje = date.today()
    ano = request.args.get("ano", type=int) or hoje.year
    mes = request.args.get("mes", type=int) or hoje.month
    base = (request.args.get("base") or "transacao").lower()

    if mes < 1 or mes > 12:
        return jsonify({"error": "Mês inválido (1-12)"}), 400

    num_dias = monthrange(ano, mes)[1]
    ini_mes = date(ano, mes, 1)
    fim_mes = date(ano, mes, num_dias)

    if base == "caixa":
        itens = _obter_transacoes_periodo(ini_mes, fim_mes, base="data")
        transacoes_com_data = [(tx, ref) for tx, _, _, ref in itens]
    elif base == "competencia":
        itens = _obter_transacoes_periodo(ini_mes, fim_mes, base="competencia")
        transacoes_com_data = [(tx, ref) for tx, _, _, ref in itens]
    else:
        # Padrão: base "transacao" (dia exato da compra / movimentação financeira)
        query = (
            db.session.query(Transacao)
            .filter(Transacao.data_transacao.between(ini_mes, fim_mes))
        )
        transacoes_com_data = [(tx, tx.data_transacao) for tx in query.all()]

    receitas_dia = [0.0] * num_dias
    despesas_dia = [0.0] * num_dias
    investimentos_dia = [0.0] * num_dias
    qtd_transacoes_dia = [0] * num_dias

    for tx, ref_date in transacoes_com_data:
        if not ref_date or not (ini_mes <= ref_date <= fim_mes):
            continue
        dia_idx = ref_date.day - 1
        raw_val = float(tx.valor_parcela if (tx.parcelado and tx.valor_parcela is not None) else (tx.valor or 0))

        if tx.tipo == "Receita":
            receitas_dia[dia_idx] += raw_val
        elif tx.tipo == "Despesa":
            despesas_dia[dia_idx] += raw_val
        elif tx.tipo == "Investimento":
            investimentos_dia[dia_idx] += raw_val
        qtd_transacoes_dia[dia_idx] += 1

    dias_dados = []
    total_receitas = 0.0
    total_despesas = 0.0
    total_investimentos = 0.0
    saldo_acumulado = 0.0

    for d in range(num_dias):
        dia_num = d + 1
        r = round(receitas_dia[d], 2)
        desp = round(despesas_dia[d], 2)
        inv = round(investimentos_dia[d], 2)
        s = round(r - desp, 2)
        saldo_acumulado = round(saldo_acumulado + s, 2)

        total_receitas += r
        total_despesas += desp
        total_investimentos += inv

        dias_dados.append({
            "dia": dia_num,
            "label": str(dia_num).zfill(2),
            "data": f"{ano}-{str(mes).zfill(2)}-{str(dia_num).zfill(2)}",
            "Receita": r,
            "Despesa": desp,
            "Saldo": s,
            "Investimento": inv,
            "SaldoAcumulado": saldo_acumulado,
            "qtd_transacoes": qtd_transacoes_dia[d],
        })

    return jsonify({
        "ano": ano,
        "mes": mes,
        "mes_nome": MESES_PT[mes - 1],
        "base": base,
        "dias": dias_dados,
        "total_receita": round(total_receitas, 2),
        "total_despesa": round(total_despesas, 2),
        "total_investimento": round(total_investimentos, 2),
        "total_saldo": round(total_receitas - total_despesas, 2),
    }), 200


# Totais por tipo em um período
@bp_relatorios.route("/totais", methods=["GET"])
def totais():
    inicio = request.args.get("inicio")
    fim = request.args.get("fim")
    base = (request.args.get("base") or "data").lower()

    if not (inicio and fim):
        query = db.session.query(Transacao.tipo, func.sum(Transacao.valor).label("total")).group_by(Transacao.tipo).all()
        return jsonify([{"tipo": tipo, "total": float(total)} for tipo, total in query]), 200

    try:
        inicio_dt = datetime.strptime(inicio, "%Y-%m-%d").date()
        fim_dt = datetime.strptime(fim, "%Y-%m-%d").date()
    except ValueError:
        return jsonify({"error": "Datas inválidas (use YYYY-MM-DD)"}), 400

    itens = _obter_transacoes_periodo(inicio_dt, fim_dt, base=base)
    totais_por_tipo = {}
    for tx, _, _, _ in itens:
        t = tx.tipo or "Outros"
        totais_por_tipo[t] = totais_por_tipo.get(t, 0.0) + float(tx.valor or 0)

    resultado = [{"tipo": tipo, "total": round(total, 2)} for tipo, total in totais_por_tipo.items()]
    return jsonify(resultado), 200


# Totais por categoria em um período
@bp_relatorios.route("/categorias", methods=["GET"])
def por_categoria():
    inicio = request.args.get("inicio")
    fim = request.args.get("fim")
    tipo = request.args.get("tipo")
    base = (request.args.get("base") or "data").lower()

    if not (inicio and fim):
        query = db.session.query(Categoria.nome, func.sum(Transacao.valor).label("total")).join(Categoria, Transacao.categoria_id == Categoria.id)
        if tipo:
            query = query.filter(Transacao.tipo == tipo)
        query = query.group_by(Categoria.nome).all()
        return jsonify([{"categoria": cat, "total": float(total)} for cat, total in query]), 200

    try:
        inicio_dt = datetime.strptime(inicio, "%Y-%m-%d").date()
        fim_dt = datetime.strptime(fim, "%Y-%m-%d").date()
    except ValueError:
        return jsonify({"error": "Datas inválidas (use YYYY-MM-DD)"}), 400

    itens = _obter_transacoes_periodo(inicio_dt, fim_dt, tipo=tipo, base=base)
    totais_cat = {}
    for tx, cat, _, _ in itens:
        nome_cat = cat.nome if cat else "Sem categoria"
        totais_cat[nome_cat] = totais_cat.get(nome_cat, 0.0) + float(tx.valor or 0)

    resultado = [{"categoria": cat, "total": round(total, 2)} for cat, total in sorted(totais_cat.items(), key=lambda x: x[1], reverse=True)]
    return jsonify(resultado), 200


# Totais por forma de pagamento em um período (ou geral)
@bp_relatorios.route("/formas_pagamento_totais", methods=["GET"])
def formas_pagamento_totais():
    inicio = request.args.get("inicio")
    fim = request.args.get("fim")
    base = (request.args.get("base") or "data").lower()

    if not (inicio and fim):
        query = db.session.query(FormaPagamento.nome.label("forma_pagamento"), func.sum(Transacao.valor).label("total")).join(FormaPagamento, Transacao.forma_pagamento_id == FormaPagamento.id).group_by(FormaPagamento.nome).order_by(FormaPagamento.nome.asc()).all()
        return jsonify([{"forma_pagamento": nome, "total": float(total)} for nome, total in query]), 200

    try:
        inicio_dt = datetime.strptime(inicio, "%Y-%m-%d").date()
        fim_dt = datetime.strptime(fim, "%Y-%m-%d").date()
    except ValueError:
        return jsonify({"error": "Datas inválidas (use YYYY-MM-DD)"}), 400

    itens = _obter_transacoes_periodo(inicio_dt, fim_dt, base=base)
    totais_forma = {}
    for tx, _, forma, _ in itens:
        nome_forma = forma.nome if forma else "Sem forma"
        totais_forma[nome_forma] = totais_forma.get(nome_forma, 0.0) + float(tx.valor or 0)

    resultado = [{"forma_pagamento": nome, "total": round(total, 2)} for nome, total in sorted(totais_forma.items(), key=lambda x: x[0])]
    return jsonify(resultado), 200


# Despesas por cartão de crédito (agrupado por cartão)
@bp_relatorios.route("/despesas_por_cartao", methods=["GET"])
def despesas_por_cartao():
    inicio = request.args.get("inicio")
    fim = request.args.get("fim")
    base = (request.args.get("base") or "data").lower()

    if not (inicio and fim):
        query = db.session.query(FormaPagamento.nome.label("cartao"), func.count(Transacao.id).label("qtd"), func.sum(Transacao.valor).label("total")).join(FormaPagamento, Transacao.forma_pagamento_id == FormaPagamento.id).filter(Transacao.tipo == "Despesa", FormaPagamento.cartao_credito.is_(True)).group_by(FormaPagamento.nome).order_by(FormaPagamento.nome.asc()).all()
        return jsonify([{"cartao": nome, "qtd": int(qtd), "total": float(total)} for nome, qtd, total in query]), 200

    try:
        inicio_dt = datetime.strptime(inicio, "%Y-%m-%d").date()
        fim_dt = datetime.strptime(fim, "%Y-%m-%d").date()
    except ValueError:
        return jsonify({"error": "Datas inválidas (use YYYY-MM-DD)"}), 400

    itens = _obter_transacoes_periodo(inicio_dt, fim_dt, tipo="Despesa", apenas_cartao=True, base=base)
    cartoes_map = {}
    for tx, _, forma, _ in itens:
        nome_cartao = forma.nome if forma else "Cartão de Crédito"
        if nome_cartao not in cartoes_map:
            cartoes_map[nome_cartao] = {"cartao": nome_cartao, "qtd": 0, "total": 0.0}
        cartoes_map[nome_cartao]["qtd"] += 1
        cartoes_map[nome_cartao]["total"] += float(tx.valor or 0)

    resultado = [{"cartao": v["cartao"], "qtd": v["qtd"], "total": round(v["total"], 2)} for v in sorted(cartoes_map.values(), key=lambda x: x["cartao"])]
    return jsonify(resultado), 200


def _parse_periodo(query):
    """Aplica filtro de período (inicio/fim) na query. Retorna (query, erro)."""
    inicio = request.args.get("inicio")
    fim = request.args.get("fim")
    if inicio and fim:
        try:
            inicio_dt = datetime.strptime(inicio, "%Y-%m-%d").date()
            fim_dt = datetime.strptime(fim, "%Y-%m-%d").date()
            return query.filter(Transacao.data_transacao.between(inicio_dt, fim_dt)), None
        except ValueError:
            return query, (jsonify({"error": "Datas inválidas (use YYYY-MM-DD)"}), 400)
    return query, None


# Maiores despesas individuais em um período
@bp_relatorios.route("/top_despesas", methods=["GET"])
def top_despesas():
    limite = request.args.get("limite", 20, type=int)
    limite = max(1, min(limite, 100))
    inicio = request.args.get("inicio")
    fim = request.args.get("fim")
    base = (request.args.get("base") or "data").lower()

    if not (inicio and fim):
        query = (
            db.session.query(Transacao, Categoria.nome, FormaPagamento.nome)
            .join(Categoria, Transacao.categoria_id == Categoria.id)
            .join(FormaPagamento, Transacao.forma_pagamento_id == FormaPagamento.id)
            .filter(Transacao.tipo == "Despesa")
            .order_by(Transacao.valor.desc())
            .limit(limite)
            .all()
        )
        return jsonify([
            {
                "id": t.id,
                "descricao": t.descricao,
                "categoria": categoria,
                "forma_pagamento": forma,
                "data": t.data_transacao.isoformat() if t.data_transacao else None,
                "status": t.status,
                "valor": float(t.valor),
            }
            for t, categoria, forma in query
        ]), 200

    try:
        inicio_dt = datetime.strptime(inicio, "%Y-%m-%d").date()
        fim_dt = datetime.strptime(fim, "%Y-%m-%d").date()
    except ValueError:
        return jsonify({"error": "Datas inválidas (use YYYY-MM-DD)"}), 400

    itens = _obter_transacoes_periodo(inicio_dt, fim_dt, tipo="Despesa", base=base)
    itens.sort(key=lambda x: float(x[0].valor or 0), reverse=True)
    top = itens[:limite]

    resultado = [
        {
            "id": t.id,
            "descricao": t.descricao,
            "categoria": cat.nome if cat else "Sem categoria",
            "forma_pagamento": forma.nome if forma else "Sem forma",
            "data": ref.isoformat() if ref else (t.data_transacao.isoformat() if t.data_transacao else None),
            "status": t.status,
            "valor": float(t.valor),
        }
        for t, cat, forma, ref in top
    ]
    return jsonify(resultado), 200


# Resumo de status (Pago x Pendente) em um período
@bp_relatorios.route("/status_periodo", methods=["GET"])
def status_periodo():
    inicio = request.args.get("inicio")
    fim = request.args.get("fim")
    base = (request.args.get("base") or "data").lower()

    if not (inicio and fim):
        query = db.session.query(Transacao.status, Transacao.tipo, func.count(Transacao.id).label("qtd"), func.sum(Transacao.valor).label("total")).group_by(Transacao.status, Transacao.tipo).all()
        resumo = [{"status": status, "tipo": tipo, "qtd": int(qtd), "total": float(total or 0)} for status, tipo, qtd, total in query]
        return jsonify({"resumo": resumo, "pendentes": []}), 200

    try:
        inicio_dt = datetime.strptime(inicio, "%Y-%m-%d").date()
        fim_dt = datetime.strptime(fim, "%Y-%m-%d").date()
    except ValueError:
        return jsonify({"error": "Datas inválidas (use YYYY-MM-DD)"}), 400

    itens = _obter_transacoes_periodo(inicio_dt, fim_dt, base=base)
    resumo_map = {}
    pendentes = []

    for t, cat, forma, ref in itens:
        chave = (t.status or "Pendente", t.tipo or "Outros")
        if chave not in resumo_map:
            resumo_map[chave] = {"status": chave[0], "tipo": chave[1], "qtd": 0, "total": 0.0}
        resumo_map[chave]["qtd"] += 1
        resumo_map[chave]["total"] += float(t.valor or 0)

        if (t.status or "").lower() == "pendente":
            pendentes.append({
                "id": t.id,
                "descricao": t.descricao,
                "tipo": t.tipo,
                "categoria": cat.nome if cat else "Sem categoria",
                "forma_pagamento": forma.nome if forma else "Sem forma",
                "data": ref.isoformat() if ref else (t.data_transacao.isoformat() if t.data_transacao else None),
                "valor": float(t.valor),
            })

    resumo = [{"status": v["status"], "tipo": v["tipo"], "qtd": v["qtd"], "total": round(v["total"], 2)} for v in resumo_map.values()]
    pendentes.sort(key=lambda x: x["data"] or "")

    return jsonify({"resumo": resumo, "pendentes": pendentes[:200]}), 200


# Parcelamentos com parcelas futuras (compromissos já assumidos)
@bp_relatorios.route("/parcelamentos_futuros", methods=["GET"])
def parcelamentos_futuros():
    import re
    from dateutil.relativedelta import relativedelta

    hoje = datetime.now().date()
    mes_atual = date(hoje.year, hoje.month, 1)

    txs = (
        Transacao.query.join(FormaPagamento)
        .filter(
            Transacao.parcelado.is_(True),
            Transacao.tipo == "Despesa",
        )
        .order_by(Transacao.data_transacao.asc(), Transacao.id.asc())
        .all()
    )

    import unicodedata

    def _chave_parcelamento(t):
        d = (
            re.sub(r"\s*[\(\[]?\s*\b\d{1,2}\s*[\/\-]\s*\d{1,2}\b\s*[\)\]]?", "", t.descricao or "")
            .strip()
            .rstrip("-")
            .strip()
            .lower()
        )
        d = unicodedata.normalize("NFKD", d).encode("ascii", "ignore").decode("ascii")
        d = re.sub(r"^pix\s+no\s+credito\s*-\s*", "", d)
        d = re.sub(r"^parcelamento\s+de\s+compra\s*-\s*.*", "parcelamento-de-compra", d)
        if d in ("amazon-br", "amazon br"):
            d = "amazon"
        d = re.sub(r"[^a-z0-9]+", "-", d).strip("-")
        fp = t.forma_pagamento
        eh_cartao = bool(fp and fp.cartao_credito)
        dia_fech = getattr(fp, "dia_fechamento", 28) or 28
        dia_venc = getattr(fp, "dia_vencimento", 5) or 5
        if eh_cartao:
            comp = (
                t.competencia_fatura
                or calcular_competencia_fatura(t.data_transacao, dia_fech, dia_venc)
                or (t.data_transacao.replace(day=1) if t.data_transacao else mes_atual)
            )
        else:
            comp = date(t.data_transacao.year, t.data_transacao.month, 1) if t.data_transacao else mes_atual
        mes_1 = (comp - relativedelta(months=(t.parcela_atual or 1) - 1)).strftime("%Y-%m")
        p_tot = t.total_parcelas or 1
        if d.startswith("sky-airli") and p_tot == 3 and mes_1 == "2026-01":
            return "sky-airli5580795067-3x-2026-01"
        val_bucket = int(round(float(t.valor_parcela or t.valor or 0) / 2.0) * 2)
        return f"{d}-{p_tot}x-{mes_1}-v{val_bucket}"

    grupos_dict = {}
    for t in txs:
        chave = _chave_parcelamento(t)
        grupos_dict.setdefault(chave, []).append(t)

    resultado_grupos = []
    mensal_map = {}
    total_restante = 0.0
    qtd_parcelas_total = 0

    for chave, lista_tx in grupos_dict.items():
        fp = lista_tx[0].forma_pagamento
        eh_cartao = bool(fp and fp.cartao_credito)
        dia_fech = getattr(fp, "dia_fechamento", 28) or 28
        dia_venc = getattr(fp, "dia_vencimento", 5) or 5
        forma_nome = fp.nome if fp else "Cartão"

        # Classifica transações entre passadas/atuais (fatura atual ou anterior) e futuras (faturas posteriores)
        txs_passadas_ou_atuais = []
        txs_futuras_db = []
        txs_futuras_por_num = {}

        for t in lista_tx:
            if eh_cartao:
                comp = (
                    t.competencia_fatura
                    or calcular_competencia_fatura(t.data_transacao, dia_fech, dia_venc)
                    or (t.data_transacao.replace(day=1) if t.data_transacao else mes_atual)
                )
                if comp <= mes_atual:
                    txs_passadas_ou_atuais.append((t, comp))
                else:
                    txs_futuras_db.append((t, comp))
                    if t.parcela_atual:
                        txs_futuras_por_num[t.parcela_atual] = (t, comp)
            else:
                d = t.data_transacao or hoje
                ref_mes = date(d.year, d.month, 1)
                if ref_mes <= mes_atual:
                    txs_passadas_ou_atuais.append((t, d))
                else:
                    txs_futuras_db.append((t, d))
                    if t.parcela_atual:
                        txs_futuras_por_num[t.parcela_atual] = (t, d)

        p_total = max([t.total_parcelas for t in lista_tx if t.total_parcelas] or [1])

        # Determina a parcela atual e base para projeção
        if txs_passadas_ou_atuais:
            tx_atual, ref_atual = max(
                txs_passadas_ou_atuais,
                key=lambda x: (x[0].parcela_atual or 1, x[0].data_transacao or date.min),
            )
            p_atual = tx_atual.parcela_atual or 1
            base_tx = tx_atual
            base_comp = ref_atual if eh_cartao else date(ref_atual.year, ref_atual.month, 1)
            base_data = tx_atual.data_transacao or hoje
        elif txs_futuras_db:
            tx_primeira, ref_primeira = min(
                txs_futuras_db,
                key=lambda x: (x[0].parcela_atual or 1, x[0].data_transacao or date.max),
            )
            p_atual = max(0, (tx_primeira.parcela_atual or 1) - 1)
            base_tx = tx_primeira
            base_comp = mes_atual
            base_data = hoje
        else:
            continue

        valor_parc = float(base_tx.valor_parcela or base_tx.valor or 0.0)

        # Coleta ou projeta as parcelas futuras: de p_atual + 1 até p_total
        parcelas_futuras_info = []
        for i in range(p_atual + 1, p_total + 1):
            if i in txs_futuras_por_num:
                t_fut, comp_fut = txs_futuras_por_num[i]
                v_parc = float(t_fut.valor_parcela or t_fut.valor or valor_parc)
                if eh_cartao:
                    d_parc = calcular_vencimento_fatura(comp_fut, dia_fech, dia_venc) or t_fut.data_transacao
                else:
                    d_parc = t_fut.data_transacao or (comp_fut if isinstance(comp_fut, date) else hoje)
            else:
                offset = i - p_atual
                v_parc = valor_parc
                if eh_cartao:
                    mes_fut = base_comp + relativedelta(months=offset)
                    if mes_fut <= mes_atual:
                        continue
                    d_parc = calcular_vencimento_fatura(mes_fut, dia_fech, dia_venc) or date(
                        mes_fut.year, mes_fut.month, min(dia_venc, 28)
                    )
                else:
                    d_parc = base_data + relativedelta(months=offset)
                    if date(d_parc.year, d_parc.month, 1) <= mes_atual:
                        continue

            parcelas_futuras_info.append({
                "num": i,
                "data": d_parc,
                "valor": v_parc,
            })

        if not parcelas_futuras_info:
            continue

        valor_restante_grupo = sum(p["valor"] for p in parcelas_futuras_info)
        total_restante += valor_restante_grupo
        qtd_parcelas_total += len(parcelas_futuras_info)

        proxima_data = parcelas_futuras_info[0]["data"].isoformat()
        ultima_data = parcelas_futuras_info[-1]["data"].isoformat()

        # Limpar descrição para remover sufixos de parcela na exibição da tabela
        desc_limpa = (
            re.sub(r"\s*[\(\[]?\s*\b\d{1,2}\s*[\/\-]\s*\d{1,2}\b\s*[\)\]]?", "", base_tx.descricao or "")
            .strip()
            .rstrip("-")
            .strip()
            or base_tx.descricao
        )

        resultado_grupos.append({
            "descricao": desc_limpa,
            "forma_pagamento": forma_nome,
            "total_parcelas": p_total,
            "parcela_atual": p_atual,
            "proxima_parcela": p_atual + 1,
            "parcelas_restantes": len(parcelas_futuras_info),
            "valor_parcela": round(valor_parc, 2),
            "valor_restante": round(valor_restante_grupo, 2),
            "proxima_data": proxima_data,
            "ultima_data": ultima_data,
        })

        for pf in parcelas_futuras_info:
            mes_chave = pf["data"].strftime("%Y-%m")
            item_m = mensal_map.setdefault(
                mes_chave, {"mes": mes_chave, "qtd": 0, "total": 0.0, "itens": []}
            )
            item_m["qtd"] += 1
            item_m["total"] = round(item_m["total"] + pf["valor"], 2)
            item_m["itens"].append({
                "descricao": desc_limpa,
                "forma_pagamento": forma_nome,
                "numero_parcela": pf["num"],
                "total_parcelas": p_total,
                "valor": round(pf["valor"], 2),
                "data_vencimento": pf["data"].isoformat(),
            })

    resultado_grupos.sort(key=lambda g: g["valor_restante"], reverse=True)
    mensal_lista = sorted(mensal_map.values(), key=lambda m: m["mes"])
    for m in mensal_lista:
        m["itens"].sort(key=lambda x: (x["data_vencimento"], -x["valor"]))

    return jsonify({
        "grupos": resultado_grupos,
        "mensal": mensal_lista,
        "total_restante": round(total_restante, 2),
        "qtd_parcelas": qtd_parcelas_total,
        "qtd_grupos": len(resultado_grupos),
    }), 200


# Resumo anual
@bp_relatorios.route("/sumario_anual", methods=["GET"])
def sumario_anual():
    ano = request.args.get("ano", datetime.now().year)
    try:
        ano = int(ano)
    except Exception:
        ano = datetime.now().year

    matriz = _calcular_matriz(ano, "categoria", False, None, "categoria")
    sumario = matriz["sumario"]
    totais = sumario["totais"]

    return jsonify({
        "meses": MESES_PT,
        "receita": sumario["receita"],
        "despesa": sumario["despesa"],
        "investimento": sumario["investimento"],
        "sobrou": sumario["saldo"],
        "total_receita": totais["receita"],
        "total_despesa": totais["despesa"],
        "total_investimento": totais["investimento"],
        "total_sobrou": totais["saldo"],
    })


MESES_PT = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
]

TIPOS_MATRIZ = ["Receita", "Despesa", "Investimento"]

# Seção sintética que agrupa as despesas de cartão de crédito por cartão
SECAO_CARTOES = "Cartoes"

# Máximo de linhas detalhadas por seção; o excedente é somado em "Outros"
LIMITE_LINHAS_SECAO = 60


def _zeros():
    return [0.0] * 12


def _mes_referencia(transacao, usar_competencia, eh_cartao, dia_fechamento=None, dia_vencimento=None):
    """Define em qual mês a transação será posicionada na matriz."""
    return _data_referencia_transacao(
        transacao,
        eh_cartao=eh_cartao,
        dia_fechamento=dia_fechamento,
        dia_vencimento=dia_vencimento,
        usar_competencia=usar_competencia,
    )


def _arredondar_linha(linha):
    return {
        "chave": linha["chave"],
        "categoria_id": linha["categoria_id"],
        "valores": [round(v, 2) for v in linha["valores"]],
        "total": round(linha["total"], 2),
    }


def _montar_secao(mapa):
    linhas = sorted(mapa.values(), key=lambda item: item["total"], reverse=True)
    if len(linhas) <= LIMITE_LINHAS_SECAO:
        return [_arredondar_linha(linha) for linha in linhas]

    principais = linhas[:LIMITE_LINHAS_SECAO]
    restantes = linhas[LIMITE_LINHAS_SECAO:]
    outros = {"chave": f"Outros ({len(restantes)})", "categoria_id": None, "valores": _zeros(), "total": 0.0}
    for linha in restantes:
        for i in range(12):
            outros["valores"][i] += linha["valores"][i]
        outros["total"] += linha["total"]
    return [_arredondar_linha(linha) for linha in principais] + [_arredondar_linha(outros)]


def _calcular_matriz(ano, agrupar, usar_competencia, status, cartoes_modo):
    """Agrega as transações de um ano em sumário mensal + seções detalhadas."""
    inicio_janela = datetime(ano - 1, 1, 1).date()
    fim_janela = datetime(ano + 1, 12, 31).date()

    query = (
        db.session.query(
            Transacao.tipo,
            Transacao.descricao,
            Transacao.valor,
            Transacao.data_transacao,
            Transacao.competencia_fatura,
            Transacao.categoria_id,
            Categoria.nome.label("categoria_nome"),
            FormaPagamento.cartao_credito.label("eh_cartao"),
            FormaPagamento.nome.label("forma_nome"),
            FormaPagamento.dia_fechamento.label("dia_fechamento"),
            FormaPagamento.dia_vencimento.label("dia_vencimento"),
        )
        .outerjoin(Categoria, Transacao.categoria_id == Categoria.id)
        .outerjoin(FormaPagamento, Transacao.forma_pagamento_id == FormaPagamento.id)
        .filter(
            db.or_(
                Transacao.data_transacao.between(inicio_janela, fim_janela),
                Transacao.competencia_fatura.between(inicio_janela, fim_janela),
            )
        )
    )

    if status:
        query = query.filter(Transacao.status == status)

    sumario = {tipo: _zeros() for tipo in TIPOS_MATRIZ}
    secoes = {tipo: {} for tipo in TIPOS_MATRIZ}
    secoes[SECAO_CARTOES] = {}

    rows_all = query.all()

    for row in rows_all:
        if row.tipo not in sumario:
            continue

        referencia = _mes_referencia(
            row,
            usar_competencia=usar_competencia,
            eh_cartao=bool(row.eh_cartao),
            dia_fechamento=row.dia_fechamento,
            dia_vencimento=row.dia_vencimento,
        )
        if not referencia or referencia.year != ano:
            continue

        indice = referencia.month - 1
        valor = float(row.valor or 0)

        sumario[row.tipo][indice] += valor

        # Despesas no cartão podem ser agrupadas em um bloco próprio
        no_bloco_cartoes = bool(row.eh_cartao) and row.tipo == "Despesa" and cartoes_modo == "separado"

        if no_bloco_cartoes:
            destino = secoes[SECAO_CARTOES]
            chave = row.forma_nome or "Cartão de crédito"
            categoria_id = None
        else:
            destino = secoes[row.tipo]
            if agrupar == "descricao":
                chave = (row.descricao or "Sem descrição").strip() or "Sem descrição"
                categoria_id = None
            else:
                chave = row.categoria_nome or "Sem categoria"
                categoria_id = row.categoria_id

        linha = destino.get(chave)
        if linha is None:
            linha = {"chave": chave, "categoria_id": categoria_id, "valores": _zeros(), "total": 0.0}
            destino[chave] = linha

        linha["valores"][indice] += valor
        linha["total"] += valor

    # 2. Incorpora faturas oficiais de cartão do Open Finance no ano
    faturas_oficiais_ano = (
        OpenFinanceFatura.query.join(OpenFinanceContaMap)
        .join(FormaPagamento, OpenFinanceContaMap.forma_pagamento_id == FormaPagamento.id)
        .filter(
            FormaPagamento.ativo.is_(True),
            db.extract('year', OpenFinanceFatura.competencia) == ano
        )
        .all()
    )

    for fo in faturas_oficiais_ano:
        forma = fo.conta_map.forma_pagamento if fo.conta_map else None
        if not forma:
            continue
        mes_idx = fo.competencia.month - 1
        val_oficial = float(fo.valor_total)

        if cartoes_modo == "separado":
            chave = forma.nome or "Cartão de crédito"
            linha_cartao = secoes[SECAO_CARTOES].get(chave)
            if linha_cartao is None:
                linha_cartao = {"chave": chave, "categoria_id": None, "valores": _zeros(), "total": 0.0}
                secoes[SECAO_CARTOES][chave] = linha_cartao

            # Ajusta para o valor oficial da fatura caso os lançamentos individuais tenham divergência ou não existam
            diferenca = val_oficial - linha_cartao["valores"][mes_idx]
            if abs(diferenca) > 0.01:
                linha_cartao["valores"][mes_idx] += diferenca
                linha_cartao["total"] += diferenca
                sumario["Despesa"][mes_idx] += diferenca
        else:
            # Modo categoria: se o mês ainda não tem transações individuais deste cartão,
            # inclui a fatura oficial consolidada para que relatórios e dashboard não fiquem vazios
            gastos_cartao_mes = sum(
                float(r.valor or 0) for r in rows_all
                if bool(r.eh_cartao) and r.forma_nome == forma.nome and (
                    (_mes_referencia(r, usar_competencia, True, r.dia_fechamento, r.dia_vencimento) or date.min).month - 1 == mes_idx
                )
            )
            if gastos_cartao_mes <= 0.01 and val_oficial > 0:
                chave_cat = f"Fatura {forma.nome}"
                linha_fat = secoes["Despesa"].get(chave_cat)
                if linha_fat is None:
                    linha_fat = {"chave": chave_cat, "categoria_id": None, "valores": _zeros(), "total": 0.0}
                    secoes["Despesa"][chave_cat] = linha_fat
                linha_fat["valores"][mes_idx] += val_oficial
                linha_fat["total"] += val_oficial
                sumario["Despesa"][mes_idx] += val_oficial

    receita = [round(v, 2) for v in sumario["Receita"]]
    despesa = [round(v, 2) for v in sumario["Despesa"]]
    investimento = [round(v, 2) for v in sumario["Investimento"]]
    saldo = [round(receita[i] - despesa[i], 2) for i in range(12)]

    return {
        "sumario": {
            "receita": receita,
            "despesa": despesa,
            "investimento": investimento,
            "saldo": saldo,
            "totais": {
                "receita": round(sum(receita), 2),
                "despesa": round(sum(despesa), 2),
                "investimento": round(sum(investimento), 2),
                "saldo": round(sum(saldo), 2),
            },
        },
        "secoes": {
            **{tipo: _montar_secao(secoes[tipo]) for tipo in TIPOS_MATRIZ},
            SECAO_CARTOES: _montar_secao(secoes[SECAO_CARTOES]),
        },
    }


def _variacao(atual, anterior):
    """Variação percentual protegida contra divisão por zero."""
    if not anterior:
        return None
    return round(((atual - anterior) / abs(anterior)) * 100, 1)


def _meses_realizados(ano):
    """Quantos meses do ano já se encerraram (ou 12, se for ano passado)."""
    hoje = datetime.now().date()
    if ano < hoje.year:
        return 12
    if ano > hoje.year:
        return 0
    return hoje.month


def _calcular_projecao(matriz, ano):
    """Projeta o fechamento do ano com base na média dos meses realizados."""
    realizados = _meses_realizados(ano)
    if realizados == 0 or realizados >= 12:
        return None

    sumario = matriz["sumario"]
    projecao = {"meses_realizados": realizados}

    for chave in ("receita", "despesa", "investimento"):
        serie = sumario[chave]
        realizado = sum(serie[:realizados])
        # Já existem lançamentos futuros (pendentes) registrados no sistema
        agendado = sum(serie[realizados:])
        media = realizado / realizados if realizados else 0
        # Usa o maior entre o já agendado e a média histórica de cada mês futuro
        estimado_restante = sum(max(serie[i], media) for i in range(realizados, 12))

        projecao[chave] = {
            "realizado": round(realizado, 2),
            "agendado": round(agendado, 2),
            "media_mensal": round(media, 2),
            "projetado": round(realizado + estimado_restante, 2),
        }

    projecao["saldo"] = {
        "projetado": round(projecao["receita"]["projetado"] - projecao["despesa"]["projetado"], 2),
    }

    return projecao


def _gerar_insights(matriz, anterior, ano):
    """Insights determinísticos (sem IA) sobre o comportamento financeiro."""
    insights = []
    sumario = matriz["sumario"]
    totais = sumario["totais"]
    realizados = _meses_realizados(ano)

    # 1) Saldo do período
    if totais["saldo"] > 0:
        taxa = (totais["saldo"] / totais["receita"] * 100) if totais["receita"] else 0
        insights.append({
            "tipo": "positivo",
            "titulo": "Saldo positivo no ano",
            "texto": f"Você guardou {_moeda(totais['saldo'])}, o equivalente a {taxa:.0f}% da sua receita.",
        })
    elif totais["saldo"] < 0:
        insights.append({
            "tipo": "alerta",
            "titulo": "Saldo negativo no ano",
            "texto": f"As despesas superaram as receitas em {_moeda(abs(totais['saldo']))}.",
        })

    # 2) Comparação com o ano anterior
    if anterior:
        var_despesa = _variacao(totais["despesa"], anterior["sumario"]["totais"]["despesa"])
        if var_despesa is not None and abs(var_despesa) >= 5:
            insights.append({
                "tipo": "alerta" if var_despesa > 0 else "positivo",
                "titulo": f"Despesas {'subiram' if var_despesa > 0 else 'caíram'} {abs(var_despesa):.0f}%",
                "texto": f"Comparado a {ano - 1}, você está gastando {_moeda(abs(totais['despesa'] - anterior['sumario']['totais']['despesa']))} {'a mais' if var_despesa > 0 else 'a menos'}.",
            })

    # 3) Maior categoria de despesa
    despesas = matriz["secoes"]["Despesa"]
    if despesas:
        maior = despesas[0]
        fatia = (maior["total"] / totais["despesa"] * 100) if totais["despesa"] else 0
        insights.append({
            "tipo": "info",
            "titulo": f"Maior gasto: {maior['chave']}",
            "texto": f"Representa {fatia:.0f}% das suas despesas, somando {_moeda(maior['total'])}.",
        })

    # 4) Categoria que mais cresceu no mês corrente vs média dos meses anteriores
    if 2 <= realizados <= 12:
        atual = realizados - 1
        melhor_alta = None
        for linha in despesas:
            valores = linha["valores"]
            media_anterior = sum(valores[:atual]) / atual if atual else 0
            if media_anterior < 100 or valores[atual] <= 0:
                continue
            variacao = _variacao(valores[atual], media_anterior)
            if variacao is None or variacao < 20:
                continue
            if melhor_alta is None or variacao > melhor_alta[1]:
                melhor_alta = (linha["chave"], variacao, valores[atual])
        if melhor_alta:
            nome, variacao, valor = melhor_alta
            insights.append({
                "tipo": "alerta",
                "titulo": f"{nome} subiu {variacao:.0f}%",
                "texto": f"Em {MESES_PT[atual]} somou {_moeda(valor)}, acima da sua média mensal.",
            })

    # 5) Mês de maior gasto
    despesa_mensal = sumario["despesa"]
    if any(despesa_mensal):
        pico = max(range(12), key=lambda i: despesa_mensal[i])
        insights.append({
            "tipo": "info",
            "titulo": f"Mês mais caro: {MESES_PT[pico]}",
            "texto": f"As despesas chegaram a {_moeda(despesa_mensal[pico])}.",
        })

    # 6) Taxa de investimento
    if totais["investimento"] > 0 and totais["receita"] > 0:
        taxa = totais["investimento"] / totais["receita"] * 100
        insights.append({
            "tipo": "positivo" if taxa >= 10 else "info",
            "titulo": f"Você investiu {taxa:.1f}% da receita",
            "texto": f"Total aportado no ano: {_moeda(totais['investimento'])}.",
        })

    return insights


def _moeda(valor):
    texto = f"{abs(valor):,.2f}".replace(",", "_").replace(".", ",").replace("_", ".")
    sinal = "-" if valor < 0 else ""
    return f"{sinal}R$ {texto}"


@bp_relatorios.route("/matriz_anual", methods=["GET"])
@jwt_required()
def matriz_anual():
    """Planilha anual: linhas por categoria/descrição x colunas por mês."""
    ano = request.args.get("ano", type=int) or datetime.now().year

    agrupar = (request.args.get("agrupar") or "categoria").lower()
    if agrupar not in ("categoria", "descricao"):
        agrupar = "categoria"

    base = (request.args.get("base") or "data").lower()
    usar_competencia = base == "competencia"

    status = request.args.get("status")
    if status not in ("Pago", "Pendente"):
        status = None

    # separado: despesas de cartão viram um bloco próprio, por cartão (padrão)
    # categoria: despesas de cartão entram na quebra normal por categoria
    cartoes_modo = (request.args.get("cartoes") or "separado").lower()
    if cartoes_modo not in ("separado", "categoria"):
        cartoes_modo = "separado"

    comparar = (request.args.get("comparar") or "").lower() in ("1", "true", "sim")

    matriz = _calcular_matriz(ano, agrupar, usar_competencia, status, cartoes_modo)

    anterior = None
    if comparar:
        anterior = _calcular_matriz(ano - 1, agrupar, usar_competencia, status, cartoes_modo)

    resposta = {
        "ano": ano,
        "agrupar": agrupar,
        "base": base,
        "cartoes": cartoes_modo,
        "meses": MESES_PT,
        "sumario": matriz["sumario"],
        "secoes": matriz["secoes"],
        "projecao": _calcular_projecao(matriz, ano),
        "insights": _gerar_insights(matriz, anterior, ano),
    }

    if anterior:
        resposta["comparativo"] = {
            "ano": ano - 1,
            "sumario": anterior["sumario"],
            "variacoes": {
                chave: _variacao(matriz["sumario"]["totais"][chave], anterior["sumario"]["totais"][chave])
                for chave in ("receita", "despesa", "investimento", "saldo")
            },
        }

    return jsonify(resposta), 200
