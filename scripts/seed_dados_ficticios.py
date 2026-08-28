"""Gera uma base fictícia completa a partir da planilha mensal modelo.

Replica o mês-base (Abril/2026) para todos os meses dos anos informados,
aplicando variação aleatória nos itens variáveis, eventos pontuais
(13º salário, férias-prêmio, progressão), parcelamentos, faturas de cartão
de crédito com competência e aportes de investimento.

Uso:
    python scripts/seed_dados_ficticios.py --anos 2025 2026
    python scripts/seed_dados_ficticios.py --anos 2026 --limpar
    python scripts/seed_dados_ficticios.py --anos 2026 --dry-run
"""
from __future__ import annotations

import argparse
import calendar
import random
import uuid
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path
import sys
from typing import Optional

from sqlalchemy import func

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from app import create_app, db  # noqa: E402
from app.models import Categoria, FormaPagamento, Transacao  # noqa: E402


TODOS_OS_MESES = tuple(range(1, 13))

# Percentual de variação aplicado aos itens marcados como variáveis
VARIACAO = 0.10

# Fator de correção por ano (simula reajuste/inflação sobre o mês-base de 2026)
FATOR_ANO: dict[int, float] = {
    2024: 0.86,
    2025: 0.93,
    2026: 1.00,
    2027: 1.05,
}


@dataclass(frozen=True)
class Item:
    """Um lançamento do mês-base, replicado nos meses indicados."""

    tipo: str
    dia: int
    descricao: str
    categoria: str
    valor: str
    forma: str
    variavel: bool = False
    observacoes: Optional[str] = None
    meses: tuple[int, ...] = TODOS_OS_MESES
    anos: Optional[tuple[int, ...]] = None
    corrigir_por_ano: bool = True


@dataclass(frozen=True)
class Parcelamento:
    """Compra dividida em parcelas mensais iguais."""

    descricao: str
    categoria: str
    forma: str
    valor_parcela: str
    total_parcelas: int
    dia: int
    mes_inicio: int
    observacoes: Optional[str] = None


# ---------------------------------------------------------------------------
# Mês-base: planilha de Abril/2026
# ---------------------------------------------------------------------------

ITENS: tuple[Item, ...] = (
    # ----------------------------- RECEITAS -----------------------------
    Item("Receita", 1, "ALMG", "Salário", "17010.00", "Transferência"),
    Item("Receita", 14, "ALMG Férias-Prêmio", "Salário", "2683.00", "Transferência"),
    Item("Receita", 1, "Cotemig", "Salário", "1400.00", "Transferência"),
    Item("Receita", 10, "Aluguel Apto", "Aluguel", "850.00", "Transferência"),
    # Receitas pontuais (baseadas no resumo anual)
    Item("Receita", 20, "Décimo Terceiro ALMG (1ª parcela)", "Salário", "10500.00", "Transferência", meses=(7,)),
    Item("Receita", 20, "Décimo Terceiro ALMG (2ª parcela)", "Salário", "7800.00", "Transferência", meses=(12,)),
    Item("Receita", 25, "Diferença ADE/Progressão", "Salário", "8410.00", "Transferência", meses=(6,)),
    Item("Receita", 15, "OF Hunter", "Serviços", "4400.00", "Transferência", meses=(1, 2, 3)),

    # -------------------------- DESPESAS FIXAS --------------------------
    Item("Despesa", 8, "Batista (matrícula e mensalidade)", "Educação", "2200.00", "Pix"),
    Item("Despesa", 5, "Kiki", "Temp", "1000.00", "Pix"),
    Item("Despesa", 5, "Mei Kiki", "Imposto", "80.90", "Débito Automático"),
    Item("Despesa", 5, "Vivo Kiki", "Celular", "75.00", "Débito Automático"),
    Item("Despesa", 5, "Faxineira", "Moradia", "380.00", "Pix"),
    Item("Despesa", 15, "Condomínio", "Moradia", "739.00", "Débito Automático"),
    Item("Despesa", 15, "IPTU", "Moradia", "190.00", "Débito Automático"),
    Item("Despesa", 4, "CEMIG", "Energia", "105.54", "Débito Automático", variavel=True),
    Item("Despesa", 10, "Blink", "Internet", "118.90", "Débito Automático"),
    Item("Despesa", 10, "ÓRIGO", "Energia", "253.00", "Débito Automático", variavel=True),
    Item("Despesa", 5, "Natação Tico", "Recreativo", "260.00", "Pix", observacoes="lucabonesi3@gmail.com"),
    Item("Despesa", 5, "Psicóloga Tico", "Filho", "540.00", "Pix", observacoes="Pix - 31998855177"),
    Item("Despesa", 5, "Integrar", "Educação", "825.00", "Pix"),
    Item("Despesa", 5, "Pagamento Mãe", "Repasse", "1200.00", "Pix"),

    # ---------------------------- INVESTIMENTO --------------------------
    Item("Investimento", 20, "Aporte Renda Fixa", "Reserva de Emergência", "500.00", "Transferência"),
    Item("Investimento", 20, "Aporte Fundo Imobiliário", "Fundos Imobiliários", "300.00", "Transferência", meses=(3, 6, 9, 12)),
)


