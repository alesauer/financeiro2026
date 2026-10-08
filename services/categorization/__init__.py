from .engine import CategorizationEngine, CategorizationResult
from .normalizer import normalizar_descricao, extrair_tokens, remover_acentos
from .rules import classificar_por_regras
from .history import buscar_em_aliases, salvar_ou_atualizar_alias
from .fuzzy import buscar_por_similaridade
from .ai import classificar_com_ia


_engine_singleton = None


def get_engine() -> CategorizationEngine:
    """Retorna instância singleton do CategorizationEngine."""
    global _engine_singleton
    if _engine_singleton is None:
        _engine_singleton = CategorizationEngine()
    return _engine_singleton


def categorizar_transacao(descricao: str) -> CategorizationResult:
    """Função utilitária direta para categorizar uma transação."""
    return get_engine().categorizar_uma(descricao)


def categorizar_lote(descricoes: list[str]) -> list[CategorizationResult]:
    """Função utilitária direta para categorizar um lote de transações."""
    return get_engine().categorizar_lote(descricoes)


__all__ = [
    "CategorizationEngine",
    "CategorizationResult",
    "get_engine",
    "categorizar_transacao",
    "categorizar_lote",
    "normalizar_descricao",
    "extrair_tokens",
    "remover_acentos",
    "classificar_por_regras",
    "buscar_em_aliases",
    "salvar_ou_atualizar_alias",
    "buscar_por_similaridade",
    "classificar_com_ia",
]
