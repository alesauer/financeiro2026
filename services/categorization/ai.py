import json
import logging
import os
from app.utils.texto import normalizar_texto

logger = logging.getLogger(__name__)


def classificar_com_ia(
    descricoes: list[str],
    categorias_validas: list[str],
    model: str | None = None
) -> list[dict]:
    """Classifica uma lista de descrições usando a API da OpenAI com retorno estruturado em JSON.

    Garante estritamente que a categoria retornada pertença à lista de categorias_validas.

    Retorna:
        Lista de dicionários no formato:
        [
            {
                "categoria": "Transporte",
                "confianca": 0.85,
                "motivo": "Aplicativo de mobilidade urbana"
            },
            ...
        ]
    """
    if not descricoes:
        return []

    fallback_resultado = [
        {"categoria": "Outros" if "Outros" in categorias_validas else (categorias_validas[0] if categorias_validas else "Indefinida"),
         "confianca": 0.0,
         "motivo": "Sem classificação"}
        for _ in descricoes
    ]

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        logger.debug("OPENAI_API_KEY não configurada. Pulando etapa de IA.")
        return fallback_resultado

    try:
        import openai
    except ImportError:
        logger.warning("Pacote openai não instalado. Pulando etapa de IA.")
        return fallback_resultado

    modelo_utilizado = model or os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    cat_str = ", ".join(categorias_validas) if categorias_validas else "Outros"

    # Mapeamento case-insensitive e sem acentos para validação estrita
    mapa_categorias_validas = {normalizar_texto(c): c for c in categorias_validas}

    # Processar em lotes de até 25 itens para confiabilidade de JSON
    resultados_finais = []
    chunk_size = 25

    for i in range(0, len(descricoes), chunk_size):
        chunk = descricoes[i:i + chunk_size]
        payload = [{"id": idx, "descricao": d} for idx, d in enumerate(chunk)]

        prompt_sistema = (
            "Você é um classificador financeiro especializado no mercado brasileiro. "
            "Sua tarefa é classificar cada descrição de despesa em EXATAMENTE UMA das categorias permitidas. "
            f"CATEGORIAS PERMITIDAS: [{cat_str}]. "
            "Responda EXCLUSIVAMENTE em formato JSON com a seguinte estrutura: "
            '{"classificacoes": [{"id": 0, "categoria": "NomeExatoDaCategoria", "confianca": 0.90, "motivo": "Breve justificativa"}]}. '
            "Regras: "
            "1. A categoria DEVE ser uma das categorias permitidas. Não invente categorias novas. "
            "2. Se tiver dúvida ou não souber, use 'Outros'. "
            "3. O campo 'confianca' deve ser um número float entre 0.50 e 0.99."
        )

        prompt_usuario = f"Itens para classificar:\n{json.dumps(payload, ensure_ascii=False)}"

        try:
            client = openai.OpenAI(api_key=api_key)
            response = client.chat.completions.create(
                model=modelo_utilizado,
                messages=[
                    {"role": "system", "content": prompt_sistema},
                    {"role": "user", "content": prompt_usuario},
                ],
                response_format={"type": "json_object"} if "gpt-4" in modelo_utilizado or "gpt-3.5" in modelo_utilizado else None,
                temperature=0.1,
                timeout=15.0
            )

            conteudo = response.choices[0].message.content or "{}"
            parsed = json.loads(conteudo)
            classificacoes_raw = parsed.get("classificacoes", [])
            
            # Indexar pelo ID
            mapa_resp = {}
            for item in classificacoes_raw:
                if isinstance(item, dict) and "id" in item:
                    cat_sugerida = item.get("categoria", "")
                    cat_norm = normalizar_texto(cat_sugerida)
                    cat_final = mapa_categorias_validas.get(cat_norm) or ("Outros" if "Outros" in categorias_validas else cat_sugerida)
                    conf = float(item.get("confianca", 0.80))
                    conf = max(0.50, min(0.99, conf))
                    motivo = str(item.get("motivo", "Classificado por IA"))
                    mapa_resp[item["id"]] = {
                        "categoria": cat_final,
                        "confianca": conf,
                        "motivo": motivo
                    }

            for idx in range(len(chunk)):
                if idx in mapa_resp:
                    resultados_finais.append(mapa_resp[idx])
                else:
                    resultados_finais.append({
                        "categoria": "Outros" if "Outros" in categorias_validas else "Indefinida",
                        "confianca": 0.50,
                        "motivo": "Não retornado pela IA"
                    })

        except Exception as e:
            logger.error(f"Erro na classificação via IA do lote: {e}")
            for _ in chunk:
                resultados_finais.append({
                    "categoria": "Outros" if "Outros" in categorias_validas else "Indefinida",
                    "confianca": 0.0,
                    "motivo": f"Erro IA: {str(e)[:50]}"
                })

    return resultados_finais
