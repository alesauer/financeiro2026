"""
Catálogo curado das principais marcas e estabelecimentos (Brasil e Global)
mapeados para seus domínios oficiais e cores primárias.
"""

from typing import Dict, Any

# Cada marca possui:
# - 'nome': Nome oficial formatado
# - 'dominio': Domínio principal para favicon/logo (ex: google favicon 128px)
# - 'cor': Cor primária oficial da marca (para fallback/background)
# - 'aliases': Palavras-chave ou variantes encontradas nos extratos bancários

MARCAS_CATALOGO = [
    # --- Alimentação & Delivery ---
    {
        "nome": "iFood",
        "dominio": "ifood.com.br",
        "cor": "#EA1D2C",
        "aliases": ["IFOOD", "IFD", "IFD*", "IFOOD.COM"],
    },
    {
        "nome": "Rappi",
        "dominio": "rappi.com.br",
        "cor": "#FF441F",
        "aliases": ["RAPPI", "RAPPI BRASIL"],
    },
    {
        "nome": "Zé Delivery",
        "dominio": "zedelivery.com.br",
        "cor": "#FFCC00",
        "aliases": ["ZE DELIVERY", "ZEDELIVERY", "ZE BEBIDAS"],
    },
    {
        "nome": "McDonald's",
        "dominio": "mcdonalds.com.br",
        "cor": "#DA291C",
        "aliases": ["MCDONALDS", "MC DONALDS", "ARCOS DOURADOS"],
    },
    {
        "nome": "Burger King",
        "dominio": "burgerking.com.br",
        "cor": "#D62300",
        "aliases": ["BURGER KING", "BK BRASIL", "BURGERKING"],
    },
    {
        "nome": "Subway",
        "dominio": "subway.com",
        "cor": "#008C15",
        "aliases": ["SUBWAY"],
    },
    {
        "nome": "Starbucks",
        "dominio": "starbucks.com.br",
        "cor": "#00704A",
        "aliases": ["STARBUCKS", "SOUTH ROCK"],
    },
    {
        "nome": "Cacau Show",
        "dominio": "cacaushow.com.br",
        "cor": "#502C1E",
        "aliases": ["CACAU SHOW", "CACAUSHOW"],
    },
    {
        "nome": "Outback Steakhouse",
        "dominio": "outback.com.br",
        "cor": "#8B0000",
        "aliases": ["OUTBACK", "BLOOMIN BRANDS"],
    },
    {
        "nome": "Habib's",
        "dominio": "habibs.com.br",
        "cor": "#E31B23",
        "aliases": ["HABIBS", "HABIB S"],
    },
    {
        "nome": "Jah do Açaí",
        "dominio": "jahdoacai.com.br",
        "cor": "#5E17EB",
        "aliases": ["JAH DO ACAI", "JAH ACAI", "JAH DISTRIBUIDORA"],
    },
    {
        "nome": "Casa Bauducco",
        "dominio": "casabauducco.com.br",
        "cor": "#FFD200",
        "aliases": ["CASA BAUDUCCO", "BAUDUCCO"],
    },
    {
        "nome": "Vida & Cor",
        "dominio": "vidaecor.com.br",
        "cor": "#10B981",
        "aliases": ["LOJA VIDAECOR", "VIDAECOR", "VIDA E COR"],
    },

    # --- Supermercados & Varejo Alimentar ---
    {
        "nome": "Supermercados BH",
        "dominio": "supermercadosbh.com.br",
        "cor": "#003A80",
        "aliases": ["SUPERMERCADOS BH", "SUPERMERCADO BH", "SUPERMERCADOBH"],
    },
    {
        "nome": "EPA Supermercados",
        "dominio": "dma.com.br",
        "cor": "#E30613",
        "aliases": ["SUP EPA", "SUPERMERCADO EPA", "EPA SUPERMERCADOS", "DMA DISTRIBUIDORA"],
    },
    {
        "nome": "Carrefour",
        "dominio": "carrefour.com.br",
        "cor": "#004E9A",
        "aliases": ["CARREFOUR", "CARREFOUR EXPRESS", "CARREFOUR POSTO"],
    },
    {
        "nome": "Pão de Açúcar",
        "dominio": "paodeacucar.com.br",
        "cor": "#00853C",
        "aliases": ["PAO DE ACUCAR", "MINUTO PAO DE ACUCAR", "GPA"],
    },
    {
        "nome": "Assaí Atacadista",
        "dominio": "assai.com.br",
        "cor": "#0047BA",
        "aliases": ["ASSAI", "ASSAI ATACADISTA"],
    },
    {
        "nome": "Atacadão",
        "dominio": "atacadao.com.br",
        "cor": "#F37021",
        "aliases": ["ATACADAO"],
    },

    # --- Farmácias & Saúde ---
    {
        "nome": "Drogaria Araújo",
        "dominio": "araujo.com.br",
        "cor": "#003399",
        "aliases": ["DROGARIA ARAUJO", "ARAUJO", "ARAUJO ONLINE"],
    },
    {
        "nome": "Droga Raia",
        "dominio": "drogaraia.com.br",
        "cor": "#008852",
        "aliases": ["DROGA RAIA", "DROGARAIA", "RD SAUDE"],
    },
    {
        "nome": "Drogasil",
        "dominio": "drogasil.com.br",
        "cor": "#E30613",
        "aliases": ["DROGASIL"],
    },
    {
        "nome": "Drogaria São Paulo",
        "dominio": "drogariasaopaulo.com.br",
        "cor": "#004A99",
        "aliases": ["DROGARIA SAO PAULO", "DROG SAO PAULO", "DPSP"],
    },
    {
        "nome": "Panvel Farmácias",
        "dominio": "panvel.com",
        "cor": "#005696",
        "aliases": ["PANVEL", "DIMED"],
    },

    # --- E-commerce & Compras Online ---
    {
        "nome": "Mercado Livre",
        "dominio": "mercadolivre.com.br",
        "cor": "#FFE600",
        "aliases": ["MERCADOLIVRE", "MERCADO LIVRE", "MERCADOLIVRE*MERCADOL", "MELI", "MERCADO PAGO", "MP *MERCADO"],
    },
    {
        "nome": "Amazon",
        "dominio": "amazon.com.br",
        "cor": "#FF9900",
        "aliases": ["AMAZON", "AMAZON.COM.BR", "AMAZON BR", "AMAZON MARKETPLACE", "AMAZONMKTP", "AMAZON SERVICOS"],
    },
    {
        "nome": "Shopee",
        "dominio": "shopee.com.br",
        "cor": "#EE4D2D",
        "aliases": ["SHOPEE", "SHP*", "SHOPEE *"],
    },
    {
        "nome": "AliExpress",
        "dominio": "aliexpress.com",
        "cor": "#FF4747",
        "aliases": ["ALIEXPRESS", "DL *ALIEXPRESS", "MP *ALIEXPRESS", "ALIPAY"],
    },
    {
        "nome": "Magazine Luiza",
        "dominio": "magazineluiza.com.br",
        "cor": "#0086FF",
        "aliases": ["MAGAZINE LUIZA", "MAGALU", "MAGAZINELUIZA"],
    },
    {
        "nome": "Shein",
        "dominio": "shein.com",
        "cor": "#222222",
        "aliases": ["SHEIN", "SHEIN.COM"],
    },
    {
        "nome": "Americanas",
        "dominio": "americanas.com.br",
        "cor": "#E60014",
        "aliases": ["AMERICANAS", "LOJAS AMERICANAS", "B2W"],
    },
    {
        "nome": "Casas Bahia",
        "dominio": "casasbahia.com.br",
        "cor": "#003399",
        "aliases": ["CASAS BAHIA", "VIA VAREJO"],
    },
    {
        "nome": "Netshoes",
        "dominio": "netshoes.com.br",
        "cor": "#551A8B",
        "aliases": ["NETSHOES"],
    },
    {
        "nome": "Centauro",
        "dominio": "centauro.com.br",
        "cor": "#E31B23",
        "aliases": ["CENTAURO", "LOJAS CENTAURO"],
    },
    {
        "nome": "Decathlon",
        "dominio": "decathlon.com.br",
        "cor": "#0082C3",
        "aliases": ["DECATHLON"],
    },
    {
        "nome": "Cobasi",
        "dominio": "cobasi.com.br",
        "cor": "#005696",
        "aliases": ["COBASI", "COBASI BH"],
    },
    {
        "nome": "Petz",
        "dominio": "petz.com.br",
        "cor": "#0047BB",
        "aliases": ["PETZ", "PET CENTER MARGINAL"],
    },
    {
        "nome": "Lojas Rede",
        "dominio": "lojasrede.com.br",
        "cor": "#E30613",
        "aliases": ["LOJASREDE", "LOJAS REDE"],
    },
    {
        "nome": "Apple",
        "dominio": "apple.com",
        "cor": "#000000",
        "aliases": ["APPLE", "APPLE.COM/BILL", "APPLE STORE", "ITUNES.COM"],
    },
    {
        "nome": "Google",
        "dominio": "google.com",
        "cor": "#4285F4",
        "aliases": ["GOOGLE", "GOOGLE STORAGE", "GOOGLE PLAY", "GOOGLE ONE", "GOOGLE CLOUD"],
    },

    # --- Transporte, Combustível & Viagem ---
    {
        "nome": "Uber",
        "dominio": "uber.com",
        "cor": "#000000",
        "aliases": ["UBER", "UBER *TRIP", "UBER *EATS", "UBER PENDING", "UBER BR"],
    },
    {
        "nome": "99 App",
        "dominio": "99app.com",
        "cor": "#FFC800",
        "aliases": ["99APP", "99 TECNOLOGIA", "99 POP", "99TAXI"],
    },
    {
        "nome": "Gol Linhas Aéreas",
        "dominio": "voegol.com.br",
        "cor": "#FF5A00",
        "aliases": ["GOL LINHAS", "GOL LINHAS AEREAS", "VOEGOL", "GOL TRANSPORTES"],
    },
    {
        "nome": "LATAM Airlines",
        "dominio": "latamairlines.com",
        "cor": "#E8112D",
        "aliases": ["LATAM AIR", "LATAM", "LATAM PASS", "TAM LINHAS AEREAS"],
    },
    {
        "nome": "Azul Linhas Aéreas",
        "dominio": "voeazul.com.br",
        "cor": "#002B49",
        "aliases": ["AZUL LINHAS", "VOEAZUL", "TUDOAZUL"],
    },
    {
        "nome": "Petrobras",
        "dominio": "petrobras.com.br",
        "cor": "#008542",
        "aliases": ["PETROBRAS", "PETROBRAS PREMMIA", "PREMMIA", "POSTO PETROBRAS", "POSTO BR"],
    },
    {
        "nome": "Posto Ipiranga",
        "dominio": "ipiranga.com.br",
        "cor": "#002F6C",
        "aliases": ["IPIRANGA", "ABASTECE AI", "POSTO IPIRANGA"],
    },
    {
        "nome": "Shell",
        "dominio": "shell.com.br",
        "cor": "#FFD200",
        "aliases": ["SHELL", "SHELL BOX", "RAIZEN"],
    },
    {
        "nome": "Sem Parar",
        "dominio": "semparar.com.br",
        "cor": "#FFCC00",
        "aliases": ["SEM PARAR", "CGMP SEM PARAR"],
    },
    {
        "nome": "Veloe",
        "dominio": "veloe.com.br",
        "cor": "#00E5FF",
        "aliases": ["VELOE", "ALELO VELOE"],
    },
    {
        "nome": "Localiza",
        "dominio": "localiza.com",
        "cor": "#00853C",
        "aliases": ["LOCALIZA", "LOCALIZA RENT A CAR"],
    },
    {
        "nome": "Jet Patinetes",
        "dominio": "jetpatinetes.com.br",
        "cor": "#00BCD4",
        "aliases": ["JET PATINETES", "JET SHARING"],
    },

    # --- Streaming, Softwares & Assinaturas ---
    {
        "nome": "Netflix",
        "dominio": "netflix.com",
        "cor": "#E50914",
        "aliases": ["NETFLIX", "NETFLIX.COM"],
    },
    {
        "nome": "Spotify",
        "dominio": "spotify.com",
        "cor": "#1DB954",
        "aliases": ["SPOTIFY", "SPOTIFY BR"],
    },
    {
        "nome": "OpenAI / ChatGPT",
        "dominio": "openai.com",
        "cor": "#10A37F",
        "aliases": ["OPENAI", "CHATGPT", "OPENAI *CHATGPT"],
    },
    {
        "nome": "DeepSeek",
        "dominio": "deepseek.com",
        "cor": "#1890FF",
        "aliases": ["DEEPSEEK", "DEEPSEEK AI"],
    },
    {
        "nome": "GitHub",
        "dominio": "github.com",
        "cor": "#24292E",
        "aliases": ["GITHUB", "GITHUB INC"],
    },
    {
        "nome": "Lovable",
        "dominio": "lovable.dev",
        "cor": "#FF3366",
        "aliases": ["LOVABLE", "LOVABLE.DEV"],
    },
    {
        "nome": "Jotform",
        "dominio": "jotform.com",
        "cor": "#FF6100",
        "aliases": ["JOTFORM", "JOTFORM CANADA INC"],
    },
    {
        "nome": "Disney+",
        "dominio": "disneyplus.com",
        "cor": "#113CCF",
        "aliases": ["DISNEY PLUS", "DISNEY+", "DISNEYPLUS"],
    },
    {
        "nome": "Max / HBO Max",
        "dominio": "max.com",
        "cor": "#002BE7",
        "aliases": ["HBO MAX", "MAX.COM", "WARNERMEDIA"],
    },
    {
        "nome": "Canva",
        "dominio": "canva.com",
        "cor": "#00C4CC",
        "aliases": ["CANVA", "CANVA PTY"],
    },
    {
        "nome": "Steam",
        "dominio": "steampowered.com",
        "cor": "#171A21",
        "aliases": ["STEAM", "VALVE", "STEAMGAMES"],
    },
    {
        "nome": "PlayStation / Sony",
        "dominio": "playstation.com",
        "cor": "#003791",
        "aliases": ["PLAYSTATION", "SONY PLAYSTATION", "SONY NETWORK"],
    },
    {
        "nome": "Microsoft / Xbox",
        "dominio": "microsoft.com",
        "cor": "#00A4EF",
        "aliases": ["MICROSOFT", "XBOX", "MSFT"],
    },

    # --- Telecom & Utilidades ---
    {
        "nome": "Vivo",
        "dominio": "vivo.com.br",
        "cor": "#660099",
        "aliases": ["VIVO", "TELEFONICA BRASIL", "VIVO KIKI", "TELEFONICA"],
    },
    {
        "nome": "Claro",
        "dominio": "claro.com.br",
        "cor": "#DA291C",
        "aliases": ["CLARO", "CLARO MOVEL", "CLARO FIBRA", "NET CLARO"],
    },
    {
        "nome": "TIM",
        "dominio": "tim.com.br",
        "cor": "#002F6C",
        "aliases": ["TIM", "TIM CELULAR", "TIM S/A"],
    },
    {
        "nome": "Nubank",
        "dominio": "nubank.com.br",
        "cor": "#820AD1",
        "aliases": ["NUBANK", "NU PAGAMENTOS", "NU FINANCEIRA", "PLANO NUCEL"],
    },
    {
        "nome": "Cemig",
        "dominio": "cemig.com.br",
        "cor": "#008542",
        "aliases": ["CEMIG", "CEMIG DISTRIBUICAO"],
    },
    {
        "nome": "Copasa",
        "dominio": "copasa.com.br",
        "cor": "#005696",
        "aliases": ["COPASA", "COPASA MG"],
    },

    # --- Fitness & Academias ---
    {
        "nome": "Smart Fit",
        "dominio": "smartfit.com.br",
        "cor": "#FFB800",
        "aliases": ["SMART FIT", "SMARTFIT", "SMART ACADEMIA"],
    },
    {
        "nome": "Academia Body",
        "dominio": "cappta.com.br",
        "cor": "#10B981",
        "aliases": ["CAPPTA *ACADEMIA BODY", "ACADEMIA BODY", "BODY ENERGY"],
    },
    {
        "nome": "Gympass / Wellhub",
        "dominio": "wellhub.com",
        "cor": "#FF4D4D",
        "aliases": ["GYMPASS", "WELLHUB"],
    },
]

# Mapa invertido para lookup ultrarrápido O(1) de palavras normalizadas
MARCAS_INDEX: Dict[str, Dict[str, Any]] = {}
for m in MARCAS_CATALOGO:
    for alias in m["aliases"]:
        chave = alias.upper().replace(" ", "").replace("*", "").replace(".", "")
        MARCAS_INDEX[chave] = m
