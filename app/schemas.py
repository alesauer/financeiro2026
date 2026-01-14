from marshmallow import Schema, fields, validates, ValidationError, pre_load, EXCLUDE

# ======================
# Usuário
# ======================
class UsuarioSchema(Schema):
    id = fields.Int(dump_only=True)
    nome = fields.Str(required=True)
    email = fields.Email(required=True)
    senha = fields.Str(load_only=True, required=True)
    data_criacao = fields.DateTime(dump_only=True)
from datetime import date

# ======================
# Categoria
# ======================
class CategoriaSchema(Schema):
    id = fields.Int(dump_only=True)
    nome = fields.Str(required=True)
    tipo = fields.Str(required=True)

# ======================
# Transação
# ======================
class TransacaoSchema(Schema):
    class Meta:
        unknown = EXCLUDE
    id = fields.Int(dump_only=True)

    # --- Campos obrigatórios ---
    tipo = fields.Str(required=True)
    categoria_id = fields.Int(required=True)
    descricao = fields.Str(required=True)
    valor = fields.Decimal(required=True, as_string=True)
    # Nova modelagem: forma_pagamento_id (FK)
    forma_pagamento_id = fields.Int(required=True)
    # Campo extra: nome da categoria
    categoria_nome = fields.Method("get_categoria_nome", dump_only=True)
    # Campos extras: nome e flag de cartão da forma de pagamento
    forma_pagamento_nome = fields.Method("get_forma_pagamento_nome", dump_only=True)
    forma_pagamento_cartao = fields.Method("get_forma_pagamento_cartao", dump_only=True)

    def get_categoria_nome(self, obj):
        # obj é uma instância de Transacao
        if hasattr(obj, "categoria") and obj.categoria:
            return obj.categoria.nome
        return None

    def get_forma_pagamento_nome(self, obj):
        if hasattr(obj, "forma_pagamento") and obj.forma_pagamento:
            return getattr(obj.forma_pagamento, "nome", None)
        return None

    def get_forma_pagamento_cartao(self, obj):
        if hasattr(obj, "forma_pagamento") and obj.forma_pagamento:
            return bool(getattr(obj.forma_pagamento, "cartao_credito", False))
        return False

    # --- Campos com default ---
    data_transacao = fields.Date(load_default=date.today)
    status = fields.Str(load_default="Pago")

    recorrente = fields.Boolean(load_default=False)
    recorrencia_tipo = fields.Str(allow_none=True)
    frequencia = fields.Str(allow_none=True)
    data_fim = fields.Date(allow_none=True)

    parcelado = fields.Boolean(load_default=False)
    total_parcelas = fields.Int(allow_none=True)
    parcela_atual = fields.Int(load_default=1)
    valor_parcela = fields.Decimal(as_string=True, allow_none=True)
    parcelamento_id = fields.Str(dump_only=True)

    observacoes = fields.Str(allow_none=True)

    # -------------------
    # Validações customizadas
    # -------------------

    @validates("valor")
    def validate_valor(self, value, **kwargs):
        if value <= 0:
            raise ValidationError("O valor deve ser maior que 0")

    @validates("total_parcelas")
    def validate_total_parcelas(self, value, **kwargs):
        if value is not None and (value < 2 or value > 60):
            raise ValidationError("Total de parcelas deve estar entre 2 e 60")

    @validates("frequencia")
    def validate_frequencia(self, value, **kwargs):
        if value and value not in ["Diária", "Semanal", "Mensal", "Semestral", "Anual"]:
            raise ValidationError("Frequência inválida")

    @validates("status")
    def validate_status(self, value, **kwargs):
        if value not in ["Pago", "Pendente"]:
            raise ValidationError("Status inválido")

    @validates("tipo")
    def validate_tipo(self, value, **kwargs):
        if value not in ["Receita", "Despesa", "Investimento"]:
            raise ValidationError("Tipo deve ser Receita, Despesa ou Investimento")

    @validates("recorrencia_tipo")
    def validate_recorrencia_tipo(self, value, **kwargs):
        if value and value not in ["Assinatura", "Parcelamento"]:
            raise ValidationError("Tipo de recorrência inválido")

    @pre_load
    def validate_dependencies(self, data, **kwargs):
        # regras de dependência entre campos
        try:
            rec = bool(data.get("recorrente"))
            tipo = data.get("recorrencia_tipo")
            if rec:
                if not tipo:
                    raise ValidationError({"recorrencia_tipo": ["Obrigatório quando recorrente é verdadeiro."]})
                if tipo == "Assinatura":
                    if not data.get("frequencia"):
                        raise ValidationError({"frequencia": ["Obrigatório para Assinatura."]})
                elif tipo == "Parcelamento":
                    tp = data.get("total_parcelas")
                    if tp is None:
                        raise ValidationError({"total_parcelas": ["Obrigatório para Parcelamento."]})
        except ValidationError:
            raise
        return data

    # Compatibilidade: permitir payloads antigos com campo 'forma_pagamento' (string)
    @pre_load
    def map_forma_pagamento_legacy(self, data, **kwargs):
        if isinstance(data, dict) and "forma_pagamento_id" not in data and "forma_pagamento" in data:
            valor = data.get("forma_pagamento")
            try:
                # Import tardio para evitar ciclos
                from app import db
                from app.models import FormaPagamento
                # tenta por nome
                fp = db.session.query(FormaPagamento).filter_by(nome=valor).first()
                if not fp:
                    # tenta por tipo
                    fp = db.session.query(FormaPagamento).filter_by(tipo=valor).first()
                if not fp and valor:
                    # cria registro genérico com nome e tipo iguais
                    fp = FormaPagamento(nome=str(valor), tipo=str(valor), cartao_credito=(str(valor).lower() == "cartão de crédito"))
                    db.session.add(fp)
                    db.session.commit()
                if fp:
                    data["forma_pagamento_id"] = fp.id
            except Exception:
                # se falhar, deixa para validação normal acusar ausência do id
                pass
        return data

