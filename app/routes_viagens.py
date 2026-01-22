import csv
import io
import os
import shutil
import uuid
from decimal import Decimal

from flask import Blueprint, jsonify, request, send_file
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy import func, or_
from werkzeug.utils import secure_filename
from fpdf import FPDF

from app import db
from app.models import Viagem, ViagemCusto, ViagemCustoAnexo
from app.schemas import (
    ViagemSchema,
    ViagemCustoSchema,
    ViagemCustoAnexoSchema,
)

bp_viagens = Blueprint("viagens", __name__)

viagem_schema = ViagemSchema()
viagens_list_schema = ViagemSchema(many=True, exclude=("custos",))
custo_schema = ViagemCustoSchema()
custos_schema = ViagemCustoSchema(many=True)
anexo_schema = ViagemCustoAnexoSchema()
anexos_schema = ViagemCustoAnexoSchema(many=True)

ALLOWED_UPLOAD_MIME = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
}
MAX_FILES_PER_COST = 5

UPLOAD_ROOT = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads", "viagens")
os.makedirs(UPLOAD_ROOT, exist_ok=True)

STATUS_NORMALIZER = {
    "planejada": "Planejada",
    "em andamento": "Em andamento",
    "em_andamento": "Em andamento",
    "emandamento": "Em andamento",
    "finalizada": "Finalizada",
    "concluida": "Finalizada",
    "concluída": "Finalizada",
    "cancelada": "Cancelada",
}

TIPO_CUSTO_NORMALIZER = {
    "transporte": "Transporte",
    "hospedagem": "Hospedagem",
    "alimentacao": "Alimentação",
    "alimentação": "Alimentação",
    "passeios": "Passeios",
    "outros": "Outros",
}


def _current_user_id() -> int:
    return int(get_jwt_identity())


def _normalize(values_str: str, mapping: dict) -> list:
    if not values_str:
        return []
    normalized = []
    for raw in values_str.split(","):
        key = raw.strip().lower()
        if not key:
            continue
        normalized_value = mapping.get(key)
        if normalized_value:
            normalized.append(normalized_value)
    return normalized


def _ensure_viagem(viagem_id: int, usuario_id: int) -> Viagem:
    viagem = Viagem.query.get_or_404(viagem_id)
    if viagem.usuario_id != usuario_id:
        raise PermissionError("Não autorizado")
    return viagem


def _ensure_custo(custo_id: int, viagem: Viagem) -> ViagemCusto:
    custo = ViagemCusto.query.get_or_404(custo_id)
    if custo.viagem_id != viagem.id:
        raise PermissionError("Custo não pertence à viagem")
    return custo


def _viagem_dir(usuario_id: int, viagem_id: int) -> str:
    path = os.path.join(UPLOAD_ROOT, str(usuario_id), str(viagem_id))
    os.makedirs(path, exist_ok=True)
    return path


def _custo_dir(usuario_id: int, viagem_id: int, custo_id: int) -> str:
    path = os.path.join(_viagem_dir(usuario_id, viagem_id), str(custo_id))
    os.makedirs(path, exist_ok=True)
    return path


def _wipe_path(path: str):
    if os.path.exists(path):
        shutil.rmtree(path, ignore_errors=True)


def _recalcular_total(viagem_id: int):
    total = db.session.query(func.coalesce(func.sum(ViagemCusto.valor), 0)).filter_by(viagem_id=viagem_id).scalar() or 0
    viagem = Viagem.query.get(viagem_id)
    if viagem:
        viagem.custo_total = total


def _build_resumo(viagem_id: int):
    rows = (
        db.session.query(
            ViagemCusto.tipo,
            func.coalesce(func.sum(ViagemCusto.valor), 0)
        )
        .filter(ViagemCusto.viagem_id == viagem_id)
        .group_by(ViagemCusto.tipo)
        .all()
    )
    resumo = []
    total = sum((row[1] or 0) for row in rows)
    total = total if isinstance(total, Decimal) else Decimal(total)
    for tipo, subtotal in rows:
        subtotal = subtotal if isinstance(subtotal, Decimal) else Decimal(subtotal or 0)
        percentual = float(subtotal / total * 100) if total > 0 else 0.0
        resumo.append({
            "tipo": tipo,
            "total": float(subtotal),
            "percentual": round(percentual, 2),
        })
    return resumo


