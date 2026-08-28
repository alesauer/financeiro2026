"""Importação do histórico real (dez/2025 a ago/2026).

Fontes (em /app/importacao):
  - Nubank_2026-MM-03.csv ..... 7 faturas (venc. dia 3), importadas em ordem
  - Contas 2026 - Mes_26.csv .. 8 planilhas mensais (receitas + despesas fixas)

Regras principais:
  - Extratos: pares IOF/estorno são cancelados antes do envio; compras
    parceladas estornadas são removidas junto do estorno (evita parcela fantasma).
  - Planilhas: linhas da seção "Cartões" NÃO viram despesa (as compras entram
    individualmente pelos extratos); valores zerados são ignorados;
    Pg == ok -> Pago, senão Pendente.
  - Categorização do cartão: regras por palavra-chave com fallback "Diversos".

Uso (dentro do container):
    python /app/scripts/importar_historico.py
"""

import csv
import datetime as dt
import glob
import json
import os
import re
import unicodedata
import urllib.error
import urllib.request
from collections import Counter, defaultdict
from decimal import Decimal

BASE = "http://localhost:5000"
PASTA = os.environ.get("PASTA_IMPORTACAO", "/app/importacao")
EMAIL = "alesauer@gmail.com"
SENHA = "teste10"

# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------


