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


class CategoriaAlias(db.Model):
    __tablename__ = "categorias_alias"

    id = db.Column(db.Integer, primary_key=True)
    descricao_normalizada = db.Column(db.String(255), nullable=False, unique=True, index=True)
    descricao_exemplo = db.Column(db.String(255), nullable=False)
    categoria_id = db.Column(db.Integer, db.ForeignKey("categorias.id", ondelete="CASCADE"), nullable=False)
    ocorrencias = db.Column(db.Integer, default=1, nullable=False)
    origem = db.Column(db.String(30), default="usuario", nullable=False)  # 'usuario', 'ia', 'regra', 'historico'
    confianca = db.Column(db.Float, default=1.0, nullable=False)
    atualizado_em = db.Column(db.DateTime, default=db.func.now(), onupdate=db.func.now())

    categoria = db.relationship("Categoria", lazy=True)

    def __repr__(self):
        return f"<CategoriaAlias {self.descricao_normalizada} -> {self.categoria_id} (origem={self.origem})>"

class FormaPagamento(db.Model):
    __tablename__ = "formas_pagamento"

    id = db.Column(db.Integer, primary_key=True)
    nome = db.Column(db.String(120), nullable=False)
    # Tipo geral do método: Dinheiro, Cartão de Crédito, Cartão de Débito, Pix, Boleto, Transferência, etc.
    tipo = db.Column(db.String(30), nullable=False)
    # Indica se este método corresponde a um cartão de crédito (útil para relatórios e regras específicas)
    cartao_credito = db.Column(db.Boolean, default=False, nullable=False)
    dia_fechamento = db.Column(db.Integer, nullable=True)
    dia_vencimento = db.Column(db.Integer, nullable=True)
    ativo = db.Column(db.Boolean, default=True, nullable=False)
    icone = db.Column(db.Text, nullable=True)
    cor = db.Column(db.String(30), nullable=True)

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
    frequencia = db.Column(db.Enum("Diária", "Semanal", "Mensal", "Semestral", "Anual", name="frequencia_recorrencia"), nullable=True)
    recorrencia_tipo = db.Column(db.Enum("Assinatura", "Parcelamento", name="tipo_recorrencia"), nullable=True)
    data_fim = db.Column(db.Date, nullable=True)

    parcelado = db.Column(db.Boolean, default=False)
    total_parcelas = db.Column(db.Integer, nullable=True)
    parcela_atual = db.Column(db.Integer, default=1)
    valor_parcela = db.Column(db.Numeric(10, 2), nullable=True)
    # Identificador de grupo de parcelamento para deletar/gerenciar em conjunto
    parcelamento_id = db.Column(db.String(36), nullable=True)

    observacoes = db.Column(db.Text, nullable=True)
    competencia_fatura = db.Column(db.Date, nullable=True)
    identificador_externo = db.Column(db.String(120), unique=True, index=True, nullable=True)

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
    icone = db.Column(db.String(50), nullable=True, default="FileText")
    cor = db.Column(db.String(60), nullable=True, default="from-blue-600 to-indigo-700")
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
    emissor = db.Column(db.String(150), nullable=True)
    titular = db.Column(db.String(120), nullable=True)
    data_emissao = db.Column(db.Date, nullable=True)
    data_validade = db.Column(db.Date, nullable=True)
    cor_pass = db.Column(db.String(60), nullable=True)
    icone = db.Column(db.String(50), nullable=True)
    favorito = db.Column(db.Boolean, default=False, nullable=False)
    tags = db.Column(db.String(255), nullable=True)
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
    categoria_origem = db.Column(db.String(50), nullable=True)
    custo_reais = db.Column(db.Numeric(12, 2), nullable=True)
    taxa_bonus = db.Column(db.Numeric(5, 2), nullable=True)
    transferencia_id = db.Column(db.String(36), nullable=True)
    data_movimentacao = db.Column(db.Date, nullable=False, default=date.today)
    data_expiracao = db.Column(db.Date, nullable=True)
    descricao = db.Column(db.Text, nullable=True)

    created_at = db.Column(db.DateTime, default=db.func.now())
    updated_at = db.Column(db.DateTime, default=db.func.now(), onupdate=db.func.now())

    @property
    def cpm(self):
        """Custo por Milheiro (R$ / 1.000 milhas)."""
        if self.custo_reais is not None and self.quantidade and self.quantidade > 0:
            return round(float(self.custo_reais) / (float(self.quantidade) / 1000.0), 2)
        return None

    def __repr__(self):
        return f"<Milha {self.programa} tipo={self.tipo} qtd={self.quantidade}>"


