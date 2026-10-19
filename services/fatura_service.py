from datetime import date, timedelta
from typing import Optional
import calendar


def _sanitize_dia(dia: Optional[int]) -> Optional[int]:
    if dia is None:
        return None
    try:
        dia_int = int(dia)
    except (TypeError, ValueError):
        return None
    if dia_int < 1 or dia_int > 31:
        return None
    return dia_int


def calcular_competencia_fatura(
    data_transacao: Optional[date],
    dia_fechamento: Optional[int],
    dia_vencimento: Optional[int] = None
) -> Optional[date]:
    """Retorna o primeiro dia do mês/ano de VENCIMENTO da fatura (Regime de Caixa).

    Exemplo 1 (fecha 26, vence dia 3 do mês seguinte):
      - Compra até dia 26/09: fecha 26/09, vence 03/10 -> Competência 2026-10-01 (Fatura de Outubro).
      - Compra após dia 26/09 (ex: 28/09): fecha 26/10, vence 03/11 -> Competência 2026-11-01 (Fatura de Novembro).

    Exemplo 2 (fecha 12, vence dia 20 do mesmo mês):
      - Compra até dia 12/10: fecha 12/10, vence 20/10 -> Competência 2026-10-01 (Fatura de Outubro).
      - Compra após dia 12/10: fecha 12/11, vence 20/11 -> Competência 2026-11-01 (Fatura de Novembro).
    """
    if not data_transacao:
        return None
    dia_fech = _sanitize_dia(dia_fechamento)
    if not dia_fech:
        return None
    dia_venc = _sanitize_dia(dia_vencimento) or 5

    # 1. Determina mês/ano de fechamento da fatura
    if data_transacao.day <= dia_fech:
        ano_fech = data_transacao.year
        mes_fech = data_transacao.month
    else:
        ano_fech = data_transacao.year
        mes_fech = data_transacao.month + 1
        if mes_fech > 12:
            mes_fech = 1
            ano_fech += 1

    # 2. Determina mês/ano de vencimento (competência)
    if dia_venc <= dia_fech:
        # Vence no mês seguinte ao fechamento
        ano_venc = ano_fech
        mes_venc = mes_fech + 1
        if mes_venc > 12:
            mes_venc = 1
            ano_venc += 1
    else:
        # Vence no mesmo mês do fechamento
        ano_venc = ano_fech
        mes_venc = mes_fech

    return date(ano_venc, mes_venc, 1)


def add_meses_competencia(competencia: date, meses: int) -> date:
    """Adiciona ou subtrai N meses de uma competência (sempre primeiro dia do mês)."""
    if not isinstance(competencia, date):
        raise ValueError("competencia deve ser uma instância de date")
    ano = competencia.year + (competencia.month + meses - 1) // 12
    mes = (competencia.month + meses - 1) % 12 + 1
    return date(ano, mes, 1)


def calcular_fatura_aberta_atual(
    hoje: Optional[date] = None,
    dia_fechamento: Optional[int] = None,
    dia_vencimento: Optional[int] = None,
) -> Optional[date]:
    """Retorna a competência (primeiro dia do mês de vencimento) da fatura de cartão de crédito atualmente aberta."""
    if hoje is None:
        hoje = date.today()
    return calcular_competencia_fatura(hoje, dia_fechamento, dia_vencimento)



def calcular_vencimento_fatura(
    competencia: Optional[date],
    dia_fechamento: Optional[int],
    dia_vencimento: Optional[int]
) -> Optional[date]:
    """Calcula a data exata de vencimento do boleto da fatura.

    No Regime de Caixa, 'competencia' é o próprio mês/ano do vencimento.
    """
    if not competencia:
        return None

    venc_dia = _sanitize_dia(dia_vencimento) or 5
    ano = competencia.year
    mes = competencia.month

    max_dias = calendar.monthrange(ano, mes)[1]
    dia_final = min(venc_dia, max_dias)
    return date(ano, mes, dia_final)


def calcular_ciclo_compras(
    competencia: Optional[date],
    dia_fechamento: Optional[int],
    dia_vencimento: Optional[int] = None
) -> tuple[Optional[date], Optional[date]]:
    """Retorna o intervalo de datas (inicio, fim) das compras correspondentes à fatura que vence em 'competencia'."""
    if not competencia:
        return None, None

    fech_dia = _sanitize_dia(dia_fechamento) or 28
    venc_dia = _sanitize_dia(dia_vencimento) or 5

    # Determina o mês de fechamento da fatura
    if venc_dia <= fech_dia:
        # Fechou no mês anterior ao vencimento
        mes_fech = competencia.month - 1
        ano_fech = competencia.year
        if mes_fech < 1:
            mes_fech = 12
            ano_fech -= 1
    else:
        # Fechou no mesmo mês do vencimento
        mes_fech = competencia.month
        ano_fech = competencia.year

    max_dias_fech = calendar.monthrange(ano_fech, mes_fech)[1]
    fim_ciclo = date(ano_fech, mes_fech, min(fech_dia, max_dias_fech))

    # Início do ciclo: dia seguinte ao fechamento do mês anterior
    mes_ant = mes_fech - 1
    ano_ant = ano_fech
    if mes_ant < 1:
        mes_ant = 12
        ano_ant -= 1

    max_dias_ant = calendar.monthrange(ano_ant, mes_ant)[1]
    dia_fech_ant = min(fech_dia, max_dias_ant)
    inicio_ciclo = date(ano_ant, mes_ant, dia_fech_ant) + timedelta(days=1)

    return inicio_ciclo, fim_ciclo


def aplicar_competencia_transacao(transacao, forma_pagamento=None, dia_fechamento_override: Optional[int] = None, dia_vencimento_override: Optional[int] = None):
    """Atualiza o campo competencia_fatura se houver cartão de crédito e fechamento configurado.

    dia_fechamento_override/dia_vencimento_override permitem usar valores específicos por lote ou período
    sem alterar o cadastro padrão do cartão.
    """
    if transacao is None:
        return

    if forma_pagamento is None and getattr(transacao, "forma_pagamento", None):
        forma_pagamento = transacao.forma_pagamento

    if forma_pagamento is None:
        from app.models import FormaPagamento
        if transacao.forma_pagamento_id:
            forma_pagamento = FormaPagamento.query.get(transacao.forma_pagamento_id)

    if forma_pagamento and getattr(forma_pagamento, "cartao_credito", False):
        dia_fechamento = dia_fechamento_override
        if dia_fechamento is None:
            dia_fechamento = getattr(forma_pagamento, "dia_fechamento", None)
        dia_vencimento = dia_vencimento_override
        if dia_vencimento is None:
            dia_vencimento = getattr(forma_pagamento, "dia_vencimento", None)

        transacao.competencia_fatura = calcular_competencia_fatura(
            transacao.data_transacao,
            dia_fechamento,
            dia_vencimento
        )
    else:
        transacao.competencia_fatura = None
