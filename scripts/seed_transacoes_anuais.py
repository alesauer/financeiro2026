"""Seed transações recorrentes baseadas em uma planilha mensal.

Uso:
    python scripts/seed_transacoes_anuais.py --ano 2025

Argumentos:
    --ano            Ano alvo para replicar (padrão: ano atual)
    --mes-inicio     Mês inicial (1-12, padrão: 1)
    --mes-fim        Mês final   (1-12, padrão: 12)
    --dry-run        Não grava no banco, apenas mostra o que faria
"""
from __future__ import annotations

import argparse
import calendar
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path
import sys
from typing import Dict, Iterable, Optional

from sqlalchemy import func

# Garantir que o pacote `app` seja encontrado
PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from app import create_app, db
from app.models import Categoria, FormaPagamento, Transacao


@dataclass(frozen=True)
class EntradaBase:
    tipo: str
    dia: int
    descricao: str
    categoria: str
    valor: str
    forma_pagamento: Optional[str] = None
    observacoes: Optional[str] = None


# Entradas fornecidas pelo usuário (mês modelo)
ENTRADAS: tuple[EntradaBase, ...] = (
    # Receitas
    EntradaBase("Receita", 1, "ALMG", "Salário", "R$ 17.010,00", "Transferência"),
    EntradaBase("Receita", 14, "ALMG FÉRIA PREMIO", "Salário", "R$ 2.683,00", "Transferência"),
    EntradaBase("Receita", 1, "PUC MINAS", "Salário", "R$ 0,00", "Transferência"),
    EntradaBase("Receita", 15, "OF HUNTER", "Salário", "R$ 4.400,00", "Transferência"),
    EntradaBase("Receita", 10, "ALUGUEL APTO", "Salário", "R$ 750,00", "Transferência"),
    # Despesas fixas
    EntradaBase("Despesa", 5, "Batista", "Filho", "R$ 2.200,00", "Pix"),
    EntradaBase("Despesa", 5, "Iate", "Lazer", "R$ 450,00", "Pix"),
    EntradaBase("Despesa", 5, "Kiki", "Moradia", "R$ 1.000,00", "Pix"),
    EntradaBase("Despesa", 5, "Condomínio", "Moradia", "R$ 750,00", "Pix"),
    EntradaBase("Despesa", 5, "Mei Kiki", "Imposto", "R$ 80,90", "Pix"),
    EntradaBase("Despesa", 5, "Vivo Kiki", "Celular", "R$ 55,00", "Pix"),
    EntradaBase("Despesa", 5, "Faxineira", "Moradia", "R$ 360,00", "Pix"),
    EntradaBase("Despesa", 15, "IPTU", "Moradia", "R$ 190,00", "Pix"),
    EntradaBase("Despesa", 4, "CEMIG", "Energia", "R$ 104,75", "Pix"),
    EntradaBase("Despesa", 10, "Blink", "Internet", "R$ 118,90", "Pix"),
    EntradaBase("Despesa", 10, "ÓRIGO", "Energia", "R$ 379,76", "Pix"),
    EntradaBase("Despesa", 5, "Natação tico", "Filho", "R$ 250,00", "Pix", "PIX: 31 99767-6200"),
    EntradaBase("Despesa", 7, "Psicóloga", "Filho", "R$ 720,00", "Pix", "Pagamento via Pix - 31998855177"),
    EntradaBase("Despesa", 5, "Integrar", "Filho", "R$ 200,00", "Pix"),
    EntradaBase("Despesa", 1, "IPRF", "Imposto", "R$ 0,00", "Pix"),
    EntradaBase("Despesa", 5, "Pagamento Mãe", "Repasse", "R$ 1.100,00", "Pix"),
)


FORMA_DEFAULT_POR_TIPO: Dict[str, str] = {
    "Receita": "Transferência",
    "Despesa": "Pix",
    "Investimento": "Transferência",
}
FORMA_METADATA: Dict[str, Dict[str, object]] = {
    "Transferência": {"tipo": "Transferência", "cartao_credito": False},
    "Pix": {"tipo": "Pix", "cartao_credito": False},
}


def parse_valor(valor: str | int | float | Decimal) -> Decimal:
    if isinstance(valor, Decimal):
        return valor
    if isinstance(valor, (int, float)):
        return Decimal(str(valor))
    texto = (
        valor.replace("R$", "")
        .replace(" ", "")
        .replace(".", "")
        .replace(",", ".")
        .strip()
    )
    return Decimal(texto or "0")


def ultimo_dia(mes: int, ano: int) -> int:
    return calendar.monthrange(ano, mes)[1]


