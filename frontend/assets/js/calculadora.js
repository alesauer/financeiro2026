(function() {
  const categoryLabels = {
    financeiras: 'Financeiras',
    trabalhistas: 'Trabalhistas',
    simuladores: 'Simuladores',
    tempo: 'Tempo'
  };

  const calculadoras = [
    {
      slug: 'juros-compostos',
      title: 'Calculadora de Juros Compostos',
      description: 'Projete o crescimento do seu investimento com aportes e taxas mensais.',
      highlight: 'Ideal para metas de longo prazo',
      category: 'financeiras',
      icon: '📈',
      href: '#'
    },
    {
      slug: 'juros-simples',
      title: 'Calculadora de Juros Simples',
      description: 'Descubra o quanto você pagará em juros em operações mais curtas.',
      highlight: 'Empréstimos rápidos',
      category: 'financeiras',
      icon: '💰',
      href: '#'
    },
    {
      slug: 'investimento',
      title: 'Simulador de Investimentos',
      description: 'Compare aportes, taxas e tempo para descobrir quanto acumular.',
      highlight: 'Personalize aportes',
      category: 'financeiras',
      icon: '🏦',
      href: '#'
    },
    {
      slug: 'milhas',
      title: 'Valor de Pontos e Milhas',
      description: 'Veja se compensa usar pontos, milhas ou dinheiro em cada resgate.',
      highlight: 'Viagens e cashback',
      category: 'simuladores',
      icon: '✈️',
      href: '#'
    },
    {
      slug: 'passagem-milhas',
      title: 'Passagem com Pontos ou Dinheiro',
      description: 'Compare o custo da passagem emitida com pontos e em dinheiro.',
      highlight: 'Economize nas férias',
      category: 'simuladores',
      icon: '🧳',
      href: '#'
    },
    {
      slug: 'consumo-energia',
      title: 'Simulador de Consumo de Energia',
      description: 'Entenda como cada eletrodoméstico influencia sua conta.',
      highlight: 'Para casa e escritório',
      category: 'simuladores',
      icon: '💡',
      href: '#',
      soon: true
    },
    {
      slug: 'custo-funcionario',
      title: 'Calculadora de Custo de Funcionário',
      description: 'Calcule encargos e tributos para contratar com segurança.',
      highlight: 'CLT x PJ',
      category: 'trabalhistas',
      icon: '🧾',
      href: '#'
    },
    {
      slug: 'fgts',
      title: 'Calculadora de FGTS',
      description: 'Saiba quanto você acumula de FGTS com base no salário.',
      highlight: 'Planeje resgates',
      category: 'trabalhistas',
      icon: '📂',
      href: '#'
    },
    {
      slug: 'decimo-terceiro',
      title: 'Décimo Terceiro e Férias',
      description: 'Estime quanto receber em bônus, férias e férias proporcionais.',
      highlight: 'Trabalhistas',
      category: 'trabalhistas',
      icon: '🎯',
      href: '#',
      soon: true
    },
    {
      slug: 'dias-uteis',
      title: 'Calculadora de Dias Úteis',
      description: 'Conte dias úteis entre datas e organize entregas e contratos.',
      highlight: 'Perfeito para prazos',
      category: 'tempo',
      icon: '📅',
      href: '#'
    },
    {
      slug: 'idade',
      title: 'Calculadora de Idade',
      description: 'Descubra idade exata em dias, meses e anos para eventos.',
      highlight: 'Eventos e metas',
      category: 'tempo',
      icon: '🎉',
      href: '#'
    },
    {
      slug: 'dias-corridos',
      title: 'Contador de Dias Corridos',
      description: 'Simples e rápido para acompanhar quantos dias faltam.',
      highlight: 'Rotinas e projetos',
      category: 'tempo',
      icon: '⏱️',
      href: '#'
    }
  ];

  function formatCountText(count) {
    return count === 1 ? 'Mostrando 1 calculadora' : `Mostrando ${count} calculadoras`;
  }

  function buildCard(calc) {
    const col = document.createElement('div');
    col.className = 'col-12 col-md-6 col-lg-4';

    const categoryClass = `category-${calc.category}`;
    const disabledClass = calc.soon ? 'is-disabled' : '';
    const buttonAttrs = calc.soon ? 'aria-disabled="true" tabindex="-1"' : '';
    const buttonText = calc.soon ? 'Em breve' : 'Saiba mais';

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
            <a class="btn btn-primary btn-sm" href="${calc.href}" ${buttonAttrs}>${buttonText}</a>
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

  function initCalculadoraPage() {
    const grid = document.getElementById('calculadora-grid');
    const searchInput = document.getElementById('calculadora-search');
    const filterButtons = document.querySelectorAll('.calculadora-filter');
    const totalElement = document.getElementById('calculadora-total');
    const countElement = document.getElementById('calculadora-count');

    if (!grid || !searchInput) {
      return;
    }

    totalElement.textContent = calculadoras.length;

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

    applyFilters();
  }

  document.addEventListener('DOMContentLoaded', initCalculadoraPage);
})();
