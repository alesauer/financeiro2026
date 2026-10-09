from flask import Blueprint, request, jsonify
from marshmallow import ValidationError
from app import db
from app.models import Categoria, CategoriaAlias
from app.schemas import CategoriaSchema
from flask_jwt_extended import jwt_required
from services.categorization.rules import REGRAS_DETERMINISTICAS
from services.categorization.normalizer import normalizar_descricao
from services.categorization.engine import CategorizationEngine
from services.categorization.history import salvar_ou_atualizar_alias

bp_categorias = Blueprint("categorias", __name__)
schema = CategoriaSchema()
schemas = CategoriaSchema(many=True)

# Exemplos amigáveis e descrições humanas para cada regra determinística do sistema
EXEMPLOS_REGRAS_SISTEMA = {
    "Compras Online": {
        "icone": "ShoppingCart",
        "exemplos": ["Mercado Livre", "Shopee", "Amazon", "AliExpress", "Shein", "Temu", "Kabum", "Pichau", "Terabyte", "Enjoei", "TikTok Shop"],
        "descricao": "Grandes plataformas de e-commerce e marketplaces nacionais e internacionais.",
    },
    "Combustível": {
        "icone": "Fuel",
        "exemplos": ["Petrobras Premmia", "Posto Chefão", "Shell", "Ipiranga", "Auto Posto", "BR Distribuidora", "Graal"],
        "descricao": "Postos de combustíveis, abastecimento e redes rodoviárias.",
    },
    "Carro": {
        "icone": "Wrench",
        "exemplos": ["Positivo Automóveis", "Auto Center", "Oficinas Mecânicas", "Troca de Óleo", "Pneus", "Concessionárias"],
        "descricao": "Manutenção veicular, serviços mecânicos e autopeças.",
    },
    "Transporte": {
        "icone": "Car",
        "exemplos": ["Uber", "Uber Rides", "99 App", "Estapar Estacionamentos", "NuTag", "Zul Rotativo", "Jet Patinetes", "Sem Parar", "Veloe", "ConectCar"],
        "descricao": "Aplicativos de mobilidade, estacionamentos rotativos, tags de pedágio e patinetes.",
    },
    "Farmácia": {
        "icone": "Pill",
        "exemplos": ["Raia Drogasil", "Drogaria Araújo", "Araújo Online", "Drogaria Pacheco", "Pague Menos", "Panvel", "Ultrafarma"],
        "descricao": "Redes de farmácias, drogarias e medicamentos.",
    },
    "Saúde": {
        "icone": "HeartPulse",
        "exemplos": ["Anestesiologista Pampulha", "Dra. Flávia Ratton", "Unimed", "Hospitais", "Clínicas", "Hermes Pardini", "Fleury", "Consultórios"],
        "descricao": "Consultas médicas, honorários, exames laboratoriais e planos de saúde.",
    },
    "Assinaturas": {
        "icone": "Tv",
        "exemplos": ["Netflix", "Spotify", "Google / YouTube Premium", "Apple.com / Bill", "GitHub", "Lovable", "MyIQ", "Hostinger", "Plano NuCel", "Clube Latam Pass"],
        "descricao": "Serviços digitais recorrentes, ferramentas de software, planos de celular e streamings.",
    },
    "Galo": {
        "icone": "ShieldAlert",
        "exemplos": ["Atlético Mineiro", "Arena MRV", "Loja do Galo", "Galo na Veia"],
        "descricao": "Ingressos, produtos, mensalidades e eventos do Clube Atlético Mineiro / Arena MRV.",
    },
    "Pet": {
        "icone": "Dog",
        "exemplos": ["Cobasi", "Petz", "Petlove", "Manada Animal", "Pet Shops", "Clínicas Veterinárias"],
        "descricao": "Alimentação, medicamentos, banho & tosa e cuidados para animais de estimação.",
    },
    "Supermercado": {
        "icone": "Store",
        "exemplos": ["Supermercados BH", "Villefort Atacarejo", "Epa Supermercados", "Carrefour", "Pão de Açúcar", "Assaí Atacadista"],
        "descricao": "Compras de supermercado, hipermercados e atacarejos.",
    },
    "Padaria": {
        "icone": "Croissant",
        "exemplos": ["Padaria Arte do Trigo", "Premiere Padaria", "Panificadora Fênix", "Panificadora Dupão", "Padaria Pádua Caiçara", "Casa Bauducco", "Lor Noir Chocolateria", "Mrb Café"],
        "descricao": "Padarias, panificadoras, confeitarias e cafeterias.",
    },
    "Alimentação": {
        "icone": "Utensils",
        "exemplos": ["iFood", "Varanda 1389", "Sacolão ABC / Verde Minas", "Redefruti", "Polparica", "Açougue Aparecida", "Maxi Carne", "Churrascaria Beija Flor", "Burger King", "McDonald's", "Bares e Restaurantes"],
        "descricao": "Restaurantes, lanchonetes, bares, deliveries, açougues e sacolões/hortifruti.",
    },
    "Educação": {
        "icone": "GraduationCap",
        "exemplos": ["EBI Escolas Bilíngues", "Junta de Educação Batista", "Escolas e Colégios", "Faculdades", "Udemy", "Alura", "Livrarias"],
        "descricao": "Mensalidades escolares, cursos profissionalizantes, faculdades e material didático.",
    },
    "Viagens": {
        "icone": "Plane",
        "exemplos": ["LATAM Airlines", "Sky Airlines", "Gol Linhas Aéreas", "Azul Linhas Aéreas", "Booking.com", "Airbnb", "Hotéis e Pousadas"],
        "descricao": "Passagens aéreas, reservas de hospedagem, passeios e locação de veículos.",
    },
    "Lazer": {
        "icone": "Sparkles",
        "exemplos": ["Air Jump", "Parques Temáticos", "Lupytoy", "Academia Body", "SmartFit", "Cinemas (Cinemark, UCI)", "Sympla", "Eventim"],
        "descricao": "Academias, parques infantis, cinemas, shows, teatros e eventos de entretenimento.",
    },
    "Moradia": {
        "icone": "Home",
        "exemplos": ["Leroy Merlin", "Loja Vida & Cor", "Central do Lojista", "Granlar", "Borburema", "Destakar Vidros", "Aluguel", "CEMIG", "COPASA"],
        "descricao": "Materiais de construção, utilidades domésticas, móveis, decoração e contas de consumo residencial.",
    },
    "Compras": {
        "icone": "ShoppingBag",
        "exemplos": ["Decathlon", "Canal Bike", "Kadu Bikepoint", "Lojas Americanas", "Caedu Moda", "Meu Prata", "MSN Caiçara", "Royal Class", "Maciel Festas"],
        "descricao": "Lojas físicas de vestuário, bicicletas, materiais esportivos e variedades.",
    },
    "Cuidados Pessoais": {
        "icone": "Scissors",
        "exemplos": ["Barbearia BH Barber", "Sala 31", "Fotos Banlek", "Agências dos Correios", "NEWC Consultoria", "PB Administradora", "Obra Social São José"],
        "descricao": "Barbearias, salões de beleza, serviços fotográficos, postais e serviços administrativos.",
    },
    "Impostos": {
        "icone": "Receipt",
        "exemplos": ["IPVA", "IPTU", "DARF", "Receita Federal", "Prefeitura", "Taxa de Licenciamento"],
        "descricao": "Tributos, taxas públicas e impostos federais/estaduais/municipais.",
    },
    "Tarifas": {
        "icone": "Percent",
        "exemplos": ["IOF de compras internacionais (GitHub, Lovable, MyIQ)", "Tarifas bancárias", "Anuidades de cartão", "Juros e encargos"],
        "descricao": "Impostos financeiros (IOF), tarifas de conta e encargos de operações de crédito.",
    },
    "Transferências": {
        "icone": "ArrowLeftRight",
        "exemplos": ["Pix no Crédito (Pessoas Físicas)", "Pagamento de Faturas de Cartão", "TED / DOC", "Transferências bancárias"],
        "descricao": "Envio de Pix com cartão, transferências entre contas e quitações de fatura.",
    },
}


