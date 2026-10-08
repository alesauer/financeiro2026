from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models import Configuracao, Usuario
from app.schemas import EmailsAlertaSchema, EmailItemSchema, AlertasConfigSchema, SobreSistemaConfigSchema
import json
from datetime import datetime

bp_config = Blueprint("config", __name__)


KEY_EMAILS_ALERTA = "emails_alerta"
KEY_ALERTAS_CONFIG = "alertas_config"
KEY_SOBRE_SISTEMA = "sobre_sistema"


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


@bp_config.route("/alertas-config", methods=["GET"])
@jwt_required()
def get_alertas_config():
    default = json.dumps({
        "ligado": False,
        "email": False,
        "whatsapp": False,
        "limite": 0.0,
    })
    raw = _get_config_value(KEY_ALERTAS_CONFIG, default_json=default)
    try:
        data = json.loads(raw) if raw else {}
    except Exception:
        data = {}
    # valida/aplica defaults
    cfg = AlertasConfigSchema().load(data)
    return jsonify(cfg), 200


@bp_config.route("/alertas-config", methods=["PUT"])
@jwt_required()
def put_alertas_config():
    payload = request.get_json(silent=True) or {}
    cfg = AlertasConfigSchema().load(payload)
    _set_config_value(KEY_ALERTAS_CONFIG, json.dumps(cfg))
    return jsonify(cfg), 200


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


@bp_config.route("/sobre-sistema", methods=["GET"])
@jwt_required()
def get_sobre_sistema():
    default = json.dumps({
        "descricao": "",
        "versao": "",
    })
    raw = _get_config_value(KEY_SOBRE_SISTEMA, default_json=default)
    try:
        data = json.loads(raw) if raw else {}
    except Exception:
        data = {}
    cfg = SobreSistemaConfigSchema().load(data)

    # Usuário logado
    user_display = None
    try:
        ident = get_jwt_identity()
        uid = int(ident) if ident is not None else None
        if uid is not None:
            u = Usuario.query.get(uid)
            if u:
                user_display = u.nome or u.email
    except Exception:
        user_display = None

    # Data/hora do sistema (ISO)
    now_iso = datetime.now().isoformat()

    return jsonify({
        "descricao": cfg.get("descricao", ""),
        "versao": cfg.get("versao", ""),
        "usuario_logado": user_display,
        "data_hora": now_iso,
    }), 200


@bp_config.route("/sobre-sistema", methods=["PUT"])
@jwt_required()
def put_sobre_sistema():
    payload = request.get_json(silent=True) or {}
    cfg = SobreSistemaConfigSchema().load(payload)
    _set_config_value(KEY_SOBRE_SISTEMA, json.dumps(cfg))
    return jsonify(cfg), 200


@bp_config.route("/limpar-dados", methods=["POST"])
@jwt_required()
def limpar_dados():
    from app.models import (
        Transacao, Categoria, CategoriaAlias, FormaPagamento,
        Documento, DocumentoAnexo, Milha, Lembrete,
        Viagem, ViagemCusto, ViagemRoteiro, ViagemCustoAnexo,
        InvestmentWallet, InvestmentAsset, InvestmentTransaction, InvestmentQuote
    )
    import random

    data = request.get_json(silent=True) or {}
    tipo = data.get("tipo", "transacoes")
    confirmacao = str(data.get("confirmacao", "")).strip().upper()

    if confirmacao != "EXCLUIR":
        return jsonify({"error": "Confirmação inválida. Digite 'EXCLUIR' para confirmar."}), 400

    removidos = {}

    if tipo == "transacoes":
        q = Transacao.query.delete(synchronize_session=False)
        db.session.commit()
        removidos["transacoes"] = q
        return jsonify({"mensagem": "Todas as transações foram excluídas com sucesso.", "detalhes": removidos}), 200

    elif tipo == "milhas":
        q = Milha.query.delete(synchronize_session=False)
        db.session.commit()
        removidos["milhas"] = q
        return jsonify({"mensagem": "Todas as milhas foram excluídas.", "detalhes": removidos}), 200

    elif tipo == "lembretes":
        q = Lembrete.query.delete(synchronize_session=False)
        db.session.commit()
        removidos["lembretes"] = q
        return jsonify({"mensagem": "Todos os lembretes foram excluídos.", "detalhes": removidos}), 200

    elif tipo == "viagens":
        q4 = ViagemCustoAnexo.query.delete(synchronize_session=False)
        q3 = ViagemCusto.query.delete(synchronize_session=False)
        q2 = ViagemRoteiro.query.delete(synchronize_session=False)
        q1 = Viagem.query.delete(synchronize_session=False)
        db.session.commit()
        removidos["viagens"] = q1
        removidos["custos"] = q3
        removidos["roteiros"] = q2
        return jsonify({"mensagem": "Todas as viagens e custos foram excluídos.", "detalhes": removidos}), 200

    elif tipo == "documentos":
        q2 = DocumentoAnexo.query.delete(synchronize_session=False)
        q1 = Documento.query.delete(synchronize_session=False)
        db.session.commit()
        removidos["documentos"] = q1
        removidos["anexos"] = q2
        return jsonify({"mensagem": "Todos os documentos e anexos foram excluídos.", "detalhes": removidos}), 200

    elif tipo == "total":
        removidos["transacoes"] = Transacao.query.delete(synchronize_session=False)
        removidos["milhas"] = Milha.query.delete(synchronize_session=False)
        removidos["lembretes"] = Lembrete.query.delete(synchronize_session=False)
        removidos["viagem_anexos"] = ViagemCustoAnexo.query.delete(synchronize_session=False)
        removidos["viagem_custos"] = ViagemCusto.query.delete(synchronize_session=False)
        removidos["viagem_roteiros"] = ViagemRoteiro.query.delete(synchronize_session=False)
        removidos["viagens"] = Viagem.query.delete(synchronize_session=False)
        removidos["doc_anexos"] = DocumentoAnexo.query.delete(synchronize_session=False)
        removidos["documentos"] = Documento.query.delete(synchronize_session=False)
        removidos["invest_quotes"] = InvestmentQuote.query.delete(synchronize_session=False)
        removidos["invest_txs"] = InvestmentTransaction.query.delete(synchronize_session=False)
        removidos["invest_assets"] = InvestmentAsset.query.delete(synchronize_session=False)
        removidos["invest_wallets"] = InvestmentWallet.query.delete(synchronize_session=False)
        removidos["categoria_aliases"] = CategoriaAlias.query.delete(synchronize_session=False)
        db.session.commit()
        return jsonify({"mensagem": "Reset total executado com sucesso.", "detalhes": removidos}), 200

    elif tipo == "seed_demo":
        try:
            from scripts.seed_dados_ficticios import preparar_cadastros, gerar_lancamentos, persistir
            ano_atual = datetime.now().year
            rng = random.Random(42)
            categorias, formas = preparar_cadastros()
            lancamentos = gerar_lancamentos([ano_atual], rng)
            resultado = persistir(lancamentos, categorias, formas, False)
            return jsonify({
                "mensagem": f"Base demonstrativa criada com sucesso ({resultado['criadas']} lançamentos para o ano {ano_atual}).",
                "resultado": resultado
            }), 200
        except Exception as exc:
            db.session.rollback()
            return jsonify({"error": f"Erro ao gerar dados demo: {str(exc)}"}), 500

    return jsonify({"error": f"Tipo de limpeza desconhecido: {tipo}"}), 400


