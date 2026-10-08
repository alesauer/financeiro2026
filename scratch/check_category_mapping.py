import sys, os
sys.path.insert(0, os.path.abspath('.'))
import json
from app import create_app
from app.models import db, Categoria, FormaPagamento

app = create_app()
with app.app_context():
    db_cats = {c.nome.lower(): c for c in Categoria.query.all()}
    print(f"DB Categories count: {len(db_cats)}")
    for c in sorted(Categoria.query.all(), key=lambda x: (x.tipo, x.nome)):
        print(f"  [{c.tipo}] ID {c.id:3d}: {c.nome}")
    
    json_path = r'C:/Users/m23621/.gemini/antigravity-ide/brain/01a39075-47d2-47f5-b180-b151bb855772/.user_uploaded/media_1791463101163.json'
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    cats_only = set((l['tipo'], l.get('categoria')) for l in data['lancamentos'])
    print('\nDistinct (tipo, categoria) in JSON:')
    for t, c in sorted(cats_only, key=lambda x: (x[0], str(x[1]))):
        # find matching items
        sample_descs = [l['descricao'] for l in data['lancamentos'] if l['tipo'] == t and l.get('categoria') == c][:3]
        print(f"  Tipo: {t:7s} | Categoria: {str(c):15s} | Ex: {sample_descs}")
