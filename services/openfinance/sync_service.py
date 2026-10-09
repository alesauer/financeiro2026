from datetime import datetime, date, timedelta
from typing import Dict, Any, List, Optional
import re
from app import db
from app.models import (
    OpenFinanceConexao,
    OpenFinanceContaMap,
    FormaPagamento,
    Transacao,
    Categoria,
)
from app.utils.texto import normalizar_texto
from services.openfinance.pluggy_client import PluggyClient
from services.fatura_service import aplicar_competencia_transacao
from services.categorization import categorizar_transacao


def eh_pagamento_fatura(descricao: str | None) -> bool:
    if not descricao:
        return False
    texto_norm = normalizar_texto(descricao)
    termos = [
        "pagamento recebido",
        "pagamento da fatura",
        "pagamento fatura",
        "pagamento de fatura",
        "pagamento cartao",
        "pagamento efetuado",
        "pagamento antecipado",
    ]
    return any(t in texto_norm for t in termos)


class OpenFinanceSyncService:

    @classmethod
    def register_or_update_connection(cls, item_id: str, usuario_id: int) -> OpenFinanceConexao:
        """Registra ou atualiza um Item da Pluggy e dispara a primeira sincronização."""
        item_data = PluggyClient.get_item(item_id)
        connector_id = item_data.get("connectorId")
        connector_data = item_data.get("connector") or {}
        if not connector_data and connector_id:
            connector_data = PluggyClient.get_connector(connector_id)

        connector_name = connector_data.get("name") or f"Instituição #{connector_id}"
        connector_image_url = connector_data.get("imageUrl")
        connector_primary_color = connector_data.get("primaryColor")
        status = item_data.get("status", "UPDATED")

        # Consentimento (padrão Open Finance é 12 meses)
        created_at_str = item_data.get("createdAt")
        data_consentimento = datetime.now()
        if created_at_str:
            try:
                data_consentimento = datetime.fromisoformat(created_at_str.replace("Z", "+00:00"))
            except Exception:
                pass
        consent_expires_at = data_consentimento + timedelta(days=365)

        conexao = OpenFinanceConexao.query.filter_by(item_id=item_id).first()
        if not conexao:
            conexao = OpenFinanceConexao(
                usuario_id=usuario_id,
                item_id=item_id,
                connector_id=connector_id,
                connector_name=connector_name,
                connector_image_url=connector_image_url,
                connector_primary_color=connector_primary_color,
                status=status,
                consent_expires_at=consent_expires_at,
            )
            db.session.add(conexao)
        else:
            conexao.connector_name = connector_name
            conexao.connector_image_url = connector_image_url or conexao.connector_image_url
            conexao.connector_primary_color = connector_primary_color or conexao.connector_primary_color
            conexao.status = status
            conexao.consent_expires_at = consent_expires_at

        db.session.commit()

        # Apenas descobre e cadastra as contas/cartões para configuração do usuário (NÃO importa transações automaticamente)
        cls.discover_and_map_accounts(conexao)
        return conexao

    @classmethod
    def discover_and_map_accounts(cls, conexao: OpenFinanceConexao) -> List[OpenFinanceContaMap]:
        """Busca contas e cartões da instituição e cadastra no mapa sem importar transações."""
        pluggy_accounts = PluggyClient.get_accounts(conexao.item_id)
        contas_mapeadas = []

        for acc in pluggy_accounts:
            acc_id = acc.get("id")
            acc_type = acc.get("type", "BANK")  # 'CREDIT' | 'BANK'
            acc_name = acc.get("name") or acc.get("marketingName") or conexao.connector_name or "Conta Bancária"
            acc_number = acc.get("number") or ""

            conta_map = OpenFinanceContaMap.query.filter_by(pluggy_account_id=acc_id).first()
            if not conta_map:
                is_credit = (acc_type == "CREDIT")
                tipo_forma = "Cartão de Crédito" if is_credit else "Conta Corrente"

                forma_existente = FormaPagamento.query.filter(
                    FormaPagamento.nome.ilike(f"%{acc_name}%")
                ).first()

                if not forma_existente:
                    dia_fechamento = None
                    dia_vencimento = None
                    if is_credit:
                        try:
                            bills = PluggyClient.get_bills(acc_id)
                            if bills:
                                latest_bill = bills[0]
                                due_date_str = latest_bill.get("dueDate")
                                close_date_str = latest_bill.get("closingDate")
                                if due_date_str:
                                    dia_vencimento = int(due_date_str[:10].split("-")[2])
                                if close_date_str:
                                    dia_fechamento = int(close_date_str[:10].split("-")[2])
                        except Exception:
                            pass

                    forma_existente = FormaPagamento(
                        nome=f"{conexao.connector_name} - {acc_name}" if conexao.connector_name not in acc_name else acc_name,
                        tipo=tipo_forma,
                        cartao_credito=is_credit,
                        dia_fechamento=dia_fechamento or (25 if is_credit else None),
                        dia_vencimento=dia_vencimento or (5 if is_credit else None),
                        ativo=True,
                        cor=conexao.connector_primary_color or "#0d9488",
                    )
                    db.session.add(forma_existente)
                    db.session.flush()

                conta_map = OpenFinanceContaMap(
                    conexao_id=conexao.id,
                    pluggy_account_id=acc_id,
                    tipo_pluggy=acc_type,
                    nome=acc_name,
                    numero=acc_number,
                    forma_pagamento_id=forma_existente.id,
                    sincronizar=True,
                )
                db.session.add(conta_map)
                db.session.flush()

            contas_mapeadas.append(conta_map)

        db.session.commit()
        return contas_mapeadas

    @classmethod
    def sync_connection(cls, conexao_id: int, usuario_id: int) -> Dict[str, Any]:
        """Sincroniza todas as contas, cartões e transações de uma conexão Open Finance sob demanda."""
        conexao = OpenFinanceConexao.query.get(conexao_id)
        if not conexao or int(conexao.usuario_id) != int(usuario_id):
            raise ValueError("Conexão não encontrada ou não pertence ao usuário.")

        # Atualiza status
        item_data = PluggyClient.get_item(conexao.item_id)
        conexao.status = item_data.get("status", conexao.status)
        conexao.erro_mensagem = item_data.get("error", {}).get("message") if item_data.get("error") else None

        # 1. Garante que todas as contas estão descobertas e mapeadas
        contas_mapeadas_lista = cls.discover_and_map_accounts(conexao)

        novas_transacoes = 0
        duplicadas_ignoradas = 0
        pagamentos_fatura_ignorados = 0
        contas_mapeadas = len(contas_mapeadas_lista)

        # Categoria padrão de fallback
        cat_outros = Categoria.query.filter_by(nome="Outros").first()
        if not cat_outros:
            cat_outros = Categoria.query.first()
        fallback_cat_id = cat_outros.id if cat_outros else 1

        for conta_map in contas_mapeadas_lista:
            acc_id = conta_map.pluggy_account_id
            acc_type = conta_map.tipo_pluggy

            if not getattr(conta_map, "sincronizar", True):
                continue

            forma_pagamento = conta_map.forma_pagamento or FormaPagamento.query.get(conta_map.forma_pagamento_id)
            if not forma_pagamento:
                continue

            # 2. Busca transações dos últimos 60 dias
            data_inicio = (date.today() - timedelta(days=60)).isoformat()
            tx_page = 1
            has_more = True

            while has_more:
                tx_resp = PluggyClient.get_transactions(
                    account_id=acc_id,
                    from_date=data_inicio,
                    page=tx_page,
                    page_size=100
                )
                transactions = tx_resp.get("results", [])
                if not transactions:
                    break

                for tx in transactions:
                    tx_id = str(tx.get("id"))
                    desc_raw = tx.get("description") or tx.get("descriptionRaw") or "Transação Open Finance"
                    amount = abs(float(tx.get("amount", 0)))
                    tx_date_str = tx.get("date", "")[:10]

                    if not tx_date_str or amount == 0:
                        continue

                    data_tx = date.fromisoformat(tx_date_str)

                    # Descartar pagamentos de fatura recebidos (para não duplicar créditos/débitos)
                    if acc_type == "CREDIT" and eh_pagamento_fatura(desc_raw):
                        pagamentos_fatura_ignorados += 1
                        continue

                    # 1. Deduplicação por identificador_externo
                    tx_existente = Transacao.query.filter_by(identificador_externo=tx_id).first()
                    if tx_existente:
                        duplicadas_ignoradas += 1
                        continue

                    # 2. Deduplicação por correspondência idêntica (data + valor + forma_pagamento + descrição normalizada)
                    desc_norm = normalizar_texto(desc_raw)
                    candidatos = Transacao.query.filter_by(
                        forma_pagamento_id=forma_pagamento.id,
                        data_transacao=data_tx
                    ).all()

                    ja_existe = False
                    for cand in candidatos:
                        if cand.valor is not None and abs(float(cand.valor) - amount) < 0.005:
                            if normalizar_texto(cand.descricao) == desc_norm:
                                ja_existe = True
                                # Vincula o identificador_externo para buscas futuras rápidas
                                cand.identificador_externo = tx_id
                                break

                    if ja_existe:
                        duplicadas_ignoradas += 1
                        continue

                    # Determinar tipo de transação (Despesa / Receita)
                    tipo_transacao = "Despesa"
                    pluggy_type = tx.get("type", "DEBIT")
                    if pluggy_type == "CREDIT" and acc_type != "CREDIT":
                        tipo_transacao = "Receita"
                    elif acc_type == "CREDIT":
                        # No cartão, amount positivo é despesa; se amount vier negativo ou tipo CREDIT, pode ser estorno/crédito
                        raw_amount = float(tx.get("amount", 0))
                        tipo_transacao = "Receita" if raw_amount < 0 else "Despesa"

                    # Classificação inteligente de categoria
                    cat_result = categorizar_transacao(desc_raw)
                    categoria_id = cat_result.categoria_id or fallback_cat_id

                    # Informações de parcelamento (se fornecidas pela Pluggy)
                    payment_data = tx.get("paymentData") or {}
                    total_parcelas = payment_data.get("totalInstallments")
                    parcela_atual = payment_data.get("installmentNumber") or 1
                    is_parcelado = bool(total_parcelas and total_parcelas > 1)

                    # Se a descrição contiver "1/3", extrai se paymentData não veio
                    if not is_parcelado:
                        match_parc = re.search(r"(\d{1,2})\s*[\/\-]\s*(\d{1,2})", desc_raw)
                        if match_parc:
                            p_atual, p_total = int(match_parc.group(1)), int(match_parc.group(2))
                            if 1 <= p_atual <= p_total <= 48:
                                is_parcelado = True
                                parcela_atual = p_atual
                                total_parcelas = p_total

                    nova_tx = Transacao(
                        tipo=tipo_transacao,
                        categoria_id=categoria_id,
                        descricao=desc_raw,
                        valor=amount,
                        data_transacao=data_tx,
                        forma_pagamento_id=forma_pagamento.id,
                        status="Pago",
                        parcelado=is_parcelado,
                        total_parcelas=total_parcelas if is_parcelado else None,
                        parcela_atual=parcela_atual if is_parcelado else 1,
                        valor_parcela=amount if is_parcelado else None,
                        identificador_externo=tx_id,
                        observacoes=f"Sincronizado via Open Finance ({conexao.connector_name})",
                    )

                    # Aplica competência da fatura do cartão
                    if forma_pagamento.cartao_credito:
                        aplicar_competencia_transacao(nova_tx, forma_pagamento)

                    db.session.add(nova_tx)
                    novas_transacoes += 1

                # Paginação
                total_pages = tx_resp.get("totalPages", 1)
                if tx_page >= total_pages:
                    has_more = False
                else:
                    tx_page += 1

        conexao.last_sync_at = datetime.now()
        db.session.commit()

        return {
            "conexao_id": conexao.id,
            "connector_name": conexao.connector_name,
            "contas_mapeadas": contas_mapeadas,
            "novas_transacoes": novas_transacoes,
            "duplicadas_ignoradas": duplicadas_ignoradas,
            "pagamentos_fatura_ignorados": pagamentos_fatura_ignorados,
            "status": conexao.status,
            "last_sync_at": conexao.last_sync_at.isoformat(),
        }

    @classmethod
    def disconnect(cls, conexao_id: int, usuario_id: int) -> bool:
        """Revoga e desconecta uma instituição Open Finance."""
        conexao = OpenFinanceConexao.query.get(conexao_id)
        if not conexao or conexao.usuario_id != usuario_id:
            return False

        try:
            PluggyClient.delete_item(conexao.item_id)
        except Exception as err:
            print(f"Aviso ao deletar item {conexao.item_id} da Pluggy: {err}")

        db.session.delete(conexao)
        db.session.commit()
        return True
