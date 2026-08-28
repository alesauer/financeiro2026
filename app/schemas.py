from datetime import date

from marshmallow import Schema, fields, validates, validates_schema, ValidationError, pre_load, EXCLUDE

from app.utils.texto import normalizar_texto


# ======================
# Usuário
# ======================
class UsuarioSchema(Schema):
    id = fields.Int(dump_only=True)
    nome = fields.Str(required=True)
    email = fields.Email(required=True)
    senha = fields.Str(load_only=True, required=True)
    data_criacao = fields.DateTime(dump_only=True)

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
    competencia_fatura = fields.Date(dump_only=True)

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

    @validates_schema
    def validate_categoria_tipo(self, data, **kwargs):
        """A categoria precisa ser do mesmo tipo da transação (Receita/Despesa/Investimento)."""
        tipo = data.get("tipo")
        categoria_id = data.get("categoria_id")
        if not tipo or not categoria_id:
            return

        from app import db
        from app.models import Categoria

        categoria = db.session.get(Categoria, categoria_id)
        if categoria is None:
            raise ValidationError({"categoria_id": ["Categoria não encontrada."]})
        if categoria.tipo != tipo:
            raise ValidationError({
                "categoria_id": [
                    f"A categoria '{categoria.nome}' é do tipo {categoria.tipo} "
                    f"e não pode ser usada em uma transação do tipo {tipo}."
                ]
            })

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
# Lembretes
# ======================


class LembreteSchema(Schema):
    class Meta:
        unknown = EXCLUDE

    id = fields.Int(dump_only=True)
    usuario_id = fields.Int(dump_only=True)
    titulo = fields.Str(required=True)
    descricao = fields.Str(allow_none=True)
    categoria = fields.Str(allow_none=True)
    data_lembrete = fields.Date(allow_none=True)
    hora_lembrete = fields.Time(allow_none=True)
    status = fields.Str(load_default="Pendente")
    prioridade = fields.Str(load_default="Média")
    created_at = fields.DateTime(dump_only=True)
    updated_at = fields.DateTime(dump_only=True)

    ALLOWED_STATUS = {"Pendente", "Concluído"}
    ALLOWED_PRIORIDADES = {"Baixa", "Média", "Alta"}

    @validates("titulo")
    def validate_titulo(self, value, **kwargs):
        if not value or not value.strip():
            raise ValidationError("Título é obrigatório")
        if len(value.strip()) > 120:
            raise ValidationError("Título deve ter no máximo 120 caracteres")

    @validates("categoria")
    def validate_categoria(self, value, **kwargs):
        if value and len(value.strip()) > 50:
            raise ValidationError("Categoria deve ter no máximo 50 caracteres")

    @validates("status")
    def validate_status(self, value, **kwargs):
        if value and value not in self.ALLOWED_STATUS:
            raise ValidationError("Status inválido")

    @validates("prioridade")
    def validate_prioridade(self, value, **kwargs):
        if value and value not in self.ALLOWED_PRIORIDADES:
            raise ValidationError("Prioridade inválida")

    @validates_schema
    def validate_horario(self, data, **kwargs):
        if data.get("hora_lembrete") and not data.get("data_lembrete"):
            raise ValidationError({"data_lembrete": ["Informe uma data para usar hora do lembrete"]})


# ======================
# Viagens
# ======================


class ViagemCustoAnexoSchema(Schema):
    id = fields.Int(dump_only=True)
    custo_id = fields.Int(dump_only=True)
    original_name = fields.Str(dump_only=True)
    stored_name = fields.Str(dump_only=True)
    mime_type = fields.Str(dump_only=True)
    size_bytes = fields.Int(dump_only=True)
    storage_path = fields.Str(dump_only=True)
    uploaded_at = fields.DateTime(dump_only=True)


