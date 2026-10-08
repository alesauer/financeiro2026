import sys, os
sys.path.insert(0, os.path.abspath('.'))
import calendar
from app import create_app
from app.routes_transacoes import resumo_mes, listar_cartao_credito

app = create_app()
with app.app_context():
    for m in range(1, 11):
        last_day = calendar.monthrange(2026, m)[1]
        with app.test_request_context(f'/api/transacoes/summary?inicio=2026-{m:02d}-01&fim=2026-{m:02d}-{last_day:02d}'):
            res_sum = resumo_mes.__wrapped__()[0].get_json()
        with app.test_request_context(f'/api/transacoes/cartao_credito?inicio=2026-{m:02d}-01&fim=2026-{m:02d}-{last_day:02d}'):
            res_cartao = listar_cartao_credito.__wrapped__()[0].get_json()
            
        faturas = res_cartao.get('faturas', [])
        faturas_total = sum(f['total'] for f in faturas)
        faturas_nomes = [(f['cartao_nome'], f['total'], f['competencia'], f['data_vencimento']) for f in faturas]
        
        print(f"Mês {m:02d}:")
        print(f"  [Summary] Receitas: {res_sum['receitas']:9.2f} | Despesas Conta: {res_sum['despesas_conta']:9.2f} | Cartão: {res_sum['cartao_credito_total']:9.2f} | Total Desp: {res_sum['despesas']:9.2f} | Saldo: {res_sum['saldo']:9.2f}")
        print(f"  [Faturas] Total Faturas: {faturas_total:9.2f} -> {faturas_nomes}")
        print(f"  [Diferença Cartão Summary vs Faturas]: {res_sum['cartao_credito_total'] - faturas_total:9.2f}")
        print(f"  [Soma Despesas Conta + Faturas]: {res_sum['despesas_conta'] + faturas_total:9.2f}")
        print("-" * 80)
