from datetime import datetime, date, timedelta
from typing import Dict, Any, List, Optional
import logging
import re
from app import db
from app.models import (
    OpenFinanceConexao,
    OpenFinanceContaMap,
    OpenFinanceFatura,
    FormaPagamento,
    Transacao,
    Categoria,
)
from app.utils.texto import normalizar_texto
from services.openfinance.pluggy_client import PluggyClient
from services.fatura_service import (
    aplicar_competencia_transacao,
    calcular_competencia_fatura,
    add_meses_competencia,
    calcular_fatura_aberta_atual,
)
from services.categorization import categorizar_transacao, get_engine

logger = logging.getLogger(__name__)


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


def extrair_dados_parcelamento(desc_raw: str, credit_meta: dict, payment_data: dict) -> tuple[bool, Optional[int], int]:
    """Extrai (is_parcelado, total_parcelas, parcela_atual) de metadados ou regex da descrição."""
    total_parcelas = credit_meta.get("totalInstallments") or payment_data.get("totalInstallments")
    parcela_atual = credit_meta.get("installmentNumber") or payment_data.get("installmentNumber") or 1
    is_parcelado = bool(total_parcelas and total_parcelas > 1)

    if not is_parcelado and desc_raw:
        match_parc = re.search(r"(\d{1,2})\s*[\/\-]\s*(\d{1,2})", desc_raw)
        if match_parc:
            p_atual, p_total = int(match_parc.group(1)), int(match_parc.group(2))
            if 1 <= p_atual <= p_total <= 48:
                is_parcelado = True
                parcela_atual = p_atual
                total_parcelas = p_total

    return is_parcelado, (int(total_parcelas) if is_parcelado and total_parcelas else None), (int(parcela_atual) if is_parcelado else 1)


def resolver_competencia_parcelada(
    forma_pagamento_id: int,
    desc_raw: str,
    total_parcelas: Optional[int],
    parcela_atual: int,
    amount: float,
    fallback_comp: Optional[date],
    series_cache: Optional[Dict[Any, Any]] = None,
    tx_id_ignorar: Optional[int] = None,
) -> Optional[date]:
    """Garante que parcelas consecutivas de uma mesma compra parcelada nunca colidam no mesmo mês de fatura.

    Se houver outra parcela da mesma série (mesma descrição base, mesmo valor e total de parcelas),
    alinha estritamente o mês de vencimento:
      comp_p = comp_irma + (parcela_atual - irma_parcela_atual) meses
    """
    if not total_parcelas or total_parcelas <= 1 or not fallback_comp:
        return fallback_comp

    def _clean_desc(d: str) -> str:
        return re.sub(r"\s*\d{1,2}\s*[\/\-]\s*\d{1,2}.*$", "", d or "").strip().lower()

    base_desc = _clean_desc(desc_raw)
    val_key = round(amount, 1)
    cache_key = (forma_pagamento_id, base_desc, val_key, total_parcelas)

    # 1. Verifica cache em memória da sessão de sincronização
    if series_cache is not None and cache_key in series_cache:
        anc_parc, anc_comp = series_cache[cache_key]
        diff = parcela_atual - anc_parc
        return add_meses_competencia(anc_comp, diff)

    # 2. Busca parcela irmã no banco de dados
    candidatos = Transacao.query.filter(
        Transacao.forma_pagamento_id == forma_pagamento_id,
        Transacao.parcelado == True,
        Transacao.total_parcelas == total_parcelas,
        Transacao.competencia_fatura.isnot(None),
    )
    if tx_id_ignorar:
        candidatos = candidatos.filter(Transacao.id != tx_id_ignorar)

    for cand in candidatos.all():
        if _clean_desc(cand.descricao) == base_desc and abs(float(cand.valor or 0) - amount) < 0.05:
            cand_parc = cand.parcela_atual or 1
            cand_comp = cand.competencia_fatura
            diff = parcela_atual - cand_parc
            resolved_comp = add_meses_competencia(cand_comp, diff)
            if series_cache is not None:
                series_cache[cache_key] = (cand_parc, cand_comp)
            return resolved_comp

    # 3. Se nenhuma irmã foi encontrada, adota fallback_comp como âncora
    if series_cache is not None:
        series_cache[cache_key] = (parcela_atual, fallback_comp)
    return fallback_comp


