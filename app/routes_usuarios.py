from flask import Blueprint, request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
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
        access_token = create_access_token(identity=str(usuario.id))
        return jsonify({
            "usuario": schema.dump(usuario),
            "access_token": access_token
        }), 200
    return jsonify({"erro": "E-mail ou senha inválidos"}), 401

@bp_usuarios.route("/", methods=["GET"])
@jwt_required()
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


@bp_usuarios.route("/me", methods=["GET"])
@jwt_required()
def get_me():
    ident = get_jwt_identity()
    try:
        uid = int(ident) if ident is not None else None
    except Exception:
        uid = None
    if uid is None:
        return jsonify({"erro": "Usuário não identificado"}), 401
    usuario = Usuario.query.get_or_404(uid)
    return jsonify(schema.dump(usuario)), 200


@bp_usuarios.route("/change-password", methods=["POST"])
@jwt_required()
def change_password():
    ident = get_jwt_identity()
    try:
        uid = int(ident) if ident is not None else None
    except Exception:
        uid = None
    if uid is None:
        return jsonify({"erro": "Usuário não identificado"}), 401

    usuario = Usuario.query.get_or_404(uid)
    data = request.get_json(silent=True) or {}
    senha_atual = data.get("senha_atual")
    senha_nova = data.get("senha_nova")
    senha_confirm = data.get("senha_confirm")

    if not senha_atual or not senha_nova or not senha_confirm:
        return jsonify({"erro": "Informe senha atual, nova e confirmação"}), 400

    if not check_password_hash(usuario.senha_hash, senha_atual):
        return jsonify({"erro": "Senha atual incorreta"}), 400

    if senha_nova != senha_confirm:
        return jsonify({"erro": "Confirmação não confere"}), 400

    if len(senha_nova) < 6:
        return jsonify({"erro": "A nova senha deve ter pelo menos 6 caracteres"}), 400

    usuario.senha_hash = generate_password_hash(senha_nova)
    db.session.commit()
    return jsonify({"msg": "Senha alterada com sucesso"}), 200
