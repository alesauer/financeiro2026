import math
import logging
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional
from sqlalchemy import func
from app import db
from app.models import Transacao, Categoria, MetaOrcamento, IAAlertaAnomalia
from services.ai.client import get_openai_client, registrar_consumo

logger = logging.getLogger(__name__)


def detectar_e_atualizar_anomalias(usuario_id: int) -> Dict[str, Any]:
    """Varre as transações recentes e histórico para detectar anomalias financeiras e salvar alertas."""
    hoje = date.today()
    dt_30_dias = hoje - timedelta(days=35)
    dt_90_dias = hoje - timedelta(days=95)

    alertas_novos = 0

    # 1. Transações dos últimos 35 dias para análise de anomalias
    transacoes_recentes = Transacao.query.filter(
        Transacao.data_transacao >= dt_30_dias,
        func.upper(Transacao.tipo) == "DESPESA"
    ).all()

    # 2. Estatísticas por Categoria (Média e Desvio Padrão dos últimos 90 dias)
    transacoes_historico = Transacao.query.filter(
        Transacao.data_transacao >= dt_90_dias,
        func.upper(Transacao.tipo) == "DESPESA"
    ).all()

    valores_por_cat: Dict[int, List[float]] = {}
    for t in transacoes_historico:
        if t.categoria_id and t.valor:
            valores_por_cat.setdefault(t.categoria_id, []).append(float(t.valor))

    stats_cat: Dict[int, Dict[str, float]] = {}
    for cat_id, vals in valores_por_cat.items():
        if len(vals) >= 3:
            media = sum(vals) / len(vals)
            variancia = sum((x - media) ** 2 for x in vals) / len(vals)
            desvio = math.sqrt(variancia)
            stats_cat[cat_id] = {"media": media, "desvio": desvio, "qtd": len(vals)}

    # REGRA A: Transação com valor muito acima da média (Z-Score > 2.2 e valor > R$ 100)
    for t in transacoes_recentes:
        val = float(t.valor or 0)
        if t.categoria_id in stats_cat and val > 100.0:
            media = stats_cat[t.categoria_id]["media"]
            desvio = stats_cat[t.categoria_id]["desvio"]
            if desvio > 0:
                z_score = (val - media) / desvio
                if z_score >= 2.2 and val >= (media * 1.8):
                    chave = f"zscore_{t.id}"
                    if not IAAlertaAnomalia.query.filter_by(chave_deduplicacao=chave).first():
                        cat_nome = t.categoria.nome if t.categoria else "esta categoria"
                        alerta = IAAlertaAnomalia(
                            usuario_id=usuario_id,
                            tipo_anomalia="gasto_acima_media",
                            gravidade="critico" if z_score >= 3.0 else "atencao",
                            titulo=f"Gasto atípico em {cat_nome}",
                            descricao=(
                                f"A despesa '{t.descricao}' de R$ {val:,.2f} no dia {t.data_transacao.strftime('%d/%m/%Y')} "
                                f"ficou muito acima da sua média habitual de R$ {media:,.2f} em {cat_nome}."
                            ),
                            valor_envolvido=val,
                            transacao_id=t.id,
                            categoria_id=t.categoria_id,
                            chave_deduplicacao=chave
                        )
                        db.session.add(alerta)
                        alertas_novos += 1

    # REGRA B: Possíveis Lançamentos Duplicados (mesmo valor, mesma descrição, intervalo <= 3 dias)
    from services.categorization.normalizer import normalizar_descricao
    vistos_dupl = {}
    for t in transacoes_recentes:
        norm = normalizar_descricao(t.descricao)
        val = float(t.valor or 0)
        chave_par = (norm, val)
        if chave_par in vistos_dupl:
            t_anterior = vistos_dupl[chave_par]
            if t.id != t_anterior.id:
                diff_dias = abs((t.data_transacao - t_anterior.data_transacao).days)
                if diff_dias <= 3:
                    chave = f"duplicado_{min(t.id, t_anterior.id)}_{max(t.id, t_anterior.id)}"
                    if not IAAlertaAnomalia.query.filter_by(chave_deduplicacao=chave).first():
                        alerta = IAAlertaAnomalia(
                            usuario_id=usuario_id,
                            tipo_anomalia="possivel_duplicado",
                            gravidade="atencao",
                            titulo="Possível lançamento duplicado",
                            descricao=(
                                f"Foram identificados dois lançamentos de R$ {val:,.2f} com descrição semelhante "
                                f"('{t.descricao}') nos dias {t_anterior.data_transacao.strftime('%d/%m')} e {t.data_transacao.strftime('%d/%m')}."
                            ),
                            valor_envolvido=val,
                            transacao_id=t.id,
                            categoria_id=t.categoria_id,
                            chave_deduplicacao=chave
                        )
                        db.session.add(alerta)
                        alertas_novos += 1
        else:
            vistos_dupl[chave_par] = t

    # REGRA C: Metas ultrapassadas ou com consumo crítico no mês atual
    ini_mes = date(hoje.year, hoje.month, 1)
    metas_ativas = MetaOrcamento.query.filter(MetaOrcamento.ativo.is_(True)).all()
    for m in metas_ativas:
        if m.categoria_id:
            gasto_mes = db.session.query(func.coalesce(func.sum(Transacao.valor), 0)).filter(
                Transacao.categoria_id == m.categoria_id,
                Transacao.data_transacao >= ini_mes,
                func.upper(Transacao.tipo) == "DESPESA"
            ).scalar()
            total_gasto = float(gasto_mes or 0)
            limite = float(m.valor_limite or 0)
            if limite > 0:
                perc = (total_gasto / limite) * 100.0
                if perc > 100.0:
                    chave = f"meta_ultrapassada_{m.id}_{hoje.year}_{hoje.month}"
                    if not IAAlertaAnomalia.query.filter_by(chave_deduplicacao=chave).first():
                        cat_nome = m.categoria.nome if m.categoria else "Meta"
                        alerta = IAAlertaAnomalia(
                            usuario_id=usuario_id,
                            tipo_anomalia="estouro_orcamento",
                            gravidade="critico",
                            titulo=f"Orçamento excedido em {cat_nome}",
                            descricao=(
                                f"A meta de {cat_nome} de R$ {limite:,.2f} foi ultrapassada em "
                                f"R$ {(total_gasto - limite):,.2f} ({perc:.1f}% consumido)."
                            ),
                            valor_envolvido=total_gasto,
                            categoria_id=m.categoria_id,
                            chave_deduplicacao=chave
                        )
                        db.session.add(alerta)
                        alertas_novos += 1

    try:
        db.session.commit()
    except Exception as e:
        logger.error(f"Erro ao salvar anomalias: {e}")
        db.session.rollback()

    return {
        "status": "sucesso",
        "novos_alertas_criados": alertas_novos
    }

