const analyses = [
  {
    id: 'panorama-mensal',
    title: 'Panorama Mensal Inteligente',
    description: 'Resumo inteligente de receitas, despesas, saldo e variações incomuns para o mês escolhido.',
    inputs: ['Mês / Ano alvo', 'Categorias em foco', 'Variação mínima (%)'],
    insights: [
      'Top 3 categorias que mais cresceram ou caíram.',
      'Saldo previsto ao final do período com base nas tendências.',
      'Alertas sobre despesas fora do padrão histórico.'
    ],
    promptPreview:
      'Analise todas as transações do período informado, identifique padrões e destaque variações superiores ao limiar definido, apresentando o saldo consolidado.'
  },
  {
    id: 'comprometimento-futuro',
    title: 'Alertas de Comprometimento Futuro',
    description: 'Cruza assinaturas e parcelamentos para entender quanto do caixa futuro já está reservado.',
    inputs: ['Meses a projetar', 'Limite aceitável do caixa comprometido', 'Carteiras ou contas'],
    insights: [
      'Percentual comprometido por mês nos próximos períodos.',
      'Picos de caixa negativo e recomendações para evitá-los.',
      'Assinaturas ou parcelas responsáveis pelos maiores compromissos.'
    ],
    promptPreview:
      'Projete os fluxos futuros com base em assinaturas e parcelamentos ativos, identifique meses que excedem o limite informado e sugira ações para equilibrar o caixa.'
  },
  {
    id: 'classificacao-gastos',
    title: 'Classificação Automática de Gastos',
    description: 'Sugere categorias prováveis para despesas não classificadas usando similaridade com o histórico.',
    inputs: ['Lista de descrições pendentes', 'Categorias disponíveis', 'Regra de confiança mínima'],
    insights: [
      'Categoria sugerida para cada despesa com nível de confiança.',
      'Explicação curta baseada em ocorrências anteriores.',
      'Alerta quando nenhuma categoria atinge a confiança mínima.'
    ],
    promptPreview:
      'Receba despesas sem categoria, compare com o histórico e retorne a categoria mais provável com justificativa e percentual de confiança.'
  },
  {
    id: 'investimentos-rendimento',
    title: 'Análise de Rendimento de Investimentos',
    description: 'Avalia entradas e saídas marcadas como investimento para exibir rentabilidade média e projeções.',
    inputs: ['Intervalo de datas', 'Objetivo financeiro', 'Meta de rendimento (%)'],
    insights: [
      'Rentabilidade média por produto ou corretora.',
      'Aporte sugerido para atingir a meta definida.',
      'Comparativo com benchmarks (ex.: CDI, IPCA).' 
    ],
    promptPreview:
      'Calcule o rendimento líquido dos investimentos no período informado, compare com a meta e apresente sugestões de rebalanceamento.'
  },
  {
    id: 'cartao-credito',
    title: 'Análise de Ciclo do Cartão de Crédito',
    description: 'Exibe concentração de gastos por cartão e prevê próximos picos de fatura.',
    inputs: ['Cartões selecionados', 'Período de faturas', 'Limite máximo desejado por cartão'],
    insights: [
      'Curva de gastos vs. data de fechamento.',
      'Sugestões de redistribuição para evitar estouro do limite.',
      'Alertas de compras recorrentes que podem migrar para débito.'
    ],
    promptPreview:
      'Utilize as transações associadas a cartões de crédito para identificar sazonalidades, picos e oportunidades de redistribuição entre cartões.'
  },
  {
    id: 'oportunidades-economia',
    title: 'Radar de Oportunidades de Economia',
    description: 'Aponta serviços ou categorias onde há potencial de renegociação ou corte.',
    inputs: ['Categorias monitoradas', 'Ticket médio ideal', 'Limite de uso (ex.: vezes/mês)'],
    insights: [
      'Lista de gastos acima da média de mercado.',
      'Serviços pouco utilizados mas com custo alto.',
      'Sugestões de renegociação, downgrade ou cancelamento.'
    ],
    promptPreview:
      'Compare o consumo registrado com referências de mercado e traga recomendações de economia organizadas por impacto financeiro.'
  },
  {
    id: 'diagnostico-emergencia',
    title: 'Diagnóstico de Emergência',
    description: 'Verifica liquidez e estima por quantos meses a reserva cobre as despesas fixas.',
    inputs: ['Saldo de emergência disponível', 'Despesas fixas mensais', 'Meta mínima de meses'],
    insights: [
      'Meses de sobrevivência sem novas receitas.',
      'Gap para atingir a meta de segurança.',
      'Ações priorizadas para reforçar a reserva.'
    ],
    promptPreview:
      'Cruze o saldo disponível para emergência com a média de despesas fixas e indique se a meta de meses cobertos foi atingida, listando ações corretivas.'
  }
];

function renderAnalyses() {
  const container = document.getElementById('iaAnalisesList');
  if (!container) return;
  container.innerHTML = '';

  analyses.forEach((analysis) => {
    const card = document.createElement('article');
    card.className = 'card analysis-card';

    const body = document.createElement('div');
    body.className = 'card-body';

    const title = document.createElement('h3');
    title.className = 'analysis-title';
    title.textContent = analysis.title;

    const description = document.createElement('p');
    description.className = 'analysis-description mb-1';
    description.textContent = analysis.description;

    const inputLabel = document.createElement('small');
    inputLabel.className = 'text-uppercase text-muted fw-semibold';
    inputLabel.textContent = 'Entradas sugeridas';

    const tagsWrapper = document.createElement('div');
    tagsWrapper.className = 'analysis-tags';
    analysis.inputs.forEach((inputText) => {
      const tag = document.createElement('span');
      tag.className = 'analysis-tag';
      tag.textContent = inputText;
      tagsWrapper.appendChild(tag);
    });

    const runButton = document.createElement('button');
    runButton.type = 'button';
    runButton.className = 'btn btn-primary w-100';
    runButton.textContent = 'Executar análise';
    runButton.addEventListener('click', () => displayAnalysisResult(analysis));

    body.appendChild(title);
    body.appendChild(description);
    body.appendChild(inputLabel);
    body.appendChild(tagsWrapper);
    body.appendChild(runButton);

    card.appendChild(body);
    container.appendChild(card);
  });
}

function displayAnalysisResult(analysis) {
  const panel = document.getElementById('iaResultPanel');
  if (!panel) return;

  panel.innerHTML = `
    <div class="card-body">
      <p class="eyebrow text-uppercase text-muted mb-1">Briefing selecionado</p>
      <h5 class="mb-2">${analysis.title}</h5>
      <p class="text-muted mb-3">${analysis.description}</p>
      <div class="result-highlight">
        <h6>Frente de insights</h6>
        <ul class="mb-0 ps-3">
          ${analysis.insights.map((item) => `<li>${item}</li>`).join('')}
        </ul>
      </div>
      <div class="result-highlight mt-3">
        <h6>Prévia do prompt</h6>
        <p class="mb-0">${analysis.promptPreview}</p>
      </div>
    </div>
  `;
}

document.addEventListener('DOMContentLoaded', () => {
  renderAnalyses();
});
