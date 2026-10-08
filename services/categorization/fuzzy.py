from difflib import SequenceMatcher
from .normalizer import normalizar_descricao, extrair_tokens


DEFAULT_FUZZY_THRESHOLD = 0.85


def calcular_similaridade(texto_a: str, texto_b: str) -> float:
    """Calcula similaridade combinando SequenceMatcher e sobreposição de tokens."""
    if not texto_a or not texto_b:
        return 0.0
    if texto_a == texto_b:
        return 1.0

    # 1. Ratio direto de caracteres
    ratio_seq = SequenceMatcher(None, texto_a, texto_b).ratio()

    # 2. Containment direto de substring
    if texto_a in texto_b or texto_b in texto_a:
        len_min = min(len(texto_a), len(texto_b))
        len_max = max(len(texto_a), len(texto_b))
        if len_min >= 4 and (len_min / len_max) >= 0.50:
            return max(ratio_seq, 0.88)

    # 3. Sobreposição de tokens
    tokens_a = extrair_tokens(texto_a)
    tokens_b = extrair_tokens(texto_b)
    if tokens_a and tokens_b:
        intersecao = len(tokens_a.intersection(tokens_b))
        uniao = len(tokens_a.union(tokens_b))
        min_tokens = min(len(tokens_a), len(tokens_b))
        
        # Se um conjunto de tokens estiver contido no outro
        if min_tokens > 0 and (intersecao / min_tokens) >= 1.0:
            return max(ratio_seq, 0.85)

        jaccard = (intersecao / uniao) if uniao else 0.0
        if jaccard >= 0.50:
            return max(ratio_seq, 0.80 + (jaccard * 0.15))

    return ratio_seq


def buscar_por_similaridade(
    descricao: str,
    candidatos_map: dict[str, tuple[str, int]],
    threshold: float = DEFAULT_FUZZY_THRESHOLD
) -> tuple[str, int, float, str] | None:
    """Busca o melhor candidato por similaridade aproximada.

    Args:
        descricao: Descrição da transação a classificar
        candidatos_map: Dicionário {descricao_normalizada: (categoria_nome, categoria_id)}
        threshold: Score mínimo para aceitação

    Retorna:
        (categoria_nome, categoria_id, score, match_descricao) ou None
    """
    desc_norm = normalizar_descricao(descricao)
    if not desc_norm or not candidatos_map:
        return None

    tokens_busca = extrair_tokens(desc_norm)

    melhor_match = None
    melhor_score = 0.0
    melhor_cat_nome = None
    melhor_cat_id = None

    for cand_norm, (cat_nome, cat_id) in candidatos_map.items():
        if not cand_norm:
            continue

        # Otimização: se tiver tokens em comum ou similaridade de prefixo
        tokens_cand = extrair_tokens(cand_norm)
        if tokens_busca and tokens_cand and not tokens_busca.intersection(tokens_cand) and desc_norm[:4] != cand_norm[:4]:
            continue

        score = calcular_similaridade(desc_norm, cand_norm)
        if score > melhor_score:
            melhor_score = score
            melhor_match = cand_norm
            melhor_cat_nome = cat_nome
            melhor_cat_id = cat_id

    if melhor_score >= threshold and melhor_cat_nome:
        return melhor_cat_nome, melhor_cat_id, round(melhor_score, 2), melhor_match

    return None