PARCELAMENTOS: tuple[Parcelamento, ...] = (
    Parcelamento(
        descricao="Seguro Carro",
        categoria="Carro",
        forma="Débito Automático",
        valor_parcela="129.69",
        total_parcelas=12,
        dia=5,
        mes_inicio=3,
    ),
)


# ---------------------------------------------------------------------------
# Cartões de crédito: compras individuais que compõem a fatura
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class CompraCatalogo:
    """Grupo de compras avulsas geradas aleatoriamente a cada mês."""

    estabelecimentos: tuple[str, ...]
    categoria: str
    valor_min: float
    valor_max: float
    freq_min: int
    freq_max: int


@dataclass(frozen=True)
class CompraFixa:
    """Compra recorrente com valor constante (assinaturas, mensalidades)."""

    descricao: str
    categoria: str
    valor: str
    dia: int


@dataclass(frozen=True)
class ParcelamentoCartao:
    """Compra parcelada lançada no cartão ao longo de vários meses."""

    descricao: str
    categoria: str
    valor_parcela: str
    total_parcelas: int
    dia: int
    ano_inicio: int
    mes_inicio: int


@dataclass(frozen=True)
class Cartao:
    nome: str
    fatura_base: str
    fixas: tuple[CompraFixa, ...] = ()
    parcelamentos: tuple[ParcelamentoCartao, ...] = ()
    catalogo: tuple[CompraCatalogo, ...] = ()


CATALOGO_PRINCIPAL: tuple[CompraCatalogo, ...] = (
    CompraCatalogo(("Supermercado BH", "Verdemar", "Carrefour", "EPA Supermercados"), "Mercado", 260, 680, 4, 5),
    CompraCatalogo(("iFood", "Outback", "Coco Bambu", "Restaurante Xapuri", "Madero", "Subway"), "Restaurante", 45, 210, 6, 8),
    CompraCatalogo(("Posto Ipiranga", "Posto Shell", "Posto BR"), "Combustível", 180, 320, 2, 3),
    CompraCatalogo(("Drogaria Araujo", "Drogasil", "Pague Menos"), "Farmácia", 45, 230, 1, 3),
    CompraCatalogo(("Uber", "99 App"), "Transporte", 16, 65, 4, 7),
    CompraCatalogo(("Padaria Real", "Panificadora São Judas"), "Padaria", 22, 80, 3, 4),
    CompraCatalogo(("Renner", "Riachuelo", "Zara", "Centauro"), "Vestuário", 110, 420, 1, 2),
    CompraCatalogo(("Cinemark", "Ingresso.com", "Bar do Museu"), "Lazer", 60, 190, 1, 2),
    CompraCatalogo(("Petz", "Cobasi"), "Pet", 90, 260, 1, 1),
    CompraCatalogo(("Leroy Merlin", "Tok&Stok", "Casa Bahia"), "Casa", 120, 380, 1, 2),
    CompraCatalogo(("Amazon", "Mercado Livre", "Magazine Luiza"), "Compras Online", 80, 340, 1, 3),
)


