import os
import sys
from pathlib import Path

# Garantir que o diretório raiz do projeto esteja no sys.path
# /financas/scripts/send_test_email.py -> raiz é /financas
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.services import send_email

if __name__ == "__main__":
    to = os.getenv("EMAIL_TEST_TO") or os.getenv("MAILGUN_TEST_TO")
    if not to:
        print("Defina EMAIL_TEST_TO (ou MAILGUN_TEST_TO) no ambiente para testar.")
        raise SystemExit(1)

    subject = os.getenv("EMAIL_TEST_SUBJECT", "Teste Mailgun")
    text = os.getenv("EMAIL_TEST_TEXT", "Teste de envio via Mailgun.")
    html = os.getenv("EMAIL_TEST_HTML", None)

    result = send_email(to=to, subject=subject, text=text, html=html)
    print("Resultado:", result)
