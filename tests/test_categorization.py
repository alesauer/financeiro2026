import os
import sys
import unittest
from unittest.mock import patch, MagicMock

# Garantir raiz do projeto no path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app import create_app, db
from app.models import Categoria, CategoriaAlias, Transacao
from services.categorization.normalizer import normalizar_descricao, extrair_tokens, remover_acentos
from services.categorization.rules import classificar_por_regras
from services.categorization.fuzzy import calcular_similaridade, buscar_por_similaridade
from services.categorization.history import salvar_ou_atualizar_alias, buscar_em_aliases
from services.categorization.engine import CategorizationEngine, CategorizationResult
from services.categorization.ai import classificar_com_ia


class TestNormalizer(unittest.TestCase):
    def test_remover_acentos(self):
        self.assertEqual(remover_acentos("Alimentação & Saúde"), "Alimentacao & Saude")
        self.assertEqual(remover_acentos("Combustível"), "Combustivel")
        self.assertEqual(remover_acentos(""), "")

    def test_normalizacao_gateways_e_marcas(self):
        self.assertEqual(normalizar_descricao("UBER *TRIP"), "UBER TRIP")
        self.assertEqual(normalizar_descricao("MP *MERCADOLIVRE"), "MERCADOLIVRE")
        self.assertEqual(normalizar_descricao("IFD *PADARIA CENTRAL"), "PADARIA CENTRAL")
        self.assertEqual(normalizar_descricao("DL *ALIEXPRESS BR ALIP"), "ALIEXPRESS ALIP")

    def test_remocao_parcelas(self):
        self.assertEqual(normalizar_descricao("Canal Bike - Parcela 2/10"), "CANAL BIKE")
        self.assertEqual(normalizar_descricao("Lojas Renner (1/3)"), "LOJAS RENNER")
        self.assertEqual(normalizar_descricao("Apple Store #R095 - 2/5"), "APPLE STORE")
        self.assertEqual(normalizar_descricao("Curso Alura - Parc. 02/12"), "CURSO ALURA")

    def test_remocao_sufixos_juridicos_e_dominios(self):
        self.assertEqual(normalizar_descricao("SUPERMERCADO BH LTDA"), "SUPERMERCADO BH")
        self.assertEqual(normalizar_descricao("FARMACIA RAIA S/A"), "FARMACIA RAIA")
        self.assertEqual(normalizar_descricao("NETFLIX.COM.BR"), "NETFLIX")
        self.assertEqual(normalizar_descricao("AMAZON.COM.BR"), "AMAZON")

    def test_extracao_tokens(self):
        tokens = extrair_tokens("Supermercado BH de Minas Gerais LTDA")
        self.assertIn("SUPERMERCADO", tokens)
        self.assertIn("MINAS", tokens)
        self.assertNotIn("DE", tokens)
        self.assertNotIn("LTDA", tokens)


class TestDeterministicRules(unittest.TestCase):
    def test_regras_combustivel(self):
        res = classificar_por_regras("POSTO PETROBRAS")
        self.assertIsNotNone(res)
        self.assertEqual(res[0], "Combustível")
        self.assertGreaterEqual(res[1], 0.90)

        res2 = classificar_por_regras("SHELL AUTO POSTO 12")
        self.assertIsNotNone(res2)
        self.assertEqual(res2[0], "Combustível")

    def test_regras_transporte(self):
        res = classificar_por_regras("UBER *TRIP")
        self.assertIsNotNone(res)
        self.assertEqual(res[0], "Transporte")

        res_99 = classificar_por_regras("99APP MOTORISTA")
        self.assertIsNotNone(res_99)
        self.assertEqual(res_99[0], "Transporte")

    def test_regras_alimentacao(self):
        res = classificar_por_regras("IFOOD *REST DONA MARIA")
        self.assertIsNotNone(res)
        self.assertEqual(res[0], "Alimentação")

        res_bk = classificar_por_regras("BURGER KING BRASIL")
        self.assertIsNotNone(res_bk)
        self.assertEqual(res_bk[0], "Alimentação")

    def test_regras_supermercado(self):
        res = classificar_por_regras("SUPERMERCADO BH LOJA 24")
        self.assertIsNotNone(res)
        self.assertEqual(res[0], "Supermercado")

        res_carrefour = classificar_por_regras("CARREFOUR HIPER")
        self.assertIsNotNone(res_carrefour)
        self.assertEqual(res_carrefour[0], "Supermercado")

    def test_regras_farmacia(self):
        res = classificar_por_regras("DROGASIL FILIAL 105")
        self.assertIsNotNone(res)
        self.assertEqual(res[0], "Farmácia")

    def test_regras_assinaturas(self):
        res = classificar_por_regras("NETFLIX.COM BR")
        self.assertIsNotNone(res)
        self.assertEqual(res[0], "Assinaturas")

        res_spot = classificar_por_regras("SPOTIFY BRASIL")
        self.assertIsNotNone(res_spot)
        self.assertEqual(res_spot[0], "Assinaturas")

    def test_regras_compras_online(self):
        res_amz = classificar_por_regras("AMAZON.COM.BR")
        self.assertIsNotNone(res_amz)
        self.assertEqual(res_amz[0], "Compras Online")

        res_meli = classificar_por_regras("MERCD LIVRE BRASIL")
        self.assertIsNotNone(res_meli)
        self.assertEqual(res_meli[0], "Compras Online")

        res_shopee = classificar_por_regras("SHOPEE *PEDIDO 123")
        self.assertIsNotNone(res_shopee)
        self.assertEqual(res_shopee[0], "Compras Online")

        res_ali = classificar_por_regras("DL *ALIEXPRESS BR")
        self.assertIsNotNone(res_ali)
        self.assertEqual(res_ali[0], "Compras Online")

    def test_regras_compras_varejo(self):
        res_zara = classificar_por_regras("ZARA BRASIL")
        self.assertIsNotNone(res_zara)
        self.assertEqual(res_zara[0], "Compras")

        res_renner = classificar_por_regras("LOJAS RENNER")
        self.assertIsNotNone(res_renner)
        self.assertEqual(res_renner[0], "Compras")


