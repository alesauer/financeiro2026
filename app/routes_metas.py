from calendar import monthrange
from datetime import date
from dateutil.relativedelta import relativedelta
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from app import db
from app.models import Categoria, FormaPagamento, MetaOrcamento
from app.routes_relatorios import _obter_transacoes_periodo

bp_metas = Blueprint("metas", __name__)


def _calcular_dados_mes(ano: int, mes: int):
    """Calcula os valores realizados no mes/ano para despesas, investimentos, categorias e cartoes."""
    num_dias = monthrange(ano, mes)[1]
    ini_mes = date(ano, mes, 1)
    fim_mes = date(ano, mes, num_dias)

    itens = _obter_transacoes_periodo(ini_mes, fim_mes, base="data")

    receita_total = 0.0
    despesa_global = 0.0
    investimento_global = 0.0
    por_categoria = {}
    por_cartao = {}

    for tx, cat, forma, _ in itens:
        eh_cartao = bool(forma and forma.cartao_credito)
        raw_val = float(
            tx.valor_parcela
            if (tx.parcelado and tx.valor_parcela is not None)
            else (tx.valor or 0)
        )

        if eh_cartao:
            # Estornos no cartao (tipo Receita) abatem da fatura e da categoria
            val_cartao = -abs(raw_val) if tx.tipo == "Receita" else abs(raw_val)
            despesa_global += val_cartao

            if tx.categoria_id:
                por_categoria[tx.categoria_id] = por_categoria.get(tx.categoria_id, 0.0) + val_cartao

            fp_id = forma.id
            if fp_id not in por_cartao:
                por_cartao[fp_id] = {
                    "total": 0.0,
                    "parcelado_comprometido": 0.0,
                    "gastos_avulsos": 0.0,
                }
            por_cartao[fp_id]["total"] += val_cartao
            eh_parc = bool(
                tx.parcelado
                or tx.recorrencia_tipo == "Parcelamento"
                or (tx.total_parcelas and tx.total_parcelas >= 2)
            )
            if eh_parc and tx.tipo == "Despesa":
                por_cartao[fp_id]["parcelado_comprometido"] += val_cartao
            else:
                por_cartao[fp_id]["gastos_avulsos"] += val_cartao
        else:
            if tx.tipo == "Receita":
                receita_total += abs(raw_val)
            elif tx.tipo == "Despesa":
                despesa_global += abs(raw_val)
                if tx.categoria_id:
                    por_categoria[tx.categoria_id] = por_categoria.get(tx.categoria_id, 0.0) + abs(raw_val)
            elif tx.tipo == "Investimento":
                investimento_global += abs(raw_val)
                if tx.categoria_id:
                    por_categoria[tx.categoria_id] = por_categoria.get(tx.categoria_id, 0.0) + abs(raw_val)

    return {
        "receita_total": round(max(0.0, receita_total), 2),
        "despesa_global": round(max(0.0, despesa_global), 2),
        "investimento_global": round(max(0.0, investimento_global), 2),
        "por_categoria": {k: round(max(0.0, v), 2) for k, v in por_categoria.items()},
        "por_cartao": {
            k: {
                "total": round(max(0.0, v["total"]), 2),
                "parcelado_comprometido": round(max(0.0, v["parcelado_comprometido"]), 2),
                "gastos_avulsos": round(max(0.0, v["gastos_avulsos"]), 2),
            }
            for k, v in por_cartao.items()
        },
    }


