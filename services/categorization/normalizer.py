import re
import unicodedata


STOPWORDS = {"DE", "DO", "DA", "DOS", "DAS", "E", "EM", "PARA", "COM", "POR", "NO", "NA", "NOS", "NAS", "BR", "COM", "LTDA", "ME", "EPP", "SA", "S/A", "EIRELI"}


def remover_acentos(texto: str) -> str:
    if not texto:
        return ""
    nfkd = unicodedata.normalize("NFD", texto)
    return "".join(c for c in nfkd if unicodedata.category(c) != "Mn")


def normalizar_descricao(descricao: str | None) -> str:
    """Normaliza a descrição de uma transação para comparação e matching.

    Exemplos:
        "UBER *TRIP" -> "UBER TRIP"
        "UBER *TRIP 12345" -> "UBER TRIP"
        "Uber Trip" -> "UBER TRIP"
        "Canal Bike - Parcela 2/10" -> "CANAL BIKE"
        "SUPERMERCADO BH LTDA" -> "SUPERMERCADO BH"
        "DL *ALIEXPRESS BR ALIP" -> "ALIEXPRESS ALIP"
    """
    if not descricao:
        return ""

    texto = remover_acentos(descricao).upper().strip()

    # 1. Remover marcadores de parcelamento explícitos (ex: Parcela 2/10, (1/3), Parc. 02/12, - 2/5)
    padroes_parcela = [
        r"[-–—]?\s*PARCELA\s*\(\s*\d+\s*/\s*\d+\s*\)",
        r"[-–—]?\s*PARC\.?\s*\d+\s*/\s*\d+",
        r"[-–—]?\s*PARCELA\s*\d+\s*/\s*\d+",
        r"[-–—]?\s*\d+\s*/\s*\d+\s*PARC(?:ELAS)?",
        r"[-–—]\s*\d+\s*/\s*\d+\s*$",
        r"\(\s*\d+\s*/\s*\d+\s*\)",
    ]
    for p in padroes_parcela:
        texto = re.sub(p, " ", texto, flags=re.IGNORECASE)

    # 2. Remover códigos de filial/terminal iniciados por hashtag (ex: #R095, #1234)
    texto = re.sub(r"#\s*[A-Z0-9]+\b", " ", texto)

    # 3. Remover prefixos de adquirentes e processadores (ex: MP *, IFD *, DL *, PAG *, PG *)
    texto = re.sub(r"\b(MP|IFD|IFood|DL|PAG|PG|EC|EB|HOTMART|PAYPAL|STRIPE|EBN)\s*[\*#]\s*", " ", texto)

    # 4. Remover sufixos jurídicos e de domínio (.COM, .COM.BR, LTDA, EIRELI, S/A, S.A.)
    texto = re.sub(r"\.COM\.BR\b|\.COM\b|\.NET\b|\.ORG\b", " ", texto)
    texto = re.sub(r"\b(LTDA|EIRELI|S/?A|S\.A\.|M\.E\.|ME|EPP|MEI)\b", " ", texto)

    # 5. Remover sufixo de país comum isolado 'BR'
    texto = re.sub(r"\bBR\b", " ", texto)

    # 6. Remover asteriscos, barras e pontuação residual
    texto = texto.replace("*", " ").replace("#", " ").replace("/", " ").replace("\\", " ")

    # 7. Remover códigos numéricos longos no final (identificadores de transação / POS / terminal)
    texto = re.sub(r"\b\d{4,}\b", " ", texto)

    # 8. Remover qualquer 'S A' que tenha sobrado da quebra de S/A
    texto = re.sub(r"\bS\s+A\b", " ", texto)

    # 9. Limpar caracteres não alfanuméricos residuais
    texto = re.sub(r"[^A-Z0-9\s]", " ", texto)

    # 10. Colapsar múltiplos espaços em branco
    texto = re.sub(r"\s+", " ", texto).strip()

    return texto or (descricao.strip().upper() if descricao else "")


def extrair_tokens(descricao: str | None) -> set[str]:
    """Extrai conjunto de tokens significativos da descrição normalizada."""
    normalizada = normalizar_descricao(descricao)
    if not normalizada:
        return set()
    tokens = set(re.findall(r"[A-Z0-9]+", normalizada))
    return {t for t in tokens if len(t) >= 3 and t not in STOPWORDS and not t.isdigit()}
