import openpyxl
import os
import json
import re

caminho = os.path.join("uploads", "Contas 2026 (1).xlsx")
wb = openpyxl.load_workbook(caminho, data_only=True)

meses_map = {
    'Jan26': 1, 'Fev26': 2, 'Mar26': 3, 'Abr26': 4, 'Mai26': 5,
    'Jun26': 6, 'Jul26': 7, 'Ago26': 8, 'Set26': 9, 'Out26': 10
}

summary = []

for sheet_name in wb.sheetnames:
    ws = wb[sheet_name]
    mes = meses_map.get(sheet_name)
    rec_list, desp_list, cart_list = [], [], []
    current_sec = None
    totais = {}
    
    for r in range(1, ws.max_row + 1):
        c1, c2, c3, c4, c5, c6, c7 = [ws.cell(r, i).value for i in range(1, 8)]
        
        if c2 in ('Receitas:', 'Despesas:', 'Saldo:'):
            totais[str(c2).rstrip(':')] = c5
            continue
            
        if c1 and isinstance(c1, str):
            c1_s = c1.strip()
            if 'Receita' in c1_s:
                current_sec = 'Receitas'
                continue
            elif 'Despesa' in c1_s:
                current_sec = 'Despesas'
                continue
            elif 'Cart' in c1_s:
                current_sec = 'Cartoes'
                if c3 or c5:
                    cart_list.append({
                        'dia': int(c2) if c2 and str(c2).isdigit() else None,
                        'desc': str(c3).strip() if c3 else '',
                        'cat': str(c4 or '').strip(),
                        'val': float(str(c5).replace(',', '.')) if c5 else 0.0,
                        'obs': c6,
                        'pago': str(c7 or '').strip().lower() in ('ok', 'pago', 'sim')
                    })
                continue
                
        if str(c3).strip() in ('Descrição', 'Descrio', 'None', '') or c5 is None:
            continue
            
        try:
            val = float(str(c5).replace(',', '.'))
        except:
            val = 0.0
            
        dia = int(c2) if c2 and str(c2).isdigit() else None
        pago = str(c7 or '').strip().lower() in ('ok', 'pago', 'sim')
        
        item = {
            'dia': dia,
            'desc': str(c3).strip(),
            'cat': str(c4 or '').strip(),
            'val': val,
            'obs': c6,
            'pago': pago
        }
        
        if current_sec == 'Receitas':
            rec_list.append(item)
        elif current_sec == 'Despesas':
            desp_list.append(item)
        elif current_sec == 'Cartoes':
            cart_list.append(item)
            
    soma_rec = sum(x['val'] for x in rec_list)
    soma_desp = sum(x['val'] for x in desp_list)
    soma_cart = sum(x['val'] for x in cart_list)
    
    summary.append({
        'sheet': sheet_name,
        'mes': mes,
        'totais_planilha': totais,
        'rec_count': len(rec_list),
        'rec_total': soma_rec,
        'desp_count': len(desp_list),
        'desp_total': soma_desp,
        'cart_count': len(cart_list),
        'cart_total': soma_cart,
        'rec_items': rec_list,
        'desp_items': desp_list,
        'cart_items': cart_list
    })

print(f"Total de abas analisadas: {len(summary)}\n")
for s in summary:
    print(f"[{s['sheet']}] Mês {s['mes']:02d}/2026:")
    print(f"  Totais declarados: {s['totais_planilha']}")
    print(f"  Receitas       ({s['rec_count']} itens): R$ {s['rec_total']:>10,.2f}")
    print(f"  Despesas Fixas ({s['desp_count']} itens): R$ {s['desp_total']:>10,.2f}")
    print(f"  Cartões        ({s['cart_count']} itens): R$ {s['cart_total']:>10,.2f}")
    print(f"  Soma Desp+Cart: R$ {(s['desp_total'] + s['cart_total']):>10,.2f} | Saldo Previsto: R$ {(s['rec_total'] - s['desp_total'] - s['cart_total']):>10,.2f}")
    print()

# Analisar categorias encontradas na planilha e verificar se existem no banco
cats_encontradas = set()
for s in summary:
    for r in s['rec_items'] + s['desp_items'] + s['cart_items']:
        if r['cat']:
            cats_encontradas.add((r['cat'], 'Receita' if r in s['rec_items'] else 'Despesa'))

print(f"Categorias encontradas na planilha: {sorted(cats_encontradas)}")
