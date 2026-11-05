import json
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Any, Dict, List, Optional
from sqlalchemy import func, desc, or_
from app import db
from app.models import Transacao, Categoria, FormaPagamento, MetaOrcamento
from app.routes_relatorios import _data_referencia_transacao


def _serializar(val: Any) -> Any:
    if isinstance(val, (date, datetime)):
        return val.isoformat()
    if isinstance(val, Decimal):
        return float(val)
    return val


def consultar_resumo_financeiro(inicio: str, fim: str) -> Dict[str, Any]:
    """Retorna o total de receitas, despesas, saldo e quantidade de transações em um período."""
    try:
        dt_ini = date.fromisoformat(inicio)
        dt_fim = date.fromisoformat(fim)
    except Exception:
        return {"erro": "Formato de data inválido. Use AAAA-MM-DD."}

    query = Transacao.query.filter(
        Transacao.data_transacao >= dt_ini,
        Transacao.data_transacao <= dt_fim
    )
    todas = query.all()

    receitas = 0.0
    despesas = 0.0
    investimentos = 0.0

    for t in todas:
        val = float(t.valor or 0)
        tipo = (t.tipo or "").upper()
        if tipo == "RECEITA":
            receitas += val
        elif tipo == "DESPESA":
            despesas += val
        elif tipo == "INVESTIMENTO":
            investimentos += val

    saldo = receitas - despesas

    return {
        "periodo": {"inicio": inicio, "fim": fim},
        "total_receitas": round(receitas, 2),
        "total_despesas": round(despesas, 2),
        "total_investimentos": round(investimentos, 2),
        "saldo_liquido": round(saldo, 2),
        "quantidade_transacoes": len(todas),
    }


def consultar_despesas_por_categoria(inicio: str, fim: str) -> Dict[str, Any]:
    """Retorna despesas agrupadas por categoria com valores totais e percentuais do total."""
    try:
        dt_ini = date.fromisoformat(inicio)
        dt_fim = date.fromisoformat(fim)
    except Exception:
        return {"erro": "Formato de data inválido. Use AAAA-MM-DD."}

    transacoes = Transacao.query.filter(
        Transacao.data_transacao >= dt_ini,
        Transacao.data_transacao <= dt_fim,
        func.upper(Transacao.tipo) == "DESPESA"
    ).all()

    agrupado: Dict[str, float] = {}
    total_despesas = 0.0

    for t in transacoes:
        cat_nome = t.categoria.nome if t.categoria else "Sem categoria"
        val = float(t.valor or 0)
        agrupado[cat_nome] = agrupado.get(cat_nome, 0.0) + val
        total_despesas += val

    categorias_lista = []
    for nome, total in sorted(agrupado.items(), key=lambda x: x[1], reverse=True):
        perc = (total / total_despesas * 100.0) if total_despesas > 0 else 0.0
        categorias_lista.append({
            "categoria": nome,
            "total": round(total, 2),
            "percentual": round(perc, 1)
        })

    return {
        "periodo": {"inicio": inicio, "fim": fim},
        "total_geral_despesas": round(total_despesas, 2),
        "categorias": categorias_lista
    }


def consultar_maiores_despesas(inicio: str, fim: str, limite: int = 5) -> Dict[str, Any]:
    """Retorna as N maiores despesas individuais registradas no período."""
    try:
        dt_ini = date.fromisoformat(inicio)
        dt_fim = date.fromisoformat(fim)
    except Exception:
        return {"erro": "Formato de data inválido. Use AAAA-MM-DD."}

    limite = max(1, min(limite or 5, 20))

    transacoes = Transacao.query.filter(
        Transacao.data_transacao >= dt_ini,
        Transacao.data_transacao <= dt_fim,
        func.upper(Transacao.tipo) == "DESPESA"
    ).order_by(Transacao.valor.desc()).limit(limite).all()

    itens = []
    for t in transacoes:
        itens.append({
            "id": t.id,
            "descricao": t.descricao,
            "valor": round(float(t.valor or 0), 2),
            "data": t.data_transacao.isoformat() if t.data_transacao else None,
            "categoria": t.categoria.nome if t.categoria else "Sem categoria",
            "forma_pagamento": t.forma_pagamento.nome if t.forma_pagamento else None,
            "parcelado": bool(t.parcelado),
            "parcela": f"{t.numero_parcela}/{t.total_parcelas}" if t.parcelado and t.total_parcelas else None
        })

    return {
        "periodo": {"inicio": inicio, "fim": fim},
        "limite": limite,
        "maiores_despesas": itens
    }


