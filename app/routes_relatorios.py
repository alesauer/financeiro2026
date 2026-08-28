from flask import Blueprint, request, jsonify
from datetime import datetime
from sqlalchemy import func
from app import db
from app.models import Transacao, Categoria, FormaPagamento
from flask_jwt_extended import jwt_required

bp_relatorios = Blueprint("relatorios", __name__)

# Resumo mensal: saldo diário e acúmulo de investimentos
@bp_relatorios.route("/resumo", methods=["GET"])
def resumo_mensal():
    ano = request.args.get("ano", type=int)
    mes = request.args.get("mes", type=int)
    if not ano or not mes:
        return jsonify({"error": "Informe ano e mes"}), 400
    from calendar import monthrange
    dias = [str(d).zfill(2) for d in range(1, monthrange(ano, mes)[1]+1)]
    saldo = []
    acum_invest = []
    total_invest = 0
    for dia in range(1, monthrange(ano, mes)[1]+1):
        ini = datetime(ano, mes, dia)
        fim = datetime(ano, mes, dia)
        receita = db.session.query(func.sum(Transacao.valor)).filter(
            Transacao.tipo == "Receita",
            Transacao.data_transacao.between(ini, fim)
        ).scalar() or 0
        despesa = db.session.query(func.sum(Transacao.valor)).filter(
            Transacao.tipo == "Despesa",
            Transacao.data_transacao.between(ini, fim)
        ).scalar() or 0
        investimento = db.session.query(func.sum(Transacao.valor)).filter(
            Transacao.tipo == "Investimento",
            Transacao.data_transacao.between(ini, fim)
        ).scalar() or 0
        saldo.append(float(receita) - float(despesa))
        total_invest += float(investimento)
        acum_invest.append(total_invest)
    return jsonify({
        "dias": dias,
        "saldo": saldo,
        "acum_invest": acum_invest
    })

# Totais por tipo em um período
@bp_relatorios.route("/totais", methods=["GET"])
def totais():
    inicio = request.args.get("inicio")
    fim = request.args.get("fim")

    query = db.session.query(
        Transacao.tipo,
        func.sum(Transacao.valor).label("total")
    )

    if inicio and fim:
        try:
            inicio_dt = datetime.strptime(inicio, "%Y-%m-%d").date()
            fim_dt = datetime.strptime(fim, "%Y-%m-%d").date()
            query = query.filter(Transacao.data_transacao.between(inicio_dt, fim_dt))
        except ValueError:
            return jsonify({"error": "Datas inválidas (use YYYY-MM-DD)"}), 400

    query = query.group_by(Transacao.tipo).all()
    resultado = [{ "tipo": tipo, "total": float(total) } for tipo, total in query]
    return jsonify(resultado), 200

# (fim do arquivo)

# Totais por categoria em um período
@bp_relatorios.route("/categorias", methods=["GET"])
def por_categoria():
    inicio = request.args.get("inicio")
    fim = request.args.get("fim")

    tipo = request.args.get("tipo")
    query = db.session.query(
        Categoria.nome,
        func.sum(Transacao.valor).label("total")
    ).join(Categoria, Transacao.categoria_id == Categoria.id)

    if inicio and fim:
        try:
            inicio_dt = datetime.strptime(inicio, "%Y-%m-%d").date()
            fim_dt = datetime.strptime(fim, "%Y-%m-%d").date()
            query = query.filter(Transacao.data_transacao.between(inicio_dt, fim_dt))
        except ValueError:
            return jsonify({"error": "Datas inválidas (use YYYY-MM-DD)"}), 400

    if tipo:
        query = query.filter(Transacao.tipo == tipo)

    query = query.group_by(Categoria.nome).all()
    resultado = [{ "categoria": cat, "total": float(total) } for cat, total in query]
    return jsonify(resultado), 200

# Totais por forma de pagamento em um período (ou geral)
@bp_relatorios.route("/formas_pagamento_totais", methods=["GET"])
def formas_pagamento_totais():
    inicio = request.args.get("inicio")
    fim = request.args.get("fim")

    query = db.session.query(
        FormaPagamento.nome.label("forma_pagamento"),
        func.sum(Transacao.valor).label("total")
    ).join(FormaPagamento, Transacao.forma_pagamento_id == FormaPagamento.id)

    if inicio and fim:
        try:
            inicio_dt = datetime.strptime(inicio, "%Y-%m-%d").date()
            fim_dt = datetime.strptime(fim, "%Y-%m-%d").date()
            query = query.filter(Transacao.data_transacao.between(inicio_dt, fim_dt))
        except ValueError:
            return jsonify({"error": "Datas inválidas (use YYYY-MM-DD)"}), 400

    query = query.group_by(FormaPagamento.nome).order_by(FormaPagamento.nome.asc()).all()
    resultado = [{"forma_pagamento": nome, "total": float(total)} for nome, total in query]
    return jsonify(resultado), 200