@bp_categorias.route("", methods=["POST"])
@bp_categorias.route("/", methods=["POST"])
@jwt_required()
def criar():
    data = request.get_json()
    print("[CATEGORIA POST] JSON recebido:", data)
    try:
        validado = schema.load(data)
    except ValidationError as err:
        print("[CATEGORIA POST] Erro de validação:", err.messages)
        return jsonify(err.messages), 400

    categoria = Categoria(**validado)
    db.session.add(categoria)
    db.session.commit()
    return jsonify(schema.dump(categoria)), 201


@bp_categorias.route("", methods=["GET"])
@bp_categorias.route("/", methods=["GET"])
def listar():
    tipo = request.args.get("tipo")
    query = Categoria.query
    if tipo:
        query = query.filter_by(tipo=tipo)
    categorias = query.order_by(Categoria.nome.asc()).all()
    return jsonify(schemas.dump(categorias)), 200


@bp_categorias.route("/<int:id>", methods=["GET"])
@jwt_required()
def obter(id):
    categoria = Categoria.query.get_or_404(id)
    return jsonify(schema.dump(categoria)), 200


@bp_categorias.route("/<int:id>", methods=["PUT"])
@jwt_required()
def atualizar(id):
    categoria = Categoria.query.get_or_404(id)
    data = request.get_json()
    print(f"[CATEGORIA PUT] JSON recebido para id={id}:", data)
    try:
        validado = schema.load(data, partial=True)
    except ValidationError as err:
        print(f"[CATEGORIA PUT] Erro de validação para id={id}:", err.messages)
        return jsonify(err.messages), 400
    for key, value in validado.items():
        setattr(categoria, key, value)
    db.session.commit()
    return jsonify(schema.dump(categoria)), 200