@bp_viagens.errorhandler(PermissionError)
def handle_permission_error(err):
    return jsonify({"error": str(err)}), 403


@bp_viagens.route("/", methods=["GET"])
@jwt_required()
def listar_viagens():
    usuario_id = _current_user_id()
    page = request.args.get("page", 1, type=int)
    per_page = min(request.args.get("per_page", 10, type=int), 50)
    status_param = request.args.get("status")
    search = (request.args.get("q") or "").strip()
    ordenar_por = request.args.get("ordenar_por", "data_inicio")
    ordem = request.args.get("ordem", "asc")

    query = Viagem.query.filter_by(usuario_id=usuario_id)

    if status_param:
        statuses = _normalize(status_param, STATUS_NORMALIZER)
        if statuses:
            query = query.filter(Viagem.status.in_(statuses))

    if search:
        like = f"%{search.lower()}%"
        query = query.filter(
            or_(
                func.lower(Viagem.titulo).like(like),
                func.lower(Viagem.destino).like(like)
            )
        )

    if ordenar_por == "destino":
        order_column = func.lower(Viagem.destino)
    elif ordenar_por == "custo_total":
        order_column = Viagem.custo_total
    else:
        order_column = Viagem.data_inicio

    if ordem == "desc":
        order_column = order_column.desc()
    else:
        order_column = order_column.asc()

    query = query.order_by(order_column, Viagem.id.asc())

    paginated = query.paginate(page=page, per_page=per_page, error_out=False)
    return jsonify({
        "items": viagens_list_schema.dump(paginated.items),
        "total_items": paginated.total,
        "total_pages": paginated.pages,
        "current_page": paginated.page,
        "per_page": paginated.per_page,
        "has_next": paginated.has_next,
        "has_prev": paginated.has_prev,
    }), 200


@bp_viagens.route("/", methods=["POST"])
@jwt_required()
def criar_viagem():
    usuario_id = _current_user_id()
    data = request.get_json() or {}
    try:
        validado = viagem_schema.load(data)
    except Exception as err:
        return jsonify(getattr(err, "messages", {"error": "Dados inválidos"})), 400

    viagem = Viagem(
        usuario_id=usuario_id,
        titulo=validado["titulo"],
        destino=validado["destino"],
        data_inicio=validado["data_inicio"],
        data_termino=validado["data_termino"],
        descricao=validado.get("descricao"),
        status=validado.get("status", "Planejada"),
    )
    db.session.add(viagem)
    db.session.commit()
    return jsonify(viagem_schema.dump(viagem)), 201


@bp_viagens.route("/<int:viagem_id>", methods=["GET"])
@jwt_required()
def detalhar_viagem(viagem_id):
    usuario_id = _current_user_id()
    viagem = _ensure_viagem(viagem_id, usuario_id)
    payload = viagem_schema.dump(viagem)
    payload["resumo_categorias"] = _build_resumo(viagem.id)
    return jsonify(payload), 200


@bp_viagens.route("/<int:viagem_id>", methods=["PUT"])
@jwt_required()
def atualizar_viagem(viagem_id):
    usuario_id = _current_user_id()
    viagem = _ensure_viagem(viagem_id, usuario_id)
    data = request.get_json() or {}
    try:
        validado = viagem_schema.load(data, partial=True)
    except Exception as err:
        return jsonify(getattr(err, "messages", {"error": "Dados inválidos"})), 400

    for campo, valor in validado.items():
        if campo in {"titulo", "destino", "data_inicio", "data_termino", "descricao", "status"}:
            setattr(viagem, campo, valor)
    db.session.commit()
    return jsonify(viagem_schema.dump(viagem)), 200