# =======================
# Lembretes
# =======================


class Lembrete(db.Model):
    __tablename__ = "lembretes"

    id = db.Column(db.Integer, primary_key=True)
    usuario_id = db.Column(db.Integer, db.ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False)
    titulo = db.Column(db.String(120), nullable=False)
    descricao = db.Column(db.Text, nullable=True)
    categoria = db.Column(db.String(50), nullable=True)
    data_lembrete = db.Column(db.Date, nullable=True)
    hora_lembrete = db.Column(db.Time, nullable=True)
    status = db.Column(db.Enum("Pendente", "Concluído", name="status_lembrete"), nullable=False, default="Pendente")
    prioridade = db.Column(db.Enum("Baixa", "Média", "Alta", name="prioridade_lembrete"), nullable=False, default="Média")
    created_at = db.Column(db.DateTime, default=db.func.now())
    updated_at = db.Column(db.DateTime, default=db.func.now(), onupdate=db.func.now())

    usuario = db.relationship("Usuario", lazy=True)

    def __repr__(self):
        return f"<Lembrete {self.titulo} status={self.status}>"


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


# =======================
# Viagens
# =======================


class Viagem(db.Model):
    __tablename__ = "viagens"

    id = db.Column(db.Integer, primary_key=True)
    usuario_id = db.Column(db.Integer, db.ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False)
    titulo = db.Column(db.String(120), nullable=False)
    destino = db.Column(db.String(120), nullable=False)
    data_inicio = db.Column(db.Date, nullable=False)
    data_termino = db.Column(db.Date, nullable=False)
    descricao = db.Column(db.Text, nullable=True)
    status = db.Column(db.Enum("Planejada", "Em andamento", "Finalizada", "Cancelada", name="status_viagem"), nullable=False, default="Planejada")
    custo_total = db.Column(db.Numeric(12, 2), nullable=False, default=0)
    created_at = db.Column(db.DateTime, default=db.func.now())
    updated_at = db.Column(db.DateTime, default=db.func.now(), onupdate=db.func.now())

    custos = db.relationship(
        "ViagemCusto",
        backref="viagem",
        lazy=True,
        cascade="all, delete-orphan",
        order_by="ViagemCusto.data_gasto"
    )

    roteiros = db.relationship(
        "ViagemRoteiro",
        backref="viagem",
        lazy=True,
        cascade="all, delete-orphan",
        order_by="ViagemRoteiro.data"
    )

    def __repr__(self):
        return f"<Viagem {self.titulo} destino={self.destino}>"


class ViagemRoteiro(db.Model):
    __tablename__ = "viagens_roteiros"

    id = db.Column(db.Integer, primary_key=True)
    viagem_id = db.Column(db.Integer, db.ForeignKey("viagens.id", ondelete="CASCADE"), nullable=False)
    data = db.Column(db.Date, nullable=False)
    descricao = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=db.func.now())
    updated_at = db.Column(db.DateTime, default=db.func.now(), onupdate=db.func.now())

    def __repr__(self):
        return f"<ViagemRoteiro viagem={self.viagem_id} data={self.data}>"


