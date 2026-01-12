from flask import Blueprint, request, jsonify, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename
import os
import uuid
from app import db
from app.models import TipoDocumento, Documento, DocumentoAnexo, Usuario
from app.schemas import TipoDocumentoSchema, DocumentoSchema, DocumentoAnexoSchema

bp_documentos = Blueprint("documentos", __name__)

tipo_schema = TipoDocumentoSchema()
tipo_schemas = TipoDocumentoSchema(many=True)

doc_schema = DocumentoSchema()
doc_schemas = DocumentoSchema(many=True)

anexo_schema = DocumentoAnexoSchema()
anexo_schemas = DocumentoAnexoSchema(many=True)

# Configs de upload (defaults)
ALLOWED_MIME = {"application/pdf", "image/jpeg", "image/png", "image/webp"}
MAX_FILES_PER_DOC = 5


def get_upload_root():
    # uploads/documentos/<usuario_id>/<documento_id>/
    base = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads", "documentos")
    os.makedirs(base, exist_ok=True)
    return base


def ensure_doc_dir(usuario_id: int, documento_id: int):
    root = get_upload_root()
    path = os.path.join(root, str(usuario_id), str(documento_id))
    os.makedirs(path, exist_ok=True)
    return path


@bp_documentos.route("/tipos", methods=["GET"])
@jwt_required()
def listar_tipos():
    tipos = TipoDocumento.query.filter_by(ativo=True).all()
    return jsonify(tipo_schemas.dump(tipos)), 200


@bp_documentos.route("/", methods=["GET"])
@jwt_required()
def listar_documentos():
    usuario_id = int(get_jwt_identity())
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 10, type=int)

    query = Documento.query.filter_by(usuario_id=usuario_id).order_by(Documento.updated_at.desc())
    paginated = query.paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        "items": doc_schemas.dump(paginated.items),
        "total_items": paginated.total,
        "total_pages": paginated.pages,
        "current_page": paginated.page,
        "per_page": paginated.per_page,
        "has_next": paginated.has_next,
        "has_prev": paginated.has_prev,
    }), 200


@bp_documentos.route("/", methods=["POST"])
@jwt_required()
def criar_documento():
    usuario_id = int(get_jwt_identity())
    data = request.get_json() or {}
    try:
        validado = doc_schema.load(data)
    except Exception as err:
        # Marshmallow ValidationError
        return jsonify(getattr(err, 'messages', {"error": "Dados inválidos"})), 400

    # confirmar tipo existe e ativo
    tipo = TipoDocumento.query.get(validado["tipo_documento_id"])
    if not tipo or not tipo.ativo:
        return jsonify({"error": "Tipo de documento inválido ou inativo"}), 400

    doc = Documento(
        usuario_id=usuario_id,
        tipo_documento_id=validado["tipo_documento_id"],
        nome=validado["nome"],
        registro=validado.get("registro"),
        outras_informacoes=validado.get("outras_informacoes"),
    )
    db.session.add(doc)
    db.session.commit()
    return jsonify(doc_schema.dump(doc)), 201


@bp_documentos.route("/<int:id>", methods=["GET"])
@jwt_required()
def obter_documento(id):
    usuario_id = int(get_jwt_identity())
    doc = Documento.query.get_or_404(id)
    if doc.usuario_id != usuario_id:
        return jsonify({"error": "Não autorizado"}), 403
    # eager load anexos via acesso
    _ = doc.anexos
    return jsonify(doc_schema.dump(doc)), 200


@bp_documentos.route("/<int:id>", methods=["PUT"])
@jwt_required()
def atualizar_documento(id):
    usuario_id = int(get_jwt_identity())
    doc = Documento.query.get_or_404(id)
    if doc.usuario_id != usuario_id:
        return jsonify({"error": "Não autorizado"}), 403
    data = request.get_json() or {}
    try:
        validado = doc_schema.load(data, partial=True)
    except Exception as err:
        return jsonify(getattr(err, 'messages', {"error": "Dados inválidos"})), 400

    for k, v in validado.items():
        setattr(doc, k, v)
    db.session.commit()
    return jsonify(doc_schema.dump(doc)), 200


