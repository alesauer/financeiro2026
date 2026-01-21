from datetime import date
from typing import Optional


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

