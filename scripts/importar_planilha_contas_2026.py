"""Importação da planilha Contas 2026 (1).xlsx para o sistema financeiro.

Etapa 1: Lê o Excel localmente usando openpyxl e gera o JSON estruturado em uploads/dados_importacao.json.
Etapa 2: Executa script no container financas-backend para importar os dados no SQLite com garantia de idempotência.
"""

import os
import re
import json
import unicodedata
from datetime import date
import openpyxl

def normalizar_texto(texto):
    if not texto:
        return ""
    s = unicodedata.normalize("NFD", str(texto))
    return "".join(c for c in s if unicodedata.category(c) != "Mn").lower().strip()

def slugify(texto):
    norm = normalizar_texto(texto)
    return re.sub(r"[^a-z0-9]+", "-", norm).strip("-")

MESES_MAP = {
    'Jan26': 1, 'Fev26': 2, 'Mar26': 3, 'Abr26': 4, 'Mai26': 5,
    'Jun26': 6, 'Jul26': 7, 'Ago26': 8, 'Set26': 9, 'Out26': 10
}

DEBITO_AUTOMATICO_KEYWORDS = [
    "cemig", "blink", "origo", "iptu", "condominio", "vivo kiki", "mei kiki"
]

def mapear_categoria_e_tipo(descricao, cat_planilha, secao):
    desc_norm = normalizar_texto(descricao)
    cat_norm = normalizar_texto(cat_planilha)
    
    if secao == "Receitas":
        if "aluguel" in desc_norm:
            return "Aluguel", "Receita"
        return "Salário", "Receita"
        
    # Se for Investimento
    if "investimento" in desc_norm or cat_norm == "investimento":
        return "Reserva de Emergência", "Investimento"
        
    # Despesas
    if any(k in desc_norm for k in ["formatura", "batista", "integrar"]) or cat_norm == "educacao":
        return "Educação", "Despesa"
    if "seguro" in desc_norm or cat_norm == "carro":
        return "Carro", "Despesa"
    if "vivo" in desc_norm or cat_norm == "celular":
        return "Celular", "Despesa"
    if any(k in desc_norm for k in ["mei", "iprf"]) or cat_norm == "imposto":
        return "Imposto", "Despesa"
    if any(k in desc_norm for k in ["faxineira", "condominio", "iptu"]) or cat_norm == "moradia":
        return "Moradia", "Despesa"
    if any(k in desc_norm for k in ["cemig", "origo"]) or cat_norm == "energia":
        return "Energia", "Despesa"
    if "blink" in desc_norm or cat_norm == "internet":
        return "Internet", "Despesa"
    if "natacao" in desc_norm or cat_norm == "recreativo":
        return "Recreativo", "Despesa"
    if "psicologa" in desc_norm or cat_norm == "filho":
        return "Filho", "Despesa"
    if "mae" in desc_norm or cat_norm == "repasse":
        return "Repasse", "Despesa"
    if "iate" in desc_norm or cat_norm == "lazer":
        return "Lazer", "Despesa"
    if "kiki" in desc_norm or cat_norm == "temp":
        return "Temp", "Despesa"
        
    return "Diversos", "Despesa"

def mapear_forma_pagamento(descricao, secao, is_c6=False):
    if is_c6:
        return "C6 Bank"
    if secao == "Receitas":
        return "Transferência"
    desc_norm = normalizar_texto(descricao)
    if any(k in desc_norm for k in DEBITO_AUTOMATICO_KEYWORDS):
        return "Débito Automático"
    return "Pix"

