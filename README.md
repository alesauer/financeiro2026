# Sistema de Gestão Financeira Pessoal

## Made by S@uer

## Visão Geral
Este projeto é um sistema completo para gestão de finanças pessoais, desenvolvido em Flask (backend) e HTML/JS/Bootstrap (frontend). Permite o controle de categorias, transações, usuários, relatórios e configurações avançadas.

---

## Funcionalidades

- **Dashboard**: Visão geral das finanças.
- **Importação CSV**: Importa transações de arquivos CSV.
- **Importação CSV com overrides**: Ao importar extratos de cartão é possível informar um dia de fechamento/vencimento específico para o lote, acomodando meses com datas diferentes.
- **Classificação automática (IA)**: Sugestão de categorias baseada em inteligência artificial.
- **CRUD de Categorias**: Criar, listar, editar e excluir categorias.
- **CRUD de Transações**: Gerenciar receitas e despesas.
- **Assinaturas e Parcelamentos**: Cadastre e administre recorrências com opção de excluir somente a ocorrência atual ou todas as futuras direto na UI ou via API.
- **CRUD de Usuários**: Cadastro, login, edição e exclusão de usuários.
- **Relatórios**: Visualização de dados por período, categoria, tipo, etc.
- **Configurações Avançadas (Outros)**: Página de configurações com layout moderno (Bootstrap), switches, selects e ações administrativas.
- **Lembretes Inteligentes**: Registre tarefas, contas e metas com data/hora, prioridade e status para nunca perder prazos.
- **Planejamento de Viagens**: Cadastre viagens com período/status, registre custos por categoria, anexe comprovantes e exporte relatórios em CSV/PDF.

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
- Viagem, ViagemCusto e anexos de comprovantes

### Endpoints REST
- `/categorias` - CRUD de categorias
- `/transacoes` - CRUD de transações
- `/usuarios` - CRUD e login de usuários
- `/relatorios` - Relatórios financeiros
- `/viagens` - Planejamento de viagens (CRUD completo, custos vinculados, anexos e exportação)

---

## Frontend

- **HTML5, Bootstrap 5, JavaScript**
- **AJAX/fetch** para integração com backend
- Telas: Dashboard, Categorias, Transações, Relatórios, Usuários, Configurações (Outros)
- Telas dedicadas para **assinaturas** e **parcelamentos** com modais de confirmação que respeitam o comportamento descrito abaixo.

---

## Assinaturas e Parcelamentos recorrentes

### Exclusão pela interface
- Ao excluir uma assinatura ou parcelamento recorrente, o modal pergunta se deseja remover **apenas a cobrança/parcela atual** ou **todas as futuras**.
- Para assinaturas o botão verde remove somente a cobrança selecionada; o botão vermelho remove a atual e todas as próximas ocorrências previstas.
- Para parcelamentos a mesma lógica se aplica às parcelas, exibindo a posição atual e o total para evitar enganos.

### Exclusão via API
- `DELETE /api/transacoes/<id>?assinaturas_futuras=true` remove a cobrança alvo e todas as futuras da mesma assinatura (descrição, forma de pagamento, categoria e frequência iguais).
- `DELETE /api/transacoes/<id>?parcelamentos_futuros=true` remove a parcela atual e todas as próximas pertencentes ao mesmo parcelamento (usando `parcelamento_id` ou os campos equivalentes).
- Sem os parâmetros acima, o backend apaga somente a transação solicitada, preservando o restante da recorrência.

> Dica: use esses parâmetros também nos scripts de automação (ex.: ao limpar dados gerados em massa).

---

## Lembretes pessoais

- **API**: `GET/POST /api/lembretes`, `GET/PUT/DELETE /api/lembretes/<id>`, `PATCH /api/lembretes/<id>/status` e `GET /api/lembretes/dashboard` para cards-resumo.
- **Campos principais**: título (obrigatório), categoria, descrição, data, hora, prioridade (`Baixa/Média/Alta`) e status (`Pendente/Concluído`).
- **Segurança**: todos os endpoints exigem JWT; cada lembrete é vinculado ao usuário autenticado.
- **Front-end**: a página `frontend/lembretes.html` oferece cards com métricas, atalhos para próximos lembretes, filtros avançados e CRUD completo via Grid.js + Bootstrap.
- **Testes rápidos**: use `testes_http/teste_lembretes.http` para exercitar o fluxo inteiro (login, criação, atualização, conclusão e exclusão).

> Após atualizar o código, execute `flask db upgrade` para aplicar a nova tabela `lembretes` e liberar o recurso.

---

## Planejamento de Viagens

- **API**: `GET/POST /api/viagens`, `GET/PUT/DELETE /api/viagens/<id>`, `POST /api/viagens/<id>/custos`, `PUT/DELETE /api/viagens/<id>/custos/<custo_id>`, endpoints extras para anexos (`/anexos`) e exportação (`/export?formato=csv|pdf`).
- **Campos principais**: título, destino, data de início/término, status (`Planejada/Em andamento/Finalizada/Cancelada`) e observações opcionais.
- **Custos vinculados**: tipo (Transporte, Hospedagem, Alimentação, Passeios, Outros), descrição, data do gasto, valor e forma de pagamento opcional. O backend recalcula o custo total automaticamente e gera resumo por categoria.
- **Comprovantes**: upload de até 5 anexos (PDF/JPEG/PNG/WebP) por custo, com armazenamento organizado por usuário/viagem/custo.
- **Exportação**: baixe o relatório completo da viagem em CSV ou PDF (renderizado via `fpdf2`).
- **Frontend**: a página `frontend/viagens.html` oferece grid com filtros/busca, painel lateral com detalhes em tempo real, cadastro via modais, gerenciamento de custos e upload de anexos.
- **Grid principal enriquecida**: título, destino e as datas de início/término aparecem em colunas dedicadas com ordenação e busca instantânea.
- **Custos com filtros avançados**: filtre por tipo e alterne a ordenação por data ou valor (crescente/decrescente) diretamente no painel lateral.

