// assets/js/transacoes.js
// Grid.js frontend with month/year navigation, server-side filtering by mes/ano,
// pagination and formatting for date and currency.
// Fixed: use server.url as string and pagination.server.url to avoid function-to-string issues.
// Updated to use absolute API URL because frontend is served separately (CORS-enabled backend).

const apiUrl = 'http://127.0.0.1:5000/api/transacoes';

// Helpers
function parseDateOnly(dateStr) {
  if (!dateStr) return null;
  // accepts YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss...
  const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const year = Number(m[1]);
    const month = Number(m[2]) - 1;
    const day = Number(m[3]);
    // create local date (no UTC shift)
    return new Date(year, month, day);
  }
  const d = new Date(dateStr);
  return isNaN(d) ? null : d;
}

function formatDate(value){
  const d = parseDateOnly(value);
  if (!d) return '';
  return d.toLocaleDateString('pt-BR');
}


function formatCurrency(value){
  if (value === null || value === undefined) return '';
  const num = Number(value);
  if (isNaN(num)) return value;
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function getTodayMonthYear(){
  const d = new Date();
  return { mes: d.getMonth() + 1, ano: d.getFullYear() };
}

let current = getTodayMonthYear();

function updateLabel(){
  const nomeMes = new Date(current.ano, current.mes - 1).toLocaleString('pt-BR', { month: 'long' });
  document.getElementById('currentMonthLabel').innerText = `${nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1)} ${current.ano}`;
  // format for input month: YYYY-MM
  document.getElementById('monthPicker').value = `${current.ano}-${String(current.mes).padStart(2,'0')}`;
}


function buildUrl(base, page, per_page){
  // Build start and end dates for the selected month in YYYY-MM-DD
  const year = current.ano;
  const month = String(current.mes).padStart(2, '0');
  const inicio = `${year}-${month}-01`;
  // compute last day of month
  const lastDay = new Date(year, current.mes, 0).getDate();
  const fim = `${year}-${month}-${String(lastDay).padStart(2,'0')}`;
  return `${base}?inicio=${inicio}&fim=${fim}&page=${page}&per_page=${per_page}`;
}

// Create initial grid instance variable so we can update config later
let grid = null;

function createGrid(){
  grid = new gridjs.Grid({

    columns: [
      {
        id: 'id',
        name: '', // manter o id nos dados, mas ocultar visualmente a coluna
        sort: false,
        formatter: () => gridjs.html('')
      },
      { id: 'data_transacao', name: 'Data', sort: true },
      { id: 'descricao', name: 'Descrição', sort: true },
      { id: 'forma_pagamento', name: 'Forma Pagamento', sort: true },
      {
        id: 'status',
        name: 'Status',
        sort: true,
        formatter: (cell, row) => {
          if (cell === null || cell === undefined) return '';
          const txt = String(cell).trim();
          const lower = txt.toLowerCase();
          const idCell = (row && row.cells && row.cells[0]) ? (row.cells[0].data || row.cells[0]) : '';
          const id = idCell || '';
          const baseStyle = 'padding:4px 8px;border-radius:6px;display:inline-block;font-weight:600;cursor:pointer;';
          if (lower === 'pago') {
            return gridjs.html(`<span class="status-badge" data-id="${id}" data-status="Pago" style="${baseStyle}background:#198754;color:#fff;">${txt}</span>`);
          }
          if (lower === 'pendente') {
            return gridjs.html(`<span class="status-badge" data-id="${id}" data-status="Pendente" style="${baseStyle}background:#dc3545;color:#fff;">${txt}</span>`);
          }
          return gridjs.html(`<span class="status-badge" data-id="${id}" data-status="${txt}" style="${baseStyle}">${txt}</span>`);
        }
      },
      { id: 'tipo', name: 'Tipo', sort: true },
      {
        id: 'valor',
        name: 'Valor',
        sort: true,
        formatter: (cell) => {
          const num = Number(String(cell).replace(/[^\d,-]/g, '').replace(',', '.'));
          if (isNaN(num)) return cell;
          const color = num < 0 ? 'red' : 'green';
          return gridjs.html(`<span style="color:${color}; font-weight:bold;">${cell}</span>`);
        }
      }
    ,
      {
        id: 'acoes',
        name: 'Ações',
        sort: false,
        formatter: (cell, row) => {
          const idCell = (row && row.cells && row.cells[0]) ? (row.cells[0].data || row.cells[0]) : '';
          const id = idCell || '';
          return gridjs.html(`
            <div class="btn-group" role="group" aria-label="Ações">
              <button type="button" class="btn btn-sm btn-outline-primary edit-btn" data-id="${id}" title="Editar" aria-label="Editar">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M12.854.146a.5.5 0 0 1 .646.057l2.343 2.343a.5.5 0 0 1 .057.646l-9.193 9.193a.5.5 0 0 1-.168.11l-4 1.5a.5.5 0 0 1-.65-.65l1.5-4a.5.5 0 0 1 .11-.168L12.854.146zM11.207 2L3 10.207V12h1.793L14 3.793 11.207 2z"/>
                </svg>
              </button>

              <button type="button" class="btn btn-sm btn-outline-danger delete-btn ms-1" data-id="${id}" title="Excluir" aria-label="Excluir">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M5.5 5.5A.5.5 0 0 1 6 5h4a.5.5 0 0 1 .5.5v8A1.5 1.5 0 0 1 9 15H7a1.5 1.5 0 0 1-1.5-1.5v-8zM14.5 3a1 1 0 0 1-1 1H13v9.5A2.5 2.5 0 0 1 10.5 16h-5A2.5 2.5 0 0 1 3 13.5V4H2.5a1 1 0 1 1 0-2H5l.5-1h5l.5 1h2.5a1 1 0 0 1 1 1zM6.118 1 5.5 2h5l-.618-1H6.118z"/>
                </svg>
              </button>
            </div>
          `);
        }
      }
],

    // server.url must be a string (base). Use pagination.server.url to build page requests.
    server: {
      url: buildUrl(apiUrl, 1, 10),
      then: data => {
        const items = data.items || data.rows || [];
        // Custom client-side sort: Receita first, then Despesa
        const orderMap = { 'receita': 0, 'despesa': 1 };
        items.sort((a, b) => {
          const ta = (a.tipo || '').toString().trim().toLowerCase();
          const tb = (b.tipo || '').toString().trim().toLowerCase();
          const oa = orderMap.hasOwnProperty(ta) ? orderMap[ta] : 2;
          const ob = orderMap.hasOwnProperty(tb) ? orderMap[tb] : 2;
          if (oa !== ob) return oa - ob;
          const da = parseDateOnly(a.data_transacao || a.data || a.data_transacao);
          const db = parseDateOnly(b.data_transacao || b.data || b.data_transacao);
          if (da && db) return db - da;
          return 0;
        });

        return items.map(row => [
      row.id,
          formatDate(row.data_transacao || row.data || row.data_transacao),
          row.descricao || '',
          row.forma_pagamento || '',
          row.status || '',
          row.tipo || '',
          formatCurrency(row.valor)
        ]);
      },
      total: data => data.total_items || data.total || 0
    },
    pagination: {
      enabled: true,
      limit: 10,
      server: {
        // Grid.js will call this to fetch specific pages; buildUrl adds mes/ano and pagination
        url: (prev, page, limit) => {
          const p = page || 1;
          const per = limit || 10;
          return buildUrl(apiUrl, p, per);
        }
      }
    },
    search: true,
    sort: true,
    width: '100%'
  });

  // Injetar CSS para esconder a primeira coluna (ID) visualmente,
  // mantendo o valor no dataset dos rows para ações e badges.
  // Isso evita mudanças na estrutura de dados enviada ao Grid.js.
  const cssId = 'hide-grid-id-column-style';
  if (!document.getElementById(cssId)) {
    const style = document.createElement('style');
    style.id = cssId;
    style.innerHTML = `#grid .gridjs-table th:nth-child(1), #grid .gridjs-table td:nth-child(1) { display: none; }`;
    document.head.appendChild(style);
  }

  grid.render(document.getElementById('grid'));
}

function reloadGrid(){
  if (!grid) {
    createGrid();
    return;
  }
  // update server config to include current month/year, then force render
  grid.updateConfig({
    server: {
      url: buildUrl(apiUrl, 1, 10),
      then: data => {
        const items = data.items || data.rows || [];
        // Custom client-side sort: Receita first, then Despesa
        const orderMap = { 'receita': 0, 'despesa': 1 };
        items.sort((a, b) => {
          const ta = (a.tipo || '').toString().trim().toLowerCase();
          const tb = (b.tipo || '').toString().trim().toLowerCase();
          const oa = orderMap.hasOwnProperty(ta) ? orderMap[ta] : 2;
          const ob = orderMap.hasOwnProperty(tb) ? orderMap[tb] : 2;
          if (oa !== ob) return oa - ob;
          const da = parseDateOnly(a.data_transacao || a.data || a.data_transacao);
          const db = parseDateOnly(b.data_transacao || b.data || b.data_transacao);
          if (da && db) return db - da;
          return 0;
        });

        return items.map(row => [
      row.id,
          formatDate(row.data_transacao || row.data || row.data_transacao),
          row.descricao || '',
          row.forma_pagamento || '',
          row.status || '',
          row.tipo || '',
          formatCurrency(row.valor)
        ]);
      },
      total: data => data.total_items || data.total || 0
    },
    pagination: {
      enabled: true,
      limit: 10,
      server: {
        url: (prev, page, limit) => {
          const p = page || 1;
          const per = limit || 10;
          return buildUrl(apiUrl, p, per);
        }
      }
    }
  }).forceRender();
}

document.addEventListener('DOMContentLoaded', function(){
  // initialize label and input
  updateLabel();

  // initial grid creation
  createGrid();

  // initial fetch for summary cards
  fetchAndRenderSummary();

  // nav buttons
  document.getElementById('prevMonth').addEventListener('click', function(){
    current.mes--;
    if (current.mes === 0) { current.mes = 12; current.ano--; }
    updateLabel();
    reloadGrid();
    fetchAndRenderSummary();
  });

  document.getElementById('nextMonth').addEventListener('click', function(){
    current.mes++;
    if (current.mes === 13) { current.mes = 1; current.ano++; }
    updateLabel();
    reloadGrid();
    fetchAndRenderSummary();
  });

  // month picker change
  document.getElementById('monthPicker').addEventListener('change', function(e){
    const val = e.target.value; // "YYYY-MM"
    if (!val) return;
    const parts = val.split('-');
    if (parts.length !== 2) return;
    const ano = parseInt(parts[0], 10);
    const mes = parseInt(parts[1], 10);
    if (!isNaN(ano) && !isNaN(mes)) {
      current.ano = ano;
      current.mes = mes;
      updateLabel();
      reloadGrid();
      fetchAndRenderSummary();
    }
  });
});

// CLICK LISTENER: toggle status Pago <-> Pendente
document.getElementById('grid').addEventListener('click', async function(e){
  const el = e.target.closest('.status-badge');
  if (!el) return;

  const id = el.getAttribute('data-id');
  const current = el.getAttribute('data-status');
  if (!id || !current) return;

  const novoStatus = (current.toLowerCase() === 'pago') ? 'Pendente' : 'Pago';

  try {
    const resp = await fetch(`${apiUrl}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: novoStatus })
    });

    if (!resp.ok) {
      alert('Erro ao atualizar status.');
      return;
    }

    const updated = await resp.json();
    const finalStatus = updated.status || novoStatus;

    el.setAttribute('data-status', finalStatus);
    el.textContent = finalStatus;

    if (finalStatus.toLowerCase() === 'pago') {
      el.style.background = '#198754';
      el.style.color = '#fff';
    } else if (finalStatus.toLowerCase() === 'pendente') {
      el.style.background = '#dc3545';
      el.style.color = '#fff';
    } else {
      el.style.background = '';
      el.style.color = '';
    }

    // refresh summary because status might affect totals
    fetchAndRenderSummary();

  } catch (err) {
    alert('Erro de rede ao atualizar status.');
  }
});


// -------------------- Summary cards --------------------
function buildMonthRange(curr) {
  const year = curr.ano;
  const month = String(curr.mes).padStart(2, '0');
  const inicio = `${year}-${month}-01`;
  const lastDay = new Date(year, curr.mes, 0).getDate();
  const fim = `${year}-${month}-${String(lastDay).padStart(2,'0')}`;
  return { inicio, fim };
}

async function fetchAndRenderSummary() {
  const { inicio, fim } = buildMonthRange(current);
  try {
    const resp = await fetch(`http://127.0.0.1:5000/api/transacoes/summary?inicio=${inicio}&fim=${fim}`);
    if (!resp.ok) {
      console.error('Erro ao obter summary', resp.status);
      return;
    }
    const data = await resp.json();
    // formata para pt-BR (usar Intl)
    const formatMoeda = v => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const elR = document.getElementById('card-receitas');
    const elD = document.getElementById('card-despesas');
    const elS = document.getElementById('card-saldo');
    if (elR) elR.textContent = formatMoeda(data.receitas || 0);
    if (elD) elD.textContent = formatMoeda(data.despesas || 0);
    if (elS) elS.textContent = formatMoeda(data.saldo || 0);

  } catch (err) {
    console.error('Erro fetch summary', err);
  }
}
