
from flask import Blueprint, request, jsonify
import json
import openai
import os
import re
from collections import Counter, defaultdict
from difflib import SequenceMatcher
from app.models import Categoria, CategoriaAlias, Transacao
from app import db
from app.utils.texto import normalizar_texto

bp_ia = Blueprint("ia", __name__)

# Configure sua chave da OpenAI
openai.api_key = os.getenv("OPENAI_API_KEY")  # Ou defina diretamente: openai.api_key = 'SUA_CHAVE_AQUI'


def _normalizar_categoria(valor):
    texto = (valor or "").strip()
    return texto if texto else "Indefinida"


def _extrair_lista_categorias(conteudo, quantidade):
    lista = []
    try:
        parsed = json.loads(conteudo)
        if isinstance(parsed, dict):
            lista = parsed.get("categorias", []) or []
        elif isinstance(parsed, list):
            lista = parsed
        else:
            lista = []
    except json.JSONDecodeError:
        lista = [linha.strip() for linha in conteudo.splitlines() if linha.strip()]
    if len(lista) < quantidade:
        lista.extend(["Indefinida"] * (quantidade - len(lista)))
    return [_normalizar_categoria(cat) for cat in lista[:quantidade]]


def _merchant_hint(descricao: str) -> str:
    texto = normalizar_texto(descricao or "")
    texto = re.sub(r"\b(parcela|parc)\b.*", "", texto, flags=re.IGNORECASE).strip()
    texto = re.sub(r"\s+", " ", texto)
    return texto[:80]


def _categoria_por_regras(descricao: str, categorias_validas: list[str]) -> str | None:
    texto = normalizar_texto(descricao or "")
    if not texto:
        return None

    regras = [
        (["ifood", "ubereats", "restaurant", "restaurante", "lanchonete", "padaria", "mercado", "supermercado"], "Alimentação"),
        (["uber", "99", "taxi", "combustivel", "posto", "shell", "ipiranga", "estacionamento", "pedagio"], "Transporte"),
        (["farmacia", "drogaria", "droga", "hospital", "clinica", "laboratorio", "medico"], "Saúde"),
        (["netflix", "spotify", "prime video", "disney", "hbo", "stream", "cinema"], "Lazer"),
        (["energia", "enel", "cemig", "sabesp", "sanepar", "vivo", "claro", "tim", "internet", "telefone"], "Contas"),
        (["escola", "faculdade", "curso", "udemy", "alura", "livro"], "Educação"),
        (["aluguel", "condominio", "imobiliaria", "material de construcao", "decor", "leroy"], "Moradia"),
        (["anuidade", "juros", "multa", "iof", "encargo", "tarifa"], "Taxas e Juros"),
    ]

    categorias_norm = {normalizar_texto(cat): cat for cat in categorias_validas}
    for termos, categoria_alvo in regras:
        if any(termo in texto for termo in termos):
            cat_norm = normalizar_texto(categoria_alvo)
            if cat_norm in categorias_norm:
                return categorias_norm[cat_norm]

    return None


def _categoria_por_alias_aproximado(chave: str, aliases_map: dict[str, str]) -> str | None:
    if not chave or not aliases_map:
        return None

    melhor_categoria = None
    melhor_score = 0.0
    for alias_norm, categoria in aliases_map.items():
        if not alias_norm:
            continue
        score = SequenceMatcher(None, chave, alias_norm).ratio()
        if score > melhor_score:
            melhor_score = score
            melhor_categoria = categoria

    if melhor_score >= 0.90:
        return melhor_categoria
    return None


def _tokenizar_chave(chave: str) -> set[str]:
    termos = set(re.findall(r"[a-z0-9]+", chave or ""))
    return {termo for termo in termos if len(termo) >= 3}


def _construir_historico_transacoes(lista_categorias: list[str], limite: int = 5000):
    categorias_validas_norm = {normalizar_texto(cat): cat for cat in lista_categorias}
    historico_counts: dict[str, Counter] = defaultdict(Counter)
    token_index: dict[str, set[str]] = defaultdict(set)

    rows = (
        db.session.query(Transacao.descricao, Categoria.nome)
        .join(Categoria, Categoria.id == Transacao.categoria_id)
        .filter(Transacao.descricao.isnot(None))
        .order_by(Transacao.id.desc())
        .limit(limite)
        .all()
    )

    for descricao, categoria_nome in rows:
        desc_norm = normalizar_texto(descricao or "")
        if not desc_norm:
            continue

        cat_norm = normalizar_texto(categoria_nome or "")
        categoria_valida = categorias_validas_norm.get(cat_norm)
        if not categoria_valida or categoria_valida == "Indefinida":
            continue

        historico_counts[desc_norm][categoria_valida] += 1
        for token in _tokenizar_chave(desc_norm):
            token_index[token].add(desc_norm)

    return historico_counts, token_index


