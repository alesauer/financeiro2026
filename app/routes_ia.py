from flask import Blueprint, request, jsonify
import openai
import os

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
    for desc in descricoes:
        prompt = f"Classifique a transação '{desc}' em uma categoria financeira (ex: Alimentação, Transporte, Lazer, Saúde, Compras, Serviços, etc). Responda apenas com o nome da categoria."
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
