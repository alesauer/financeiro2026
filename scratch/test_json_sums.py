import json

json_path = r'C:/Users/m23621/.gemini/antigravity-ide/brain/01a39075-47d2-47f5-b180-b151bb855772/.user_uploaded/media_1791463101163.json'
with open(json_path, 'r', encoding='utf-8') as f:
    data = json.load(f)

print(f"Total lancamentos: {len(data['lancamentos'])}")
for m_info in data['meses']:
    m_str = m_info['mes']
    expected = m_info['totais']
    aba = m_info['nome_aba']
    items = [l for l in data['lancamentos'] if l['id'] in m_info['lancamentos']]
    rec = sum(float(l['valor']) for l in items if l['tipo'] == 'receita')
    desp = sum(float(l['valor']) for l in items if l['tipo'] == 'despesa')
    exp_r = expected['receitas']
    exp_d = expected['despesas']
    exp_s = expected['saldo']
    print(f"Mes {m_str} ({aba:5s}): Rec calc={rec:9.2f} exp={exp_r:9.2f} (diff={rec-exp_r:5.2f}) | Desp calc={desp:9.2f} exp={exp_d:9.2f} (diff={desp-exp_d:5.2f}) | Saldo calc={rec-desp:9.2f} exp={exp_s:9.2f}")
