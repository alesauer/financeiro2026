from __future__ import annotations

from abc import ABC, abstractmethod
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta
from decimal import Decimal
import os
import time

import requests

from .fixed_income import obter_indicadores_bcb, obter_titulos_tesouro_direto

_SNAPSHOT_CACHE = {
    "expires_at": None,
    "data": None,
}
_SNAPSHOT_CACHE_TTL = timedelta(seconds=90)


def _get_clean_session() -> requests.Session:
    s = requests.Session()
    s.trust_env = False
    return s


class InvestmentProvider(ABC):
    nome = "base"

    @abstractmethod
    def get_quote(self, codigo: str) -> dict | None:
        raise NotImplementedError

    def search_assets(self, query: str) -> list[dict]:
        return []

    def get_asset(self, codigo: str) -> dict | None:
        return None

    def get_dividends(self, codigo: str) -> list[dict]:
        return []

    def get_history(self, codigo: str) -> list[dict]:
        return []

    def get_fixed_income(self, product_code: str) -> dict | None:
        return None

    def get_market_snapshot(self) -> dict:
        return {
            "indices": [],
            "acoes": [],
            "fiis": [],
            "bdrs_etfs": [],
            "renda_fixa": {},
            "fx": [],
            "updated_at": None,
            "source": self.nome,
        }


