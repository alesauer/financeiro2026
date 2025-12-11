from flask import Blueprint, request, jsonify
from marshmallow import ValidationError
from app import db
from app.models import Categoria
from app.schemas import CategoriaSchema
from flask_jwt_extended import jwt_required

bp_categorias = Blueprint("categorias", __name__)
schema = CategoriaSchema()
schemas = CategoriaSchema(many=True)

@bp_categorias.route("", methods=["POST"])
@bp_categorias.route("/", methods=["POST"])
@jwt_required()
def criar():
    data = request.get_json()
    print("[CATEGORIA POST] JSON recebido:", data)
    try:
        validado = schema.load(data)
    except ValidationError as err:
        print("[CATEGORIA POST] Erro de validação:", err.messages)
        return jsonify(err.messages), 400

    categoria = Categoria(**validado)
    db.session.add(categoria)
    db.session.commit()
    return jsonify(schema.dump(categoria)), 201

@bp_categorias.route("", methods=["GET"])
@bp_categorias.route("/", methods=["GET"])
@jwt_required()
def listar():
    tipo = request.args.get("tipo")
    query = Categoria.query
    if tipo:
        query = query.filter_by(tipo=tipo)
    categorias = query.all()
    return jsonify(schemas.dump(categorias)), 200

@bp_categorias.route("/<int:id>", methods=["GET"])
@jwt_required()
def obter(id):
    categoria = Categoria.query.get_or_404(id)
    return jsonify(schema.dump(categoria)), 200

@bp_categorias.route("/<int:id>", methods=["PUT"])
@jwt_required()
def atualizar(id):
    categoria = Categoria.query.get_or_404(id)
    data = request.get_json()
    print(f"[CATEGORIA PUT] JSON recebido para id={id}:", data)
    try:
        validado = schema.load(data, partial=True)
    except ValidationError as err:
        print(f"[CATEGORIA PUT] Erro de validação para id={id}:", err.messages)
        return jsonify(err.messages), 400
    for key, value in validado.items():
        setattr(categoria, key, value)
    db.session.commit()
    return jsonify(schema.dump(categoria)), 200

@bp_categorias.route("/<int:id>", methods=["DELETE"])
@jwt_required()
def deletar(id):
    categoria = Categoria.query.get_or_404(id)
    db.session.delete(categoria)
    db.session.commit()
    return jsonify({"message": "Categoria deletada com sucesso"}), 200