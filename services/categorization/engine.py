from dataclasses import dataclass, asdict
import logging
from collections import Counter
from app import db
from app.models import Categoria, CategoriaAlias
from .normalizer import normalizar_descricao, remover_acentos
from .rules import classificar_por_regras
from .history import (
    buscar_em_aliases,
    construir_indice_historico,
    buscar_em_historico_transacoes,
    salvar_ou_atualizar_alias,
)
from .fuzzy import buscar_por_similaridade, DEFAULT_FUZZY_THRESHOLD
from .ai import classificar_com_ia

logger = logging.getLogger(__name__)


@dataclass
class CategorizationResult:
    categoria: str
    categoria_id: int | None
    confianca: float
    metodo: str  # "alias", "regra", "historico", "fuzzy", "ia", "fallback"
    motivo: str
    descricao_original: str
    descricao_normalizada: str

    def to_dict(self) -> dict:
        return asdict(self)


class CategorizationEngine:
    """Motor híbrido inteligente de categorização financeira em camadas."""

    def __init__(
        self,
        usar_ia: bool = True,
        threshold_fuzzy: float = DEFAULT_FUZZY_THRESHOLD,
        auto_salvar_aliases: bool = True,
        tipo_esperado: str = "Despesa"
    ):
        self.usar_ia = usar_ia
        self.threshold_fuzzy = threshold_fuzzy
        self.auto_salvar_aliases = auto_salvar_aliases
        self.tipo_esperado = tipo_esperado

        self.categorias_map: dict[str, int] = {}  # Nome -> ID
        self.categorias_nomes: list[str] = []
        self.aliases_map: dict[str, tuple[str, int, float, str]] = {}  # norm -> (nome, id, conf, origem)
        self.historico_counts: dict[str, Counter] = {}
        self.token_index: dict[str, set[str]] = {}
        self._contexto_carregado = False

    def carregar_contexto(self, force: bool = False):
        """Carrega e indexa todas as categorias, aliases e histórico do banco de dados."""
        if self._contexto_carregado and not force:
            return

        try:
            # 1. Carregar categorias cadastradas (filtrando/priorizando tipo esperado)
            query = Categoria.query
            if self.tipo_esperado:
                cats_tipo = query.filter_by(tipo=self.tipo_esperado).all()
                if cats_tipo:
                    cats = cats_tipo
                else:
                    cats = query.all()
            else:
                cats = query.all()

            self.categorias_map = {c.nome: c.id for c in cats}
            self.categorias_nomes = [c.nome for c in cats]

            # 2. Carregar aliases (ignora Outros/Indefinida e garante conformidade de tipo)
            aliases = CategoriaAlias.query.all()
            self.aliases_map = {}
            for a in aliases:
                if a.categoria and a.descricao_normalizada and a.categoria.nome not in ("Outros", "Indefinida"):
                    if self.tipo_esperado and a.categoria.tipo != self.tipo_esperado:
                        continue
                    conf = float(a.confianca or (1.0 if a.origem == 'usuario' else 0.90))
                    origem = a.origem or 'usuario'
                    self.aliases_map[a.descricao_normalizada] = (a.categoria.nome, a.categoria_id, conf, origem)

            # 3. Construir índice de histórico de transações
            self.historico_counts, self.token_index = construir_indice_historico(limite=5000)
            self._contexto_carregado = True
        except Exception as e:
            logger.warning(f"Erro ao carregar contexto de categorização: {e}")
            self._contexto_carregado = False

    def _obter_categoria_id(self, nome: str | None) -> int | None:
        if not nome or not isinstance(nome, str):
            return None
        if nome in self.categorias_map:
            return self.categorias_map[nome]
        # Tentativa insensível a acentos/maiúsculas
        norm_nome = remover_acentos(nome).upper()
        for k, v in self.categorias_map.items():
            if remover_acentos(k).upper() == norm_nome:
                return v
        return None

    def categorizar_uma(self, descricao: str) -> CategorizationResult:
        """Categoriza uma única descrição executando todas as camadas."""
        resultados = self.categorizar_lote([descricao])
        return resultados[0] if resultados else CategorizationResult(
            categoria="Outros",
            categoria_id=self._obter_categoria_id("Outros"),
            confianca=0.0,
            metodo="fallback",
            motivo="Descrição vazia",
            descricao_original=descricao or "",
            descricao_normalizada=""
        )

    def categorizar_lote(self, descricoes: list[str]) -> list[CategorizationResult]:
        """Categoriza um lote de descrições resolvendo camadas 1-4 localmente e lote de IA na camada 5."""
        self.carregar_contexto()

        resultados: list[CategorizationResult | None] = [None] * len(descricoes)
        pendentes_ia: list[tuple[int, str, str]] = []  # (index, desc_orig, desc_norm)

        # Candidatos para busca fuzzy (Aliases + histórico com alta frequência)
        candidatos_fuzzy: dict[str, tuple[str, int]] = {}
        for norm, (cat_nome, cat_id, _, _) in self.aliases_map.items():
            candidatos_fuzzy[norm] = (cat_nome, cat_id)
        for norm, contagem in self.historico_counts.items():
            if norm not in candidatos_fuzzy and contagem:
                (cat_nome, cat_id), _ = contagem.most_common(1)[0]
                candidatos_fuzzy[norm] = (cat_nome, cat_id)

        for idx, desc in enumerate(descricoes):
            desc_orig = desc or ""
            desc_norm = normalizar_descricao(desc_orig)

            if not desc_norm:
                resultados[idx] = CategorizationResult(
                    categoria="Outros",
                    categoria_id=self._obter_categoria_id("Outros"),
                    confianca=0.0,
                    metodo="fallback",
                    motivo="Descrição vazia",
                    descricao_original=desc_orig,
                    descricao_normalizada=""
                )
                continue

            # CAMADA 1: Aliases diretos (Maior prioridade / Zero custo)
            if desc_norm in self.aliases_map:
                cat_nome, cat_id, conf, origem = self.aliases_map[desc_norm]
                motivo = f"Alias confirmado ({origem})" if origem == "usuario" else f"Alias ({origem})"
                resultados[idx] = CategorizationResult(
                    categoria=cat_nome,
                    categoria_id=cat_id,
                    confianca=conf,
                    metodo="alias",
                    motivo=motivo,
                    descricao_original=desc_orig,
                    descricao_normalizada=desc_norm
                )
                continue

            # CAMADA 2: Regras determinísticas (Regex / Palavras-chave de merchants conhecidos)
            match_regra = classificar_por_regras(desc_norm, self.categorias_map)
            if match_regra:
                cat_nome, conf = match_regra
                cat_id = self._obter_categoria_id(cat_nome)
                resultados[idx] = CategorizationResult(
                    categoria=cat_nome,
                    categoria_id=cat_id,
                    confianca=conf,
                    metodo="regra",
                    motivo=f"Regra determinística para '{desc_norm}'",
                    descricao_original=desc_orig,
                    descricao_normalizada=desc_norm
                )
                continue

            # CAMADA 3: Histórico de transações com dominância
            match_hist = buscar_em_historico_transacoes(desc_norm, self.historico_counts)
            if match_hist:
                cat_nome, cat_id, conf = match_hist
                resultados[idx] = CategorizationResult(
                    categoria=cat_nome,
                    categoria_id=cat_id,
                    confianca=conf,
                    metodo="historico",
                    motivo="Histórico recorrente do usuário",
                    descricao_original=desc_orig,
                    descricao_normalizada=desc_norm
                )
                continue

            # CAMADA 4: Fuzzy Matching (Similaridade com estabelecimentos conhecidos)
            match_fuzzy = buscar_por_similaridade(desc_norm, candidatos_fuzzy, threshold=self.threshold_fuzzy)
            if match_fuzzy:
                cat_nome, cat_id, score, match_orig = match_fuzzy
                resultados[idx] = CategorizationResult(
                    categoria=cat_nome,
                    categoria_id=cat_id,
                    confianca=score,
                    metodo="fuzzy",
                    motivo=f"Similar a '{match_orig}' ({int(score * 100)}%)",
                    descricao_original=desc_orig,
                    descricao_normalizada=desc_norm
                )
                continue

            # Itens restantes vão para a IA (Camada 5)
            pendentes_ia.append((idx, desc_orig, desc_norm))

        # CAMADA 5: IA (OpenAI) para itens pendentes
        if pendentes_ia and self.usar_ia:
            descricoes_para_ia = [p[1] for p in pendentes_ia]
            classificacoes_ia = classificar_com_ia(descricoes_para_ia, self.categorias_nomes)

            for (orig_idx, desc_orig, desc_norm), ia_res in zip(pendentes_ia, classificacoes_ia):
                cat_sugerida = ia_res.get("categoria", "Outros")
                conf = float(ia_res.get("confianca", 0.70))
                motivo = ia_res.get("motivo", "Classificação inteligente por IA")
                cat_id = self._obter_categoria_id(cat_sugerida)

                metodo = "ia" if conf >= 0.50 and cat_sugerida != "Indefinida" else "fallback"

                resultados[orig_idx] = CategorizationResult(
                    categoria=cat_sugerida,
                    categoria_id=cat_id,
                    confianca=conf,
                    metodo=metodo,
                    motivo=motivo,
                    descricao_original=desc_orig,
                    descricao_normalizada=desc_norm
                )

                # Salvar como alias com origem 'ia' se confiança for boa
                if self.auto_salvar_aliases and cat_id and conf >= 0.75 and desc_norm:
                    try:
                        salvar_ou_atualizar_alias(
                            descricao_original=desc_orig,
                            categoria_id=cat_id,
                            origem="ia",
                            confianca=conf,
                            commit=True
                        )
                        self.aliases_map[desc_norm] = (cat_sugerida, cat_id, conf, "ia")
                    except Exception as ex:
                        logger.debug(f"Falha ao salvar alias automático de IA: {ex}")

        # Se ainda houver itens nulos (ex: IA desativada ou sem resposta), fallback
        for idx in range(len(resultados)):
            if resultados[idx] is None:
                desc_orig = descricoes[idx] or ""
                desc_norm = normalizar_descricao(desc_orig)
                cat_default = "Outros" if "Outros" in self.categorias_map else "Indefinida"
                resultados[idx] = CategorizationResult(
                    categoria=cat_default,
                    categoria_id=self._obter_categoria_id(cat_default),
                    confianca=0.0,
                    metodo="fallback",
                    motivo="Não foi possível categorizar automaticamente",
                    descricao_original=desc_orig,
                    descricao_normalizada=desc_norm
                )

        return [r for r in resultados if r is not None]
