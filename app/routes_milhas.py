from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime, date, timedelta
from dateutil.relativedelta import relativedelta
from sqlalchemy import func, text
import uuid
from app import db
from app.models import Milha
from app.schemas import MilhaSchema

bp_milhas = Blueprint("milhas", __name__)

milha_schema = MilhaSchema()
milhas_schema = MilhaSchema(many=True)

PROGRAMAS_CONFIG = {
    "Livelo": {"cpm_estimado": 33.00, "tipo": "bancario", "cor": "#E6007E"},
    "Esfera": {"cpm_estimado": 34.00, "tipo": "bancario", "cor": "#EC0000"},
    "C6 Átomos": {"cpm_estimado": 32.00, "tipo": "bancario", "cor": "#242424"},
    "Coopera": {"cpm_estimado": 28.00, "tipo": "bancario", "cor": "#00A868"},
    "Smiles": {"cpm_estimado": 16.50, "tipo": "aereo", "cor": "#FF7020"},
    "LATAM Pass": {"cpm_estimado": 25.00, "tipo": "aereo", "cor": "#E8112D"},
    "Azul Fidelidade": {"cpm_estimado": 16.00, "tipo": "aereo", "cor": "#0080FF"},
    "TAP Miles&Go": {"cpm_estimado": 20.00, "tipo": "aereo", "cor": "#22C55E"},
    "AAdvantage": {"cpm_estimado": 75.00, "tipo": "aereo", "cor": "#0078D7"},
    "Iberia Plus": {"cpm_estimado": 65.00, "tipo": "aereo", "cor": "#D90429"},
    "Flying Blue": {"cpm_estimado": 60.00, "tipo": "aereo", "cor": "#0B2545"},
    "ALL Accor": {"cpm_estimado": 110.00, "tipo": "hotel", "cor": "#C29B38"},
}


def _assegurar_colunas_extras():
    """Garante que colunas opcionais adicionadas ao modelo existam no banco SQLite."""
    try:
        colunas = [c[1] for c in db.session.execute(text("PRAGMA table_info(milhas);")).fetchall()]
        if "categoria_origem" not in colunas:
            db.session.execute(text("ALTER TABLE milhas ADD COLUMN categoria_origem VARCHAR(50);"))
        if "custo_reais" not in colunas:
            db.session.execute(text("ALTER TABLE milhas ADD COLUMN custo_reais NUMERIC(12, 2);"))
        if "taxa_bonus" not in colunas:
            db.session.execute(text("ALTER TABLE milhas ADD COLUMN taxa_bonus NUMERIC(5, 2);"))
        if "transferencia_id" not in colunas:
            db.session.execute(text("ALTER TABLE milhas ADD COLUMN transferencia_id VARCHAR(36);"))
        db.session.commit()
    except Exception:
        db.session.rollback()


@bp_milhas.route("/", methods=["GET"])
@jwt_required()
def listar_milhas():
    _assegurar_colunas_extras()
    usuario_id = int(get_jwt_identity())
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)

    query = Milha.query.filter_by(usuario_id=usuario_id)

    programa = request.args.get("programa")
    if programa:
        query = query.filter(Milha.programa.ilike(f"%{programa.strip()}%"))

    tipo = request.args.get("tipo")
    if tipo in ["entrada", "saida"]:
        query = query.filter(Milha.tipo == tipo)

    categoria = request.args.get("categoria_origem")
    if categoria:
        query = query.filter(Milha.categoria_origem == categoria)

    inicio_str = request.args.get("inicio")
    fim_str = request.args.get("fim")
    if inicio_str:
        try:
            inicio_dt = datetime.strptime(inicio_str, "%Y-%m-%d").date()
            query = query.filter(Milha.data_movimentacao >= inicio_dt)
        except ValueError:
            pass
    if fim_str:
        try:
            fim_dt = datetime.strptime(fim_str, "%Y-%m-%d").date()
            query = query.filter(Milha.data_movimentacao <= fim_dt)
        except ValueError:
            pass

    search = request.args.get("search")
    if search:
        search_term = f"%{search.strip()}%"
        query = query.filter(
            db.or_(
                Milha.programa.ilike(search_term),
                Milha.descricao.ilike(search_term),
                Milha.origem.ilike(search_term),
                Milha.categoria_origem.ilike(search_term),
            )
        )

    sort_by = request.args.get("sort_by", "data_movimentacao")
    sort_dir = request.args.get("sort_dir", "desc").lower()

    sort_col = getattr(Milha, sort_by, Milha.data_movimentacao)
    if sort_dir == "asc":
        query = query.order_by(sort_col.asc(), Milha.id.asc())
    else:
        query = query.order_by(sort_col.desc(), Milha.id.desc())

    paginated = query.paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        "items": milhas_schema.dump(paginated.items),
        "total_items": paginated.total,
        "total_pages": paginated.pages,
        "current_page": paginated.page,
        "per_page": paginated.per_page,
        "has_next": paginated.has_next,
        "has_prev": paginated.has_prev,
    }), 200


