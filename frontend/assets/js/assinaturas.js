const API_BASE = 'http://127.0.0.1:5000/api';
const ENDPOINT_TRANSACOES = `${API_BASE}/transacoes`;
const ENDPOINT_SUMMARY = `${API_BASE}/transacoes/assinaturas/summary`;
const ENDPOINT_SUMMARY_ANUAL = `${API_BASE}/transacoes/assinaturas/annual`;
const GRID_PAGE_LIMIT = 12;

const state = {
  ano: new Date().getFullYear(),
  mes: new Date().getMonth() + 1,
  grid: null,
  anualAno: new Date().getFullYear()
};

const monthOrder = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

function fetchJWT(url, options = {}) {
  const token = localStorage.getItem('access_token');
  const opts = { ...options };
  opts.headers = opts.headers ? { ...opts.headers } : {};
  if (token) {
    opts.headers['Authorization'] = `Bearer ${token}`;
  }
  return fetch(url, opts);
}

function pad(n) {
  return n.toString().padStart(2, '0');
}

function buildRange() {
  const inicio = `${state.ano}-${pad(state.mes)}-01`;
  const fimDate = new Date(state.ano, state.mes, 0);
  const fim = `${state.ano}-${pad(state.mes)}-${pad(fimDate.getDate())}`;
  return { inicio, fim };
}

