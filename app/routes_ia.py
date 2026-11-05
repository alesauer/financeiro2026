import json
import logging
from datetime import date, datetime
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models import (
    IAConversa,
    IAMensagem,
    IAAlertaAnomalia,
    IAAnaliseHistorico,
    IAConsumoLog,
    Usuario
)
from services.categorization import CategorizationEngine
from services.ai.assistant import processar_pergunta_assistente
from services.ai.forecast import calcular_previsao_gastos
from services.ai.anomalies import detectar_e_atualizar_anomalias

logger = logging.getLogger(__name__)

bp_ia = Blueprint("ia", __name__)


def _get_usuario_id() -> int:
    ident = get_jwt_identity()
    try:
        return int(ident)
    except Exception:
        # Fallback para primeiro usuário se string ou nulo
        u = Usuario.query.first()
        return u.id if u else 1


# ============================================================================
# 1. VISÃO GERAL (DASHBOARD DA IA)
# ============================================================================

@bp_ia.route("/dashboard", methods=["GET"])
@jwt_required()
def dashboard_ia():
    usuario_id = _get_usuario_id()
    hoje = date.today()

    # Previsão rápida do mês
    previsao = calcular_previsao_gastos(mes=hoje.month, ano=hoje.year, usuario_id=None)

    # Contagem de alertas ativos
    alertas_ativos = IAAlertaAnomalia.query.filter_by(
        usuario_id=usuario_id,
        status="pendente"
    ).order_by(IAAlertaAnomalia.created_at.desc()).all()

    # Total de análises gravadas
    total_analises = IAAnaliseHistorico.query.filter_by(usuario_id=usuario_id).count()

    # Total de conversas
    total_conversas = IAConversa.query.filter_by(usuario_id=usuario_id).count()

    # Formatar amostra de alertas recentes
    alertas_recentes = []
    for a in alertas_ativos[:4]:
        alertas_recentes.append({
            "id": a.id,
            "tipo_anomalia": a.tipo_anomalia,
            "gravidade": a.gravidade,
            "titulo": a.titulo,
            "descricao": a.descricao,
            "valor_envolvido": float(a.valor_envolvido) if a.valor_envolvido else None,
            "created_at": a.created_at.isoformat() if a.created_at else None
        })

    # Recomendações acionáveis inteligentes
    recomendacoes = []
    if previsao["excedente_previsto"] > 0:
        recomendacoes.append({
            "tipo": "alerta",
            "titulo": "Atenção ao ritmo de consumo",
            "texto": f"A projeção indica que seus gastos podem ultrapassar o teto em R$ {previsao['excedente_previsto']:,.2f}. Considere frear gastos variáveis nos próximos {previsao['dias_restantes']} dias."
        })
    else:
        recomendacoes.append({
            "tipo": "sucesso",
            "titulo": "Orçamento sob controle",
            "texto": f"Seus gastos atuais de R$ {previsao['gasto_acumulado']:,.2f} estão alinhados com o orçamento de R$ {previsao['orcamento_total']:,.2f}."
        })

    top_cat = previsao["categorias_projecao"][:1]
    if top_cat:
        c = top_cat[0]
        recomendacoes.append({
            "tipo": "info",
            "titulo": f"Categoria com maior impacto: {c['categoria']}",
            "texto": f"Representa a maior projeção de desembolso no mês (R$ {c['projecao_fim_mes']:,.2f})."
        })

    return jsonify({
        "periodo": f"{hoje.strftime('%m/%Y')}",
        "kpis": {
            "gasto_acumulado": previsao["gasto_acumulado"],
            "projecao_final": previsao["projecao_final"],
            "orcamento_total": previsao["orcamento_total"],
            "excedente_previsto": previsao["excedente_previsto"],
            "alertas_pendentes": len(alertas_ativos),
            "total_analises": total_analises,
            "total_conversas": total_conversas,
            "grau_confianca_previsao": previsao["grau_confianca"]
        },
        "alertas_recentes": alertas_recentes,
        "recomendacoes": recomendacoes,
        "resumo_previsao": previsao["explicacao_ia"]
    }), 200


# ============================================================================
# 2. ASSISTENTE FINANCEIRO (CONVERSAS E MENSAGENS)
# ============================================================================

@bp_ia.route("/conversas", methods=["GET"])
@jwt_required()
def listar_conversas():
    usuario_id = _get_usuario_id()
    conversas = IAConversa.query.filter_by(usuario_id=usuario_id).order_by(IAConversa.updated_at.desc()).all()
    itens = []
    for c in conversas:
        qtd_msgs = c.mensagens.count()
        itens.append({
            "id": c.id,
            "titulo": c.titulo,
            "created_at": c.created_at.isoformat() if c.created_at else None,
            "updated_at": c.updated_at.isoformat() if c.updated_at else None,
            "total_mensagens": qtd_msgs
        })
    return jsonify({"conversas": itens}), 200