@bp_milhas.route("/resumo", methods=["GET"])
@jwt_required()
def resumo_milhas():
    """Retorna dashboard consolidado com saldos por programa, estimativas em R$ e alertas de expiração."""
    _assegurar_colunas_extras()
    usuario_id = int(get_jwt_identity())
    hoje = date.today()

    todas = Milha.query.filter_by(usuario_id=usuario_id).order_by(Milha.data_movimentacao.asc()).all()

    saldo_total_milhas = 0
    total_entradas = 0
    total_saidas = 0
    total_gasto_reais = 0.0

    programas_map = {}
    expirando_lotes = []
    evolucao_map = {}

    for m in todas:
        prog = (m.programa or "Outro").strip()
        if prog not in programas_map:
            cfg = PROGRAMAS_CONFIG.get(prog, {"cpm_estimado": 20.00, "tipo": "outro", "cor": "#64748B"})
            programas_map[prog] = {
                "nome": prog,
                "saldo": 0,
                "entradas": 0,
                "saidas": 0,
                "gasto_total_reais": 0.0,
                "cpm_medio": None,
                "cpm_estimado": cfg["cpm_estimado"],
                "tipo_programa": cfg["tipo"],
                "cor": cfg["cor"],
                "proxima_expiracao": None,
                "qtd_expirando_proxima": 0,
                "movimentacoes_count": 0,
            }

        prog_data = programas_map[prog]
        prog_data["movimentacoes_count"] += 1
        qtd = int(m.quantidade or 0)
        custo = float(m.custo_reais or 0)

        if m.tipo == "entrada":
            prog_data["saldo"] += qtd
            prog_data["entradas"] += qtd
            saldo_total_milhas += qtd
            total_entradas += qtd
            if custo > 0:
                prog_data["gasto_total_reais"] += custo
                total_gasto_reais += custo

            # Verifica expiração para entradas futuras
            if m.data_expiracao and m.data_expiracao >= hoje:
                dias_restantes = (m.data_expiracao - hoje).days
                expirando_lotes.append({
                    "id": m.id,
                    "programa": prog,
                    "quantidade": qtd,
                    "data_expiracao": m.data_expiracao.isoformat(),
                    "dias_restantes": dias_restantes,
                    "urgencia": "critica" if dias_restantes <= 30 else ("alerta" if dias_restantes <= 90 else "normal"),
                })
        else:
            prog_data["saldo"] = max(0, prog_data["saldo"] - qtd)
            prog_data["saidas"] += qtd
            saldo_total_milhas = max(0, saldo_total_milhas - qtd)
            total_saidas += qtd

        # Histórico mensal (YYYY-MM)
        if m.data_movimentacao:
            chave_mes = m.data_movimentacao.strftime("%Y-%m")
            if chave_mes not in evolucao_map:
                evolucao_map[chave_mes] = {"mes": chave_mes, "entradas": 0, "saidas": 0}
            if m.tipo == "entrada":
                evolucao_map[chave_mes]["entradas"] += qtd
            else:
                evolucao_map[chave_mes]["saidas"] += qtd

    # Calcular CPM Médio e Valor Estimado por programa
    valor_estimado_total = 0.0
    programas_lista = []

    # Ordenar lotes por data de expiração mais próxima
    expirando_lotes.sort(key=lambda x: x["data_expiracao"])

    for p in programas_map.values():
        if p["entradas"] > 0 and p["gasto_total_reais"] > 0:
            p["cpm_medio"] = round(p["gasto_total_reais"] / (p["entradas"] / 1000.0), 2)
        
        valor_prog = round((p["saldo"] / 1000.0) * p["cpm_estimado"], 2)
        p["valor_estimado"] = valor_prog
        valor_estimado_total += valor_prog

        # Encontrar próxima expiração específica deste programa
        prox = next((l for l in expirando_lotes if l["programa"] == p["nome"]), None)
        if prox:
            p["proxima_expiracao"] = prox["data_expiracao"]
            p["qtd_expirando_proxima"] = prox["quantidade"]

        programas_lista.append(p)

    programas_lista.sort(key=lambda x: x["saldo"], reverse=True)

    # Buckets de expiração
    exp_30d = [l for l in expirando_lotes if l["dias_restantes"] <= 30]
    exp_90d = [l for l in expirando_lotes if 30 < l["dias_restantes"] <= 90]
    exp_180d = [l for l in expirando_lotes if 90 < l["dias_restantes"] <= 180]
    exp_365d = [l for l in expirando_lotes if 180 < l["dias_restantes"] <= 365]

    evolucao_lista = sorted(evolucao_map.values(), key=lambda x: x["mes"])

    return jsonify({
        "saldo_total_milhas": saldo_total_milhas,
        "valor_estimado_total": round(valor_estimado_total, 2),
        "total_entradas": total_entradas,
        "total_saidas": total_saidas,
        "total_gasto_reais": round(total_gasto_reais, 2),
        "cpm_geral_medio": round(total_gasto_reais / (total_entradas / 1000.0), 2) if total_entradas > 0 and total_gasto_reais > 0 else None,
        "programas": programas_lista,
        "expiracoes": {
            "proximos_30d": {"total": sum(l["quantidade"] for l in exp_30d), "lotes": exp_30d},
            "proximos_90d": {"total": sum(l["quantidade"] for l in exp_90d), "lotes": exp_90d},
            "proximos_180d": {"total": sum(l["quantidade"] for l in exp_180d), "lotes": exp_180d},
            "proximos_365d": {"total": sum(l["quantidade"] for l in exp_365d), "lotes": exp_365d},
            "todos": expirando_lotes[:20],
        },
        "evolucao": evolucao_lista[-12:],
        "programas_suportados": list(PROGRAMAS_CONFIG.keys()),
    }), 200


