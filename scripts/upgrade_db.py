import os
import sys
import traceback

# Garantir que o diretório raiz do projeto está no sys.path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from app import create_app
from flask_migrate import upgrade

if __name__ == '__main__':
    app = create_app()
    with app.app_context():
        try:
            # Quando houver múltiplos heads, usar 'heads' para aplicar todos os ramos
            upgrade(revision='heads')
            print('Flask-Migrate upgrade completed.')
        except Exception:
            print('Erro ao aplicar migração:')
            traceback.print_exc()
            raise