@bp_ia.route("/conversas", methods=["POST"])
@jwt_required()
def criar_conversa():
    usuario_id = _get_usuario_id()
    data = request.get_json() or {}
    titulo = data.get("titulo", "Nova conversa").strip() or "Nova conversa"

    conversa = IAConversa(usuario_id=usuario_id, titulo=titulo)
    db.session.add(conversa)
    db.session.commit()

    return jsonify({
        "id": conversa.id,
        "titulo": conversa.titulo,
        "created_at": conversa.created_at.isoformat()
    }), 201


@bp_ia.route("/conversas/<int:id>", methods=["GET"])
@jwt_required()
def obter_conversa(id):
    usuario_id = _get_usuario_id()
    conversa = IAConversa.query.filter_by(id=id, usuario_id=usuario_id).first_or_404()
    mensagens = conversa.mensagens.all()

    msgs_data = []
    for m in mensagens:
        metadados = None
        if m.metadados_json:
            try:
                metadados = json.loads(m.metadados_json)
            except Exception:
                metadados = None

        msgs_data.append({
            "id": m.id,
            "role": m.role,
            "conteudo": m.conteudo,
            "metadados": metadados,
            "created_at": m.created_at.isoformat() if m.created_at else None
        })

    return jsonify({
        "id": conversa.id,
        "titulo": conversa.titulo,
        "created_at": conversa.created_at.isoformat() if conversa.created_at else None,
        "mensagens": msgs_data
    }), 200


@bp_ia.route("/conversas/<int:id>", methods=["DELETE"])
@jwt_required()
def excluir_conversa(id):
    usuario_id = _get_usuario_id()
    conversa = IAConversa.query.filter_by(id=id, usuario_id=usuario_id).first_or_404()
    db.session.delete(conversa)
    db.session.commit()
    return jsonify({"mensagem": "Conversa excluída com sucesso."}), 200


@bp_ia.route("/conversas/<int:id>/mensagens", methods=["POST"])
@jwt_required()
def enviar_mensagem(id):
    usuario_id = _get_usuario_id()
    data = request.get_json() or {}
    pergunta = data.get("mensagem", "").strip()

    if not pergunta:
        return jsonify({"erro": "O campo 'mensagem' é obrigatório."}), 400

    try:
        resposta = processar_pergunta_assistente(conversa_id=id, usuario_id=usuario_id, pergunta=pergunta)
        return jsonify(resposta), 200
    except Exception as e:
        logger.error(f"Erro ao processar mensagem do assistente: {e}", exc_info=True)
        return jsonify({"erro": f"Não foi possível processar a pergunta: {str(e)}"}), 500


# ============================================================================
# 3. PREVISÃO DE GASTOS
# ============================================================================

@bp_ia.route("/previsao", methods=["GET"])
@jwt_required()
def obter_previsao():
    usuario_id = _get_usuario_id()
    mes = request.args.get("mes", type=int)
    ano = request.args.get("ano", type=int)

    resultado = calcular_previsao_gastos(mes=mes, ano=ano, usuario_id=usuario_id)
    return jsonify(resultado), 200


# ============================================================================
# 4. ANOMALIAS E ALERTAS
# ============================================================================

@bp_ia.route("/anomalias", methods=["GET"])
@jwt_required()
def listar_anomalias():
    usuario_id = _get_usuario_id()
    status_filtro = request.args.get("status")  # pendente, lido, resolvido, todos
    gravidade_filtro = request.args.get("gravidade")

    query = IAAlertaAnomalia.query.filter_by(usuario_id=usuario_id)

    if status_filtro and status_filtro != "todos":
        query = query.filter_by(status=status_filtro)
    if gravidade_filtro:
        query = query.filter_by(gravidade=gravidade_filtro)

    alertas = query.order_by(IAAlertaAnomalia.created_at.desc()).all()

    itens = []
    for a in alertas:
        itens.append({
            "id": a.id,
            "tipo_anomalia": a.tipo_anomalia,
            "gravidade": a.gravidade,
            "titulo": a.titulo,
            "descricao": a.descricao,
            "valor_envolvido": float(a.valor_envolvido) if a.valor_envolvido else None,
            "transacao_id": a.transacao_id,
            "categoria_id": a.categoria_id,
            "categoria_nome": a.categoria.nome if a.categoria else None,
            "status": a.status,
            "created_at": a.created_at.isoformat() if a.created_at else None
        })

    return jsonify({"alertas": itens}), 200