> Necessário rodar `flask db upgrade` para criar as tabelas `viagens`, `viagens_custos` e `viagens_custos_anexos` antes de usar o módulo.

---

## Cartões com fechamento variável

- Na tela `frontend/importar_cartao.html` o formulário possui campos opcionais **Dia de fechamento** e **Dia de vencimento**. Informe um número (1-31) ou uma data no formato `YYYY-MM-DD` para aplicar o override somente ao lote importado.
- Também é possível enviar os mesmos campos via API: `POST /api/importar_transacoes` aceita `dia_fechamento_override` e `dia_vencimento_override` no corpo principal e/ou em cada item de `transacoes`.
- Para transações já existentes use `POST /api/transacoes/recalcular_competencia` com filtros opcionais (`inicio`, `fim`, `apenas_sem_competencia`, `status`, `transacoes_ids`) e, se necessário, overrides temporários de fechamento/vencimento. Exemplo:

```http
POST /api/transacoes/recalcular_competencia HTTP/1.1
Content-Type: application/json

{
   "forma_pagamento_id": 12,
   "inicio": "2025-01-01",
   "fim": "2025-01-31",
   "apenas_sem_competencia": true,
   "dia_fechamento_override": "2025-01-08"
}
```

- Se preferir rodar direto no servidor, use o script `python scripts/recalcular_competencia.py --forma-pagamento-id 12 --inicio 2025-01-01 --fim 2025-01-31 --dia-fechamento 8`.

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

---

## Scripts úteis

- Executar categorização automática com IA/aliases:
   ```bash
   python scripts/categorize.py --rules config/rules.yml --input data/transactions_clean.csv
   ```
- Popular rapidamente o banco com transações recorrentes para um ano específico:
   ```bash
   python scripts/seed_transacoes_anuais.py --ano 2027
   ```
- Recalcular competência de fatura para um cartão específico:
   ```bash
   python scripts/recalcular_competencia.py --forma-pagamento-id 12 --inicio 2025-01-01 --fim 2025-01-31 --dia-fechamento 8
   ```
- Smoke tests básicos da API:
   ```bash
   python scripts/smoke_tests.py
   ```

---

## Configuração adicional

- Variáveis sensíveis e caminhos residem no `.env` (use `.env.example` como modelo).
- Regras de categorização: `config/rules.yml`.
- Ajustes de relatórios/painéis: `config/report.yml`.
- Para usar PyMySQL, mantenha a URL no formato `mysql+pymysql://usuario:senha@localhost:3306/gestao_financeira`.

---

## Instalação – notas para Windows

No Windows a instalação do driver nativo `mysqlclient` pode exigir Visual C++ Build Tools. Se preferir evitar compilações, use PyMySQL (já listado no `requirements.txt`).

```bash
# criar e ativar venv
python -m venv .venv
source .venv/bin/activate   # em git-bash/WSL use "source"

# instalar dependências
pip install -r requirements.txt

# criar arquivo .env com base no exemplo
cp .env.example .env
# editar .env e ajustar DATABASE_URL e SECRET_KEY

# Exemplo de DATABASE_URL usando PyMySQL
# DATABASE_URL=mysql+pymysql://usuario:senha@localhost:3306/gestao_financeira

# executar a aplicação
python run.py
```

**Dicas rápidas**
- Se optar por `mysqlclient`, instale os build tools do Visual Studio ou utilize WSL.
- Com PyMySQL basta manter `mysql+pymysql://...` na URL de conexão.

---

## Contribuição

- Abra uma issue para discutir mudanças grandes.
- Crie uma branch com nome descritivo e envie PR contendo descrição e testes mínimos.
- Siga o guia PEP8 e mantenha o `requirements.txt`/`README.md` atualizados ao introduzir novos fluxos.

## Licença

- MIT (ou ajuste conforme a necessidade do projeto).

## Suporte

- Abra uma issue no repositório para reportar bugs, dúvidas ou pedir melhorias.
Configure o destinatário:

```
EMAIL_TEST_TO=destinatario@exemplo.com
EMAIL_TEST_SUBJECT=Teste Mailgun
EMAIL_TEST_TEXT=Envio de teste
```

Execute:

```bash
python scripts/send_test_email.py
```

Observações:
- Em domínio `sandbox` do Mailgun, os destinatários devem estar autorizados.
- Para produção, use seu domínio verificado com SPF/DKIM configurados.

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

---

## Deploy no GitHub

1. Faça commit de todas as alterações:
   ```bash
   git add .
   git commit -m "Atualiza README e requirements para deploy"
   git push origin master
   ```
2. Não suba arquivos sensíveis (.env com credenciais reais). Use o `.env.example` como modelo.
3. O arquivo `requirements.txt` já está pronto para deploy em ambientes como Heroku, Railway, etc.
4. Para rodar localmente após clonar:
   - Crie e ative o ambiente virtual
   - Instale as dependências
   - Copie `.env.example` para `.env` e ajuste as variáveis
   - Execute as migrações e rode o backend normalmente

---