# Despesas por cartão de crédito (agrupado por cartão)
@bp_relatorios.route("/despesas_por_cartao", methods=["GET"])
def despesas_por_cartao():
    inicio = request.args.get("inicio")
    fim = request.args.get("fim")

    query = db.session.query(
        FormaPagamento.nome.label("cartao"),
        func.count(Transacao.id).label("qtd"),
        func.sum(Transacao.valor).label("total")
    ).join(FormaPagamento, Transacao.forma_pagamento_id == FormaPagamento.id)

    query = query.filter(
        Transacao.tipo == "Despesa",
        FormaPagamento.cartao_credito.is_(True)
    )

    if inicio and fim:
        try:
            inicio_dt = datetime.strptime(inicio, "%Y-%m-%d").date()
            fim_dt = datetime.strptime(fim, "%Y-%m-%d").date()
            query = query.filter(Transacao.data_transacao.between(inicio_dt, fim_dt))
        except ValueError:
            return jsonify({"error": "Datas inválidas (use YYYY-MM-DD)"}), 400

    query = query.group_by(FormaPagamento.nome).order_by(FormaPagamento.nome.asc()).all()
    resultado = [{"cartao": nome, "qtd": int(qtd), "total": float(total)} for nome, qtd, total in query]
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

    query = (
        db.session.query(Transacao, Categoria.nome, FormaPagamento.nome)
        .join(Categoria, Transacao.categoria_id == Categoria.id)
        .join(FormaPagamento, Transacao.forma_pagamento_id == FormaPagamento.id)
        .filter(Transacao.tipo == "Despesa")
    )
    query, erro = _parse_periodo(query)
    if erro:
        return erro

    itens = query.order_by(Transacao.valor.desc()).limit(limite).all()
    resultado = [
        {
            "id": t.id,
            "descricao": t.descricao,
            "categoria": categoria,
            "forma_pagamento": forma,
            "data": t.data_transacao.isoformat() if t.data_transacao else None,
            "status": t.status,
            "valor": float(t.valor),
        }
        for t, categoria, forma in itens
    ]
    return jsonify(resultado), 200

# Resumo de status (Pago x Pendente) em um período
@bp_relatorios.route("/status_periodo", methods=["GET"])
def status_periodo():
    query = db.session.query(
        Transacao.status,
        Transacao.tipo,
        func.count(Transacao.id).label("qtd"),
        func.sum(Transacao.valor).label("total"),
    )
    query, erro = _parse_periodo(query)
    if erro:
        return erro

    resumo = [
        {"status": status, "tipo": tipo, "qtd": int(qtd), "total": float(total or 0)}
        for status, tipo, qtd, total in query.group_by(Transacao.status, Transacao.tipo).all()
    ]

    pendentes_query = (
        db.session.query(Transacao, Categoria.nome, FormaPagamento.nome)
        .join(Categoria, Transacao.categoria_id == Categoria.id)
        .join(FormaPagamento, Transacao.forma_pagamento_id == FormaPagamento.id)
        .filter(Transacao.status == "Pendente")
    )
    pendentes_query, erro = _parse_periodo(pendentes_query)
    if erro:
        return erro

    pendentes = [
        {
            "id": t.id,
            "descricao": t.descricao,
            "tipo": t.tipo,
            "categoria": categoria,
            "forma_pagamento": forma,
            "data": t.data_transacao.isoformat() if t.data_transacao else None,
            "valor": float(t.valor),
        }
        for t, categoria, forma in pendentes_query.order_by(Transacao.data_transacao.asc()).limit(200).all()
    ]

    return jsonify({"resumo": resumo, "pendentes": pendentes}), 200

