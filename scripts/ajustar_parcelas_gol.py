"""
Script de diagnóstico e ajuste da compra de passagens na Gol Linhas Aéreas.

Diagnóstico:
A compra total foi de R$ 4.292,16 em 12x.
A companhia aérea (GOL) cobrou as taxas de embarque de R$ 863,16 à vista na 1ª parcela,
e parcelou a tarifa aérea de R$ 3.429,00 em 12x de R$ 285,75.
Assim, no extrato bancário (Open Finance / Nubank):
- 1ª parcela: R$ 863,16 (taxa) + R$ 285,75 = R$ 1.148,91.
- Parcelas 2 a 12: R$ 285,75 cada.
Soma: 1.148,91 + (11 * 285,75) = 4.292,16.

Este script lineariza as parcelas para R$ 357,68 cada e adiciona a tag
'[ajuste_manual]' para impedir que futuras sincronizações do Open Finance
sobrescrevam o valor de volta para o extrato não-linear do banco.

Uso:
  python scripts/ajustar_parcelas_gol.py               (apenas diagnóstico / simulação)
  python scripts/ajustar_parcelas_gol.py --aplicar     (aplica ajuste nas parcelas existentes)
  python scripts/ajustar_parcelas_gol.py --aplicar --gerar-todas (ajusta e projeta todas as 12 parcelas)
"""

import sys
import sqlite3
import os
from datetime import datetime, date
from dateutil.relativedelta import relativedelta

DB_PATHS = [
    "/data/financas.db",
    "data/financas.db",
    "backups/financas_seed.db",
]

def find_db():
    env_db = os.environ.get("DATABASE_URL", "")
    if "sqlite:///" in env_db:
        p = env_db.replace("sqlite:////", "/").replace("sqlite:///", "")
        if os.path.exists(p):
            return p
    for p in DB_PATHS:
        if os.path.exists(p):
            return p
    return None

def main():
    aplicar = "--aplicar" in sys.argv
    gerar_todas = "--gerar-todas" in sys.argv
    db_path = find_db()
    if not db_path:
        print("Banco de dados SQLite não encontrado.")
        sys.exit(1)

    print(f"Conectado ao banco: {db_path}")
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    cur.execute("""
        SELECT id, tipo, categoria_id, descricao, valor, data_transacao, forma_pagamento_id,
               status, recorrente, recorrencia_tipo, parcelado, total_parcelas, parcela_atual,
               valor_parcela, parcelamento_id, observacoes, competencia_fatura, identificador_externo
        FROM transacoes
        WHERE descricao LIKE '%Gol Linhas%Atmtzo014%' OR descricao LIKE '%Gol Linhas%'
        ORDER BY parcela_atual ASC
    """)
    rows = cur.fetchall()

    if not rows:
        print("Nenhuma transação da Gol Linhas encontrada.")
        return

    print(f"\nEncontradas {len(rows)} parcelas da Gol Linhas no banco de dados:")
    total_atual = 0.0
    for r in rows:
        tid = r[0]
        desc = r[3]
        val = float(r[4] or 0)
        dt = r[5]
        parc_atual = r[12]
        total_p = r[11]
        comp = r[16]
        total_atual += val
        print(f"  ID {tid} | Parcela {parc_atual}/{total_p} | Data {dt} | Competência {comp} | Valor atual: R$ {val:,.2f}")

    print(f"\nSoma atual das parcelas encontradas: R$ {total_atual:,.2f}")
    print("Meta: 12 parcelas de R$ 357,68 (Total R$ 4.292,16)\n")

    if not aplicar:
        print(">> Modo de simulação (DRY-RUN). Para efetivar a alteração, execute:")
        print("   python scripts/ajustar_parcelas_gol.py --aplicar")
        print("   (ou adicione --gerar-todas para criar as parcelas 5 a 12 antecipadamente)\n")
        return

    # 1. Atualizar existentes para 357.68 com tag [ajuste_manual]
    for r in rows:
        tid = r[0]
        parc_atual = r[12]
        total_p = r[11]
        val = r[4]
        obs = r[15]
        novo_valor = 357.68
        obs_limpa = (obs or "").replace("[ajuste_manual]", "").strip()
        nova_obs = f"{obs_limpa} [ajuste_manual] Linearizado 12x de R$ 357,68 (Total R$ 4.292,16)".strip()
        cur.execute("""
            UPDATE transacoes
            SET valor = ?, valor_parcela = ?, observacoes = ?
            WHERE id = ?
        """, (novo_valor, novo_valor, nova_obs, tid))
        print(f"  [ATUALIZADO] ID {tid} (Parcela {parc_atual}/{total_p}): R$ {val} -> R$ {novo_valor}")

    # 2. Se solicitado, gerar parcelas faltantes até 12
    if gerar_todas and len(rows) < 12:
        parcelas_existentes = {r[12] for r in rows}
        base_tx = rows[0]
        base_data = datetime.strptime(base_tx[5], "%Y-%m-%d").date()
        base_comp = datetime.strptime(base_tx[16], "%Y-%m-%d").date() if base_tx[16] else base_data

        for p in range(1, 13):
            if p in parcelas_existentes:
                continue
            nova_dt = base_data + relativedelta(months=p-1)
            nova_comp = base_comp + relativedelta(months=p-1)
            desc_p = f"Gol Linhas A*Atmtzo014 {p}/12"
            obs_p = f"Sincronizado via Open Finance (MeuPluggy) [ajuste_manual] Linearizado 12x de R$ 357,68 (Total R$ 4.292,16)"
            cur.execute("""
                INSERT INTO transacoes (
                    tipo, categoria_id, descricao, valor, data_transacao, forma_pagamento_id,
                    status, recorrente, recorrencia_tipo, parcelado, total_parcelas, parcela_atual,
                    valor_parcela, parcelamento_id, observacoes, competencia_fatura
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                base_tx[1], base_tx[2], desc_p, 357.68, str(nova_dt), base_tx[6],
                'Pendente', 1, 'Parcelamento', 1, 12, p,
                357.68, base_tx[14], obs_p, str(nova_comp)
            ))
            print(f"  [CRIADA] Parcela {p}/12 | Data {nova_dt} | Competência {nova_comp} | R$ 357.68")

    conn.commit()
    conn.close()
    print("\nOperação concluída com sucesso no banco de dados!")

if __name__ == "__main__":
    main()
