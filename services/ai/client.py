import os
import json
import logging
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple
from app import db
from app.models import IAConsumoLog

logger = logging.getLogger(__name__)

# Preços estimados gpt-4o-mini (USD por token)
COST_INPUT_PER_TOKEN = Decimal("0.00000015")   # $0.15 / 1M tokens
COST_OUTPUT_PER_TOKEN = Decimal("0.00000060")  # $0.60 / 1M tokens


def get_openai_client():
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return None
    try:
        import openai
        return openai.OpenAI(api_key=api_key, max_retries=1, timeout=30.0)
    except Exception as e:
        logger.warning(f"Não foi possível inicializar cliente OpenAI: {e}")
        return None


def registrar_consumo(
    usuario_id: int,
    funcionalidade: str,
    modelo: str,
    prompt_tokens: int,
    completion_tokens: int
):
    try:
        custo = (Decimal(prompt_tokens) * COST_INPUT_PER_TOKEN) + (Decimal(completion_tokens) * COST_OUTPUT_PER_TOKEN)
        log = IAConsumoLog(
            usuario_id=usuario_id,
            funcionalidade=funcionalidade,
            modelo=modelo,
            tokens_prompt=prompt_tokens,
            tokens_completion=completion_tokens,
            custo_estimado_usd=custo
        )
        db.session.add(log)
        db.session.commit()
    except Exception as e:
        logger.error(f"Erro ao registrar consumo de IA: {e}")
        db.session.rollback()

