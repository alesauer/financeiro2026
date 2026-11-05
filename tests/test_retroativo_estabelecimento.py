import unittest
from datetime import date
from app import create_app, db
from app.models import Transacao, Categoria, FormaPagamento, Usuario
from flask_jwt_extended import create_access_token


class TestRetroativoEstabelecimento(unittest.TestCase):
    def setUp(self):
        self.app = create_app()
        self.app.config["TESTING"] = True
        self.app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
        self.client = self.app.test_client()

        with self.app.app_context():
            db.create_all()

            self.user = Usuario(email="teste@financas.local", nome="Tester", senha_hash="hash_fake")
            db.session.add(self.user)

            self.cat_alimentacao = Categoria(nome="Alimentação", tipo="Despesa")
            self.cat_lazer = Categoria(nome="Lazer", tipo="Despesa")
            self.forma = FormaPagamento(nome="Cartão Teste", tipo="Crédito", cartao_credito=True)
            db.session.add_all([self.cat_alimentacao, self.cat_lazer, self.forma])
            db.session.commit()

            self.cat_ali_id = self.cat_alimentacao.id
            self.cat_lazer_id = self.cat_lazer.id
            self.forma_id = self.forma.id

            with self.app.test_request_context():
                self.token = create_access_token(identity=str(self.user.id))

    def tearDown(self):
        with self.app.app_context():
            db.session.remove()
            db.drop_all()

    def test_verificar_e_atualizar_retroativo_estabelecimento(self):
        with self.app.app_context():
            # Cria 3 transações de meses anteriores com descrição semelhante / parcelas
            t1 = Transacao(
                descricao="Estabelecimento Teste Retroativo 1/3",
                valor=50.0,
                tipo="Despesa",
                categoria_id=self.cat_lazer_id,
                forma_pagamento_id=self.forma_id,
                data_transacao=date(2026, 1, 10),
                status="Pago"
            )
            t2 = Transacao(
                descricao="Estabelecimento Teste Retroativo 2/3",
                valor=50.0,
                tipo="Despesa",
                categoria_id=self.cat_lazer_id,
                forma_pagamento_id=self.forma_id,
                data_transacao=date(2026, 2, 10),
                status="Pago"
            )
            # Transação do mês atual (3/3)
            t3 = Transacao(
                descricao="Estabelecimento Teste Retroativo 3/3",
                valor=50.0,
                tipo="Despesa",
                categoria_id=self.cat_lazer_id,
                forma_pagamento_id=self.forma_id,
                data_transacao=date(2026, 3, 10),
                status="Pago"
            )
            db.session.add_all([t1, t2, t3])
            db.session.commit()
            t1_id, t2_id, t3_id = t1.id, t2.id, t3.id

        headers = {"Authorization": f"Bearer {self.token}"}

        # 1. Verifica se a rota /anteriores_estabelecimento detecta as 2 anteriores
        res_verif = self.client.get(
            f"/api/transacoes/{t3_id}/anteriores_estabelecimento?nova_categoria_id={self.cat_ali_id}",
            headers=headers
        )
        self.assertEqual(res_verif.status_code, 200)
        data_verif = res_verif.get_json()
        self.assertEqual(data_verif["quantidade"], 2)

        # 2. Atualiza t3 alterando para Categoria Alimentação com alterar_meses_anteriores=True
        res_put = self.client.put(
            f"/api/transacoes/{t3_id}",
            headers=headers,
            json={
                "categoria_id": self.cat_ali_id,
                "alterar_meses_anteriores": True
            }
        )
        self.assertEqual(res_put.status_code, 200)
        data_put = res_put.get_json()
        self.assertEqual(data_put["anteriores_atualizadas"], 2)

        # 3. Verifica no banco se t1 e t2 foram atualizadas para Alimentação
        with self.app.app_context():
            t1_rec = db.session.get(Transacao, t1_id)
            t2_rec = db.session.get(Transacao, t2_id)
            t3_rec = db.session.get(Transacao, t3_id)
            self.assertEqual(t1_rec.categoria_id, self.cat_ali_id)
            self.assertEqual(t2_rec.categoria_id, self.cat_ali_id)
            self.assertEqual(t3_rec.categoria_id, self.cat_ali_id)


if __name__ == "__main__":
    unittest.main()
