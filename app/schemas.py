from marshmallow import Schema, fields, validates, ValidationError
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
    id = fields.Int(dump_only=True)

    # --- Campos obrigatórios ---
    tipo = fields.Str(required=True)
    categoria_id = fields.Int(required=True)
    descricao = fields.Str(required=True)
    valor = fields.Decimal(required=True, as_string=True)
    forma_pagamento = fields.Str(required=True)
    # Campo extra: nome da categoria
    categoria_nome = fields.Method("get_categoria_nome", dump_only=True)

    def get_categoria_nome(self, obj):
        # obj é uma instância de Transacao
        if hasattr(obj, "categoria") and obj.categoria:
            return obj.categoria.nome
        return None

    # --- Campos com default ---
    data_transacao = fields.Date(load_default=date.today)
    status = fields.Str(load_default="Pago")

    recorrente = fields.Boolean(load_default=False)
    frequencia = fields.Str(allow_none=True)
    data_fim = fields.Date(allow_none=True)

    parcelado = fields.Boolean(load_default=False)
    total_parcelas = fields.Int(allow_none=True)
    parcela_atual = fields.Int(load_default=1)
    valor_parcela = fields.Decimal(as_string=True, allow_none=True)

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
        if value and value not in ["Diária", "Semanal", "Mensal", "Anual"]:
            raise ValidationError("Frequência inválida")

    @validates("status")
    def validate_status(self, value, **kwargs):
        if value not in ["Pago", "Pendente"]:
            raise ValidationError("Status inválido")

    @validates("tipo")
    def validate_tipo(self, value, **kwargs):
        if value not in ["Receita", "Despesa", "Investimento"]:
            raise ValidationError("Tipo deve ser Receita, Despesa ou Investimento")
