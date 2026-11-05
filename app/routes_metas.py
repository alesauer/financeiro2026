import json
from calendar import monthrange
from datetime import date, datetime
from dateutil.relativedelta import relativedelta
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from app import db
from app.models import (
    Categoria,
    Configuracao,
    FormaPagamento,
    MetaAlertaEstado,
    MetaOrcamento,
)
from app.routes_relatorios import _obter_transacoes_periodo

bp_metas = Blueprint("metas", __name__)

MESES_NOMES = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
]

MESES_CURTOS = [
    "Jan",
    "Fev",
    "Mar",
    "Abr",
    "Mai",
    "Jun",
    "Jul",
    "Ago",
    "Set",
    "Out",
    "Nov",
    "Dez",
]

CONFIG_CHAVE_METAS = "metas_gastos_config"


def _obter_config_metas() -> dict:
    padrao = {
        "limite_atencao": 75.0,
        "limite_ultrapassada": 100.0,
        "alerta_ritmo_ativo": True,
        "tolerancia_ritmo_pct": 10.0,
        "percentuais_padrao": [50, 75, 90, 100],
    }
    cfg = Configuracao.query.filter_by(chave=CONFIG_CHAVE_METAS).first()
    if not cfg or not cfg.valor:
        return padrao
    try:
        salvo = json.loads(cfg.valor)
        if isinstance(salvo, dict):
            padrao.update(salvo)
    except Exception:
        pass
    return padrao


def _salvar_config_metas(dados: dict) -> dict:
    atual = _obter_config_metas()
    atual.update(dados)
    cfg = Configuracao.query.filter_by(chave=CONFIG_CHAVE_METAS).first()
    if not cfg:
        cfg = Configuracao(chave=CONFIG_CHAVE_METAS, valor=json.dumps(atual))
        db.session.add(cfg)
    else:
        cfg.valor = json.dumps(atual)
    db.session.commit()
    return atual


def _parse_alertas_percentuais(valor_str) -> list[int]:
    if isinstance(valor_str, list):
        nums = []
        for x in valor_str:
            try:
                v = int(float(x))
                if 1 <= v <= 200:
                    nums.append(v)
            except Exception:
                pass
        return sorted(set(nums)) or [50, 75, 90, 100]
    if not valor_str:
        return [50, 75, 90, 100]
    nums = []
    for part in str(valor_str).split(","):
        part = part.strip()
        if not part:
            continue
        try:
            v = int(float(part))
            if 1 <= v <= 200:
                nums.append(v)
        except Exception:
            pass
    return sorted(set(nums)) or [50, 75, 90, 100]


def _serializar_alertas_percentuais(lista) -> str:
    nums = _parse_alertas_percentuais(lista)
    return ",".join(str(x) for x in nums)


def _calcular_info_calendario(ano: int, mes: int) -> dict:
    hoje = date.today()
    dias_no_mes = monthrange(ano, mes)[1]
    if (ano, mes) == (hoje.year, hoje.month):
        dias_transcorridos = max(1, hoje.day)
        dias_restantes = max(0, dias_no_mes - hoje.day)
        pct_mes_decorrido = round((dias_transcorridos / dias_no_mes) * 100.0, 1)
    elif (ano, mes) < (hoje.year, hoje.month):
        dias_transcorridos = dias_no_mes
        dias_restantes = 0
        pct_mes_decorrido = 100.0
    else:
        dias_transcorridos = 0
        dias_restantes = dias_no_mes
        pct_mes_decorrido = 0.0

    return {
        "ano": ano,
        "mes": mes,
        "mes_nome": MESES_NOMES[mes - 1],
        "mes_curto": MESES_CURTOS[mes - 1],
        "dias_no_mes": dias_no_mes,
        "dias_transcorridos": dias_transcorridos,
        "dias_restantes": dias_restantes,
        "percentual_mes_decorrido": pct_mes_decorrido,
    }


