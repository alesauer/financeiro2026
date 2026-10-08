import sys, os
sys.path.insert(0, os.path.abspath('.'))
import json
from datetime import datetime, date
from decimal import Decimal
from sqlalchemy import extract
from app import create_app
from app.models import db, Transacao, Categoria, FormaPagamento
from services.fatura_service import calcular_competencia_fatura

def get_category_map():
    cats = {c.nome.lower(): c for c in Categoria.query.all()}
    
    mapping = {
        'salário': cats.get('salário') or cats.get('salario mensal'),
        'salario': cats.get('salário') or cats.get('salario mensal'),
        'educação': cats.get('educação') or cats.get('educacao'),
        'carro': cats.get('carro'),
        'celular': cats.get('celular'),
        'diversos': cats.get('outros'),
        'energia': cats.get('energia'),
        'filho': cats.get('filho'),
        'imposto': cats.get('imposto'),
        'internet': cats.get('internet'),
        'moradia': cats.get('moradia'),
        'recreativo': cats.get('recreativo'),
        'repasse': cats.get('repasse'),
        'temp': cats.get('temp'),
        'lazer': cats.get('lazer'),
        'serviços': cats.get('serviços') or cats.get('servicos'),
        'investimento': cats.get('renda fixa') or cats.get('reserva de emergência') or cats.get('outros'),
    }
    return mapping, cats

def execute_import(commit=True):
    app = create_app()
    with app.app_context():
        cat_map, all_cats = get_category_map()
        
        forma_pix = FormaPagamento.query.filter(FormaPagamento.nome.ilike('%pix%')).first() or FormaPagamento.query.get(2)
        forma_transf = FormaPagamento.query.filter(FormaPagamento.nome.ilike('%transf%')).first() or FormaPagamento.query.get(3)
        forma_debito = FormaPagamento.query.filter(FormaPagamento.nome.ilike('%d_bito aut%')).first() or FormaPagamento.query.get(10)
        forma_nubank = FormaPagamento.query.filter(FormaPagamento.nome.ilike('%nubank%')).first() or FormaPagamento.query.get(6)
        forma_c6 = FormaPagamento.query.filter(FormaPagamento.nome.ilike('%c6%')).first() or FormaPagamento.query.get(12)
        
        # 1. Clean up old fake seed data in 2026:
        non_card_ids = [f.id for f in FormaPagamento.query.filter_by(cartao_credito=False).all()]
        del_noncard = Transacao.query.filter(
            extract('year', Transacao.data_transacao) == 2026,
            Transacao.forma_pagamento_id.in_(non_card_ids)
        ).delete(synchronize_session=False)
        
        # Fake card transactions on Forma 11 and Forma 12 in 2026
        del_f11_f12 = Transacao.query.filter(
            extract('year', Transacao.data_transacao) == 2026,
            Transacao.forma_pagamento_id.in_([11, 12])
        ).delete(synchronize_session=False)
        
        print(f"Limpeza de dados antigos 2026:")
        print(f"  Transações não-cartão removidas: {del_noncard}")
        print(f"  Transações mock formas 11/12 removidas: {del_f11_f12}")
        
        # 2. Load JSON
        json_path = 'contas_2026.json' if os.path.exists('contas_2026.json') else r'C:/Users/m23621/.gemini/antigravity-ide/brain/01a39075-47d2-47f5-b180-b151bb855772/.user_uploaded/media_1791463101163.json'
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
        lancamentos = data.get('lancamentos', [])
        print(f"\nTotal no JSON: {len(lancamentos)}")
        
        inserted_count = 0
        skipped_count = 0
        
        for item in lancamentos:
            item_id = item.get('id', '')
            data_str = item.get('data')
            dt = datetime.strptime(data_str, '%Y-%m-%d').date()
            mes = dt.month
            grupo = item.get('grupo', '')
            desc = (item.get('descricao') or '').strip()
            
            # Regra: ignore o cartao de credito de set/out
            if mes in (9, 10) and (grupo == 'Cartões' or item_id in ('set26-030', 'set26-031', 'out26-029', 'out26-030')):
                skipped_count += 1
                continue
                
            tipo_raw = item.get('tipo', '').lower()
            tipo = 'Receita' if tipo_raw == 'receita' else 'Despesa'
            cat_raw = (item.get('categoria') or '').strip().lower()
            valor = Decimal(str(item.get('valor') or 0.0))
            pg = item.get('pg')
            status = 'Pago' if pg and str(pg).strip().lower() == 'ok' else 'Pendente'
            obs = str(item['observacao']) if item.get('observacao') is not None else None
            
            # Resolve category
            cat_obj = None
            if cat_raw in cat_map and cat_map[cat_raw]:
                cat_obj = cat_map[cat_raw]
            elif cat_raw in all_cats:
                cat_obj = all_cats[cat_raw]
            else:
                if desc.lower() == 'dinheiro e cc':
                    cat_obj = all_cats.get('serviços') or all_cats.get('salário')
                elif 'formatura' in desc.lower():
                    cat_obj = all_cats.get('educação')
                elif 'investimento' in desc.lower():
                    cat_obj = all_cats.get('renda fixa') or all_cats.get('outros')
                elif tipo == 'Receita':
                    cat_obj = all_cats.get('salário')
                else:
                    cat_obj = all_cats.get('outros')
                    
            # Resolve payment method
            competencia = None
            if grupo == 'Cartões':
                if 'c6' in desc.lower():
                    forma_obj = forma_c6
                    competencia = date(2026, mes, 1)
                else:
                    forma_obj = forma_nubank
                    # Fatura Nubank com vencimento no mês `mes` tem competência do ciclo anterior (mes - 1)
                    competencia = date(2025 if mes == 1 else 2026, 12 if mes == 1 else mes - 1, 1)
            elif tipo == 'Receita':
                forma_obj = forma_transf
            else:
                # Despesas Fixas
                if obs and ('pix' in obs.lower() or '@' in obs.lower()):
                    forma_obj = forma_pix
                elif desc in ('CEMIG (Link)', 'Blink', 'Condomínio', 'IPTU - Link', 'Mei Kiki', 'Vivo Kiki'):
                    forma_obj = forma_debito or forma_pix
                else:
                    forma_obj = forma_pix
                    
            t = Transacao(
                tipo=tipo,
                categoria_id=cat_obj.id,
                descricao=desc,
                valor=valor,
                data_transacao=dt,
                forma_pagamento_id=forma_obj.id,
                status=status,
                recorrente=False,
                parcelado=False,
                parcela_atual=1,
                observacoes=obs,
                competencia_fatura=competencia,
            )
            db.session.add(t)
            inserted_count += 1
            
        if commit:
            db.session.commit()
            print(f"\nImportação concluída e comitada!")
        else:
            db.session.rollback()
            print(f"\n[DRY-RUN] Rollback executado!")
            
        print(f"Transações inseridas: {inserted_count}")
        print(f"Transações ignoradas (Cartões Set/Out): {skipped_count}")

if __name__ == '__main__':
    execute_import(commit=True)