@bp_config.route("/backup/exportar-json", methods=["GET"])
@jwt_required()
def exportar_backup_json():
    from app.models import Transacao, Categoria, FormaPagamento, Milha, Lembrete, Viagem

    categorias = [{"id": c.id, "nome": c.nome, "tipo": c.tipo} for c in Categoria.query.all()]
    formas = [
        {
            "id": f.id,
            "nome": f.nome,
            "tipo": f.tipo,
            "cartao_credito": f.cartao_credito,
            "dia_fechamento": f.dia_fechamento,
            "dia_vencimento": f.dia_vencimento
        }
        for f in FormaPagamento.query.all()
    ]
    transacoes = [
        {
            "id": t.id,
            "tipo": t.tipo,
            "categoria_id": t.categoria_id,
            "forma_pagamento_id": t.forma_pagamento_id,
            "descricao": t.descricao,
            "valor": str(t.valor),
            "data_transacao": t.data_transacao.isoformat() if t.data_transacao else None,
            "status": t.status,
            "recorrente": t.recorrente,
            "parcelado": t.parcelado,
            "competencia_fatura": t.competencia_fatura.isoformat() if t.competencia_fatura else None,
            "observacoes": t.observacoes
        }
        for t in Transacao.query.all()
    ]
    milhas = [
        {
            "id": m.id,
            "programa": m.programa,
            "tipo": m.tipo,
            "quantidade": m.quantidade,
            "origem": m.origem,
            "data_movimentacao": m.data_movimentacao.isoformat() if m.data_movimentacao else None,
            "data_expiracao": m.data_expiracao.isoformat() if m.data_expiracao else None,
            "descricao": m.descricao
        }
        for m in Milha.query.all()
    ]
    lembretes = [
        {
            "id": l.id,
            "titulo": l.titulo,
            "descricao": l.descricao,
            "categoria": l.categoria,
            "data_lembrete": l.data_lembrete.isoformat() if l.data_lembrete else None,
            "status": l.status,
            "prioridade": l.prioridade
        }
        for l in Lembrete.query.all()
    ]
    viagens = [
        {
            "id": v.id,
            "titulo": v.titulo,
            "destino": v.destino,
            "data_inicio": v.data_inicio.isoformat() if v.data_inicio else None,
            "data_termino": v.data_termino.isoformat() if v.data_termino else None,
            "status": v.status,
            "custo_total": str(v.custo_total),
            "custos": [
                {
                    "id": c.id,
                    "nome": c.nome,
                    "descricao": c.descricao,
                    "tipo": c.tipo,
                    "valor": str(c.valor),
                    "data_gasto": c.data_gasto.isoformat() if c.data_gasto else None
                }
                for c in v.custos
            ]
        }
        for v in Viagem.query.all()
    ]

    export_data = {
        "timestamp": datetime.now().isoformat(),
        "versao": "2.0",
        "total_transacoes": len(transacoes),
        "categorias": categorias,
        "formas_pagamento": formas,
        "transacoes": transacoes,
        "milhas": milhas,
        "lembretes": lembretes,
        "viagens": viagens,
    }

    return jsonify(export_data), 200