class ViagemCusto(db.Model):
    __tablename__ = "viagens_custos"

    id = db.Column(db.Integer, primary_key=True)
    viagem_id = db.Column(db.Integer, db.ForeignKey("viagens.id", ondelete="CASCADE"), nullable=False)
    nome = db.Column(db.String(120), nullable=False)
    descricao = db.Column(db.String(255), nullable=False)
    observacao = db.Column(db.Text, nullable=True)
    link = db.Column(db.String(255), nullable=True)
    tipo = db.Column(
        db.Enum(
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
            name="tipo_custo_viagem"
        ),
        nullable=False,
        default="Atrações"
    )
    data_gasto = db.Column(db.Date, nullable=False, default=db.func.current_date)
    valor = db.Column(db.Numeric(12, 2), nullable=False)
    forma_pagamento = db.Column(db.String(80), nullable=True)
    created_at = db.Column(db.DateTime, default=db.func.now())
    updated_at = db.Column(db.DateTime, default=db.func.now(), onupdate=db.func.now())

    anexos = db.relationship("ViagemCustoAnexo", backref="custo", lazy=True, cascade="all, delete-orphan")

    def __repr__(self):
        return f"<ViagemCusto {self.nome} valor={self.valor}>"


class ViagemCustoAnexo(db.Model):
    __tablename__ = "viagens_custos_anexos"

    id = db.Column(db.Integer, primary_key=True)
    custo_id = db.Column(db.Integer, db.ForeignKey("viagens_custos.id", ondelete="CASCADE"), nullable=False)
    original_name = db.Column(db.String(255), nullable=False)
    stored_name = db.Column(db.String(255), nullable=False)
    mime_type = db.Column(db.String(100), nullable=False)
    size_bytes = db.Column(db.Integer, nullable=False)
    storage_path = db.Column(db.String(500), nullable=False)
    uploaded_at = db.Column(db.DateTime, default=db.func.now())

    def __repr__(self):
        return f"<ViagemCustoAnexo custo={self.custo_id} arquivo={self.original_name}>"


# =======================
# Investimentos
# =======================


class InvestmentWallet(db.Model):
    __tablename__ = "investment_wallets"

    id = db.Column(db.Integer, primary_key=True)
    nome = db.Column(db.String(120), nullable=False)
    cor = db.Column(db.String(20), nullable=False, default="#2563eb")
    moeda = db.Column(db.String(10), nullable=False, default="BRL")
    observacoes = db.Column(db.Text, nullable=True)
    ativo = db.Column(db.Boolean, nullable=False, default=True)
    created_at = db.Column(db.DateTime, default=db.func.now())
    updated_at = db.Column(db.DateTime, default=db.func.now(), onupdate=db.func.now())

    ativos = db.relationship("InvestmentAsset", backref="carteira", lazy=True, cascade="all, delete-orphan")
    movimentacoes = db.relationship("InvestmentTransaction", backref="carteira", lazy=True, cascade="all, delete-orphan")

    def __repr__(self):
        return f"<InvestmentWallet {self.nome}>"


class InvestmentAsset(db.Model):
    __tablename__ = "investment_assets"

    id = db.Column(db.Integer, primary_key=True)
    wallet_id = db.Column(db.Integer, db.ForeignKey("investment_wallets.id", ondelete="CASCADE"), nullable=False)
    codigo = db.Column(db.String(30), nullable=False)
    nome = db.Column(db.String(120), nullable=False)
    tipo = db.Column(
        db.Enum(
            "Ações",
            "FIIs",
            "ETFs",
            "BDRs",
            "Tesouro Direto",
            "CDB",
            "LCI",
            "LCA",
            "Debêntures",
            "Fundos",
            "Criptomoedas",
            "Previdência",
            name="investment_asset_type",
        ),
        nullable=False,
    )
    setor = db.Column(db.String(80), nullable=True)
    bolsa = db.Column(db.String(60), nullable=True)
    moeda = db.Column(db.String(10), nullable=False, default="BRL")
    ativo = db.Column(db.Boolean, nullable=False, default=True)
    created_at = db.Column(db.DateTime, default=db.func.now())
    updated_at = db.Column(db.DateTime, default=db.func.now(), onupdate=db.func.now())

    movimentacoes = db.relationship("InvestmentTransaction", backref="ativo", lazy=True)
    cotacoes = db.relationship("InvestmentQuote", backref="ativo_cotacao", lazy=True, cascade="all, delete-orphan")

    __table_args__ = (db.UniqueConstraint("wallet_id", "codigo", name="uq_investment_asset_wallet_codigo"),)

    def __repr__(self):
        return f"<InvestmentAsset {self.codigo}>"


