from datetime import datetime, timedelta, date
import os
import uuid

from flask import Blueprint, request, jsonify, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename

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
MAX_FILES_PER_DOC = 10

DEFAULT_TIPOS = [
    {"nome": "Identificação Pessoal", "descricao": "RG, CPF, CNH, Passaporte, Certidões", "icone": "CreditCard", "cor": "from-blue-600 via-indigo-600 to-slate-900"},
    {"nome": "Saúde, Laudos & Exames", "descricao": "Laudos Médicos, Exames, Receitas, SUS, Vacinas", "icone": "Activity", "cor": "from-emerald-600 via-teal-700 to-cyan-950"},
    {"nome": "Veículos & Condução", "descricao": "CRLV, CNH Digital, Seguro Auto, IPVA", "icone": "Car", "cor": "from-amber-500 via-orange-600 to-stone-900"},
    {"nome": "Contratos & Residência", "descricao": "Aluguel, Escritura, Comprovante Residência", "icone": "Building", "cor": "from-violet-600 via-purple-700 to-slate-950"},
    {"nome": "Seguros & Previdência", "descricao": "Apólices de Seguro Vida, Residencial, Planos", "icone": "ShieldCheck", "cor": "from-sky-600 via-blue-700 to-slate-900"},
    {"nome": "Garantias & Comprovantes", "descricao": "Notas Fiscais, Certificados de Garantia, Manuais", "icone": "Receipt", "cor": "from-rose-600 via-pink-700 to-neutral-900"},
    {"nome": "Educação & Certificados", "descricao": "Diplomas, Cursos, Certificações, Carteirinhas", "icone": "GraduationCap", "cor": "from-amber-600 via-yellow-700 to-zinc-900"},
    {"nome": "Profissional & Empresas", "descricao": "CTPS Digital, CNPJ, Contrato Social, Registro de Classe", "icone": "Briefcase", "cor": "from-cyan-600 via-blue-800 to-slate-950"},
    {"nome": "Outros Passes & Registros", "descricao": "Cartões de fidelidade, ingressos e registros gerais", "icone": "FileText", "cor": "from-slate-700 via-zinc-800 to-neutral-900"},
]


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
    if not tipos:
        for t in DEFAULT_TIPOS:
            db.session.add(
                TipoDocumento(
                    nome=t["nome"],
                    descricao=t["descricao"],
                    icone=t["icone"],
                    cor=t["cor"],
                    ativo=True,
                )
            )
        db.session.commit()
        tipos = TipoDocumento.query.filter_by(ativo=True).all()
    return jsonify(tipo_schemas.dump(tipos)), 200


@bp_documentos.route("/", methods=["GET"])
@jwt_required()
def listar_documentos():
    usuario_id = int(get_jwt_identity())
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 50, type=int)
    tipo_id = request.args.get("tipo_id", type=int)
    favorito = request.args.get("favorito", type=str)
    search = request.args.get("search", request.args.get("q", "")).strip()
    status = request.args.get("status", "").strip().lower()

    query = Documento.query.filter_by(usuario_id=usuario_id)

    if tipo_id:
        query = query.filter(Documento.tipo_documento_id == tipo_id)

    if favorito is not None and favorito.lower() in ("true", "1"):
        query = query.filter(Documento.favorito == True)

    if search:
        s = f"%{search}%"
        query = query.filter(
            db.or_(
                Documento.nome.ilike(s),
                Documento.registro.ilike(s),
                Documento.emissor.ilike(s),
                Documento.titular.ilike(s),
                Documento.tags.ilike(s),
                Documento.outras_informacoes.ilike(s),
            )
        )

    hoje = datetime.utcnow().date()
    if status == "validos":
        query = query.filter(
            db.or_(
                Documento.data_validade == None,
                Documento.data_validade >= hoje,
            )
        )
    elif status == "expirando":
        daqui_30_dias = hoje + timedelta(days=30)
        query = query.filter(
            Documento.data_validade >= hoje,
            Documento.data_validade <= daqui_30_dias,
        )
    elif status == "expirados":
        query = query.filter(
            Documento.data_validade != None,
            Documento.data_validade < hoje,
        )

    query = query.order_by(Documento.favorito.desc(), Documento.updated_at.desc())
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
        return jsonify(getattr(err, 'messages', {"error": "Dados inválidos"})), 400

    tipo = TipoDocumento.query.get(validado["tipo_documento_id"])
    if not tipo or not tipo.ativo:
        return jsonify({"error": "Tipo de documento inválido ou inativo"}), 400

    doc = Documento(
        usuario_id=usuario_id,
        tipo_documento_id=validado["tipo_documento_id"],
        nome=validado["nome"],
        registro=validado.get("registro"),
        emissor=validado.get("emissor"),
        titular=validado.get("titular"),
        data_emissao=validado.get("data_emissao"),
        data_validade=validado.get("data_validade"),
        cor_pass=validado.get("cor_pass") or tipo.cor,
        icone=validado.get("icone") or tipo.icone,
        favorito=validado.get("favorito", False),
        tags=validado.get("tags"),
        outras_informacoes=validado.get("outras_informacoes"),
    )
    db.session.add(doc)
    db.session.commit()
    return jsonify(doc_schema.dump(doc)), 201


@bp_documentos.route("/<int:id>/favorito", methods=["PATCH"])
@jwt_required()
def toggle_favorito(id):
    usuario_id = int(get_jwt_identity())
    doc = Documento.query.get_or_404(id)
    if doc.usuario_id != usuario_id:
        return jsonify({"error": "Não autorizado"}), 403
    doc.favorito = not bool(doc.favorito)
    db.session.commit()
    return jsonify(doc_schema.dump(doc)), 200



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
