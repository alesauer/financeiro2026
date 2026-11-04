from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from .config import Config

db = SQLAlchemy()
migrate = Migrate()

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    # Aceitar URLs com e sem barra final para evitar redirects 308
    app.url_map.strict_slashes = False


    db.init_app(app)
    migrate.init_app(app, db)
    # Modo diagnóstico: aceitar qualquer origem em /api/*
    CORS(
        app,
        resources={
            r"/api/*": {
                "origins": "*",
                "allow_headers": ["Content-Type", "Authorization"],
                "methods": ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
            }
        },
        supports_credentials=False
    )

    # Inicializar JWT
    jwt = JWTManager(app)

    # Handlers de erro JWT
    @jwt.expired_token_loader
    def expired_token_callback(jwt_header, jwt_payload):
        return {"error": "Token expirado"}, 401

    @jwt.invalid_token_loader
    def invalid_token_callback(error):
        return {"error": "Token invÃ¡lido"}, 422

    @jwt.unauthorized_loader
    def missing_token_callback(error):
        return {"error": "Token ausente"}, 401

    
    # Registrar blueprints

    from .routes_categorias import bp_categorias
    from .routes_transacoes import bp_transacoes
    from .routes_relatorios import bp_relatorios
    from .routes_ia import bp_ia
    from .routes_importacao import bp_importacao
    from .routes_usuarios import bp_usuarios
    from .routes_formas_pagamento import bp_formas_pagamento
    from .routes_documentos import bp_documentos
    from .routes_milhas import bp_milhas
    from .routes_config import bp_config
    from .routes_lembretes import bp_lembretes
    from .routes_viagens import bp_viagens
    from .routes_investimentos import bp_investimentos
    from .routes_openfinance import bp_openfinance
    from .routes_metas import bp_metas

    app.register_blueprint(bp_categorias, url_prefix="/api/categorias")
    app.register_blueprint(bp_transacoes, url_prefix="/api/transacoes")
    app.register_blueprint(bp_relatorios, url_prefix="/api/relatorios")
    app.register_blueprint(bp_ia, url_prefix="/api/ia")
    app.register_blueprint(bp_importacao, url_prefix="/api")
    app.register_blueprint(bp_usuarios, url_prefix="/api/usuarios")
    app.register_blueprint(bp_formas_pagamento, url_prefix="/api/formas_pagamento")
    app.register_blueprint(bp_documentos, url_prefix="/api/documentos")
    app.register_blueprint(bp_milhas, url_prefix="/api/milhas")
    app.register_blueprint(bp_config, url_prefix="/api/config")
    app.register_blueprint(bp_lembretes, url_prefix="/api/lembretes")
    app.register_blueprint(bp_viagens, url_prefix="/api/viagens")
    app.register_blueprint(bp_investimentos, url_prefix="/api/investimentos")
    app.register_blueprint(bp_openfinance)
    app.register_blueprint(bp_metas, url_prefix="/api/metas")

    # Garantir integridade de schema e auto-healing para SQLite e MySQL
    with app.app_context():
        _garantir_schema_banco()

    return app


