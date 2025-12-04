from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_cors import CORS
from .config import Config

db = SQLAlchemy()
migrate = Migrate()

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    db.init_app(app)
    migrate.init_app(app, db)
    CORS(app)
    #from . import models

    
    # Registrar blueprints
    from .routes_categorias import bp_categorias
    from .routes_transacoes import bp_transacoes
    from .routes_relatorios import bp_relatorios

    app.register_blueprint(bp_categorias, url_prefix="/api/categorias")
    app.register_blueprint(bp_transacoes, url_prefix="/api/transacoes")
    app.register_blueprint(bp_relatorios, url_prefix="/api/relatorios")

    return app