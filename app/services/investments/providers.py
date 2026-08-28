from __future__ import annotations

from abc import ABC, abstractmethod
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from decimal import Decimal

import requests


class InvestmentProvider(ABC):
    nome = "base"

    @abstractmethod
    def get_quote(self, codigo: str) -> dict | None:
        raise NotImplementedError

    def get_asset(self, codigo: str) -> dict | None:
        return None

    def get_dividends(self, codigo: str) -> list[dict]:
        return []

    def get_history(self, codigo: str) -> list[dict]:
        return []

    def get_fixed_income(self, product_code: str) -> dict | None:
        return None

    def get_market_snapshot(self) -> dict:
        return {"indices": [], "movers": [], "fx": [], "updated_at": None}


class YahooProvider(InvestmentProvider):
    nome = "yahoo"
    REQUEST_TIMEOUT = 1.2
    CHART_MAX_WORKERS = 8

    def _fetch_quotes(self, symbols: list[str]) -> list[dict]:
        if not symbols:
            return []
        try:
            url = "https://query1.finance.yahoo.com/v7/finance/quote"
            response = requests.get(
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
            url = f"https://query2.finance.yahoo.com/v8/finance/chart/{symbol}"
            response = requests.get(
                url,
                params={"range": "1d", "interval": "1d"},
                timeout=self.REQUEST_TIMEOUT,
                headers={"User-Agent": "Mozilla/5.0"},
            )
            response.raise_for_status()
            payload = response.json() or {}
            result = (payload.get("chart", {}).get("result") or [])
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
            result = self._fetch_quotes_with_fallback([codigo])
            if not result:
                return None
            item = result[0]
            price = item.get("regularMarketPrice")
            if price is None:
                return None
            return {
                "provider": self.nome,
                "preco": Decimal(str(price)),
                "variacao_percentual": Decimal(str(item.get("regularMarketChangePercent"))) if item.get("regularMarketChangePercent") is not None else None,
                "moeda": item.get("currency") or "BRL",
                "cotado_em": datetime.utcnow(),
            }
        except Exception:
            return None

    def get_market_snapshot(self) -> dict:
        indices_symbols = [
            "^BVSP",   # Ibovespa
            "^GSPC",   # S&P 500
            "^IXIC",   # Nasdaq
            "^DJI",    # Dow Jones
            "^FTSE",   # FTSE 100
            "^N225",   # Nikkei 225
            "^HSI",    # Hang Seng
        ]
        movers_symbols = [
            "PETR4.SA", "VALE3.SA", "ITUB4.SA", "BBDC4.SA", "BBAS3.SA", "WEGE3.SA",
            "AAPL", "MSFT", "NVDA", "TSLA", "AMZN", "META",
        ]
        fx_symbols = ["USDBRL=X", "EURBRL=X", "BTC-USD", "GC=F", "CL=F"]

        with ThreadPoolExecutor(max_workers=3) as executor:
            future_indices = executor.submit(self._fetch_quotes_with_fallback, indices_symbols)
            future_movers = executor.submit(self._fetch_quotes_with_fallback, movers_symbols)
            future_fx = executor.submit(self._fetch_quotes_with_fallback, fx_symbols)

            indices_raw = future_indices.result()
            movers_raw = future_movers.result()
            fx_raw = future_fx.result()

        def normalize(item: dict) -> dict:
            price = item.get("regularMarketPrice")
            change = item.get("regularMarketChange")
            change_pct = item.get("regularMarketChangePercent")
            return {
                "symbol": item.get("symbol"),
                "name": item.get("shortName") or item.get("longName") or item.get("symbol"),
                "price": float(price) if price is not None else None,
                "change": float(change) if change is not None else None,
                "change_percent": float(change_pct) if change_pct is not None else None,
                "currency": item.get("currency") or "USD",
                "market_state": item.get("marketState"),
            }

        movers_norm = [normalize(i) for i in movers_raw if i.get("regularMarketPrice") is not None]
        movers_norm.sort(key=lambda x: x.get("change_percent") or 0, reverse=True)

        return {
            "indices": [normalize(i) for i in indices_raw],
            "movers": movers_norm[:8],
            "fx": [normalize(i) for i in fx_raw],
            "updated_at": datetime.utcnow().isoformat() + "Z",
        }


class BrapiProvider(InvestmentProvider):
    nome = "brapi"

    def get_quote(self, codigo: str) -> dict | None:
        try:
            url = f"https://brapi.dev/api/quote/{codigo}"
            response = requests.get(url, timeout=8)
            response.raise_for_status()
            payload = response.json() or {}
            result = payload.get("results") or []
            if not result:
                return None
            item = result[0]
            price = item.get("regularMarketPrice")
            if price is None:
                return None
            return {
                "provider": self.nome,
                "preco": Decimal(str(price)),
                "variacao_percentual": Decimal(str(item.get("regularMarketChangePercent"))) if item.get("regularMarketChangePercent") is not None else None,
                "moeda": item.get("currency") or "BRL",
                "cotado_em": datetime.utcnow(),
            }
        except Exception:
            return None


def get_default_provider() -> InvestmentProvider:
    return BrapiProvider()


def get_fallback_provider() -> InvestmentProvider:
    return YahooProvider()
