"""Testes funcionais de transações e recorrências (executar dentro do container)."""
import json
import urllib.error
import urllib.request

BASE = "http://localhost:5000"
falhas = []
criados = []


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
    marca = "OK  " if condicao else "FALHA"
    print(f"[{marca}] {nome}" + (f" -> {detalhe}" if detalhe else ""))
    if not condicao:
        falhas.append(nome)


token = req("POST", "/api/usuarios/login", {"email": "alesauer@gmail.com", "senha": "teste10"})[1]["access_token"]

CAT_DESPESA = 4      # Educação
CAT_RECEITA = 1      # Salário
FP_PIX = 2           # Pix (não cartão)
FP_NUBANK = 5        # Nubank (cartão)

base = {
    "tipo": "Despesa",
    "categoria_id": CAT_DESPESA,
    "forma_pagamento_id": FP_PIX,
    "status": "Pendente",
}

print("\n===== 1. Transação simples =====")
st, r = req("POST", "/api/transacoes/", {**base, "descricao": "TESTE simples", "valor": 100, "data_transacao": "2026-03-10"}, token)
checa("cria simples (201)", st == 201, f"status={st}")
if st == 201:
    criados.append(r["id"])
    checa("valor persistido", str(r["valor"]) == "100.00", f"valor={r['valor']}")
    checa("recorrente=False", r["recorrente"] is False)
    checa("competencia_fatura nula p/ não-cartão", r.get("competencia_fatura") is None, f"comp={r.get('competencia_fatura')}")

print("\n===== 2. Validações =====")
st, r = req("POST", "/api/transacoes/", {**base, "descricao": "TESTE negativo", "valor": -5}, token)
checa("rejeita valor <= 0", st == 400, f"status={st}")
st, r = req("POST", "/api/transacoes/", {**base, "descricao": "TESTE tipo", "valor": 10, "tipo": "Outro"}, token)
checa("rejeita tipo inválido", st == 400, f"status={st}")
st, r = req("POST", "/api/transacoes/", {**base, "descricao": "TESTE rec sem tipo", "valor": 10, "recorrente": True}, token)
checa("rejeita recorrente sem recorrencia_tipo", st == 400, f"status={st}")
st, r = req("POST", "/api/transacoes/", {**base, "descricao": "TESTE ass sem freq", "valor": 10, "recorrente": True, "recorrencia_tipo": "Assinatura"}, token)
checa("rejeita Assinatura sem frequencia", st == 400, f"status={st}")
st, r = req("POST", "/api/transacoes/", {**base, "descricao": "TESTE parc sem total", "valor": 10, "recorrente": True, "recorrencia_tipo": "Parcelamento"}, token)
checa("rejeita Parcelamento sem total_parcelas", st == 400, f"status={st}")
st, r = req("POST", "/api/transacoes/", {**base, "descricao": "TESTE parc 1x", "valor": 10, "recorrente": True, "recorrencia_tipo": "Parcelamento", "total_parcelas": 1}, token)
checa("rejeita total_parcelas < 2", st == 400, f"status={st}")
st, r = req("POST", "/api/transacoes/", {**base, "descricao": "TESTE cat errada", "valor": 10, "tipo": "Receita", "categoria_id": CAT_DESPESA}, token)
checa("rejeita categoria incompativel com tipo", st == 400, f"status={st}")
if st == 201:
    criados.append(r["id"])
st, r = req("POST", "/api/transacoes/", {**base, "descricao": "TESTE cat ok", "valor": 10, "tipo": "Receita", "categoria_id": CAT_RECEITA}, token)
checa("aceita categoria compativel", st == 201, f"status={st} resp={r}")
if st == 201:
    criados.append(r["id"])

print("\n===== 3. Assinatura (recorrência) =====")
st, r = req("POST", "/api/transacoes/", {
    **base, "descricao": "TESTE assinatura", "valor": 50, "data_transacao": "2026-01-15",
    "recorrente": True, "recorrencia_tipo": "Assinatura", "frequencia": "Mensal", "data_fim": "2026-06-15",
}, token)
checa("cria assinatura (201)", st == 201, f"status={st}")
if st == 201:
    criados += [x["id"] for x in r]
    checa("gera 6 ocorrências (jan..jun)", len(r) == 6, f"qtd={len(r)}")
    checa("datas mensais corretas", [x["data_transacao"] for x in r] == [f"2026-0{m}-15" for m in range(1, 7)], str([x["data_transacao"] for x in r]))
    checa("todas com valor 50", all(str(x["valor"]) == "50.00" for x in r))

