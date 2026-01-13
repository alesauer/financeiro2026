import os
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()

class Config:
    SQLALCHEMY_DATABASE_URI = os.getenv(
        "DATABASE_URL",
        "mysql://root:teste10@localhost:3306/gestao_financeira"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SECRET_KEY = os.getenv("SECRET_KEY", "chave-secreta")
    
    # Configuração JWT - token expira em 7 dias
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", SECRET_KEY)
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(days=7)

    # Mailgun / Email
    MAILGUN_API_KEY = os.getenv("MAILGUN_API_KEY")
    MAILGUN_DOMAIN = os.getenv("MAILGUN_DOMAIN")
    # Base URL permite trocar US/EU sem alterar o código
    MAILGUN_BASE_URL = os.getenv("MAILGUN_BASE_URL", "https://api.mailgun.net")
    # Remetente padrão; se não definido, usa postmaster@<domínio>
    MAILGUN_FROM = os.getenv("MAILGUN_FROM") or (
        f"postmaster@{os.getenv('MAILGUN_DOMAIN')}" if os.getenv('MAILGUN_DOMAIN') else None
    )
