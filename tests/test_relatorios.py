import unittest
from datetime import date
from app import create_app, db
from app.models import Transacao, FormaPagamento, Categoria
from app.routes_relatorios import _calcular_matriz, _data_referencia_transacao


class TestRelatoriosCreditCardAlignment(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = create_app()
        cls.app.config["TESTING"] = True

    def setUp(self):
        self.app_context = self.app.app_context()
        self.app_context.push()

    def tearDown(self):
        self.app_context.pop()

    def test_data_referencia_cartao_caixa_vs_competencia(self):
        # Nubank: fecha 25, vence 3 do mes seguinte
        forma = FormaPagamento(nome="Nubank Teste", tipo="Cartão", cartao_credito=True, dia_fechamento=25, dia_vencimento=3)
        cat = Categoria(nome="Alimentação Teste", tipo="Despesa")
        tx = Transacao(
            descricao="Compra Teste Setembro",
            valor=100.0,
            tipo="Despesa",
            data_transacao=date(2026, 9, 15),
            competencia_fatura=date(2026, 9, 1),
            forma_pagamento=forma,
            categoria=cat,
        )

        # Base Caixa (data): deve cair na data de vencimento (03/10/2026)
        ref_caixa = _data_referencia_transacao(tx, eh_cartao=True, dia_fechamento=25, dia_vencimento=3, usar_competencia=False)
        self.assertEqual(ref_caixa, date(2026, 10, 3))

        # Base Competência: deve cair no 1º dia da competência da fatura (01/09/2026)
        ref_comp = _data_referencia_transacao(tx, eh_cartao=True, dia_fechamento=25, dia_vencimento=3, usar_competencia=True)
        self.assertEqual(ref_comp, date(2026, 9, 1))

    def test_matriz_anual_2026_totals(self):
        # Verifica se o cálculo da matriz anual de 2026 retorna os 12 meses corretos
        matriz_caixa = _calcular_matriz(2026, "categoria", usar_competencia=False, status=None, cartoes_modo="categoria")
        sumario = matriz_caixa["sumario"]
        self.assertEqual(len(sumario["receita"]), 12)
        self.assertEqual(len(sumario["despesa"]), 12)
        self.assertEqual(len(sumario["saldo"]), 12)

        # Mês de Janeiro (index 0)
        self.assertEqual(sumario["receita"][0], 27446.0)
        self.assertEqual(sumario["despesa"][0], 23039.9)
        self.assertEqual(sumario["saldo"][0], 4406.1)

        # Mês de Setembro (index 8)
        self.assertEqual(sumario["receita"][8], 27395.0)
        self.assertEqual(sumario["despesa"][8], 27324.62)
        self.assertEqual(sumario["saldo"][8], 70.38)

        # Mês de Outubro (index 9)
        self.assertEqual(sumario["receita"][9], 27731.0)
        self.assertEqual(sumario["despesa"][9], 28198.97)
        self.assertEqual(sumario["saldo"][9], -467.97)
