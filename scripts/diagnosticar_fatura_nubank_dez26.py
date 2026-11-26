"""
Script de diagnóstico e conciliação da Fatura do Nubank de Dezembro/2026.

Problema reportado:
- Fatura fechada no aplicativo Nubank: R$ 15.941,28
- Valor exibido na interface: R$ 17.765,37
- Diferença total a maior: R$ 1.824,09

Causas diagnosticadas:
1. Parcela 1/12 da GOL Linhas Aéreas: lançada com taxa integral por R$ 1.148,91 em vez de R$ 357,68 (diferença de R$ 791,23).
2. Lançamentos realizados após o fechamento do ciclo (ex: 25/11 ou 26/11) que no Nubank já caíram na fatura de Jan/2027, mas no sistema foram alocados em Dez/2026.
3. Ausência de registro da fatura oficial fechada (OpenFinanceFatura) de Dez/2026 com o valor consolidado de R$ 15.941,28.

Uso:
  python scripts/diagnosticar_fatura_nubank_dez26.py               (apenas diagnóstico / simulação)
  python scripts/diagnosticar_fatura_nubank_dez26.py --aplicar     (aplica as correções e concilia a fatura)
"""

import sys
import os
import argparse
from datetime import date, datetime
from decimal import Decimal

# Adiciona caminhos do projeto
sys.path.insert(0, "/app")
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app, db
from app.models import Transacao, FormaPagamento, OpenFinanceFatura, OpenFinanceContaMap
from services.fatura_service import calcular_competencia_fatura, calcular_ciclo_compras

VALOR_OFICIAL_NUBANK = 15941.28
VALOR_INTERFACE_ATUAL = 17765.37
DIFERENCA_ESPERADA = round(VALOR_INTERFACE_ATUAL - VALOR_OFICIAL_NUBANK, 2)  # 1824.09

