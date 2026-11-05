import unittest
import json
from datetime import date
from app import create_app, db
from app.models import Usuario, Transacao, Categoria, FormaPagamento, IAConversa, IAMensagem, IAAlertaAnomalia
from flask_jwt_extended import create_access_token


class TestIAModulo(unittest.TestCase):
    def setUp(self):
        self.app = create_app()
        self.app.config["TESTING"] = True
        self.client = self.app.test_client()

        with self.app.app_context():
            self.user = Usuario.query.first()
            if not self.user:
                self.user = Usuario(email="teste_ia@financas.local", nome="Tester IA", senha_hash="fake")
                db.session.add(self.user)
                db.session.commit()

            with self.app.test_request_context():
                self.token = create_access_token(identity=str(self.user.id))

    def test_dashboard_ia(self):
        headers = {"Authorization": f"Bearer {self.token}"}
        res = self.client.get("/api/ia/dashboard", headers=headers)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn("kpis", data)
        self.assertIn("gasto_acumulado", data["kpis"])
        self.assertIn("projecao_final", data["kpis"])

    def test_previsao_ia(self):
        headers = {"Authorization": f"Bearer {self.token}"}
        res = self.client.get("/api/ia/previsao?mes=11&ano=2026", headers=headers)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn("projecao_final", data)
        self.assertIn("categorias_projecao", data)
        self.assertIn("projecao_diaria", data)

    def test_anomalias_analise(self):
        headers = {"Authorization": f"Bearer {self.token}"}
        res = self.client.post("/api/ia/anomalias/analisar", headers=headers, json={})
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data.get("status"), "sucesso")

    def test_assistente_fluxo_conversa(self):
        headers = {"Authorization": f"Bearer {self.token}"}

        # 1. Criar conversa
        res_c = self.client.post(
            "/api/ia/conversas",
            headers=headers,
            json={"titulo": "Conversa de Teste Unitario"}
        )
        self.assertEqual(res_c.status_code, 201)
        cid = res_c.get_json()["id"]

        # 2. Enviar pergunta
        res_m = self.client.post(
            f"/api/ia/conversas/{cid}/mensagens",
            headers=headers,
            json={"mensagem": "Quanto gastei neste mês?"}
        )
        self.assertEqual(res_m.status_code, 200)
        data_m = res_m.get_json()
        self.assertEqual(data_m["role"], "assistant")
        self.assertTrue(len(data_m["conteudo"]) > 0)

        # 3. Consultar mensagens da conversa
        res_get = self.client.get(f"/api/ia/conversas/{cid}", headers=headers)
        self.assertEqual(res_get.status_code, 200)
        data_conv = res_get.get_json()
        self.assertGreaterEqual(len(data_conv["mensagens"]), 2)

        # 4. Excluir conversa
        res_del = self.client.delete(f"/api/ia/conversas/{cid}", headers=headers)
        self.assertEqual(res_del.status_code, 200)


if __name__ == "__main__":
    unittest.main()
