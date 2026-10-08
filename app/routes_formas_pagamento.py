from flask import Blueprint, request, jsonify
from marshmallow import Schema, fields, ValidationError, validates
from app import db
from app.models import FormaPagamento, Transacao
from sqlalchemy.exc import IntegrityError
from flask_jwt_extended import jwt_required

bp_formas_pagamento = Blueprint("formas_pagamento", __name__)

class FormaPagamentoSchema(Schema):
    id = fields.Int(dump_only=True)
    nome = fields.Str(required=True)
    tipo = fields.Str(required=True)
    cartao_credito = fields.Bool(load_default=False)
    dia_fechamento = fields.Int(allow_none=True)
    dia_vencimento = fields.Int(allow_none=True)
    ativo = fields.Bool(load_default=True)
    icone = fields.Str(allow_none=True)
    cor = fields.Str(allow_none=True)

    @validates("dia_fechamento")
    def validate_dia_fechamento(self, value, **kwargs):
        if value is not None and (value < 1 or value > 31):
            raise ValidationError("Dia de fechamento deve estar entre 1 e 31")

    @validates("dia_vencimento")
    def validate_dia_vencimento(self, value, **kwargs):
        if value is not None and (value < 1 or value > 31):
            raise ValidationError("Dia de vencimento deve estar entre 1 e 31")

schema = FormaPagamentoSchema()
schemas = FormaPagamentoSchema(many=True)

@bp_formas_pagamento.route("/", methods=["GET"])
@bp_formas_pagamento.route("", methods=["GET"])
@jwt_required()
def listar():
    tipo = request.args.get("tipo")
    ativo = request.args.get("ativo")
    cartao_credito = request.args.get("cartao_credito")
    query = FormaPagamento.query
    if tipo:
        query = query.filter(FormaPagamento.tipo == tipo)
    if ativo is not None:
        val = str(ativo).lower() in ("1", "true", "t", "yes")
        query = query.filter(FormaPagamento.ativo == val)
    if cartao_credito is not None:
        val = str(cartao_credito).lower() in ("1", "true", "t", "yes")
        query = query.filter(FormaPagamento.cartao_credito.is_(val))
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
    # Bloquear exclusão se houver transações vinculadas
    refs = db.session.query(Transacao).filter(Transacao.forma_pagamento_id == id).count()
    if refs > 0:
        return jsonify({
            "error": "Forma de pagamento está vinculada a transações",
            "referencias": refs
        }), 400
    db.session.delete(item)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({"error": "Não foi possível excluir devido a vínculos existentes"}), 400
    return jsonify({"message": "Forma de pagamento removida"}), 200
