import unittest
from datetime import date, timedelta
from app import create_app, db
from app.models import Usuario, Milha
from app.routes_milhas import _assegurar_colunas_extras


class TestMilhasModule(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = create_app()
        cls.app.config["TESTING"] = True
        cls.client = cls.app.test_client()

    def setUp(self):
        self.app_context = self.app.app_context()
        self.app_context.push()
        _assegurar_colunas_extras()

    def tearDown(self):
        self.app_context.pop()

    def test_milha_cpm_property(self):
        # Compra de 10.000 pontos por R$ 350,00 -> CPM = R$ 35,00
        m = Milha(
            usuario_id=1,
            programa="Livelo",
            tipo="entrada",
            quantidade=10000,
            custo_reais=350.00,
            data_movimentacao=date.today(),
        )
        self.assertEqual(m.cpm, 35.00)

        # Sem custo
        m2 = Milha(
            usuario_id=1,
            programa="Smiles",
            tipo="entrada",
            quantidade=5000,
            custo_reais=None,
            data_movimentacao=date.today(),
        )
        self.assertIsNone(m2.cpm)

    def test_model_fields_and_transfer_simulation(self):
        m_saida = Milha(
            usuario_id=1,
            programa="Livelo",
            tipo="saida",
            quantidade=10000,
            categoria_origem="Transferência",
            transferencia_id="uuid-teste-123",
            data_movimentacao=date.today(),
        )
        m_entrada = Milha(
            usuario_id=1,
            programa="Smiles",
            tipo="entrada",
            quantidade=18000,
            taxa_bonus=80.0,
            categoria_origem="Transferência Bonificada",
            transferencia_id="uuid-teste-123",
            data_movimentacao=date.today(),
        )

        db.session.add_all([m_saida, m_entrada])
        db.session.commit()

        # Verifica recuperação e vínculo
        recuperadas = Milha.query.filter_by(transferencia_id="uuid-teste-123").all()
        self.assertEqual(len(recuperadas), 2)

        # Limpeza
        Milha.query.filter_by(transferencia_id="uuid-teste-123").delete()
        db.session.commit()