class YahooProvider(InvestmentProvider):
    nome = "yahoo"
    REQUEST_TIMEOUT = 2.0
    CHART_MAX_WORKERS = 6

    def _fetch_quotes(self, symbols: list[str]) -> list[dict]:
        if not symbols:
            return []
        try:
            s = _get_clean_session()
            url = "https://query1.finance.yahoo.com/v7/finance/quote"
            response = s.get(
                url,
                params={"symbols": ",".join(symbols)},
                timeout=self.REQUEST_TIMEOUT,
                headers={"User-Agent": "Mozilla/5.0"},
            )
            response.raise_for_status()
            payload = response.json() or {}
            return payload.get("quoteResponse", {}).get("result") or []
        except Exception:
            return []

    def _fetch_chart(self, symbol: str) -> dict | None:
        try:
            s = _get_clean_session()
            url = f"https://query2.finance.yahoo.com/v8/finance/chart/{symbol}"
            response = s.get(
                url,
                params={"range": "1d", "interval": "1d"},
                timeout=self.REQUEST_TIMEOUT,
                headers={"User-Agent": "Mozilla/5.0"},
            )
            response.raise_for_status()
            payload = response.json() or {}
            result = payload.get("chart", {}).get("result") or []
            if not result:
                return None

            item = result[0]
            meta = item.get("meta") or {}
            previous = meta.get("chartPreviousClose")
            current = meta.get("regularMarketPrice")
            if current is None:
                return None

            change = None
            change_pct = None
            if previous not in (None, 0):
                change = float(current) - float(previous)
                change_pct = (change / float(previous)) * 100

            return {
                "symbol": meta.get("symbol") or symbol,
                "name": meta.get("symbol") or symbol,
                "regularMarketPrice": current,
                "regularMarketChange": change,
                "regularMarketChangePercent": change_pct,
                "currency": meta.get("currency") or "USD",
                "marketState": meta.get("marketState"),
            }
        except Exception:
            return None

    def _fetch_quotes_with_fallback(self, symbols: list[str]) -> list[dict]:
        primary = self._fetch_quotes(symbols)
        by_symbol = {item.get("symbol"): item for item in primary if item.get("symbol")}

        out = []
        missing_symbols = []
        for symbol in symbols:
            item = by_symbol.get(symbol)
            if item and item.get("regularMarketPrice") is not None:
                out.append(item)
                continue
            missing_symbols.append(symbol)

        if missing_symbols:
            workers = min(self.CHART_MAX_WORKERS, len(missing_symbols))
            with ThreadPoolExecutor(max_workers=workers) as executor:
                future_map = {executor.submit(self._fetch_chart, sym): sym for sym in missing_symbols}
                for future in as_completed(future_map):
                    item = future.result()
                    if item:
                        out.append(item)

        return out

    def get_quote(self, codigo: str) -> dict | None:
        try:
            sym = codigo if ("." in codigo or "^" in codigo or "=" in codigo or "-" in codigo) else f"{codigo}.SA"
            result = self._fetch_quotes_with_fallback([sym])
            if not result:
                return None
            item = result[0]
            price = item.get("regularMarketPrice")
            if price is None:
                return None
            return {
                "provider": self.nome,
                "codigo": codigo,
                "nome": item.get("shortName") or item.get("longName") or codigo,
                "preco": Decimal(str(price)),
                "variacao": Decimal(str(item.get("regularMarketChange"))) if item.get("regularMarketChange") is not None else None,
                "variacao_percentual": Decimal(str(item.get("regularMarketChangePercent"))) if item.get("regularMarketChangePercent") is not None else None,
                "moeda": item.get("currency") or "BRL",
                "logo": None,
                "cotado_em": datetime.utcnow(),
            }
        except Exception:
            return None

    def get_market_snapshot(self) -> dict:
        indices_symbols = ["^BVSP", "^GSPC", "^IXIC", "^DJI", "^FTSE", "^N225"]
        fx_symbols = ["USDBRL=X", "EURBRL=X", "BTC-USD", "ETH-USD", "GC=F", "CL=F"]

        with ThreadPoolExecutor(max_workers=2) as executor:
            future_indices = executor.submit(self._fetch_quotes_with_fallback, indices_symbols)
            future_fx = executor.submit(self._fetch_quotes_with_fallback, fx_symbols)

            indices_raw = future_indices.result()
            fx_raw = future_fx.result()

        def normalize(item: dict) -> dict:
            price = item.get("regularMarketPrice")
            change = item.get("regularMarketChange")
            change_pct = item.get("regularMarketChangePercent")
            sym = item.get("symbol") or ""
            name = item.get("shortName") or item.get("longName") or sym
            if sym == "^BVSP":
                name = "Ibovespa"
            elif sym == "^GSPC":
                name = "S&P 500"
            elif sym == "^IXIC":
                name = "Nasdaq"
            elif sym == "^DJI":
                name = "Dow Jones"
            elif sym == "USDBRL=X":
                name = "Dólar Comercial"
            elif sym == "EURBRL=X":
                name = "Euro Comercial"
            elif sym == "BTC-USD":
                name = "Bitcoin (USD)"
            elif sym == "ETH-USD":
                name = "Ethereum (USD)"
            elif sym == "GC=F":
                name = "Ouro (Onça Troy)"
            elif sym == "CL=F":
                name = "Petróleo WTI"

            return {
                "symbol": sym,
                "name": name,
                "price": float(price) if price is not None else None,
                "change": float(change) if change is not None else None,
                "change_percent": float(change_pct) if change_pct is not None else None,
                "currency": item.get("currency") or "USD",
            }

        indicadores_bcb = obter_indicadores_bcb()
        selic_v = indicadores_bcb.get("selic", {}).get("valor", 13.75)
        ipca_v = indicadores_bcb.get("ipca", {}).get("valor", 4.22)
        tesouro_titulos = obter_titulos_tesouro_direto(selic_v, ipca_v)

        return {
            "source": self.nome,
            "indices": [normalize(i) for i in indices_raw],
            "movers": [],
            "acoes": [],
            "fiis": [],
            "bdrs_etfs": [],
            "renda_fixa": {
                "indicadores": indicadores_bcb,
                "tesouro_direto": tesouro_titulos,
            },
            "fx": [normalize(i) for i in fx_raw],
            "updated_at": datetime.utcnow().isoformat() + "Z",
        }