def req(metodo, url, dados=None, token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    corpo = json.dumps(dados).encode() if dados is not None else None
    r = urllib.request.Request(BASE + url, data=corpo, headers=headers, method=metodo)
    try:
        resp = urllib.request.urlopen(r)
        texto = resp.read().decode()
        return resp.status, (json.loads(texto) if texto else None)
    except urllib.error.HTTPError as e:
        texto = e.read().decode()
        try:
            return e.code, json.loads(texto)
        except Exception:
            return e.code, texto[:300]


def normalizar_texto(valor):
    s = unicodedata.normalize("NFD", valor or "")
    return "".join(c for c in s if unicodedata.category(c) != "Mn").lower().strip()


def parse_valor(texto):
    """Aceita '50.00', '13,04', '1.200,59', '- 1,88', '-17131.78', 'R$ 1.000,00'."""
    s = str(texto).replace("R$", "").replace(" ", "").strip()
    if not s:
        return None
    if "," in s:
        s = s.replace(".", "").replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return None


# ---------------------------------------------------------------------------
# Espelho do frontend: detecção de parcelamento (igual à suíte de testes)
# ---------------------------------------------------------------------------

PADROES = [
    r"parcela\s*\(\s*(\d{1,2})\s*/\s*(\d{1,2})\s*\)",
    r"parc\.?\s*(\d{1,2})\s*/\s*(\d{1,2})",
    r"(?:-|\s)parcela\s*(\d{1,2})\s*/\s*(\d{1,2})",
    r"(\d{1,2})\s*/\s*(\d{1,2})\s*parc(?:elas)?",
    r"[-\u2013]\s*(\d{1,2})\s*/\s*(\d{1,2})\s*$",
]


def _subtrair_meses(data_base, meses):
    ano = data_base.year
    mes = data_base.month - meses
    while mes <= 0:
        mes += 12
        ano -= 1
    dia = min(data_base.day, [31, 29 if ano % 4 == 0 and (ano % 100 != 0 or ano % 400 == 0) else 28,
                              31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mes - 1])
    return dt.date(ano, mes, dia)


def _chave_inicio_parcelamento(data_iso, parcela_atual):
    """Retorna YYYY-MM da compra original (parcela 1)."""
    try:
        base = dt.datetime.strptime(data_iso, "%Y-%m-%d").date()
    except Exception:
        return "sem-data"
    origem = _subtrair_meses(base, max(0, (parcela_atual or 1) - 1))
    return f"{origem.year:04d}-{origem.month:02d}"


def gerar_parcelamento_id(descricao, total, valor_parcela, data_iso, parcela_atual):
    slug = re.sub(r"^-+|-+$", "", re.sub(r"[^a-z0-9]+", "-", normalizar_texto(descricao))) or "descricao"
    inicio = _chave_inicio_parcelamento(data_iso, parcela_atual)
    # bucket por R$ 0,50: mantém compras diferentes separadas e tolera variações
    # de centavos entre parcela 1 e demais do mesmo parcelamento.
    bucket_parcela = int(round(abs(valor_parcela or 0) * 2))
    return f"{slug}-{total or 1}x-{inicio}-p50-{bucket_parcela}"


def detectar_parcelamento(descricao, valor_parcela, data_iso):
    base = {
        "parcelado": False, "parcela_atual": 1, "total_parcelas": 1,
        "valor_parcela": valor_parcela, "parcelamento_id": None,
        "descricao_limpa": descricao.strip(),
    }
    for regex in PADROES:
        m = re.search(regex, descricao, flags=re.IGNORECASE)
        if not m:
            continue
        atual = int(m.group(1) or 1)
        total = int(m.group(2) or atual or 1)
        limpa = re.sub(regex, "", descricao, flags=re.IGNORECASE)
        limpa = re.sub(r"\s{2,}", " ", limpa)
        limpa = re.sub(r"-\s*-", "-", limpa, count=1)
        limpa = re.sub(r"\s+-\s+", " - ", limpa).strip()
        limpa = limpa.rstrip("-").strip()
        return {
            "parcelado": total > 1, "parcela_atual": atual, "total_parcelas": total,
            "valor_parcela": valor_parcela,
            "parcelamento_id": gerar_parcelamento_id(limpa or descricao, total, valor_parcela, data_iso, atual),
            "descricao_limpa": limpa or descricao.strip(),
        }
    return base


# ---------------------------------------------------------------------------
# Categorização por palavra-chave (aplicada na descrição normalizada)
# ---------------------------------------------------------------------------

REGRAS_CATEGORIA = [
    # (palavras-chave, categoria)
    (["villefort", "supermercado", "super nosso", "sup epa", "supermercados bh", "sacolao",
      "maxi carne", "acougue", "mercearia", "frios assim", "verde minas", "abc atacado",
      "atacadao", "momento super", "emporio verde", "d. portugal", "mercado central",
      "hortifruti", "casa de carnes", "frigorifico", "diamond foods", "adicao alimentos",
      "galera foods", "distribuidora de bebi", "especiarias casa branc", "emporiocasabranca",
      "emporio casa branca", "dfumo", "borburema"], "Mercado"),
    (["padaria", "panificadora", "padoka", "pao de queijo", "casa panini", "padariae",
      "padariasto", "arte do trigo", "big pao", "padua caicara"], "Padaria"),
    (["restaurante", "restaur ", "restaurantedaleia", "rarestaurantee", "churrascaria",
      "burger", "lanche", "pizza", "ifd*", "ifd ", "99food", "mcdonald", "mc donalds",
      "bacio di latte", "acai", "cafe", "cafeteria", "feijoada", "hamburgueria",
      "espetinho", "outback", "dedo de moca", "bifao", "peixe", "coco bambu", "tacos",
      "timbuca", "planeta sabor", "bar d", "bar e", "bar da", "bar do", "ali ba bar",
      "jim.com*", "tchambows", "pontodocaldo", "caldo", "pastelandia", "catons",
      "villa acqua", "maria fumaca", "fornazzo", "tio cicero", "gil do peixe",
      "chopp", "bolao brahma", "estancia pampulha", "mrb cafe", "mr jhon", "mr bean",
      "wps*mr cheney", "the best acai", "jah do", "garapao", "cocobom", "sabores do leite",
      "casadopaodequeijo", "caicara grill", "gardinus", "foodtruck", "food", "lor noir",
      "premiere san", "sol e neve", "dl*cam", "mj acai", "petatria", "breik",
      "tba caicara", "msn caicara", "opus assembleia", "delrey", "land of beer",
      "dunkin", "island market", "mania mine", "saboreando", "varanda", "tele pizza",
      "home pasty", "home party", "bag burger", "burger king", "peixe frito",
      "restauranteti", "lanchonete", "arcos dourados"], "Restaurante"),
    (["posto ", "premmia", "petrobras", "shell", "posto pio"], "Combustível"),
    (["uber", "99*", "nutag", "estapar", "estacionamento", "mta*", "njtransit",
      "zul 1", "rotativo", "bike belo", "allpark", "bhz estacionament", "car mais",
      "dl *uberrides", "dl*uberrides", "direcao"], "Transporte"),
    (["drogaria", "araujo", "raia", "webfarma", "farma", "duane reade"], "Farmácia"),
    (["netflix", "youtubepremium", "amazon music", "amazonprime", "apple.com/bill",
      "applecombill", "github", "hostinger", "vercel", "deepseek", "google cartola",
      "spotify", "doordash", "uber *one", "redplay", "preabsoluto", "amazon servicos de var",
      "cline bot", "asaas", "olhonocarro", "atres tecnologia", "dl*google"], "Assinaturas"),
    (["plano nucel", "claro flex", "vivo", "tim ", "compre recargas"], "Celular"),
    (["junta de educacao", "ebiescolas", "col bat*", "colegio", "escola",
      "formatura"], "Educação"),
    (["air jump", "space friends", "evento kids", "diversoes guanabara", "arenapark",
      "arena park", "parque eco", "unidadeitaupower", "skyasia", "air park"], "Recreativo"),
    (["cineart", "atletico mineiro", "arena mrv", "mineirao", "zig*", "iate",
      "sociedademineira", "royal class", "b91*"], "Lazer"),
    (["airbnb", "rentalcars", "sky airli", "air canad", "latam", "gol linhas", "azul",
      "western union", "burlington", "best buy", "7-eleven", "immigration",
      "aseinco", "mep*arena"], "Viagem"),
    (["psicologia", "psicolog", "odontologia", "odonto", "clinica", "laborator"], "Saúde"),
    (["veterinar", "petz", "cobasi", "pet shop"], "Pet"),
    (["pernambucanas", "centauro", "decathlon", "suindara", "modas", "baby jacui",
      "vestuario", "lojas baby"], "Vestuário"),
    (["shopee", "mercadolivre", "mercado*merc", "aliexpress", "amazonmktplc", "magalu",
      "mlp*", "imports hx", "amazon -", "amazon aws"], "Compras Online"),
    (["leroy merlin", "gran lar", "chavemix", "embalafacil", "eletro caio",
      "reis utilidades", "tem de tudo", "daiso", "m r industria", "chuvas de prata",
      "meu prata", "gold presentes"], "Casa"),
    (["garra pneus", "breque auto", "lava jato", "car wash", "positivoautom",
      "seguro", "pneus", "auto freios"], "Carro"),
    (["estado de minas gerais", "iof de"], "Imposto"),
    (["academia body", "academia"], "Saúde"),
    (["barbearia", "barbeariabh", "barbers"], "Diversos"),
]


def classificar(descricao):
    d = normalizar_texto(descricao)
    for palavras, categoria in REGRAS_CATEGORIA:
        for p in palavras:
            if p in d:
                return categoria
    return "Diversos"


# ---------------------------------------------------------------------------
# Pré-processamento do extrato: cancela pares IOF/estorno
# ---------------------------------------------------------------------------


def eh_pagamento_fatura(titulo):
    return "pagamento recebido" in normalizar_texto(titulo)


def _strip_parcela(titulo):
    limpo = re.sub(r"\s*[-\u2013]\s*parcela\s*\d{1,2}\s*/\s*\d{1,2}\s*$", "", titulo, flags=re.IGNORECASE)
    return re.sub(r"\s*[-\u2013]\s*\d{1,2}\s*/\s*\d{1,2}\s*$", "", limpo).strip()


def preprocessar_extrato(linhas):
    """Remove pares (crédito casa com débito de mesmo valor).

    Retorna (linhas_validas, pagamentos, pares_cancelados, negativos_soltos).
    """
    usados = set()
    remover = set()
    pares = []
    soltos = []
    pagamentos = []

    positivos_por_valor = defaultdict(list)
    for i, ln in enumerate(linhas):
        if ln["amount"] > 0:
            positivos_por_valor[round(ln["amount"], 2)].append(i)

    def casar(idx_neg, filtro):
        alvo = round(abs(linhas[idx_neg]["amount"]), 2)
        for j in positivos_por_valor.get(alvo, []):
            if j in usados or j in remover:
                continue
            if filtro(linhas[j]["title"]):
                return j
        return None

    for i, ln in enumerate(linhas):
        if ln["amount"] >= 0:
            continue
        titulo_norm = normalizar_texto(ln["title"])

        if "pagamento recebido" in titulo_norm:
            pagamentos.append(ln)
            remover.add(i)
            continue

        j = None
        m = re.search(r"iof de volta de (.+)", titulo_norm)
        if m:
            ref = m.group(1).strip()
            j = casar(i, lambda t: normalizar_texto(t).startswith("iof de") and ref[:20] in normalizar_texto(t))
        elif "ajuste a credito" in titulo_norm:
            j = casar(i, lambda t: normalizar_texto(t).startswith("iof de"))
        else:
            m = re.search(r'estorno de "(.+?)"', ln["title"], flags=re.IGNORECASE)
            ref = normalizar_texto(m.group(1)) if m else None
            if ref:
                j = casar(i, lambda t: ref[:20] in normalizar_texto(_strip_parcela(t)))
            else:  # "Estorno de pagamento" e afins
                j = casar(i, lambda t: True)

        if j is not None:
            usados.add(j)
            remover.add(i)
            remover.add(j)
            pares.append((linhas[j]["title"], linhas[i]["title"], abs(ln["amount"])))
        else:
            remover.add(i)
            soltos.append((ln["title"], ln["amount"]))

    validas = [ln for k, ln in enumerate(linhas) if k not in remover]
    return validas, pagamentos, pares, soltos


# ---------------------------------------------------------------------------
# Planilhas de contas
# ---------------------------------------------------------------------------

MESES_ARQ = {"jan": 1, "fev": 2, "mar": 3, "abr": 4, "mai": 5, "jun": 6, "jul": 7, "ago": 8}

# Formas de pagamento por descrição (planilha não informa)
DEBITO_AUTOMATICO = ["cemig", "blink", "origo", "iptu", "condominio", "vivo kiki", "mei kiki"]

MAPA_CATEGORIA_PLANILHA = {
    "salario": "Salário", "educacao": "Educação", "carro": "Carro", "temp": "Temp",
    "imposto": "Imposto", "celular": "Celular", "moradia": "Moradia", "energia": "Energia",
    "internet": "Internet", "recreativo": "Recreativo", "filho": "Filho",
    "repasse": "Repasse", "lazer": "Lazer", "diversos": "Diversos",
    "investimento": "Reserva de Emergência",
}


def parse_planilha(caminho):
    nome = os.path.basename(caminho)
    m = re.search(r"-\s*([A-Za-z]{3})_26", nome)
    mes = MESES_ARQ[m.group(1).lower()]
    ano = 2026

    receitas, despesas, cartoes, totais = [], [], [], {}
    secao = None
    with open(caminho, encoding="utf-8-sig") as fh:
        for row in csv.reader(fh):
            row = list(row) + [""] * (7 - len(row))
            c0, c1, c2, c3, c4, c5, c6 = [x.strip() for x in row[:7]]

            if c1 in ("Receitas:", "Despesas:", "Saldo:"):
                totais[c1.rstrip(":")] = parse_valor(c4)
                continue
            if c0 in ("Receitas", "Despesas Fixas") and c1 == "Data":
                secao = c0
                continue
            if c0 == "Cartões":
                secao = "Cartões"  # a própria linha traz dados do 1º cartão
            if secao is None or not c4:
                continue

            valor = parse_valor(c4)
            if valor is None or abs(valor) < 0.005:
                continue

            dia = int(c1) if c1.isdigit() else 1
            dia = min(max(dia, 1), 28)
            item = {
                "dia": dia, "descricao": c2 or c5 or "Sem descrição",
                "categoria": c3, "valor": abs(valor),
                "observacao": c5 or None, "pago": normalizar_texto(c6) == "ok",
                "data": f"{ano}-{mes:02d}-{dia:02d}",
            }
            if secao == "Receitas":
                receitas.append(item)
            elif secao == "Despesas Fixas":
                despesas.append(item)
            elif secao == "Cartões":
                cartoes.append(item)
    return {"mes": mes, "ano": ano, "totais": totais, "receitas": receitas,
            "despesas": despesas, "cartoes": cartoes, "arquivo": nome}


# ---------------------------------------------------------------------------
# Execução
# ---------------------------------------------------------------------------


def main():
    st, resp = req("POST", "/api/usuarios/login", {"email": EMAIL, "senha": SENHA})
    assert st == 200, f"login falhou: {st} {resp}"
    token = resp["access_token"]

    formas = req("GET", "/api/formas_pagamento/", None, token)[1]
    formas = formas if isinstance(formas, list) else formas.get("items", [])
    fp_por_nome = {normalizar_texto(f["nome"]): f for f in formas}
    nubank = fp_por_nome["nubank"]

    categorias = req("GET", "/api/categorias/", None, token)[1]
    categorias = categorias if isinstance(categorias, list) else categorias.get("items", [])
    cat_por_nome = {}
    for c in categorias:
        cat_por_nome[(normalizar_texto(c["nome"]), c["tipo"])] = c

    def cat_id(nome, tipo):
        c = cat_por_nome.get((normalizar_texto(nome), tipo))
        return c["id"] if c else None

    resumo_cartao = {}
    distribuicao = Counter()

    # ------------------------------------------------------------------
    print("=" * 70)
    print("FASE 1 - EXTRATOS NUBANK (ordem cronológica)")
    print("=" * 70)
    extratos = sorted(glob.glob(os.path.join(PASTA, "Nubank_*.csv")))
    for caminho in extratos:
        nome = os.path.basename(caminho)
        with open(caminho, encoding="utf-8-sig") as fh:
            brutas = []
            for r in csv.DictReader(fh):
                if not r.get("date"):
                    continue
                valor = parse_valor(r["amount"])
                if valor is None:
                    continue
                brutas.append({"date": r["date"].strip(), "title": r["title"].strip(), "amount": valor})

        validas, pagamentos, pares, soltos = preprocessar_extrato(brutas)

        payload = []
        for ln in validas:
            analise = detectar_parcelamento(ln["title"], ln["amount"], ln["date"])
            categoria = classificar(analise["descricao_limpa"])
            distribuicao[categoria] += 1
            payload.append({
                "title": ln["title"], "amount": ln["amount"], "date": ln["date"],
                "categoria": categoria, "categoria_id": cat_id(categoria, "Despesa"),
                "parcelado": analise["parcelado"], "parcela_atual": analise["parcela_atual"],
                "total_parcelas": analise["total_parcelas"], "valor_parcela": analise["valor_parcela"],
                "parcelamento_id": analise["parcelamento_id"], "descricao_limpa": analise["descricao_limpa"],
            })

        st, res = req("POST", "/api/importar_transacoes",
                      {"forma_pagamento_id": nubank["id"], "transacoes": payload}, token)
        soma = sum(Decimal(str(x["amount"])) for x in validas)
        pago = sum(abs(p["amount"]) for p in pagamentos)
        erros_reais = [e for e in (res.get("erros") or []) if "Transação ignorada" not in e.get("erro", "")]

        resumo_cartao[nome] = {
            "linhas_arquivo": len(brutas), "enviadas": len(payload),
            "inseridas": res.get("sucesso"), "atualizadas": res.get("atualizadas"),
            "duplicadas": res.get("duplicadas_ignoradas"), "parcelas_futuras": res.get("parcelas_geradas"),
            "pares_cancelados": len(pares), "negativos_soltos": len(soltos),
            "soma_importada": float(soma), "pagamento_recebido": pago,
            "erros": erros_reais,
        }
        print(f"\n{nome}: status={st}")
        print(f"  linhas={len(brutas)} enviadas={len(payload)} inseridas={res.get('sucesso')} "
              f"atualizadas={res.get('atualizadas')} duplicadas={res.get('duplicadas_ignoradas')} "
              f"parcelas_futuras={res.get('parcelas_geradas')}")
        print(f"  pares IOF/estorno cancelados={len(pares)} negativos_soltos={len(soltos)}")
        print(f"  soma importada=R$ {soma:,.2f} | pagamento recebido=R$ {pago:,.2f}")
        if soltos:
            for t, v in soltos:
                print(f"    ! negativo sem par: {t!r} {v}")
        if erros_reais:
            for e in erros_reais[:5]:
                print(f"    ! erro: {e}")

    # ------------------------------------------------------------------
    print()
    print("=" * 70)
    print("FASE 2 - PLANILHAS DE CONTAS (receitas + despesas fixas)")
    print("=" * 70)
    planilhas = sorted(glob.glob(os.path.join(PASTA, "Contas *.csv")),
                       key=lambda p: MESES_ARQ[re.search(r"-\s*([A-Za-z]{3})_26", p).group(1).lower()])
    resumo_planilha = {}
    for caminho in planilhas:
        dados = parse_planilha(caminho)
        inseridas, falhas = 0, []

        for item in dados["receitas"]:
            categoria = MAPA_CATEGORIA_PLANILHA.get(normalizar_texto(item["categoria"]), "Salário")
            payload = {
                "descricao": item["descricao"], "valor": item["valor"], "tipo": "Receita",
                "categoria_id": cat_id(categoria, "Receita") or cat_id("Salário", "Receita"),
                "data_transacao": item["data"], "forma_pagamento_id": fp_por_nome["transferencia"]["id"],
                "status": "Pago" if item["pago"] else "Pendente",
                "recorrente": False, "observacoes": item["observacao"],
            }
            st, res = req("POST", "/api/transacoes/", payload, token)
            if st in (200, 201):
                inseridas += 1
            else:
                falhas.append((item["descricao"], st, str(res)[:120]))

        for item in dados["despesas"]:
            cat_nome = MAPA_CATEGORIA_PLANILHA.get(normalizar_texto(item["categoria"]))
            if not cat_nome:
                cat_nome = "Educação" if "formatura" in normalizar_texto(item["descricao"]) else "Diversos"
            tipo = "Investimento" if normalizar_texto(item["categoria"]) == "investimento" else "Despesa"
            fp = fp_por_nome["pix"]
            if any(k in normalizar_texto(item["descricao"]) for k in DEBITO_AUTOMATICO):
                fp = fp_por_nome["debito automatico"]
            payload = {
                "descricao": item["descricao"], "valor": item["valor"], "tipo": tipo,
                "categoria_id": cat_id(cat_nome, tipo) or cat_id("Diversos", "Despesa"),
                "data_transacao": item["data"], "forma_pagamento_id": fp["id"],
                "status": "Pago" if item["pago"] else "Pendente",
                "recorrente": False, "observacoes": item["observacao"],
            }
            st, res = req("POST", "/api/transacoes/", payload, token)
            if st in (200, 201):
                inseridas += 1
            else:
                falhas.append((item["descricao"], st, str(res)[:120]))

        nub_planilha = next((c["valor"] for c in dados["cartoes"]
                             if "nubank" in normalizar_texto(c["descricao"])), None)
        resumo_planilha[dados["arquivo"]] = {
            "mes": dados["mes"], "inseridas": inseridas, "falhas": falhas,
            "receitas_planilha": dados["totais"].get("Receitas"),
            "despesas_planilha": dados["totais"].get("Despesas"),
            "nubank_planilha": nub_planilha,
            "cartoes_ignorados": [(c["descricao"], c["valor"]) for c in dados["cartoes"]],
        }
        print(f"\n{dados['arquivo']}: inseridas={inseridas} falhas={len(falhas)} "
              f"(cartões ignorados: {resumo_planilha[dados['arquivo']]['cartoes_ignorados']})")
        for f in falhas:
            print(f"    ! {f}")

    # ------------------------------------------------------------------
    print()
    print("=" * 70)
    print("FASE 3 - RECONCILIAÇÃO")
    print("=" * 70)
    print("\n--- Fatura importada x 'Pagamento recebido' do mês seguinte x planilha ---")
    nomes = sorted(resumo_cartao)
    for k, nome in enumerate(nomes):
        r = resumo_cartao[nome]
        pago_seguinte = resumo_cartao[nomes[k + 1]]["pagamento_recebido"] if k + 1 < len(nomes) else None
        delta = (r["soma_importada"] - pago_seguinte) if pago_seguinte else None
        print(f"{nome}: importado=R$ {r['soma_importada']:>12,.2f}"
              + (f" | pgto seguinte=R$ {pago_seguinte:>12,.2f} | delta=R$ {delta:>10,.2f}" if pago_seguinte else " | (última fatura)"))

    print("\n--- Distribuição de categorias (cartão) ---")
    for cat, qtd in distribuicao.most_common():
        print(f"  {cat:<18} {qtd:>4}")

    print("\n--- Totais no sistema por mês (após importação) ---")
    for mes in range(1, 9):
        ini, fim = f"2026-{mes:02d}-01", f"2026-{mes:02d}-28"
        if mes in (1, 3, 5, 7, 8):
            fim = f"2026-{mes:02d}-31"
        elif mes == 2:
            fim = "2026-02-28"
        else:
            fim = f"2026-{mes:02d}-30"
        st, s = req("GET", f"/api/transacoes/summary?inicio={ini}&fim={fim}", None, token)
        if st == 200:
            print(f"  2026-{mes:02d}: receitas=R$ {s['receitas']:>12,.2f} despesas=R$ {s['despesas']:>12,.2f} "
                  f"cartao=R$ {s.get('cartao_credito_total', 0):>12,.2f} saldo=R$ {s['saldo']:>12,.2f}")

    print("\nConcluído.")


if __name__ == "__main__":
    main()
