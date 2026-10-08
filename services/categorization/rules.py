import re
from .normalizer import normalizar_descricao, remover_acentos


# Mapeamento de sinônimos/equivalências de categorias
SINONIMOS_CATEGORIAS = {
    "CUIDADOS PESSOAIS": ["DIVERSOS", "OUTROS"],
    "RESTAURANTE": ["ALIMENTACAO", "RESTAURANTES"],
    "RESTAURANTES": ["ALIMENTACAO", "RESTAURANTE"],
    "PADARIA": ["ALIMENTACAO"],
    "VIAGEM": ["VIAGENS"],
    "VIAGENS": ["VIAGEM"],
    "IMPOSTO": ["IMPOSTOS"],
    "IMPOSTOS": ["IMPOSTO"],
    "CASA": ["MORADIA"],
    "MORADIA": ["CASA"],
    "STREAMINGS": ["ASSINATURAS"],
    "ASSINATURAS": ["STREAMINGS"],
    "MERCADO": ["SUPERMERCADO", "ALIMENTACAO"],
    "SUPERMERCADO": ["MERCADO", "ALIMENTACAO"],
    "RECREATIVO": ["LAZER"],
    "LAZER": ["RECREATIVO"],
    "VESTUARIO": ["COMPRAS"],
    "PET": ["COMPRAS", "COMPRAS ONLINE"],
    "GALO": ["LAZER"],
    "CARRO": ["TRANSPORTE", "DIVERSOS"],
}