def comparar_gastos_periodos(periodo_1_inicio: str, periodo_1_fim: str, periodo_2_inicio: str, periodo_2_fim: str) -> Dict[str, Any]:
    """Compara os gastos e receitas entre dois períodos diferentes (ex: outubro vs novembro)."""
    res1 = consultar_resumo_financeiro(periodo_1_inicio, periodo_1_fim)
    res2 = consultar_resumo_financeiro(periodo_2_inicio, periodo_2_fim)

    despesas_1 = res1.get("total_despesas", 0.0)
    despesas_2 = res2.get("total_despesas", 0.0)
    dif_despesas = despesas_2 - despesas_1
    var_despesas_perc = round(((despesas_2 - despesas_1) / despesas_1 * 100.0), 1) if despesas_1 > 0 else 0.0

    return {
        "periodo_1": res1,
        "periodo_2": res2,
        "diferenca_despesas": round(dif_despesas, 2),
        "variacao_percentual_despesas": var_despesas_perc,
        "tendencia": "Aumento de gastos" if dif_despesas > 0 else ("Redução de gastos" if dif_despesas < 0 else "Estável")
    }


def consultar_metas_orcamento(mes: Optional[int] = None, ano: Optional[int] = None) -> Dict[str, Any]:
    """Consulta as metas e orçamentos configurados e quanto já foi consumido no mês."""
    hoje = date.today()
    mes_alvo = mes or hoje.month
    ano_alvo = ano or hoje.year

    metas = MetaOrcamento.query.filter(MetaOrcamento.ativo.is_(True)).all()
    resultado_metas = []

    dt_ini = date(ano_alvo, mes_alvo, 1)
    ultimo_dia = 28
    if mes_alvo in (1, 3, 5, 7, 8, 10, 12):
        ultimo_dia = 31
    elif mes_alvo in (4, 6, 9, 11):
        ultimo_dia = 30
    elif (ano_alvo % 4 == 0 and ano_alvo % 100 != 0) or (ano_alvo % 400 == 0):
        ultimo_dia = 29
    dt_fim = date(ano_alvo, mes_alvo, ultimo_dia)

    orcamento_total = 0.0
    gasto_total_metas = 0.0

    for m in metas:
        planejado = float(m.valor_limite or 0)
        orcamento_total += planejado

        # Realizado da categoria
        realizado = 0.0
        if m.categoria_id:
            soma = db.session.query(func.coalesce(func.sum(Transacao.valor), 0)).filter(
                Transacao.categoria_id == m.categoria_id,
                func.upper(Transacao.tipo) == "DESPESA",
                Transacao.data_transacao >= dt_ini,
                Transacao.data_transacao <= dt_fim
            ).scalar()
            realizado = float(soma or 0)

        gasto_total_metas += realizado
        perc = round((realizado / planejado * 100.0), 1) if planejado > 0 else 0.0
        disponivel = round(planejado - realizado, 2)

        situacao = "Dentro da meta"
        if perc > 100:
            situacao = "Ultrapassada"
        elif perc >= 75:
            situacao = "Em atenção"

        resultado_metas.append({
            "nome": m.nome or (m.categoria.nome if m.categoria else "Orçamento"),
            "categoria": m.categoria.nome if m.categoria else "Geral",
            "planejado": round(planejado, 2),
            "realizado": round(realizado, 2),
            "disponivel": disponivel,
            "percentual_consumido": perc,
            "situacao": situacao
        })

    return {
        "mes": mes_alvo,
        "ano": ano_alvo,
        "orcamento_total": round(orcamento_total, 2),
        "gasto_total_metas": round(gasto_total_metas, 2),
        "metas": resultado_metas
    }


def consultar_gastos_recorrentes() -> Dict[str, Any]:
    """Lista assinaturas e gastos fixos recorrentes cadastrados ou detectados."""
    recorrentes = Transacao.query.filter(
        or_(
            Transacao.recorrente.is_(True),
            Transacao.recorrencia_tipo == "Assinatura"
        ),
        func.upper(Transacao.tipo) == "DESPESA"
    ).all()

    vistos = set()
    itens = []
    total_mensal_estimado = 0.0

    for t in recorrentes:
        chave = (t.descricao or "").strip().upper()
        if chave in vistos:
            continue
        vistos.add(chave)
        val = float(t.valor or 0)
        total_mensal_estimado += val
        itens.append({
            "descricao": t.descricao,
            "valor": round(val, 2),
            "frequencia": t.frequencia or "Mensal",
            "categoria": t.categoria.nome if t.categoria else "Outros"
        })

    return {
        "quantidade_recorrentes": len(itens),
        "total_mensal_estimado": round(total_mensal_estimado, 2),
        "itens": itens
    }