@bp_viagens.route("/<int:viagem_id>", methods=["DELETE"])
@jwt_required()
def excluir_viagem(viagem_id):
    usuario_id = _current_user_id()
    viagem = _ensure_viagem(viagem_id, usuario_id)
    dir_path = os.path.join(UPLOAD_ROOT, str(usuario_id), str(viagem.id))
    db.session.delete(viagem)
    db.session.commit()
    _wipe_path(dir_path)
    return jsonify({"message": "Viagem excluída"}), 200


@bp_viagens.route("/<int:viagem_id>/custos", methods=["GET"])
@jwt_required()
def listar_custos(viagem_id):
    usuario_id = _current_user_id()
    viagem = _ensure_viagem(viagem_id, usuario_id)
    tipo_param = request.args.get("tipo")
    ordenar_por = request.args.get("ordenar_por", "data")
    ordem = request.args.get("ordem", "asc")

    query = ViagemCusto.query.filter_by(viagem_id=viagem.id)

    if tipo_param:
        tipos = _normalize(tipo_param, TIPO_CUSTO_NORMALIZER)
        if tipos:
            query = query.filter(ViagemCusto.tipo.in_(tipos))

    if ordenar_por == "valor":
        order_column = ViagemCusto.valor
    else:
        order_column = ViagemCusto.data_gasto

    if ordem == "desc":
        order_column = order_column.desc()
    else:
        order_column = order_column.asc()

    custos = query.order_by(order_column, ViagemCusto.id.asc()).all()
    return jsonify(custos_schema.dump(custos)), 200


@bp_viagens.route("/<int:viagem_id>/custos", methods=["POST"])
@jwt_required()
def criar_custo(viagem_id):
    usuario_id = _current_user_id()
    viagem = _ensure_viagem(viagem_id, usuario_id)
    data = request.get_json() or {}
    try:
        validado = custo_schema.load(data)
    except Exception as err:
        return jsonify(getattr(err, "messages", {"error": "Dados inválidos"})), 400

    custo = ViagemCusto(
        viagem_id=viagem.id,
        nome=validado["nome"],
        descricao=validado["descricao"],
        observacao=validado.get("observacao"),
        link=validado.get("link"),
        tipo=validado.get("tipo", "Outros"),
        data_gasto=validado.get("data_gasto"),
        valor=validado["valor"],
        forma_pagamento=validado.get("forma_pagamento"),
    )
    db.session.add(custo)
    _recalcular_total(viagem.id)
    db.session.commit()
    return jsonify(custo_schema.dump(custo)), 201


@bp_viagens.route("/<int:viagem_id>/custos/<int:custo_id>", methods=["GET"])
@jwt_required()
def obter_custo(viagem_id, custo_id):
    usuario_id = _current_user_id()
    viagem = _ensure_viagem(viagem_id, usuario_id)
    custo = _ensure_custo(custo_id, viagem)
    return jsonify(custo_schema.dump(custo)), 200


@bp_viagens.route("/<int:viagem_id>/custos/<int:custo_id>", methods=["PUT"])
@jwt_required()
def atualizar_custo(viagem_id, custo_id):
    usuario_id = _current_user_id()
    viagem = _ensure_viagem(viagem_id, usuario_id)
    custo = _ensure_custo(custo_id, viagem)
    data = request.get_json() or {}
    try:
        validado = custo_schema.load(data, partial=True)
    except Exception as err:
        return jsonify(getattr(err, "messages", {"error": "Dados inválidos"})), 400

    for campo, valor in validado.items():
        if campo in {
            "nome",
            "descricao",
            "observacao",
            "link",
            "tipo",
            "data_gasto",
            "valor",
            "forma_pagamento",
        }:
            setattr(custo, campo, valor)
    _recalcular_total(viagem.id)
    db.session.commit()
    return jsonify(custo_schema.dump(custo)), 200