class BrapiProvider(InvestmentProvider):
    nome = "brapi"
    BASE_URL = "https://brapi.dev/api"
    TIMEOUT = 6

    def _get_token(self) -> str:
        return os.getenv("BRAPI_API_TOKEN", "rXb5f2VaNRrJpg3DGA342h").strip()

    def _clean_symbol(self, codigo: str) -> str:
        s = codigo.upper().strip()
        if s.endswith(".SA"):
            s = s[:-3]
        return s

    def get_quote(self, codigo: str) -> dict | None:
        sym = self._clean_symbol(codigo)
        token = self._get_token()
        s = _get_clean_session()

        try:
            url = f"{self.BASE_URL}/quote/{sym}"
            params = {}
            if token:
                params["token"] = token

            response = s.get(url, params=params, timeout=self.TIMEOUT)
            if response.status_code == 200:
                payload = response.json() or {}
                results = payload.get("results") or []
                if results:
                    item = results[0]
                    price = item.get("regularMarketPrice")
                    if price is not None:
                        return {
                            "provider": self.nome,
                            "codigo": item.get("symbol") or sym,
                            "nome": item.get("longName") or item.get("shortName") or sym,
                            "preco": Decimal(str(price)),
                            "variacao": Decimal(str(item.get("regularMarketChange"))) if item.get("regularMarketChange") is not None else None,
                            "variacao_percentual": Decimal(str(item.get("regularMarketChangePercent"))) if item.get("regularMarketChangePercent") is not None else None,
                            "moeda": item.get("currency") or "BRL",
                            "logo": item.get("logourl"),
                            "max_52w": float(item["fiftyTwoWeekHigh"]) if item.get("fiftyTwoWeekHigh") is not None else None,
                            "min_52w": float(item["fiftyTwoWeekLow"]) if item.get("fiftyTwoWeekLow") is not None else None,
                            "pl": float(item["priceEarnings"]) if item.get("priceEarnings") is not None else None,
                            "lpa": float(item["earningsPerShare"]) if item.get("earningsPerShare") is not None else None,
                            "volume": item.get("regularMarketVolume"),
                            "cotado_em": datetime.utcnow(),
                        }
        except Exception:
            pass

        # Fallback to Yahoo if Brapi fails
        yahoo = YahooProvider()
        return yahoo.get_quote(codigo)

    def search_assets(self, query: str) -> list[dict]:
        """Pesquisa ativos na B3 em tempo real via brapi.dev."""
        q = query.strip()
        if not q:
            return []

        token = self._get_token()
        s = _get_clean_session()

        try:
            url = f"{self.BASE_URL}/quote/list"
            params = {"search": q, "limit": 20}
            if token:
                params["token"] = token

            response = s.get(url, params=params, timeout=self.TIMEOUT)
            if response.status_code == 200:
                payload = response.json() or {}
                stocks = payload.get("stocks") or []
                out = []
                for item in stocks:
                    # Ignora tickers fracionários (terminados em F) se existir o padrão
                    sym = item.get("stock") or ""
                    out.append({
                        "symbol": sym,
                        "name": item.get("name") or sym,
                        "price": float(item["close"]) if item.get("close") is not None else None,
                        "change": None,
                        "change_percent": float(item["change"]) if item.get("change") is not None else None,
                        "currency": "BRL",
                        "logo": item.get("logo"),
                        "sector": item.get("sector"),
                        "subsector": item.get("subsector"),
                        "type": item.get("type"),
                        "volume": item.get("volume"),
                        "market_cap": item.get("market_cap"),
                    })
                return out
        except Exception as err:
            print("Erro search_assets brapi:", err)

        return []

    def _fetch_single_brapi(self, sym: str) -> dict | None:
        token = self._get_token()
        s = _get_clean_session()
        try:
            url = f"{self.BASE_URL}/quote/{sym}"
            params = {}
            if token:
                params["token"] = token
            resp = s.get(url, params=params, timeout=self.TIMEOUT)
            if resp.status_code == 200:
                payload = resp.json() or {}
                results = payload.get("results") or []
                if results:
                    return results[0]
        except Exception:
            pass
        return None

    def get_market_snapshot(self) -> dict:
        now = datetime.utcnow()
        if _SNAPSHOT_CACHE["expires_at"] and _SNAPSHOT_CACHE["expires_at"] > now and _SNAPSHOT_CACHE["data"]:
            return _SNAPSHOT_CACHE["data"]

        # Tickers de destaque B3
        acoes_symbols = [
            "PETR4", "VALE3", "ITUB4", "BBAS3", "BBDC4", "WEGE3",
            "MGLU3", "B3SA3", "RENT3", "PRIO3", "ELET3", "ABEV3", "TAEE11", "SUZB3"
        ]
        fiis_symbols = [
            "MXRF11", "HGLG11", "XPML11", "KNIP11", "BTLG11",
            "VISC11", "CPTS11", "TGAR11", "KNCR11", "HGRU11"
        ]
        bdrs_symbols = [
            "IVVB11", "BOVA11", "SMAL11", "AAPL34", "NVDC34",
            "MSFT34", "AMZO34", "GOGL34", "TSLA34"
        ]

        def fetch_ticker_list(symbols: list[str]) -> list[dict]:
            out = []
            for sym in symbols:
                raw = self._fetch_single_brapi(sym)
                if raw and raw.get("regularMarketPrice") is not None:
                    out.append({
                        "symbol": raw.get("symbol") or sym,
                        "name": raw.get("shortName") or raw.get("longName") or sym,
                        "price": float(raw["regularMarketPrice"]),
                        "change": float(raw["regularMarketChange"]) if raw.get("regularMarketChange") is not None else None,
                        "change_percent": float(raw["regularMarketChangePercent"]) if raw.get("regularMarketChangePercent") is not None else None,
                        "currency": raw.get("currency") or "BRL",
                        "logo": raw.get("logourl"),
                        "max_52w": float(raw["fiftyTwoWeekHigh"]) if raw.get("fiftyTwoWeekHigh") is not None else None,
                        "min_52w": float(raw["fiftyTwoWeekLow"]) if raw.get("fiftyTwoWeekLow") is not None else None,
                        "pl": float(raw["priceEarnings"]) if raw.get("priceEarnings") is not None else None,
                        "lpa": float(raw["earningsPerShare"]) if raw.get("earningsPerShare") is not None else None,
                        "volume": raw.get("regularMarketVolume"),
                    })
                time.sleep(0.06)  # Smooth rate limiting
            return out

        with ThreadPoolExecutor(max_workers=4) as executor:
            fut_acoes = executor.submit(fetch_ticker_list, acoes_symbols)
            fut_fiis = executor.submit(fetch_ticker_list, fiis_symbols)
            fut_bdrs = executor.submit(fetch_ticker_list, bdrs_symbols)
            fut_yahoo = executor.submit(YahooProvider().get_market_snapshot)

            acoes_norm = fut_acoes.result()
            fiis_norm = fut_fiis.result()
            bdrs_norm = fut_bdrs.result()
            yahoo_snap = fut_yahoo.result()

        indicadores_bcb = obter_indicadores_bcb()
        selic_v = indicadores_bcb.get("selic", {}).get("valor", 13.75)
        ipca_v = indicadores_bcb.get("ipca", {}).get("valor", 4.22)
        tesouro_titulos = obter_titulos_tesouro_direto(selic_v, ipca_v)

        # Movers combinados para a visão geral
        all_b3 = acoes_norm + fiis_norm + bdrs_norm
        movers_sorted = sorted(all_b3, key=lambda x: abs(x.get("change_percent") or 0), reverse=True)

        snapshot = {
            "source": "brapi.dev + Banco Central (BCB)",
            "indices": yahoo_snap.get("indices", []),
            "movers": movers_sorted[:10],
            "acoes": acoes_norm,
            "fiis": fiis_norm,
            "bdrs_etfs": bdrs_norm,
            "renda_fixa": {
                "indicadores": indicadores_bcb,
                "tesouro_direto": tesouro_titulos,
            },
            "fx": yahoo_snap.get("fx", []),
            "updated_at": datetime.utcnow().isoformat() + "Z",
        }

        _SNAPSHOT_CACHE["data"] = snapshot
        _SNAPSHOT_CACHE["expires_at"] = now + _SNAPSHOT_CACHE_TTL
        return snapshot


def get_default_provider() -> InvestmentProvider:
    return BrapiProvider()


def get_fallback_provider() -> InvestmentProvider:
    return YahooProvider()
