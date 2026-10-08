"""Testes de assertividade da importação de faturas de cartão.

Replica em Python o pipeline do frontend (leitura do CSV -> detecção de
parcelamento -> payload) e valida o endpoint POST /api/importar_transacoes.

Uso (dentro do container):
    python /app/scripts/teste_importacao_cartao.py
"""

import csv
import json
import os
import re
import unicodedata
import urllib.error
import urllib.request
from collections import Counter
from datetime import date, datetime
from decimal import Decimal

BASE = "http://localhost:5000"
FIXTURE = os.environ.get("FIXTURE", "/app/testes_http/fixtures/Nubank_2026-06-03.csv")
EMAIL = "alesauer@gmail.com"
SENHA = "teste10"
CARTAO_NOME = "Nubank"

falhas = []
avisos = []


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


def checa(nome, condicao, detalhe=""):
    print(f"[{'OK  ' if condicao else 'FALHA'}] {nome}" + (f" -> {detalhe}" if detalhe else ""))
    if not condicao:
        falhas.append(nome)


def avisa(nome, detalhe=""):
    print(f"[AVISO] {nome}" + (f" -> {detalhe}" if detalhe else ""))
    avisos.append(nome)


# ---------------------------------------------------------------------------
# Espelho do frontend (ImportacaoPage.tsx)
# ---------------------------------------------------------------------------

PADROES = [
    r"parcela\s*\(\s*(\d{1,2})\s*/\s*(\d{1,2})\s*\)",
    r"parc\.?\s*(\d{1,2})\s*/\s*(\d{1,2})",
    r"(?:-|\s)parcela\s*(\d{1,2})\s*/\s*(\d{1,2})",
    r"(\d{1,2})\s*/\s*(\d{1,2})\s*parc(?:elas)?",
    # Sufixo "- N/M" no fim do título (Apple Store #R095 - 2/5, Western Union - 2/2)
    r"[-\u2013]\s*(\d{1,2})\s*/\s*(\d{1,2})\s*$",
]


def normalizar_texto(valor):
    s = unicodedata.normalize("NFD", valor)
    return "".join(c for c in s if unicodedata.category(c) != "Mn").lower().strip()


def gerar_parcelamento_id(descricao, total, valor_parcela):
    slug = re.sub(r"^-+|-+$", "", re.sub(r"[^a-z0-9]+", "-", normalizar_texto(descricao))) or "descricao"
    total_valor = round(abs(valor_parcela or 0) * (total or 1) * 100)
    return f"{slug}-{total or 1}x-{total_valor}"


def detectar_parcelamento(descricao, valor_parcela):
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
        return {
            "parcelado": total > 1, "parcela_atual": atual, "total_parcelas": total,
            "valor_parcela": valor_parcela,
            "parcelamento_id": gerar_parcelamento_id(limpa or descricao, total, valor_parcela),
            "descricao_limpa": limpa or descricao.strip(),
        }
    return base


def competencia_esperada(data_transacao, dia_fechamento):
    if data_transacao.day <= dia_fechamento:
        return date(data_transacao.year, data_transacao.month, 1)
    mes, ano = data_transacao.month + 1, data_transacao.year
    if mes > 12:
        mes, ano = 1, ano + 1
    return date(ano, mes, 1)


TERMOS_PAGAMENTO = ["pagamento recebido", "pagamento da fatura", "pagamento fatura",
                    "pagamento cartao", "pagamento de fatura"]


def eh_pagamento_fatura(descricao, valor):
    if valor >= 0:
        return False
    return any(t in normalizar_texto(descricao) for t in TERMOS_PAGAMENTO)


def eh_ignorada(descricao, valor):
    """Apenas pagamentos de fatura são descartados; estornos são importados."""
    return eh_pagamento_fatura(descricao, valor)


# ---------------------------------------------------------------------------
# Preparação
# ---------------------------------------------------------------------------

token = req("POST", "/api/usuarios/login", {"email": EMAIL, "senha": SENHA})[1]["access_token"]

formas = req("GET", "/api/formas_pagamento/", None, token)[1]
formas = formas if isinstance(formas, list) else formas.get("items", [])
cartao = next(f for f in formas if f["nome"] == CARTAO_NOME)
FP_ID = cartao["id"]
DIA_FECHAMENTO = cartao.get("dia_fechamento") or 25

categorias = req("GET", "/api/categorias/?tipo=Despesa", None, token)[1]
categorias = categorias if isinstance(categorias, list) else categorias.get("items", [])
cat_por_nome = {normalizar_texto(c["nome"]): c for c in categorias if c["tipo"] == "Despesa"}

with open(FIXTURE, encoding="utf-8-sig") as fh:
    registros = [
        {"date": r["date"], "title": r["title"], "amount": float(r["amount"])}
        for r in csv.DictReader(fh)
        if r.get("date")
    ]