@bp_milhas.route("/", methods=["POST"])
@jwt_required()
def criar_milha():
    _assegurar_colunas_extras()
    usuario_id = int(get_jwt_identity())
    data = request.get_json() or {}
    try:
        validado = milha_schema.load(data)
    except Exception as err:
        return jsonify(getattr(err, "messages", {"error": "Dados inválidos"})), 400

    milha = Milha(
        usuario_id=usuario_id,
        programa=validado["programa"].strip(),
        tipo=validado["tipo"],
        quantidade=validado["quantidade"],
        origem=validado.get("origem"),
        categoria_origem=validado.get("categoria_origem"),
        custo_reais=validado.get("custo_reais"),
        taxa_bonus=validado.get("taxa_bonus"),
        transferencia_id=validado.get("transferencia_id"),
        data_movimentacao=validado.get("data_movimentacao") or date.today(),
        data_expiracao=validado.get("data_expiracao"),
        descricao=validado.get("descricao"),
    )
    db.session.add(milha)
    db.session.commit()
    return jsonify(milha_schema.dump(milha)), 201


@bp_milhas.route("/transferencia", methods=["POST"])
@jwt_required()
def transferencia_bonificada():
    """Registra uma transferência bonificada entre programas.
    Gera automaticamente a saída no programa de origem e a entrada no programa de destino com o bônus aplicado."""
    _assegurar_colunas_extras()
    usuario_id = int(get_jwt_identity())
    data = request.get_json() or {}

    programa_origem = (data.get("programa_origem") or "").strip()
    programa_destino = (data.get("programa_destino") or "").strip()
    quantidade_origem = int(data.get("quantidade") or 0)
    taxa_bonus = float(data.get("taxa_bonus") or 0)
    data_mov = data.get("data_movimentacao")
    data_exp = data.get("data_expiracao")
    custo_reais = data.get("custo_reais")
    observacao = (data.get("observacao") or "").strip()

    if not programa_origem or not programa_destino:
        return jsonify({"error": "Informe o programa de origem e o programa de destino."}), 400

    if programa_origem.lower() == programa_destino.lower():
        return jsonify({"error": "Programa de origem e destino devem ser diferentes."}), 400

    if quantidade_origem <= 0:
        return jsonify({"error": "Quantidade transferida deve ser maior que zero."}), 400

    if taxa_bonus < 0:
        taxa_bonus = 0.0

    try:
        data_mov_dt = datetime.strptime(data_mov, "%Y-%m-%d").date() if data_mov else date.today()
    except ValueError:
        data_mov_dt = date.today()

    try:
        data_exp_dt = datetime.strptime(data_exp, "%Y-%m-%d").date() if data_exp else None
    except ValueError:
        data_exp_dt = None

    quantidade_bonus = int(round(quantidade_origem * (taxa_bonus / 100.0)))
    quantidade_destino = quantidade_origem + quantidade_bonus
    transferencia_uuid = str(uuid.uuid4())

    bonus_txt = f" (+{taxa_bonus:.0f}% bônus)" if taxa_bonus > 0 else ""
    desc_saida = f"Transferência para {programa_destino}{bonus_txt}" + (f" - {observacao}" if observacao else "")
    desc_entrada = f"Transferência de {programa_origem}{bonus_txt}" + (f" - {observacao}" if observacao else "")

    # 1. Movimentação de Saída no Programa Origem
    saida = Milha(
        usuario_id=usuario_id,
        programa=programa_origem,
        tipo="saida",
        quantidade=quantidade_origem,
        origem=f"Transf. para {programa_destino}",
        categoria_origem="Transferência",
        transferencia_id=transferencia_uuid,
        taxa_bonus=taxa_bonus,
        data_movimentacao=data_mov_dt,
        descricao=desc_saida,
    )

    # 2. Movimentação de Entrada no Programa Destino
    entrada = Milha(
        usuario_id=usuario_id,
        programa=programa_destino,
        tipo="entrada",
        quantidade=quantidade_destino,
        origem=f"Transf. de {programa_origem}",
        categoria_origem="Transferência Bonificada" if taxa_bonus > 0 else "Transferência",
        custo_reais=float(custo_reais) if custo_reais is not None else None,
        taxa_bonus=taxa_bonus,
        transferencia_id=transferencia_uuid,
        data_movimentacao=data_mov_dt,
        data_expiracao=data_exp_dt,
        descricao=desc_entrada,
    )

    db.session.add(saida)
    db.session.add(entrada)
    db.session.commit()

    return jsonify({
        "message": f"Transferência realizada com sucesso! {quantidade_origem:,} pts ({programa_origem}) -> {quantidade_destino:,} pts ({programa_destino})",
        "transferencia_id": transferencia_uuid,
        "saida": milha_schema.dump(saida),
        "entrada": milha_schema.dump(entrada),
    }), 201


