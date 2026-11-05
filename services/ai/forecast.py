import json
import logging
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Any, Dict, List, Optional
from sqlalchemy import func
from app import db
from app.models import Transacao, Categoria, MetaOrcamento
from services.ai.client import get_openai_client, registrar_consumo

logger = logging.getLogger(__name__)


def calcular_previsao_gastos(mes: Optional[int] = None, ano: Optional[int] = None, usuario_id: Optional[int] = None) -> Dict[str, Any]:
    """Calcula a previsão estatística de gastos para o mês especificado."""
    hoje = date.today()
    mes_alvo = mes or hoje.month
    ano_alvo = ano or hoje.year

    # Determinar quantidade de dias do mês alvo
    ultimo_dia = 28
    if mes_alvo in (1, 3, 5, 7, 8, 10, 12):
        ultimo_dia = 31
    elif mes_alvo in (4, 6, 9, 11):
        ultimo_dia = 30
    elif (ano_alvo % 4 == 0 and ano_alvo % 100 != 0) or (ano_alvo % 400 == 0):
        ultimo_dia = 29

    dt_ini = date(ano_alvo, mes_alvo, 1)
    dt_fim = date(ano_alvo, mes_alvo, ultimo_dia)

    # Dias transcorridos no mês
    if ano_alvo < hoje.year or (ano_alvo == hoje.year and mes_alvo < hoje.month):
        dias_transcorridos = ultimo_dia
        dias_restantes = 0
    elif ano_alvo == hoje.year and mes_alvo == hoje.month:
        dias_transcorridos = max(1, hoje.day)
        dias_restantes = max(0, ultimo_dia - hoje.day)
    else:
        dias_transcorridos = 0
        dias_restantes = ultimo_dia

    # 1. Gastos já realizados no mês
    gastos_atuais_query = db.session.query(
        func.coalesce(func.sum(Transacao.valor), 0)
    ).filter(
        Transacao.data_transacao >= dt_ini,
        Transacao.data_transacao <= dt_fim,
        func.upper(Transacao.tipo) == "DESPESA"
    ).scalar()
    gasto_acumulado = float(gastos_atuais_query or 0)

    # 2. Orçamento total definido em metas
    metas = MetaOrcamento.query.filter(MetaOrcamento.ativo.is_(True)).all()
    orcamento_total = float(sum([m.valor_limite or 0 for m in metas]))

    # 3. Histórico dos últimos 3 a 6 meses para cálculo de média e variância
    historico_meses = []
    totais_historicos = []
    for i in range(1, 7):
        m_ant = mes_alvo - i
        y_ant = ano_alvo
        while m_ant <= 0:
            m_ant += 12
            y_ant -= 1

        u_dia_ant = 28
        if m_ant in (1, 3, 5, 7, 8, 10, 12):
            u_dia_ant = 31
        elif m_ant in (4, 6, 9, 11):
            u_dia_ant = 30
        elif (y_ant % 4 == 0 and y_ant % 100 != 0) or (y_ant % 400 == 0):
            u_dia_ant = 29

        ini_ant = date(y_ant, m_ant, 1)
        fim_ant = date(y_ant, m_ant, u_dia_ant)

        total_ant = db.session.query(func.coalesce(func.sum(Transacao.valor), 0)).filter(
            Transacao.data_transacao >= ini_ant,
            Transacao.data_transacao <= fim_ant,
            func.upper(Transacao.tipo) == "DESPESA"
        ).scalar()
        val_ant = float(total_ant or 0)
        if val_ant > 0:
            historico_meses.append({
                "mes": m_ant,
                "ano": y_ant,
                "label": f"{m_ant:02d}/{y_ant}",
                "total": round(val_ant, 2)
            })
            totais_historicos.append(val_ant)

    media_historica = (sum(totais_historicos) / len(totais_historicos)) if totais_historicos else gasto_acumulado

    # 4. Projeção estatística combinada (ritmo diário recente + média ponderada histórica)
    if dias_transcorridos > 0 and dias_restantes > 0:
        ritmo_diario_atual = gasto_acumulado / dias_transcorridos
        projecao_linear = ritmo_diario_atual * ultimo_dia

        # Ponderação: 60% ritmo do mês + 40% média histórica
        projecao_final = round((0.65 * projecao_linear) + (0.35 * media_historica), 2)
        previsao_restante = max(0.0, round(projecao_final - gasto_acumulado, 2))
    elif dias_restantes == 0:
        projecao_final = round(gasto_acumulado, 2)
        previsao_restante = 0.0
    else:
        projecao_final = round(media_historica, 2)
        previsao_restante = round(media_historica, 2)

    excedente_previsto = round(projecao_final - orcamento_total, 2) if orcamento_total > 0 else 0.0
    percentual_orcamento = round((projecao_final / orcamento_total * 100.0), 1) if orcamento_total > 0 else 0.0

    # 5. Grau de confiabilidade estatística
    num_amostras = len(totais_historicos)
    if num_amostras >= 4 and dias_transcorridos >= 5:
        confiabilidade = "Alta"
        grau_confianca = 88
    elif num_amostras >= 2 or dias_transcorridos >= 10:
        confiabilidade = "Média"
        grau_confianca = 72
    else:
        confiabilidade = "Baixa (histórico inicial)"
        grau_confianca = 45

    # 6. Projeção por Categoria
    categorias = Categoria.query.filter(func.upper(Categoria.tipo) == "DESPESA").all()
    categorias_projecao = []

    for cat in categorias:
        gasto_cat_mes = db.session.query(func.coalesce(func.sum(Transacao.valor), 0)).filter(
            Transacao.categoria_id == cat.id,
            Transacao.data_transacao >= dt_ini,
            Transacao.data_transacao <= dt_fim,
            func.upper(Transacao.tipo) == "DESPESA"
        ).scalar()
        real_cat = float(gasto_cat_mes or 0)

        meta_cat = MetaOrcamento.query.filter(
            MetaOrcamento.categoria_id == cat.id,
            MetaOrcamento.ativo.is_(True)
        ).first()
        limite_cat = float(meta_cat.valor_limite) if meta_cat and meta_cat.valor_limite else 0.0

        if dias_transcorridos > 0 and dias_restantes > 0:
            proj_cat = round((real_cat / dias_transcorridos) * ultimo_dia, 2)
        else:
            proj_cat = round(real_cat, 2)

        if real_cat > 0 or limite_cat > 0:
            categorias_projecao.append({
                "categoria_id": cat.id,
                "categoria": cat.nome,
                "realizado_ate_agora": round(real_cat, 2),
                "projecao_fim_mes": proj_cat,
                "orcamento_limite": round(limite_cat, 2),
                "status": "Risco de exceder" if (limite_cat > 0 and proj_cat > limite_cat) else "Dentro do esperado"
            })

    categorias_projecao.sort(key=lambda x: x["projecao_fim_mes"], reverse=True)

    # 7. Projeção diária cumulativa (Gráfico)
    projecao_diaria = []
    acumulado_grafico = 0.0
    media_diaria = projecao_final / ultimo_dia if ultimo_dia > 0 else 0.0

    # Agrupar gastos reais por dia
    gastos_por_dia = dict(
        db.session.query(
            func.strftime("%d", Transacao.data_transacao),
            func.sum(Transacao.valor)
        ).filter(
            Transacao.data_transacao >= dt_ini,
            Transacao.data_transacao <= dt_fim,
            func.upper(Transacao.tipo) == "DESPESA"
        ).group_by(func.strftime("%d", Transacao.data_transacao)).all()
    )

    for d in range(1, ultimo_dia + 1):
        dia_str = f"{d:02d}"
        valor_real_dia = float(gastos_por_dia.get(dia_str) or 0)

        if d <= dias_transcorridos:
            acumulado_grafico += valor_real_dia
            projecao_diaria.append({
                "dia": d,
                "realizado_acumulado": round(acumulado_grafico, 2),
                "projetado_acumulado": round(d * media_diaria, 2)
            })
        else:
            projecao_diaria.append({
                "dia": d,
                "realizado_acumulado": None,
                "projetado_acumulado": round(d * media_diaria, 2)
            })

    # 8. Explicação da IA
    explicacao = (
        f"Com base nos {dias_transcorridos} dias transcorridos e na média histórica dos últimos meses, "
        f"seu ritmo de gastos projeta um encerramento em R$ {projecao_final:,.2f}. "
    )
    if orcamento_total > 0:
        if excedente_previsto > 0:
            explicacao += f"Há um risco de exceder o orçamento total em R$ {excedente_previsto:,.2f} ({percentual_orcamento}% do teto)."
        else:
            explicacao += f"Seus gastos estão dentro do teto orçamentário previsto de R$ {orcamento_total:,.2f}."

    # Tenta enriquecer com OpenAI se disponível
    client = get_openai_client()
    if client and usuario_id:
        try:
            prompt = (
                f"Resuma em 2 ou 3 frases claras em português do Brasil a seguinte previsão de gastos:\n"
                f"- Mês: {mes_alvo:02d}/{ano_alvo}\n"
                f"- Gasto até o momento: R$ {gasto_acumulado:.2f}\n"
                f"- Dias transcorridos: {dias_transcorridos} de {ultimo_dia}\n"
                f"- Projeção final do mês: R$ {projecao_final:.2f}\n"
                f"- Orçamento planejado: R$ {orcamento_total:.2f}\n"
                f"- Excedente previsto: R$ {excedente_previsto:.2f}\n"
                f"- Principais categorias com maior peso: {[c['categoria'] for c in categorias_projecao[:3]]}\n"
                "Seja direto e prático com conselhos acionáveis."
            )
            resp = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "Você é um consultor financeiro analítico e objetivo."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=180,
                temperature=0.3
            )
            conteudo = resp.choices[0].message.content
            if conteudo:
                explicacao = conteudo.strip()
                if resp.usage:
                    registrar_consumo(
                        usuario_id=usuario_id,
                        funcionalidade="previsao_gastos",
                        modelo="gpt-4o-mini",
                        prompt_tokens=resp.usage.prompt_tokens,
                        completion_tokens=resp.usage.completion_tokens
                    )
        except Exception as e:
            logger.warning(f"Fallback local para explicação da previsão: {e}")

    return {
        "mes": mes_alvo,
        "ano": ano_alvo,
        "dias_transcorridos": dias_transcorridos,
        "dias_restantes": dias_restantes,
        "ultimo_dia_mes": ultimo_dia,
        "gasto_acumulado": round(gasto_acumulado, 2),
        "previsao_restante": round(previsao_restante, 2),
        "projecao_final": round(projecao_final, 2),
        "orcamento_total": round(orcamento_total, 2),
        "excedente_previsto": round(excedente_previsto, 2),
        "percentual_orcamento": percentual_orcamento,
        "confiabilidade": confiabilidade,
        "grau_confianca": grau_confianca,
        "media_historica": round(media_historica, 2),
        "historico_meses": historico_meses,
        "categorias_projecao": categorias_projecao,
        "projecao_diaria": projecao_diaria,
        "explicacao_ia": explicacao
    }