@bp_ia.route("/anomalias/analisar", methods=["POST"])
@jwt_required()
def executar_analise_anomalias():
    usuario_id = _get_usuario_id()
    res = detectar_e_atualizar_anomalias(usuario_id=usuario_id)
    return jsonify(res), 200


@bp_ia.route("/anomalias/<int:id>", methods=["PATCH"])
@jwt_required()
def atualizar_status_anomalia(id):
    usuario_id = _get_usuario_id()
    alerta = IAAlertaAnomalia.query.filter_by(id=id, usuario_id=usuario_id).first_or_404()
    data = request.get_json() or {}
    novo_status = data.get("status")

    if novo_status not in ("pendente", "lido", "resolvido", "ignorado"):
        return jsonify({"erro": "Status inválido."}), 400

    alerta.status = novo_status
    db.session.commit()
    return jsonify({"mensagem": "Status atualizado com sucesso.", "status": alerta.status}), 200


# ============================================================================
# 5. HISTÓRICO DE ANÁLISES E CONSUMO
# ============================================================================

@bp_ia.route("/historico", methods=["GET"])
@jwt_required()
def listar_historico():
    usuario_id = _get_usuario_id()
    tipo = request.args.get("tipo")
    query = IAAnaliseHistorico.query.filter_by(usuario_id=usuario_id)
    if tipo:
        query = query.filter_by(tipo_analise=tipo)

    analises = query.order_by(IAAnaliseHistorico.created_at.desc()).limit(50).all()
    itens = []
    for a in analises:
        res_json = None
        recom_json = None
        if a.resultado_json:
            try:
                res_json = json.loads(a.resultado_json)
            except Exception:
                res_json = None
        if a.recomendacoes_json:
            try:
                recom_json = json.loads(a.recomendacoes_json)
            except Exception:
                recom_json = None

        itens.append({
            "id": a.id,
            "tipo_analise": a.tipo_analise,
            "periodo_referencia": a.periodo_referencia,
            "titulo": a.titulo,
            "resultado": res_json,
            "recomendacoes": recom_json,
            "origem": a.origem,
            "created_at": a.created_at.isoformat() if a.created_at else None
        })

    return jsonify({"historico": itens}), 200


@bp_ia.route("/consumo", methods=["GET"])
@jwt_required()
def obter_consumo():
    usuario_id = _get_usuario_id()
    logs = IAConsumoLog.query.filter_by(usuario_id=usuario_id).order_by(IAConsumoLog.created_at.desc()).limit(100).all()

    total_prompt = sum(l.tokens_prompt for l in logs)
    total_completion = sum(l.tokens_completion for l in logs)
    total_custo = sum(float(l.custo_estimado_usd) for l in logs)

    return jsonify({
        "total_chamadas": len(logs),
        "total_tokens_prompt": total_prompt,
        "total_tokens_completion": total_completion,
        "total_tokens": total_prompt + total_completion,
        "custo_estimado_usd": round(total_custo, 4),
        "logs_recentes": [
            {
                "id": l.id,
                "funcionalidade": l.funcionalidade,
                "modelo": l.modelo,
                "tokens": l.tokens_prompt + l.tokens_completion,
                "custo_usd": float(l.custo_estimado_usd),
                "created_at": l.created_at.isoformat() if l.created_at else None
            }
            for l in logs[:15]
        ]
    }), 200


# ============================================================================
# 6. CLASSIFICAÇÃO DE CATEGORIAS (ROTA EXISTENTE PRESERVADA)
# ============================================================================

@bp_ia.route("/classificar_categoria", methods=["POST"])
def classificar_categoria():
    data = request.get_json() or {}
    descricoes = data.get("descricoes", [])
    if not isinstance(descricoes, list):
        descricoes = []
    descricoes = [desc if isinstance(desc, str) else "" for desc in descricoes]

    if not descricoes:
        return jsonify({"categorias": [], "classificacoes": []})

    engine = CategorizationEngine()
    try:
        resultados = engine.categorizar_lote(descricoes)
        categorias = [r.categoria for r in resultados]
        classificacoes = [r.to_dict() for r in resultados]

        return jsonify({
            "categorias": categorias,
            "classificacoes": classificacoes
        })
    except Exception as e:
        logger.error(f"Erro ao classificar categorias: {e}", exc_info=True)
        return jsonify({
            "categorias": ["Indefinida"] * len(descricoes),
            "classificacoes": [],
            "erro": str(e)
        }), 500