def determinar_status_transacao_sync(
    forma_pagamento,
    conta_map: Optional[OpenFinanceContaMap],
    competencia_fatura: Optional[date]
) -> str:
    """Determina o status inicial ('Pago' ou 'Pendente') de uma transação sincronizada.

    - Contas correntes / investimentos: sempre 'Pago' (débito/crédito na conta já efetuado).
    - Cartão de crédito:
        * 'Pago' se houver fatura oficial registrada para aquela competência com status PAGO.
        * 'Pendente' para faturas abertas, parciais, futuras ou sem registro oficial de quitação.
    """
    eh_cartao = bool(
        getattr(forma_pagamento, "cartao_credito", False)
        or (conta_map and getattr(conta_map, "tipo_pluggy", None) == "CREDIT")
    )
    if not eh_cartao:
        return "Pago"

    if not conta_map or not competencia_fatura:
        return "Pendente"

    fatura_oficial = OpenFinanceFatura.query.filter_by(
        conta_map_id=conta_map.id,
        competencia=competencia_fatura,
    ).first()

    if fatura_oficial and (
        fatura_oficial.status == "PAGO"
        or (fatura_oficial.valor_pago or 0) >= (fatura_oficial.valor_total - 0.05)
    ):
        return "Pago"

    return "Pendente"


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

        # Carrega/atualiza o aprendizado de categorias e histórico do usuário
        try:
            get_engine().carregar_contexto(force=True)
        except Exception as e:
            logger.warning(f"Falha ao recarregar contexto do motor de categorização: {e}")

        # Categoria padrão de fallback
        cat_outros = Categoria.query.filter_by(nome="Outros").first()
        if not cat_outros:
            cat_outros = Categoria.query.first()
        fallback_cat_id = cat_outros.id if cat_outros else 1

        # Cache para desempate de séries de parcelas na mesma sessão
        series_cache: Dict[Any, Any] = {}

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
            all_transactions = []

            while has_more:
                tx_resp = PluggyClient.get_transactions(
                    account_id=acc_id,
                    from_date=data_inicio,
                    page=tx_page,
                    page_size=100
                )
                page_txs = tx_resp.get("results", [])
                if not page_txs:
                    break
                all_transactions.extend(page_txs)
                total_pages = tx_resp.get("totalPages", 1)
                if tx_page >= total_pages:
                    has_more = False
                else:
                    tx_page += 1

            bills_comp_map: Dict[str, date] = {}
            max_closed_comp: Optional[date] = None
            if acc_type == "CREDIT":
                bills_comp_map, max_closed_comp = cls._obter_mapa_bills(acc_id)
                all_transactions.sort(
                    key=lambda t: (
                        0 if (t.get("creditCardMetadata") or {}).get("billId") else 1,
                        (t.get("date") or "")[:10],
                    )
                )

            for tx in all_transactions:
                tx_id = str(tx.get("id"))
                desc_raw = tx.get("description") or tx.get("descriptionRaw") or "Transação Open Finance"
                raw_amount = float(tx.get("amount", 0))
                amount = abs(raw_amount)
                tx_date_str = tx.get("date", "")[:10]

                if not tx_date_str or amount == 0:
                    continue

                data_tx = date.fromisoformat(tx_date_str)
                credit_meta = tx.get("creditCardMetadata") or {}
                payment_data = tx.get("paymentData") or {}

                # 1. Tratamento específico para Cartão de Crédito
                competencia_fatura_calculada = None
                is_parcelado, total_parcelas, parcela_atual = extrair_dados_parcelamento(desc_raw, credit_meta, payment_data)

                if acc_type == "CREDIT":
                    # Descartar pagamentos de fatura (ex.: "Pagamento recebido")
                    if eh_pagamento_fatura(desc_raw) or (raw_amount < 0 and "pagamento" in desc_raw.lower()):
                        pagamentos_fatura_ignorados += 1
                        continue

                    # Para compras à vista ou 1ª parcela, usa purchaseDate se disponível;
                    # para parcelas > 1, mantém tx['date'] (data de lançamento da parcela no ciclo)
                    if not is_parcelado or parcela_atual <= 1:
                        purchase_dt_str = credit_meta.get("purchaseDate") or credit_meta.get("transactionDateTime")
                        if purchase_dt_str and len(purchase_dt_str) >= 10:
                            try:
                                data_tx = date.fromisoformat(purchase_dt_str[:10])
                            except Exception:
                                pass

                    bill_id = str(credit_meta.get("billId") or "")
                    if bill_id and bill_id in bills_comp_map:
                        competencia_fatura_calculada = bills_comp_map[bill_id]
                        if is_parcelado and total_parcelas and total_parcelas > 1:
                            base_desc = re.sub(r"\s*\d{1,2}\s*[\/\-]\s*\d{1,2}.*$", "", desc_raw or "").strip().lower()
                            cache_key = (forma_pagamento.id, base_desc, round(amount, 1), total_parcelas)
                            series_cache.setdefault(cache_key, (parcela_atual, competencia_fatura_calculada))
                    else:
                        # Se a Pluggy fornece o mês previsto da fatura (ex: "2026-11", "2026-12")
                        bill_forecast = credit_meta.get("billForecastDate")
                        if bill_forecast and len(bill_forecast) == 7 and bill_forecast[4] == "-":
                            try:
                                b_ano, b_mes = int(bill_forecast[:4]), int(bill_forecast[5:7])
                                competencia_fatura_calculada = date(b_ano, b_mes, 1)
                            except Exception:
                                pass

                        if not competencia_fatura_calculada:
                            dia_fech = getattr(forma_pagamento, "dia_fechamento", None)
                            dia_venc = getattr(forma_pagamento, "dia_vencimento", None)
                            competencia_fatura_calculada = calcular_competencia_fatura(data_tx, dia_fech, dia_venc)

                        # Se não tem billId (fatura aberta) mas caiu em competência já fechada, avança para a próxima fatura aberta
                        if competencia_fatura_calculada and max_closed_comp and competencia_fatura_calculada <= max_closed_comp:
                            competencia_fatura_calculada = add_meses_competencia(max_closed_comp, 1)

                        # Alinha parcelas da mesma série para nunca colidirem no mesmo mês de fatura
                        if is_parcelado and competencia_fatura_calculada:
                            competencia_fatura_calculada = resolver_competencia_parcelada(
                                forma_pagamento_id=forma_pagamento.id,
                                desc_raw=desc_raw,
                                total_parcelas=total_parcelas,
                                parcela_atual=parcela_atual,
                                amount=amount,
                                fallback_comp=competencia_fatura_calculada,
                                series_cache=series_cache,
                            )

                    # Filtro de Horizonte: Não importar parcelas de faturas muito futuras (> 4 meses à frente)
                    if competencia_fatura_calculada:
                        limite_futuro = (date.today() + timedelta(days=125))
                        if competencia_fatura_calculada > limite_futuro:
                            continue

                # 2. Determinar tipo de transação (Despesa / Receita / Estorno)
                pluggy_type = tx.get("type", "DEBIT")
                if acc_type == "CREDIT":
                    eh_estorno = (
                        raw_amount < 0
                        or pluggy_type == "CREDIT"
                        or any(term in desc_raw.lower() for term in ["estorno", "iof de volta", "devolucao", "devolução", "reembolso"])
                    )
                    tipo_transacao = "Receita" if eh_estorno else "Despesa"
                else:
                    tipo_transacao = "Receita" if pluggy_type == "CREDIT" else "Despesa"

                # 3. Deduplicação por identificador_externo
                tx_existente = Transacao.query.filter_by(identificador_externo=tx_id).first()
                if tx_existente:
                    if competencia_fatura_calculada and tx_existente.competencia_fatura != competencia_fatura_calculada:
                        tx_existente.competencia_fatura = competencia_fatura_calculada
                    if tx_existente.data_transacao != data_tx:
                        tx_existente.data_transacao = data_tx
                    if tx_existente.tipo != tipo_transacao:
                        tx_existente.tipo = tipo_transacao
                    if tx_existente.valor != amount:
                        tx_existente.valor = amount
                    duplicadas_ignoradas += 1
                    continue

                # 4. Deduplicação por correspondência idêntica (data + valor + forma_pagamento + descrição normalizada)
                desc_norm = normalizar_texto(desc_raw)
                candidatos = Transacao.query.filter_by(
                    forma_pagamento_id=forma_pagamento.id,
                    data_transacao=data_tx
                ).all()

                ja_existe = False
                for cand in candidatos:
                    if cand.identificador_externo and cand.identificador_externo != tx_id:
                        continue
                    if cand.valor is not None and abs(float(cand.valor) - amount) < 0.005:
                        if normalizar_texto(cand.descricao) == desc_norm:
                            ja_existe = True
                            cand.identificador_externo = tx_id
                            if competencia_fatura_calculada:
                                cand.competencia_fatura = competencia_fatura_calculada
                            if cand.tipo != tipo_transacao:
                                cand.tipo = tipo_transacao
                            break

                if ja_existe:
                    duplicadas_ignoradas += 1
                    continue

                # 5. Classificação inteligente de categoria
                cat_result = categorizar_transacao(desc_raw)
                categoria_id = cat_result.categoria_id or fallback_cat_id

                status_tx = determinar_status_transacao_sync(
                    forma_pagamento=forma_pagamento,
                    conta_map=conta_map,
                    competencia_fatura=competencia_fatura_calculada,
                )

                nova_tx = Transacao(
                    tipo=tipo_transacao,
                    categoria_id=categoria_id,
                    descricao=desc_raw,
                    valor=amount,
                    data_transacao=data_tx,
                    forma_pagamento_id=forma_pagamento.id,
                    status=status_tx,
                    parcelado=is_parcelado,
                    total_parcelas=total_parcelas if is_parcelado else None,
                    parcela_atual=parcela_atual if is_parcelado else 1,
                    valor_parcela=amount if is_parcelado else None,
                    recorrente=bool(is_parcelado),
                    recorrencia_tipo="Parcelamento" if is_parcelado else None,
                    identificador_externo=tx_id,
                    competencia_fatura=competencia_fatura_calculada,
                    observacoes=f"Sincronizado via Open Finance ({conexao.connector_name})",
                )

                db.session.add(nova_tx)
                novas_transacoes += 1

        # Persiste primeiro todas as transações importadas antes de sincronizar faturas oficiais
        conexao.last_sync_at = datetime.now()
        db.session.commit()

        # Sincroniza faturas oficiais dos cartões de crédito
        for cm in contas_mapeadas_lista:
            if cm.tipo_pluggy == "CREDIT" and getattr(cm, "sincronizar", True):
                try:
                    cls.sync_faturas_oficiais(cm)
                except Exception as err_fat:
                    logger.warning(f"Aviso ao sincronizar faturas oficiais da conta {cm.id}: {err_fat}")

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
    def _obter_mapa_bills(cls, pluggy_account_id: str) -> tuple[Dict[str, date], Optional[date]]:
        """Retorna mapa {bill_id: competencia} e a maior competência fechada do cartão na Pluggy."""
        bills_map: Dict[str, date] = {}
        max_comp: Optional[date] = None
        try:
            bills = PluggyClient.get_bills(pluggy_account_id)
            for b in bills or []:
                bid = str(b.get("id") or "")
                due_str = b.get("dueDate")
                if bid and due_str and len(due_str) >= 10:
                    due_dt = date.fromisoformat(due_str[:10])
                    comp = date(due_dt.year, due_dt.month, 1)
                    bills_map[bid] = comp
                    if max_comp is None or comp > max_comp:
                        max_comp = comp
        except Exception as err:
            logger.warning(f"Falha ao obter mapa de bills da conta {pluggy_account_id}: {err}")
        return bills_map, max_comp

    @classmethod
    def sync_faturas_oficiais(
        cls,
        conta_map: OpenFinanceContaMap,
        alvo_comp: Optional[date] = None,
    ) -> List[OpenFinanceFatura]:
        """Busca e sincroniza as faturas oficiais fechadas do cartão via Open Finance."""
        if conta_map.tipo_pluggy != "CREDIT":
            return []

        fp_id = conta_map.forma_pagamento_id or (
            conta_map.forma_pagamento.id if conta_map.forma_pagamento else None
        )

        try:
            bills = PluggyClient.get_bills(conta_map.pluggy_account_id)
            if not bills:
                return []

            # Descobre quais competências possuem lançamentos sincronizados no banco para não criar faturas fantasmas vazias de anos anteriores
            competencias_com_tx = set()
            if fp_id:
                rows_comp = (
                    db.session.query(Transacao.competencia_fatura)
                    .filter(
                        Transacao.forma_pagamento_id == fp_id,
                        Transacao.competencia_fatura.isnot(None),
                    )
                    .distinct()
                    .all()
                )
                competencias_com_tx = {r[0] for r in rows_comp if r[0]}

            faturas_sincronizadas = []
            for b in bills:
                bill_id = str(b.get("id"))
                due_date_str = b.get("dueDate")
                if not due_date_str or len(due_date_str) < 10:
                    continue
                due_date = date.fromisoformat(due_date_str[:10])

                closing_date_str = b.get("billClosingDate") or b.get("closingDate")
                closing_date = (
                    date.fromisoformat(closing_date_str[:10])
                    if closing_date_str and len(closing_date_str) >= 10
                    else None
                )

                # Competência do vencimento (regime de caixa)
                competencia = date(due_date.year, due_date.month, 1)

                # Se o usuário sincronizou um mês específico, sincroniza apenas a fatura daquele mês (ou que já tenha lançamentos)
                fatura_obj = OpenFinanceFatura.query.filter_by(pluggy_bill_id=bill_id).first()
                if not fatura_obj:
                    if alvo_comp and competencia != alvo_comp and competencia not in competencias_com_tx:
                        continue
                    if not alvo_comp and competencia not in competencias_com_tx:
                        continue

                total_amount = float(b.get("totalAmount") or 0.0)
                min_amount = float(b.get("minimumPaymentAmount") or 0.0) if b.get("minimumPaymentAmount") is not None else None

                # Somar pagamentos efetuados registrados no banco
                payments = b.get("payments") or []
                total_pago = sum(float(p.get("amount") or 0.0) for p in payments)

                # Status da fatura
                if total_pago >= (total_amount - 0.05):
                    status_fatura = "PAGO"
                elif total_pago > 0:
                    status_fatura = "PARCIAL"
                else:
                    status_fatura = "ABERTO"

                if not fatura_obj:
                    fatura_obj = OpenFinanceFatura(
                        conta_map_id=conta_map.id,
                        pluggy_bill_id=bill_id,
                        data_vencimento=due_date,
                        data_fechamento=closing_date,
                        competencia=competencia,
                        valor_total=round(total_amount, 2),
                        valor_minimo=round(min_amount, 2) if min_amount is not None else None,
                        valor_pago=round(total_pago, 2),
                        status=status_fatura,
                    )
                    db.session.add(fatura_obj)
                else:
                    fatura_obj.data_vencimento = due_date
                    fatura_obj.data_fechamento = closing_date
                    fatura_obj.competencia = competencia
                    fatura_obj.valor_total = round(total_amount, 2)
                    fatura_obj.valor_minimo = round(min_amount, 2) if min_amount is not None else None
                    fatura_obj.valor_pago = round(total_pago, 2)
                    fatura_obj.status = status_fatura

                faturas_sincronizadas.append(fatura_obj)

                # Se a fatura oficial consta como PAGO no banco, garante que as transações fiquem com status Pago
                if status_fatura == "PAGO" and fp_id:
                    Transacao.query.filter(
                        Transacao.forma_pagamento_id == fp_id,
                        Transacao.competencia_fatura == competencia,
                    ).update({"status": "Pago"}, synchronize_session=False)

            db.session.commit()
            return faturas_sincronizadas
        except Exception as e:
            logger.error(f"Erro ao sincronizar faturas oficiais da conta {conta_map.id}: {e}")
            db.session.rollback()
            return []

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

    @classmethod
    def list_cartoes_conectados(cls, usuario_id: int) -> List[Dict[str, Any]]:
        """Retorna os cartões de crédito mapeados para conexões Open Finance do usuário."""
        contas = (
            OpenFinanceContaMap.query.join(OpenFinanceConexao)
            .filter(
                OpenFinanceConexao.usuario_id == usuario_id,
                OpenFinanceContaMap.tipo_pluggy == "CREDIT",
                OpenFinanceContaMap.forma_pagamento_id.isnot(None),
            )
            .all()
        )
        resultado = []
        for c in contas:
            fp = c.forma_pagamento or FormaPagamento.query.get(c.forma_pagamento_id)
            if not fp:
                continue
            conexao = c.conexao
            resultado.append({
                "conta_map_id": c.id,
                "conexao_id": conexao.id,
                "conexao_nome": conexao.connector_name,
                "forma_pagamento_id": fp.id,
                "forma_pagamento_nome": fp.nome,
                "forma_pagamento_icone": getattr(fp, "icone", None),
                "forma_pagamento_cor": getattr(fp, "cor", None),
                "dia_fechamento": fp.dia_fechamento,
                "dia_vencimento": fp.dia_vencimento,
                "pluggy_account_id": c.pluggy_account_id,
                "pluggy_account_name": c.nome,
                "sincronizar": c.sincronizar,
                "last_sync_at": conexao.last_sync_at.isoformat() if conexao.last_sync_at else None,
            })
        return resultado

    @classmethod
    def sync_single_card(
        cls,
        usuario_id: int,
        forma_pagamento_id: Optional[int] = None,
        conta_map_id: Optional[int] = None,
        mes_fatura: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Sincroniza exclusivamente um cartão de crédito Open Finance, opcionalmente filtrando por mês de fatura (YYYY-MM)."""
        query = (
            OpenFinanceContaMap.query.join(OpenFinanceConexao)
            .filter(
                OpenFinanceConexao.usuario_id == usuario_id,
                OpenFinanceContaMap.tipo_pluggy == "CREDIT",
            )
        )
        if conta_map_id:
            query = query.filter(OpenFinanceContaMap.id == conta_map_id)
        elif forma_pagamento_id:
            query = query.filter(OpenFinanceContaMap.forma_pagamento_id == forma_pagamento_id)
        else:
            raise ValueError("Informe forma_pagamento_id ou conta_map_id.")

        conta_map = query.first()
        if not conta_map:
            raise ValueError("Cartão não encontrado ou não está vinculado a uma conexão Open Finance.")

        conexao = conta_map.conexao
        forma_pagamento = conta_map.forma_pagamento or FormaPagamento.query.get(conta_map.forma_pagamento_id)
        if not forma_pagamento:
            raise ValueError("Forma de pagamento associada não encontrada.")

        acc_id = conta_map.pluggy_account_id
        acc_type = conta_map.tipo_pluggy

        # Se mês de fatura foi especificado, parseia
        alvo_comp: Optional[date] = None
        if mes_fatura and len(mes_fatura) >= 7 and "-" in mes_fatura:
            try:
                y, m = int(mes_fatura[:4]), int(mes_fatura[5:7])
                alvo_comp = date(y, m, 1)
            except Exception:
                pass

        # Carrega/atualiza o aprendizado de categorias e histórico do usuário
        try:
            get_engine().carregar_contexto(force=True)
        except Exception as e:
            logger.warning(f"Falha ao recarregar contexto do motor de categorização: {e}")

        # Categoria padrão de fallback
        cat_outros = Categoria.query.filter_by(nome="Outros").first()
        fallback_cat_id = cat_outros.id if cat_outros else 1

        novas_transacoes = 0
        duplicadas_ignoradas = 0
        pagamentos_fatura_ignorados = 0
        fora_do_mes_ignorados = 0

        # Cache de séries de parcelas na sessão para evitar colisões
        series_cache: Dict[Any, Any] = {}

        # Busca informações do Item na Pluggy para status e data de coleta
        collected_at = None
        try:
            item_data = PluggyClient.get_item(conexao.item_id)
            conexao.status = item_data.get("status", conexao.status)
            collected_at = item_data.get("resourcesCollectedAt") or item_data.get("lastUpdatedAt")
        except Exception:
            pass

        # Define janela de busca (mínimo 90 dias, ou cobrindo o ciclo de alvo_comp se for anterior)
        data_inicio_dt = date.today() - timedelta(days=90)
        if alvo_comp:
            ciclo_alvo_inicio = alvo_comp - timedelta(days=65)
            if ciclo_alvo_inicio < data_inicio_dt:
                data_inicio_dt = ciclo_alvo_inicio
        data_inicio = data_inicio_dt.isoformat()

        tx_page = 1
        has_more = True
        all_transactions = []

        while has_more:
            tx_resp = PluggyClient.get_transactions(
                account_id=acc_id,
                from_date=data_inicio,
                page=tx_page,
                page_size=100,
            )
            page_txs = tx_resp.get("results", [])
            if not page_txs:
                break
            all_transactions.extend(page_txs)
            total_pages = tx_resp.get("totalPages", 1)
            if tx_page >= total_pages:
                has_more = False
            else:
                tx_page += 1

        bills_comp_map, max_closed_comp = cls._obter_mapa_bills(acc_id)
        # Ordena para que transações com billId oficial (faturas fechadas) e datas mais antigas
        # sejam processadas primeiro, ancorando séries de parcelamento com precisão
        all_transactions.sort(
            key=lambda t: (
                0 if (t.get("creditCardMetadata") or {}).get("billId") else 1,
                (t.get("date") or "")[:10],
            )
        )

        for tx in all_transactions:
            tx_id = str(tx.get("id"))
            desc_raw = tx.get("description") or tx.get("descriptionRaw") or "Transação Cartão Open Finance"
            raw_amount = float(tx.get("amount", 0))
            amount = abs(raw_amount)
            tx_date_str = tx.get("date", "")[:10]

            if not tx_date_str or amount == 0:
                continue

            data_tx = date.fromisoformat(tx_date_str)
            credit_meta = tx.get("creditCardMetadata") or {}
            payment_data = tx.get("paymentData") or {}

            # Descartar pagamentos de fatura
            if eh_pagamento_fatura(desc_raw) or (raw_amount < 0 and "pagamento" in desc_raw.lower()):
                pagamentos_fatura_ignorados += 1
                continue

            # Extrai informações de parcelamento
            is_parcelado, total_parcelas, parcela_atual = extrair_dados_parcelamento(desc_raw, credit_meta, payment_data)

            # Para compras à vista ou 1ª parcela, usa purchaseDate se disponível;
            # para parcelas subsequentes (> 1), mantém tx['date'] (data da parcela no ciclo da fatura)
            if not is_parcelado or parcela_atual <= 1:
                purchase_dt_str = credit_meta.get("purchaseDate") or credit_meta.get("transactionDateTime")
                if purchase_dt_str and len(purchase_dt_str) >= 10:
                    try:
                        data_tx = date.fromisoformat(purchase_dt_str[:10])
                    except Exception:
                        pass

            # 1. Se a transação possui billId oficial de uma fatura fechada da Pluggy, usa a competência oficial
            bill_id = str(credit_meta.get("billId") or "")
            competencia_fatura_calculada = None
            if bill_id and bill_id in bills_comp_map:
                competencia_fatura_calculada = bills_comp_map[bill_id]
                if is_parcelado and total_parcelas and total_parcelas > 1:
                    base_desc = re.sub(r"\s*\d{1,2}\s*[\/\-]\s*\d{1,2}.*$", "", desc_raw or "").strip().lower()
                    cache_key = (forma_pagamento.id, base_desc, round(amount, 1), total_parcelas)
                    series_cache.setdefault(cache_key, (parcela_atual, competencia_fatura_calculada))
            else:
                # 2. Caso contrário (fatura aberta/futura), usa billForecastDate ou cálculo por fechamento/vencimento
                bill_forecast = credit_meta.get("billForecastDate")
                if bill_forecast and len(bill_forecast) == 7 and bill_forecast[4] == "-":
                    try:
                        b_ano, b_mes = int(bill_forecast[:4]), int(bill_forecast[5:7])
                        competencia_fatura_calculada = date(b_ano, b_mes, 1)
                    except Exception:
                        pass

                if not competencia_fatura_calculada:
                    dia_fech = getattr(forma_pagamento, "dia_fechamento", None)
                    dia_venc = getattr(forma_pagamento, "dia_vencimento", None)
                    competencia_fatura_calculada = calcular_competencia_fatura(data_tx, dia_fech, dia_venc)

                # Se não possui billId (está na fatura aberta) mas caiu em competência de fatura já fechada, avança para a próxima fatura aberta
                if competencia_fatura_calculada and max_closed_comp and competencia_fatura_calculada <= max_closed_comp:
                    competencia_fatura_calculada = add_meses_competencia(max_closed_comp, 1)

                # Alinha parcelas da mesma série para nunca colidirem no mesmo mês de fatura
                if is_parcelado and competencia_fatura_calculada:
                    competencia_fatura_calculada = resolver_competencia_parcelada(
                        forma_pagamento_id=forma_pagamento.id,
                        desc_raw=desc_raw,
                        total_parcelas=total_parcelas,
                        parcela_atual=parcela_atual,
                        amount=amount,
                        fallback_comp=competencia_fatura_calculada,
                        series_cache=series_cache,
                    )

            # FILTRO DE MÊS SE ESPECIFICADO PELO USUÁRIO (avalia contra a competência alinhada)
            if alvo_comp and competencia_fatura_calculada != alvo_comp:
                fora_do_mes_ignorados += 1
                continue

            # Determinar tipo (Despesa / Receita)
            pluggy_type = tx.get("type", "DEBIT")
            eh_estorno = (
                raw_amount < 0
                or pluggy_type == "CREDIT"
                or any(term in desc_raw.lower() for term in ["estorno", "iof de volta", "devolucao", "devolução", "reembolso"])
            )
            tipo_transacao = "Receita" if eh_estorno else "Despesa"

            # Deduplicação por identificador_externo
            tx_existente = Transacao.query.filter_by(identificador_externo=tx_id).first()
            if tx_existente:
                if competencia_fatura_calculada and tx_existente.competencia_fatura != competencia_fatura_calculada:
                    tx_existente.competencia_fatura = competencia_fatura_calculada
                if tx_existente.data_transacao != data_tx:
                    tx_existente.data_transacao = data_tx
                if tx_existente.tipo != tipo_transacao:
                    tx_existente.tipo = tipo_transacao
                if tx_existente.valor != amount:
                    tx_existente.valor = amount
                duplicadas_ignoradas += 1
                continue

            # Deduplicação idêntica (apenas contra transações manuais/arquivos sem identificador_externo diferente)
            desc_norm = normalizar_texto(desc_raw)
            candidatos = Transacao.query.filter_by(
                forma_pagamento_id=forma_pagamento.id,
                data_transacao=data_tx,
            ).all()

            ja_existe = False
            for cand in candidatos:
                if cand.identificador_externo and cand.identificador_externo != tx_id:
                    continue
                if cand.valor is not None and abs(float(cand.valor) - amount) < 0.005:
                    if normalizar_texto(cand.descricao) == desc_norm:
                        ja_existe = True
                        cand.identificador_externo = tx_id
                        if competencia_fatura_calculada:
                            cand.competencia_fatura = competencia_fatura_calculada
                        if cand.tipo != tipo_transacao:
                            cand.tipo = tipo_transacao
                        break

            if ja_existe:
                duplicadas_ignoradas += 1
                continue

            # Classificação de categoria
            cat_result = categorizar_transacao(desc_raw)
            categoria_id = cat_result.categoria_id or fallback_cat_id

            status_tx = determinar_status_transacao_sync(
                forma_pagamento=forma_pagamento,
                conta_map=conta_map,
                competencia_fatura=competencia_fatura_calculada,
            )

            nova_tx = Transacao(
                tipo=tipo_transacao,
                categoria_id=categoria_id,
                descricao=desc_raw,
                valor=amount,
                data_transacao=data_tx,
                forma_pagamento_id=forma_pagamento.id,
                status=status_tx,
                parcelado=is_parcelado,
                total_parcelas=total_parcelas if is_parcelado else None,
                parcela_atual=parcela_atual if is_parcelado else 1,
                valor_parcela=amount if is_parcelado else None,
                recorrente=bool(is_parcelado),
                recorrencia_tipo="Parcelamento" if is_parcelado else None,
                identificador_externo=tx_id,
                competencia_fatura=competencia_fatura_calculada,
                observacoes=f"Sincronizado via Open Finance ({conexao.connector_name})",
            )
            db.session.add(nova_tx)
            novas_transacoes += 1

        # Persiste primeiro todas as transações importadas antes de sincronizar faturas oficiais
        conexao.last_sync_at = datetime.now()
        db.session.commit()

        # Sincroniza faturas oficiais fechadas do cartão
        try:
            cls.sync_faturas_oficiais(conta_map, alvo_comp=alvo_comp)
        except Exception as err_fat:
            logger.warning(f"Aviso ao sincronizar faturas oficiais: {err_fat}")

        mes_label = f"{alvo_comp.strftime('%m/%Y')}" if alvo_comp else "todas as recentes"
        return {
            "cartao_nome": forma_pagamento.nome,
            "forma_pagamento_id": forma_pagamento.id,
            "mes_fatura": mes_label,
            "mes_fatura_iso": alvo_comp.strftime("%Y-%m") if alvo_comp else None,
            "novas_transacoes": novas_transacoes,
            "duplicadas_ignoradas": duplicadas_ignoradas,
            "pagamentos_fatura_ignorados": pagamentos_fatura_ignorados,
            "fora_do_mes_ignorados": fora_do_mes_ignorados,
            "last_sync_at": conexao.last_sync_at.isoformat(),
            "resources_collected_at": collected_at,
            "connector_name": conexao.connector_name,
        }