@bp_viagens.route("/<int:viagem_id>/custos/<int:custo_id>", methods=["DELETE"])
@jwt_required()
def excluir_custo(viagem_id, custo_id):
    usuario_id = _current_user_id()
    viagem = _ensure_viagem(viagem_id, usuario_id)
    custo = _ensure_custo(custo_id, viagem)
    dir_path = os.path.join(UPLOAD_ROOT, str(usuario_id), str(viagem.id), str(custo.id))
    db.session.delete(custo)
    _recalcular_total(viagem.id)
    db.session.commit()
    _wipe_path(dir_path)
    return jsonify({"message": "Custo excluído"}), 200


@bp_viagens.route("/<int:viagem_id>/custos/<int:custo_id>/anexos", methods=["GET"])
@jwt_required()
def listar_anexos(viagem_id, custo_id):
    usuario_id = _current_user_id()
    viagem = _ensure_viagem(viagem_id, usuario_id)
    custo = _ensure_custo(custo_id, viagem)
    return jsonify(anexos_schema.dump(custo.anexos)), 200


@bp_viagens.route("/<int:viagem_id>/custos/<int:custo_id>/anexos", methods=["POST"])
@jwt_required()
def upload_anexos(viagem_id, custo_id):
    usuario_id = _current_user_id()
    viagem = _ensure_viagem(viagem_id, usuario_id)
    custo = _ensure_custo(custo_id, viagem)

    arquivos = request.files.getlist("files") or []
    if not arquivos:
        return jsonify({"error": "Nenhum arquivo enviado"}), 400

    if len(custo.anexos) + len(arquivos) > MAX_FILES_PER_COST:
        return jsonify({"error": f"Limite de {MAX_FILES_PER_COST} anexos por custo"}), 400

    destino = _custo_dir(usuario_id, viagem.id, custo.id)
    criados = []

    for arquivo in arquivos:
        mimetype = arquivo.mimetype or "application/octet-stream"
        if mimetype not in ALLOWED_UPLOAD_MIME:
            return jsonify({"error": f"MIME não permitido: {mimetype}"}), 400
        original = secure_filename(arquivo.filename) or f"comprovante_{uuid.uuid4().hex}"
        stored = f"{uuid.uuid4().hex}_{original}"
        path = os.path.join(destino, stored)
        arquivo.save(path)
        size = os.path.getsize(path)
        anexo = ViagemCustoAnexo(
            custo_id=custo.id,
            original_name=original,
            stored_name=stored,
            mime_type=mimetype,
            size_bytes=size,
            storage_path=path,
        )
        db.session.add(anexo)
        criados.append(anexo)

    db.session.commit()
    return jsonify(anexos_schema.dump(criados)), 201


@bp_viagens.route("/<int:viagem_id>/custos/<int:custo_id>/anexos/<int:anexo_id>", methods=["GET"])
@jwt_required()
def baixar_anexo(viagem_id, custo_id, anexo_id):
    usuario_id = _current_user_id()
    viagem = _ensure_viagem(viagem_id, usuario_id)
    custo = _ensure_custo(custo_id, viagem)
    anexo = ViagemCustoAnexo.query.get_or_404(anexo_id)
    if anexo.custo_id != custo.id:
        return jsonify({"error": "Anexo não pertence ao custo"}), 400
    if not os.path.exists(anexo.storage_path):
        return jsonify({"error": "Arquivo não encontrado"}), 404
    as_attachment = False if anexo.mime_type in ALLOWED_UPLOAD_MIME else True
    return send_file(anexo.storage_path, download_name=anexo.original_name, as_attachment=as_attachment)


@bp_viagens.route("/<int:viagem_id>/custos/<int:custo_id>/anexos/<int:anexo_id>", methods=["DELETE"])
@jwt_required()
def excluir_anexo(viagem_id, custo_id, anexo_id):
    usuario_id = _current_user_id()
    viagem = _ensure_viagem(viagem_id, usuario_id)
    custo = _ensure_custo(custo_id, viagem)
    anexo = ViagemCustoAnexo.query.get_or_404(anexo_id)
    if anexo.custo_id != custo.id:
        return jsonify({"error": "Anexo não pertence ao custo"}), 400
    try:
        if os.path.exists(anexo.storage_path):
            os.remove(anexo.storage_path)
    except Exception:
        pass
    db.session.delete(anexo)
    db.session.commit()
    return jsonify({"message": "Anexo excluído"}), 200


