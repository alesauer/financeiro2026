(function() {
  const categoryLabels = {
    financeiras: 'Financeiras',
    trabalhistas: 'Trabalhistas',
    simuladores: 'Simuladores',
    tempo: 'Tempo'
  };

  const formatters = {
    currency(value) {
      return (Number(value) || 0).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      });
    },
    percent(value) {
      return `${(Number(value) || 0).toFixed(2)}%`;
    },
    number(value, digits = 0) {
      return (Number(value) || 0).toLocaleString('pt-BR', {
        maximumFractionDigits: digits,
        minimumFractionDigits: digits
      });
    }
  };

  const calculadoraConfigs = {
    'juros-compostos': {
      subtitle: 'Informe valor inicial, aporte mensal, taxa e período para projetar o montante com juros compostos.',
      fields: [
        { name: 'principal', label: 'Valor inicial (R$)', type: 'number', min: 0, step: 100, placeholder: '5.000', required: true },
        { name: 'aporte', label: 'Aporte mensal (R$)', type: 'number', min: 0, step: 50, placeholder: '500', required: true },
        { name: 'taxa', label: 'Taxa mensal (%)', type: 'number', min: 0, step: 0.01, placeholder: '0,8', required: true },
        { name: 'periodo', label: 'Período (meses)', type: 'number', min: 1, step: 1, placeholder: '36', required: true }
      ],
      compute(values) {
        const principal = values.principal;
        const aporte = values.aporte;
        const taxa = values.taxa / 100;
        const n = values.periodo;
        const montantePrincipal = principal * Math.pow(1 + taxa, n);
        const fatorContribuicao = taxa === 0 ? n : (Math.pow(1 + taxa, n) - 1) / taxa;
        const montanteAportes = aporte * fatorContribuicao;
        const montante = montantePrincipal + montanteAportes;
        const investido = principal + (aporte * n);
        const juros = montante - investido;
        return {
          summary: `Montante estimado de ${formatters.currency(montante)}`,
          details: [
            `Total investido: <strong>${formatters.currency(investido)}</strong>`,
            `Juros acumulados: <strong>${formatters.currency(juros)}</strong>`
          ]
        };
      }
    },
    'juros-simples': {
      subtitle: 'Calcule juros e montante em operações simples.',
      fields: [
        { name: 'capital', label: 'Capital (R$)', type: 'number', min: 0, step: 100, placeholder: '2.000', required: true },
        { name: 'taxa', label: 'Taxa mensal (%)', type: 'number', min: 0, step: 0.01, placeholder: '3', required: true },
        { name: 'periodo', label: 'Período (meses)', type: 'number', min: 1, step: 1, placeholder: '12', required: true }
      ],
      compute(values) {
        const r = values.taxa / 100;
        const juros = values.capital * r * values.periodo;
        const montante = values.capital + juros;
        return {
          summary: `Montante de ${formatters.currency(montante)}`,
          details: [
            `Juros totais: <strong>${formatters.currency(juros)}</strong>`,
            `Capital inicial: <strong>${formatters.currency(values.capital)}</strong>`
          ]
        };
      }
    },
    investimento: {
      subtitle: 'Compare aportes mensais com taxa anual e descubra o potencial de crescimento.',
      fields: [
        { name: 'aporte', label: 'Aporte mensal (R$)', type: 'number', min: 0, step: 50, placeholder: '1.000', required: true },
        { name: 'taxaAnual', label: 'Taxa anual (%)', type: 'number', min: 0, step: 0.01, placeholder: '10', required: true },
        { name: 'anos', label: 'Período (anos)', type: 'number', min: 1, step: 1, placeholder: '5', required: true }
      ],
      compute(values) {
        const meses = values.anos * 12;
        const taxaMensal = Math.pow(1 + values.taxaAnual / 100, 1 / 12) - 1;
        const fator = taxaMensal === 0 ? meses : (Math.pow(1 + taxaMensal, meses) - 1) / taxaMensal;
        const montante = values.aporte * fator;
        const investido = values.aporte * meses;
        return {
          summary: `Você pode acumular ${formatters.currency(montante)}`,
          details: [
            `Total aportado: <strong>${formatters.currency(investido)}</strong>`,
            `Rendimento estimado: <strong>${formatters.currency(montante - investido)}</strong>`
          ]
        };
      }
    },
    milhas: {
      subtitle: 'Calcule o valor financeiro de uma quantidade de pontos ou milhas.',
      fields: [
        { name: 'valor', label: 'Valor em dinheiro (R$)', type: 'number', min: 0, step: 10, placeholder: '650', required: true },
        { name: 'pontos', label: 'Quantidade de pontos/milhas', type: 'number', min: 1, step: 100, placeholder: '20.000', required: true }
      ],
      compute(values) {
        const valorMilha = values.valor / values.pontos;
        return {
          summary: `Cada ponto vale cerca de ${formatters.currency(valorMilha)}`,
          details: [
            `Valor por 1.000 pontos: <strong>${formatters.currency(valorMilha * 1000)}</strong>`
          ]
        };
      }
    },
    'passagem-milhas': {
      subtitle: 'Compare o custo da passagem em dinheiro com o custo equivalente em pontos.',
      fields: [
        { name: 'preco', label: 'Preço em dinheiro (R$)', type: 'number', min: 0, step: 10, placeholder: '950', required: true },
        { name: 'pontos', label: 'Pontos necessários', type: 'number', min: 1, step: 100, placeholder: '30.000', required: true },
        { name: 'valorMilheiro', label: 'Valor do milheiro (R$)', type: 'number', min: 0, step: 1, placeholder: '28', required: true }
      ],
      compute(values) {
        const custoMilhas = (values.valorMilheiro / 1000) * values.pontos;
        const diferenca = custoMilhas - values.preco;
        const recomendacao = diferenca <= 0 ? 'Usar pontos vale mais a pena.' : 'Melhor pagar em dinheiro desta vez.';
        return {
          summary: `Custo usando pontos: ${formatters.currency(custoMilhas)}`,
          details: [
            `Preço em dinheiro: <strong>${formatters.currency(values.preco)}</strong>`,
            recomendacao
          ]
        };
      }
    },
    'decimo-terceiro': {
      subtitle: 'Projete o valor do 13º proporcional e do pagamento de férias com adicional de 1/3.',
      fields: [
        { name: 'salario', label: 'Salário base (R$)', type: 'number', min: 0, step: 100, placeholder: '4.500', required: true },
        { name: 'mesesTrabalhados', label: 'Meses trabalhados no ano', type: 'number', min: 1, max: 12, step: 1, placeholder: '12', required: true },
        { name: 'diasFerias', label: 'Dias de férias a gozar', type: 'number', min: 0, max: 30, step: 1, placeholder: '30', required: true }
      ],
      compute(values) {
        const meses = Math.min(12, Math.max(0, values.mesesTrabalhados));
        const diasFerias = Math.min(30, Math.max(0, values.diasFerias));
        const decimo = values.salario * (meses / 12);
        const feriasBase = values.salario * (diasFerias / 30);
        const adicionalTerco = feriasBase / 3;
        const feriasTotal = feriasBase + adicionalTerco;
        const total = decimo + feriasTotal;
        return {
          summary: `Total estimado de ${formatters.currency(total)}`,
          details: [
            `13º proporcional: <strong>${formatters.currency(decimo)}</strong>`,
            `Férias (${diasFerias} dia(s)): <strong>${formatters.currency(feriasBase)}</strong>`,
            `Adicional 1/3 férias: <strong>${formatters.currency(adicionalTerco)}</strong>`
          ]
        };
      }
    },
    'custo-funcionario': {
      subtitle: 'Simule o custo total de um colaborador considerando encargos e benefícios.',
      fields: [
        { name: 'salario', label: 'Salário bruto (R$)', type: 'number', min: 0, step: 100, placeholder: '4.000', required: true },
        { name: 'beneficios', label: 'Benefícios mensais (R$)', type: 'number', min: 0, step: 50, placeholder: '600', required: true },
        { name: 'encargos', label: 'Encargos (%)', type: 'number', min: 0, step: 1, placeholder: '70', required: true }
      ],
      compute(values) {
        const encargosReais = values.salario * (values.encargos / 100);
        const total = values.salario + values.beneficios + encargosReais;
        return {
          summary: `Custo total mensal de ${formatters.currency(total)}`,
          details: [
            `Encargos: <strong>${formatters.currency(encargosReais)}</strong>`,
            `Benefícios: <strong>${formatters.currency(values.beneficios)}</strong>`
          ]
        };
      }
    },
    fgts: {
      subtitle: 'Veja quanto de FGTS é depositado ao longo do período informado.',
      fields: [
        { name: 'salario', label: 'Salário base (R$)', type: 'number', min: 0, step: 100, placeholder: '3.000', required: true },
        { name: 'meses', label: 'Período (meses)', type: 'number', min: 1, step: 1, placeholder: '12', required: true }
      ],
      compute(values) {
        const depositoMensal = values.salario * 0.08;
        const total = depositoMensal * values.meses;
        return {
          summary: `Total acumulado de ${formatters.currency(total)}`,
          details: [
            `Depósito mensal: <strong>${formatters.currency(depositoMensal)}</strong>`
          ]
        };
      }
    },
    'dias-uteis': {
      subtitle: 'Conte apenas dias de segunda a sexta entre duas datas.',
      fields: [
        { name: 'inicio', label: 'Data inicial', type: 'date', required: true },
        { name: 'fim', label: 'Data final', type: 'date', required: true }
      ],
      compute(values) {
        const dias = contarDiasUteis(values.inicio, values.fim);
        return {
          summary: `${formatters.number(dias)} dia(s) útil(eis)`,
          details: [
            `Intervalo de ${formatters.number(Math.ceil((values.fim - values.inicio) / MS_DIA))} dia(s) corrido(s)`
          ]
        };
      }
    },
    idade: {
      subtitle: 'Calcule idade exata em anos, meses e dias.',
      fields: [
        { name: 'nascimento', label: 'Data de nascimento', type: 'date', required: true }
      ],
      compute(values) {
        const idade = calcularIdade(values.nascimento, new Date());
        return {
          summary: `${idade.anos} ano(s), ${idade.meses} mês(es) e ${idade.dias} dia(s)`,
          details: [
            `Total de dias vividos: <strong>${formatters.number(idade.totalDias)}</strong>`
          ]
        };
      }
    },
    'dias-corridos': {
      subtitle: 'Descubra quantos dias corridos existem entre duas datas.',
      fields: [
        { name: 'inicio', label: 'Data inicial', type: 'date', required: true },
        { name: 'fim', label: 'Data final', type: 'date', required: true }
      ],
      compute(values) {
        const dias = Math.ceil((values.fim - values.inicio) / MS_DIA) + 1;
        if (dias < 1) {
          throw new Error('A data final deve ser posterior à inicial.');
        }
        return {
          summary: `${formatters.number(dias)} dia(s) corrido(s)`,
          details: []
        };
      }
    }
  };

  const calculadoras = [
    { slug: 'juros-compostos', title: 'Calculadora de Juros Compostos', description: 'Projete o crescimento do seu investimento com aportes e taxas mensais.', highlight: 'Ideal para metas de longo prazo', category: 'financeiras', icon: '📈' },
    { slug: 'juros-simples', title: 'Calculadora de Juros Simples', description: 'Descubra o quanto você pagará em juros em operações mais curtas.', highlight: 'Empréstimos rápidos', category: 'financeiras', icon: '💰' },
    { slug: 'investimento', title: 'Simulador de Investimentos', description: 'Compare aportes, taxas e tempo para descobrir quanto acumular.', highlight: 'Personalize aportes', category: 'financeiras', icon: '🏦' },
    { slug: 'milhas', title: 'Valor de Pontos e Milhas', description: 'Veja se compensa usar pontos, milhas ou dinheiro em cada resgate.', highlight: 'Viagens e cashback', category: 'simuladores', icon: '✈️' },
    { slug: 'passagem-milhas', title: 'Passagem com Pontos ou Dinheiro', description: 'Compare o custo da passagem emitida com pontos e em dinheiro.', highlight: 'Economize nas férias', category: 'simuladores', icon: '🧳' },
    { slug: 'consumo-energia', title: 'Simulador de Consumo de Energia', description: 'Entenda como cada eletrodoméstico influencia sua conta.', highlight: 'Para casa e escritório', category: 'simuladores', icon: '💡', soon: true },
    { slug: 'custo-funcionario', title: 'Calculadora de Custo de Funcionário', description: 'Calcule encargos e tributos para contratar com segurança.', highlight: 'CLT x PJ', category: 'trabalhistas', icon: '🧾' },
    { slug: 'fgts', title: 'Calculadora de FGTS', description: 'Saiba quanto você acumula de FGTS com base no salário.', highlight: 'Planeje resgates', category: 'trabalhistas', icon: '📂' },
  { slug: 'decimo-terceiro', title: 'Décimo Terceiro e Férias', description: 'Estime quanto receber em 13º e férias proporcionais.', highlight: 'Benefícios anuais', category: 'trabalhistas', icon: '🎯' },
    { slug: 'dias-uteis', title: 'Calculadora de Dias Úteis', description: 'Conte dias úteis entre datas e organize entregas e contratos.', highlight: 'Perfeito para prazos', category: 'tempo', icon: '📅' },
    { slug: 'idade', title: 'Calculadora de Idade', description: 'Descubra idade exata em dias, meses e anos para eventos.', highlight: 'Eventos e metas', category: 'tempo', icon: '🎉' },
    { slug: 'dias-corridos', title: 'Contador de Dias Corridos', description: 'Simples e rápido para acompanhar quantos dias faltam.', highlight: 'Rotinas e projetos', category: 'tempo', icon: '⏱️' }
  ];

  const MS_DIA = 24 * 60 * 60 * 1000;

  function formatCountText(count) {
    return count === 1 ? 'Mostrando 1 calculadora' : `Mostrando ${count} calculadoras`;
  }

  function buildCard(calc) {
    const col = document.createElement('div');
    col.className = 'col-12 col-md-6 col-lg-4';
    const categoryClass = `category-${calc.category}`;
    const disabledClass = calc.soon ? 'is-disabled' : '';
    const buttonText = calc.soon ? 'Em breve' : 'Calcular';
    const buttonAttrs = calc.soon ? 'aria-disabled="true" tabindex="-1"' : `data-slug="${calc.slug}"`;

    col.innerHTML = `
      <article class="card calculadora-card ${categoryClass} ${disabledClass}">
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-center mb-3">
            <span class="badge rounded-pill category-badge">${categoryLabels[calc.category]}</span>
            ${calc.soon ? '<span class="status-pill">Em breve</span>' : ''}
          </div>
          <div class="icon-circle" aria-label="${categoryLabels[calc.category]}">${calc.icon}</div>
          <h3 class="mb-2">${calc.title}</h3>
          <p>${calc.description}</p>
          <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
            <small class="text-muted">${calc.highlight || ''}</small>
            <button class="btn btn-primary btn-sm calculadora-open" type="button" ${buttonAttrs}>${buttonText}</button>
          </div>
        </div>
      </article>
    `;

    return col;
  }

  function renderCards(grid, list) {
    grid.innerHTML = '';

    if (!list.length) {
      const wrap = document.createElement('div');
      wrap.className = 'col-12';
      wrap.innerHTML = `
        <div class="card calculadora-empty border-0 text-center p-5">
          <h4 class="mb-2">Nenhuma calculadora encontrada</h4>
          <p class="text-muted mb-0">Tente ajustar os filtros ou outra palavra-chave.</p>
        </div>
      `;
      grid.appendChild(wrap);
      return;
    }

    list.forEach(calc => grid.appendChild(buildCard(calc)));
  }

  function contarDiasUteis(inicio, fim) {
    if (fim < inicio) {
      throw new Error('A data final deve ser posterior à inicial.');
    }
    let dias = 0;
    const cursor = new Date(inicio);
    while (cursor <= fim) {
      const diaSemana = cursor.getDay();
      if (diaSemana !== 0 && diaSemana !== 6) {
        dias += 1;
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    return dias;
  }

  function calcularIdade(nascimento, hoje) {
    if (nascimento > hoje) {
      throw new Error('A data de nascimento deve ser anterior a hoje.');
    }
    let anos = hoje.getFullYear() - nascimento.getFullYear();
    let meses = hoje.getMonth() - nascimento.getMonth();
    let dias = hoje.getDate() - nascimento.getDate();

    if (dias < 0) {
      meses -= 1;
      dias += new Date(hoje.getFullYear(), hoje.getMonth(), 0).getDate();
    }
    if (meses < 0) {
      anos -= 1;
      meses += 12;
    }

    const totalDias = Math.floor((hoje - nascimento) / MS_DIA);
    return { anos, meses, dias, totalDias };
  }

  function parseFieldValue(field, value) {
    if (!value && field.required !== false) {
      throw new Error(`Preencha o campo ${field.label}.`);
    }
    if (field.type === 'number') {
      const parsed = parseFloat(String(value).replace(',', '.'));
      if (Number.isNaN(parsed)) {
        throw new Error(`Valor inválido em ${field.label}.`);
      }
      return parsed;
    }
    if (field.type === 'date') {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) {
        throw new Error(`Data inválida em ${field.label}.`);
      }
      return date;
    }
    return value;
  }

  function buildFieldHTML(field) {
    const colClass = field.fullWidth ? 'col-12' : 'col-12 col-md-6';
    if (field.type === 'select' && Array.isArray(field.options)) {
      return `
        <div class="${colClass}">
          <label class="form-label" for="field-${field.name}">${field.label}</label>
          <select class="form-select" id="field-${field.name}" name="${field.name}" ${field.required === false ? '' : 'required'}>
            ${field.options.map(opt => `<option value="${opt.value}">${opt.label}</option>`).join('')}
          </select>
          ${field.hint ? `<small>${field.hint}</small>` : ''}
        </div>
      `;
    }

    const inputType = field.type === 'date' ? 'date' : 'number';
    const stepAttr = field.step !== undefined ? `step="${field.step}"` : '';
    const minAttr = field.min !== undefined ? `min="${field.min}"` : '';
    const maxAttr = field.max !== undefined ? `max="${field.max}"` : '';
    const placeholder = field.placeholder ? `placeholder="${field.placeholder}"` : '';

    return `
      <div class="${colClass}">
        <label class="form-label" for="field-${field.name}">${field.label}</label>
        <input class="form-control" id="field-${field.name}" name="${field.name}" type="${inputType}" ${placeholder}
          ${stepAttr} ${minAttr} ${maxAttr} ${field.required === false ? '' : 'required'}>
        ${field.hint ? `<small>${field.hint}</small>` : ''}
      </div>
    `;
  }

  function initCalculadoraPage() {
    const grid = document.getElementById('calculadora-grid');
    const searchInput = document.getElementById('calculadora-search');
    const filterButtons = document.querySelectorAll('.calculadora-filter');
    const totalElement = document.getElementById('calculadora-total');
    const countElement = document.getElementById('calculadora-count');
    const modalElement = document.getElementById('calculadora-modal');
    const modalTitle = document.getElementById('calculadora-modal-title');
    const modalSubtitle = document.getElementById('calculadora-modal-subtitle');
    const modalFields = document.getElementById('calculadora-modal-fields');
    const modalForm = document.getElementById('calculadora-modal-form');
    const modalResult = document.getElementById('calculadora-modal-result');
    const modalResultSummary = document.getElementById('calculadora-modal-result-summary');
    const modalResultDetails = document.getElementById('calculadora-modal-result-details');

    if (!grid || !searchInput) {
      return;
    }

    const bootstrapModal = typeof bootstrap !== 'undefined' && modalElement ? new bootstrap.Modal(modalElement) : null;
    let currentConfig = null;

    totalElement.textContent = calculadoras.length;

    function resetResult() {
      modalResult.hidden = true;
      modalResultDetails.innerHTML = '';
      modalResult.classList.remove('is-error');
    }

    function showResult(result, isError = false) {
      modalResult.hidden = false;
      modalResult.classList.toggle('is-error', Boolean(isError));
      modalResultSummary.textContent = result.summary;
      if (Array.isArray(result.details) && result.details.length) {
        modalResultDetails.innerHTML = result.details.map(line => `<li>${line}</li>`).join('');
      } else {
        modalResultDetails.innerHTML = '';
      }
    }

    function openCalculadoraModal(slug) {
      const calculadora = calculadoras.find(item => item.slug === slug);
      if (!calculadora) {
        return;
      }
      const config = calculadoraConfigs[slug];
      currentConfig = config || null;
      modalTitle.textContent = calculadora.title;
      modalSubtitle.textContent = (config && config.subtitle) || calculadora.description;
      resetResult();
      modalForm.reset();

      if (!config) {
        modalFields.innerHTML = `
          <div class="col-12">
            <div class="alert alert-warning mb-0">Esta calculadora ainda está em desenvolvimento.</div>
          </div>`;
      } else {
        modalFields.innerHTML = config.fields.map(buildFieldHTML).join('');
      }

      const submitButton = modalForm.querySelector('button[type="submit"]');
      if (submitButton) {
        submitButton.disabled = !config;
      }

      bootstrapModal && bootstrapModal.show();
    }

    let activeCategory = 'all';

    function applyFilters() {
      const term = searchInput.value.trim().toLowerCase();
      const filtered = calculadoras.filter(calc => {
        const matchCategory = activeCategory === 'all' || calc.category === activeCategory;
        const haystack = `${calc.title} ${calc.description} ${calc.highlight}`.toLowerCase();
        const matchSearch = !term || haystack.includes(term);
        return matchCategory && matchSearch;
      });

      renderCards(grid, filtered);
      countElement.textContent = formatCountText(filtered.length);
    }

    searchInput.addEventListener('input', () => {
      window.requestAnimationFrame(applyFilters);
    });

    filterButtons.forEach(button => {
      button.addEventListener('click', () => {
        filterButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        activeCategory = button.dataset.category;
        applyFilters();
      });
    });

    grid.addEventListener('click', event => {
      const target = event.target.closest('.calculadora-open');
      if (!target || target.hasAttribute('aria-disabled')) {
        return;
      }
      const slug = target.dataset.slug;
      openCalculadoraModal(slug);
    });

    modalForm?.addEventListener('submit', event => {
      event.preventDefault();
      if (!currentConfig) {
        return;
      }
      try {
        const formData = new FormData(modalForm);
        const values = {};
        currentConfig.fields.forEach(field => {
          const raw = formData.get(field.name);
          values[field.name] = parseFieldValue(field, raw);
        });
        const result = currentConfig.compute(values);
        showResult(result, false);
      } catch (error) {
        showResult({ summary: error.message, details: [] }, true);
      }
    });

    applyFilters();
  }

  document.addEventListener('DOMContentLoaded', initCalculadoraPage);
})();
