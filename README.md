# Finanças 2026

Descrição
- Conjunto de scripts em Python para automação de tarefas financeiras: importação e limpeza de transações, categorização, geração de relatórios e gráficos, e apoio a orçamentos.

Funcionalidades principais
- Importar transações de CSV/OFX/JSON
- Limpeza e normalização de dados
- Categorização automática por regras
- Relatórios mensais/anuais (CSV/HTML/PDF)
- Visualizações básicas (matplotlib/plotly)
- Exportação para formatos compatíveis com outras ferramentas

Requisitos
- Python 3.8+
- Dependências listadas em `requirements.txt`

Instalação rápida
1. Clonar o repositório:
    git clone <repo-url> && cd financas
2. Criar e ativar ambiente virtual:
    python -m venv .venv
    source .venv/bin/activate  # Unix/macOS
    .venv\Scripts\activate     # Windows
3. Instalar dependências:
    pip install -r requirements.txt

Estrutura sugerida
- scripts/          — scripts executáveis (ex.: import_transactions.py, categorize.py, report.py)
- financas/         — package principal (módulos, utils, config)
- data/             — amostras de entrada/saída
- notebooks/        — análises exploratórias
- requirements.txt
- README.md

Uso (exemplos)
- Importar transações:
  python scripts/import_transactions.py --input data/transactions.csv --output data/transactions_clean.csv
- Gerar relatório mensal:
  python scripts/report.py --input data/transactions_clean.csv --month 2025-11 --output reports/novembro-2025.pdf
- Executar categorização automática:
  python scripts/categorize.py --rules config/rules.yml --input data/transactions_clean.csv

Configuração
- Variáveis sensíveis e caminhos em `.env` (use `.env.example` como modelo)
- Regras de categorização em `config/rules.yml`
- Ajustes de relatórios em `config/report.yml`

Contribuição
- Abra uma issue para discutir mudanças grandes
- Crie branch com nome descritivo e PR com tests/descrição
- Siga o guia de estilo PEP8 e inclua tests mínimos quando aplicável

Licença
- MIT (ou especifique outra conforme necessário)

Suporte
- Abra uma issue no repositório para bugs ou pedidos de melhoria
