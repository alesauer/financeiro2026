from datetime import datetime

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from app import db
from app.models import Lembrete
from app.schemas import LembreteSchema
from services import lembretes_service

bp_lembretes = Blueprint("lembretes", __name__)

lembrete_schema = LembreteSchema()
lembretes_schema = LembreteSchema(many=True)


def _parse_date(value):
    if not value:
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except (TypeError, ValueError):
        return None


@bp_lembretes.route("/", methods=["GET"])
@jwt_required()
def listar_lembretes():
    usuario_id = int(get_jwt_identity())
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 10, type=int)
    filtros = {
        "status": request.args.get("status"),
        "prioridade": request.args.get("prioridade"),
        "data_inicio": _parse_date(request.args.get("data_inicio")),
        "data_fim": _parse_date(request.args.get("data_fim")),
        "busca": request.args.get("busca"),
    }
    paginated = lembretes_service.listar_lembretes(usuario_id, filtros, page, per_page)
    return jsonify({
        "items": lembretes_schema.dump(paginated.items),
        "total_items": paginated.total,
        "total_pages": paginated.pages,
        "current_page": paginated.page,
        "per_page": paginated.per_page,
        "has_next": paginated.has_next,
        "has_prev": paginated.has_prev,
    }), 200


@bp_lembretes.route("/dashboard", methods=["GET"])
@jwt_required()
def dashboard_lembretes():
    usuario_id = int(get_jwt_identity())
    resumo = lembretes_service.resumo_dashboard(usuario_id)
    resumo["proximos"] = lembretes_schema.dump(resumo.get("proximos", []))
    return jsonify(resumo), 200


@bp_lembretes.route("/", methods=["POST"])
@jwt_required()
def criar_lembrete():
    usuario_id = int(get_jwt_identity())
    data = request.get_json() or {}
    try:
        validado = lembrete_schema.load(data)
    except Exception as err:
        return jsonify(getattr(err, "messages", {"error": "Dados inválidos"})), 400

    lembrete = Lembrete(usuario_id=usuario_id, **validado)
    db.session.add(lembrete)
    db.session.commit()
    return jsonify(lembrete_schema.dump(lembrete)), 201


@bp_lembretes.route("/<int:lembrete_id>", methods=["GET"])
@jwt_required()
def obter_lembrete(lembrete_id):
    usuario_id = int(get_jwt_identity())
    lembrete = Lembrete.query.get_or_404(lembrete_id)
    if lembrete.usuario_id != usuario_id:
        return jsonify({"error": "Não autorizado"}), 403
    return jsonify(lembrete_schema.dump(lembrete)), 200


@bp_lembretes.route("/<int:lembrete_id>", methods=["PUT"])
@jwt_required()
def atualizar_lembrete(lembrete_id):
    usuario_id = int(get_jwt_identity())
    lembrete = Lembrete.query.get_or_404(lembrete_id)
    if lembrete.usuario_id != usuario_id:
        return jsonify({"error": "Não autorizado"}), 403

    data = request.get_json() or {}
    try:
        validado = lembrete_schema.load(data, partial=True)
    except Exception as err:
        return jsonify(getattr(err, "messages", {"error": "Dados inválidos"})), 400

    for campo, valor in validado.items():
        setattr(lembrete, campo, valor)
    db.session.commit()
    return jsonify(lembrete_schema.dump(lembrete)), 200


@bp_lembretes.route("/<int:lembrete_id>/status", methods=["PATCH"])
@jwt_required()
def atualizar_status(lembrete_id):
    usuario_id = int(get_jwt_identity())
    lembrete = Lembrete.query.get_or_404(lembrete_id)
    if lembrete.usuario_id != usuario_id:
        return jsonify({"error": "Não autorizado"}), 403

    data = request.get_json() or {}
    status = data.get("status")
    if status not in {"Pendente", "Concluído"}:
        return jsonify({"error": "Status inválido"}), 400

    lembrete.status = status
    db.session.commit()
    return jsonify(lembrete_schema.dump(lembrete)), 200


@bp_lembretes.route("/<int:lembrete_id>", methods=["DELETE"])
@jwt_required()
def excluir_lembrete(lembrete_id):
    usuario_id = int(get_jwt_identity())
    lembrete = Lembrete.query.get_or_404(lembrete_id)
    if lembrete.usuario_id != usuario_id:
        return jsonify({"error": "Não autorizado"}), 403

    db.session.delete(lembrete)
    db.session.commit()
    return jsonify({"message": "Lembrete excluído"}), 200