REGRAS_DETERMINISTICAS = [
    # 1. Tarifas / IOF / Encargos (Alta prioridade para evitar que 'IOF de Github' vire Assinatura)
    (
        r"\b(IOF\s*DE\s*VOLTA|IOF|TARIFA|ANUIDADE|ENCARGO|JUROS|MULTA|PACOTE\s*SERVICOS|MANUTENCAO\s*CONTA|TARIFA\s*BANCARIA)\b",
        "Tarifas",
        0.95
    ),
    # 2. Compras Online (Mercado Livre, Shopee, Amazon, AliExpress, Shein, etc.) - Alta prioridade antes de Supermercado/Compras
    (
        r"\b(MERCADO\s*LIVRE|MERCADOLIVRE|MERCD\s*LIVRE|MERCDLIVRE|MERC\s*LIVRE|MERCLIVRE|MERCADO\s*PAGO|MERCADOPAGO|MELIMAIS|MELI\b|SHOPEE|SHP\b|SHOPPE|SHOPE\b|AMAZON|AMZN|AMAZONMKT|AMAZONMKTPLC|ALIEXPRESS|ALI\s*EXPRESS|SHEIN|TEMU|TIKTOK\s*SHOP|EBAY|ENJOEI|KABUM|PICHAU|TERABYTE)\b",
        "Compras Online",
        0.95
    ),
    # 3. Combustível
    (
        r"\b(POSTO|SHELL|IPIRANGA|PETROBRAS|PREMMIA|BR\s*DISTRIBUIDORA|AUTO\s*POSTO|COMBUSTIVEL|GASOLINA|POSTOS|GRAAL|POSTO\s*CHEFAO)\b",
        "Combustível",
        0.95
    ),
    # 4. Carro / Mecânica / Autopeças
    (
        r"\b(POSITIVOAUTOM|POSITIVO\s*AUTO|MECANICA|AUTO\s*CENTER|OFICINA|PNEUS|AUTOPECA|TROCA\s*DE\s*OLEO|CONCESSIONARIA)\b",
        "Carro",
        0.95
    ),
    # 5. Transporte (Apps de corrida, pedágios, tags, estacionamentos, bilhetagem)
    (
        r"\b(UBER|UBERRIDES|99\s*APP|99POP|99TAXI|99\s*TECNOLOGIA|TAXI|CABIFY|BLABLACAR|METRO|CCR|SEM\s*PARAR|VELOE|CONECTCAR|NUTAG|TAGGY|ESTACIONAMENTO|ESTACIONAMENT|ESTAC|PARK|PARKING|PEDAGIO|AUTOPASS|TOP\s*TRANSPORTE|ESTAPAR|ARAGUAR|ROTATIVO|ZUL|JET\s*PATINETES|PATINETE|BIKE\s*ITAU)\b",
        "Transporte",
        0.95
    ),
    # 6. Farmácia
    (
        r"\b(FARMACIA|DROGARIA|DROGASIL|DROGA\s*RAIA|RAIA\s*DROGASIL|DROGARIA\s*PACHECO|PAGUE\s*MENOS|PANVEL|ARAUJO|ARAUJO\s*ONLINE|FARMACIAS|ULTRAFARMA|DROGARIA\s*SAO\s*PAULO)\b",
        "Farmácia",
        0.95
    ),
    # 7. Saúde
    (
        r"\b(HOSPITAL|CLINICA|LABORATORIO|LAB|CONSULTORIO|UNIMED|AMIL|BRADESCO\s*SAUDE|SULAMERICA|FLEURY|HERMES\s*PARDINI|DENTISTA|ODONTO|MEDICO|PSICOLOG|FISIOTERAP|PEDIATR|CARDIOL|OFTALMO|DERMATO|ANESTESIO|ANESTESIOLOGISTA|PAMPU|FLAVIA\s*RATTON\w*|FLAVIARATTON\w*)\b",
        "Saúde",
        0.95
    ),
    # 8. Assinaturas / Streaming / Telecom
    (
        r"\b(NETFLIX|SPOTIFY|PRIME\s*VIDEO|DISNEY\s*PLUS|DISNEY\+|HBO\s*MAX|MAX\s*STREAM|YOUTUBE\s*PREMIUM|YOUTUBEPREMIUM|APPLE\s*COM|APPLE\s*BILL|ICLOUD|GOOGLE\s*STORAGE|GOOGLE\s*ONE|DEEZER|GLOBOPLAY|CHATGPT|OPENAI|MIDJOURNEY|MICROSOFT\s*365|OFFICE\s*365|ADOBE|CANVA|GITHUB|HOSTINGER|HOSTINGERCOMB|LOVABLE|MYIQ|NUCEL|PLANO\s*NUCEL|CLUBE\s*LATAM\s*PASS)\b",
        "Assinaturas",
        0.95
    ),
    # 9. Galo / Futebol
    (
        r"\b(ATLETICO\s*MINEIRO|ARENA\s*MRV|GALO|LOJA\s*DO\s*GALO)\b",
        "Galo",
        0.95
    ),
    # 10. Pet
    (
        r"\b(COBASI|PETZ|PET\s*LOVE|MANADA\s*ANIMAL|MANADAANIMAL|PET\s*SHOP|VETERINARI)\b",
        "Pet",
        0.95
    ),
    # 11. Supermercado
    (
        r"\b(SUPERMERCADO|MERCADO|SUPERMERCADOS|CARREFOUR|PAO\s*DE\s*ACUCAR|EXTRA\s*HIPER|ASSAI|ATACADAO|EPA|SUP\s*EPA|SUPER\s*NOSSO|BH\s*SUPERMERCADOS|SUPERMERCADO\s*BH|SONDA|ZAFFARI|VILLEFORT|DIA\s*BRASIL)\b",
        "Supermercado",
        0.95
    ),
    # 12. Padaria
    (
        r"\b(PADARIA|PANIFICADORA|ARTE\s*DO\s*TRIGO|PADUA\s*CAICARA|PREMIERE\s*PADARIA|PREMIERE\s*STO\s*AGOSTINHO|PREMIERE\s*SAN|PREMIERE|PANIFICADORA\s*FENIX|PANIFICADORA\s*DUPAO|DUPAO|BAUDUCCO|CASA\s*BAUDUCCO|LOR\s*NOIR|MRB\s*CAFE)\b",
        "Padaria",
        0.92
    ),
    # 13. Restaurantes / Alimentação / Sacolão / Açougue
    (
        r"\b(IFOOD|RAPPI|UBER\s*EATS|RESTAURANTE|REST\b|CHURRASCARIA|PIZZARIA|PIZZARONE|PIZZA|LANCHONETE|BURGER|HAMBURGUER|SUBWAY|MCDONALD|MC\s*DONALDS|DEL\s*REI|BK\s*BRASIL|BURGER\s*KING|OUTBACK|MADERO|COCO\s*BAMBU|GIRAFFAS|SPOLETO|DOCERIA|SORVETERIA|CAFE|STARBUCKS|BISTR|CANTINA|CANTINADOCHICO|CANTINASANTO|BAR\s*DO\s*KAKA|BOTECO|BAR\b|ESPETINHO|ESPETINHOCAJU|VARANDA\s*1389|VARANDA|PLANETA\s*SABOR|NICY\s*ARTE|SABOR|JAH\s*DO\s*ACAI|HOME\s*PARTY|LA\s*VIE\s*EN\s*ROSE|CARVALHO\s*E?\s*CARVALHO|SACOLAO|ABC\s*BEAGA|VERDE\s*MINAS|REDEFRUTI|POLPARICA|HORTIFRUTI|ACOUQUE|APARECIDA|MAXI\s*CARNE|FRIOS\s*ASSIM|PINGUIM\s*COMERCIO|PINGUIM)\b",
        "Alimentação",
        0.92
    ),
    # 14. Educação
    (
        r"\b(ESCOLA|COLEGIO|FACULDADE|UNIVERSIDADE|UDEMY|ALURA|COURSERA|CURSO|CURSOS|IDIOMAS|CNA|WIZARD|KUMON|LIVRARIA|SARAIVA|LEITURA|LIVROS|EBIESCOLAS|EBI\s*ESCOLAS|JUNTA\s*DE\s*EDUCACAO|CONVENCAO\s*BATISTA)\b",
        "Educação",
        0.92
    ),
    # 15. Viagens
    (
        r"\b(LATAM|LATAM\s*AIR|GOL\s*LINHAS|AZUL\s*LINHAS|SKY\s*AIRLINES|SKYAIRLINES|AIRBNB|BOOKING|HOTEL|POUSADA|RESORT|CVC\s*VIAGENS|DECOLAR|123MILHAS|LOCALIZA|MOVIDA|UNIDAS\s*LOCADORA|RENTCARS)\b",
        "Viagens",
        0.92
    ),
    # 16. Lazer / Recreativo / Esportes
    (
        r"\b(CINEMA|CINEMARK|UCI\s*CINEMAS|CINEPOLIS|TEATRO|SHOW|INGRESSO|SYMPLA|EVENTIM|SMARTFIT|SMART\s*FIT|ACADEMIA|BLUEFIT|BODYTECH|ACADEMIA\s*BODY|CAPPTA\s*ACADEMIA|STEAM|PLAYSTATION|PSN|XBOX|NINTENDO|RIOT\s*GAMES|BLIZZARD|AIR\s*JUMP|AIRJUMP|PARQUES\s*TEMATI|LUPYTOY)\b",
        "Lazer",
        0.90
    ),
    # 17. Moradia / Casa
    (
        r"\b(ALUGUEL|CONDOMINIO|IMOBILIARIA|ENERGIA|LUZ|CEMIG|ENEL|CPFL|COPEL|LIGHT|SABESP|COPASA|SANEPAR|COMGAS|GAS\s*NATURAL|LEROY\s*MERLIN|TELHANORTE|C&C|DECOR|TOK&STOK|TOK\s*STOK|MOBly|ETNA|TUDO\s*DECOR|VIDAECOR|VIDA\s*E\s*COR|CENTRAL\s*DO\s*L|CENTRAL\s*L|GRANLAR|BORBUREMA|DESTAKAR\s*VIDROS)\b",
        "Moradia",
        0.92
    ),
    # 18. Compras (Geral / Lojas Físicas / Varejo / Vestuário)
    (
        r"\b(MAGAZINE\s*LUIZA|MAGALU|CASAS\s*BAHIA|PONTO\s*FRIO|AMERICANAS|LOJAS\s*AMERICANAS|CENTAURO|DECATHLON|NETSHOES|CANAL\s*BIKE|BIKEPOINT|KADU\s*BIKEPOINT|APPLE\s*STORE|SAMSUNG|FAST\s*SHOP|MACIEL\s*FESTAS|ZARA|RENNER|LOJAS\s*RENNER|RIACHUELO|C&A|CAEDU|ROYAL\s*CLASS|MEU\s*PRATA|MSN\s*CAICARA)\b",
        "Compras",
        0.90
    ),
    # 19. Cuidados Pessoais / Barbearia / Estética
    (
        r"\b(BARBEARIA\w*|BARBER\w*|SALA31|SALA\s*31|FOTOSBANLEK|BANLEK|CORREIOS|NEWC|PBADMINISTRADORA|OBRA\s*SOCIAL\s*SAO\s*JOSE)\b",
        "Cuidados Pessoais",
        0.90
    ),
    # 21. Impostos
    (
        r"\b(IPVA|IPTU|DARF|RECEITA\s*FEDERAL|PREFEITURA|SEFAZ|SIMPLES\s*NACIONAL|GRU\s*TESOURO|GPS\s*INSS|TAXA\s*LICENCIAMENTO)\b",
        "Impostos",
        0.95
    ),
    # 22. Transferências
    (
        r"\b(TRANSFERENCIA|PIX\s*ENVIADO|TED\s*ENVIADO|DOC\s*ENVIADO|PAGAMENTO\s*RECEBIDO|PIX\s*NO\s*CREDITO|ROGERIO\s*GONCALVES\w*|ROGERIOGONCALVES\w*|PAULO\s*RODRIGUES|JULIANA\s*BRUGGER|BRUNO\s*MIRANDA|JOAO\s*PEDRO\s*SANTANA|EDUARDO\s*ALVES\w*|EDUARDOALVES\w*|RICARDO\s*ALEXANDRE|WANDERLEYFERR|MVLSOLUCOES)\b",
        "Transferências",
        0.90
    ),
]