@bp_documentos.route("/<int:id>", methods=["DELETE"])
@jwt_required()
def excluir_documento(id):
    usuario_id = int(get_jwt_identity())
    doc = Documento.query.get_or_404(id)
    if doc.usuario_id != usuario_id:
        return jsonify({"error": "Não autorizado"}), 403

    # remover arquivos físicos
    doc_dir = ensure_doc_dir(usuario_id, doc.id)
    try:
        for an in doc.anexos:
            fpath = os.path.join(doc_dir, an.stored_name)
            if os.path.exists(fpath):
                os.remove(fpath)
    except Exception:
        pass

    db.session.delete(doc)
    db.session.commit()
    return jsonify({"message": "Documento excluído"}), 200


@bp_documentos.route("/<int:id>/anexos", methods=["POST"])
@jwt_required()
def upload_anexos(id):
    usuario_id = int(get_jwt_identity())
    doc = Documento.query.get_or_404(id)
    if doc.usuario_id != usuario_id:
        return jsonify({"error": "Não autorizado"}), 403

    files = request.files.getlist("files") or []
    if not files:
        return jsonify({"error": "Nenhum arquivo enviado"}), 400

    # checar limite total
    count_existentes = len(doc.anexos)
    if count_existentes + len(files) > MAX_FILES_PER_DOC:
        return jsonify({"error": f"Limite de {MAX_FILES_PER_DOC} anexos por documento"}), 400

    destino = ensure_doc_dir(usuario_id, doc.id)
    created = []
    for f in files:
        mime = f.mimetype or "application/octet-stream"
        if mime not in ALLOWED_MIME:
            return jsonify({"error": f"MIME não permitido: {mime}"}), 400
        original = secure_filename(f.filename)
        uid = uuid.uuid4().hex
        stored = f"{uid}_{original}"
        path = os.path.join(destino, stored)
        f.save(path)
        size = os.path.getsize(path)
        an = DocumentoAnexo(
            documento_id=doc.id,
            original_name=original,
            stored_name=stored,
            mime_type=mime,
            size_bytes=size,
            storage_path=path,
        )
        db.session.add(an)
        created.append(an)
    db.session.commit()

    return jsonify(anexo_schemas.dump(created)), 201


@bp_documentos.route("/<int:id>/anexos", methods=["GET"])
@jwt_required()
def listar_anexos(id):
    usuario_id = int(get_jwt_identity())
    doc = Documento.query.get_or_404(id)
    if doc.usuario_id != usuario_id:
        return jsonify({"error": "Não autorizado"}), 403
    return jsonify(anexo_schemas.dump(doc.anexos)), 200


@bp_documentos.route("/<int:id>/anexos/<int:anexo_id>", methods=["GET"])
@jwt_required()
def baixar_anexo(id, anexo_id):
    usuario_id = int(get_jwt_identity())
    doc = Documento.query.get_or_404(id)
    if doc.usuario_id != usuario_id:
        return jsonify({"error": "Não autorizado"}), 403
    an = DocumentoAnexo.query.get_or_404(anexo_id)
    if an.documento_id != doc.id:
        return jsonify({"error": "Anexo não pertence ao documento"}), 400
    if not os.path.exists(an.storage_path):
        return jsonify({"error": "Arquivo não encontrado"}), 404
    # inline para imagens/PDF
    as_attachment = False if an.mime_type in ALLOWED_MIME else True
    return send_file(an.storage_path, download_name=an.original_name, as_attachment=as_attachment)


@bp_documentos.route("/<int:id>/anexos/<int:anexo_id>", methods=["DELETE"])
@jwt_required()
def excluir_anexo(id, anexo_id):
    usuario_id = int(get_jwt_identity())
    doc = Documento.query.get_or_404(id)
    if doc.usuario_id != usuario_id:
        return jsonify({"error": "Não autorizado"}), 403
    an = DocumentoAnexo.query.get_or_404(anexo_id)
    if an.documento_id != doc.id:
        return jsonify({"error": "Anexo não pertence ao documento"}), 400
    try:
        if os.path.exists(an.storage_path):
            os.remove(an.storage_path)
    except Exception:
        pass
    db.session.delete(an)
    db.session.commit()
    return jsonify({"message": "Anexo excluído"}), 200
