#!/usr/bin/env bash
set -e

flask --app run.py db upgrade heads || true

python - <<'PY'
from app import create_app, db
from sqlalchemy import inspect

app = create_app()

with app.app_context():
    insp = inspect(db.engine)
    existing = set(insp.get_table_names())
    required = {"usuarios", "transacoes", "categorias", "formas_pagamento"}
    missing = required - existing

    if missing:
        db.create_all()
        print(f"[docker] Tabelas ausentes criadas via SQLAlchemy: {sorted(missing)}")
    else:
        print("[docker] Schema essencial já está presente")
PY

flask --app run.py db stamp heads || true

exec python -c "from app import create_app; app = create_app(); app.run(host='0.0.0.0', port=5000)"
