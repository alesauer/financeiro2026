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


def calcular_competencia_fatura(data_transacao: Optional[date], dia_fechamento: Optional[int]) -> Optional[date]:
    """Retorna o primeiro dia do mês/ano da fatura em que a transação cairá."""
    if not data_transacao:
        return None
    dia = _sanitize_dia(dia_fechamento)
    if not dia:
        return None

    if data_transacao.day <= dia:
        return date(data_transacao.year, data_transacao.month, 1)

    ano = data_transacao.year
    mes = data_transacao.month + 1
    if mes > 12:
        mes = 1
        ano += 1
    return date(ano, mes, 1)


def calcular_vencimento_fatura(
    competencia: Optional[date],
    dia_fechamento: Optional[int],
    dia_vencimento: Optional[int]
) -> Optional[date]:
    """Calcula a data exata de vencimento do boleto da fatura.

    Se dia_vencimento <= dia_fechamento (ex: fecha 26, vence dia 3):
        O vencimento ocorre no mês seguinte ao da competência da fatura.
    Se dia_vencimento > dia_fechamento (ex: fecha 12, vence dia 20):
        O vencimento ocorre no mesmo mês da competência da fatura.
    """
    if not competencia:
        return None

    venc_dia = _sanitize_dia(dia_vencimento) or 5
    fech_dia = _sanitize_dia(dia_fechamento) or 28

    if venc_dia <= fech_dia:
        ano = competencia.year
        mes = competencia.month + 1
        if mes > 12:
            mes = 1
            ano += 1
    else:
        ano = competencia.year
        mes = competencia.month

    max_dias = calendar.monthrange(ano, mes)[1]
    dia_final = min(venc_dia, max_dias)
    return date(ano, mes, dia_final)


def calcular_ciclo_compras(
    competencia: Optional[date],
    dia_fechamento: Optional[int]
) -> tuple[Optional[date], Optional[date]]:
    """Retorna o intervalo de datas (inicio, fim) das compras correspondentes a esta fatura."""
    if not competencia:
        return None, None

    fech_dia = _sanitize_dia(dia_fechamento) or 28

    # Fim do ciclo: dia de fechamento no mês da competência
    max_dias_comp = calendar.monthrange(competencia.year, competencia.month)[1]
    fim_ciclo = date(competencia.year, competencia.month, min(fech_dia, max_dias_comp))

    # Início do ciclo: dia após o fechamento do mês anterior
    mes_ant = competencia.month - 1
    ano_ant = competencia.year
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

        transacao.competencia_fatura = calcular_competencia_fatura(
            transacao.data_transacao,
            dia_fechamento
        )
    else:
        transacao.competencia_fatura = None