def _calcular_medias_historicas(ano_ref: int, mes_ref: int, qtd_meses: int = 3):
    """Calcula a media mensal dos ultimos N meses com movimentacao anteriores ao mes_ref."""
    ref_dt = date(ano_ref, mes_ref, 1)
    historico = []
    for i in range(1, qtd_meses + 1):
        dt_ant = ref_dt - relativedelta(months=i)
        dados_m = _calcular_dados_mes(dt_ant.year, dt_ant.month)
        if (
            dados_m["despesa_global"] > 0
            or dados_m["investimento_global"] > 0
            or dados_m["receita_total"] > 0
        ):
            historico.append(dados_m)

    # Fallback: se nao houver meses anteriores (ex: Janeiro), olha ate 3 meses seguintes do mesmo ano
    if not historico:
        for i in range(0, qtd_meses):
            dt_seg = ref_dt + relativedelta(months=i)
            dados_m = _calcular_dados_mes(dt_seg.year, dt_seg.month)
            if (
                dados_m["despesa_global"] > 0
                or dados_m["investimento_global"] > 0
                or dados_m["receita_total"] > 0
            ):
                historico.append(dados_m)

    divisor = max(1, len(historico))

    media_despesa_global = round(sum(h["despesa_global"] for h in historico) / divisor, 2)
    media_invest_global = round(sum(h["investimento_global"] for h in historico) / divisor, 2)

    cat_ids = set()
    cartao_ids = set()
    for h in historico:
        cat_ids.update(h["por_categoria"].keys())
        cartao_ids.update(h["por_cartao"].keys())

    media_categorias = {}
    for cid in cat_ids:
        soma = sum(h["por_categoria"].get(cid, 0.0) for h in historico)
        media_categorias[cid] = round(soma / divisor, 2)

    media_cartoes = {}
    for fid in cartao_ids:
        soma = sum(h["por_cartao"].get(fid, {}).get("total", 0.0) for h in historico)
        media_cartoes[fid] = round(soma / divisor, 2)

    return {
        "meses_considerados": len(historico),
        "global_despesa": media_despesa_global,
        "global_investimento": media_invest_global,
        "categorias": media_categorias,
        "cartoes": media_cartoes,
    }


def _avaliar_status_despesa(percentual: float, pct_mes_decorrido: float):
    acima_do_ritmo = bool(
        0 < pct_mes_decorrido < 98 and percentual > (pct_mes_decorrido + 12.0)
    )
    if percentual >= 100.0:
        status = "estourado"
    elif percentual >= 75.0 or acima_do_ritmo:
        status = "atencao"
    else:
        status = "ok"
    return status, acima_do_ritmo


