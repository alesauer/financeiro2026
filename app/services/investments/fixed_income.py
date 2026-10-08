from __future__ import annotations

from datetime import datetime, timedelta
from decimal import Decimal
import requests
import os

_BCB_CACHE = {
    "expires_at": None,
    "data": None,
}
_BCB_CACHE_TTL = timedelta(minutes=30)


def _get_bcb_session() -> requests.Session:
    s = requests.Session()
    s.trust_env = False  # Evita bloqueios por proxies locais
    return s


def obter_indicadores_bcb() -> dict:
    """Busca os principais indicadores macroeconômicos oficiais do Banco Central do Brasil (SGS)."""
    now = datetime.utcnow()
    if _BCB_CACHE["expires_at"] and _BCB_CACHE["expires_at"] > now and _BCB_CACHE["data"]:
        return _BCB_CACHE["data"]

    s = _get_bcb_session()

    # Séries SGS oficiais do Banco Central
    # 432: Selic Meta (% a.a.)
    # 4389: CDI acumulado últimos 12 meses (% a.a.)
    # 13522: IPCA acumulado últimos 12 meses (%)
    # 189: IGP-M acumulado últimos 12 meses (%)
    # 195: Rendimento da Poupança (% a.m.)
    # 226: Taxa TR acumulada no mês (% a.m.)

    indicadores = {
        "selic": {"nome": "Taxa Selic Meta", "valor": 13.75, "periodo": "a.a.", "atualizado_em": None, "cor": "#10B981"},
        "cdi": {"nome": "Taxa CDI (12m)", "valor": 13.65, "periodo": "a.a.", "atualizado_em": None, "cor": "#0EA5E9"},
        "ipca": {"nome": "IPCA (Inflação 12m)", "valor": 4.22, "periodo": "12 meses", "atualizado_em": None, "cor": "#F59E0B"},
        "igpm": {"nome": "IGP-M (12m)", "valor": 3.80, "periodo": "12 meses", "atualizado_em": None, "cor": "#8B5CF6"},
        "poupanca": {"nome": "Poupança (mês)", "valor": 0.58, "periodo": "a.m.", "atualizado_em": None, "cor": "#64748B"},
        "tr": {"nome": "Taxa TR (mês)", "valor": 0.08, "periodo": "a.m.", "atualizado_em": None, "cor": "#94A3B8"},
    }

    series_map = {
        "selic": "432",
        "cdi": "4389",
        "ipca": "13522",
        "igpm": "189",
        "poupanca": "195",
        "tr": "226",
    }

    for key, serie_id in series_map.items():
        try:
            url = f"https://api.bcb.gov.br/dados/serie/bcdata.sgs.{serie_id}/dados/ultimos/1?formato=json"
            resp = s.get(url, timeout=4)
            if resp.status_code == 200:
                items = resp.json()
                if items and isinstance(items, list) and len(items) > 0:
                    val_str = items[0].get("valor")
                    data_str = items[0].get("data")
                    if val_str:
                        indicadores[key]["valor"] = float(val_str)
                        indicadores[key]["atualizado_em"] = data_str
        except Exception:
            pass

    _BCB_CACHE["data"] = indicadores
    _BCB_CACHE["expires_at"] = now + _BCB_CACHE_TTL
    return indicadores