def classificar_por_regras(descricao: str, categorias_validas: dict | list | None = None) -> tuple[str, float] | None:
    """Aplica regras determinísticas de palavras-chave/regex sobre a descrição normalizada.

    Retorna:
        (categoria_nome, confianca) ou None
    """
    texto_norm = normalizar_descricao(descricao)
    if not texto_norm:
        return None

    # Mapeamento case-insensitive de categorias cadastradas no sistema: {NORM: NomeOficial}
    if isinstance(categorias_validas, dict):
        mapa_cat = {remover_acentos(k).upper(): k for k in categorias_validas.keys()}
    elif categorias_validas:
        mapa_cat = {remover_acentos(k).upper(): k for k in categorias_validas}
    else:
        mapa_cat = {}

    for pattern, categoria_sugerida, confianca in REGRAS_DETERMINISTICAS:
        if re.search(pattern, texto_norm, flags=re.IGNORECASE):
            cat_chave = remover_acentos(categoria_sugerida).upper()
            if mapa_cat:
                if cat_chave in mapa_cat:
                    return mapa_cat[cat_chave], confianca
                # Verificar sinônimos caso a categoria direta não exista no banco
                sinonimos = SINONIMOS_CATEGORIAS.get(cat_chave, [])
                for sin in sinonimos:
                    if sin in mapa_cat:
                        return mapa_cat[sin], confianca
            else:
                return categoria_sugerida, confianca

    return None