@bp_metas.route("/resumo", methods=["GET"])
@jwt_required()
def resumo_metas():
    hoje = date.today()
    ano = request.args.get("ano", type=int) or hoje.year
    mes = request.args.get("mes", type=int) or hoje.month
    if mes < 1 or mes > 12:
        return jsonify({"error": "Mes invalido (1-12)"}), 400

    dias_no_mes = monthrange(ano, mes)[1]
    if (ano, mes) == (hoje.year, hoje.month):
        dia_referencia = hoje.day
        pct_mes_decorrido = round((dia_referencia / dias_no_mes) * 100.0, 1)
    elif (ano, mes) < (hoje.year, hoje.month):
        dia_referencia = dias_no_mes
        pct_mes_decorrido = 100.0
    else:
        dia_referencia = 0
        pct_mes_decorrido = 0.0

    realizado = _calcular_dados_mes(ano, mes)
    medias = _calcular_medias_historicas(ano, mes, qtd_meses=3)

    todas_metas = MetaOrcamento.query.filter_by(ativo=True).all()

    # Separar metas padrao (mes=None, ano=None) e overrides do mes/ano solicitado
    padrao_map = {}
    override_map = {}

    for m in todas_metas:
        chave = (m.escopo, m.categoria_id or 0, m.forma_pagamento_id or 0)
        if m.mes is None and m.ano is None:
            padrao_map[chave] = m
        elif m.mes == mes and m.ano == ano:
            override_map[chave] = m

    def resolver_meta(escopo: str, cat_id: int = 0, fp_id: int = 0):
        chave = (escopo, cat_id or 0, fp_id or 0)
        m_over = override_map.get(chave)
        m_pad = padrao_map.get(chave)
        ativa = m_over or m_pad
        return {
            "ativa": ativa,
            "id": ativa.id if ativa else None,
            "valor_limite": float(ativa.valor_limite) if ativa else None,
            "valor_padrao": float(m_pad.valor_limite) if m_pad else None,
            "valor_override": float(m_over.valor_limite) if m_over else None,
            "is_override": m_over is not None,
        }

    # 1. Meta Global de Despesa
    res_global_desp = resolver_meta("global_despesa")
    meta_global_despesa = None
    if res_global_desp["valor_limite"] and res_global_desp["valor_limite"] > 0:
        lim = res_global_desp["valor_limite"]
        real = realizado["despesa_global"]
        pct = round((real / lim) * 100.0, 1)
        status, acima_ritmo = _avaliar_status_despesa(pct, pct_mes_decorrido)
        meta_global_despesa = {
            "id": res_global_desp["id"],
            "escopo": "global_despesa",
            "titulo": "Teto Global de Gastos do Mês",
            "valor_limite": lim,
            "valor_padrao": res_global_desp["valor_padrao"],
            "is_override": res_global_desp["is_override"],
            "valor_realizado": real,
            "saldo_disponivel": round(lim - real, 2),
            "percentual": pct,
            "status": status,
            "acima_do_ritmo": acima_ritmo,
            "media_3m": medias["global_despesa"],
        }

    # 2. Meta Global de Investimento / Aporte
    res_global_inv = resolver_meta("global_investimento")
    meta_global_investimento = None
    if res_global_inv["valor_limite"] and res_global_inv["valor_limite"] > 0:
        lim = res_global_inv["valor_limite"]
        real = realizado["investimento_global"]
        pct = round((real / lim) * 100.0, 1)
        status_inv = "atingida" if pct >= 100.0 else ("em_andamento" if pct >= 50.0 else "abaixo")
        meta_global_investimento = {
            "id": res_global_inv["id"],
            "escopo": "global_investimento",
            "titulo": "Meta de Aporte / Investimento",
            "valor_limite": lim,
            "valor_padrao": res_global_inv["valor_padrao"],
            "is_override": res_global_inv["is_override"],
            "valor_realizado": real,
            "faltante": round(max(0.0, lim - real), 2),
            "percentual": pct,
            "status": status_inv,
            "media_3m": medias["global_investimento"],
        }

    # 3. Categorias (Despesa)
    categorias_db = Categoria.query.filter_by(tipo="Despesa").order_by(Categoria.nome.asc()).all()
    metas_categorias = []
    catalogo_categorias = []

    for cat in categorias_db:
        res_cat = resolver_meta("categoria", cat_id=cat.id)
        real_cat = realizado["por_categoria"].get(cat.id, 0.0)
        media_cat = medias["categorias"].get(cat.id, 0.0)
        sug_10 = round(media_cat * 0.9, 0) if media_cat > 0 else 0.0

        catalogo_categorias.append({
            "categoria_id": cat.id,
            "nome": cat.nome,
            "tipo": cat.tipo,
            "meta_id": res_cat["id"],
            "valor_limite": res_cat["valor_limite"],
            "valor_padrao": res_cat["valor_padrao"],
            "valor_override": res_cat["valor_override"],
            "is_override": res_cat["is_override"],
            "valor_realizado": real_cat,
            "media_3m": media_cat,
            "sugestao_economia_10": sug_10,
        })

        if res_cat["valor_limite"] and res_cat["valor_limite"] > 0:
            lim = res_cat["valor_limite"]
            pct = round((real_cat / lim) * 100.0, 1)
            status, acima_ritmo = _avaliar_status_despesa(pct, pct_mes_decorrido)
            metas_categorias.append({
                "id": res_cat["id"],
                "escopo": "categoria",
                "categoria_id": cat.id,
                "nome": cat.nome,
                "valor_limite": lim,
                "valor_padrao": res_cat["valor_padrao"],
                "is_override": res_cat["is_override"],
                "valor_realizado": real_cat,
                "saldo_disponivel": round(lim - real_cat, 2),
                "percentual": pct,
                "status": status,
                "acima_do_ritmo": acima_ritmo,
                "media_3m": media_cat,
            })

    # Ordena metas de categorias: estouradas primeiro, depois maior percentual
    metas_categorias.sort(key=lambda x: (-1 if x["status"] == "estourado" else 0, -x["percentual"]))

    # 4. Cartoes de Credito
    cartoes_db = (
        FormaPagamento.query.filter_by(cartao_credito=True, ativo=True)
        .order_by(FormaPagamento.nome.asc())
        .all()
    )
    metas_cartoes = []
    catalogo_cartoes = []

    for fp in cartoes_db:
        res_fp = resolver_meta("cartao", fp_id=fp.id)
        dados_fp = realizado["por_cartao"].get(
            fp.id,
            {"total": 0.0, "parcelado_comprometido": 0.0, "gastos_avulsos": 0.0},
        )
        media_fp = medias["cartoes"].get(fp.id, 0.0)
        sug_fp_10 = round(media_fp * 0.9, 0) if media_fp > 0 else 0.0

        catalogo_cartoes.append({
            "forma_pagamento_id": fp.id,
            "nome": fp.nome,
            "cor": fp.cor or "#820AD1",
            "meta_id": res_fp["id"],
            "valor_limite": res_fp["valor_limite"],
            "valor_padrao": res_fp["valor_padrao"],
            "valor_override": res_fp["valor_override"],
            "is_override": res_fp["is_override"],
            "valor_realizado": dados_fp["total"],
            "parcelado_comprometido": dados_fp["parcelado_comprometido"],
            "gastos_avulsos": dados_fp["gastos_avulsos"],
            "media_3m": media_fp,
            "sugestao_economia_10": sug_fp_10,
        })

        if res_fp["valor_limite"] and res_fp["valor_limite"] > 0:
            lim = res_fp["valor_limite"]
            real_fp = dados_fp["total"]
            parc_fp = dados_fp["parcelado_comprometido"]
            avulso_fp = dados_fp["gastos_avulsos"]
            pct = round((real_fp / lim) * 100.0, 1)
            status, acima_ritmo = _avaliar_status_despesa(pct, pct_mes_decorrido)
            metas_cartoes.append({
                "id": res_fp["id"],
                "escopo": "cartao",
                "forma_pagamento_id": fp.id,
                "nome": fp.nome,
                "cor": fp.cor or "#820AD1",
                "valor_limite": lim,
                "valor_padrao": res_fp["valor_padrao"],
                "is_override": res_fp["is_override"],
                "valor_realizado": real_fp,
                "parcelado_comprometido": parc_fp,
                "gastos_avulsos": avulso_fp,
                "margem_livre": round(lim - real_fp, 2),
                "percentual": pct,
                "percentual_parcelado": round(min(100.0, (parc_fp / lim) * 100.0), 1),
                "percentual_avulso": round(min(100.0, (avulso_fp / lim) * 100.0), 1),
                "status": status,
                "acima_do_ritmo": acima_ritmo,
                "media_3m": media_fp,
            })

    # Contadores de alertas para badge na tela de Transacoes e Dashboard
    todos_itens_despesa = (
        ([meta_global_despesa] if meta_global_despesa else [])
        + metas_cartoes
        + metas_categorias
    )
    qtd_estouradas = sum(1 for i in todos_itens_despesa if i["status"] == "estourado")
    qtd_atencao = sum(1 for i in todos_itens_despesa if i["status"] == "atencao")
    qtd_ok = sum(1 for i in todos_itens_despesa if i["status"] == "ok")

    return jsonify({
        "periodo": {
            "ano": ano,
            "mes": mes,
            "dia_referencia": dia_referencia,
            "dias_no_mes": dias_no_mes,
            "percentual_mes_decorrido": pct_mes_decorrido,
        },
        "realizado_geral": {
            "receita_total": realizado["receita_total"],
            "despesa_global": realizado["despesa_global"],
            "investimento_global": realizado["investimento_global"],
        },
        "sumario_alertas": {
            "total_metas_ativas": len(todos_itens_despesa) + (1 if meta_global_investimento else 0),
            "estouradas": qtd_estouradas,
            "atencao": qtd_atencao,
            "ok": qtd_ok,
        },
        "meta_global_despesa": meta_global_despesa,
        "meta_global_investimento": meta_global_investimento,
        "metas_cartoes": metas_cartoes,
        "metas_categorias": metas_categorias,
        "catalogo": {
            "global_despesa": {
                "meta_id": res_global_desp["id"],
                "valor_limite": res_global_desp["valor_limite"],
                "valor_padrao": res_global_desp["valor_padrao"],
                "valor_override": res_global_desp["valor_override"],
                "is_override": res_global_desp["is_override"],
                "valor_realizado": realizado["despesa_global"],
                "media_3m": medias["global_despesa"],
                "sugestao_economia_10": round(medias["global_despesa"] * 0.9, 0) if medias["global_despesa"] > 0 else 0.0,
            },
            "global_investimento": {
                "meta_id": res_global_inv["id"],
                "valor_limite": res_global_inv["valor_limite"],
                "valor_padrao": res_global_inv["valor_padrao"],
                "valor_override": res_global_inv["valor_override"],
                "is_override": res_global_inv["is_override"],
                "valor_realizado": realizado["investimento_global"],
                "media_3m": medias["global_investimento"],
                "sugestao_aumento_10": round(medias["global_investimento"] * 1.1, 0) if medias["global_investimento"] > 0 else 0.0,
            },
            "cartoes": catalogo_cartoes,
            "categorias": catalogo_categorias,
        },
    }), 200


