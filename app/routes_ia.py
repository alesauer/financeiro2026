
from flask import Blueprint, request, jsonify
import json
import openai
import os
from app.models import Categoria, CategoriaAlias
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
    if not openai.api_key:
        print("[ERRO] OPENAI_API_KEY não definida.")
        return jsonify({"categorias": [], "erro": "OPENAI_API_KEY não definida."}), 500
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
    for alias in alias_rows:
        if alias.categoria:
            categorias_por_chave[alias.descricao_normalizada] = alias.categoria.nome

    pendentes = [
        (chave, descricao_por_chave[chave])
        for chave in descricao_por_chave.keys()
        if chave and chave not in categorias_por_chave
    ]

    if pendentes:
        descricoes_unicas = [item[1] for item in pendentes]
        prompt = (
            "Você é um assistente que classifica transações financeiras. "
            "Use apenas uma das seguintes categorias cadastradas: "
            f"{categorias_str}. "
            "Se nenhuma categoria for adequada, responda 'Indefinida'. "
            'Retorne exclusivamente um JSON com a chave \'categorias\', onde cada posição corresponde à descrição de mesmo índice. '
            'Exemplo: {"categorias": ["Alimentação", "Transporte"]}. '
            "Descrições a classificar (JSON): "
            f"{json.dumps(descricoes_unicas, ensure_ascii=False)}"
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
