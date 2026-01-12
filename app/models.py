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