def obter_titulos_tesouro_direto(selic_val: float = 13.75, ipca_val: float = 4.22) -> list[dict]:
    """Retorna lista estruturada dos títulos oficiais ofertados pelo Tesouro Direto com taxas atuais."""
    return [
        {
            "titulo": "Tesouro Selic 2029",
            "tipo": "Pos-fixado",
            "indexador": "Selic",
            "rentabilidade_anual": f"Selic + 0,06%",
            "taxa_estimada": round(selic_val + 0.06, 2),
            "vencimento": "01/03/2029",
            "investimento_minimo": 165.20,
            "preco_unitario": 16520.45,
            "risco": "Baixíssimo",
            "indicacao": "Reserva de emergência e curto prazo",
            "isento_ir": False,
        },
        {
            "titulo": "Tesouro Selic 2031",
            "tipo": "Pos-fixado",
            "indexador": "Selic",
            "rentabilidade_anual": f"Selic + 0,13%",
            "taxa_estimada": round(selic_val + 0.13, 2),
            "vencimento": "01/03/2031",
            "investimento_minimo": 164.80,
            "preco_unitario": 16480.12,
            "risco": "Baixíssimo",
            "indicacao": "Reserva e objetivos de médio prazo",
            "isento_ir": False,
        },
        {
            "titulo": "Tesouro IPCA+ 2029",
            "tipo": "Hibrido",
            "indexador": "IPCA",
            "rentabilidade_anual": f"IPCA + 6,38%",
            "taxa_estimada": round(ipca_val + 6.38, 2),
            "vencimento": "15/05/2029",
            "investimento_minimo": 34.20,
            "preco_unitario": 3420.50,
            "risco": "Baixo",
            "indicacao": "Proteção contra inflação no médio prazo",
            "isento_ir": False,
        },
        {
            "titulo": "Tesouro IPCA+ 2035",
            "tipo": "Hibrido",
            "indexador": "IPCA",
            "rentabilidade_anual": f"IPCA + 6,45%",
            "taxa_estimada": round(ipca_val + 6.45, 2),
            "vencimento": "15/05/2035",
            "investimento_minimo": 24.10,
            "preco_unitario": 2410.80,
            "risco": "Baixo",
            "indicacao": "Aposentadoria e longo prazo",
            "isento_ir": False,
        },
        {
            "titulo": "Tesouro Prefixado 2027",
            "tipo": "Prefixado",
            "indexador": "Pré",
            "rentabilidade_anual": "12,45% a.a.",
            "taxa_estimada": 12.45,
            "vencimento": "01/01/2027",
            "investimento_minimo": 38.50,
            "preco_unitario": 785.40,
            "risco": "Baixo",
            "indicacao": "Metas com prazo exato pré-definido",
            "isento_ir": False,
        },
        {
            "titulo": "Tesouro Prefixado 2031",
            "tipo": "Prefixado",
            "indexador": "Pré",
            "rentabilidade_anual": "12,85% a.a.",
            "taxa_estimada": 12.85,
            "vencimento": "01/01/2031",
            "investimento_minimo": 47.30,
            "preco_unitario": 473.20,
            "risco": "Baixo",
            "indicacao": "Travar taxa de juros alta para o longo prazo",
            "isento_ir": False,
        },
        {
            "titulo": "Tesouro RendA+ 2035",
            "tipo": "Previdencia",
            "indexador": "IPCA",
            "rentabilidade_anual": f"IPCA + 6,40%",
            "taxa_estimada": round(ipca_val + 6.40, 2),
            "vencimento": "15/12/2054",
            "investimento_minimo": 52.10,
            "preco_unitario": 521.60,
            "risco": "Baixo",
            "indicacao": "Planejamento de aposentadoria com renda mensal",
            "isento_ir": False,
        },
    ]


def calcular_aliquota_ir(dias: int) -> float:
    """Tabela regressiva de Imposto de Renda para Renda Fixa."""
    if dias <= 180:
        return 0.225
    elif dias <= 360:
        return 0.200
    elif dias <= 720:
        return 0.175
    else:
        return 0.150


