import urllib.request
import json

req = urllib.request.Request(
    'http://localhost:5001/api/usuarios/login',
    data=json.dumps({'email': 'alesauer@gmail.com', 'senha': 'teste10'}).encode(),
    headers={'Content-Type': 'application/json'}
)
token = json.loads(urllib.request.urlopen(req).read().decode())['access_token']

req2 = urllib.request.Request(
    'http://localhost:5001/api/investimentos/dashboard',
    headers={'Authorization': 'Bearer ' + token}
)
res = json.loads(urllib.request.urlopen(req2).read().decode())

print("="*60)
print("RESUMO CONSOLIDADO DE INVESTIMENTOS")
print("="*60)
print(f"Patrimônio Total:         R$ {res.get('patrimonio_total', 0):>12,.2f}")
print(f"Valor Total Investido:    R$ {res.get('valor_investido', 0):>12,.2f}")
print(f"Rendimento / Lucro Total: R$ {res.get('lucro_prejuizo', 0):>12,.2f}")
print(f"Rentabilidade Percentual:    {res.get('rentabilidade_percentual', 0):>11.2f}%")
print(f"  - Renda Fixa:           R$ {res.get('patrimonio_renda_fixa', 0):>12,.2f}")
print(f"  - Fundos / Outros:      R$ {res.get('patrimonio_renda_variavel', 0):>12,.2f}")

print("\nAlocação por Tipo:")
for item in res.get('alocacao_por_tipo', []):
    print(f"  {item['tipo']:<20}: R$ {item['valor']:>10,.2f} ({item['percentual']:.1f}%)")

print("\nAtivos em Carteira:")
for a in res.get('ativos', []):
    print(f"  {a['codigo']:<15} | {a['nome'][:34]:<34} | Atual: R$ {a['valor_atual']:>10,.2f} | P/L: R$ {a['p_l']:>8,.2f}")
