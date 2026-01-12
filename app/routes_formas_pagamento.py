from flask import Blueprint, request, jsonify
from marshmallow import Schema, fields, ValidationError
from app import db
from app.models import FormaPagamento
from flask_jwt_extended import jwt_required

bp_formas_pagamento = Blueprint("formas_pagamento", __name__)

class FormaPagamentoSchema(Schema):
    id = fields.Int(dump_only=True)
    nome = fields.Str(required=True)
    tipo = fields.Str(required=True)
    cartao_credito = fields.Bool(load_default=False)
    ativo = fields.Bool(load_default=True)

schema = FormaPagamentoSchema()
schemas = FormaPagamentoSchema(many=True)

@bp_formas_pagamento.route("/", methods=["GET"])
@bp_formas_pagamento.route("", methods=["GET"])
@jwt_required()
def listar():
    tipo = request.args.get("tipo")
    ativo = request.args.get("ativo")
    query = FormaPagamento.query
    if tipo:
        query = query.filter(FormaPagamento.tipo == tipo)
    if ativo is not None:
        val = str(ativo).lower() in ("1", "true", "t", "yes")
        query = query.filter(FormaPagamento.ativo == val)
    items = query.order_by(FormaPagamento.nome.asc()).all()
    return jsonify(schemas.dump(items)), 200

@bp_formas_pagamento.route("/", methods=["POST"])
@bp_formas_pagamento.route("", methods=["POST"])
@jwt_required()
def criar():
    data = request.get_json() or {}
    try:
        validado = schema.load(data)
    except ValidationError as err:
        return jsonify(err.messages), 400
    item = FormaPagamento(**validado)
    db.session.add(item)
    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400
    return jsonify(schema.dump(item)), 201

@bp_formas_pagamento.route("/<int:id>", methods=["PUT"])
@jwt_required()
def atualizar(id):
    item = FormaPagamento.query.get_or_404(id)
    data = request.get_json() or {}
    try:
        validado = schema.load(data, partial=True)
    except ValidationError as err:
        return jsonify(err.messages), 400
    for k, v in validado.items():
        setattr(item, k, v)
    db.session.commit()
    return jsonify(schema.dump(item)), 200

@bp_formas_pagamento.route("/<int:id>", methods=["DELETE"])
@jwt_required()
def deletar(id):
    item = FormaPagamento.query.get_or_404(id)
    db.session.delete(item)
    db.session.commit()
    return jsonify({"message": "Forma de pagamento removida"}), 200