def get_or_create_categoria(nome: str, tipo_transacao: str) -> Categoria:
    nome_normalizado = nome.strip()
    categoria = (
        Categoria.query.filter(func.lower(Categoria.nome) == nome_normalizado.lower()).first()
    )
    if not categoria:
        categoria = Categoria(nome=nome_normalizado, tipo=tipo_transacao)
        db.session.add(categoria)
        db.session.flush()
    elif categoria.tipo != tipo_transacao:
        categoria.tipo = tipo_transacao
        db.session.add(categoria)
    return categoria


def get_or_create_forma_pagamento(nome: Optional[str], tipo_transacao: str) -> FormaPagamento:
    nome_final = (nome or FORMA_DEFAULT_POR_TIPO.get(tipo_transacao, "Pix")).strip()
    forma = (
        FormaPagamento.query.filter(func.lower(FormaPagamento.nome) == nome_final.lower()).first()
    )
    if not forma:
        meta = FORMA_METADATA.get(nome_final, {"tipo": nome_final, "cartao_credito": False})
        forma = FormaPagamento(
            nome=nome_final,
            tipo=str(meta.get("tipo", nome_final)),
            cartao_credito=bool(meta.get("cartao_credito", False)),
            ativo=True,
        )
        db.session.add(forma)
        db.session.flush()
    return forma


def gerar_transacoes(ano: int, mes_inicio: int, mes_fim: int) -> Iterable[dict]:
    for mes in range(mes_inicio, mes_fim + 1):
        max_dia = ultimo_dia(mes, ano)
        for entrada in ENTRADAS:
            dia = min(entrada.dia, max_dia)
            yield {
                "tipo": entrada.tipo,
                "categoria": entrada.categoria,
                "descricao": entrada.descricao,
                "valor": parse_valor(entrada.valor),
                "data": date(ano, mes, dia),
                "forma_pagamento": entrada.forma_pagamento or FORMA_DEFAULT_POR_TIPO[entrada.tipo],
                "observacoes": entrada.observacoes,
            }


def registrar_transacoes(transacoes: Iterable[dict], dry_run: bool = False) -> dict:
    criadas = 0
    ignoradas = 0
    for payload in transacoes:
        categoria = get_or_create_categoria(payload["categoria"], payload["tipo"])
        forma = get_or_create_forma_pagamento(payload["forma_pagamento"], payload["tipo"])
        existente = (
            Transacao.query.filter(
                Transacao.categoria_id == categoria.id,
                Transacao.descricao == payload["descricao"],
                Transacao.data_transacao == payload["data"],
                Transacao.valor == payload["valor"],
            ).first()
        )
        if existente:
            ignoradas += 1
            continue
        if dry_run:
            criadas += 1
            continue
        transacao = Transacao(
            tipo=payload["tipo"],
            categoria_id=categoria.id,
            descricao=payload["descricao"],
            valor=payload["valor"],
            data_transacao=payload["data"],
            forma_pagamento_id=forma.id,
            status="Pago",
            observacoes=payload.get("observacoes"),
        )
        db.session.add(transacao)
        criadas += 1
    if dry_run:
        db.session.rollback()
    else:
        db.session.commit()
    return {"criadas": criadas, "ignoradas": ignoradas}


def executar(ano: int, mes_inicio: int, mes_fim: int, dry_run: bool = False) -> dict:
    app = create_app()
    with app.app_context():
        transacoes = list(gerar_transacoes(ano, mes_inicio, mes_fim))
        resultado = registrar_transacoes(transacoes, dry_run=dry_run)
        print(
            f"Ano {ano} | Meses {mes_inicio}-{mes_fim} | criadas={resultado['criadas']} ignoradas={resultado['ignoradas']}"
        )
        return resultado


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Replica um mês base para todos os meses de um ano")
    ano_atual = datetime.now().year
    parser.add_argument("--ano", type=int, default=ano_atual, help="Ano alvo (padrão: ano atual)")
    parser.add_argument("--mes-inicio", type=int, default=1, help="Mês inicial (1-12)")
    parser.add_argument("--mes-fim", type=int, default=12, help="Mês final (1-12)")
    parser.add_argument("--dry-run", action="store_true", help="Somente simula, sem gravar no banco")
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    if not 1 <= args.mes_inicio <= 12 or not 1 <= args.mes_fim <= 12:
        raise SystemExit("Os meses devem estar entre 1 e 12")
    if args.mes_inicio > args.mes_fim:
        raise SystemExit("mes-inicio deve ser <= mes-fim")
    executar(args.ano, args.mes_inicio, args.mes_fim, dry_run=args.dry_run)
