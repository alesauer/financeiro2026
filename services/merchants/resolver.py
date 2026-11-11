import re
from functools import lru_cache
from typing import Dict, Any, Optional

from services.categorization.normalizer import normalizar_descricao
from .catalog import MARCAS_CATALOGO, MARCAS_INDEX


def _gerar_url_google_favicon(dominio: str) -> str:
    """Gera a URL oficial do favicon do Google em alta resolução (128px)."""
    return f"https://www.google.com/s2/favicons?domain={dominio.lower().strip()}&sz=128"


@lru_cache(maxsize=2048)
def obter_info_estabelecimento(descricao_raw: str | None) -> Dict[str, Any]:
    """Identifica a marca/estabelecimento a partir da descrição da transação.

    Retorna um dicionário com:
    - 'nome': Nome amigável formatado da empresa (ex: 'Mercado Livre', 'iFood')
    - 'dominio': Domínio da marca (ex: 'mercadolivre.com.br')
    - 'logo_url': URL do logo/favicon em 128px
    - 'cor': Cor primária da marca para fallback de background
    - 'encontrado': bool indicando se foi reconhecido no catálogo
    """
    if not descricao_raw or not descricao_raw.strip():
        return {
            "nome": None,
            "dominio": None,
            "logo_url": None,
            "cor": None,
            "encontrado": False,
        }

    raw = descricao_raw.strip()
    norm = normalizar_descricao(raw)
    norm_compacta = norm.replace(" ", "")
    raw_compacta = raw.upper().replace(" ", "").replace("*", "").replace(".", "")

    # 1. Lookup direto O(1) no índice de aliases
    if raw_compacta in MARCAS_INDEX:
        m = MARCAS_INDEX[raw_compacta]
        return {
            "nome": m["nome"],
            "dominio": m["dominio"],
            "logo_url": _gerar_url_google_favicon(m["dominio"]),
            "cor": m.get("cor"),
            "encontrado": True,
        }

    if norm_compacta in MARCAS_INDEX:
        m = MARCAS_INDEX[norm_compacta]
        return {
            "nome": m["nome"],
            "dominio": m["dominio"],
            "logo_url": _gerar_url_google_favicon(m["dominio"]),
            "cor": m.get("cor"),
            "encontrado": True,
        }

    # 2. Busca por substring nos aliases
    for m in MARCAS_CATALOGO:
        for alias in m["aliases"]:
            alias_limpo = alias.upper().strip()
            # Match por palavra inteira ou substring relevante
            if len(alias_limpo) >= 3 and (alias_limpo in raw.upper() or alias_limpo in norm):
                return {
                    "nome": m["nome"],
                    "dominio": m["dominio"],
                    "logo_url": _gerar_url_google_favicon(m["dominio"]),
                    "cor": m.get("cor"),
                    "encontrado": True,
                }

    # 3. Detectar se a descrição contém um domínio web explícito (ex: LOJAVIDAECOR.COM, DL*ALIEXPRESS.COM)
    match_domain = re.search(r"\b([a-zA-Z0-9-]+\.(?:com\.br|com|net|org|io|dev|app))\b", raw, re.IGNORECASE)
    if match_domain:
        dom = match_domain.group(1).lower()
        nome_marca = dom.split(".")[0].capitalize()
        return {
            "nome": nome_marca,
            "dominio": dom,
            "logo_url": _gerar_url_google_favicon(dom),
            "cor": "#4F46E5",
            "encontrado": True,
        }

    # 4. Estabelecimento local ou não reconhecido
    return {
        "nome": norm if norm else raw,
        "dominio": None,
        "logo_url": None,
        "cor": None,
        "encontrado": False,
    }


def resolver_logo_estabelecimento(descricao_raw: str | None) -> Optional[str]:
    """Retorna apenas a URL do logo ou None."""
    info = obter_info_estabelecimento(descricao_raw)
    return info.get("logo_url")

