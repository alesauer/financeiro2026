import csv
import re
import unicodedata
from pathlib import Path
import sys

proj_root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(proj_root))

from app import create_app, db
from app.models import Transacao, Categoria, FormaPagamento

CSV_PATH = Path(r"c:/Users/m23621/Downloads/Nubank_2026-02-03COMPLETA.csv")
FORMA_PAGAMENTO_ID = 6  # Cartão Crédito Nubank


def remover_acentos(texto: str) -> str:
    if not texto:
        return ""
    return ''.join(c for c in unicodedata.normalize('NFD', texto) if unicodedata.category(c) != 'Mn')


def normalizar_descricao(texto: str) -> str:
    texto = remover_acentos(texto or '').lower()
    texto = re.sub(r'[^a-z0-9]+', '-', texto)
    return texto.strip('-') or 'descricao'


def gerar_parcelamento_id(descricao: str, total_parcelas: int, valor_parcela: float) -> str:
    slug = normalizar_descricao(descricao)
    total = total_parcelas or 1
    valor_total = round(abs(valor_parcela or 0) * total * 100)
    return f"{slug}-{total}x-{valor_total}"


def detectar_parcelamento(descricao: str, valor: float):
    padrao_valor = float(valor or 0)
    base = {
        'parcelado': False,
        'parcela_atual': 1,
        'total_parcelas': 1,
        'valor_parcela': padrao_valor,
        'parcelamento_id': None,
        'descricao_limpa': (descricao or '').strip()
    }
    if not descricao:
        return base
    padroes = [
        re.compile(r"parcela\s*\(\s*(\d{1,2})\s*\/\s*(\d{1,2})\s*\)", re.IGNORECASE),
        re.compile(r"parc\.?\s*(\d{1,2})\s*\/\s*(\d{1,2})", re.IGNORECASE),
        re.compile(r"(?:-|\s)parcela\s*(\d{1,2})\s*\/\s*(\d{1,2})", re.IGNORECASE),
        re.compile(r"(\d{1,2})\s*\/\s*(\d{1,2})\s*parc(?:elas)?", re.IGNORECASE),
    ]
    for regex in padroes:
        match = regex.search(descricao)
        if match:
            parcela_atual = int(match.group(1) or 1)
            total_parcelas = int(match.group(2) or parcela_atual or 1)
            descricao_limpa = regex.sub('', descricao).replace('  ', ' ').strip()
            return {
                'parcelado': total_parcelas > 1,
                'parcela_atual': parcela_atual,
                'total_parcelas': total_parcelas,
                'valor_parcela': padrao_valor,
                'parcelamento_id': gerar_parcelamento_id(descricao_limpa or descricao, total_parcelas, padrao_valor),
                'descricao_limpa': descricao_limpa or descricao.strip()
            }
    return base


def carregar_missing_transacoes(sessao):
    existentes = {
        (tx.descricao, tx.data_transacao.isoformat())
        for tx in sessao.query(Transacao.descricao, Transacao.data_transacao)
        .filter(Transacao.forma_pagamento_id == FORMA_PAGAMENTO_ID)
        .all()
    }
    dados = []
    with CSV_PATH.open() as f:
        reader = csv.DictReader(f)
        for row in reader:
            chave = (row['title'], row['date'])
            if chave in existentes:
                continue
            dados.append(row)
    return dados


def main():
    app = create_app()
    with app.app_context():
        forma = FormaPagamento.query.get(FORMA_PAGAMENTO_ID)
        if not forma:
            raise RuntimeError('Forma de pagamento alvo não encontrada.')
        categoria_padrao = Categoria.query.filter_by(nome='Outros', tipo='Despesa').first()
        if not categoria_padrao:
            categoria_padrao = Categoria.query.filter_by(tipo='Despesa').first()
        if not categoria_padrao:
            raise RuntimeError('Nenhuma categoria disponível para fallback.')

        pendentes = carregar_missing_transacoes(db.session)
        if not pendentes:
            print('Nenhuma transação em falta identificada.')
            return
        registros = []
        for row in pendentes:
            valor = float(row['amount'])
            info = detectar_parcelamento(row['title'], valor)
            registros.append({
                'date': row['date'],
                'title': row['title'],
                'amount': valor,
                'categoria': categoria_padrao.nome,
                'categoria_id': categoria_padrao.id,
                'parcelado': info['parcelado'],
                'parcela_atual': info['parcela_atual'],
                'total_parcelas': info['total_parcelas'],
                'valor_parcela': info['valor_parcela'],
                'parcelamento_id': info['parcelamento_id'],
                'descricao_limpa': info['descricao_limpa'],
            })
        print(f'Importando {len(registros)} transações faltantes...')
        client = app.test_client()
        resp = client.post('/api/importar_transacoes', json={
            'forma_pagamento_id': FORMA_PAGAMENTO_ID,
            'transacoes': registros
        })
        print('Status:', resp.status_code)
        try:
            print(resp.get_json())
        except Exception:
            print(resp.data)


if __name__ == '__main__':
    main()