# ======================
# Documentos
# ======================

class TipoDocumentoSchema(Schema):
    id = fields.Int(dump_only=True)
    nome = fields.Str(required=True)
    descricao = fields.Str(allow_none=True)
    ativo = fields.Boolean(load_default=True)


class DocumentoAnexoSchema(Schema):
    id = fields.Int(dump_only=True)
    documento_id = fields.Int(required=True)
    original_name = fields.Str(dump_only=True)
    stored_name = fields.Str(dump_only=True)
    mime_type = fields.Str(dump_only=True)
    size_bytes = fields.Int(dump_only=True)
    storage_path = fields.Str(dump_only=True)
    uploaded_at = fields.DateTime(dump_only=True)


class DocumentoSchema(Schema):
    class Meta:
        unknown = EXCLUDE

    id = fields.Int(dump_only=True)
    usuario_id = fields.Int(dump_only=True)
    tipo_documento_id = fields.Int(required=True)
    nome = fields.Str(required=True)
    registro = fields.Str(allow_none=True)
    outras_informacoes = fields.Str(allow_none=True)
    created_at = fields.DateTime(dump_only=True)
    updated_at = fields.DateTime(dump_only=True)

    # Extras
    tipo_documento_nome = fields.Method("get_tipo_documento_nome", dump_only=True)
    anexos = fields.List(fields.Nested(DocumentoAnexoSchema), dump_only=True)

    def get_tipo_documento_nome(self, obj):
        if hasattr(obj, "tipo_documento") and obj.tipo_documento:
            return obj.tipo_documento.nome
        return None

# ======================
# Milhas
# ======================

class MilhaSchema(Schema):
    class Meta:
        unknown = EXCLUDE

    id = fields.Int(dump_only=True)
    usuario_id = fields.Int(dump_only=True)

    programa = fields.Str(required=True)
    tipo = fields.Str(required=True)
    quantidade = fields.Int(required=True)
    origem = fields.Str(allow_none=True)
    data_movimentacao = fields.Date(load_default=date.today)
    data_expiracao = fields.Date(allow_none=True)
    descricao = fields.Str(allow_none=True)

    created_at = fields.DateTime(dump_only=True)
    updated_at = fields.DateTime(dump_only=True)

    @validates("tipo")
    def validate_tipo(self, value, **kwargs):
        if value not in ["entrada", "saida"]:
            raise ValidationError("Tipo deve ser 'entrada' ou 'saida'")

    @validates("quantidade")
    def validate_quantidade(self, value, **kwargs):
        if value is None or value <= 0:
            raise ValidationError("Quantidade deve ser maior que 0")


# ======================
# Configurações - E-mails de Alerta
# ======================

class EmailsAlertaSchema(Schema):
    emails = fields.List(fields.Email(), required=True)

    @validates("emails")
    def validate_emails(self, value, **kwargs):
        if len(value) > 50:
            raise ValidationError("Limite de 50 e-mails excedido")


class EmailItemSchema(Schema):
    email = fields.Email(required=True)


# ======================
# Configurações - Alertas (ligado/email/whatsapp/limite)
# ======================

class AlertasConfigSchema(Schema):
    ligado = fields.Boolean(load_default=False)
    email = fields.Boolean(load_default=False)
    whatsapp = fields.Boolean(load_default=False)
    limite = fields.Float(load_default=0.0)

    @validates("limite")
    def validate_limite(self, value, **kwargs):
        if value is None or value < 0:
            raise ValidationError("Limite deve ser maior ou igual a 0")


# ======================
# Configurações - Sobre o Sistema
# ======================

class SobreSistemaConfigSchema(Schema):
    descricao = fields.Str(load_default="", allow_none=True)
    versao = fields.Str(load_default="", allow_none=True)