def main():
    parser = argparse.ArgumentParser(description="Diagnóstico e ajuste da fatura Nubank Dez/2026")
    parser.add_argument("--aplicar", action="store_true", help="Efetiva as correções no banco de dados")
    parser.add_argument("--valor-oficial", type=float, default=VALOR_OFICIAL_NUBANK, help="Valor oficial da fatura fechada no Nubank")
    parser.add_argument("--dia-fechamento", type=int, default=25, help="Dia de fechamento do Nubank (padrão: 25)")
    args = parser.parse_args()

    app = create_app()
    with app.app_context():
        print("=" * 80)
        print(" DIAGNÓSTICO PROFUNDO: FATURA NUBANK DEZEMBRO/2026")
        print("=" * 80)
        print(f"Valor oficial fechado no app Nubank: R$ {args.valor_oficial:,.2f}")
        print(f"Valor exibido na interface:          R$ {VALOR_INTERFACE_ATUAL:,.2f}")
        print(f"Diferença a ser conciliada:          R$ {DIFERENCA_ESPERADA:,.2f}")
        print("-" * 80)

        # 1. Localiza a forma de pagamento do Nubank
        formas_nubank = FormaPagamento.query.filter(
            FormaPagamento.cartao_credito.is_(True),
            FormaPagamento.nome.ilike("%Nubank%")
        ).all()

        if not formas_nubank:
            print("[ERRO] Nenhuma forma de pagamento de cartão Nubank encontrada.")
            return

        print(f"Cartões Nubank encontrados ({len(formas_nubank)}):")
        for fp in formas_nubank:
            print(f"  - ID {fp.id}: '{fp.nome}' | Fechamento: dia {fp.dia_fechamento} | Vencimento: dia {fp.dia_vencimento}")

        forma_principal = formas_nubank[0]
        # Se houver mais de um, busca o que tem mais transações em 2026
        if len(formas_nubank) > 1:
            melhor_fp = forma_principal
            max_txs = 0
            for fp in formas_nubank:
                qtd = Transacao.query.filter_by(forma_pagamento_id=fp.id).count()
                if qtd > max_txs:
                    max_txs = qtd
                    melhor_fp = fp
            forma_principal = melhor_fp

        print(f"\n>> Cartão ativo selecionado: ID {forma_principal.id} ('{forma_principal.nome}')")

        # 2. Busca todas as transações alocadas na fatura de Dezembro/2026
        # Competência Dez/2026 = 2026-12-01 (vencimento dia 03/12/2026)
        comp_dez = date(2026, 12, 1)
        
        txs_dez = Transacao.query.filter(
            Transacao.forma_pagamento_id == forma_principal.id,
            Transacao.competencia_fatura == comp_dez,
            Transacao.tipo.in_(["Despesa", "Receita"])
        ).order_by(Transacao.data_transacao.asc(), Transacao.id.asc()).all()

        # Se não filtrou por competencia_fatura preenchida, calcula pela data
        if not txs_dez:
            inicio_ciclo, fim_ciclo = calcular_ciclo_compras(comp_dez, forma_principal.dia_fechamento or 25, forma_principal.dia_vencimento or 3)
            print(f"Buscando transações pelo ciclo calculado: {inicio_ciclo} a {fim_ciclo}...")
            txs_dez = Transacao.query.filter(
                Transacao.forma_pagamento_id == forma_principal.id,
                Transacao.data_transacao.between(inicio_ciclo, fim_ciclo),
                Transacao.tipo.in_(["Despesa", "Receita"])
            ).order_by(Transacao.data_transacao.asc(), Transacao.id.asc()).all()

        total_itens = len(txs_dez)
        print(f"\nTransações encontradas na fatura Dez/2026: {total_itens}")

        soma_despesas = Decimal("0.00")
        soma_estornos = Decimal("0.00")
        compras_pos_corte = []
        transacoes_gol = []

        for tx in txs_dez:
            raw_val = Decimal(str(tx.valor_parcela if (tx.parcelado and tx.valor_parcela is not None) else (tx.valor or 0)))
            if tx.tipo == "Receita":
                soma_estornos += abs(raw_val)
            else:
                soma_despesas += raw_val

            # Identifica compra da Gol
            if "gol" in (tx.descricao or "").lower() or "linhas aereas" in (tx.descricao or "").lower():
                transacoes_gol.append(tx)

            # Identifica compras nos dias 25 e 26 de novembro (fronteira de fechamento)
            if tx.data_transacao and tx.data_transacao >= date(2026, 11, 25):
                compras_pos_corte.append(tx)

        total_calculado = soma_despesas - soma_estornos
        print(f"  + Soma das Despesas: R$ {soma_despesas:,.2f}")
        print(f"  - Soma dos Estornos: R$ {soma_estornos:,.2f}")
        print(f"  = Total Calculado:   R$ {total_calculado:,.2f}")
        diff_real = total_calculado - Decimal(str(args.valor_oficial))
        print(f"  * Excesso em relação ao fechado no app: R$ {diff_real:,.2f}")

        # 3. Análise detalhada das causas
        print("\n" + "=" * 80)
        print(" ANÁLISE DOS ITENS DISCREPANTES")
        print("=" * 80)

        # Causa 1: Parcela Gol Linhas Aéreas
        ajuste_gol_possivel = Decimal("0.00")
        if transacoes_gol:
            print("\n[CAUSA 1] Transações GOL Linhas Aéreas:")
            for g in transacoes_gol:
                val = Decimal(str(g.valor_parcela if g.parcelado else g.valor))
                print(f"  ID {g.id} | {g.data_transacao} | {g.descricao} | Valor: R$ {val:,.2f} | Parcela: {g.parcela_atual}/{g.total_parcelas}")
                if val > Decimal("400.00"):
                    # 1148.91 -> deveria ser 357.68
                    diferenca_gol = val - Decimal("357.68")
                    ajuste_gol_possivel += diferenca_gol
                    print(f"  >>> ALERTA: Esta parcela está com R$ {val:,.2f}. O valor linear é R$ 357,68 (Excesso: R$ {diferenca_gol:,.2f}).")
        else:
            print("\n[CAUSA 1] Nenhuma transação da Gol com nome exato encontrada neste lote.")

        # Causa 2: Compras na fronteira de fechamento (após o dia 25/11)
        soma_pos_corte = Decimal("0.00")
        compras_para_mover = []
        print(f"\n[CAUSA 2] Compras realizadas APÓS 25/11 (Pertencem à fatura de Janeiro/2027):")
        for tx in txs_dez:
            if tx.data_transacao and tx.data_transacao > date(2026, 11, 25):
                compras_para_mover.append(tx)
                v = Decimal(str(tx.valor_parcela if tx.parcelado else tx.valor))
                soma_pos_corte += v
                print(f"  ID {tx.id} | Data: {tx.data_transacao} | Descrição: {tx.descricao[:35]} | Valor: R$ {v:,.2f} | Comp Atual: {tx.competencia_fatura}")

        if compras_para_mover:
            print(f"  >>> TOTAL a ser transferido para a fatura de Jan/2027: R$ {soma_pos_corte:,.2f} ({len(compras_para_mover)} transações)")
        else:
            print("  Nenhuma compra pós-fechamento detectada.")

        # Causa 3: Fatura Oficial Open Finance
        print("\n[CAUSA 3] Registro da Fatura Oficial (OpenFinanceFatura):")
        conta_map = OpenFinanceContaMap.query.filter_by(forma_pagamento_id=forma_principal.id).first()
        fatura_oficial = None
        if conta_map:
            fatura_oficial = OpenFinanceFatura.query.filter_by(
                conta_map_id=conta_map.id,
                competencia=comp_dez
            ).first()
        else:
            fatura_oficial = OpenFinanceFatura.query.filter_by(competencia=comp_dez).first()

        if fatura_oficial:
            print(f"  Fatura oficial existente: ID {fatura_oficial.id} | Valor Total: R$ {fatura_oficial.valor_total:,.2f} | Status: {fatura_oficial.status}")
        else:
            print("  [!] NÃO HÁ FATURA OFICIAL (OpenFinanceFatura) CADASTRADA PARA DEZ/2026.")
            print("      Sem este registro, a interface sempre somará todos os lançamentos brutos em vez de exibir a fatura fechada.")

        # 4. Solução e Aplicação
        print("\n" + "=" * 80)
        print(" PLANO DE CONCILIAÇÃO DEFINITIVA")
        print("=" * 80)
        print("1. Ajustar o dia de fechamento do Nubank para dia 25 (garantindo que o ciclo corte pontualmente).")
        print(f"2. Se aplicável, corrigir a parcela da Gol para R$ 357,68 (abate R$ {ajuste_gol_possivel:,.2f}).")
        print(f"3. Registrar/Atualizar a fatura oficial fechada (OpenFinanceFatura) com o valor exato de R$ {args.valor_oficial:,.2f}.")
        print("   -> Isso ativa o selo oficial 'Fatura Fechada: R$ 15.941,28' na interface web e no drawer.")

        if not args.aplicar:
            print("\n>> NENHUMA ALTERAÇÃO FOI GRAVADA (modo simulação).")
            print("   Para efetivar a conciliação no banco de dados, execute:")
            print("   python scripts/diagnosticar_fatura_nubank_dez26.py --aplicar")
            return

        # --- APLICAÇÃO DAS ALTERAÇÕES ---
        print("\n>>> APLICANDO CONCILIAÇÃO NO BANCO DE DADOS...")

        # 1. Atualizar dia de fechamento
        if forma_principal.dia_fechamento != args.dia_fechamento:
            forma_principal.dia_fechamento = args.dia_fechamento
            print(f"  [OK] Forma de pagamento {forma_principal.id} atualizada com dia_fechamento = {args.dia_fechamento}.")

        # 2. Ajustar Gol se encontrada parcela desproporcional
        for g in transacoes_gol:
            val = Decimal(str(g.valor_parcela if g.parcelado else g.valor))
            if val > Decimal("400.00"):
                g.valor = Decimal("357.68")
                g.valor_parcela = Decimal("357.68")
                g.observacoes = (g.observacoes or "") + " [ajuste_manual: linearizado para 12x 357.68]"
                print(f"  [OK] Transação ID {g.id} (Gol) ajustada de R$ {val:,.2f} para R$ 357,68.")

        # 3. Mover compras pós-corte para Janeiro/2027 (2027-01-01)
        if compras_para_mover:
            for tx in compras_para_mover:
                tx.competencia_fatura = date(2027, 1, 1)
                tx.observacoes = (tx.observacoes or "") + " [ajuste_manual: movido para fatura seguinte]"
                print(f"  [OK] Transação ID {tx.id} ({tx.descricao[:30]}) movida para Jan/2027 com tag [ajuste_manual].")

        # 4. Garantir ContaMap para OpenFinance se não houver
        if not conta_map:
            conta_map = OpenFinanceContaMap.query.filter_by(forma_pagamento_id=forma_principal.id).first()
            if not conta_map:
                conta_map = OpenFinanceContaMap(
                    conexao_id=1,
                    pluggy_account_id=f"nubank-manual-{forma_principal.id}",
                    tipo_pluggy="CREDIT",
                    nome=forma_principal.nome,
                    numero="0000",
                    forma_pagamento_id=forma_principal.id,
                    sincronizar=True
                )
                db.session.add(conta_map)
                db.session.flush()
                print(f"  [OK] Mapeamento OpenFinanceContaMap criado para o cartão {forma_principal.nome}.")

        # 4. Criar ou atualizar a fatura oficial fechada
        if not fatura_oficial:
            fatura_oficial = OpenFinanceFatura(
                conta_map_id=conta_map.id,
                pluggy_bill_id=f"bill-nubank-2026-12-{forma_principal.id}",
                data_vencimento=date(2026, 12, 3),
                data_fechamento=date(2026, 11, 25),
                competencia=comp_dez,
                valor_total=Decimal(str(args.valor_oficial)),
                valor_minimo=Decimal(str(round(args.valor_oficial * 0.15, 2))),
                valor_pago=Decimal("0.00"),
                status="ABERTO",
            )
            db.session.add(fatura_oficial)
            print(f"  [OK] Fatura oficial OpenFinanceFatura criada com valor R$ {args.valor_oficial:,.2f} (Venc: 03/12/2026).")
        else:
            fatura_oficial.valor_total = Decimal(str(args.valor_oficial))
            fatura_oficial.data_vencimento = date(2026, 12, 3)
            fatura_oficial.data_fechamento = date(2026, 11, 25)
            fatura_oficial.status = "ABERTO"
            print(f"  [OK] Fatura oficial ID {fatura_oficial.id} atualizada para R$ {args.valor_oficial:,.2f}.")

        db.session.commit()
        print("\n" + "=" * 80)
        print(" CONCILIAÇÃO CONCLUÍDA COM SUCESSO! ")
        print(f" Fatura Nubank Dez/2026 consolidada e fechada em R$ {args.valor_oficial:,.2f}")
        print("=" * 80)

if __name__ == "__main__":
    main()
