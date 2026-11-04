from collections import Counter, defaultdict
from app import db
from app.models import Categoria, CategoriaAlias, Transacao
from .normalizer import normalizar_descricao, extrair_tokens


def buscar_em_aliases(descricao: str) -> tuple[str, int, float, str] | None:
    """Busca correspondência direta na tabela de categorias_alias.

    Retorna:
        (categoria_nome, categoria_id, confianca, origem) ou None
    """
    desc_norm = normalizar_descricao(descricao)
    if not desc_norm:
        return None

    alias = CategoriaAlias.query.filter_by(descricao_normalizada=desc_norm).first()
    if alias and alias.categoria:
        conf = float(alias.confianca or (1.0 if alias.origem == 'usuario' else 0.90))
        origem = alias.origem or 'usuario'
        return alias.categoria.nome, alias.categoria_id, conf, origem

    return None


def salvar_ou_atualizar_alias(
    descricao_original: str,
    categoria_id: int,
    origem: str = "usuario",
    confianca: float = 1.0,
    commit: bool = True
) -> CategoriaAlias | None:
    """Registra ou atualiza o aprendizado de uma categoria para um estabelecimento."""
    desc_norm = normalizar_descricao(descricao_original)
    if not desc_norm or not categoria_id:
        return None

    try:
        with db.session.begin_nested():
            alias = CategoriaAlias.query.filter_by(descricao_normalizada=desc_norm).first()
            if alias:
                alias.categoria_id = categoria_id
                alias.descricao_exemplo = descricao_original[:255]
                alias.ocorrencias = (alias.ocorrencias or 0) + 1
                # Decisão manual do usuário sempre sobrepõe classificação de IA/regras
                if origem == "usuario" or alias.origem != "usuario":
                    alias.origem = origem
                    alias.confianca = confianca
            else:
                alias = CategoriaAlias(
                    descricao_normalizada=desc_norm,
                    descricao_exemplo=descricao_original[:255],
                    categoria_id=categoria_id,
                    ocorrencias=1,
                    origem=origem,
                    confianca=confianca
                )
                db.session.add(alias)
        if commit:
            db.session.commit()
        return alias
    except Exception:
        return None


def construir_indice_historico(limite: int = 5000) -> tuple[dict[str, Counter], dict[str, set[str]]]:
    """Constrói índice de frequência a partir das transações passadas do usuário."""
    historico_counts: dict[str, Counter] = defaultdict(Counter)
    token_index: dict[str, set[str]] = defaultdict(set)

    rows = (
        db.session.query(Transacao.descricao, Categoria.nome, Categoria.id)
        .join(Categoria, Categoria.id == Transacao.categoria_id)
        .filter(
            Transacao.descricao.isnot(None),
            Categoria.tipo == "Despesa",
            Categoria.nome.notin_(["Outros", "Indefinida"])
        )
        .order_by(Transacao.id.desc())
        .limit(limite)
        .all()
    )

    for desc_orig, cat_nome, cat_id in rows:
        norm = normalizar_descricao(desc_orig)
        if not norm:
            continue
        historico_counts[norm][(cat_nome, cat_id)] += 1
        for token in extrair_tokens(norm):
            token_index[token].add(norm)

    return historico_counts, token_index


def buscar_em_historico_transacoes(
    descricao: str,
    historico_counts: dict[str, Counter],
    min_ocorrencias: int = 1,
    min_dominancia: float = 0.70
) -> tuple[str, int, float] | None:
    """Busca categoria no histórico de transações normalizado."""
    desc_norm = normalizar_descricao(descricao)
    if not desc_norm or desc_norm not in historico_counts:
        return None

    contagem = historico_counts[desc_norm]
    if not contagem:
        return None

    (cat_nome, cat_id), ocorrencias_top = contagem.most_common(1)[0]
    total = sum(contagem.values())
    dominancia = (ocorrencias_top / total) if total else 0.0

    if ocorrencias_top >= min_ocorrencias and dominancia >= min_dominancia:
        conf = 0.95 if ocorrencias_top >= 3 else 0.90
        return cat_nome, cat_id, conf

    return None