class ViagemCustoSchema(Schema):
    class Meta:
        unknown = EXCLUDE

    id = fields.Int(dump_only=True)
    viagem_id = fields.Int(dump_only=True)
    nome = fields.Str(required=True)
    descricao = fields.Str(required=True)
    observacao = fields.Str(allow_none=True)
    link = fields.Str(allow_none=True)
    tipo = fields.Str(load_default="Outros")
    data_gasto = fields.Date(load_default=date.today)
    valor = fields.Decimal(required=True, as_string=True)
    forma_pagamento = fields.Str(allow_none=True)
    created_at = fields.DateTime(dump_only=True)
    updated_at = fields.DateTime(dump_only=True)
    anexos = fields.List(fields.Nested(ViagemCustoAnexoSchema), dump_only=True)

    ALLOWED_TIPOS = {
        "Hospedagem",
        "Alimentação",
        "Seguro Viagem",
        "Passagem Aérea",
        "Transportes",
        "Compras",
        "Atrações",
        "Transporte",
        "Transporte Público",
        "Passeios",
        "Outros",
    }
    ALLOWED_TIPOS_NORMALIZED = {normalizar_texto(tipo) for tipo in ALLOWED_TIPOS}
    LEGACY_TIPO_MAP = {
        "atracoes parques": "Atrações",
        "transportes trem metro etc": "Transportes",
        "transportes trem metro": "Transportes",
    }

    @validates("nome")
    def validate_nome(self, value, **kwargs):
        if not value or not value.strip():
            raise ValidationError("Nome do custo é obrigatório")
        if len(value.strip()) > 120:
            raise ValidationError("Nome do custo deve ter no máximo 120 caracteres")

    @validates("valor")
    def validate_valor(self, value, **kwargs):
        if value is None or value <= 0:
            raise ValidationError("Valor deve ser maior que 0")

    @validates("descricao")
    def validate_descricao(self, value, **kwargs):
        if not value or not value.strip():
            raise ValidationError("Descrição é obrigatória")

    @pre_load
    def normalizar_tipo(self, data, **kwargs):
        if not isinstance(data, dict):
            return data
        tipo = data.get("tipo")
        if not tipo:
            return data
        normalizado = normalizar_texto(str(tipo))
        if not normalizado:
            return data
        legado = self.LEGACY_TIPO_MAP.get(normalizado)
        if legado:
            data["tipo"] = legado
            return data
        for tipo_original in self.ALLOWED_TIPOS:
            if normalizar_texto(tipo_original) == normalizado:
                data["tipo"] = tipo_original
                break
        return data

    @validates("tipo")
    def validate_tipo(self, value, **kwargs):
        if value and normalizar_texto(value) not in self.ALLOWED_TIPOS_NORMALIZED:
            raise ValidationError("Tipo de custo inválido")


class ViagemRoteiroSchema(Schema):
    class Meta:
        unknown = EXCLUDE

    id = fields.Int(dump_only=True)
    viagem_id = fields.Int(dump_only=True)
    data = fields.Date(required=True)
    descricao = fields.Str(allow_none=True)
    created_at = fields.DateTime(dump_only=True)
    updated_at = fields.DateTime(dump_only=True)


class ViagemSchema(Schema):
    class Meta:
        unknown = EXCLUDE

    id = fields.Int(dump_only=True)
    usuario_id = fields.Int(dump_only=True)
    titulo = fields.Str(required=True)
    destino = fields.Str(required=True)
    data_inicio = fields.Date(required=True)
    data_termino = fields.Date(required=True)
    descricao = fields.Str(allow_none=True)
    status = fields.Str(load_default="Planejada")
    custo_total = fields.Decimal(as_string=True, dump_only=True)
    created_at = fields.DateTime(dump_only=True)
    updated_at = fields.DateTime(dump_only=True)
    custos = fields.List(fields.Nested(ViagemCustoSchema), dump_only=True)
    roteiros = fields.List(fields.Nested(ViagemRoteiroSchema), dump_only=True)

    ALLOWED_STATUS = {"Planejada", "Em andamento", "Finalizada", "Cancelada"}

    @validates("status")
    def validate_status(self, value, **kwargs):
        if value not in self.ALLOWED_STATUS:
            raise ValidationError("Status inválido")

    @validates("titulo")
    def validate_titulo(self, value, **kwargs):
        if not value or not value.strip():
            raise ValidationError("Título é obrigatório")
        if len(value.strip()) > 120:
            raise ValidationError("Título deve ter no máximo 120 caracteres")

    @validates("destino")
    def validate_destino(self, value, **kwargs):
        if not value or not value.strip():
            raise ValidationError("Destino é obrigatório")
        if len(value.strip()) > 120:
            raise ValidationError("Destino deve ter no máximo 120 caracteres")

    @validates_schema
    def validate_datas(self, data, **kwargs):
        inicio = data.get("data_inicio")
        termino = data.get("data_termino")
        if inicio and termino and termino < inicio:
            raise ValidationError({"data_termino": ["Data de término deve ser posterior ou igual à data de início"]})


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


# ======================
# Investimentos
# ======================


class InvestmentWalletSchema(Schema):
    class Meta:
        unknown = EXCLUDE

    id = fields.Int(dump_only=True)
    nome = fields.Str(required=True)
    cor = fields.Str(load_default="#2563eb")
    moeda = fields.Str(load_default="BRL")
    observacoes = fields.Str(allow_none=True)
    ativo = fields.Boolean(load_default=True)
    created_at = fields.DateTime(dump_only=True)
    updated_at = fields.DateTime(dump_only=True)

    @validates("nome")
    def validate_nome(self, value, **kwargs):
        if not value or not value.strip():
            raise ValidationError("Nome da carteira é obrigatório")
        if len(value.strip()) > 120:
            raise ValidationError("Nome da carteira deve ter no máximo 120 caracteres")

    @validates("moeda")
    def validate_moeda(self, value, **kwargs):
        if not value or len(value.strip()) > 10:
            raise ValidationError("Moeda inválida")


