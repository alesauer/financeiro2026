import os
import json
import logging
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple
from app import db
from app.models import IAConsumoLog, Configuracao

logger = logging.getLogger(__name__)

# Preços estimados gpt-4o-mini (USD por token)
COST_OPENAI_INPUT = Decimal("0.00000015")   # $0.15 / 1M tokens
COST_OPENAI_OUTPUT = Decimal("0.00000060")  # $0.60 / 1M tokens

# Preços estimados DeepSeek-V3 (USD por token)
COST_DEEPSEEK_INPUT = Decimal("0.00000014")   # $0.14 / 1M tokens
COST_DEEPSEEK_OUTPUT = Decimal("0.00000028")  # $0.28 / 1M tokens

KEY_IA_CONFIG = "ia_config"
DEEPSEEK_BASE_URL = "https://api.deepseek.com"


def ensure_no_proxy():
    """Garante que as APIs de IA não passem por proxies corporativos que possam bloquear."""
    hosts = ["api.openai.com", "api.deepseek.com"]
    for var in ["NO_PROXY", "no_proxy"]:
        current = os.environ.get(var, "")
        items = [x.strip() for x in current.split(",") if x.strip()]
        for h in hosts:
            if h not in items:
                items.append(h)
        os.environ[var] = ",".join(items)


def get_ia_config() -> Dict[str, Any]:
    """Retorna a configuração consolidada de IA do banco ou ambiente."""
    default_config = {
        "provedor_ativo": "deepseek" if (os.getenv("DEEPSEEK_API_KEY") or os.getenv("OPENAI_API_KEY")) else "deepseek",
        "deepseek_api_key": os.getenv("DEEPSEEK_API_KEY", ""),
        "deepseek_modelo": "deepseek-chat",
        "openai_api_key": os.getenv("OPENAI_API_KEY", ""),
        "openai_modelo": "gpt-4o-mini"
    }

    try:
        cfg = Configuracao.query.filter_by(chave=KEY_IA_CONFIG).first()
        if cfg and cfg.valor:
            data = json.loads(cfg.valor)
            default_config.update(data)
    except Exception as e:
        logger.warning(f"Erro ao ler configuração de IA do banco: {e}")

    # Fallback para variável de ambiente se a chave vier vazia do banco
    if not default_config.get("deepseek_api_key"):
        default_config["deepseek_api_key"] = os.getenv("DEEPSEEK_API_KEY", "")
    if not default_config.get("openai_api_key"):
        default_config["openai_api_key"] = os.getenv("OPENAI_API_KEY", "")

    return default_config


def salvar_ia_config(dados: Dict[str, Any]):
    """Salva a configuração de IA no banco de dados."""
    cfg = Configuracao.query.filter_by(chave=KEY_IA_CONFIG).first()
    if cfg is None:
        cfg = Configuracao(chave=KEY_IA_CONFIG, valor=json.dumps(dados, ensure_ascii=False))
        db.session.add(cfg)
    else:
        cfg.valor = json.dumps(dados, ensure_ascii=False)
    db.session.commit()


def get_ai_client(provedor_override: Optional[str] = None) -> Tuple[Optional[Any], str, str]:
    """
    Retorna uma tupla (client, modelo, provedor).
    Suporta tanto DeepSeek quanto OpenAI.
    """
    ensure_no_proxy()
    config = get_ia_config()
    provedor = (provedor_override or config.get("provedor_ativo") or "deepseek").lower()

    try:
        import openai
    except ImportError:
        logger.warning("Biblioteca 'openai' não instalada.")
        return None, "", provedor

    if provedor == "deepseek":
        api_key = config.get("deepseek_api_key") or os.getenv("DEEPSEEK_API_KEY", "")
        modelo = config.get("deepseek_modelo") or "deepseek-chat"
        if not api_key:
            return None, modelo, provedor
        try:
            client = openai.OpenAI(
                api_key=api_key,
                base_url=DEEPSEEK_BASE_URL,
                max_retries=1,
                timeout=35.0
            )
            return client, modelo, provedor
        except Exception as e:
            logger.warning(f"Erro ao inicializar cliente DeepSeek: {e}")
            return None, modelo, provedor
    else:
        # OpenAI
        api_key = config.get("openai_api_key") or os.getenv("OPENAI_API_KEY", "")
        modelo = config.get("openai_modelo") or "gpt-4o-mini"
        if not api_key:
            return None, modelo, provedor
        try:
            client = openai.OpenAI(
                api_key=api_key,
                max_retries=1,
                timeout=30.0
            )
            return client, modelo, provedor
        except Exception as e:
            logger.warning(f"Erro ao inicializar cliente OpenAI: {e}")
            return None, modelo, provedor


def get_openai_client():
    """Mantido para compatibilidade reversa. Retorna o cliente do provedor ativo."""
    client, _, _ = get_ai_client()
    return client


def registrar_consumo(
    usuario_id: int,
    funcionalidade: str,
    modelo: str,
    prompt_tokens: int,
    completion_tokens: int
):
    try:
        if "deepseek" in modelo.lower():
            custo = (Decimal(prompt_tokens) * COST_DEEPSEEK_INPUT) + (Decimal(completion_tokens) * COST_DEEPSEEK_OUTPUT)
        else:
            custo = (Decimal(prompt_tokens) * COST_OPENAI_INPUT) + (Decimal(completion_tokens) * COST_OPENAI_OUTPUT)

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

