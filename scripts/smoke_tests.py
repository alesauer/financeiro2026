import json
from pathlib import Path
import sys
from datetime import datetime

# Ajustar sys.path para importar o pacote app
proj_root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(proj_root))

from app import create_app, db


def run():
    app = create_app()
    client = app.test_client()

    with app.app_context():
        print('=== Smoke tests iniciando ===')

        # 1) listar categorias (GET público)
        r = client.get('/api/categorias')
        print('GET /api/categorias ->', r.status_code)

        # 2) listar transacoes (GET público)
        r = client.get('/api/transacoes')
        print('GET /api/transacoes ->', r.status_code)

        # 3) criar usuário de teste
        ts = datetime.utcnow().strftime('%Y%m%d%H%M%S')
        test_email = f'test_{ts}@example.com'
        user_payload = {'nome': 'Teste', 'email': test_email, 'senha': 'senha123'}
        r = client.post('/api/usuarios', data=json.dumps(user_payload), content_type='application/json')
        print('POST /api/usuarios ->', r.status_code, r.get_json() if r.data else '')

        # 4) login
        r = client.post('/api/usuarios/login', data=json.dumps({'email': test_email, 'senha': 'senha123'}), content_type='application/json')
        print('POST /api/usuarios/login ->', r.status_code, r.get_json() if r.data else '')
        if r.status_code != 200:
            print('Login falhou, abortando testes protegidos')
            return
        token = r.get_json().get('access_token')
        headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}

        # 5) criar categoria (protegido)
        cat_payload = {'nome': f'Cat Teste {ts}', 'tipo': 'Despesa'}
        r = client.post('/api/categorias', data=json.dumps(cat_payload), headers=headers)
        print('POST /api/categorias ->', r.status_code, r.get_json() if r.data else '')
        categoria = r.get_json() if r.status_code in (200,201) else None

        # 6) listar categorias novamente
        r = client.get('/api/categorias')
        print('GET /api/categorias ->', r.status_code, len(r.get_json() or []))

        # 7) criar transacao (protegido)
        if categoria:
            trans_payload = {
                'tipo': 'Despesa',
                'categoria_id': categoria.get('id'),
                'descricao': 'Compra teste',
                'valor': '12.50',
                'forma_pagamento': 'Dinheiro'
            }
            r = client.post('/api/transacoes', data=json.dumps(trans_payload), headers=headers)
            print('POST /api/transacoes ->', r.status_code, r.get_json() if r.data else '')

        # 8) listar transacoes (paginado)
        r = client.get('/api/transacoes')
        json_resp = r.get_json()
        if isinstance(json_resp, dict) and 'items' in json_resp:
            print('GET /api/transacoes ->', r.status_code, 'items:', len(json_resp.get('items', [])))
        else:
            print('GET /api/transacoes ->', r.status_code, json_resp)

        print('=== Smoke tests finalizados ===')


if __name__ == '__main__':
    run()
