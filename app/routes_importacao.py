from flask import Blueprint, request, jsonify
from app import db
from app.models import Transacao, Categoria, FormaPagamento, CategoriaAlias
from app.schemas import TransacaoSchema
from datetime import datetime
from app.utils.texto import normalizar_texto
from app.utils.datas import parse_dia_override
from services.fatura_service import aplicar_competencia_transacao
from flask_jwt_extended import jwt_required
from uuid import uuid4
from dateutil.relativedelta import relativedelta
from sqlalchemy import func
import re

bp_importacao = Blueprint("importacao", __name__)


def limpar_marcador_parcela(texto: str | None) -> str:
    if not texto:
        return ""
    limpo = re.sub(r"parc(?:ela)?\.?\s*(\(?\s*\d{1,2}\s*\/\s*\d{1,2}\s*\)?)", "", texto, flags=re.IGNORECASE)
    # Sufixo "- N/M" no fim do título (ex.: "Apple Store #R095 - 2/5")
    limpo = re.sub(r"[-\u2013]\s*\d{1,2}\s*\/\s*\d{1,2}\s*$", "", limpo)
    return limpo.strip()


def ignorar_lancamento_importacao(descricao: str | None, valor: float) -> bool:
    """Lançamentos que não representam compra: pagamento de fatura e estornos/créditos.

    Valores negativos (IOF devolvido, estornos, créditos) não podem virar despesa
    negativa — o schema de transações exige valor > 0.
    """
    if valor >= 0:
        return False
    return True


def contar_duplicatas_nao_parceladas(
    descricao_original: str,
    descricao_limpa: str,
    valor_transacao: float,
    data_transacao,
    forma_pagamento_id: int,
    tipo_transacao: str
) -> int:
    """Quantas transações idênticas já existem NO BANCO (ignora pendentes do lote).

    Usa no_autoflush para não enxergar linhas recém-adicionadas na mesma importação —
    duas cobranças iguais no mesmo dia são legítimas e devem ser importadas.
    """
    if not data_transacao or not forma_pagamento_id:
        return 0

    descricao_referencia = normalizar_texto(descricao_limpa or descricao_original)
    with db.session.no_autoflush:
        candidatos = Transacao.query.filter(
            Transacao.parcelado.is_(False),
            Transacao.forma_pagamento_id == forma_pagamento_id,
            Transacao.tipo == tipo_transacao,
            Transacao.data_transacao == data_transacao,
            Transacao.valor == valor_transacao
        ).all()

    total = 0
    for existente in candidatos:
        descricao_existente = normalizar_texto(
            limpar_marcador_parcela(existente.descricao or "")
        )
        if descricao_existente == descricao_referencia:
            total += 1

    return total


def gerar_parcelas_restantes(transacao_base: Transacao, forma_pagamento: FormaPagamento, total_parcelas: int,
                              dia_fechamento_override: int | None = None, dia_vencimento_override: int | None = None) -> int:
    if not transacao_base.parcelado or not transacao_base.data_transacao:
        return 0
    parcelas_criadas = 0
    parcela_atual = transacao_base.parcela_atual or 1
    for numero in range(parcela_atual + 1, (total_parcelas or parcela_atual) + 1):
        existe = Transacao.query.filter_by(
            parcelamento_id=transacao_base.parcelamento_id,
            parcela_atual=numero
        ).first()
        if existe:
            continue
        nova_data = transacao_base.data_transacao + relativedelta(months=numero - parcela_atual)
        nova = Transacao(
            tipo=transacao_base.tipo,
            categoria_id=transacao_base.categoria_id,
            descricao=transacao_base.descricao,
            valor=transacao_base.valor,
            data_transacao=nova_data,
            forma_pagamento_id=forma_pagamento.id,
            status="Pendente"
        )
        nova.parcelado = True
        nova.total_parcelas = total_parcelas
        nova.parcela_atual = numero
        nova.valor_parcela = transacao_base.valor_parcela or transacao_base.valor
        nova.parcelamento_id = transacao_base.parcelamento_id
        nova.recorrente = True
        nova.recorrencia_tipo = "Parcelamento"
        aplicar_competencia_transacao(
            nova,
            forma_pagamento,
            dia_fechamento_override=dia_fechamento_override,
            dia_vencimento_override=dia_vencimento_override
        )
        db.session.add(nova)
        parcelas_criadas += 1
    return parcelas_criadas

