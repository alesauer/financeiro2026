import json
import logging
import os
from app.utils.texto import normalizar_texto
from services.ai.client import get_ai_client

logger = logging.getLogger(__name__)

# Cache em memória para evitar chamadas repetidas quando a chave da OpenAI for inválida (401)
_invalid_api_key: str | None = None


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

    client, modelo_detectado, provedor = get_ai_client()
    if not client:
        logger.debug("Nenhum cliente de IA configurado ou disponível. Pulando etapa de IA.")
        return fallback_resultado

    modelo_utilizado = model or modelo_detectado
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
            response = client.chat.completions.create(
                model=modelo_utilizado,
                messages=[
                    {"role": "system", "content": prompt_sistema},
                    {"role": "user", "content": prompt_usuario},
                ],
                response_format={"type": "json_object"} if ("gpt" in modelo_utilizado or "deepseek" in modelo_utilizado) else None,
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
            err_str = str(e)
            logger.error(f"Erro na classificação via IA do lote: {err_str}")
            if any(
                term in err_str
                for term in (
                    "401",
                    "429",
                    "Incorrect API key",
                    "invalid_api_key",
                    "no credits remaining",
                    "insufficient_quota",
                )
            ):
                _invalid_api_key = api_key
                for _ in descricoes[len(resultados_finais):]:
                    resultados_finais.append({
                        "categoria": "Outros" if "Outros" in categorias_validas else "Indefinida",
                        "confianca": 0.0,
                        "motivo": "Chave OpenAI inválida"
                    })
                break
            for _ in chunk:
                resultados_finais.append({
                    "categoria": "Outros" if "Outros" in categorias_validas else "Indefinida",
                    "confianca": 0.0,
                    "motivo": f"Erro IA: {err_str[:50]}"
                })

    return resultados_finais
