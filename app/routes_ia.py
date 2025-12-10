
from flask import Blueprint, request, jsonify
import openai
import os
from app.models import Categoria
from app import db

bp_ia = Blueprint("ia", __name__)

# Configure sua chave da OpenAI
openai.api_key = os.getenv("OPENAI_API_KEY")  # Ou defina diretamente: openai.api_key = 'SUA_CHAVE_AQUI'

@bp_ia.route("/classificar_categoria", methods=["POST"])
def classificar_categoria():
    data = request.get_json()
    descricoes = data.get("descricoes", [])
    categorias = []
    erros = []
    if not openai.api_key:
        print("[ERRO] OPENAI_API_KEY não definida.")
        return jsonify({"categorias": [], "erro": "OPENAI_API_KEY não definida."}), 500
    # Busca as categorias cadastradas no banco
    categorias_db = db.session.query(Categoria.nome).all()
    lista_categorias = [c[0] for c in categorias_db]
    categorias_str = ', '.join(lista_categorias)
    for desc in descricoes:
        prompt = (
            f"Classifique a transação '{desc}' em uma das seguintes categorias financeiras já cadastradas: {categorias_str}. "
            "Responda apenas com o nome exato da categoria da lista acima. Se não souber, responda 'Indefinida'."
        )
        try:
            client = openai.OpenAI(api_key=openai.api_key)
            response = client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[{"role": "user", "content": prompt}]
            )
            categoria = response.choices[0].message.content.strip()
        except Exception as e:
            print(f"[ERRO] Falha ao classificar '{desc}': {e}")
            erros.append(str(e))
            categoria = "Indefinida"
        categorias.append(categoria)
    resp = {"categorias": categorias}
    if erros:
        resp["erros"] = erros
    return jsonify(resp)