print(f"\nFixture: {FIXTURE}")
print(f"Registros no arquivo: {len(registros)}")
print(f"Cartão: {CARTAO_NOME} (id={FP_ID}, fechamento dia {DIA_FECHAMENTO})")

# Marca d'água: só removemos na limpeza o que foi criado por este teste.
_todas = req("GET", "/api/transacoes/?inicio=2000-01-01&fim=2040-12-31&per_page=1&sort_field=id&sort_order=desc",
             None, token)[1]["items"]
ID_CORTE = _todas[0]["id"] if _todas else 0
TOTAL_INICIAL = req("GET", "/api/transacoes/?inicio=2000-01-01&fim=2040-12-31&per_page=1", None, token)[1]["total_items"]
print(f"Base antes do teste: {TOTAL_INICIAL} transações (maior id={ID_CORTE})")

# ---------------------------------------------------------------------------
print("\n===== 1. Parsing e detecção de parcelamento =====")
# ---------------------------------------------------------------------------

linhas = []
for item in registros:
    analise = detectar_parcelamento(item["title"], item["amount"])
    linhas.append({**item, **analise})

parceladas = [x for x in linhas if x["parcelado"]]
print(f"       parceladas detectadas: {len(parceladas)}")

# Linhas cujo título contém "N/M" mas NÃO foram marcadas como parceladas.
nao_detectadas = [
    x for x in linhas
    if not x["parcelado"] and re.search(r"\b\d{1,2}\s*/\s*\d{1,2}\b", x["title"])
]
checa("todo título com N/M vira parcelamento", len(nao_detectadas) == 0,
      f"{len(nao_detectadas)} nao detectada(s)")
for x in nao_detectadas:
    print(f"         ! {x['title']!r}")

for x in parceladas:
    if x["parcela_atual"] > x["total_parcelas"]:
        checa("parcela_atual <= total_parcelas", False, x["title"])
        break
else:
    checa("parcela_atual <= total_parcelas", True)

checa("descrição limpa remove o marcador",
      all(not re.search(r"parcela\s*\d", x["descricao_limpa"], re.IGNORECASE) for x in parceladas))

# Colisão de parcelamento_id entre compras distintas
grupos = {}
for x in parceladas:
    grupos.setdefault(x["parcelamento_id"], []).append(x)
colisoes = {k: v for k, v in grupos.items() if len({(i["parcela_atual"]) for i in v}) != len(v)}
checa("parcelamento_id sem colisão de parcelas", len(colisoes) == 0, str(list(colisoes)[:3]))

# ---------------------------------------------------------------------------
print("\n===== 2. Classificação de linhas do extrato =====")
# ---------------------------------------------------------------------------

pagamentos = [x for x in linhas if eh_pagamento_fatura(x["title"], x["amount"])]
ignoradas = [x for x in linhas if eh_ignorada(x["title"], x["amount"])]
checar_pag = len(pagamentos) >= 1
checa("pagamento de fatura identificado", checar_pag,
      f"{len(pagamentos)}: {[p['title'] for p in pagamentos]}")
negativos = [x for x in linhas if x["amount"] < 0]
estornos = [x for x in negativos if not eh_pagamento_fatura(x["title"], x["amount"])]
checa("pagamentos descartados e estornos preservados", len(pagamentos) + len(estornos) == len(negativos),
      f"{len(negativos)} negativos = {len(pagamentos)} pags + {len(estornos)} estornos")

duplicadas_no_arquivo = [
    k for k, v in Counter((x["date"], x["title"], x["amount"]) for x in linhas if not x["parcelado"]).items()
    if v > 1
]
checar_dupla = len(duplicadas_no_arquivo) >= 1
checa("fixture contém cobrança dupla legítima (Dl*Cam)", checar_dupla, str(duplicadas_no_arquivo[:3]))

# ---------------------------------------------------------------------------
print("\n===== 3. Segurança =====")
# ---------------------------------------------------------------------------

st, _ = req("POST", "/api/importar_transacoes", {"transacoes": [], "forma_pagamento_id": FP_ID})
checa("importar exige token", st in (401, 422), f"status={st}")

st, r = req("POST", "/api/importar_transacoes", {"transacoes": [], "forma_pagamento_id": 999999}, token)
checa("rejeita cartão inexistente", st == 400, f"status={st}")

# ---------------------------------------------------------------------------
print("\n===== 4. Importação =====")
# ---------------------------------------------------------------------------