class InvestmentAssetSchema(Schema):
    class Meta:
        unknown = EXCLUDE

    id = fields.Int(dump_only=True)
    wallet_id = fields.Int(required=True)
    codigo = fields.Str(required=True)
    nome = fields.Str(required=True)
    tipo = fields.Str(required=True)
    setor = fields.Str(allow_none=True)
    bolsa = fields.Str(allow_none=True)
    moeda = fields.Str(load_default="BRL")
    ativo = fields.Boolean(load_default=True)
    created_at = fields.DateTime(dump_only=True)
    updated_at = fields.DateTime(dump_only=True)

    ALLOWED_TIPOS = {
        "Ações", "FIIs", "ETFs", "BDRs", "Tesouro Direto", "CDB", "LCI", "LCA",
        "Debêntures", "Fundos", "Criptomoedas", "Previdência"
    }

    @validates("tipo")
    def validate_tipo(self, value, **kwargs):
        if value not in self.ALLOWED_TIPOS:
            raise ValidationError("Tipo de ativo inválido")

    @validates("codigo")
    def validate_codigo(self, value, **kwargs):
        if not value or not value.strip():
            raise ValidationError("Código é obrigatório")
        if len(value.strip()) > 30:
            raise ValidationError("Código deve ter no máximo 30 caracteres")


class InvestmentTransactionSchema(Schema):
    class Meta:
        unknown = EXCLUDE

    id = fields.Int(dump_only=True)
    wallet_id = fields.Int(required=True)
    asset_id = fields.Int(allow_none=True)
    tipo = fields.Str(required=True)
    data_movimentacao = fields.Date(load_default=date.today)
    quantidade = fields.Decimal(as_string=True, allow_none=True)
    preco = fields.Decimal(as_string=True, allow_none=True)
    taxas = fields.Decimal(as_string=True, load_default="0")
    valor_total = fields.Decimal(as_string=True, load_default="0")
    corretora = fields.Str(allow_none=True)
    observacoes = fields.Str(allow_none=True)
    created_at = fields.DateTime(dump_only=True)
    updated_at = fields.DateTime(dump_only=True)

    tipo_nome = fields.Method("get_tipo_nome", dump_only=True)
    ativo_codigo = fields.Method("get_ativo_codigo", dump_only=True)
    ativo_nome = fields.Method("get_ativo_nome", dump_only=True)

    ALLOWED_TIPOS = {
        "Compra", "Venda", "Dividendos", "JCP", "Bonificação", "Split", "Grupamento", "Aporte", "Resgate"
    }

    def get_tipo_nome(self, obj):
        return getattr(obj, "tipo", None)

    def get_ativo_codigo(self, obj):
        if hasattr(obj, "ativo") and obj.ativo:
            return obj.ativo.codigo
        return None

    def get_ativo_nome(self, obj):
        if hasattr(obj, "ativo") and obj.ativo:
            return obj.ativo.nome
        return None

    @validates("tipo")
    def validate_tipo(self, value, **kwargs):
        if value not in self.ALLOWED_TIPOS:
            raise ValidationError("Tipo de movimentação inválido")

    @validates("wallet_id")
    def validate_wallet_id(self, value, **kwargs):
        if value <= 0:
            raise ValidationError("Carteira inválida")


class InvestmentQuoteSchema(Schema):
    class Meta:
        unknown = EXCLUDE

    id = fields.Int(dump_only=True)
    asset_id = fields.Int(required=True)
    provider = fields.Str(required=True)
    preco = fields.Decimal(as_string=True, required=True)
    variacao_percentual = fields.Decimal(as_string=True, allow_none=True)
    moeda = fields.Str(load_default="BRL")
    cotado_em = fields.DateTime(dump_only=True)
    created_at = fields.DateTime(dump_only=True)
    updated_at = fields.DateTime(dump_only=True)


class InvestmentProviderConfigSchema(Schema):
    class Meta:
        unknown = EXCLUDE

    id = fields.Int(dump_only=True)
    nome = fields.Str(required=True)
    ativo = fields.Boolean(load_default=True)
    prioridade = fields.Int(load_default=1)
    config_json = fields.Str(allow_none=True)
    created_at = fields.DateTime(dump_only=True)
    updated_at = fields.DateTime(dump_only=True)
