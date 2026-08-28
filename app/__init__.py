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

    return app