def _calcular_dados_mes(ano: int, mes: int, incluir_detalhes: bool = False):
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
    txs_por_categoria = {}

    for tx, cat, forma, ref_dt in itens:
        eh_cartao = bool(forma and forma.cartao_credito)
        raw_val = float(
            tx.valor_parcela
            if (tx.parcelado and tx.valor_parcela is not None)
            else (tx.valor or 0)
        )

        if eh_cartao:
            val_cartao = -abs(raw_val) if tx.tipo == "Receita" else abs(raw_val)
            despesa_global += val_cartao

            if tx.categoria_id:
                por_categoria[tx.categoria_id] = por_categoria.get(tx.categoria_id, 0.0) + val_cartao
                if incluir_detalhes:
                    txs_por_categoria.setdefault(tx.categoria_id, []).append((tx, cat, forma, ref_dt, val_cartao))

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
                val_desp = abs(raw_val)
                despesa_global += val_desp
                if tx.categoria_id:
                    por_categoria[tx.categoria_id] = por_categoria.get(tx.categoria_id, 0.0) + val_desp
                    if incluir_detalhes:
                        txs_por_categoria.setdefault(tx.categoria_id, []).append((tx, cat, forma, ref_dt, val_desp))
            elif tx.tipo == "Investimento":
                val_inv = abs(raw_val)
                investimento_global += val_inv
                if tx.categoria_id:
                    por_categoria[tx.categoria_id] = por_categoria.get(tx.categoria_id, 0.0) + val_inv
                    if incluir_detalhes:
                        txs_por_categoria.setdefault(tx.categoria_id, []).append((tx, cat, forma, ref_dt, val_inv))

    res = {
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
    if incluir_detalhes:
        res["txs_por_categoria"] = txs_por_categoria
    return res


def _resolver_metas_categoria_mes(ano: int, mes: int) -> list[MetaOrcamento]:
    """Retorna as metas de categoria ativas que vigoram para (ano, mes), priorizando excecoes do mes."""
    todas = (
        MetaOrcamento.query.filter_by(ativo=True, escopo="categoria")
        .order_by(MetaOrcamento.id.desc())
        .all()
    )
    por_cat_especifica = {}
    por_cat_recorrente = {}

    ref_inicio_mes = date(ano, mes, 1)
    ref_fim_mes = date(ano, mes, monthrange(ano, mes)[1])

    for m in todas:
        if not m.categoria_id or float(m.valor_limite or 0) <= 0:
            continue
        if m.mes == mes and m.ano == ano:
            if m.categoria_id not in por_cat_especifica:
                por_cat_especifica[m.categoria_id] = m
        elif (m.mes is None and m.ano is None) or m.repetir_automaticamente:
            # Verifica se nao eh de outro mes especifico sem repeticao
            if m.mes is not None and m.ano is not None and not m.repetir_automaticamente:
                continue
            # Se tiver data_inicio e repetir_automaticamente=False, respeita a janela exata
            if not m.repetir_automaticamente:
                if m.data_inicio and m.data_inicio > ref_fim_mes:
                    continue
                if m.data_fim and m.data_fim < ref_inicio_mes:
                    continue
            if m.categoria_id not in por_cat_recorrente:
                por_cat_recorrente[m.categoria_id] = m

    cat_ids = sorted(set(por_cat_especifica.keys()) | set(por_cat_recorrente.keys()))
    resultado = []
    for cid in cat_ids:
        m = por_cat_especifica.get(cid) or por_cat_recorrente.get(cid)
        if m:
            resultado.append(m)
    return resultado


def _enriquecer_meta(
    meta: MetaOrcamento,
    realizado_cat: float,
    cal: dict,
    cfg: dict,
) -> dict:
    planejado = round(float(meta.valor_limite or 0), 2)
    realizado = round(max(0.0, float(realizado_cat or 0)), 2)
    saldo = round(planejado - realizado, 2)
    disponivel = round(max(0.0, saldo), 2)
    excedido = round(max(0.0, realizado - planejado), 2)
    pct = round((realizado / planejado) * 100.0, 1) if planejado > 0 else 0.0

    lim_atencao = float(cfg.get("limite_atencao", 75.0))
    lim_ultra = float(cfg.get("limite_ultrapassada", 100.0))

    if pct > lim_ultra:
        situacao = "ultrapassada"
        situacao_label = "Ultrapassada"
        status_legado = "estourado"
    elif pct >= lim_atencao:
        situacao = "atencao"
        situacao_label = "Em atenção"
        status_legado = "atencao"
    else:
        situacao = "dentro"
        situacao_label = "Dentro da meta"
        status_legado = "ok"

    dias_no_mes = cal["dias_no_mes"]
    dias_transcorridos = cal["dias_transcorridos"]
    dias_restantes = cal["dias_restantes"]
    pct_mes = cal["percentual_mes_decorrido"]

    # Calculo de projecao e ritmo de gastos
    if dias_transcorridos > 0 and pct_mes < 100.0:
        gasto_diario_medio = realizado / dias_transcorridos
        projecao_mes = round(gasto_diario_medio * dias_no_mes, 2)
    else:
        gasto_diario_medio = realizado / max(1, dias_no_mes)
        projecao_mes = realizado

    tolerancia_ritmo = float(cfg.get("tolerancia_ritmo_pct", 10.0))
    diferenca_ritmo_pct = round(pct - pct_mes, 1) if pct_mes > 0 else 0.0
    ritmo_elevado = bool(
        0 < pct_mes < 100.0
        and (pct > (pct_mes + tolerancia_ritmo) or projecao_mes > planejado * 1.05)
    )

    cat_nome = meta.categoria.nome if meta.categoria else "Sem categoria"
    nome_exibicao = (meta.nome or "").strip() or cat_nome

    ini_padrao = date(cal["ano"], cal["mes"], 1)
    fim_padrao = date(cal["ano"], cal["mes"], dias_no_mes)

    return {
        "id": meta.id,
        "nome": nome_exibicao,
        "escopo": meta.escopo,
        "categoria_id": meta.categoria_id,
        "categoria_nome": cat_nome,
        "valor_planejado": planejado,
        "valor_limite": planejado,
        "valor_realizado": realizado,
        "valor_disponivel": disponivel,
        "saldo_disponivel": saldo,
        "valor_excedido": excedido,
        "percentual_consumido": pct,
        "percentual": pct,
        "situacao": situacao,
        "situacao_label": situacao_label,
        "status": status_legado,
        "periodicidade": meta.periodicidade or "Mensal",
        "data_inicio": (meta.data_inicio or ini_padrao).isoformat(),
        "data_fim": (meta.data_fim or fim_padrao).isoformat(),
        "repetir_automaticamente": bool(
            meta.repetir_automaticamente if meta.repetir_automaticamente is not None else True
        ),
        "alertas_percentuais": _parse_alertas_percentuais(meta.alertas_percentuais),
        "dias_no_mes": dias_no_mes,
        "dias_transcorridos": dias_transcorridos,
        "dias_restantes": dias_restantes,
        "gasto_diario_medio": round(gasto_diario_medio, 2),
        "projecao_mes": projecao_mes,
        "ritmo_elevado": ritmo_elevado,
        "acima_do_ritmo": ritmo_elevado,
        "ritmo_status": "ritmo_elevado" if ritmo_elevado else "dentro_do_esperado",
        "ritmo_label": "Ritmo elevado" if ritmo_elevado else "Dentro do esperado",
        "diferenca_ritmo_pct": diferenca_ritmo_pct,
    }


# ==============================================================================
# TELA 1 (Visao Geral) & TELA 2 (Minhas Metas) — Painel Consolidado
# ==============================================================================
@bp_metas.route("/painel", methods=["GET"])
@jwt_required()
def painel_metas():
    hoje = date.today()
    ano = request.args.get("ano", type=int) or hoje.year
    mes = request.args.get("mes", type=int) or hoje.month
    situacao_filtro = (request.args.get("situacao") or "todas").lower()
    busca = (request.args.get("q") or "").strip().lower()

    if mes < 1 or mes > 12:
        return jsonify({"error": "Mês inválido (1-12)"}), 400

    cal = _calcular_info_calendario(ano, mes)
    cfg = _obter_config_metas()
    dados_mes = _calcular_dados_mes(ano, mes)

    metas_db = _resolver_metas_categoria_mes(ano, mes)
    metas_enriquecidas = [
        _enriquecer_meta(m, dados_mes["por_categoria"].get(m.categoria_id, 0.0), cal, cfg)
        for m in metas_db
    ]

    # Ordenar por maior percentual consumido primeiro
    metas_enriquecidas.sort(key=lambda x: (-x["percentual_consumido"], x["nome"].lower()))

    orcamento_total = round(sum(m["valor_planejado"] for m in metas_enriquecidas), 2)
    gasto_total = round(sum(m["valor_realizado"] for m in metas_enriquecidas), 2)
    disponivel_total = round(max(0.0, orcamento_total - gasto_total), 2)
    excedido_total = round(max(0.0, gasto_total - orcamento_total), 2)
    pct_execucao = round((gasto_total / orcamento_total) * 100.0, 1) if orcamento_total > 0 else 0.0

    qtd_dentro = sum(1 for m in metas_enriquecidas if m["situacao"] == "dentro")
    qtd_atencao = sum(1 for m in metas_enriquecidas if m["situacao"] == "atencao")
    qtd_ultrapassadas = sum(1 for m in metas_enriquecidas if m["situacao"] == "ultrapassada")

    # Filtros para a listagem (Tela 2)
    metas_filtradas = metas_enriquecidas
    if situacao_filtro in ("dentro", "atencao", "ultrapassada"):
        metas_filtradas = [m for m in metas_filtradas if m["situacao"] == situacao_filtro]
    if busca:
        metas_filtradas = [
            m
            for m in metas_filtradas
            if busca in m["nome"].lower() or busca in m["categoria_nome"].lower()
        ]

    # Evolucao dos ultimos 5-6 meses (ate o mes selecionado) para o grafico Planejado x Realizado
    ref_dt = date(ano, mes, 1)
    evolucao_mensal = []
    for i in range(4, -1, -1):
        dt_m = ref_dt - relativedelta(months=i)
        m_ano, m_mes = dt_m.year, dt_m.month
        dados_hist = dados_mes if (m_ano == ano and m_mes == mes) else _calcular_dados_mes(m_ano, m_mes)
        metas_hist = _resolver_metas_categoria_mes(m_ano, m_mes)
        if not metas_hist and metas_db:
            # Se o usuario acabou de criar metas recorrentes, projeta o orcamento planejado atual para comparacao
            metas_hist = metas_db
        plan_m = round(sum(float(x.valor_limite or 0) for x in metas_hist), 2)
        real_m = round(
            sum(dados_hist["por_categoria"].get(x.categoria_id, 0.0) for x in metas_hist),
            2,
        )
        evolucao_mensal.append({
            "ano": m_ano,
            "mes": m_mes,
            "rotulo": MESES_CURTOS[m_mes - 1],
            "planejado": plan_m,
            "realizado": real_m,
        })

    return jsonify({
        "periodo": cal,
        "configuracao": cfg,
        "indicadores": {
            "orcamento_total": orcamento_total,
            "gasto_total": gasto_total,
            "disponivel_total": disponivel_total,
            "excedido_total": excedido_total,
            "percentual_execucao": pct_execucao,
            "percentual_disponivel": round(max(0.0, 100.0 - min(100.0, pct_execucao)), 1),
            "total_metas": len(metas_enriquecidas),
            "metas_dentro": qtd_dentro,
            "metas_atencao": qtd_atencao,
            "metas_ultrapassadas": qtd_ultrapassadas,
            "metas_em_atencao_total": qtd_atencao + qtd_ultrapassadas,
        },
        "evolucao_mensal": evolucao_mensal,
        "metas": metas_enriquecidas,
        "metas_filtradas": metas_filtradas,
    }), 200


# ==============================================================================
# TELA 3 — Criar, Obter, Editar e Excluir Meta Individual
# ==============================================================================
@bp_metas.route("", methods=["POST"])
@jwt_required()
def criar_meta():
    data = request.get_json(silent=True) or {}
    nome = (data.get("nome") or "").strip()
    categoria_id = data.get("categoria_id")
    valor_raw = data.get("valor_limite") if "valor_limite" in data else data.get("valor_planejado")
    periodicidade = (data.get("periodicidade") or "Mensal").strip()
    repetir = bool(data.get("repetir_automaticamente", True))
    alertas_pct = _serializar_alertas_percentuais(data.get("alertas_percentuais"))

    try:
        categoria_id = int(categoria_id)
    except (TypeError, ValueError):
        return jsonify({"error": "Selecione uma categoria financeira válida."}), 400

    categoria = db.session.get(Categoria, categoria_id)
    if not categoria:
        return jsonify({"error": "Categoria selecionada não encontrada."}), 400

    try:
        valor_limite = float(valor_raw)
    except (TypeError, ValueError):
        return jsonify({"error": "Informe um valor máximo permitido válido."}), 400

    if valor_limite <= 0:
        return jsonify({"error": "O valor máximo permitido deve ser maior que zero."}), 400

    if not nome:
        nome = categoria.nome

    data_inicio = None
    data_fim = None
    if data.get("data_inicio"):
        try:
            data_inicio = datetime.strptime(str(data["data_inicio"])[:10], "%Y-%m-%d").date()
        except ValueError:
            return jsonify({"error": "Data inicial inválida (use YYYY-MM-DD)."}), 400

    if data.get("data_fim"):
        try:
            data_fim = datetime.strptime(str(data["data_fim"])[:10], "%Y-%m-%d").date()
        except ValueError:
            return jsonify({"error": "Data final inválida (use YYYY-MM-DD)."}), 400

    if data_inicio and data_fim and data_fim < data_inicio:
        return jsonify({"error": "A data final não pode ser anterior à data inicial."}), 400

    mes_alvo = None
    ano_alvo = None
    if not repetir and data_inicio:
        mes_alvo = data_inicio.month
        ano_alvo = data_inicio.year

    # Se ja existir uma meta ativa para a mesma categoria e mesmo escopo de repeticao, atualiza
    existente = MetaOrcamento.query.filter_by(
        escopo="categoria",
        categoria_id=categoria_id,
        mes=mes_alvo,
        ano=ano_alvo,
    ).first()

    if existente:
        existente.nome = nome
        existente.valor_limite = valor_limite
        existente.periodicidade = periodicidade
        existente.data_inicio = data_inicio
        existente.data_fim = data_fim
        existente.repetir_automaticamente = repetir
        existente.alertas_percentuais = alertas_pct
        existente.ativo = True
        meta_obj = existente
    else:
        meta_obj = MetaOrcamento(
            nome=nome,
            escopo="categoria",
            categoria_id=categoria_id,
            valor_limite=valor_limite,
            periodicidade=periodicidade,
            data_inicio=data_inicio,
            data_fim=data_fim,
            repetir_automaticamente=repetir,
            alertas_percentuais=alertas_pct,
            mes=mes_alvo,
            ano=ano_alvo,
            ativo=True,
        )
        db.session.add(meta_obj)

    db.session.commit()
    hoje = date.today()
    cal = _calcular_info_calendario(data_inicio.year if data_inicio else hoje.year, data_inicio.month if data_inicio else hoje.month)
    cfg = _obter_config_metas()
    dados_mes = _calcular_dados_mes(cal["ano"], cal["mes"])
    return jsonify(_enriquecer_meta(meta_obj, dados_mes["por_categoria"].get(categoria_id, 0.0), cal, cfg)), 201


@bp_metas.route("/<int:meta_id>", methods=["GET"])
@jwt_required()
def obter_meta(meta_id: int):
    meta = MetaOrcamento.query.get_or_404(meta_id)
    hoje = date.today()
    ano = request.args.get("ano", type=int) or (meta.ano or hoje.year)
    mes = request.args.get("mes", type=int) or (meta.mes or hoje.month)
    cal = _calcular_info_calendario(ano, mes)
    cfg = _obter_config_metas()
    dados_mes = _calcular_dados_mes(ano, mes)
    real = dados_mes["por_categoria"].get(meta.categoria_id, 0.0) if meta.categoria_id else 0.0
    return jsonify(_enriquecer_meta(meta, real, cal, cfg)), 200


@bp_metas.route("/<int:meta_id>", methods=["PUT"])
@jwt_required()
def atualizar_meta(meta_id: int):
    meta = MetaOrcamento.query.get_or_404(meta_id)
    data = request.get_json(silent=True) or {}

    if "categoria_id" in data and data["categoria_id"] is not None:
        try:
            cid = int(data["categoria_id"])
        except (TypeError, ValueError):
            return jsonify({"error": "Categoria inválida."}), 400
        cat = db.session.get(Categoria, cid)
        if not cat:
            return jsonify({"error": "Categoria não encontrada."}), 400
        meta.categoria_id = cid

    if "valor_limite" in data or "valor_planejado" in data:
        raw_v = data.get("valor_limite") if "valor_limite" in data else data.get("valor_planejado")
        try:
            val = float(raw_v)
        except (TypeError, ValueError):
            return jsonify({"error": "Valor máximo permitido inválido."}), 400
        if val <= 0:
            return jsonify({"error": "O valor máximo permitido deve ser maior que zero."}), 400
        meta.valor_limite = val

    if "nome" in data:
        nome_str = (data.get("nome") or "").strip()
        meta.nome = nome_str or (meta.categoria.nome if meta.categoria else "Meta")

    if "periodicidade" in data and data["periodicidade"]:
        meta.periodicidade = str(data["periodicidade"]).strip()

    if "data_inicio" in data:
        if data["data_inicio"]:
            try:
                meta.data_inicio = datetime.strptime(str(data["data_inicio"])[:10], "%Y-%m-%d").date()
            except ValueError:
                return jsonify({"error": "Data inicial inválida."}), 400
        else:
            meta.data_inicio = None

    if "data_fim" in data:
        if data["data_fim"]:
            try:
                meta.data_fim = datetime.strptime(str(data["data_fim"])[:10], "%Y-%m-%d").date()
            except ValueError:
                return jsonify({"error": "Data final inválida."}), 400
        else:
            meta.data_fim = None

    if meta.data_inicio and meta.data_fim and meta.data_fim < meta.data_inicio:
        return jsonify({"error": "A data final não pode ser anterior à data inicial."}), 400

    if "repetir_automaticamente" in data:
        meta.repetir_automaticamente = bool(data["repetir_automaticamente"])
        if meta.repetir_automaticamente:
            meta.mes = None
            meta.ano = None
        elif meta.data_inicio:
            meta.mes = meta.data_inicio.month
            meta.ano = meta.data_inicio.year

    if "alertas_percentuais" in data:
        meta.alertas_percentuais = _serializar_alertas_percentuais(data["alertas_percentuais"])

    db.session.commit()
    hoje = date.today()
    cal = _calcular_info_calendario(hoje.year, hoje.month)
    cfg = _obter_config_metas()
    dados_mes = _calcular_dados_mes(hoje.year, hoje.month)
    real = dados_mes["por_categoria"].get(meta.categoria_id, 0.0) if meta.categoria_id else 0.0
    return jsonify(_enriquecer_meta(meta, real, cal, cfg)), 200


@bp_metas.route("/<int:meta_id>", methods=["DELETE"])
@jwt_required()
def remover_meta(meta_id: int):
    meta = MetaOrcamento.query.get_or_404(meta_id)
    db.session.delete(meta)
    db.session.commit()
    return jsonify({"message": "Meta removida com sucesso."}), 200


# ==============================================================================
# TELA 4 — Detalhamento da Meta (Evolucao Diaria, Projecao, Lancamentos)
# ==============================================================================
@bp_metas.route("/<int:meta_id>/detalhe", methods=["GET"])
@jwt_required()
def detalhe_meta(meta_id: int):
    meta = MetaOrcamento.query.get_or_404(meta_id)
    hoje = date.today()
    ano = request.args.get("ano", type=int) or (meta.ano or hoje.year)
    mes = request.args.get("mes", type=int) or (meta.mes or hoje.month)

    if mes < 1 or mes > 12:
        return jsonify({"error": "Mês inválido (1-12)"}), 400

    cal = _calcular_info_calendario(ano, mes)
    cfg = _obter_config_metas()
    dados_mes = _calcular_dados_mes(ano, mes, incluir_detalhes=True)

    cat_id = meta.categoria_id
    realizado_cat = dados_mes["por_categoria"].get(cat_id, 0.0) if cat_id else 0.0
    meta_info = _enriquecer_meta(meta, realizado_cat, cal, cfg)

    txs_tuplas = dados_mes.get("txs_por_categoria", {}).get(cat_id, []) if cat_id else []

    # Evolucao diaria acumulada no mes
    dias_no_mes = cal["dias_no_mes"]
    gastos_por_dia = [0.0] * dias_no_mes
    lancamentos = []

    for tx, cat, forma, ref_dt, val_efetivo in txs_tuplas:
        # Para a curva diaria na categoria, usa o dia da compra se estiver no mesmo mes, senao o dia de referencia
        dia_grafico = (
            tx.data_transacao.day
            if (tx.data_transacao and tx.data_transacao.year == ano and tx.data_transacao.month == mes)
            else ref_dt.day
        )
        idx = max(0, min(dias_no_mes - 1, dia_grafico - 1))
        gastos_por_dia[idx] += val_efetivo

        lancamentos.append({
            "id": tx.id,
            "descricao": tx.descricao,
            "valor": round(val_efetivo, 2),
            "data_transacao": tx.data_transacao.isoformat() if tx.data_transacao else ref_dt.isoformat(),
            "data_referencia": ref_dt.isoformat(),
            "forma_pagamento_id": tx.forma_pagamento_id,
            "forma_pagamento_nome": forma.nome if forma else "Conta",
            "cartao_credito": bool(forma and forma.cartao_credito),
            "parcelado": bool(tx.parcelado),
            "parcela_atual": tx.parcela_atual,
            "total_parcelas": tx.total_parcelas,
            "status": tx.status,
        })

    # Ordena lancamentos do mais recente para o mais antigo
    lancamentos.sort(key=lambda x: (x["data_transacao"], x["id"]), reverse=True)

    evolucao_diaria = []
    acumulado = 0.0
    dia_limite_curva = cal["dias_transcorridos"] if (ano, mes) == (hoje.year, hoje.month) else dias_no_mes

    for d in range(1, dias_no_mes + 1):
        gasto_d = round(gastos_por_dia[d - 1], 2)
        acumulado = round(acumulado + gasto_d, 2)
        dt_iso = date(ano, mes, d).isoformat()
        rotulo_curto = f"{d:02d}/{MESES_CURTOS[mes - 1].lower()}"
        evolucao_diaria.append({
            "dia": d,
            "data": dt_iso,
            "rotulo": rotulo_curto,
            "gasto_dia": gasto_d,
            "gasto_acumulado": acumulado if (d <= dia_limite_curva or gasto_d > 0 or acumulado > 0) else None,
            "meta": meta_info["valor_planejado"],
        })

    return jsonify({
        "periodo": cal,
        "meta": meta_info,
        "evolucao_diaria": evolucao_diaria,
        "lancamentos": lancamentos,
    }), 200


# ==============================================================================
# TELA 5 — Analises (Planejado x Realizado, Evolucao, Tendencia, Comparativo)
# ==============================================================================
@bp_metas.route("/analises", methods=["GET"])
@jwt_required()
def analises_metas():
    hoje = date.today()
    ano = request.args.get("ano", type=int) or hoje.year
    mes = request.args.get("mes", type=int) or hoje.month
    if mes < 1 or mes > 12:
        return jsonify({"error": "Mês inválido (1-12)"}), 400

    cal = _calcular_info_calendario(ano, mes)
    cfg = _obter_config_metas()
    dados_atual = _calcular_dados_mes(ano, mes)
    metas_atuais = _resolver_metas_categoria_mes(ano, mes)

    # 1. Aba: Planejado x Realizado por Categoria no mes selecionado
    planejado_vs_realizado = []
    for m in metas_atuais:
        info = _enriquecer_meta(m, dados_atual["por_categoria"].get(m.categoria_id, 0.0), cal, cfg)
        nome_curto = info["nome"] if len(info["nome"]) <= 12 else info["nome"][:10] + "."
        planejado_vs_realizado.append({
            "meta_id": info["id"],
            "categoria_id": info["categoria_id"],
            "nome": info["nome"],
            "nome_curto": nome_curto,
            "planejado": info["valor_planejado"],
            "realizado": info["valor_realizado"],
            "variacao": round(info["valor_planejado"] - info["valor_realizado"], 2),
            "percentual": info["percentual_consumido"],
            "situacao": info["situacao"],
        })

    total_planejado = round(sum(x["planejado"] for x in planejado_vs_realizado), 2)
    total_realizado = round(sum(x["realizado"] for x in planejado_vs_realizado), 2)
    variacao_total = round(total_planejado - total_realizado, 2)
    execucao_pct = round((total_realizado / total_planejado) * 100.0, 1) if total_planejado > 0 else 0.0

    # Historico dos ultimos 12 meses ate (ano, mes) para Tendencia e Evolucao por Categoria
    ref_dt = date(ano, mes, 1)
    historico_12m = []
    for i in range(11, -1, -1):
        dt_m = ref_dt - relativedelta(months=i)
        m_ano, m_mes = dt_m.year, dt_m.month
        d_m = dados_atual if (m_ano == ano and m_mes == mes) else _calcular_dados_mes(m_ano, m_mes)
        metas_m = _resolver_metas_categoria_mes(m_ano, m_mes) or metas_atuais
        plan_m = round(sum(float(x.valor_limite or 0) for x in metas_m), 2)
        real_metas_m = round(sum(d_m["por_categoria"].get(x.categoria_id, 0.0) for x in metas_m), 2)
        historico_12m.append({
            "ano": m_ano,
            "mes": m_mes,
            "rotulo": f"{MESES_CURTOS[m_mes - 1]}/{str(m_ano)[2:]}",
            "rotulo_curto": MESES_CURTOS[m_mes - 1],
            "planejado": plan_m,
            "realizado": real_metas_m if metas_m else d_m["despesa_global"],
            "despesa_total_sistema": d_m["despesa_global"],
            "por_categoria": d_m["por_categoria"],
        })

    # 2. Aba: Evolucao por Categoria (ultimos 6 meses das principais categorias com meta ou maior gasto)
    ultimos_6m = historico_12m[-6:]
    top_cats_meta = planejado_vs_realizado[:6]
    evolucao_categorias_series = []
    for h in ultimos_6m:
        ponto = {"rotulo": h["rotulo"]}
        for item in top_cats_meta:
            ponto[item["nome"]] = round(h["por_categoria"].get(item["categoria_id"], 0.0), 2)
        evolucao_categorias_series.append(ponto)

    # 3. Aba: Tendencia de Gastos (12 meses com media movel 3m)
    tendencia_12m = []
    for idx, h in enumerate(historico_12m):
        janela = historico_12m[max(0, idx - 2) : idx + 1]
        media_movel = round(sum(x["realizado"] for x in janela) / max(1, len(janela)), 2)
        tendencia_12m.append({
            "rotulo": h["rotulo"],
            "planejado": h["planejado"],
            "realizado": h["realizado"],
            "media_movel_3m": media_movel,
            "execucao_pct": round((h["realizado"] / h["planejado"]) * 100.0, 1) if h["planejado"] > 0 else 0.0,
        })

    # 4. Aba: Comparativo Mensal (Mes Atual vs Mes Anterior vs Media 6m por Categoria)
    dados_mes_ant = historico_12m[-2]["por_categoria"] if len(historico_12m) >= 2 else {}
    comparativo_mensal = []
    for item in planejado_vs_realizado:
        cid = item["categoria_id"]
        atual_v = item["realizado"]
        ant_v = round(dados_mes_ant.get(cid, 0.0), 2)
        media_6_v = round(
            sum(x["por_categoria"].get(cid, 0.0) for x in ultimos_6m) / max(1, len(ultimos_6m)),
            2,
        )
        var_pct = round(((atual_v - ant_v) / ant_v) * 100.0, 1) if ant_v > 0 else (100.0 if atual_v > 0 else 0.0)
        comparativo_mensal.append({
            "meta_id": item["meta_id"],
            "categoria_id": cid,
            "nome": item["nome"],
            "nome_curto": item["nome_curto"],
            "planejado": item["planejado"],
            "mes_anterior": ant_v,
            "mes_atual": atual_v,
            "media_6m": media_6_v,
            "variacao_mensal_pct": var_pct,
        })

    return jsonify({
        "periodo": cal,
        "resumo_periodo": {
            "total_planejado": total_planejado,
            "total_realizado": total_realizado,
            "variacao": variacao_total,
            "execucao_orcamento_pct": execucao_pct,
        },
        "planejado_vs_realizado": planejado_vs_realizado,
        "evolucao_por_categoria": {
            "categorias": [x["nome"] for x in top_cats_meta],
            "series": evolucao_categorias_series,
        },
        "tendencia_12m": tendencia_12m,
        "comparativo_mensal": comparativo_mensal,
    }), 200


# ==============================================================================
# TELA 6 — Alertas (Ativos, Historico e Configuracoes)
# ==============================================================================
@bp_metas.route("/alertas", methods=["GET"])
@jwt_required()
def listar_alertas():
    hoje = date.today()
    ano = request.args.get("ano", type=int) or hoje.year
    mes = request.args.get("mes", type=int) or hoje.month
    if mes < 1 or mes > 12:
        return jsonify({"error": "Mês inválido (1-12)"}), 400

    cal = _calcular_info_calendario(ano, mes)
    cfg = _obter_config_metas()
    dados_mes = _calcular_dados_mes(ano, mes)
    metas_db = _resolver_metas_categoria_mes(ano, mes)

    estados_db = {e.chave_alerta: e for e in MetaAlertaEstado.query.all()}
    alertas_gerados = []

    for m in metas_db:
        info = _enriquecer_meta(m, dados_mes["por_categoria"].get(m.categoria_id, 0.0), cal, cfg)
        pct = info["percentual_consumido"]
        gatilhos = info["alertas_percentuais"]

        # 1. Meta ultrapassada (> 100%)
        if info["situacao"] == "ultrapassada":
            chave = f"ultrapassada:{m.id}:{ano}-{mes:02d}"
            est = estados_db.get(chave)
            alertas_gerados.append({
                "chave": chave,
                "meta_id": m.id,
                "meta_nome": info["nome"],
                "categoria_nome": info["categoria_nome"],
                "tipo": "meta_ultrapassada",
                "severidade": "critica",
                "titulo": "Meta ultrapassada",
                "mensagem": f"{info['nome']} excedeu o limite em R$ {info['valor_excedido']:,.2f} ({pct:.0f}%).".replace(",", "X").replace(".", ",").replace("X", "."),
                "data_hora": (est.created_at if est and est.created_at else datetime.now()).strftime("Hoje, %H:%M"),
                "acao_tipo": "ver_meta",
                "acao_label": "Ver meta",
                "lido": bool(est.lido) if est else False,
            })
        # 2. Meta em atencao (>= 75% ou gatilho atingido entre 50% e 100%)
        elif info["situacao"] == "atencao" or any(pct >= g for g in gatilhos if g >= 50):
            chave = f"atencao:{m.id}:{ano}-{mes:02d}"
            est = estados_db.get(chave)
            alertas_gerados.append({
                "chave": chave,
                "meta_id": m.id,
                "meta_nome": info["nome"],
                "categoria_nome": info["categoria_nome"],
                "tipo": "meta_atencao",
                "severidade": "aviso",
                "titulo": "Meta em atenção",
                "mensagem": f"{info['nome']} atingiu {pct:.0f}% do limite (R$ {info['valor_realizado']:,.2f} de R$ {info['valor_planejado']:,.2f}).".replace(",", "X").replace(".", ",").replace("X", "."),
                "data_hora": (est.created_at if est and est.created_at else datetime.now()).strftime("Hoje, %H:%M"),
                "acao_tipo": "ver_meta",
                "acao_label": "Ver meta",
                "lido": bool(est.lido) if est else False,
            })

        # 3. Ritmo de gasto elevado
        if cfg.get("alerta_ritmo_ativo", True) and info["ritmo_elevado"] and info["situacao"] != "ultrapassada":
            chave = f"ritmo:{m.id}:{ano}-{mes:02d}"
            est = estados_db.get(chave)
            dif = max(1.0, info["diferenca_ritmo_pct"])
            alertas_gerados.append({
                "chave": chave,
                "meta_id": m.id,
                "meta_nome": info["nome"],
                "categoria_nome": info["categoria_nome"],
                "tipo": "ritmo_elevado",
                "severidade": "info",
                "titulo": "Ritmo de gasto elevado",
                "mensagem": f"A meta {info['nome']} está {dif:.0f}% acima do ritmo ideal para o mês.",
                "data_hora": (est.created_at if est and est.created_at else datetime.now()).strftime("Hoje, %H:%M"),
                "acao_tipo": "ver_analise",
                "acao_label": "Ver análise",
                "lido": bool(est.lido) if est else False,
            })

        # 4. Meta concluida dentro do planejado (quando o mes ja encerrou e ficou dentro da meta)
        if cal["dias_restantes"] == 0 and (ano, mes) < (hoje.year, hoje.month) and info["situacao"] == "dentro":
            chave = f"concluida:{m.id}:{ano}-{mes:02d}"
            est = estados_db.get(chave)
            alertas_gerados.append({
                "chave": chave,
                "meta_id": m.id,
                "meta_nome": info["nome"],
                "categoria_nome": info["categoria_nome"],
                "tipo": "meta_concluida",
                "severidade": "sucesso",
                "titulo": "Meta concluída com sucesso",
                "mensagem": f"{info['nome']} encerrou o período dentro do orçamento ({pct:.0f}% utilizado).",
                "data_hora": f"{cal['dias_no_mes']:02d}/{mes:02d}/{ano}",
                "acao_tipo": "ver_meta",
                "acao_label": "Ver meta",
                "lido": bool(est.lido) if est else False,
            })

    ativos = [a for a in alertas_gerados if not a["lido"]]
    historico = [a for a in alertas_gerados if a["lido"]]

    return jsonify({
        "periodo": cal,
        "ativos": ativos,
        "historico": historico,
        "configuracoes": cfg,
    }), 200


@bp_metas.route("/alertas/ler", methods=["POST"])
@jwt_required()
def marcar_alerta_lido():
    data = request.get_json(silent=True) or {}
    chaves = data.get("chaves") or []
    if data.get("chave"):
        chaves.append(data["chave"])
    lido_flag = bool(data.get("lido", True))

    atualizados = 0
    for ch in chaves:
        ch_str = str(ch).strip()
        if not ch_str:
            continue
        est = MetaAlertaEstado.query.filter_by(chave_alerta=ch_str).first()
        if not est:
            est = MetaAlertaEstado(
                chave_alerta=ch_str,
                meta_id=data.get("meta_id"),
                tipo_alerta=data.get("tipo") or "alerta",
                titulo=data.get("titulo") or "Alerta de Meta",
                mensagem=data.get("mensagem") or "",
                lido=lido_flag,
                lido_em=datetime.now() if lido_flag else None,
            )
            db.session.add(est)
        else:
            est.lido = lido_flag
            est.lido_em = datetime.now() if lido_flag else None
        atualizados += 1

    db.session.commit()
    return jsonify({"message": "Alertas atualizados.", "atualizados": atualizados}), 200


@bp_metas.route("/alertas/config", methods=["PUT"])
@jwt_required()
def atualizar_config_alertas():
    data = request.get_json(silent=True) or {}
    novo = {}
    if "limite_atencao" in data:
        try:
            v = float(data["limite_atencao"])
            if 10 <= v <= 99:
                novo["limite_atencao"] = v
        except (TypeError, ValueError):
            pass
    if "limite_ultrapassada" in data:
        try:
            v = float(data["limite_ultrapassada"])
            if 50 <= v <= 200:
                novo["limite_ultrapassada"] = v
        except (TypeError, ValueError):
            pass
    if "alerta_ritmo_ativo" in data:
        novo["alerta_ritmo_ativo"] = bool(data["alerta_ritmo_ativo"])
    if "tolerancia_ritmo_pct" in data:
        try:
            v = float(data["tolerancia_ritmo_pct"])
            if 1 <= v <= 50:
                novo["tolerancia_ritmo_pct"] = v
        except (TypeError, ValueError):
            pass
    if "percentuais_padrao" in data:
        novo["percentuais_padrao"] = _parse_alertas_percentuais(data["percentuais_padrao"])

    salvo = _salvar_config_metas(novo)
    return jsonify(salvo), 200


# ==============================================================================
# Endpoints de compatibilidade com Resumo Rápido / Lote
# ==============================================================================
def _calcular_medias_historicas(ano_ref: int, mes_ref: int, qtd_meses: int = 3):
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

    media_categorias = {
        cid: round(sum(h["por_categoria"].get(cid, 0.0) for h in historico) / divisor, 2)
        for cid in cat_ids
    }
    media_cartoes = {
        fid: round(sum(h["por_cartao"].get(fid, {}).get("total", 0.0) for h in historico) / divisor, 2)
        for fid in cartao_ids
    }

    return {
        "meses_considerados": len(historico),
        "global_despesa": media_despesa_global,
        "global_investimento": media_invest_global,
        "categorias": media_categorias,
        "cartoes": media_cartoes,
    }


def _avaliar_status_despesa(percentual: float, pct_mes_decorrido: float):
    acima_do_ritmo = bool(0 < pct_mes_decorrido < 98 and percentual > (pct_mes_decorrido + 12.0))
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

    cal = _calcular_info_calendario(ano, mes)
    pct_mes_decorrido = cal["percentual_mes_decorrido"]

    realizado = _calcular_dados_mes(ano, mes)
    medias = _calcular_medias_historicas(ano, mes, qtd_meses=3)

    todas_metas = MetaOrcamento.query.filter_by(ativo=True).all()
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

    metas_categorias.sort(key=lambda x: (-1 if x["status"] == "estourado" else 0, -x["percentual"]))

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
            "dia_referencia": cal["dias_transcorridos"],
            "dias_no_mes": cal["dias_no_mes"],
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
    payload = request.get_json(silent=True) or {}
    itens = payload.get("itens") or []
    modo = payload.get("modo") or "padrao"
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
                cat_obj = db.session.get(Categoria, cat_id) if cat_id else None
                nova = MetaOrcamento(
                    nome=cat_obj.nome if cat_obj else None,
                    escopo=escopo,
                    categoria_id=cat_id,
                    forma_pagamento_id=fp_id,
                    valor_limite=valor,
                    periodicidade="Mensal",
                    repetir_automaticamente=(modo == "padrao"),
                    alertas_percentuais="50,75,90,100",
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
