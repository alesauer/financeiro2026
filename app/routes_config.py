from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from app import db
from app.models import Configuracao
from app.schemas import EmailsAlertaSchema, EmailItemSchema
import json

bp_config = Blueprint("config", __name__)


KEY_EMAILS_ALERTA = "emails_alerta"


def _get_config_value(key: str, default_json: str = "{}") -> str:
    cfg = Configuracao.query.filter_by(chave=key).first()
    if cfg is None:
        cfg = Configuracao(chave=key, valor=default_json)
        db.session.add(cfg)
        db.session.commit()
    return cfg.valor


def _set_config_value(key: str, value_json: str):
    cfg = Configuracao.query.filter_by(chave=key).first()
    if cfg is None:
        cfg = Configuracao(chave=key, valor=value_json)
        db.session.add(cfg)
    else:
        cfg.valor = value_json
    db.session.commit()


@bp_config.route("/emails-alerta", methods=["GET"])
@jwt_required()
def get_emails_alerta():
    raw = _get_config_value(KEY_EMAILS_ALERTA, default_json=json.dumps({"emails": []}))
    try:
        data = json.loads(raw) if raw else {"emails": []}
        emails = data.get("emails", [])
    except Exception:
        emails = []
    return jsonify({"emails": emails}), 200


@bp_config.route("/emails-alerta", methods=["PUT"])
@jwt_required()
def put_emails_alerta():
    payload = request.get_json(silent=True) or {}
    schema = EmailsAlertaSchema()
    data = schema.load(payload)

    # normaliza e deduplica
    normalized = []
    seen = set()
    for e in data.get("emails", []):
        v = str(e).strip().lower()
        if v and v not in seen:
            seen.add(v)
            normalized.append(v)

    _set_config_value(KEY_EMAILS_ALERTA, json.dumps({"emails": normalized}))
    return jsonify({"emails": normalized}), 200


@bp_config.route("/emails-alerta", methods=["POST"])
@jwt_required()
def add_email_alerta():
    payload = request.get_json(silent=True) or {}
    item_schema = EmailItemSchema()
    item = item_schema.load(payload)

    raw = _get_config_value(KEY_EMAILS_ALERTA, default_json=json.dumps({"emails": []}))
    current = []
    try:
        current = json.loads(raw).get("emails", [])
    except Exception:
        current = []

    email = str(item["email"]).strip().lower()
    if email not in [s.lower() for s in current]:
        current.append(email)

    # revalida limite
    EmailsAlertaSchema().load({"emails": current})

    _set_config_value(KEY_EMAILS_ALERTA, json.dumps({"emails": current}))
    return jsonify({"emails": current}), 200


@bp_config.route("/emails-alerta", methods=["DELETE"])
@jwt_required()
def remove_email_alerta():
    payload = request.get_json(silent=True) or {}
    item_schema = EmailItemSchema()
    item = item_schema.load(payload)

    raw = _get_config_value(KEY_EMAILS_ALERTA, default_json=json.dumps({"emails": []}))
    try:
        current = json.loads(raw).get("emails", [])
    except Exception:
        current = []

    target = str(item["email"]).strip().lower()
    current = [e for e in current if str(e).strip().lower() != target]

    _set_config_value(KEY_EMAILS_ALERTA, json.dumps({"emails": current}))
    return jsonify({"emails": current}), 200