@bp_categorias.route("/<int:id>", methods=["DELETE"])
@jwt_required()
def deletar(id):
    categoria = Categoria.query.get_or_404(id)
    db.session.delete(categoria)
    db.session.commit()
    return jsonify({"message": "Categoria deletada com sucesso"}), 200


# ==========================================
# ROTAS DE ASSOCIAÇÕES E REGRAS INTELIGENTES
# ==========================================

@bp_categorias.route("/associacoes", methods=["GET"])
@jwt_required()
def listar_associacoes():
    """Retorna todas as regras determinísticas do sistema e os aliases de estabelecimentos salvos no banco."""
    # 1. Carregar mapeamento de categorias do banco
    cats = {c.nome.upper(): c for c in Categoria.query.all()}

    # 2. Formatar regras determinísticas do sistema
    regras_formatadas = []
    for idx, (pattern, cat_sugerida, confianca) in enumerate(REGRAS_DETERMINISTICAS, 1):
        info_extra = EXEMPLOS_REGRAS_SISTEMA.get(cat_sugerida, {})
        cat_db = cats.get(cat_sugerida.upper())
        
        regras_formatadas.append({
            "id": f"regra_{idx}",
            "categoria": cat_sugerida,
            "categoria_id": cat_db.id if cat_db else None,
            "categoria_tipo": cat_db.tipo if cat_db else "Despesa",
            "confianca": confianca,
            "padrao_regex": pattern,
            "origem": "sistema",
            "icone": info_extra.get("icone", "Tag"),
            "exemplos": info_extra.get("exemplos", []),
            "descricao": info_extra.get("descricao", f"Regra determinística para {cat_sugerida}"),
        })

    # 3. Carregar aliases aprendidos / personalizados
    aliases_db = CategoriaAlias.query.order_by(CategoriaAlias.atualizado_em.desc()).all()
    aliases_formatados = []
    for a in aliases_db:
        aliases_formatados.append({
            "id": a.id,
            "descricao_normalizada": a.descricao_normalizada,
            "descricao_exemplo": a.descricao_exemplo or a.descricao_normalizada,
            "categoria_id": a.categoria_id,
            "categoria_nome": a.categoria.nome if a.categoria else "Desconhecida",
            "categoria_tipo": a.categoria.tipo if a.categoria else "Despesa",
            "origem": a.origem,
            "ocorrencias": a.ocorrencias,
            "confianca": a.confianca,
            "atualizado_em": a.atualizado_em.isoformat() if a.atualizado_em else None,
        })

    total_estabelecimentos_exemplos = sum(len(r["exemplos"]) for r in regras_formatadas)

    return jsonify({
        "regras_sistema": regras_formatadas,
        "aliases": aliases_formatados,
        "totais": {
            "total_regras_sistema": len(regras_formatadas),
            "total_aliases_aprendidos": len(aliases_formatados),
            "total_estabelecimentos_mapeados": total_estabelecimentos_exemplos + len(aliases_formatados),
        }
    }), 200


