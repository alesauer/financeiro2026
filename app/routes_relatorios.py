from flask import Blueprint, request, jsonify
from datetime import datetime
from sqlalchemy import func
from app import db
from app.models import Transacao, Categoria

bp_relatorios = Blueprint("relatorios", __name__)

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

# Totais por categoria em um período
@bp_relatorios.route("/categorias", methods=["GET"])
def por_categoria():
    inicio = request.args.get("inicio")
    fim = request.args.get("fim")

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

    query = query.group_by(Categoria.nome).all()
    resultado = [{ "categoria": cat, "total": float(total) } for cat, total in query]
    return jsonify(resultado), 200