def _categoria_por_historico(
    chave: str,
    historico_counts: dict[str, Counter],
    token_index: dict[str, set[str]],
    min_similaridade: float = 0.92,
    min_ocorrencias: int = 2,
    min_dominancia: float = 0.65,
) -> str | None:
    if not chave or not historico_counts:
        return None

    tokens = _tokenizar_chave(chave)
    if not tokens:
        return None

    candidatos = set()
    for token in tokens:
        candidatos.update(token_index.get(token, set()))

    if not candidatos:
        return None

    melhor_chave = None
    melhor_score = 0.0
    for candidato in candidatos:
        score = SequenceMatcher(None, chave, candidato).ratio()
        if score > melhor_score:
            melhor_score = score
            melhor_chave = candidato

    if not melhor_chave or melhor_score < min_similaridade:
        return None

    contagem = historico_counts.get(melhor_chave)
    if not contagem:
        return None

    categoria_top, ocorrencias_top = contagem.most_common(1)[0]
    total = sum(contagem.values())
    dominancia = (ocorrencias_top / total) if total else 0.0

    if ocorrencias_top >= min_ocorrencias and dominancia >= min_dominancia:
        return categoria_top

    return None

@bp_ia.route("/classificar_categoria", methods=["POST"])
def classificar_categoria():
    data = request.get_json() or {}
    descricoes = data.get("descricoes", [])
    if not isinstance(descricoes, list):
        descricoes = []
    descricoes = [desc if isinstance(desc, str) else "" for desc in descricoes]
    if not descricoes:
        return jsonify({"categorias": []})

    categorias = []
    erros = []
    # A ausência da OPENAI_API_KEY não impede a classificação: alias, regras e
    # histórico funcionam localmente. A IA só entra para os itens restantes.
    ia_disponivel = bool(openai.api_key)
    categorias_db = db.session.query(Categoria.nome).all()
    lista_categorias = [c[0] for c in categorias_db]
    categorias_str = ', '.join(lista_categorias) if lista_categorias else "Indefinida"

    descricao_por_chave = {}
    ordem_chaves = []
    for desc in descricoes:
        chave = normalizar_texto(desc)
        ordem_chaves.append(chave)
        if chave not in descricao_por_chave:
            descricao_por_chave[chave] = desc or ""

    chaves_unicas = [chave for chave in descricao_por_chave.keys() if chave]
    alias_rows = (
        CategoriaAlias.query.filter(CategoriaAlias.descricao_normalizada.in_(chaves_unicas)).all()
        if chaves_unicas else []
    )
    categorias_por_chave = {}
    aliases_geral = {}
    for alias in alias_rows:
        if alias.categoria:
            categorias_por_chave[alias.descricao_normalizada] = alias.categoria.nome

    if chaves_unicas:
        alias_rows_all = CategoriaAlias.query.all()
        for alias in alias_rows_all:
            if alias.categoria and alias.descricao_normalizada:
                aliases_geral[alias.descricao_normalizada] = alias.categoria.nome

    historico_counts, token_index = _construir_historico_transacoes(lista_categorias)

    for chave, descricao_original in descricao_por_chave.items():
        if not chave or chave in categorias_por_chave:
            continue

        categoria_regra = _categoria_por_regras(descricao_original, lista_categorias)
        if categoria_regra:
            categorias_por_chave[chave] = categoria_regra
            continue

        categoria_alias_aprox = _categoria_por_alias_aproximado(chave, aliases_geral)
        if categoria_alias_aprox:
            categorias_por_chave[chave] = categoria_alias_aprox
            continue

        categoria_historico = _categoria_por_historico(chave, historico_counts, token_index)
        if categoria_historico:
            categorias_por_chave[chave] = categoria_historico

    pendentes = [
        (chave, descricao_por_chave[chave])
        for chave in descricao_por_chave.keys()
        if chave and chave not in categorias_por_chave
    ]

    if pendentes and not ia_disponivel:
        erros.append("OPENAI_API_KEY não definida; itens sem correspondência local ficaram como 'Indefinida'.")
        for chave, _ in pendentes:
            categorias_por_chave[chave] = "Indefinida"
        pendentes = []

    if pendentes:
        descricoes_unicas = [item[1] for item in pendentes]
        payload_classificacao = [
            {
                "descricao": desc,
                "merchant_hint": _merchant_hint(desc),
            }
            for desc in descricoes_unicas
        ]

        prompt = (
            "Você é um classificador de transações financeiras em português do Brasil. "
            "Classifique cada item usando EXATAMENTE uma categoria da lista permitida. "
            "Se não houver aderência, use 'Indefinida'. "
            "Priorize semântica do merchant e natureza da despesa; ignore sufixos de parcela. "
            f"Categorias permitidas: {categorias_str}. "
            "Retorne SOMENTE JSON válido no formato: "
            '{"categorias": ["..."], "confiancas": [0.0], "motivos": ["..."]}. '
            "As listas devem ter o mesmo tamanho dos itens recebidos e seguir a ordem original. "
            "Itens para classificar (JSON): "
            f"{json.dumps(payload_classificacao, ensure_ascii=False)}"
        )

        try:
            client = openai.OpenAI(api_key=openai.api_key)
            response = client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[{"role": "user", "content": prompt}],
                temperature=0
            )
            conteudo = response.choices[0].message.content.strip()
            categorias_unicas = _extrair_lista_categorias(conteudo, len(descricoes_unicas))
        except Exception as e:
            print(f"[ERRO] Falha ao classificar lote: {e}")
            erros.append(str(e))
            categorias_unicas = ["Indefinida"] * len(descricoes_unicas)

        for (chave, _), categoria in zip(pendentes, categorias_unicas):
            categorias_por_chave[chave] = _normalizar_categoria(categoria)

    categorias = [categorias_por_chave.get(chave, "Indefinida") for chave in ordem_chaves]

    resp = {"categorias": categorias}
    if erros:
        resp["erros"] = erros
    return jsonify(resp)
