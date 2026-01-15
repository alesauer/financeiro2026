import re
import unicodedata

_normalize_pattern = re.compile(r"[^a-z0-9]+")


def normalizar_texto(valor: str) -> str:
    """Normaliza descrições para comparações (sem acentos, minúsculo)."""
    if not valor:
        return ""
    texto = unicodedata.normalize("NFKD", valor)
    texto = "".join(ch for ch in texto if not unicodedata.combining(ch))
    texto = texto.lower()
    texto = _normalize_pattern.sub(" ", texto)
    return texto.strip()
