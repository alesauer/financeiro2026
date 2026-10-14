import unittest
from app import create_app
from app.routes_relatorios import parcelamentos_futuros

class TestParcelamentosFuturos(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = create_app()
        cls.app.config["TESTING"] = True

    def test_relatorio_parcelamentos_futuros(self):
        with self.app.app_context():
            res, code = parcelamentos_futuros()
            self.assertEqual(code, 200)
            data = res.get_json()
            self.assertIn("grupos", data)
            self.assertIn("mensal", data)
            self.assertIn("total_restante", data)
            self.assertIn("qtd_parcelas", data)
            self.assertIn("qtd_grupos", data)
            
            # Validações básicas de consistência
            self.assertGreaterEqual(data["total_restante"], 0)
            self.assertGreaterEqual(data["qtd_parcelas"], 0)
            self.assertGreaterEqual(data["qtd_grupos"], 0)
            
            for g in data["grupos"]:
                self.assertIn("descricao", g)
                self.assertIn("forma_pagamento", g)
                self.assertIn("parcela_atual", g)
                self.assertIn("total_parcelas", g)
                self.assertIn("parcelas_restantes", g)
                self.assertIn("valor_parcela", g)
                self.assertIn("valor_restante", g)
                self.assertIn("proxima_data", g)
                self.assertIn("ultima_data", g)
                self.assertGreater(g["parcelas_restantes"], 0)
                self.assertGreater(g["valor_restante"], 0)
                if g["total_parcelas"] and g["parcela_atual"]:
                    self.assertLessEqual(g["parcela_atual"], g["total_parcelas"])

            # Soma mensal deve bater com total_restante (com tolerância de arredondamento)
            soma_mensal = sum(m["total"] for m in data["mensal"])
            self.assertAlmostEqual(soma_mensal, data["total_restante"], places=1)

            # Valida detalhamento de cada mês
            for m in data["mensal"]:
                self.assertIn("itens", m)
                self.assertEqual(len(m["itens"]), m["qtd"])
                soma_itens = sum(item["valor"] for item in m["itens"])
                self.assertAlmostEqual(soma_itens, m["total"], places=1)
                for item in m["itens"]:
                    self.assertIn("descricao", item)
                    self.assertIn("forma_pagamento", item)
                    self.assertIn("numero_parcela", item)
                    self.assertIn("total_parcelas", item)
                    self.assertIn("valor", item)
                    self.assertIn("data_vencimento", item)

if __name__ == "__main__":
    unittest.main()