def _garantir_schema_banco():
    """Garante que tabelas e colunas essenciais existam no banco de dados automaticamente."""
    try:
        from sqlalchemy import inspect, text
        insp = inspect(db.engine)
        tables = set(insp.get_table_names())

        # 1. Cria tabelas declaradas que ainda não existam
        db.create_all()

        # 2. Se categorias_alias existe, garante que as colunas 'origem' e 'confianca' existam
        if "categorias_alias" in tables:
            cols = {c["name"] for c in insp.get_columns("categorias_alias")}
            if "origem" not in cols:
                try:
                    db.session.execute(text("ALTER TABLE categorias_alias ADD COLUMN origem VARCHAR(30) DEFAULT 'usuario'"))
                    db.session.commit()
                except Exception:
                    db.session.rollback()

            if "confianca" not in cols:
                try:
                    db.session.execute(text("ALTER TABLE categorias_alias ADD COLUMN confianca FLOAT DEFAULT 1.0"))
                    db.session.commit()
                except Exception:
                    db.session.rollback()

        # 3. Se formas_pagamento existe, garante colunas 'icone' e 'cor'
        if "formas_pagamento" in tables:
            cols_fp = {c["name"] for c in insp.get_columns("formas_pagamento")}
            if "icone" not in cols_fp:
                try:
                    db.session.execute(text("ALTER TABLE formas_pagamento ADD COLUMN icone TEXT"))
                    db.session.commit()
                except Exception:
                    db.session.rollback()

            if "cor" not in cols_fp:
                try:
                    db.session.execute(text("ALTER TABLE formas_pagamento ADD COLUMN cor VARCHAR(30)"))
                    db.session.commit()
                except Exception:
                    db.session.rollback()

            # Auto-popular ícones conhecidos se ainda não estiverem definidos
            try:
                from .models import FormaPagamento
                fps = FormaPagamento.query.all()
                for fp in fps:
                    if not fp.icone:
                        nome_low = (fp.nome or "").lower()
                        if "nubank" in nome_low:
                            fp.icone = "preset:nubank"
                            fp.cor = "#820AD1"
                        elif "c6" in nome_low:
                            fp.icone = "preset:c6"
                            fp.cor = "#242424"
                        elif "inter" in nome_low:
                            fp.icone = "preset:inter"
                            fp.cor = "#FF7A00"
                        elif "itaú" in nome_low or "itau" in nome_low:
                            fp.icone = "preset:itau"
                            fp.cor = "#EC7000"
                        elif "bradesco" in nome_low:
                            fp.icone = "preset:bradesco"
                            fp.cor = "#CC092F"
                        elif "santander" in nome_low:
                            fp.icone = "preset:santander"
                            fp.cor = "#EA1D25"
                        elif "brasil" in nome_low or "bb" in nome_low:
                            fp.icone = "preset:bb"
                            fp.cor = "#FCE000"
                        elif "caixa" in nome_low:
                            fp.icone = "preset:caixa"
                            fp.cor = "#0066B3"
                        elif "xp" in nome_low:
                            fp.icone = "preset:xp"
                            fp.cor = "#000000"
                        elif "btg" in nome_low:
                            fp.icone = "preset:btg"
                            fp.cor = "#0B1D3A"
                        elif "pix" in nome_low or fp.tipo == "Pix":
                            fp.icone = "preset:pix"
                            fp.cor = "#32BCAD"
                        elif "dinheiro" in nome_low or fp.tipo == "Dinheiro":
                            fp.icone = "preset:dinheiro"
                            fp.cor = "#10B981"
                        elif fp.cartao_credito:
                            fp.icone = "preset:generic_card"
                            fp.cor = "#3B82F6"
                db.session.commit()
            except Exception:
                db.session.rollback()

        # 4. Garantir existência da categoria 'Cuidados Pessoais' como Despesa
        if "categorias" in tables:
            from .models import Categoria, Transacao, FormaPagamento, CategoriaAlias
            cat_cuidados = Categoria.query.filter_by(nome="Cuidados Pessoais", tipo="Despesa").first()
            if not cat_cuidados:
                cat_cuidados = Categoria(nome="Cuidados Pessoais", tipo="Despesa")
                db.session.add(cat_cuidados)
                db.session.commit()

            # 5. Auto-healing: corrigir transações de cartão de crédito indevidamente gravadas como Receita
            # (preservando estornos, iof de volta e reembolsos legítimos)
            try:
                trans_corrigir = (
                    Transacao.query.join(FormaPagamento)
                    .filter(FormaPagamento.cartao_credito.is_(True), Transacao.tipo == "Receita")
                    .all()
                )
                for t in trans_corrigir:
                    desc_low = (t.descricao or "").lower()
                    if not any(w in desc_low for w in ["estorno", "iof de volta", "devolu", "reembolso", "cancelamento"]):
                        t.tipo = "Despesa"
                        # Se estava na categoria Serviços (Receita), migra para Cuidados Pessoais
                        if t.categoria and t.categoria.tipo == "Receita":
                            t.categoria_id = cat_cuidados.id
                if trans_corrigir:
                    db.session.commit()
            except Exception:
                db.session.rollback()

            # 6. Auto-healing: corrigir aliases de despesas que apontavam para Serviços (Receita)
            try:
                cat_servicos_receita = Categoria.query.filter_by(nome="Serviços", tipo="Receita").first()
                if cat_servicos_receita:
                    aliases_corrigir = CategoriaAlias.query.filter_by(categoria_id=cat_servicos_receita.id).all()
                    for a in aliases_corrigir:
                        a.categoria_id = cat_cuidados.id
                    if aliases_corrigir:
                        db.session.commit()
            except Exception:
                db.session.rollback()
    except Exception:
        # Não bloquear inicialização caso o banco esteja inacessível durante migrações externas
        pass

