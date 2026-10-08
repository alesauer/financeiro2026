from datetime import date
from services.fatura_service import (
    calcular_competencia_fatura,
    calcular_vencimento_fatura,
    calcular_ciclo_compras,
)


class TestFaturaServiceDueMonthAlignment:
    """Testes para garantir o cálculo correto de competência, vencimento e ciclo de compras."""

    def test_nubank_fechamento_maior_que_vencimento(self):
        # Nubank: fecha dia 25, vence dia 3 do mês seguinte
        # Compras entre 26/08 e 25/09 -> Competência Setembro (2026-09-01) -> Vencimento 03/10
        comp1 = calcular_competencia_fatura(date(2026, 8, 28), 25)
        assert comp1 == date(2026, 9, 1)

        comp2 = calcular_competencia_fatura(date(2026, 9, 15), 25)
        assert comp2 == date(2026, 9, 1)

        # Compras entre 26/09 e 25/10 -> Competência Outubro (2026-10-01) -> Vencimento 03/11
        comp3 = calcular_competencia_fatura(date(2026, 9, 28), 25)
        assert comp3 == date(2026, 10, 1)

        # Vencimento exato para competência Setembro
        venc = calcular_vencimento_fatura(date(2026, 9, 1), 25, 3)
        assert venc == date(2026, 10, 3)

        # Ciclo de compras para competência Setembro
        ini_ciclo, fim_ciclo = calcular_ciclo_compras(date(2026, 9, 1), 25)
        assert ini_ciclo == date(2026, 8, 26)
        assert fim_ciclo == date(2026, 9, 25)

    def test_c6_fechamento_menor_que_vencimento(self):
        # C6: fecha dia 12, vence dia 20 do mesmo mês
        # Compras entre 13/08 e 12/09 -> Competência Setembro (2026-09-01) -> Vencimento 20/09
        comp1 = calcular_competencia_fatura(date(2026, 9, 5), 12)
        assert comp1 == date(2026, 9, 1)

        # Compras entre 13/09 e 12/10 -> Competência Outubro (2026-10-01) -> Vencimento 20/10
        comp2 = calcular_competencia_fatura(date(2026, 9, 15), 12)
        assert comp2 == date(2026, 10, 1)

        # Vencimento exato
        venc = calcular_vencimento_fatura(date(2026, 10, 1), 12, 20)
        assert venc == date(2026, 10, 20)

        # Ciclo de compras
        ini_ciclo, fim_ciclo = calcular_ciclo_compras(date(2026, 10, 1), 12)
        assert ini_ciclo == date(2026, 9, 13)
        assert fim_ciclo == date(2026, 10, 12)

    def test_virada_de_ano(self):
        # Nubank: compras em 28/12/2026 -> Fechamento em janeiro/2027 -> Competência 2027-01-01 -> Vencimento em fevereiro/2027
        comp = calcular_competencia_fatura(date(2026, 12, 28), 25)
        assert comp == date(2027, 1, 1)

        venc = calcular_vencimento_fatura(comp, 25, 3)
        assert venc == date(2027, 2, 3)

        # Nubank: compras no início de dezembro (ex: 10/12/2026) -> Fechamento em 25/12/2026 -> Competência 2026-12-01 -> Vencimento em janeiro/2027
        comp_dez = calcular_competencia_fatura(date(2026, 12, 10), 25)
        assert comp_dez == date(2026, 12, 1)

        venc_dez = calcular_vencimento_fatura(comp_dez, 25, 3)
        assert venc_dez == date(2027, 1, 3)