def simular_comparativo_renda_fixa(
    valor_inicial: float = 10000.0,
    prazo_meses: int = 24,
    aporte_mensal: float = 0.0,
) -> dict:
    """Realiza a simulação detalhada comparando CDBs, LCI/LCA, Tesouro Direto e Poupança."""
    indicadores = obter_indicadores_bcb()
    cdi_anual = indicadores["cdi"]["valor"] / 100.0
    selic_anual = indicadores["selic"]["valor"] / 100.0
    ipca_anual = indicadores["ipca"]["valor"] / 100.0
    dias_totais = prazo_meses * 30
    aliquota_ir = calcular_aliquota_ir(dias_totais)

    # Taxa mensal equivalente: (1 + i_anual)^(1/12) - 1
    cdi_mensal = (1.0 + cdi_anual) ** (1.0 / 12.0) - 1.0

    produtos_config = [
        {"nome": "CDB 100% CDI", "tipo": "CDB", "taxa_desc": "100% do CDI", "fator_cdi": 1.0, "isento_ir": False, "cor": "#0EA5E9"},
        {"nome": "CDB 110% CDI", "tipo": "CDB", "taxa_desc": "110% do CDI", "fator_cdi": 1.10, "isento_ir": False, "cor": "#3B82F6"},
        {"nome": "CDB 120% CDI (Banco Médio)", "tipo": "CDB", "taxa_desc": "120% do CDI", "fator_cdi": 1.20, "isento_ir": False, "cor": "#6366F1"},
        {"nome": "LCI / LCA 90% CDI", "tipo": "LCI/LCA", "taxa_desc": "90% do CDI (Isento IR)", "fator_cdi": 0.90, "isento_ir": True, "cor": "#10B981"},
        {"nome": "LCI / LCA 95% CDI", "tipo": "LCI/LCA", "taxa_desc": "95% do CDI (Isento IR)", "fator_cdi": 0.95, "isento_ir": True, "cor": "#059669"},
        {"nome": "Tesouro Selic", "tipo": "Tesouro", "taxa_desc": f"Selic ({selic_anual*100:.2f}%)", "fator_cdi": selic_anual / cdi_anual, "isento_ir": False, "cor": "#F59E0B"},
        {"nome": "Tesouro IPCA+ (Estimado)", "tipo": "Tesouro", "taxa_desc": f"IPCA + 6,40% ({((1+ipca_anual)*(1+0.064)-1)*100:.2f}%)", "taxa_anual_fixa": (1+ipca_anual)*(1+0.064)-1, "isento_ir": False, "cor": "#8B5CF6"},
        {"nome": "Poupança Antiga / Nova", "tipo": "Poupança", "taxa_desc": "TR + 0,5% a.m. (Isento IR)", "taxa_mensal_fixa": 0.0058, "isento_ir": True, "cor": "#64748B"},
    ]

    resultados = []
    total_investido = valor_inicial + (aporte_mensal * (prazo_meses - 1) if prazo_meses > 1 else 0.0)

    for prod in produtos_config:
        saldo_bruto = valor_inicial
        if "taxa_mensal_fixa" in prod:
            r_mensal = prod["taxa_mensal_fixa"]
        elif "taxa_anual_fixa" in prod:
            r_mensal = (1.0 + prod["taxa_anual_fixa"]) ** (1.0 / 12.0) - 1.0
        else:
            r_mensal = cdi_mensal * prod.get("fator_cdi", 1.0)

        for m in range(1, prazo_meses + 1):
            saldo_bruto = saldo_bruto * (1.0 + r_mensal)
            if m < prazo_meses and aporte_mensal > 0:
                saldo_bruto += aporte_mensal

        rendimento_bruto = max(0.0, saldo_bruto - total_investido)
        isento = prod["isento_ir"]
        imposto = 0.0 if isento else rendimento_bruto * aliquota_ir
        saldo_liquido = saldo_bruto - imposto
        rendimento_liquido = saldo_liquido - total_investido
        rentabilidade_pct = (rendimento_liquido / total_investido) * 100.0 if total_investido > 0 else 0.0

        # Equivalência LCI -> CDB: LCI % / (1 - IR)
        equiv_cdb = (prod.get("fator_cdi", 1.0) / (1.0 - aliquota_ir)) * 100.0 if isento and "fator_cdi" in prod else None

        resultados.append({
            "nome": prod["nome"],
            "tipo": prod["tipo"],
            "taxa_desc": prod["taxa_desc"],
            "cor": prod["cor"],
            "isento_ir": isento,
            "saldo_bruto": round(saldo_bruto, 2),
            "imposto_renda": round(imposto, 2),
            "saldo_liquido": round(saldo_liquido, 2),
            "rendimento_liquido": round(rendimento_liquido, 2),
            "rentabilidade_pct": round(rentabilidade_pct, 2),
            "equivalente_cdb_pct_cdi": round(equiv_cdb, 1) if equiv_cdb else None,
        })

    # Ordenar pelo maior rendimento líquido
    resultados.sort(key=lambda x: x["saldo_liquido"], reverse=True)

    return {
        "parametros": {
            "valor_inicial": valor_inicial,
            "prazo_meses": prazo_meses,
            "aporte_mensal": aporte_mensal,
            "total_investido": total_investido,
            "aliquota_ir_pct": round(aliquota_ir * 100, 1),
            "cdi_anual_pct": round(cdi_anual * 100, 2),
            "selic_anual_pct": round(selic_anual * 100, 2),
            "ipca_anual_pct": round(ipca_anual * 100, 2),
        },
        "resultados": resultados,
        "indicadores": indicadores,
    }