@bp_milhas.route("/<int:id>", methods=["GET"])
@jwt_required()
def obter_milha(id):
    usuario_id = int(get_jwt_identity())
    m = Milha.query.get_or_404(id)
    if m.usuario_id != usuario_id:
        return jsonify({"error": "Não autorizado"}), 403
    return jsonify(milha_schema.dump(m)), 200


@bp_milhas.route("/<int:id>", methods=["PUT"])
@jwt_required()
def atualizar_milha(id):
    usuario_id = int(get_jwt_identity())
    m = Milha.query.get_or_404(id)
    if m.usuario_id != usuario_id:
        return jsonify({"error": "Não autorizado"}), 403
    data = request.get_json() or {}
    try:
        validado = milha_schema.load(data, partial=True)
    except Exception as err:
        return jsonify(getattr(err, "messages", {"error": "Dados inválidos"})), 400

    for k, v in validado.items():
        setattr(m, k, v)
    db.session.commit()
    return jsonify(milha_schema.dump(m)), 200


@bp_milhas.route("/<int:id>", methods=["DELETE"])
@jwt_required()
def excluir_milha(id):
    usuario_id = int(get_jwt_identity())
    m = Milha.query.get_or_404(id)
    if m.usuario_id != usuario_id:
        return jsonify({"error": "Não autorizado"}), 403

    # Se for parte de uma transferência, exclui também a movimentação espelho se solicitado
    excluir_par = request.args.get("excluir_par", "false").lower() == "true"
    if excluir_par and m.transferencia_id:
        Milha.query.filter_by(usuario_id=usuario_id, transferencia_id=m.transferencia_id).delete()
    else:
        db.session.delete(m)

    db.session.commit()
    return jsonify({"message": "Movimentação de milhas excluída com sucesso"}), 200


@bp_milhas.route("/lote_delete", methods=["POST"])
@jwt_required()
def excluir_lote():
    usuario_id = int(get_jwt_identity())
    data = request.get_json() or {}
    ids = data.get("ids") or []
    if not ids:
        return jsonify({"error": "Nenhum ID fornecido."}), 400

    Milha.query.filter(Milha.usuario_id == usuario_id, Milha.id.in_(ids)).delete(synchronize_session=False)
    db.session.commit()
    return jsonify({"message": f"{len(ids)} movimentações excluídas com sucesso."}), 200
