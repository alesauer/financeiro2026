
# Sistema de Gestão Financeira Pessoal

## Visão Geral
Este projeto é um sistema completo para gestão de finanças pessoais, desenvolvido em Flask (backend) e HTML/JS/Bootstrap (frontend). Permite o controle de categorias, transações, usuários, relatórios e configurações avançadas.

---

## Funcionalidades

- **Dashboard**: Visão geral das finanças.
- **Importação CSV**: Importa transações de arquivos CSV.
- **Classificação automática (IA)**: Sugestão de categorias baseada em inteligência artificial.
- **CRUD de Categorias**: Criar, listar, editar e excluir categorias.
- **CRUD de Transações**: Gerenciar receitas e despesas.
- **CRUD de Usuários**: Cadastro, login, edição e exclusão de usuários.
- **Relatórios**: Visualização de dados por período, categoria, tipo, etc.
- **Configurações Avançadas (Outros)**: Página de configurações com layout moderno (Bootstrap), switches, selects e ações administrativas.

---

## Estrutura do Projeto

```
├── app/
│   ├── __init__.py
│   ├── config.py
│   ├── models.py
│   ├── routes.py
│   ├── routes_categorias.py
│   ├── routes_transacoes.py
│   ├── routes_usuarios.py
│   ├── routes_relatorios.py
│   ├── schemas.py
│   └── ...
├── frontend/
│   ├── index.html
│   ├── categorias.html
│   ├── transacoes.html
│   ├── relatorios.html
│   ├── nav.html
│   ├── outros.html
│   └── assets/
│       ├── css/
│       ├── js/
│       └── libs/
├── migrations/
│   └── ...
├── sql/
│   ├── createDb.sql
│   └── testeMockup.sql
├── testes_http/
│   └── ...
├── requirements.txt
├── run.py
├── README.md
└── ...
```

---

## Backend

- **Framework:** Flask
- **ORM:** SQLAlchemy
- **Validação:** Marshmallow
- **Migração:** Flask-Migrate (Alembic)
- **Banco de Dados:** MySQL
- **CORS:** Flask-CORS

### Modelos
- Categoria
- Transacao
- Usuario (com senha hash)

### Endpoints REST
- `/categorias` - CRUD de categorias
- `/transacoes` - CRUD de transações
- `/usuarios` - CRUD e login de usuários
- `/relatorios` - Relatórios financeiros

---

## Frontend

- **HTML5, Bootstrap 5, JavaScript**
- **AJAX/fetch** para integração com backend
- Telas: Dashboard, Categorias, Transações, Relatórios, Usuários, Configurações (Outros)

---

## Migração e Banco de Dados

1. Configure o banco MySQL (veja `sql/createDb.sql`).
2. Ajuste as credenciais em `app/config.py`.
3. Execute as migrações:
   ```bash
   flask db migrate
   flask db upgrade
   ```

---

## Instalação e Deploy do Zero

### 1. Clone o repositório
```bash
git clone https://github.com/alesauer/financeiro2026.git
cd financeiro2026
```

### 2. Crie e ative o ambiente virtual
```bash
python -m venv venv
source venv/Scripts/activate  # Windows
```

### 3. Instale as dependências
```bash
pip install -r requirements.txt
```

### 4. Configure o banco de dados
Edite `app/config.py` com suas credenciais MySQL.
Crie o banco usando o script em `sql/createDb.sql`.

### 5. Execute as migrações
```bash
flask db upgrade
```

### 6. Inicie o backend
```bash
python run.py
```

### 7. Acesse o frontend
Basta abrir os arquivos HTML da pasta `frontend/` no navegador (recomenda-se usar um servidor local para AJAX funcionar corretamente).

---

## Testes

Testes HTTP disponíveis em `testes_http/` para validação dos endpoints.

---

## Observações

- Para produção, configure variáveis de ambiente e HTTPS.
- O frontend pode ser adaptado para frameworks modernos (React, Vue, etc).
- O backend está pronto para deploy em serviços como Heroku, Railway, etc.

---

## Autor

Alexandre Sauer
https://github.com/alesauer
- Executar categorização automática:
  python scripts/categorize.py --rules config/rules.yml --input data/transactions_clean.csv

Configuração
- Variáveis sensíveis e caminhos em `.env` (use `.env.example` como modelo)
- Regras de categorização em `config/rules.yml`
- Ajustes de relatórios em `config/report.yml`

Instalação - notas para Windows
--------------------------------
No Windows, a instalação do driver nativo `mysqlclient` pode requerer ferramentas de build (Visual C++). Para facilitar o setup em máquinas Windows recomendamos usar o driver puro-Python `PyMySQL`.

Exemplo de passos (bash/git-bash/WSL):

```bash
# criar e ativar venv
python -m venv .venv
source .venv/bin/activate   # em git-bash/WSL use source

# instalar dependências (o requirements.txt já inclui PyMySQL como alternativa)
pip install -r requirements.txt

# criar arquivo .env com base no .env.example
cp .env.example .env
# editar .env e ajustar DATABASE_URL e SECRET_KEY

# Exemplo de DATABASE_URL usando PyMySQL (recomendado no Windows):
# DATABASE_URL=mysql+pymysql://usuario:senha@localhost:3306/gestao_financeira

# executar a aplicação
python run.py
```

Dicas rápidas
- Se preferir `mysqlclient` no Windows, instale os build tools do Visual Studio (ou use WSL).
- Para usar `PyMySQL`, mantenha a URL no formato `mysql+pymysql://...`.

`.env.example`
- O projeto inclui um arquivo `.env.example` com variáveis mínimas: `DATABASE_URL`, `SECRET_KEY` e `FLASK_ENV`.


Contribuição
- Abra uma issue para discutir mudanças grandes
- Crie branch com nome descritivo e PR com tests/descrição
- Siga o guia de estilo PEP8 e inclua tests mínimos quando aplicável

Licença
- MIT (ou especifique outra conforme necessário)

Suporte
- Abra uma issue no repositório para bugs ou pedidos de melhoria