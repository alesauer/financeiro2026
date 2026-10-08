from flask import Blueprint, request, jsonify
import logging
from services.categorization import CategorizationEngine

logger = logging.getLogger(__name__)

bp_ia = Blueprint("ia", __name__)


@bp_ia.route("/classificar_categoria", methods=["POST"])
def classificar_categoria():
    """Endpoint unificado de classificação híbrida inteligente.

    Recebe:
        {"descricoes": ["UBER *TRIP", "POSTO SHELL", ...]}

    Retorna:
        {
            "categorias": ["Transporte", "Combustível", ...],
            "classificacoes": [
                {
                    "categoria": "Transporte",
                    "categoria_id": 4,
                    "confianca": 0.95,
                    "metodo": "regra",
                    "motivo": "Regra determinística para 'UBER TRIP'",
                    "descricao_original": "UBER *TRIP",
                    "descricao_normalizada": "UBER TRIP"
                },
                ...
            ]
        }
    """
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
