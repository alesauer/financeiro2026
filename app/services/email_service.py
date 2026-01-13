import os
import requests
from typing import List, Optional, Tuple, Union

try:
    # Importa Config do app
    from app.config import Config
except Exception:
    # Fallback para execução isolada
    class Config:
        MAILGUN_API_KEY = os.getenv("MAILGUN_API_KEY")
        MAILGUN_DOMAIN = os.getenv("MAILGUN_DOMAIN")
        MAILGUN_BASE_URL = os.getenv("MAILGUN_BASE_URL", "https://api.mailgun.net")
        MAILGUN_FROM = os.getenv("MAILGUN_FROM") or (f"postmaster@{os.getenv('MAILGUN_DOMAIN')}" if os.getenv('MAILGUN_DOMAIN') else None)


def _get_mailgun_endpoint(domain: str) -> str:
    base = Config.MAILGUN_BASE_URL.rstrip('/')
    return f"{base}/v3/{domain}/messages"


def send_email(
    to: Union[str, List[str]],
    subject: str,
    text: Optional[str] = None,
    html: Optional[str] = None,
    attachments: Optional[List[Tuple[str, bytes]]] = None,
    cc: Optional[Union[str, List[str]]] = None,
    bcc: Optional[Union[str, List[str]]] = None,
    from_addr: Optional[str] = None,
    timeout_sec: float = 10.0
) -> dict:
    """
    Envia e-mails via Mailgun.

    Parâmetros:
      - to: destinatário(s) (string ou lista)
      - subject: assunto
      - text: corpo texto puro (opcional)
      - html: corpo HTML (opcional)
      - attachments: lista de tuplas (filename, bytes) (opcional)
      - cc, bcc: cópia e cópia oculta
      - from_addr: remetente; se None, usa Config.MAILGUN_FROM
      - timeout_sec: timeout da requisição

    Retorna dict com:
      - ok: bool
      - status_code: int
      - id: str (se ok)
      - error: str (se falha)
    """
    api_key = Config.MAILGUN_API_KEY
    domain = Config.MAILGUN_DOMAIN
    default_from = Config.MAILGUN_FROM

    if not api_key:
        return {"ok": False, "status_code": None, "error": "MAILGUN_API_KEY não configurada"}
    if not domain:
        return {"ok": False, "status_code": None, "error": "MAILGUN_DOMAIN não configurado"}

    endpoint = _get_mailgun_endpoint(domain)

    data = {
        "from": from_addr or default_from or f"postmaster@{domain}",
        "subject": subject,
    }

    if isinstance(to, list):
        data["to"] = to
    else:
        data["to"] = [to]

    if cc:
        data["cc"] = cc
    if bcc:
        data["bcc"] = bcc

    # Pelo menos um dos corpos deve existir
    if not text and not html:
        text = ""
    if text:
        data["text"] = text
    if html:
        data["html"] = html

    files = None
    if attachments:
        # Monta lista no formato aceito por requests
        files = [("attachment", (filename, content_bytes)) for filename, content_bytes in attachments]

    try:
        resp = requests.post(
            endpoint,
            auth=("api", api_key),
            data=data,
            files=files,
            timeout=timeout_sec,
        )
        # Sucesso: Mailgun geralmente retorna 200/OK com id
        if resp.ok:
            try:
                j = resp.json()
            except Exception:
                j = {}
            return {"ok": True, "status_code": resp.status_code, "id": j.get("id")}
        else:
            # Falha HTTP
            try:
                err = resp.json()
            except Exception:
                err = {"message": resp.text}
            return {"ok": False, "status_code": resp.status_code, "error": err.get("message") or err}
    except requests.exceptions.Timeout:
        return {"ok": False, "status_code": None, "error": "Timeout ao enviar e-mail"}
    except requests.exceptions.RequestException as e:
        return {"ok": False, "status_code": None, "error": f"Erro de rede: {e}"}
