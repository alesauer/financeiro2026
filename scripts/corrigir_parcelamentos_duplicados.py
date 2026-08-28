"""
Corrige grupos de parcelamento duplicados criados pela importação.

Causa: o Nubank cobra a 1ª parcela com centavos diferentes das demais
(arredondamento). Como o parcelamento_id incluía o valor, a parcela 1 caiu
num grupo e as parcelas 2+ em outro — e cada grupo gerou projeções futuras
próprias, duplicando as parcelas.

Critério de par fantasma (grupo A = contém parcela 1 / grupo B = começa na 2):
  - mesma descrição e forma de pagamento;
  - mesmo total_parcelas;
  - diferença de valor por parcela <= total_parcelas centavos;
  - A contém parcela 1 e B NÃO contém parcela 1.

Correção:
  - apaga do grupo A as parcelas >= 2 (projeções fantasma);
  - move a parcela 1 do grupo A para o grupo B (parcelamento_id do B).

Uso:  python scripts/corrigir_parcelamentos_duplicados.py [--aplicar]
      (sem --aplicar roda apenas o diagnóstico/dry-run)
"""

import sqlite3
import sys

DB = "/data/financas.db"


def carregar_grupos(cur):
    rows = cur.execute(
        """
        SELECT parcelamento_id, descricao, forma_pagamento_id, total_parcelas,
               MIN(parcela_atual) AS primeira, COUNT(*) AS qtd,
               MIN(valor) AS v_min, MAX(valor) AS v_max
        FROM transacoes
        WHERE parcelado = 1 AND parcelamento_id IS NOT NULL
        GROUP BY parcelamento_id
        """
    ).fetchall()
    return [dict(zip(("pid", "descricao", "forma_id", "total", "primeira", "qtd", "v_min", "v_max"), r)) for r in rows]


def encontrar_pares(grupos):
    pares = []
    usados = set()
    for a in grupos:
        if a["primeira"] != 1 or a["pid"] in usados:
            continue
        for b in grupos:
            if b["pid"] == a["pid"] or b["pid"] in usados:
                continue
            if b["primeira"] < 2:
                continue
            if (b["descricao"], b["forma_id"], b["total"]) != (a["descricao"], a["forma_id"], a["total"]):
                continue
            tolerancia = (a["total"] or 1) / 100.0
            if abs(a["v_min"] - b["v_min"]) > tolerancia:
                continue
            pares.append((a, b))
            usados.add(a["pid"])
            usados.add(b["pid"])
            break
    return pares


def main():
    aplicar = "--aplicar" in sys.argv
    con = sqlite3.connect(DB)
    cur = con.cursor()

    pares = encontrar_pares(carregar_grupos(cur))

    if not pares:
        print("Nenhum par duplicado encontrado.")
        return

    total_removidas = 0
    valor_removido = 0.0

    for a, b in pares:
        fantasmas = cur.execute(
            "SELECT id, parcela_atual, valor, data_transacao, status FROM transacoes "
            "WHERE parcelamento_id = ? AND parcela_atual >= 2 ORDER BY parcela_atual",
            (a["pid"],),
        ).fetchall()

        pagas = [f for f in fantasmas if f[4] == "Pago"]
        soma = sum(f[2] for f in fantasmas)
        total_removidas += len(fantasmas)
        valor_removido += soma

        print(f"\n=== {a['descricao']} ({a['total']}x)")
        print(f"  Grupo A (parcela 1): {a['pid']}  valor {a['v_min']:.2f}")
        print(f"  Grupo B (parcelas 2+): {b['pid']}  valor {b['v_min']:.2f}")
        print(f"  Fantasmas a remover do A: {len(fantasmas)} parcelas = R$ {soma:.2f}")
        if pagas:
            print(f"  ATENCAO: {len(pagas)} fantasma(s) com status Pago: {[(p[0], p[3]) for p in pagas]}")
        for f in fantasmas:
            print(f"    - id={f[0]} parcela {f[1]}/{a['total']} {f[3]} {f[4]} R$ {f[2]:.2f}")

        if aplicar:
            cur.execute(
                "DELETE FROM transacoes WHERE parcelamento_id = ? AND parcela_atual >= 2",
                (a["pid"],),
            )
            cur.execute(
                "UPDATE transacoes SET parcelamento_id = ? WHERE parcelamento_id = ?",
                (b["pid"], a["pid"]),
            )

    print(f"\nTotal: {len(pares)} pares | {total_removidas} parcelas fantasma | R$ {valor_removido:.2f}")

    if aplicar:
        con.commit()
        print("APLICADO com sucesso.")
    else:
        print("DRY-RUN (nada foi alterado). Use --aplicar para executar.")


if __name__ == "__main__":
    main()
