from datetime import date
from . import db

class Categoria(db.Model):
    __tablename__ = "categorias"

    id = db.Column(db.Integer, primary_key=True)
    nome = db.Column(db.String(100), nullable=False)
    tipo = db.Column(db.Enum("Receita", "Despesa", "Investimento", name="tipo_categoria"), nullable=False)

    transacoes = db.relationship("Transacao", backref="categoria", lazy=True,cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Categoria {self.nome} ({self.tipo})>"

class FormaPagamento(db.Model):
    __tablename__ = "formas_pagamento"

    id = db.Column(db.Integer, primary_key=True)
    nome = db.Column(db.String(120), nullable=False)
    # Tipo geral do método: Dinheiro, Cartão de Crédito, Cartão de Débito, Pix, Boleto, Transferência, etc.
    tipo = db.Column(db.String(30), nullable=False)
    # Indica se este método corresponde a um cartão de crédito (útil para relatórios e regras específicas)
    cartao_credito = db.Column(db.Boolean, default=False, nullable=False)
    ativo = db.Column(db.Boolean, default=True, nullable=False)

    def __repr__(self):
        flag = "CC" if self.cartao_credito else "Geral"
        return f"<FormaPagamento {self.nome} [{self.tipo} | {flag}]>"


class Usuario(db.Model):
    __tablename__ = "usuarios"

    id = db.Column(db.Integer, primary_key=True)
    nome = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    senha_hash = db.Column(db.String(256), nullable=False)
    data_criacao = db.Column(db.DateTime, default=db.func.now())

    def __repr__(self):
        return f"<Usuario {self.email}>"

class Transacao(db.Model):
    __tablename__ = "transacoes"

    id = db.Column(db.Integer, primary_key=True)
    tipo = db.Column(db.Enum("Receita", "Despesa", "Investimento", name="tipo_transacao"), nullable=False)
    categoria_id = db.Column(db.Integer, db.ForeignKey("categorias.id", ondelete="CASCADE"), nullable=False)

    descricao = db.Column(db.String(255), nullable=False)
    valor = db.Column(db.Numeric(10, 2), nullable=False)
    data_transacao = db.Column(db.Date, default=date.today, nullable=False)
    # Nova modelagem: vínculo para formas_pagamento
    forma_pagamento_id = db.Column(db.Integer, db.ForeignKey("formas_pagamento.id"), nullable=False)
    forma_pagamento = db.relationship("FormaPagamento", lazy=True)

    status = db.Column(db.Enum("Pago", "Pendente", name="status_transacao"), default="Pago")

    recorrente = db.Column(db.Boolean, default=False)
    frequencia = db.Column(db.Enum("Diária", "Semanal", "Mensal", "Anual", name="frequencia_recorrencia"), nullable=True)
    data_fim = db.Column(db.Date, nullable=True)

    parcelado = db.Column(db.Boolean, default=False)
    total_parcelas = db.Column(db.Integer, nullable=True)
    parcela_atual = db.Column(db.Integer, default=1)
    valor_parcela = db.Column(db.Numeric(10, 2), nullable=True)

    observacoes = db.Column(db.Text, nullable=True)

    def __repr__(self):
        return f"<Transacao {self.tipo} - {self.descricao} R${self.valor}>"


# =======================
# Documentos
# =======================

class TipoDocumento(db.Model):
    __tablename__ = "tipos_documentos"

    id = db.Column(db.Integer, primary_key=True)
    nome = db.Column(db.String(100), nullable=False, unique=True)
    descricao = db.Column(db.String(255), nullable=True)
    ativo = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=db.func.now())
    updated_at = db.Column(db.DateTime, default=db.func.now(), onupdate=db.func.now())

    documentos = db.relationship("Documento", backref="tipo_documento", lazy=True, cascade="all, delete-orphan")

    def __repr__(self):
        return f"<TipoDocumento {self.nome} ativo={self.ativo}>"


class Documento(db.Model):
    __tablename__ = "documentos"

    id = db.Column(db.Integer, primary_key=True)
    usuario_id = db.Column(db.Integer, db.ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False)
    tipo_documento_id = db.Column(db.Integer, db.ForeignKey("tipos_documentos.id", ondelete="RESTRICT"), nullable=False)

    nome = db.Column(db.String(150), nullable=False)
    registro = db.Column(db.String(120), nullable=True)
    outras_informacoes = db.Column(db.Text, nullable=True)

    created_at = db.Column(db.DateTime, default=db.func.now())
    updated_at = db.Column(db.DateTime, default=db.func.now(), onupdate=db.func.now())

    anexos = db.relationship("DocumentoAnexo", backref="documento", lazy=True, cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Documento {self.nome} usuario={self.usuario_id} tipo={self.tipo_documento_id}>"


class DocumentoAnexo(db.Model):
    __tablename__ = "documentos_anexos"

    id = db.Column(db.Integer, primary_key=True)
    documento_id = db.Column(db.Integer, db.ForeignKey("documentos.id", ondelete="CASCADE"), nullable=False)

    original_name = db.Column(db.String(255), nullable=False)
    stored_name = db.Column(db.String(255), nullable=False)
    mime_type = db.Column(db.String(100), nullable=False)
    size_bytes = db.Column(db.Integer, nullable=False)
    storage_path = db.Column(db.String(500), nullable=False)
    uploaded_at = db.Column(db.DateTime, default=db.func.now())

    def __repr__(self):
        return f"<DocumentoAnexo doc={self.documento_id} arquivo={self.original_name}>"


# =======================
# Milhas
# =======================

class Milha(db.Model):
    __tablename__ = "milhas"

    id = db.Column(db.Integer, primary_key=True)
    usuario_id = db.Column(db.Integer, db.ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False)

    programa = db.Column(db.String(100), nullable=False)
    tipo = db.Column(db.String(10), nullable=False)  # 'entrada' | 'saida' (validado no schema)
    quantidade = db.Column(db.Integer, nullable=False)
    origem = db.Column(db.String(120), nullable=True)
    data_movimentacao = db.Column(db.Date, nullable=False, default=date.today)
    data_expiracao = db.Column(db.Date, nullable=True)
    descricao = db.Column(db.Text, nullable=True)

    created_at = db.Column(db.DateTime, default=db.func.now())
    updated_at = db.Column(db.DateTime, default=db.func.now(), onupdate=db.func.now())

    def __repr__(self):
        return f"<Milha {self.programa} tipo={self.tipo} qtd={self.quantidade}>"


# =======================
# Configurações (chave/valor JSON)
# =======================

class Configuracao(db.Model):
    __tablename__ = "configuracoes"

    id = db.Column(db.Integer, primary_key=True)
    chave = db.Column(db.String(100), unique=True, nullable=False)
    valor = db.Column(db.Text, nullable=False)  # JSON serializado
    updated_at = db.Column(db.DateTime, default=db.func.now(), onupdate=db.func.now())

    def __repr__(self):
        return f"<Configuracao {self.chave}>"