def montar_payload(linhas_origem):
    payload = []
    for x in linhas_origem:
        cat = cat_por_nome.get(normalizar_texto("Diversos"))
        payload.append({
            "title": x["title"], "amount": x["amount"], "date": x["date"],
            "categoria": cat["nome"] if cat else "Diversos",
            "categoria_id": cat["id"] if cat else None,
            "parcelado": x["parcelado"], "parcela_atual": x["parcela_atual"],
            "total_parcelas": x["total_parcelas"], "valor_parcela": x["valor_parcela"],
            "parcelamento_id": x["parcelamento_id"], "descricao_limpa": x["descricao_limpa"],
        })
    return payload


st, res = req("POST", "/api/importar_transacoes",
              {"forma_pagamento_id": FP_ID, "transacoes": montar_payload(linhas)}, token)
checa("importação retorna 200", st == 200, f"status={st}")
print(f"       {json.dumps(res, ensure_ascii=False)[:400]}")

esperado_importavel = len(linhas) - len(ignoradas)
checa("todas as linhas válidas foram inseridas",
      res["sucesso"] == esperado_importavel,
      f"inseridas={res['sucesso']} esperado={esperado_importavel} "
      f"duplicadas={res['duplicadas_ignoradas']} creditos={res.get('creditos_ignorados')} erros={len(res['erros'])}")

checa("créditos/estornos reportados no retorno", res.get("creditos_ignorados") == len(ignoradas),
      f"retorno={res.get('creditos_ignorados')} esperado={len(ignoradas)}")

erros_inesperados = [e for e in res["erros"] if "Transação ignorada" not in e["erro"]]
checa("sem erros inesperados", len(erros_inesperados) == 0, str(erros_inesperados[:3]))

parcelas_futuras_esperadas = sum(max(0, x["total_parcelas"] - x["parcela_atual"]) for x in parceladas)
checa("parcelas futuras geradas", res["parcelas_geradas"] == parcelas_futuras_esperadas,
      f"geradas={res['parcelas_geradas']} esperado={parcelas_futuras_esperadas}")

# ---------------------------------------------------------------------------
print("\n===== 5. Conferência no banco =====")
# ---------------------------------------------------------------------------

st, lista = req(
    "GET",
    f"/api/transacoes/?inicio=2026-04-26&fim=2026-05-25&forma_pagamento_id={FP_ID}&per_page=500",
    None, token,
)
# Isola o que este teste criou, ignorando dados pré-existentes no mesmo período.
importadas = [x for x in lista["items"] if x["id"] > ID_CORTE]
print(f"       transações do extrato importadas: {len(importadas)} "
      f"(pré-existentes no período: {len(lista['items']) - len(importadas)})")

comp_ok = all(x.get("competencia_fatura") == "2026-05-01" for x in importadas)
comps = sorted({x.get("competencia_fatura") for x in importadas})
checa("competência única para toda a fatura (2026-05-01)", comp_ok, str(comps))

checa("todas marcadas como Pago", all(x["status"] == "Pago" for x in importadas),
      str(sorted({x["status"] for x in importadas})))

checa("estornos importados com valor negativo para abater da fatura",
      any(float(x["valor"]) < 0 for x in importadas),
      str([(x["descricao"], x["valor"]) for x in importadas if float(x["valor"]) < 0][:4]))

soma_arquivo = sum(Decimal(str(x["amount"])) for x in linhas if x not in ignoradas)
soma_banco = sum(Decimal(str(x["valor"])) for x in importadas)
checa("soma do extrato bate com o banco", abs(soma_arquivo - soma_banco) < Decimal("0.02"),
      f"arquivo={soma_arquivo} banco={soma_banco} delta={soma_arquivo - soma_banco}")

futuras_todas = req("GET", f"/api/transacoes/?inicio=2026-05-26&fim=2032-12-31&forma_pagamento_id={FP_ID}&per_page=500",
                    None, token)[1]["items"]
futuras = [x for x in futuras_todas if x["id"] > ID_CORTE]
checa("parcelas futuras ficam Pendente",
      bool(futuras) and all(x["status"] == "Pendente" for x in futuras),
      f"{len(futuras)} parcelas, status={sorted({x['status'] for x in futuras})}")

grupo_amostra = next((x for x in importadas if x["parcelado"] and x["total_parcelas"] >= 3), None)
if grupo_amostra:
    pid = grupo_amostra["parcelamento_id"]
    todas = [x for x in importadas + futuras if x.get("parcelamento_id") == pid]
    numeros = sorted(x["parcela_atual"] for x in todas)
    esperados = list(range(grupo_amostra["parcela_atual"], grupo_amostra["total_parcelas"] + 1))
    checa("série de parcelas contínua a partir da parcela importada",
          numeros == esperados, f"{grupo_amostra['descricao']}: {numeros} vs {esperados}")
    valores = {str(x["valor"]) for x in todas}
    checa("todas as parcelas com o mesmo valor", len(valores) == 1, str(valores))