@bp_categorias.route("/aliases", methods=["POST"])
@jwt_required()
def criar_ou_atualizar_alias():
    """Cria ou atualiza uma associação manual de estabelecimento -> categoria."""
    data = request.get_json() or {}
    descricao = data.get("descricao", "").strip()
    categoria_id = data.get("categoria_id")

    if not descricao:
        return jsonify({"message": "Informe o nome ou descrição do estabelecimento."}), 400
    if not categoria_id:
        return jsonify({"message": "Selecione uma categoria válida."}), 400

    categoria = db.session.get(Categoria, categoria_id)
    if not categoria:
        return jsonify({"message": "Categoria não encontrada."}), 404

    try:
        alias = salvar_ou_atualizar_alias(
            descricao_original=descricao,
            categoria_id=categoria.id,
            origem="usuario",
            confianca=1.0,
            commit=True
        )
        return jsonify({
            "id": alias.id,
            "descricao_normalizada": alias.descricao_normalizada,
            "descricao_exemplo": alias.descricao_exemplo,
            "categoria_id": alias.categoria_id,
            "categoria_nome": categoria.nome,
            "categoria_tipo": categoria.tipo,
            "origem": alias.origem,
            "ocorrencias": alias.ocorrencias,
            "confianca": alias.confianca,
            "atualizado_em": alias.atualizado_em.isoformat() if alias.atualizado_em else None,
            "message": "Associação salva com sucesso!"
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": f"Erro ao salvar associação: {str(e)}"}), 500


@bp_categorias.route("/aliases/<int:alias_id>", methods=["PUT"])
@jwt_required()
def atualizar_alias(alias_id):
    """Atualiza a categoria de um alias existente."""
    alias = db.session.get(CategoriaAlias, alias_id)
    if not alias:
        return jsonify({"message": "Associação não encontrada."}), 404

    data = request.get_json() or {}
    categoria_id = data.get("categoria_id")
    descricao_exemplo = data.get("descricao_exemplo")

    if categoria_id:
        categoria = db.session.get(Categoria, categoria_id)
        if not categoria:
            return jsonify({"message": "Categoria não encontrada."}), 404
        alias.categoria_id = categoria.id

    if descricao_exemplo:
        alias.descricao_exemplo = descricao_exemplo.strip()
        alias.descricao_normalizada = normalizar_descricao(descricao_exemplo)

    alias.origem = "usuario"
    alias.confianca = 1.0
    db.session.commit()

    return jsonify({
        "id": alias.id,
        "descricao_normalizada": alias.descricao_normalizada,
        "descricao_exemplo": alias.descricao_exemplo,
        "categoria_id": alias.categoria_id,
        "categoria_nome": alias.categoria.nome if alias.categoria else "",
        "categoria_tipo": alias.categoria.tipo if alias.categoria else "",
        "origem": alias.origem,
        "ocorrencias": alias.ocorrencias,
        "confianca": alias.confianca,
        "atualizado_em": alias.atualizado_em.isoformat() if alias.atualizado_em else None,
        "message": "Associação atualizada com sucesso!"
    }), 200


@bp_categorias.route("/aliases/<int:alias_id>", methods=["DELETE"])
@jwt_required()
def deletar_alias(alias_id):
    """Remove uma associação/alias."""
    alias = db.session.get(CategoriaAlias, alias_id)
    if not alias:
        return jsonify({"message": "Associação não encontrada."}), 404

    db.session.delete(alias)
    db.session.commit()
    return jsonify({"message": "Associação removida com sucesso!"}), 200


@bp_categorias.route("/associacoes/testar", methods=["POST"])
@jwt_required()
def testar_associacao():
    """Testa como uma descrição de transação é classificada pelo motor inteligente em tempo real."""
    data = request.get_json() or {}
    descricao = data.get("descricao", "").strip()

    if not descricao:
        return jsonify({"message": "Informe uma descrição para testar."}), 400

    try:
        engine = CategorizationEngine(usar_ia=False)
        resultado = engine.categorizar_uma(descricao)
        return jsonify({
            "descricao_original": resultado.descricao_original,
            "descricao_normalizada": resultado.descricao_normalizada,
            "categoria": resultado.categoria,
            "categoria_id": resultado.categoria_id,
            "confianca": resultado.confianca,
            "metodo": resultado.metodo,
            "motivo": resultado.motivo,
        }), 200
    except Exception as e:
        return jsonify({"message": f"Erro ao testar classificação: {str(e)}"}), 500