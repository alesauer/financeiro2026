#!/usr/bin/env bash
set -e

if [ -f "/app/backups/financas_seed.db" ]; then
    if [ ! -f "/data/financas.db" ]; then
        cp /app/backups/financas_seed.db /data/financas.db
        echo "[docker] Banco inicializado a partir de /app/backups/financas_seed.db"
    else
        python - <<'PY_SEED'
import shutil, sqlite3
try:
    conn = sqlite3.connect("/data/financas.db")
    cur = conn.cursor()
    cur.execute("SELECT count(*) FROM transacoes")
    qtd = cur.fetchone()[0]
    conn.close()
    if qtd == 0:
        shutil.copy2("/app/backups/financas_seed.db", "/data/financas.db")
        print("[docker] Banco vazio detectado; populado automaticamente a partir de /app/backups/financas_seed.db")
except Exception:
    pass
PY_SEED
    fi
fi

flask --app run.py db upgrade heads || true

python - <<'PY'
from app import create_app, db
from sqlalchemy import inspect, text

app = create_app()

with app.app_context():
    insp = inspect(db.engine)
    existing = set(insp.get_table_names())
    required = {"usuarios", "transacoes", "categorias", "formas_pagamento", "categorias_alias"}
    missing = required - existing

    if missing:
        db.create_all()
        print(f"[docker] Tabelas ausentes criadas via SQLAlchemy: {sorted(missing)}")
    else:
        print("[docker] Schema essencial já está presente")

    # Garantir colunas essenciais em categorias_alias
    if "categorias_alias" in set(insp.get_table_names()):
        cols = {c["name"] for c in inspect(db.engine).get_columns("categorias_alias")}
        if "origem" not in cols:
            try:
                db.session.execute(text("ALTER TABLE categorias_alias ADD COLUMN origem VARCHAR(30) DEFAULT 'usuario'"))
                db.session.commit()
                print("[docker] Coluna origem adicionada a categorias_alias")
            except Exception as e:
                db.session.rollback()
        if "confianca" not in cols:
            try:
                db.session.execute(text("ALTER TABLE categorias_alias ADD COLUMN confianca FLOAT DEFAULT 1.0"))
                db.session.commit()
                print("[docker] Coluna confianca adicionada a categorias_alias")
            except Exception as e:
                db.session.rollback()
PY

flask --app run.py db stamp heads || true

exec python -c "from app import create_app; app = create_app(); app.run(host='0.0.0.0', port=5000)"