# ---------------------------------------------------------------------------
print("\n===== 6. Idempotência (reimportar o mesmo extrato) =====")
# ---------------------------------------------------------------------------

st, res2 = req("POST", "/api/importar_transacoes",
               {"forma_pagamento_id": FP_ID, "transacoes": montar_payload(linhas)}, token)
print(f"       {json.dumps(res2, ensure_ascii=False)[:300]}")
checa("reimportação não cria duplicatas", res2["sucesso"] == 0,
      f"inseridas={res2['sucesso']} atualizadas={res2['atualizadas']} "
      f"ignoradas={res2['duplicadas_ignoradas']}")
checa("reimportação não gera novas parcelas futuras", res2["parcelas_geradas"] == 0,
      f"geradas={res2['parcelas_geradas']}")

depois = req("GET", f"/api/transacoes/?inicio=2026-04-26&fim=2026-05-25&forma_pagamento_id={FP_ID}&per_page=500",
             None, token)[1]["items"]
depois = [x for x in depois if x["id"] > ID_CORTE]
checa("contagem estável após reimportar", len(depois) == len(importadas),
      f"antes={len(importadas)} depois={len(depois)}")

# ---------------------------------------------------------------------------
print("\n===== 7. Continuidade: fatura do mês seguinte =====")
# ---------------------------------------------------------------------------

# Simula a próxima fatura trazendo a parcela 2/2 de uma compra já importada.
compra_2x = next((x for x in parceladas if x["total_parcelas"] == 2 and x["parcela_atual"] == 1), None)
if compra_2x:
    proxima = dict(compra_2x)
    proxima["date"] = "2026-06-24"
    proxima["title"] = compra_2x["title"].replace("1/2", "2/2")
    analise = detectar_parcelamento(proxima["title"], proxima["amount"])
    proxima.update(analise)
    checa("parcelamento_id estável entre faturas",
          proxima["parcelamento_id"] == compra_2x["parcelamento_id"],
          f"{proxima['parcelamento_id']} vs {compra_2x['parcelamento_id']}")

    antes = req("GET", "/api/transacoes/?inicio=2026-06-01&fim=2026-06-30&per_page=500", None, token)[1]["total_items"]
    st, res3 = req("POST", "/api/importar_transacoes",
                   {"forma_pagamento_id": FP_ID, "transacoes": montar_payload([proxima])}, token)
    depois = req("GET", "/api/transacoes/?inicio=2026-06-01&fim=2026-06-30&per_page=500", None, token)[1]["total_items"]
    checa("parcela seguinte atualiza a pendente (não duplica)",
          res3["sucesso"] == 0 and res3["atualizadas"] == 1 and depois == antes,
          f"inseridas={res3['sucesso']} atualizadas={res3['atualizadas']} total {antes}->{depois}")

# ---------------------------------------------------------------------------
print("\n===== 8. Aprendizado de categorias (alias) =====")
# ---------------------------------------------------------------------------

amostra = linhas[0]
st, sug = req("POST", "/api/ia/classificar_categoria", {"descricoes": [amostra["title"]]}, token)
if st == 200:
    categorias_sug = sug.get("categorias") or sug.get("resultado") or []
    checa("alias devolve a categoria usada na importação",
          bool(categorias_sug) and normalizar_texto(str(categorias_sug[0])) == "diversos",
          f"{amostra['title']!r} -> {categorias_sug[:1]}")
else:
    avisa("endpoint de classificação indisponível", f"status={st}")

# ---------------------------------------------------------------------------
print("\n===== 9. Limpeza =====")
# ---------------------------------------------------------------------------

for periodo in [("2026-04-26", "2026-05-25"), ("2026-05-26", "2032-12-31"), ("2026-06-01", "2026-06-30")]:
    while True:
        itens = req("GET", f"/api/transacoes/?inicio={periodo[0]}&fim={periodo[1]}&forma_pagamento_id={FP_ID}&per_page=500",
                    None, token)[1]["items"]
        alvos = [x for x in itens if x["id"] > ID_CORTE]
        if not alvos:
            break
        for x in alvos:
            req("DELETE", f"/api/transacoes/{x['id']}", None, token)

total_final = req("GET", "/api/transacoes/?inicio=2000-01-01&fim=2040-12-31&per_page=1", None, token)[1]["total_items"]
checa("base restaurada ao estado inicial", total_final == TOTAL_INICIAL,
      f"antes={TOTAL_INICIAL} depois={total_final}")

print("\n" + "=" * 60)
if falhas:
    print(f"{len(falhas)} FALHA(S):")
    for f in falhas:
        print("  -", f)
else:
    print("Todos os testes passaram.")
if avisos:
    print(f"\n{len(avisos)} aviso(s):")
    for a in avisos:
        print("  -", a)
