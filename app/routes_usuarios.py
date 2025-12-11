from flask import Blueprint, request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
from app import db
from app.models import Usuario
from app.schemas import UsuarioSchema
from marshmallow import ValidationError

bp_usuarios = Blueprint("usuarios", __name__)
schema = UsuarioSchema()
schemas = UsuarioSchema(many=True)

@bp_usuarios.route("", methods=["POST"])
@bp_usuarios.route("/", methods=["POST"])
def criar_usuario():
    data = request.get_json()
    try:
        validado = schema.load(data)
    except ValidationError as err:
        return jsonify(err.messages), 400
    if Usuario.query.filter_by(email=validado["email"]).first():
        return jsonify({"erro": "E-mail já cadastrado"}), 400
    senha_hash = generate_password_hash(validado["senha"])
    usuario = Usuario(
        nome=validado["nome"],
        email=validado["email"],
        senha_hash=senha_hash
    )
    db.session.add(usuario)
    db.session.commit()
    return jsonify(schema.dump(usuario)), 201

@bp_usuarios.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    usuario = Usuario.query.filter_by(email=data.get("email")).first()
    if usuario and check_password_hash(usuario.senha_hash, data.get("senha")):
        return jsonify(schema.dump(usuario)), 200
    return jsonify({"erro": "E-mail ou senha inválidos"}), 401

@bp_usuarios.route("", methods=["GET"])
@bp_usuarios.route("/", methods=["GET"])
def listar_usuarios():
    usuarios = Usuario.query.all()
    return jsonify(schemas.dump(usuarios)), 200

@bp_usuarios.route("/<int:id>", methods=["GET"])
def obter_usuario(id):
    usuario = Usuario.query.get_or_404(id)
    return jsonify(schema.dump(usuario)), 200

@bp_usuarios.route("/<int:id>", methods=["PUT"])
def editar_usuario(id):
    usuario = Usuario.query.get_or_404(id)
    data = request.get_json()
    try:
        validado = schema.load(data, partial=True)
    except ValidationError as err:
        return jsonify(err.messages), 400
    if "nome" in validado:
        usuario.nome = validado["nome"]
    if "email" in validado:
        if Usuario.query.filter(Usuario.email == validado["email"], Usuario.id != id).first():
            return jsonify({"erro": "E-mail já cadastrado"}), 400
        usuario.email = validado["email"]
    if "senha" in validado:
        usuario.senha_hash = generate_password_hash(validado["senha"])
    db.session.commit()
    return jsonify(schema.dump(usuario)), 200

@bp_usuarios.route("/<int:id>", methods=["DELETE"])
def excluir_usuario(id):
    usuario = Usuario.query.get_or_404(id)
    db.session.delete(usuario)
    db.session.commit()
    return jsonify({"msg": "Usuário excluído"}), 200
