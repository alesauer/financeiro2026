from flask import Blueprint, request, jsonify
from datetime import datetime
from sqlalchemy import func
from app import db
from app.models import Transacao, Categoria
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
