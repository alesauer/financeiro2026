"""Normaliza parcelamentos legados: `valor` passa a conter o desembolso da parcela.

Contexto: até a correção, o POST de parcelamento gravava o valor TOTAL da compra em
todas as parcelas, deixando a fração apenas em `valor_parcela`. Isso inflava os
relatórios que somam `Transacao.valor` (matriz anual, gráficos, relatórios).

Uso:
    python scripts/normalizar_parcelas.py --dry-run
    python scripts/normalizar_parcelas.py
"""

import argparse
import os
import sys
from decimal import Decimal

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app, db  # noqa: E402
from app.models import Transacao  # noqa: E402


def normalizar(dry_run: bool) -> int:
    divergentes = (
        Transacao.query.filter(
            Transacao.parcelado.is_(True),
            Transacao.valor_parcela.isnot(None),
            Transacao.valor != Transacao.valor_parcela,
        )
        .order_by(Transacao.parcelamento_id, Transacao.parcela_atual)
        .all()
    )

    if not divergentes:
        print("Nenhuma parcela divergente encontrada. Base já normalizada.")
        return 0

    print(f"{len(divergentes)} parcela(s) com valor != valor_parcela:\n")
    delta_total = Decimal("0")
    for t in divergentes:
        delta = Decimal(str(t.valor)) - Decimal(str(t.valor_parcela))
        delta_total += delta
        print(
            f"  #{t.id:<6} {t.data_transacao} {t.descricao[:38]:<38} "
            f"{t.parcela_atual}/{t.total_parcelas} "
            f"valor={t.valor} -> {t.valor_parcela} (delta {delta})"
        )
        if not dry_run:
            t.valor = t.valor_parcela

    print(f"\nRedução total nas somas por `valor`: {delta_total}")

    if dry_run:
        print("\n[dry-run] Nada foi gravado.")
        return len(divergentes)

    db.session.commit()
    print(f"\n{len(divergentes)} parcela(s) normalizada(s).")
    return len(divergentes)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="apenas lista, não grava")
    args = parser.parse_args()

    app = create_app()
    with app.app_context():
        normalizar(args.dry_run)


if __name__ == "__main__":
    main()