st, r = req("POST", "/api/transacoes/", {
    **base, "descricao": "TESTE assinatura sem fim", "valor": 50, "data_transacao": "2026-01-15",
    "recorrente": True, "recorrencia_tipo": "Assinatura", "frequencia": "Mensal",
}, token)
checa("assinatura sem data_fim aceita", st == 201, f"status={st}")
if st == 201:
    unico = r if isinstance(r, dict) else r[0]
    criados.append(unico["id"])
    print(f"       -> gerou {1 if isinstance(r, dict) else len(r)} registro(s)")

st, r = req("POST", "/api/transacoes/", {
    **base, "descricao": "TESTE assinatura diaria longa", "valor": 1, "data_transacao": "2026-01-01",
    "recorrente": True, "recorrencia_tipo": "Assinatura", "frequencia": "Diária", "data_fim": "2036-01-01",
}, token)
qtd = len(r) if isinstance(r, list) else 0
checa("bloqueia geração em massa (400)", st == 400, f"status={st} gerou={qtd}")
if isinstance(r, list):
    criados += [x["id"] for x in r]

st, r = req("POST", "/api/transacoes/", {
    **base, "descricao": "TESTE data_fim invertida", "valor": 10, "data_transacao": "2026-06-01",
    "recorrente": True, "recorrencia_tipo": "Assinatura", "frequencia": "Mensal", "data_fim": "2026-01-01",
}, token)
checa("rejeita data_fim anterior à data", st == 400, f"status={st}")
if st == 201 and isinstance(r, list):
    criados += [x["id"] for x in r]

print("\n===== 4. Parcelamento =====")
st, r = req("POST", "/api/transacoes/", {
    **base, "descricao": "TESTE parcelamento", "valor": 1200, "data_transacao": "2026-02-05",
    "recorrente": True, "recorrencia_tipo": "Parcelamento", "total_parcelas": 12,
}, token)
checa("cria parcelamento (201)", st == 201, f"status={st}")
if st == 201:
    criados += [x["id"] for x in r]
    checa("gera 12 parcelas", len(r) == 12, f"qtd={len(r)}")
    checa("parcela_atual 1..12", [x["parcela_atual"] for x in r] == list(range(1, 13)))
    checa("valor_parcela = 100", all(str(x["valor_parcela"]) == "100.00" for x in r), f"vp={r[0]['valor_parcela']}")
    checa("valor de cada parcela = 100 (nao o total)", all(str(x["valor"]) == "100.00" for x in r), f"valor={r[0]['valor']}")
    soma_valor = sum(float(x["valor"]) for x in r)
    checa("soma dos valores = 1200", abs(soma_valor - 1200) < 0.01, f"soma={soma_valor}")
    checa("datas mensais", r[0]["data_transacao"] == "2026-02-05" and r[11]["data_transacao"] == "2027-01-05", f"{r[0]['data_transacao']}..{r[11]['data_transacao']}")
    parc_ids = {x.get("parcelamento_id") for x in r}
    checa("mesmo parcelamento_id", len(parc_ids) == 1 and None not in parc_ids, str(parc_ids))
    grupo = r

    st, arr = req("POST", "/api/transacoes/", {
        **base, "descricao": "TESTE arredondamento", "valor": 100, "data_transacao": "2026-02-05",
        "recorrente": True, "recorrencia_tipo": "Parcelamento", "total_parcelas": 3,
    }, token)
    if st == 201 and isinstance(arr, list):
        criados += [x["id"] for x in arr]
        valores = [str(x["valor"]) for x in arr]
        checa("arredondamento 100/3 fecha em 100", abs(sum(float(v) for v in valores) - 100) < 0.001, str(valores))

    print("\n===== 5. Coerência entre relatórios =====")
    st, sm = req("GET", "/api/transacoes/summary?inicio=2026-02-01&fim=2026-02-28", None, token)
    st2, mz = req("GET", "/api/relatorios/matriz_anual?ano=2026", None, token)
    despesa_fev_matriz = mz["sumario"]["despesa"][1]
    print(f"       summary despesas fev = {sm['despesas']}")
    print(f"       matriz despesa fev   = {despesa_fev_matriz}")
    checa("summary e matriz_anual batem em fev/2026", abs(sm["despesas"] - despesa_fev_matriz) < 0.02,
          f"delta={round(sm['despesas'] - despesa_fev_matriz, 2)}")

    print("\n===== 6. Exclusão de parcelas futuras =====")
    alvo = grupo[5]["id"]
    st, r = req("DELETE", f"/api/transacoes/{alvo}?parcelamentos_futuros=true", None, token)
    checa("deleta parcelas futuras (200)", st == 200, f"status={st}")
    checa("removeu 7 parcelas (6..12)", isinstance(r, dict) and r.get("qtd") == 7, str(r))
    st, chk = req("GET", f"/api/transacoes/{grupo[0]['id']}", None, token)
    checa("parcela 1 preservada", st == 200)

