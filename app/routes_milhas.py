from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models import Milha
from app.schemas import MilhaSchema

bp_milhas = Blueprint("milhas", __name__)

milha_schema = MilhaSchema()
milhas_schema = MilhaSchema(many=True)


@bp_milhas.route("/", methods=["GET"])
@jwt_required()
def listar_milhas():
    usuario_id = int(get_jwt_identity())
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 10, type=int)

    query = Milha.query.filter_by(usuario_id=usuario_id).order_by(Milha.data_movimentacao.desc(), Milha.created_at.desc())
    paginated = query.paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        "items": milhas_schema.dump(paginated.items),
        "total_items": paginated.total,
        "total_pages": paginated.pages,
        "current_page": paginated.page,
        "per_page": paginated.per_page,
        "has_next": paginated.has_next,
        "has_prev": paginated.has_prev,
    }), 200


@bp_milhas.route("/", methods=["POST"])
@jwt_required()
def criar_milha():
    usuario_id = int(get_jwt_identity())
    data = request.get_json() or {}
    try:
        validado = milha_schema.load(data)
    except Exception as err:
        return jsonify(getattr(err, 'messages', {"error": "Dados inválidos"})), 400

    milha = Milha(
        usuario_id=usuario_id,
        programa=validado["programa"],
        tipo=validado["tipo"],
        quantidade=validado["quantidade"],
        origem=validado.get("origem"),
        data_movimentacao=validado.get("data_movimentacao"),
        data_expiracao=validado.get("data_expiracao"),
        descricao=validado.get("descricao"),
    )
    db.session.add(milha)
    db.session.commit()
    return jsonify(milha_schema.dump(milha)), 201


@bp_milhas.route("/<int:id>", methods=["GET"])
@jwt_required()
def obter_milha(id):
    usuario_id = int(get_jwt_identity())
    m = Milha.query.get_or_404(id)
    if m.usuario_id != usuario_id:
        return jsonify({"error": "Não autorizado"}), 403
    return jsonify(milha_schema.dump(m)), 200


@bp_milhas.route("/<int:id>", methods=["PUT"])
@jwt_required()
def atualizar_milha(id):
    usuario_id = int(get_jwt_identity())
    m = Milha.query.get_or_404(id)
    if m.usuario_id != usuario_id:
        return jsonify({"error": "Não autorizado"}), 403
    data = request.get_json() or {}
    try:
        validado = milha_schema.load(data, partial=True)
    except Exception as err:
        return jsonify(getattr(err, 'messages', {"error": "Dados inválidos"})), 400

    for k, v in validado.items():
        setattr(m, k, v)
    db.session.commit()
    return jsonify(milha_schema.dump(m)), 200


@bp_milhas.route("/<int:id>", methods=["DELETE"])
@jwt_required()
def excluir_milha(id):
    usuario_id = int(get_jwt_identity())
    m = Milha.query.get_or_404(id)
    if m.usuario_id != usuario_id:
        return jsonify({"error": "Não autorizado"}), 403
    db.session.delete(m)
    db.session.commit()
    return jsonify({"message": "Milha excluída"}), 200