# Parcelamentos com parcelas futuras (compromissos já assumidos)
@bp_relatorios.route("/parcelamentos_futuros", methods=["GET"])
def parcelamentos_futuros():
    hoje = datetime.now().date()

    futuras = (
        db.session.query(Transacao, FormaPagamento.nome)
        .join(FormaPagamento, Transacao.forma_pagamento_id == FormaPagamento.id)
        .filter(
            Transacao.parcelado.is_(True),
            Transacao.tipo == "Despesa",
            Transacao.data_transacao > hoje,
        )
        .order_by(Transacao.data_transacao.asc())
        .all()
    )

    grupos = {}
    mensal = {}
    total_restante = 0.0

    for t, forma in futuras:
        valor = float(t.valor)
        total_restante += valor

        chave_mes = t.data_transacao.strftime("%Y-%m")
        item_mes = mensal.setdefault(chave_mes, {"mes": chave_mes, "qtd": 0, "total": 0.0})
        item_mes["qtd"] += 1
        item_mes["total"] = round(item_mes["total"] + valor, 2)

        chave = t.parcelamento_id or f"{t.descricao}|{t.forma_pagamento_id}"
        grupo = grupos.setdefault(chave, {
            "descricao": t.descricao,
            "forma_pagamento": forma,
            "total_parcelas": t.total_parcelas,
            "parcelas_restantes": 0,
            "valor_parcela": float(t.valor_parcela or t.valor),
            "valor_restante": 0.0,
            "proxima_data": t.data_transacao.isoformat(),
            "ultima_data": t.data_transacao.isoformat(),
        })
        grupo["parcelas_restantes"] += 1
        grupo["valor_restante"] = round(grupo["valor_restante"] + valor, 2)
        data_iso = t.data_transacao.isoformat()
        if data_iso < grupo["proxima_data"]:
            grupo["proxima_data"] = data_iso
            grupo["descricao"] = t.descricao
        if data_iso > grupo["ultima_data"]:
            grupo["ultima_data"] = data_iso

    grupos_lista = sorted(grupos.values(), key=lambda g: g["valor_restante"], reverse=True)
    mensal_lista = sorted(mensal.values(), key=lambda m: m["mes"])

    return jsonify({
        "grupos": grupos_lista,
        "mensal": mensal_lista,
        "total_restante": round(total_restante, 2),
        "qtd_parcelas": len(futuras),
        "qtd_grupos": len(grupos_lista),
    }), 200

# Resumo anual
@bp_relatorios.route("/sumario_anual", methods=["GET"])
def sumario_anual():
    from calendar import monthrange
    ano = request.args.get("ano", datetime.now().year)
    try:
        ano = int(ano)
    except:
        ano = datetime.now().year
    meses = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ]
    receita = []
    despesa = []
    investimento = []
    sobrou = []
    for m in range(1, 13):
        ini = datetime(ano, m, 1)
        fim = datetime(ano, m, monthrange(ano, m)[1])
        # Receita
        r = db.session.query(func.sum(Transacao.valor)).filter(
            Transacao.tipo == "Receita",
            Transacao.data_transacao.between(ini, fim)
        ).scalar() or 0
        receita.append(float(r))
        # Despesa
        d = db.session.query(func.sum(Transacao.valor)).filter(
            Transacao.tipo == "Despesa",
            Transacao.data_transacao.between(ini, fim)
        ).scalar() or 0
        despesa.append(float(d))
        # Investimento
        i = db.session.query(func.sum(Transacao.valor)).filter(
            Transacao.tipo == "Investimento",
            Transacao.data_transacao.between(ini, fim)
        ).scalar() or 0
        investimento.append(float(i))
        # Quanto sobrou
        sobrou.append(float(r) - float(d))
    total_receita = sum(receita)
    total_despesa = sum(despesa)
    total_investimento = sum(investimento)
    total_sobrou = sum(sobrou)
    return jsonify({
        "meses": meses,
        "receita": receita,
        "despesa": despesa,
        "investimento": investimento,
        "sobrou": sobrou,
        "total_receita": total_receita,
        "total_despesa": total_despesa,
        "total_investimento": total_investimento,
        "total_sobrou": total_sobrou
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


def _mes_referencia(transacao, usar_competencia, eh_cartao):
    """Define em qual mês a transação será posicionada na matriz."""
    if usar_competencia and eh_cartao and transacao.competencia_fatura:
        return transacao.competencia_fatura
    return transacao.data_transacao


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
        )
        .join(Categoria, Transacao.categoria_id == Categoria.id)
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

    for row in query.all():
        if row.tipo not in sumario:
            continue

        referencia = _mes_referencia(row, usar_competencia, bool(row.eh_cartao))
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
