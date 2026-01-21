from __future__ import annotations

from datetime import datetime
from typing import Any, Optional


def parse_dia_override(value: Any, field_name: str = "dia") -> Optional[int]:
    """Normaliza valores de dia recebidos via API, aceitando inteiro, string ou data."""
    if value in (None, ""):
        return None

    if isinstance(value, int):
        dia = value
    elif isinstance(value, str):
        raw = value.strip()
        if not raw:
            return None
        if raw.isdigit():
            dia = int(raw)
        else:
            try:
                dia = datetime.strptime(raw, "%Y-%m-%d").day
            except ValueError as exc:  # noqa: F841 - re-raise com contexto amigável
                raise ValueError(
                    f"{field_name}: valor '{value}' inválido. Use dia (1-31) ou data YYYY-MM-DD."
                ) from exc
    else:
        raise ValueError(f"{field_name}: tipo de valor não suportado ({type(value).__name__}).")

    if dia < 1 or dia > 31:
        raise ValueError(f"{field_name}: dia deve estar entre 1 e 31.")
    return dia