def processar_planilha():
    caminho_xlsx = os.path.join("uploads", "Contas 2026 (1).xlsx")
    wb = openpyxl.load_workbook(caminho_xlsx, data_only=True)
    
    transacoes_para_importar = []
    totais_por_mes = {}
    
    for sheet_name in wb.sheetnames:
        if sheet_name not in MESES_MAP:
            continue
            
        ws = wb[sheet_name]
        mes = MESES_MAP[sheet_name]
        ano = 2026
        current_sec = None
        totais_por_mes[sheet_name] = {"receitas": 0.0, "despesas": 0.0, "cartoes": 0.0, "c6": 0.0}
        
        for r in range(1, ws.max_row + 1):
            c1, c2, c3, c4, c5, c6, c7 = [ws.cell(r, i).value for i in range(1, 8)]
            
            # Cabeçalho de seções
            if c1 and isinstance(c1, str):
                c1_clean = c1.strip()
                if "Receita" in c1_clean:
                    current_sec = "Receitas"
                    continue
                elif "Despesa" in c1_clean:
                    current_sec = "Despesas"
                    continue
                elif "Cart" in c1_clean:
                    current_sec = "Cartoes"
                    if not (c3 or c5):
                        continue
                        
            desc = str(c3).strip() if c3 else ""
            if not desc or desc in ("Descrição", "Descrio", "None"):
                continue
            if c5 is None:
                continue
                
            try:
                val = float(str(c5).replace(",", "."))
            except (ValueError, TypeError):
                continue
                
            if abs(val) < 0.005:
                # Linha zerada
                continue
                
            pago = str(c7 or "").strip().lower() in ("ok", "pago", "sim")
            obs = str(c6).strip() if c6 else None
            cat_planilha = str(c4 or "").strip()
            
            # Tratamento de seções
            if current_sec == "Cartoes":
                desc_norm = normalizar_texto(desc)
                if "nubank" in desc_norm:
                    # Ignorar o consolidado do Nubank pois as compras individuais já existem no banco
                    totais_por_mes[sheet_name]["cartoes"] += val
                    continue
                elif "c6" in desc_norm:
                    totais_por_mes[sheet_name]["c6"] += val
                    dia = int(c2) if c2 and str(c2).strip().isdigit() else 20
                    data_str = f"{ano}-{mes:02d}-{dia:02d}"
                    identificador = f"planilha-2026-{mes:02d}-c6-fatura-{round(val, 2)}"
                    
                    transacoes_para_importar.append({
                        "sheet": sheet_name,
                        "mes": mes,
                        "ano": ano,
                        "descricao": f"Fatura C6 Bank ({sheet_name})",
                        "valor": round(val, 2),
                        "tipo": "Despesa",
                        "categoria_nome": "Diversos",
                        "forma_pagamento_nome": "C6 Bank",
                        "data_transacao": data_str,
                        "status": "Pago" if pago else "Pendente",
                        "observacoes": obs or f"Fatura C6 consolidada da planilha {sheet_name}",
                        "competencia_fatura": f"{ano}-{mes:02d}-01",
                        "identificador_externo": identificador
                    })
                    continue
                else:
                    # Outro cartão?
                    continue
                    
            # Receitas e Despesas Fixas
            dia = 1
            if c2 and str(c2).strip().isdigit():
                dia = int(str(c2).strip())
                dia = min(max(dia, 1), 28 if mes == 2 else 30)
            data_str = f"{ano}-{mes:02d}-{dia:02d}"
            
            cat_nome, tipo = mapear_categoria_e_tipo(desc, cat_planilha, current_sec)
            fp_nome = mapear_forma_pagamento(desc, current_sec)
            slug = slugify(desc)
            identificador = f"planilha-2026-{mes:02d}-{slug}-{dia:02d}-{round(val, 2)}"
            
            if current_sec == "Receitas":
                totais_por_mes[sheet_name]["receitas"] += val
            else:
                totais_por_mes[sheet_name]["despesas"] += val
                
            transacoes_para_importar.append({
                "sheet": sheet_name,
                "mes": mes,
                "ano": ano,
                "descricao": desc,
                "valor": round(val, 2),
                "tipo": tipo,
                "categoria_nome": cat_nome,
                "forma_pagamento_nome": fp_nome,
                "data_transacao": data_str,
                "status": "Pago" if pago else "Pendente",
                "observacoes": obs,
                "competencia_fatura": None,
                "identificador_externo": identificador
            })
            
    caminho_saida = os.path.join("uploads", "dados_importacao.json")
    with open(caminho_saida, "w", encoding="utf-8") as f:
        json.dump({
            "totais_por_mes": totais_por_mes,
            "total_transacoes": len(transacoes_para_importar),
            "transacoes": transacoes_para_importar
        }, f, indent=2, ensure_ascii=False)
        
    print(f"Total de transações preparadas para importação: {len(transacoes_para_importar)}")
    print(f"Arquivo gerado em: {caminho_saida}")
    
    # Resumo rápido
    recs = [t for t in transacoes_para_importar if t["tipo"] == "Receita"]
    desps = [t for t in transacoes_para_importar if t["tipo"] == "Despesa"]
    invs = [t for t in transacoes_para_importar if t["tipo"] == "Investimento"]
    print(f"  - Receitas:     {len(recs):>3} itens | Soma: R$ {sum(t['valor'] for t in recs):>12,.2f}")
    print(f"  - Despesas:     {len(desps):>3} itens | Soma: R$ {sum(t['valor'] for t in desps):>12,.2f}")
    print(f"  - Investimento: {len(invs):>3} itens | Soma: R$ {sum(t['valor'] for t in invs):>12,.2f}")

if __name__ == "__main__":
    processar_planilha()