class InvestmentTransaction(db.Model):
    __tablename__ = "investment_transactions"

    id = db.Column(db.Integer, primary_key=True)
    wallet_id = db.Column(db.Integer, db.ForeignKey("investment_wallets.id", ondelete="CASCADE"), nullable=False)
    asset_id = db.Column(db.Integer, db.ForeignKey("investment_assets.id", ondelete="SET NULL"), nullable=True)
    tipo = db.Column(
        db.Enum(
            "Compra",
            "Venda",
            "Dividendos",
            "JCP",
            "Bonificação",
            "Split",
            "Grupamento",
            "Aporte",
            "Resgate",
            name="investment_tx_type",
        ),
        nullable=False,
    )
    data_movimentacao = db.Column(db.Date, nullable=False, default=date.today)
    quantidade = db.Column(db.Numeric(18, 8), nullable=True)
    preco = db.Column(db.Numeric(18, 6), nullable=True)
    taxas = db.Column(db.Numeric(12, 2), nullable=False, default=0)
    valor_total = db.Column(db.Numeric(14, 2), nullable=False, default=0)
    corretora = db.Column(db.String(120), nullable=True)
    observacoes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=db.func.now())
    updated_at = db.Column(db.DateTime, default=db.func.now(), onupdate=db.func.now())

    def __repr__(self):
        return f"<InvestmentTransaction {self.tipo} wallet={self.wallet_id}>"


class InvestmentQuote(db.Model):
    __tablename__ = "investment_quotes"

    id = db.Column(db.Integer, primary_key=True)
    asset_id = db.Column(db.Integer, db.ForeignKey("investment_assets.id", ondelete="CASCADE"), nullable=False)
    provider = db.Column(db.String(50), nullable=False)
    preco = db.Column(db.Numeric(14, 6), nullable=False)
    variacao_percentual = db.Column(db.Numeric(8, 4), nullable=True)
    moeda = db.Column(db.String(10), nullable=False, default="BRL")
    cotado_em = db.Column(db.DateTime, nullable=False, default=db.func.now())
    created_at = db.Column(db.DateTime, default=db.func.now())
    updated_at = db.Column(db.DateTime, default=db.func.now(), onupdate=db.func.now())

    __table_args__ = (db.UniqueConstraint("asset_id", "provider", name="uq_investment_quote_asset_provider"),)

    def __repr__(self):
        return f"<InvestmentQuote asset={self.asset_id} provider={self.provider}>"


class InvestmentProviderConfig(db.Model):
    __tablename__ = "investment_providers"

    id = db.Column(db.Integer, primary_key=True)
    nome = db.Column(db.String(50), nullable=False, unique=True)
    ativo = db.Column(db.Boolean, nullable=False, default=True)
    prioridade = db.Column(db.Integer, nullable=False, default=1)
    config_json = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=db.func.now())
    updated_at = db.Column(db.DateTime, default=db.func.now(), onupdate=db.func.now())

    def __repr__(self):
        return f"<InvestmentProviderConfig {self.nome} ativo={self.ativo}>"


# =======================
# Open Finance (Pluggy)
# =======================

class OpenFinanceConexao(db.Model):
    __tablename__ = "openfinance_conexoes"

    id = db.Column(db.Integer, primary_key=True)
    usuario_id = db.Column(db.Integer, db.ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False)
    item_id = db.Column(db.String(100), unique=True, nullable=False, index=True)
    connector_id = db.Column(db.Integer, nullable=True)
    connector_name = db.Column(db.String(120), nullable=True)
    connector_image_url = db.Column(db.String(500), nullable=True)
    connector_primary_color = db.Column(db.String(30), nullable=True)
    status = db.Column(db.String(40), default="UPDATED", nullable=False)
    last_sync_at = db.Column(db.DateTime, nullable=True)
    consent_expires_at = db.Column(db.DateTime, nullable=True)
    erro_mensagem = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=db.func.now())
    updated_at = db.Column(db.DateTime, default=db.func.now(), onupdate=db.func.now())

    contas = db.relationship("OpenFinanceContaMap", backref="conexao", lazy=True, cascade="all, delete-orphan")

    def __repr__(self):
        return f"<OpenFinanceConexao {self.connector_name} item={self.item_id} status={self.status}>"


