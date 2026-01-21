from __future__ import annotations

import argparse
from datetime import datetime
from pathlib import Path
import sys

proj_root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(proj_root))

from app import create_app, db  # noqa: E402
from app.models import Transacao, FormaPagamento  # noqa: E402
from app.utils.datas import parse_dia_override  # noqa: E402
from services.fatura_service import aplicar_competencia_transacao  # noqa: E402


def parse_date(value: str | None, field: str) -> datetime.date | None:
    if not value:
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError as exc:  # pragma: no cover - erro de uso
        raise ValueError(f"{field}: data inválida, use YYYY-MM-DD") from exc


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Recalcula competencia_fatura de um cartão específico")
    parser.add_argument("--forma-pagamento-id", type=int, required=True, help="ID da forma/cartão de crédito")
    parser.add_argument("--inicio", type=str, help="Data inicial (YYYY-MM-DD)")
    parser.add_argument("--fim", type=str, help="Data final (YYYY-MM-DD)")
    parser.add_argument("--apenas-sem-competencia", action="store_true", help="Recalcula somente quem não possui competencia_fatura")
    parser.add_argument("--dia-fechamento", type=str, help="Override opcional para dia de fechamento (1-31 ou YYYY-MM-DD)")
    parser.add_argument("--dia-vencimento", type=str, help="Override opcional para dia de vencimento")
    parser.add_argument("--status", type=str, nargs="*", help="Filtra por status específicos (ex.: Pago Pendente)")
    parser.add_argument("--ids", type=int, nargs="*", help="Lista opcional de IDs de transações para limitar")
    return parser


def main():
    parser = build_parser()
    args = parser.parse_args()

    app = create_app()
    with app.app_context():
        forma = FormaPagamento.query.get(args.forma_pagamento_id)
        if not forma:
            parser.error("Forma de pagamento não encontrada")

        try:
            dia_fechamento_override = parse_dia_override(args.dia_fechamento, "dia-fechamento")
            dia_vencimento_override = parse_dia_override(args.dia_vencimento, "dia-vencimento")
        except ValueError as exc:
            parser.error(str(exc))

        inicio_dt = parse_date(args.inicio, "inicio") if args.inicio else None
        fim_dt = parse_date(args.fim, "fim") if args.fim else None

        query = Transacao.query.filter(Transacao.forma_pagamento_id == forma.id)
        if args.ids:
            query = query.filter(Transacao.id.in_(args.ids))
        if inicio_dt:
            query = query.filter(Transacao.data_transacao >= inicio_dt)
        if fim_dt:
            query = query.filter(Transacao.data_transacao <= fim_dt)
        if args.apenas_sem_competencia:
            query = query.filter(Transacao.competencia_fatura.is_(None))
        if args.status:
            query = query.filter(Transacao.status.in_(args.status))

        transacoes = query.order_by(Transacao.data_transacao.asc(), Transacao.id.asc()).all()
        total = len(transacoes)
        if not total:
            print("Nenhuma transação encontrada para os filtros informados.")
            return

        atualizados = 0
        for tx in transacoes:
            aplicar_competencia_transacao(
                tx,
                forma,
                dia_fechamento_override=dia_fechamento_override,
                dia_vencimento_override=dia_vencimento_override
            )
            atualizados += 1

        if atualizados:
            db.session.commit()
        print(f"Transações consideradas: {total}. Atualizadas: {atualizados}.")

if __name__ == "__main__":
    main()