CARTOES: tuple[Cartao, ...] = (
    Cartao(
        nome="Nubank",
        fatura_base="12954.82",
        fixas=(
            CompraFixa("Unimed BH", "Saúde", "2850.00", 12),
            CompraFixa("Netflix", "Assinaturas", "55.90", 8),
            CompraFixa("Spotify", "Assinaturas", "34.90", 14),
            CompraFixa("Amazon Prime", "Assinaturas", "19.90", 18),
            CompraFixa("YouTube Premium", "Assinaturas", "41.90", 22),
            CompraFixa("iCloud", "Assinaturas", "14.90", 6),
            CompraFixa("SmartFit", "Recreativo", "129.90", 10),
        ),
        parcelamentos=(
            ParcelamentoCartao("Viagem Europa CVC", "Viagem", "1450.00", 12, 15, 2025, 6),
            ParcelamentoCartao("Notebook Dell", "Eletrônicos", "520.00", 10, 9, 2025, 11),
            ParcelamentoCartao("iPhone 15", "Eletrônicos", "610.00", 12, 17, 2026, 2),
            ParcelamentoCartao("Sofá Tok&Stok", "Casa", "380.00", 8, 11, 2026, 5),
        ),
        catalogo=CATALOGO_PRINCIPAL,
    ),
    Cartao(
        nome="C6 Bank",
        fatura_base="289.69",
        catalogo=(
            CompraCatalogo(("Uber", "99 App"), "Transporte", 18, 60, 1, 2),
            CompraCatalogo(("Amazon", "Mercado Livre"), "Compras Online", 40, 160, 1, 2),
        ),
    ),
)


# Valores que sobrescrevem o mês-base em competências específicas
OVERRIDES: dict[tuple[str, int, int], str] = {
    ("ALMG", 2026, 1): "16500.00",
    ("ALMG", 2026, 2): "16500.00",
    ("ALMG", 2026, 3): "16500.00",
    ("ALMG", 2026, 4): "17010.00",
    ("ALMG", 2026, 5): "17325.00",
    ("ALMG", 2026, 6): "19923.00",
    ("ALMG", 2026, 7): "19923.00",
    ("ALMG", 2026, 8): "19923.00",
    ("ALMG", 2026, 9): "19923.00",
    ("ALMG", 2026, 10): "19923.00",
    ("ALMG", 2026, 11): "19923.00",
    ("ALMG", 2026, 12): "19923.00",
}


CATEGORIAS_POR_TIPO: dict[str, str] = {}
for _item in ITENS:
    CATEGORIAS_POR_TIPO[_item.categoria] = _item.tipo
for _parcela in PARCELAMENTOS:
    CATEGORIAS_POR_TIPO[_parcela.categoria] = "Despesa"
for _cartao in CARTOES:
    for _fixa in _cartao.fixas:
        CATEGORIAS_POR_TIPO[_fixa.categoria] = "Despesa"
    for _parc in _cartao.parcelamentos:
        CATEGORIAS_POR_TIPO[_parc.categoria] = "Despesa"
    for _grupo in _cartao.catalogo:
        CATEGORIAS_POR_TIPO[_grupo.categoria] = "Despesa"