class OpenFinanceContaMap(db.Model):
    __tablename__ = "openfinance_contas_map"

    id = db.Column(db.Integer, primary_key=True)
    conexao_id = db.Column(db.Integer, db.ForeignKey("openfinance_conexoes.id", ondelete="CASCADE"), nullable=False)
    pluggy_account_id = db.Column(db.String(100), unique=True, nullable=False, index=True)
    tipo_pluggy = db.Column(db.String(30), nullable=False)  # 'CREDIT' | 'BANK'
    nome = db.Column(db.String(150), nullable=False)
    numero = db.Column(db.String(50), nullable=True)
    forma_pagamento_id = db.Column(db.Integer, db.ForeignKey("formas_pagamento.id", ondelete="SET NULL"), nullable=True)
    sincronizar = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=db.func.now())
    updated_at = db.Column(db.DateTime, default=db.func.now(), onupdate=db.func.now())

    forma_pagamento = db.relationship("FormaPagamento", lazy=True)

    def __repr__(self):
        return f"<OpenFinanceContaMap {self.nome} type={self.tipo_pluggy} account={self.pluggy_account_id} sinc={self.sincronizar}>"


class OpenFinanceFatura(db.Model):
    __tablename__ = "openfinance_faturas"

    id = db.Column(db.Integer, primary_key=True)
    conta_map_id = db.Column(db.Integer, db.ForeignKey("openfinance_contas_map.id", ondelete="CASCADE"), nullable=False)
    pluggy_bill_id = db.Column(db.String(100), unique=True, nullable=False, index=True)
    data_vencimento = db.Column(db.Date, nullable=False, index=True)
    data_fechamento = db.Column(db.Date, nullable=True)
    competencia = db.Column(db.Date, nullable=False, index=True)
    valor_total = db.Column(db.Float, nullable=False)
    valor_minimo = db.Column(db.Float, nullable=True)
    valor_pago = db.Column(db.Float, default=0.0, nullable=False)
    status = db.Column(db.String(30), default="PAGO", nullable=False)
    created_at = db.Column(db.DateTime, default=db.func.now())
    updated_at = db.Column(db.DateTime, default=db.func.now(), onupdate=db.func.now())

    conta_map = db.relationship("OpenFinanceContaMap", backref=db.backref("faturas", cascade="all, delete-orphan", lazy=True))

    def __repr__(self):
        return f"<OpenFinanceFatura bill={self.pluggy_bill_id} comp={self.competencia} total={self.valor_total} pago={self.valor_pago}>"



# =======================
# Metas e Orcamento Mensal
# =======================

class MetaOrcamento(db.Model):
    __tablename__ = "metas_orcamento"

    id = db.Column(db.Integer, primary_key=True)
    # escopo: 'global_despesa' | 'global_investimento' | 'categoria' | 'cartao'
    escopo = db.Column(db.String(30), nullable=False, index=True)
    categoria_id = db.Column(db.Integer, db.ForeignKey("categorias.id", ondelete="CASCADE"), nullable=True, index=True)
    forma_pagamento_id = db.Column(db.Integer, db.ForeignKey("formas_pagamento.id", ondelete="CASCADE"), nullable=True, index=True)
    valor_limite = db.Column(db.Numeric(12, 2), nullable=False)
    # Quando mes e ano sao NULL, vale como meta recorrente padrao para todos os meses.
    # Quando preenchidos, sobrescrevem (override) apenas aquele mes/ano especifico.
    mes = db.Column(db.Integer, nullable=True, index=True)
    ano = db.Column(db.Integer, nullable=True, index=True)
    ativo = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=db.func.now())
    updated_at = db.Column(db.DateTime, default=db.func.now(), onupdate=db.func.now())

    categoria = db.relationship("Categoria", lazy=True)
    forma_pagamento = db.relationship("FormaPagamento", lazy=True)

    def __repr__(self):
        periodo = f"{self.mes:02d}/{self.ano}" if (self.mes and self.ano) else "Padrao"
        return f"<MetaOrcamento {self.escopo} cat={self.categoria_id} fp={self.forma_pagamento_id} R${self.valor_limite} [{periodo}]>"
