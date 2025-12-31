import sys
from pathlib import Path

# Garantir que o diretório do projeto esteja no sys.path
proj_root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(proj_root))

from app import create_app, db
from sqlalchemy import inspect

app = create_app()
with app.app_context():
    insp = inspect(db.engine)
    tables = insp.get_table_names()
    print('tables in DB:', tables)
