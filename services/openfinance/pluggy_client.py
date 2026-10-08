import os
import time
import requests
from typing import Optional, Dict, Any, List

PLUGGY_BASE_URL = "https://api.pluggy.ai"

class PluggyClient:
    _api_key: Optional[str] = None
    _api_key_expires_at: float = 0.0

    @classmethod
    def get_credentials(cls) -> tuple[str, str]:
        client_id = os.getenv("PLUGGY_CLIENT_ID", "").strip()
        client_secret = os.getenv("PLUGGY_CLIENT_SECRET", "").strip()
        return client_id, client_secret

    @classmethod
    def is_configured(cls) -> bool:
        client_id, client_secret = cls.get_credentials()
        return bool(client_id and client_secret)

    @classmethod
    def _get_session(cls) -> requests.Session:
        session = requests.Session()
        # Evita travar caso variáveis de proxy corporativo inválidas estejam no ambiente
        session.trust_env = False
        return session

    @classmethod
    def get_api_key(cls, force_refresh: bool = False) -> str:
        """Obtém o apiKey da Pluggy, reutilizando o cache em memória se ainda for válido."""
        now = time.time()
        if not force_refresh and cls._api_key and now < cls._api_key_expires_at:
            return cls._api_key

        client_id, client_secret = cls.get_credentials()
        if not client_id or not client_secret:
            raise ValueError("Credenciais da Pluggy (PLUGGY_CLIENT_ID ou PLUGGY_CLIENT_SECRET) não configuradas.")

        url = f"{PLUGGY_BASE_URL}/auth"
        session = cls._get_session()
        resp = session.post(url, json={"clientId": client_id, "clientSecret": client_secret}, timeout=15)
        if not resp.ok:
            error_data = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else resp.text
            raise RuntimeError(f"Erro ao autenticar na Pluggy (HTTP {resp.status_code}): {error_data}")

        data = resp.json()
        cls._api_key = data.get("apiKey")
        # Token é válido por 2 horas (7200 segundos), renovamos com folga de 10 min
        cls._api_key_expires_at = now + 6600
        return cls._api_key

    @classmethod
    def _headers(cls) -> Dict[str, str]:
        return {
            "X-API-KEY": cls.get_api_key(),
            "Content-Type": "application/json"
        }

    @classmethod
    def test_connection(cls) -> Dict[str, Any]:
        """Testa se as credenciais configuradas conseguem autenticar na Pluggy."""
        api_key = cls.get_api_key(force_refresh=True)
        return {"status": "ok", "authenticated": True, "token_length": len(api_key)}

    @classmethod
    def create_connect_token(cls, item_id: Optional[str] = None, client_user_id: Optional[str] = None) -> Dict[str, Any]:
        """Gera um connectToken para o widget Pluggy Connect (sessão de 30 minutos)."""
        url = f"{PLUGGY_BASE_URL}/connect_token"
        payload: Dict[str, Any] = {}
        if item_id:
            payload["itemId"] = item_id
        if client_user_id:
            payload["options"] = {"clientUserId": str(client_user_id)}

        session = cls._get_session()
        resp = session.post(url, headers=cls._headers(), json=payload, timeout=15)
        if not resp.ok:
            raise RuntimeError(f"Erro ao gerar connectToken (HTTP {resp.status_code}): {resp.text}")
        return resp.json()

    @classmethod
    def get_item(cls, item_id: str) -> Dict[str, Any]:
        """Obtém detalhes de um Item (conexão bancária)."""
        url = f"{PLUGGY_BASE_URL}/items/{item_id}"
        session = cls._get_session()
        resp = session.get(url, headers=cls._headers(), timeout=15)
        if not resp.ok:
            raise RuntimeError(f"Erro ao buscar Item {item_id} (HTTP {resp.status_code}): {resp.text}")
        return resp.json()

    @classmethod
    def delete_item(cls, item_id: str) -> bool:
        """Exclui um Item da Pluggy (revogação)."""
        url = f"{PLUGGY_BASE_URL}/items/{item_id}"
        session = cls._get_session()
        resp = session.delete(url, headers=cls._headers(), timeout=15)
        return resp.status_code in (200, 204, 404)

    @classmethod
    def get_accounts(cls, item_id: str, account_type: Optional[str] = None) -> List[Dict[str, Any]]:
        """Busca as contas vinculadas a um item (ex: CREDIT para cartões, BANK para contas)."""
        url = f"{PLUGGY_BASE_URL}/accounts"
        params: Dict[str, Any] = {"itemId": item_id}
        if account_type:
            params["type"] = account_type

        session = cls._get_session()
        resp = session.get(url, headers=cls._headers(), params=params, timeout=20)
        if not resp.ok:
            raise RuntimeError(f"Erro ao buscar contas (HTTP {resp.status_code}): {resp.text}")
        data = resp.json()
        return data.get("results", [])

    @classmethod
    def get_transactions(
        cls,
        account_id: str,
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
        page: int = 1,
        page_size: int = 100
    ) -> Dict[str, Any]:
        """Busca transações de uma conta/cartão de crédito."""
        url = f"{PLUGGY_BASE_URL}/transactions"
        params: Dict[str, Any] = {
            "accountId": account_id,
            "page": page,
            "pageSize": page_size
        }
        if from_date:
            params["from"] = from_date
        if to_date:
            params["to"] = to_date

        session = cls._get_session()
        resp = session.get(url, headers=cls._headers(), params=params, timeout=25)
        if not resp.ok:
            raise RuntimeError(f"Erro ao buscar transações da conta {account_id} (HTTP {resp.status_code}): {resp.text}")
        return resp.json()

    @classmethod
    def get_bills(cls, account_id: str) -> List[Dict[str, Any]]:
        """Busca faturas de um cartão de crédito."""
        url = f"{PLUGGY_BASE_URL}/bills"
        params = {"accountId": account_id}
        session = cls._get_session()
        resp = session.get(url, headers=cls._headers(), params=params, timeout=20)
        if not resp.ok:
            return []
        data = resp.json()
        return data.get("results", [])

    @classmethod
    def get_connector(cls, connector_id: int) -> Dict[str, Any]:
        """Busca informações de uma instituição financeira/conector."""
        url = f"{PLUGGY_BASE_URL}/connectors/{connector_id}"
        session = cls._get_session()
        resp = session.get(url, headers=cls._headers(), timeout=15)
        if not resp.ok:
            return {}
        return resp.json()

