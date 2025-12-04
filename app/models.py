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


class Transacao(db.Model):
    __tablename__ = "transacoes"

    id = db.Column(db.Integer, primary_key=True)
    tipo = db.Column(db.Enum("Receita", "Despesa", "Investimento", name="tipo_transacao"), nullable=False)
    categoria_id = db.Column(db.Integer, db.ForeignKey("categorias.id", ondelete="CASCADE"), nullable=False)

    descricao = db.Column(db.String(255), nullable=False)
    valor = db.Column(db.Numeric(10, 2), nullable=False)
    data_transacao = db.Column(db.Date, default=date.today, nullable=False)

    forma_pagamento = db.Column(
        db.Enum(
            "Dinheiro", "Cartão de Crédito", "Cartão de Débito",
            "Pix", "Boleto", "Transferência",
            name="forma_pagamento"
        ),
        nullable=False
    )

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