function formatCurrency(value) {
  const num = Number(value || 0);
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function buildGridUrl(page, limit) {
  const { inicio, fim } = buildRange();
  const params = new URLSearchParams({
    page: page || 1,
    per_page: limit || GRID_PAGE_LIMIT,
    inicio,
    fim,
    recorrente: true,
    recorrencia_tipo: 'Assinatura',
    tipo: 'Despesa'
  });
  return `${ENDPOINT_TRANSACOES}?${params.toString()}`;
}

function updateMonthLabel() {
  const label = document.getElementById('currentMonthLabel');
  const monthPicker = document.getElementById('monthPicker');
  const date = new Date(state.ano, state.mes - 1, 1);
  const formatted = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  if (label) label.textContent = formatted.charAt(0).toUpperCase() + formatted.slice(1);
  if (monthPicker) monthPicker.value = `${state.ano}-${pad(state.mes)}`;
  const subtitle = document.getElementById('card-assinaturas-periodo');
  if (subtitle) {
    const { inicio, fim } = buildRange();
    subtitle.textContent = `Entre ${inicio} e ${fim}`;
  }
}

function refreshSummary() {
  const { inicio, fim } = buildRange();
  const url = `${ENDPOINT_SUMMARY}?inicio=${inicio}&fim=${fim}`;
  fetchJWT(url)
    .then(resp => resp.ok ? resp.json() : Promise.reject(resp))
    .then(data => {
      const qtdEl = document.getElementById('card-assinaturas-qtd');
      const totalEl = document.getElementById('card-assinaturas-valor');
      if (qtdEl) qtdEl.textContent = data?.vigentes ?? 0;
      if (totalEl) totalEl.textContent = formatCurrency(data?.valor_total ?? 0);
    })
    .catch(() => {
      const qtdEl = document.getElementById('card-assinaturas-qtd');
      const totalEl = document.getElementById('card-assinaturas-valor');
      if (qtdEl) qtdEl.textContent = '—';
      if (totalEl) totalEl.textContent = 'R$ 0,00';
    });
}

function renderAnnualSummaryTable(data) {
  const tbody = document.getElementById('assinaturasTabelaAnualBody');
  if (!tbody) return;

  const linhas = Array.isArray(data?.linhas) ? data.linhas : [];
  const monthlyTotals = data?.mensal || null;
  let html = '';

  if (!linhas.length) {
    html += '<tr><td class="fw-semibold">Assinaturas</td><td colspan="13">Sem dados</td></tr>';
  } else {
    linhas.forEach((linha) => {
      const descricao = linha?.descricao || linha?.categoria || 'Assinatura';
      let row = `<tr><td class="fw-semibold">${descricao}</td>`;
      monthOrder.forEach((m) => {
        const valor = linha?.mensal?.[String(m)] ?? 0;
        row += `<td>${valor ? formatCurrency(valor) : '—'}</td>`;
      });
      row += `<td class="fw-semibold">${formatCurrency(linha?.total || 0)}</td></tr>`;
      html += row;
    });
  }

  if (monthlyTotals) {
    let totalRow = '<tr class="table-total"><td class="fw-bold text-uppercase">Total</td>';
    monthOrder.forEach((m) => {
      const valor = monthlyTotals[String(m)] ?? 0;
      totalRow += `<td>${formatCurrency(valor)}</td>`;
    });
    totalRow += `<td class="fw-bold">${formatCurrency(data?.total || 0)}</td></tr>`;
    html += totalRow;
  }

  tbody.innerHTML = html;

  const select = document.getElementById('assinaturasAno');
  if (select && data.ano) {
    select.value = data.ano;
  }
}

function refreshAnnualSummary() {
  const ano = state.anualAno || new Date().getFullYear();
  const url = `${ENDPOINT_SUMMARY_ANUAL}?ano=${ano}`;
  fetchJWT(url)
    .then(resp => resp.ok ? resp.json() : Promise.reject())
    .then(data => renderAnnualSummaryTable(data))
    .catch(() => renderAnnualSummaryTable(null));
}

function mapStatus(status) {
  const normalized = (status || '').toLowerCase();
  const cls = normalized === 'pago' ? 'pago' : 'pendente';
  const label = status || 'Pendente';
  return gridjs.html(`<span class="status-pill ${cls}">${label}</span>`);
}

function mapRow(row) {
  const valor = row && row.parcelado && row.valor_parcela ? row.valor_parcela : row?.valor;
  return [
    row?.descricao || '-',
    row?.categoria_nome || '-',
    row?.forma_pagamento_nome || '-',
    formatDate(row?.data_transacao),
    row?.frequencia || '-',
    row?.data_fim ? formatDate(row.data_fim) : 'Sem previsão',
    formatCurrency(valor),
    mapStatus(row?.status)
  ];
}

function createGrid() {
  const gridContainer = document.getElementById('assinaturas-grid');
  if (!gridContainer) return;

  state.grid = new gridjs.Grid({
    columns: [
      'Descrição',
      'Categoria',
      'Forma de Pagamento',
      'Data',
      'Frequência',
      'Fim',
      'Valor',
      'Status'
    ],
    pagination: {
      enabled: true,
      limit: GRID_PAGE_LIMIT,
      server: {
        url: (prev, page, limit) => buildGridUrl(page, limit)
      }
    },
    sort: true,
    search: false,
    server: {
      url: buildGridUrl(1, GRID_PAGE_LIMIT),
      fetch: (url, opts) => fetchJWT(url, opts),
      then: data => {
        const items = data?.items || [];
        return items.map(mapRow);
      },
      total: data => data?.total_items || 0
    },
    language: {
      pagination: {
        previous: 'Anterior',
        next: 'Próximo',
        showing: 'Mostrando',
        results: 'assinaturas'
      }
    }
  });

  state.grid.render(gridContainer);
}

function reloadGrid() {
  if (!state.grid) return;
  state.grid.updateConfig({
    server: {
      url: buildGridUrl(1, GRID_PAGE_LIMIT),
      fetch: (url, opts) => fetchJWT(url, opts),
      then: data => {
        const items = data?.items || [];
        return items.map(mapRow);
      },
      total: data => data?.total_items || 0
    },
    pagination: {
      enabled: true,
      limit: GRID_PAGE_LIMIT,
      server: {
        url: (prev, page, limit) => buildGridUrl(page, limit)
      }
    }
  }).forceRender();
}

function attachControls() {
  const prev = document.getElementById('prevMonth');
  const next = document.getElementById('nextMonth');
  const picker = document.getElementById('monthPicker');

  if (prev) {
    prev.addEventListener('click', () => {
      state.mes -= 1;
      if (state.mes === 0) {
        state.mes = 12;
        state.ano -= 1;
      }
      refreshAll();
    });
  }

  if (next) {
    next.addEventListener('click', () => {
      state.mes += 1;
      if (state.mes === 13) {
        state.mes = 1;
        state.ano += 1;
      }
      refreshAll();
    });
  }

  if (picker) {
    picker.addEventListener('change', (event) => {
      const value = event.target.value;
      if (!value) return;
      const [ano, mes] = value.split('-');
      if (ano && mes) {
        state.ano = parseInt(ano, 10);
        state.mes = parseInt(mes, 10);
        refreshAll();
      }
    });
  }

}

function setupAnnualControls() {
  const select = document.getElementById('assinaturasAno');
  if (!select) return;

  const anoAtual = new Date().getFullYear();
  const minAno = anoAtual - 5;
  select.innerHTML = '';
  for (let ano = anoAtual + 1; ano >= minAno; ano--) {
    const option = document.createElement('option');
    option.value = ano;
    option.textContent = ano;
    if (ano === state.anualAno) {
      option.selected = true;
    }
    select.appendChild(option);
  }

  if (!select.dataset.listener) {
    select.dataset.listener = 'true';
    select.addEventListener('change', (event) => {
      const value = parseInt(event.target.value, 10);
      if (!Number.isNaN(value)) {
        state.anualAno = value;
        refreshAnnualSummary();
      }
    });
  }
}

function refreshAll() {
  updateMonthLabel();
  refreshSummary();
  reloadGrid();
  refreshAnnualSummary();
}

document.addEventListener('DOMContentLoaded', () => {
  updateMonthLabel();
  attachControls();
  setupAnnualControls();
  createGrid();
  refreshSummary();
  refreshAnnualSummary();
});