def consultar_lancamentos_recentes(termo_busca: Optional[str] = None, tipo: Optional[str] = None, limite: int = 10) -> Dict[str, Any]:
    """Busca lançamentos específicos por descrição ou tipo."""
    query = Transacao.query
    if termo_busca:
        query = query.filter(Transacao.descricao.ilike(f"%{termo_busca.strip()}%"))
    if tipo:
        query = query.filter(func.upper(Transacao.tipo) == tipo.strip().upper())

    limite = max(1, min(limite or 10, 20))
    transacoes = query.order_by(Transacao.data_transacao.desc()).limit(limite).all()

    itens = []
    for t in transacoes:
        itens.append({
            "id": t.id,
            "descricao": t.descricao,
            "valor": round(float(t.valor or 0), 2),
            "data": t.data_transacao.isoformat() if t.data_transacao else None,
            "tipo": t.tipo,
            "categoria": t.categoria.nome if t.categoria else "Sem categoria",
            "forma_pagamento": t.forma_pagamento.nome if t.forma_pagamento else None
        })

    return {
        "termo_busca": termo_busca,
        "quantidade": len(itens),
        "lancamentos": itens
    }


# Mapeamento de execução
TOOL_FUNCTIONS = {
    "consultar_resumo_financeiro": consultar_resumo_financeiro,
    "consultar_despesas_por_categoria": consultar_despesas_por_categoria,
    "consultar_maiores_despesas": consultar_maiores_despesas,
    "comparar_gastos_periodos": comparar_gastos_periodos,
    "consultar_metas_orcamento": consultar_metas_orcamento,
    "consultar_gastos_recorrentes": consultar_gastos_recorrentes,
    "consultar_lancamentos_recentes": consultar_lancamentos_recentes,
}

# Definições de tools para a OpenAI
OPENAI_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "consultar_resumo_financeiro",
            "description": "Retorna totais consolidados de receitas, despesas, saldo líquido e contagem de transações no período (AAAA-MM-DD).",
            "parameters": {
                "type": "object",
                "properties": {
                    "inicio": {"type": "string", "description": "Data inicial no formato AAAA-MM-DD"},
                    "fim": {"type": "string", "description": "Data final no formato AAAA-MM-DD"}
                },
                "required": ["inicio", "fim"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "consultar_despesas_por_categoria",
            "description": "Retorna o total gasto em cada categoria financeira no período informado com percentuais.",
            "parameters": {
                "type": "object",
                "properties": {
                    "inicio": {"type": "string", "description": "Data inicial no formato AAAA-MM-DD"},
                    "fim": {"type": "string", "description": "Data final no formato AAAA-MM-DD"}
                },
                "required": ["inicio", "fim"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "consultar_maiores_despesas",
            "description": "Retorna as maiores despesas individuais no período especificado.",
            "parameters": {
                "type": "object",
                "properties": {
                    "inicio": {"type": "string", "description": "Data inicial AAAA-MM-DD"},
                    "fim": {"type": "string", "description": "Data final AAAA-MM-DD"},
                    "limite": {"type": "integer", "description": "Quantidade máxima de registros (padrão 5)"}
                },
                "required": ["inicio", "fim"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "comparar_gastos_periodos",
            "description": "Compara os resultados e variações percentuais de gastos entre dois períodos (ex: mês atual vs mês anterior).",
            "parameters": {
                "type": "object",
                "properties": {
                    "periodo_1_inicio": {"type": "string", "description": "Data início período base AAAA-MM-DD"},
                    "periodo_1_fim": {"type": "string", "description": "Data fim período base AAAA-MM-DD"},
                    "periodo_2_inicio": {"type": "string", "description": "Data início período comparado AAAA-MM-DD"},
                    "periodo_2_fim": {"type": "string", "description": "Data fim período comparado AAAA-MM-DD"}
                },
                "required": ["periodo_1_inicio", "periodo_1_fim", "periodo_2_inicio", "periodo_2_fim"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "consultar_metas_orcamento",
            "description": "Consulta o orçamento planejado, quanto já foi gasto e a situação das metas para o mês/ano especificado.",
            "parameters": {
                "type": "object",
                "properties": {
                    "mes": {"type": "integer", "description": "Mês (1-12)"},
                    "ano": {"type": "integer", "description": "Ano (ex: 2026)"}
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "consultar_gastos_recorrentes",
            "description": "Retorna todas as assinaturas e despesas fixas recorrentes cadastradas.",
            "parameters": {
                "type": "object",
                "properties": {}
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "consultar_lancamentos_recentes",
            "description": "Busca transações financeiras específicas pelo termo de busca ou tipo.",
            "parameters": {
                "type": "object",
                "properties": {
                    "termo_busca": {"type": "string", "description": "Texto contido na descrição (ex: 'Uber', 'Mercado')"},
                    "tipo": {"type": "string", "description": "'Receita', 'Despesa' ou 'Investimento'"},
                    "limite": {"type": "integer", "description": "Quantidade máxima de registros"}
                }
            }
        }
    }
]