class TestFuzzyMatching(unittest.TestCase):
    def test_similaridade_alta_variacoes_merchant(self):
        candidatos = {
            "SUPERMERCADO BH": ("Supermercado", 1),
            "DROGASIL": ("Farmácia", 2),
            "CANAL BIKE": ("Compras", 3),
        }

        # Variação com identificador POS ou filial
        res = buscar_por_similaridade("SUPERMERCADO BH LJ 05", candidatos, threshold=0.75)
        self.assertIsNotNone(res)
        self.assertEqual(res[0], "Supermercado")
        self.assertEqual(res[1], 1)
        self.assertGreaterEqual(res[2], 0.75)

        # Variação Drogasil
        res_drog = buscar_por_similaridade("DROGASIL DROGARIA", candidatos, threshold=0.80)
        self.assertIsNotNone(res_drog)
        self.assertEqual(res_drog[0], "Farmácia")

    def test_sem_falso_positivo(self):
        candidatos = {
            "SUPERMERCADO BH": ("Supermercado", 1),
        }
        res = buscar_por_similaridade("AUTO ESCOLA CENTRAL", candidatos, threshold=0.85)
        self.assertIsNone(res)


class TestCategorizationEngineIntegration(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = create_app()
        cls.app.config["TESTING"] = True
        cls.client = cls.app.test_client()

    def setUp(self):
        self.app_context = self.app.app_context()
        self.app_context.push()

    def tearDown(self):
        self.app_context.pop()

    def test_alias_aprendizado_e_prioridade(self):
        cat_transporte = Categoria.query.filter_by(nome="Transporte", tipo="Despesa").first()
        if not cat_transporte:
            cat_transporte = Categoria(nome="Transporte", tipo="Despesa")
            db.session.add(cat_transporte)
            db.session.commit()

        # 1. Salvar alias com origem usuário
        alias = salvar_ou_atualizar_alias(
            descricao_original="ESTABELECIMENTO XPTO TESTE",
            categoria_id=cat_transporte.id,
            origem="usuario",
            confianca=1.0,
            commit=True
        )
        self.assertIsNotNone(alias)

        # 2. Motor deve resolver via camada de Alias com 100% de confiança
        engine = CategorizationEngine(usar_ia=False)
        resultado = engine.categorizar_uma("ESTABELECIMENTO XPTO TESTE")

        self.assertEqual(resultado.categoria, "Transporte")
        self.assertEqual(resultado.categoria_id, cat_transporte.id)
        self.assertEqual(resultado.metodo, "alias")
        self.assertEqual(resultado.confianca, 1.0)

        # Limpeza
        db.session.delete(alias)
        db.session.commit()

    def test_categorizar_lote_hibrido(self):
        engine = CategorizationEngine(usar_ia=False)
        lote = [
            "UBER *TRIP",
            "POSTO PETROBRAS",
            "SUPERMERCADO BH",
            "NETFLIX.COM",
            "AMAZON.COM.BR",
            "DROGASIL",
            "ESTABELECIMENTO DESCONHECIDO TOTALMENTE 9999"
        ]

        resultados = engine.categorizar_lote(lote)
        self.assertEqual(len(resultados), len(lote))

        # Verificar categorias esperadas para merchants padrão
        self.assertEqual(resultados[0].categoria, "Transporte")
        self.assertEqual(resultados[0].metodo, "regra")

        self.assertEqual(resultados[1].categoria, "Combustível")
        self.assertEqual(resultados[1].metodo, "regra")

        self.assertIn(resultados[2].categoria, ["Supermercado", "Mercado"])
        self.assertEqual(resultados[3].categoria, "Assinaturas")
        self.assertEqual(resultados[4].categoria, "Compras Online")
        self.assertEqual(resultados[5].categoria, "Farmácia")

        # O último não bate em regras e sem IA cai no fallback
        self.assertEqual(resultados[6].metodo, "fallback")
        self.assertEqual(resultados[6].confianca, 0.0)

    def test_mock_ia_quando_necessario(self):
        engine = CategorizationEngine(usar_ia=True, auto_salvar_aliases=False)

        mock_ia_return = [
            {
                "categoria": "Lazer",
                "confianca": 0.88,
                "motivo": "Atividade de entretenimento ou lazer futurista"
            }
        ]

        with patch("services.categorization.engine.classificar_com_ia", return_value=mock_ia_return):
            res = engine.categorizar_uma("EXPERIENCIA SENSORIAL FUTURISTA METAVERSO")
            self.assertEqual(res.categoria, "Lazer")
            self.assertEqual(res.metodo, "ia")
            self.assertEqual(res.confianca, 0.88)
            self.assertIn("entretenimento", res.motivo)

    def test_endpoint_ia_classificar_categoria(self):
        response = self.client.post("/api/ia/classificar_categoria", json={
            "descricoes": [
                "UBER *TRIP",
                "POSTO SHELL",
                "DROGASIL"
            ]
        })

        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertIn("categorias", data)
        self.assertIn("classificacoes", data)
        self.assertEqual(len(data["categorias"]), 3)
        self.assertEqual(len(data["classificacoes"]), 3)

        self.assertEqual(data["categorias"][0], "Transporte")
        self.assertEqual(data["classificacoes"][0]["metodo"], "regra")
        self.assertGreaterEqual(data["classificacoes"][0]["confianca"], 0.90)

    def test_importar_transacoes_atualiza_categoria_e_aprende_alias(self):
        from flask_jwt_extended import create_access_token
        from app.models import Usuario, FormaPagamento

        # Obter ou criar usuário de teste
        user = Usuario.query.first()
        if not user:
            user = Usuario(nome="Test User", email="test_user@financas.local")
            user.set_senha("123456")
            db.session.add(user)
            db.session.commit()

        token = create_access_token(identity=str(user.id))

        fp = FormaPagamento.query.filter_by(cartao_credito=True).first()
        if not fp:
            fp = FormaPagamento(nome="Cartão Teste", tipo="Cartão de Crédito", cartao_credito=True)
            db.session.add(fp)
            db.session.commit()

        cat_outros = Categoria.query.filter_by(nome="Outros", tipo="Despesa").first()
        if not cat_outros:
            cat_outros = Categoria(nome="Outros", tipo="Despesa")
            db.session.add(cat_outros)
            db.session.commit()

        cat_transp = Categoria.query.filter_by(nome="Transporte", tipo="Despesa").first()
        if not cat_transp:
            cat_transp = Categoria(nome="Transporte", tipo="Despesa")
            db.session.add(cat_transp)
            db.session.commit()

        # Limpar resíduos de execuções anteriores
        Transacao.query.filter_by(descricao="MERCHANT REIMPORT TESTE 123").delete()
        CategoriaAlias.query.filter_by(descricao_normalizada="MERCHANT REIMPORT TESTE 123").delete()
        db.session.commit()

        from datetime import date
        # 1. Inserir transação inicial com categoria Outros
        t_inicial = Transacao(
            descricao="MERCHANT REIMPORT TESTE 123",
            valor=45.0,
            data_transacao=date(2026, 10, 5),
            tipo="Despesa",
            categoria_id=cat_outros.id,
            forma_pagamento_id=fp.id,
            parcelado=False
        )
        db.session.add(t_inicial)
        db.session.commit()

        # 2. Re-importar a mesma transação, agora com categoria Transporte
        payload = {
            "forma_pagamento_id": fp.id,
            "transacoes": [
                {
                    "title": "MERCHANT REIMPORT TESTE 123",
                    "amount": 45.0,
                    "date": "2026-10-05",
                    "categoria": cat_transp.nome,
                    "categoria_id": cat_transp.id,
                    "parcelado": False
                }
            ]
        }

        resp = self.client.post(
            "/api/importar_transacoes",
            json=payload,
            headers={"Authorization": f"Bearer {token}"}
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertEqual(data["atualizadas"], 1)

        # 3. Verificar que a transação no banco foi atualizada para Transporte
        t_atualizada = db.session.get(Transacao, t_inicial.id)
        self.assertEqual(t_atualizada.categoria_id, cat_transp.id)

        # 4. Verificar que o alias foi aprendido com prioridade de usuário
        alias = CategoriaAlias.query.filter_by(descricao_normalizada="MERCHANT REIMPORT TESTE 123").first()
        self.assertIsNotNone(alias)
        self.assertEqual(alias.categoria_id, cat_transp.id)
        self.assertEqual(alias.origem, "usuario")

        # Limpeza
        db.session.delete(t_inicial)
        db.session.delete(alias)
        db.session.commit()


if __name__ == "__main__":
    unittest.main()