print("\n===== 7. Exclusão de assinaturas futuras =====")
st, r = req("POST", "/api/transacoes/", {
    **base, "descricao": "TESTE assinatura delete", "valor": 33, "data_transacao": "2026-01-20",
    "recorrente": True, "recorrencia_tipo": "Assinatura", "frequencia": "Mensal", "data_fim": "2026-05-20",
}, token)
if st == 201 and isinstance(r, list):
    criados += [x["id"] for x in r]
    alvo = r[2]["id"]
    st, d = req("DELETE", f"/api/transacoes/{alvo}?assinaturas_futuras=true", None, token)
    checa("deleta assinaturas futuras (200)", st == 200, f"status={st}")
    checa("removeu 3 ocorrências (mar..mai)", isinstance(d, dict) and d.get("qtd") == 3, str(d))

print("\n===== 8. Cartão de crédito / competência =====")
st, r = req("POST", "/api/transacoes/", {
    **base, "descricao": "TESTE cartao", "valor": 200, "data_transacao": "2026-03-28", "forma_pagamento_id": FP_NUBANK,
}, token)
checa("cria despesa no cartão", st == 201, f"status={st}")
if st == 201:
    criados.append(r["id"])
    checa("competencia_fatura preenchida", r.get("competencia_fatura") is not None, f"comp={r.get('competencia_fatura')}")

st, r = req("POST", "/api/transacoes/", {
    **base, "descricao": "TESTE cartao parcelado", "valor": 600, "data_transacao": "2026-03-28",
    "forma_pagamento_id": FP_NUBANK, "recorrente": True, "recorrencia_tipo": "Parcelamento", "total_parcelas": 3,
}, token)
if st == 201 and isinstance(r, list):
    criados += [x["id"] for x in r]
    comps = [x.get("competencia_fatura") for x in r]
    checa("competência avança por parcela", len(set(comps)) == 3, str(comps))

print("\n===== 9. Atualização (PUT) =====")
st, r = req("POST", "/api/transacoes/", {**base, "descricao": "TESTE put", "valor": 80, "data_transacao": "2026-04-01"}, token)
if st == 201:
    tid = r["id"]
    criados.append(tid)
    st, r = req("PUT", f"/api/transacoes/{tid}", {"valor": 90, "status": "Pago"}, token)
    checa("PUT parcial (200)", st == 200, f"status={st}")
    checa("valor atualizado", str(r["valor"]) == "90.00", f"valor={r['valor']}")
    checa("status atualizado", r["status"] == "Pago")
    checa("descrição preservada", r["descricao"] == "TESTE put")
    st, r = req("PUT", f"/api/transacoes/{tid}", {"valor": -1}, token)
    checa("PUT rejeita valor negativo", st == 400, f"status={st}")
    st, r = req("PUT", f"/api/transacoes/{tid}", {"tipo": "Receita"}, token)
    checa("PUT rejeita tipo incompativel com a categoria", st == 400, f"status={st}")

print("\n===== 9b. PUT em parcela não redivide o valor =====")
st, r = req("POST", "/api/transacoes/", {
    **base, "descricao": "TESTE put parcela", "valor": 1200, "data_transacao": "2026-05-01",
    "recorrente": True, "recorrencia_tipo": "Parcelamento", "total_parcelas": 12,
}, token)
if st == 201 and isinstance(r, list):
    criados += [x["id"] for x in r]
    pid = r[0]["id"]
    st, upd = req("PUT", f"/api/transacoes/{pid}", {"valor": 150}, token)
    checa("PUT em parcela mantém o valor informado", st == 200 and str(upd["valor"]) == "150.00", f"valor={upd.get('valor') if isinstance(upd, dict) else upd}")
    checa("valor_parcela espelha o valor", isinstance(upd, dict) and str(upd["valor_parcela"]) == "150.00", f"vp={upd.get('valor_parcela') if isinstance(upd, dict) else upd}")

print("\n===== 9c. Autenticação =====")
st, _ = req("GET", "/api/transacoes/?inicio=2026-01-01&fim=2026-12-31")
checa("listar exige token", st in (401, 422), f"status={st}")

print("\n===== 10. Limpeza =====")
removidos = 0
for tid in set(criados):
    st, _ = req("DELETE", f"/api/transacoes/{tid}", None, token)
    if st == 200:
        removidos += 1
st, resto = req("GET", "/api/transacoes/?inicio=2020-01-01&fim=2040-12-31&per_page=200", None, token)
sobrando = [x["id"] for x in resto["items"] if x["descricao"].startswith("TESTE")]
for tid in sobrando:
    req("DELETE", f"/api/transacoes/{tid}", None, token)
print(f"       removidos={removidos} + resíduo={len(sobrando)}")

print("\n" + "=" * 50)
if falhas:
    print(f"{len(falhas)} FALHA(S):")
    for f in falhas:
        print("  -", f)
else:
    print("Todos os testes passaram.")
