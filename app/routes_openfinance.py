from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models import OpenFinanceConexao, OpenFinanceContaMap, Usuario
from services.openfinance.pluggy_client import PluggyClient
from services.openfinance.sync_service import OpenFinanceSyncService

bp_openfinance = Blueprint("openfinance", __name__, url_prefix="/api/openfinance")


@bp_openfinance.route("/status", methods=["GET"])
@jwt_required()
def check_status():
    """Verifica se as credenciais da Pluggy estão configuradas e ativas."""
    configured = PluggyClient.is_configured()
    if not configured:
        return jsonify({
            "configured": False,
            "message": "Credenciais da Pluggy não configuradas no servidor."
        }), 200

    try:
        test_res = PluggyClient.test_connection()
        return jsonify({
            "configured": True,
            "connected": True,
            "details": test_res
        }), 200
    except Exception as err:
        return jsonify({
            "configured": True,
            "connected": False,
            "error": str(err)
        }), 200


@bp_openfinance.route("/connect-token", methods=["POST"])
@jwt_required()
def get_connect_token():
    """Gera um token de sessão para abrir o Pluggy Connect Widget no frontend."""
    user_id = get_jwt_identity()
    body = request.get_json(silent=True) or {}
    item_id = body.get("itemId")

    try:
        token_data = PluggyClient.create_connect_token(item_id=item_id, client_user_id=str(user_id))
        return jsonify(token_data), 200
    except Exception as err:
        return jsonify({"error": f"Não foi possível gerar o Connect Token: {str(err)}"}), 500


@bp_openfinance.route("/conexoes", methods=["GET"])
@jwt_required()
def list_conexoes():
    """Lista todas as conexões Open Finance do usuário com seus cartões/contas vinculados."""
    user_id = int(get_jwt_identity())
    conexoes = OpenFinanceConexao.query.filter_by(usuario_id=user_id).order_by(OpenFinanceConexao.created_at.desc()).all()

    items = []
    for c in conexoes:
        contas_list = []
        for conta in c.contas:
            forma_nome = conta.forma_pagamento.nome if conta.forma_pagamento else None
            is_cartao = conta.forma_pagamento.cartao_credito if conta.forma_pagamento else (conta.tipo_pluggy == "CREDIT")
            contas_list.append({
                "id": conta.id,
                "pluggy_account_id": conta.pluggy_account_id,
                "tipo": conta.tipo_pluggy,
                "nome": conta.nome,
                "numero": conta.numero,
                "forma_pagamento_id": conta.forma_pagamento_id,
                "forma_pagamento_nome": forma_nome,
                "is_cartao": is_cartao,
                "sincronizar": getattr(conta, "sincronizar", True),
            })

        items.append({
            "id": c.id,
            "item_id": c.item_id,
            "connector_id": c.connector_id,
            "connector_name": c.connector_name,
            "connector_image_url": c.connector_image_url,
            "connector_primary_color": c.connector_primary_color,
            "status": c.status,
            "last_sync_at": c.last_sync_at.isoformat() if c.last_sync_at else None,
            "consent_expires_at": c.consent_expires_at.isoformat() if c.consent_expires_at else None,
            "erro_mensagem": c.erro_mensagem,
            "contas": contas_list,
        })

    return jsonify({"items": items, "total": len(items)}), 200


@bp_openfinance.route("/contas/<int:conta_id>", methods=["PUT"])
@jwt_required()
def update_conta_map(conta_id):
    """Atualiza se a conta/cartão deve ser sincronizada e a qual FormaPagamento está vinculada."""
    user_id = int(get_jwt_identity())
    conta = OpenFinanceContaMap.query.get(conta_id)
    if not conta or int(conta.conexao.usuario_id) != user_id:
        return jsonify({"error": "Conta não encontrada ou não autorizada."}), 404

    data = request.get_json() or {}
    if "sincronizar" in data:
        conta.sincronizar = bool(data["sincronizar"])
    if "forma_pagamento_id" in data:
        fp_id = data["forma_pagamento_id"]
        conta.forma_pagamento_id = int(fp_id) if fp_id is not None and str(fp_id).isdigit() and int(fp_id) > 0 else None

    db.session.commit()
    forma_nome = conta.forma_pagamento.nome if conta.forma_pagamento else None
    return jsonify({
        "message": "Configurações da conta atualizadas com sucesso!",
        "conta": {
            "id": conta.id,
            "sincronizar": conta.sincronizar,
            "forma_pagamento_id": conta.forma_pagamento_id,
            "forma_pagamento_nome": forma_nome,
        }
    }), 200


@bp_openfinance.route("/conexoes", methods=["POST"])
@jwt_required()
def register_conexao():
    """Registra uma nova conexão finalizada no widget e executa o sync inicial."""
    user_id = int(get_jwt_identity())
    body = request.get_json() or {}
    item_id = body.get("itemId") or body.get("item_id")

    if not item_id:
        return jsonify({"error": "itemId é obrigatório."}), 400

    try:
        conexao = OpenFinanceSyncService.register_or_update_connection(item_id, user_id)
        return jsonify({
            "message": "Instituição conectada e sincronizada com sucesso!",
            "conexao_id": conexao.id,
            "connector_name": conexao.connector_name,
            "status": conexao.status,
        }), 201
    except Exception as err:
        return jsonify({"error": f"Erro ao registrar conexão: {str(err)}"}), 500


@bp_openfinance.route("/conexoes/<int:conexao_id>/sync", methods=["POST"])
@jwt_required()
def sync_conexao(conexao_id):
    """Dispara a sincronização de transações e cartões de crédito sob demanda."""
    user_id = int(get_jwt_identity())
    try:
        resumo = OpenFinanceSyncService.sync_connection(conexao_id, user_id)
        return jsonify({
            "message": "Sincronização concluída com sucesso!",
            "resumo": resumo
        }), 200
    except Exception as err:
        return jsonify({"error": f"Erro na sincronização: {str(err)}"}), 500


@bp_openfinance.route("/conexoes/<int:conexao_id>", methods=["DELETE"])
@jwt_required()
def disconnect_conexao(conexao_id):
    """Revoga e desconecta uma instituição bancária."""
    user_id = int(get_jwt_identity())
    sucesso = OpenFinanceSyncService.disconnect(conexao_id, user_id)
    if not sucesso:
        return jsonify({"error": "Conexão não encontrada."}), 404
    return jsonify({"message": "Conexão removida com sucesso."}), 200


@bp_openfinance.route("/webhook", methods=["POST"])
def webhook_listener():
    """Webhook para receber eventos assíncronos da Pluggy (item/updated, transactions/created)."""
    payload = request.get_json(silent=True) or {}
    event = payload.get("event")
    item_id = payload.get("itemId")

    if not item_id:
        return jsonify({"received": True, "ignored": "no_item_id"}), 200

    conexao = OpenFinanceConexao.query.filter_by(item_id=item_id).first()
    if not conexao:
        return jsonify({"received": True, "ignored": "item_not_found"}), 200

    try:
        if event in ("item/updated", "transactions/created", "transactions/updated"):
            OpenFinanceSyncService.sync_connection(conexao.id, conexao.usuario_id)
        elif event == "item/error":
            item_data = PluggyClient.get_item(item_id)
            conexao.status = "LOGIN_ERROR"
            conexao.erro_mensagem = item_data.get("error", {}).get("message")
            db.session.commit()
    except Exception as err:
        print(f"Erro ao processar webhook Pluggy ({event}) para item {item_id}: {err}")

    return jsonify({"received": True}), 200