@bp_importacao.route("/importar_transacoes", methods=["POST"])
@jwt_required()
def importar_transacoes():
    data = request.get_json()
    transacoes = data.get("transacoes", [])
    forma_pagamento_id = data.get("forma_pagamento_id")
    forma_pagamento_padrao = None
    if forma_pagamento_id:
        forma_pagamento_padrao = FormaPagamento.query.get(forma_pagamento_id)
        if not forma_pagamento_padrao:
            return jsonify({"erro": "Forma de pagamento selecionada não encontrada"}), 400
    try:
        dia_fechamento_override_global = parse_dia_override(data.get("dia_fechamento_override"), "dia_fechamento_override")
        dia_vencimento_override_global = parse_dia_override(data.get("dia_vencimento_override"), "dia_vencimento_override")
    except ValueError as exc:
        return jsonify({"erro": str(exc)}), 400
    inseridas = []
    atualizadas = []
    parcelas_geradas_total = 0
    duplicadas_ignoradas = 0
    creditos_ignorados = 0
    erros = []
    # Ocorrências de linhas idênticas dentro do próprio lote (cobranças repetidas legítimas).
    ocorrencias_lote: dict = {}
    categoria_padrao = Categoria.query.filter_by(nome="Outros", tipo="Despesa").first()
    if not categoria_padrao:
        # Fallback determinístico: sem "Outros", a linha cairia na primeira categoria
        # de despesa do banco (arbitrária). Cria a categoria neutra.
        categoria_padrao = Categoria(nome="Outros", tipo="Despesa")
        db.session.add(categoria_padrao)
        db.session.flush()
    for idx, t in enumerate(transacoes):
        try:
            dia_fechamento_override = dia_fechamento_override_global
            dia_vencimento_override = dia_vencimento_override_global
            if "dia_fechamento_override" in t:
                dia_fechamento_override = parse_dia_override(
                    t.get("dia_fechamento_override"),
                    f"dia_fechamento_override (linha {idx + 1})"
                )
            if "dia_vencimento_override" in t:
                dia_vencimento_override = parse_dia_override(
                    t.get("dia_vencimento_override"),
                    f"dia_vencimento_override (linha {idx + 1})"
                )
            categoria = None
            categoria_id_payload = t.get("categoria_id")
            if categoria_id_payload:
                categoria = Categoria.query.get(int(categoria_id_payload))

            nome_categoria = (t.get("categoria") or "").strip()
            if not categoria and nome_categoria:
                categoria = Categoria.query.filter(func.lower(Categoria.nome) == nome_categoria.lower()).first()

            if not categoria and categoria_padrao:
                categoria = categoria_padrao

            if not categoria:
                categoria = Categoria.query.filter_by(tipo="Despesa").first()

            if not categoria:
                raise Exception("Nenhuma categoria de despesa disponível para associar a transação.")
            # Mapeia forma de pagamento (aqui assumimos cartão de crédito)
            fp = forma_pagamento_padrao
            if not fp:
                fp = FormaPagamento.query.filter_by(tipo="Cartão de Crédito").first()
                if not fp:
                    fp = FormaPagamento(nome="Cartão de Crédito", tipo="Cartão de Crédito", cartao_credito=True)
                    db.session.add(fp)
                    db.session.flush()

            descricao_original = t.get("title") or ""
            descricao_limpa = t.get("descricao_limpa") or limpar_marcador_parcela(descricao_original)
            try:
                valor_transacao = float(t.get("amount"))
            except (TypeError, ValueError):
                raise ValueError("Valor inválido informado para a transação.")

            if ignorar_lancamento_importacao(descricao_original, valor_transacao):
                creditos_ignorados += 1
                texto_norm = normalizar_texto(descricao_original)
                if "pagamento" in texto_norm:
                    motivo = "pagamento de fatura não é importado como compra de cartão."
                else:
                    motivo = "crédito/estorno (valor negativo) não é importado como despesa."
                erros.append({
                    "linha": idx + 1,
                    "erro": f"Transação ignorada: {motivo}"
                })
                continue

            parcelado = bool(t.get("parcelado"))
            parcela_atual = int(t.get("parcela_atual") or 1)
            total_parcelas = int(t.get("total_parcelas") or (parcela_atual if parcela_atual > 1 else 1))
            valor_parcela = float(t.get("valor_parcela")) if t.get("valor_parcela") is not None else valor_transacao
            parcelamento_id = t.get("parcelamento_id") if t.get("parcelamento_id") else (str(uuid4()) if parcelado else None)

            transacao_existente = None
            data_transacao = datetime.strptime(t.get("date"), "%Y-%m-%d").date() if t.get("date") else None
            if parcelado and parcelamento_id and parcela_atual:
                transacao_existente = Transacao.query.filter_by(
                    parcelamento_id=parcelamento_id,
                    parcela_atual=parcela_atual
                ).first()

            if not parcelado:
                chave_lote = (
                    data_transacao,
                    round(valor_transacao, 2),
                    fp.id,
                    categoria.tipo,
                    normalizar_texto(descricao_limpa or descricao_original),
                )
                vistos_no_lote = ocorrencias_lote.get(chave_lote, 0)
                existentes_no_banco = contar_duplicatas_nao_parceladas(
                    descricao_original=descricao_original,
                    descricao_limpa=descricao_limpa,
                    valor_transacao=valor_transacao,
                    data_transacao=data_transacao,
                    forma_pagamento_id=fp.id,
                    tipo_transacao=categoria.tipo
                )
                ocorrencias_lote[chave_lote] = vistos_no_lote + 1
                # Só é duplicata se o banco já cobre esta ocorrência do lote.
                if vistos_no_lote < existentes_no_banco:
                    duplicadas_ignoradas += 1
                    continue

            if transacao_existente:
                if transacao_existente.status == "Pago":
                    erros.append({
                        "linha": idx + 1,
                        "erro": "Parcela já marcada como paga anteriormente."
                    })
                    continue
                transacao = transacao_existente
                transacao.tipo = categoria.tipo
                transacao.categoria_id = categoria.id
                transacao.descricao = descricao_limpa or descricao_original
                transacao.valor = valor_transacao
                transacao.data_transacao = data_transacao
                transacao.forma_pagamento_id = fp.id
                transacao.status = "Pago"
                criou_transacao = False
            else:
                transacao = Transacao(
                    tipo=categoria.tipo,  # Usa o tipo da categoria
                    categoria_id=categoria.id,
                    descricao=descricao_limpa or descricao_original,
                    valor=valor_transacao,
                    data_transacao=data_transacao,
                    forma_pagamento_id=fp.id,
                    status="Pago"
                )
                criou_transacao = True

            if parcelado and total_parcelas > 1:
                transacao.parcelado = True
                transacao.parcela_atual = parcela_atual
                transacao.total_parcelas = total_parcelas
                transacao.valor_parcela = valor_parcela
                transacao.parcelamento_id = parcelamento_id
                transacao.recorrente = True
                transacao.recorrencia_tipo = "Parcelamento"
            else:
                transacao.parcelado = False
                transacao.parcela_atual = 1
                transacao.total_parcelas = None
                transacao.valor_parcela = None
                transacao.parcelamento_id = None
                transacao.recorrente = False
                transacao.recorrencia_tipo = None

            aplicar_competencia_transacao(
                transacao,
                fp,
                dia_fechamento_override=dia_fechamento_override,
                dia_vencimento_override=dia_vencimento_override
            )

            if criou_transacao:
                db.session.add(transacao)

            if criou_transacao and transacao.parcelado and (transacao.total_parcelas or 1) > (transacao.parcela_atual or 1):
                parcelas_geradas_total += gerar_parcelas_restantes(
                    transacao,
                    fp,
                    transacao.total_parcelas or transacao.parcela_atual,
                    dia_fechamento_override=dia_fechamento_override,
                    dia_vencimento_override=dia_vencimento_override
                )
            chave_normalizada = normalizar_texto(descricao_limpa or descricao_original)
            if chave_normalizada:
                alias = CategoriaAlias.query.filter_by(descricao_normalizada=chave_normalizada).first()
                if alias:
                    alias.categoria_id = categoria.id
                    alias.descricao_exemplo = descricao_original[:255] if descricao_original else alias.descricao_exemplo
                    alias.ocorrencias = (alias.ocorrencias or 0) + 1
                else:
                    alias = CategoriaAlias(
                        descricao_normalizada=chave_normalizada,
                        descricao_exemplo=descricao_original[:255] if descricao_original else categoria.nome,
                        categoria_id=categoria.id,
                        ocorrencias=1
                    )
                    db.session.add(alias)
            if criou_transacao:
                inseridas.append(transacao)
            else:
                atualizadas.append(transacao)
        except Exception as e:
            erros.append({"linha": idx+1, "erro": str(e)})
    if inseridas or atualizadas or parcelas_geradas_total:
        db.session.commit()
    return jsonify({
        "sucesso": len(inseridas),
        "atualizadas": len(atualizadas),
        "parcelas_geradas": parcelas_geradas_total,
        "duplicadas_ignoradas": duplicadas_ignoradas,
        "creditos_ignorados": creditos_ignorados,
        "erros": erros
    }), 200
