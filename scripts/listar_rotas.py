
import sys
import os
from flask import current_app

# Garante que o diretório raiz do projeto está no sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

def listar_rotas():
    output = []
    for rule in current_app.url_map.iter_rules():
        methods = ','.join(rule.methods)
        line = f"{rule.endpoint:30s} {methods:20s} {str(rule)}"
        output.append(line)
    return '\n'.join(sorted(output))

if __name__ == "__main__":
    from app import create_app
    app = create_app()
    with app.app_context():
        print(listar_rotas())