FORMAS: dict[str, dict[str, object]] = {
    "Transferência": {"tipo": "Transferência", "cartao_credito": False},
    "Pix": {"tipo": "Pix", "cartao_credito": False},
    "Débito Automático": {"tipo": "Débito", "cartao_credito": False},
    "Dinheiro": {"tipo": "Dinheiro", "cartao_credito": False},
    "Nubank": {"tipo": "Cartão de Crédito", "cartao_credito": True, "dia_fechamento": 25, "dia_vencimento": 3},
    "C6 Bank": {"tipo": "Cartão de Crédito", "cartao_credito": True, "dia_fechamento": 12, "dia_vencimento": 20},
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def dinheiro(valor: Decimal | float | str) -> Decimal:
    return Decimal(str(valor)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def dia_valido(ano: int, mes: int, dia: int) -> date:
    return date(ano, mes, min(dia, calendar.monthrange(ano, mes)[1]))


def somar_meses(ano: int, mes: int, incremento: int) -> tuple[int, int]:
    total = (ano * 12) + (mes - 1) + incremento
    return total // 12, (total % 12) + 1


def competencia_fatura(data: date, dia_fechamento: Optional[int]) -> Optional[date]:
    """Mês de competência da fatura conforme o dia de fechamento do cartão."""
    if not dia_fechamento:
        return None
    ano, mes = (data.year, data.month) if data.day <= dia_fechamento else somar_meses(data.year, data.month, 1)
    return date(ano, mes, 1)


def get_or_create_categoria(nome: str, tipo: str) -> Categoria:
    categoria = Categoria.query.filter(func.lower(Categoria.nome) == nome.lower()).first()
    if categoria:
        return categoria
    categoria = Categoria(nome=nome, tipo=tipo)
    db.session.add(categoria)
    db.session.flush()
    return categoria


def get_or_create_forma(nome: str) -> FormaPagamento:
    forma = FormaPagamento.query.filter(func.lower(FormaPagamento.nome) == nome.lower()).first()
    if forma:
        return forma
    meta = FORMAS.get(nome, {"tipo": "Outros", "cartao_credito": False})
    forma = FormaPagamento(
        nome=nome,
        tipo=str(meta.get("tipo", "Outros")),
        cartao_credito=bool(meta.get("cartao_credito", False)),
        dia_fechamento=meta.get("dia_fechamento"),
        dia_vencimento=meta.get("dia_vencimento"),
        ativo=True,
    )
    db.session.add(forma)
    db.session.flush()
    return forma


def preparar_cadastros() -> tuple[dict[str, Categoria], dict[str, FormaPagamento]]:
    categorias = {nome: get_or_create_categoria(nome, tipo) for nome, tipo in CATEGORIAS_POR_TIPO.items()}
    formas = {nome: get_or_create_forma(nome) for nome in FORMAS}
    db.session.flush()
    return categorias, formas


# ---------------------------------------------------------------------------
# Geração
# ---------------------------------------------------------------------------

@dataclass
class Lancamento:
    tipo: str
    descricao: str
    categoria: str
    forma: str
    valor: Decimal
    data: date
    observacoes: Optional[str] = None
    parcelado: bool = False
    total_parcelas: Optional[int] = None
    parcela_atual: Optional[int] = None
    parcelamento_id: Optional[str] = None
    extras: dict = field(default_factory=dict)


def valor_do_mes(item: Item, ano: int, mes: int, rng: random.Random) -> Decimal:
    override = OVERRIDES.get((item.descricao, ano, mes))
    base = Decimal(override) if override else Decimal(item.valor)

    if not override and item.corrigir_por_ano:
        base *= Decimal(str(FATOR_ANO.get(ano, 1.0)))

    if item.variavel:
        base *= Decimal(str(rng.uniform(1 - VARIACAO, 1 + VARIACAO)))

    return dinheiro(base)


def gerar_compras_cartao(cartao: Cartao, ano: int, mes: int, rng: random.Random) -> list[Lancamento]:
    """Compõe a fatura do mês com compras individuais que somam o valor-alvo.

    Itens fixos e parcelas entram com valor exato; as compras avulsas são
    escaladas proporcionalmente para que o total feche com a fatura.
    """
    alvo = dinheiro(
        Decimal(cartao.fatura_base)
        * Decimal(str(FATOR_ANO.get(ano, 1.0)))
        * Decimal(str(rng.uniform(1 - VARIACAO, 1 + VARIACAO)))
    )

    fixos: list[Lancamento] = []

    for fixa in cartao.fixas:
        fixos.append(
            Lancamento(
                tipo="Despesa",
                descricao=fixa.descricao,
                categoria=fixa.categoria,
                forma=cartao.nome,
                valor=dinheiro(Decimal(fixa.valor) * Decimal(str(FATOR_ANO.get(ano, 1.0)))),
                data=dia_valido(ano, mes, fixa.dia),
            )
        )

    for parcelamento in cartao.parcelamentos:
        decorridos = (ano - parcelamento.ano_inicio) * 12 + (mes - parcelamento.mes_inicio)
        if not 0 <= decorridos < parcelamento.total_parcelas:
            continue
        fixos.append(
            Lancamento(
                tipo="Despesa",
                descricao=f"{parcelamento.descricao} ({decorridos + 1}/{parcelamento.total_parcelas})",
                categoria=parcelamento.categoria,
                forma=cartao.nome,
                valor=dinheiro(parcelamento.valor_parcela),
                data=dia_valido(ano, mes, parcelamento.dia),
                parcelado=True,
                total_parcelas=parcelamento.total_parcelas,
                parcela_atual=decorridos + 1,
                parcelamento_id=str(
                    uuid.uuid5(uuid.NAMESPACE_OID, f"{cartao.nome}|{parcelamento.descricao}|{parcelamento.ano_inicio}-{parcelamento.mes_inicio}")
                ),
            )
        )

    restante = alvo - sum((item.valor for item in fixos), Decimal("0"))
    if restante <= 0:
        return fixos

    # Sorteia as compras avulsas do mês
    avulsas: list[Lancamento] = []
    ultimo_dia_mes = calendar.monthrange(ano, mes)[1]

    for grupo in cartao.catalogo:
        for _ in range(rng.randint(grupo.freq_min, grupo.freq_max)):
            avulsas.append(
                Lancamento(
                    tipo="Despesa",
                    descricao=rng.choice(grupo.estabelecimentos),
                    categoria=grupo.categoria,
                    forma=cartao.nome,
                    valor=dinheiro(rng.uniform(grupo.valor_min, grupo.valor_max)),
                    data=date(ano, mes, rng.randint(1, ultimo_dia_mes)),
                )
            )

    if not avulsas:
        return fixos

    # Escala proporcional para fechar exatamente com o valor da fatura
    soma_avulsas = sum((item.valor for item in avulsas), Decimal("0"))
    escala = restante / soma_avulsas
    for compra in avulsas:
        compra.valor = max(dinheiro(compra.valor * escala), Decimal("1.00"))

    # Ajusta a diferença de arredondamento na maior compra
    diferenca = restante - sum((item.valor for item in avulsas), Decimal("0"))
    if diferenca:
        maior = max(avulsas, key=lambda item: item.valor)
        maior.valor = max(dinheiro(maior.valor + diferenca), Decimal("1.00"))

    avulsas.sort(key=lambda item: item.data)
    return fixos + avulsas


def gerar_lancamentos(anos: list[int], rng: random.Random) -> list[Lancamento]:
    lancamentos: list[Lancamento] = []

    for ano in anos:
        for mes in TODOS_OS_MESES:
            for item in ITENS:
                if mes not in item.meses:
                    continue
                if item.anos and ano not in item.anos:
                    continue

                valor = valor_do_mes(item, ano, mes, rng)
                if valor <= 0:
                    continue

                lancamentos.append(
                    Lancamento(
                        tipo=item.tipo,
                        descricao=item.descricao,
                        categoria=item.categoria,
                        forma=item.forma,
                        valor=valor,
                        data=dia_valido(ano, mes, item.dia),
                        observacoes=item.observacoes,
                    )
                )

            for cartao in CARTOES:
                lancamentos.extend(gerar_compras_cartao(cartao, ano, mes, rng))

        # Parcelamentos: um ciclo por ano, podendo avançar para o ano seguinte
        for parcelamento in PARCELAMENTOS:
            grupo = str(uuid.uuid4())
            valor_parcela = dinheiro(Decimal(parcelamento.valor_parcela) * Decimal(str(FATOR_ANO.get(ano, 1.0))))

            for indice in range(parcelamento.total_parcelas):
                ano_parcela, mes_parcela = somar_meses(ano, parcelamento.mes_inicio, indice)
                lancamentos.append(
                    Lancamento(
                        tipo="Despesa",
                        descricao=f"{parcelamento.descricao} ({indice + 1}/{parcelamento.total_parcelas})",
                        categoria=parcelamento.categoria,
                        forma=parcelamento.forma,
                        valor=valor_parcela,
                        data=dia_valido(ano_parcela, mes_parcela, parcelamento.dia),
                        observacoes=parcelamento.observacoes,
                        parcelado=True,
                        total_parcelas=parcelamento.total_parcelas,
                        parcela_atual=indice + 1,
                        parcelamento_id=grupo,
                    )
                )

    return lancamentos


def persistir(
    lancamentos: list[Lancamento],
    categorias: dict[str, Categoria],
    formas: dict[str, FormaPagamento],
    dry_run: bool,
) -> dict[str, int]:
    hoje = date.today()
    criadas = 0
    ignoradas = 0

    for lancamento in lancamentos:
        categoria = categorias[lancamento.categoria]
        forma = formas[lancamento.forma]

        duplicada = Transacao.query.filter(
            Transacao.descricao == lancamento.descricao,
            Transacao.data_transacao == lancamento.data,
            Transacao.categoria_id == categoria.id,
            Transacao.valor == lancamento.valor,
        ).first()
        if duplicada:
            ignoradas += 1
            continue

        if dry_run:
            criadas += 1
            continue

        competencia = competencia_fatura(lancamento.data, forma.dia_fechamento) if forma.cartao_credito else None

        db.session.add(
            Transacao(
                tipo=lancamento.tipo,
                categoria_id=categoria.id,
                descricao=lancamento.descricao,
                valor=lancamento.valor,
                data_transacao=lancamento.data,
                forma_pagamento_id=forma.id,
                status="Pago" if lancamento.data <= hoje else "Pendente",
                observacoes=lancamento.observacoes,
                parcelado=lancamento.parcelado,
                total_parcelas=lancamento.total_parcelas,
                parcela_atual=lancamento.parcela_atual or 1,
                valor_parcela=lancamento.valor if lancamento.parcelado else None,
                parcelamento_id=lancamento.parcelamento_id,
                recorrente=lancamento.parcelado,
                recorrencia_tipo="Parcelamento" if lancamento.parcelado else None,
                competencia_fatura=competencia,
            )
        )
        criadas += 1

    if dry_run:
        db.session.rollback()
    else:
        db.session.commit()

    return {"criadas": criadas, "ignoradas": ignoradas}


def limpar_periodo(anos: list[int]) -> int:
    inicio = date(min(anos), 1, 1)
    fim = date(max(anos) + 1, 12, 31)
    total = Transacao.query.filter(Transacao.data_transacao.between(inicio, fim)).delete(synchronize_session=False)
    db.session.commit()
    return total


def resumir(anos: list[int]) -> None:
    for ano in anos:
        inicio, fim = date(ano, 1, 1), date(ano, 12, 31)
        linha = []
        for tipo in ("Receita", "Despesa", "Investimento"):
            total = (
                db.session.query(func.sum(Transacao.valor))
                .filter(Transacao.tipo == tipo, Transacao.data_transacao.between(inicio, fim))
                .scalar()
                or 0
            )
            linha.append(f"{tipo}: R$ {float(total):,.2f}")
        print(f"  {ano} -> " + " | ".join(linha))


def executar(anos: list[int], limpar: bool, dry_run: bool, seed: int) -> None:
    rng = random.Random(seed)
    app = create_app()

    with app.app_context():
        if limpar and not dry_run:
            removidas = limpar_periodo(anos)
            print(f"Transações removidas no período: {removidas}")

        categorias, formas = preparar_cadastros()
        lancamentos = gerar_lancamentos(anos, rng)
        resultado = persistir(lancamentos, categorias, formas, dry_run)

        prefixo = "[dry-run] " if dry_run else ""
        print(f"{prefixo}Lançamentos criados: {resultado['criadas']} | já existentes: {resultado['ignoradas']}")

        if not dry_run:
            print("Totais por ano:")
            resumir(anos)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Gera base fictícia a partir do mês-base da planilha")
    parser.add_argument("--anos", type=int, nargs="+", default=[2025, 2026], help="Anos a gerar")
    parser.add_argument("--limpar", action="store_true", help="Apaga as transações do período antes de gerar")
    parser.add_argument("--dry-run", action="store_true", help="Simula sem gravar no banco")
    parser.add_argument("--seed", type=int, default=42, help="Semente da variação aleatória")
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    executar(sorted(set(args.anos)), args.limpar, args.dry_run, args.seed)