@bp_viagens.route("/<int:viagem_id>/export", methods=["GET"])
@jwt_required()
def exportar_viagem(viagem_id):
    usuario_id = _current_user_id()
    viagem = _ensure_viagem(viagem_id, usuario_id)
    formato = (request.args.get("formato") or "csv").lower()
    custos = ViagemCusto.query.filter_by(viagem_id=viagem.id).order_by(ViagemCusto.data_gasto.asc()).all()

    if formato == "pdf":
        pdf = FPDF()
        pdf.set_auto_page_break(auto=True, margin=15)
        pdf.add_page()
        pdf.set_font("Helvetica", "B", 16)
        pdf.cell(0, 10, "Resumo da Viagem", ln=True)
        pdf.set_font("Helvetica", size=12)
        pdf.cell(0, 8, f"Título: {viagem.titulo}", ln=True)
        pdf.cell(0, 8, f"Destino: {viagem.destino}", ln=True)
        pdf.cell(0, 8, f"Período: {viagem.data_inicio} a {viagem.data_termino}", ln=True)
        pdf.cell(0, 8, f"Status: {viagem.status}", ln=True)
        pdf.cell(0, 8, f"Custo Total: R$ {float(viagem.custo_total or 0):.2f}", ln=True)
        pdf.ln(4)

        resumo = _build_resumo(viagem.id)
        if resumo:
            pdf.set_font("Helvetica", "B", 12)
            pdf.cell(0, 8, "Resumo por Categoria", ln=True)
            pdf.set_font("Helvetica", size=11)
            for item in resumo:
                pdf.cell(0, 6, f"- {item['tipo']}: R$ {item['total']:.2f} ({item['percentual']}%)", ln=True)
            pdf.ln(4)

        pdf.set_font("Helvetica", "B", 12)
        pdf.cell(0, 8, "Custos", ln=True)
        pdf.set_font("Helvetica", size=10)
        for custo in custos:
            pdf.multi_cell(0, 6, f"{custo.data_gasto} - {custo.tipo} - R$ {float(custo.valor):.2f}\n{custo.descricao}")
            if custo.forma_pagamento:
                pdf.cell(0, 6, f"Forma: {custo.forma_pagamento}", ln=True)
            pdf.ln(1)

        pdf_output = pdf.output(dest="S")
        if isinstance(pdf_output, str):
            pdf_bytes = pdf_output.encode("latin-1", errors="ignore")
        elif isinstance(pdf_output, bytearray):
            pdf_bytes = bytes(pdf_output)
        else:
            pdf_bytes = pdf_output
        buffer = io.BytesIO(pdf_bytes)
        buffer.seek(0)
        filename = f"viagem_{viagem.id}.pdf"
        return send_file(buffer, mimetype="application/pdf", download_name=filename, as_attachment=True)

    # default CSV
    csv_buffer = io.StringIO()
    writer = csv.writer(csv_buffer, delimiter=";")
    writer.writerow(["Título", "Destino", "Data Início", "Data Término", "Status", "Custo Total"])
    writer.writerow([
        viagem.titulo,
        viagem.destino,
        viagem.data_inicio,
        viagem.data_termino,
        viagem.status,
        f"{float(viagem.custo_total or 0):.2f}",
    ])
    writer.writerow([])
    writer.writerow(["Data", "Tipo", "Descrição", "Valor", "Forma de Pagamento"])
    for custo in custos:
        writer.writerow([
            custo.data_gasto,
            custo.tipo,
            custo.descricao,
            f"{float(custo.valor):.2f}",
            custo.forma_pagamento or "-",
        ])

    buffer = io.BytesIO(csv_buffer.getvalue().encode("utf-8-sig"))
    buffer.seek(0)
    filename = f"viagem_{viagem.id}.csv"
    return send_file(buffer, mimetype="text/csv", download_name=filename, as_attachment=True)