@bp_metas.route("/salvar_lote", methods=["POST"])
@jwt_required()
def salvar_metas_lote():
    """Salva ou remove um lote de metas (padrao recorrente ou excecao para mes/ano especifico)."""
    payload = request.get_json(silent=True) or {}
    itens = payload.get("itens") or []
    modo = payload.get("modo") or "padrao"  # 'padrao' | 'mes_especifico'
    mes_alvo = payload.get("mes") if modo == "mes_especifico" else None
    ano_alvo = payload.get("ano") if modo == "mes_especifico" else None

    if modo == "mes_especifico" and (not mes_alvo or not ano_alvo):
        return jsonify({"error": "Para excecao mensal, informe mes e ano."}), 400

    salvas = 0
    removidas = 0

    for item in itens:
        escopo = item.get("escopo")
        if escopo not in ("global_despesa", "global_investimento", "categoria", "cartao"):
            continue

        cat_id = item.get("categoria_id") if escopo == "categoria" else None
        fp_id = item.get("forma_pagamento_id") if escopo == "cartao" else None
        raw_val = item.get("valor_limite")
        valor = float(raw_val) if raw_val not in (None, "") else 0.0

        query = MetaOrcamento.query.filter_by(
            escopo=escopo,
            categoria_id=cat_id,
            forma_pagamento_id=fp_id,
            mes=mes_alvo,
            ano=ano_alvo,
        )
        existente = query.first()

        if valor <= 0:
            if existente:
                db.session.delete(existente)
                removidas += 1
        else:
            if existente:
                existente.valor_limite = valor
                existente.ativo = True
            else:
                nova = MetaOrcamento(
                    escopo=escopo,
                    categoria_id=cat_id,
                    forma_pagamento_id=fp_id,
                    valor_limite=valor,
                    mes=mes_alvo,
                    ano=ano_alvo,
                    ativo=True,
                )
                db.session.add(nova)
            salvas += 1

    db.session.commit()
    return jsonify({
        "message": "Metas atualizadas com sucesso!",
        "salvas": salvas,
        "removidas": removidas,
    }), 200


@bp_metas.route("/<int:meta_id>", methods=["DELETE"])
@jwt_required()
def remover_meta(meta_id: int):
    meta = MetaOrcamento.query.get_or_404(meta_id)
    db.session.delete(meta)
    db.session.commit()
    return jsonify({"message": "Meta removida com sucesso."}), 200
