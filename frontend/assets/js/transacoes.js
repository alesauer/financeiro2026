// Função para abrir modal de edição (definida globalmente, sem duplicidade)
function abrirModalEdicao(dados) {
  var old = document.getElementById('modal-edicao-transacao');
  if (old) old.remove();

  var modal = document.createElement('div');
  modal.id = 'modal-edicao-transacao';
  modal.style.position = 'fixed';
  modal.style.top = '0';
  modal.style.left = '0';
  modal.style.width = '100vw';
  modal.style.height = '100vh';
  modal.style.background = 'rgba(0,0,0,0.3)';
  modal.style.zIndex = '9999';
  modal.style.display = 'flex';
  modal.style.alignItems = 'center';
  modal.style.justifyContent = 'center';

  const campos = [
    { nome: 'descricao', label: 'Descrição', tipo: 'text' },
    { nome: 'tipo', label: 'Tipo', tipo: 'select', opcoes: ['Receita','Despesa','Investimento'] },
    { nome: 'categoria_id', label: 'Categoria', tipo: 'select-categoria' },
    { nome: 'valor', label: 'Valor (R$)', tipo: 'number', step: '0.01' },
    { nome: 'data_transacao', label: 'Data', tipo: 'date' },
    { nome: 'forma_pagamento', label: 'Forma de Pagamento', tipo: 'select', opcoes: ['Dinheiro','Cartão de Crédito','Cartão de Débito','Pix','Boleto','Transferência'] },
    { nome: 'status', label: 'Status', tipo: 'select', opcoes: ['Pago','Pendente'] }
  ];

  let html = `<form id="form-edicao-transacao" style="background:#fff;padding:24px;border-radius:10px;min-width:320px;max-width:90vw;box-shadow:0 2px 16px #0002;">
    <h4 style="margin-bottom:16px;">${dados ? 'Editar' : 'Nova'} Transação</h4>`;
  let categorias = [];
  let tipoSelecionado = dados && dados.tipo ? dados.tipo : 'Receita';

  // Busca categorias do tipo informado e renderiza campos
  function buscarECampos(tipoCat) {
    fetch(`http://127.0.0.1:5000/api/categorias?tipo=${encodeURIComponent(tipoCat)}`)
      .then(resp => resp.json())
      .then(arr => {
        categorias = arr;
        document.getElementById('campos-modal-transacao').innerHTML = renderCampos();
        adicionarListeners();
      })
      .catch(() => {
        categorias = [];
        document.getElementById('campos-modal-transacao').innerHTML = renderCampos();
        adicionarListeners();
      });
  }

  function renderCampos() {
    let camposHtml = '';
    campos.forEach(c => {
      camposHtml += `<div style="margin-bottom:12px;">
        <label style="font-weight:600;">${c.label}</label><br/>`;
      if (c.tipo === 'select') {
        camposHtml += `<select name="${c.nome}" style="width:100%;padding:6px;">`;
        c.opcoes.forEach(op => {
          let sel = '';
          if (c.nome === 'tipo' && op === tipoSelecionado) sel = 'selected';
          else if (dados && dados[c.nome] === op) sel = 'selected';
          camposHtml += `<option value="${op}" ${sel}>${op}</option>`;
        });
        camposHtml += `</select>`;
      } else if (c.tipo === 'select-categoria') {
        camposHtml += `<select name="categoria_id" style="width:100%;padding:6px;">`;
        categorias.forEach(cat => {
          const sel = (dados && dados.categoria_id == cat.id) ? 'selected' : '';
          camposHtml += `<option value="${cat.id}" ${sel}>${cat.nome}</option>`;
        });
        camposHtml += `</select>`;
      } else if (c.tipo === 'date') {
        let val = dados && dados[c.nome] ? dados[c.nome] : '';
        if (val && val.length >= 10) val = val.slice(0,10);
        camposHtml += `<input type="date" name="${c.nome}" value="${val||''}" style="width:100%;padding:6px;" />`;
      } else {
        camposHtml += `<input type="${c.tipo}" name="${c.nome}" value="${dados ? (dados[c.nome]||'') : ''}" style="width:100%;padding:6px;" step="${c.step||''}" />`;
      }
      camposHtml += `</div>`;
    });
    return camposHtml;
  }

  html += `<div id="campos-modal-transacao"></div>`;
  html += `<div style="display:flex;gap:12px;justify-content:flex-end;margin-top:24px;">
    <button type="button" id="btn-cancelar-edicao" class="btn btn-secondary">Cancelar</button>
    <button type="submit" class="btn btn-primary">Salvar</button>
  </div>
  </form>`;

  modal.innerHTML = html;
  document.body.appendChild(modal);

  function adicionarListeners() {
    document.getElementById('btn-cancelar-edicao').onclick = () => {
      modal.remove();
    };
    document.getElementById('form-edicao-transacao').onsubmit = async function(ev) {
      ev.preventDefault();
      const fd = new FormData(ev.target);
      const payload = {};
      campos.forEach(c => {
        let v = fd.get(c.nome);
        if (c.tipo === 'number') v = v ? parseFloat(v) : null;
        if (c.nome === 'categoria_id') v = v ? parseInt(v) : null;
        payload[c.nome] = v;
      });
      try {
        let resp;
        if (dados && dados.id) {
          resp = await fetch(`${apiUrl}/${dados.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
        } else {
          resp = await fetch(`${apiUrl}/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
        }
        if (!resp.ok) {
          const err = await resp.json();
          alert('Erro ao salvar: ' + (err.error || JSON.stringify(err)));
          return;
        }
        alert(dados && dados.id ? 'Transação atualizada com sucesso.' : 'Transação criada com sucesso.');
        modal.remove();
        reloadGrid();
        fetchAndRenderSummary();
      } catch (err) {
        alert('Erro de rede ao salvar.');
      }
    };
    // Listener para o campo tipo
    const tipoSelect = document.querySelector('select[name="tipo"]');
    if (tipoSelect) {
      tipoSelect.onchange = function() {
        tipoSelecionado = this.value;
        buscarECampos(tipoSelecionado);
      };
    }
  }

  // Inicialização: busca categorias do tipo inicial
  buscarECampos(tipoSelecionado);
}
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
  if (value === null || value === undefined || value === '') return 'R$ 0,00';
  let num = value;
  if (typeof num === 'string') {
    // Remove tudo que não for número, ponto ou vírgula
    num = num.replace(/[^\d.,-]/g, '').replace(',', '.');
  }
  num = Number(num);
  if (isNaN(num)) return 'R$ 0,00';
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
  { id: 'categoria_nome', name: 'Categoria', sort: true },
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
      {
        id: 'tipo',
        name: 'Tipo',
        sort: true,
        formatter: (cell) => {
          let color = '';
          if (cell === 'Receita') color = 'green';
          else if (cell === 'Despesa') color = 'red';
          else if (cell === 'Investimento') color = 'goldenrod';
          return gridjs.html(`<span style="color:${color};font-weight:bold;">${cell}</span>`);
        }
      },
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
          row.categoria_nome || '',
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
          row.categoria_nome || '',
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
  // Garante que abrirModalEdicao está definida antes de criar o botão
  setTimeout(function() {
    if (typeof window.abrirModalEdicao === 'function') {
      const gridContainer = document.getElementById('grid');
      if (gridContainer && !document.getElementById('btn-nova-transacao')) {
        const btn = document.createElement('button');
        btn.textContent = 'Nova Transação';
        btn.className = 'btn btn-success mb-3';
        btn.id = 'btn-nova-transacao';
        btn.style.float = 'right';
        btn.onclick = function(){ window.abrirModalEdicao(null); };
        gridContainer.parentNode.insertBefore(btn, gridContainer);
      }
    }
  }, 100);
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
  // Adiciona botão Nova Transação acima da grid
  const gridContainer = document.getElementById('grid');
  if (gridContainer && !document.getElementById('btn-nova-transacao')) {
    const btn = document.createElement('button');
    btn.textContent = 'Nova Transação';
    btn.className = 'btn btn-success mb-3';
    btn.id = 'btn-nova-transacao';
    btn.style.float = 'right';
    btn.onclick = function(){ abrirModalEdicao(null); };
    gridContainer.parentNode.insertBefore(btn, gridContainer);
  }
// CLICK LISTENER: toggle status Pago <-> Pendente

document.getElementById('grid').addEventListener('click', async function(e){
  // Handler para status badge (toggle Pago/Pendente)
  const statusEl = e.target.closest('.status-badge');
  if (statusEl) {
    const id = statusEl.getAttribute('data-id');
    const current = statusEl.getAttribute('data-status');
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
      statusEl.setAttribute('data-status', finalStatus);
      statusEl.textContent = finalStatus;
      if (finalStatus.toLowerCase() === 'pago') {
        statusEl.style.background = '#198754';
        statusEl.style.color = '#fff';
      } else if (finalStatus.toLowerCase() === 'pendente') {
        statusEl.style.background = '#dc3545';
        statusEl.style.color = '#fff';
      } else {
        statusEl.style.background = '';
        statusEl.style.color = '';
      }
      fetchAndRenderSummary();
    } catch (err) {
      alert('Erro de rede ao atualizar status.');
    }
    return;
  }

  // Handler para botão de exclusão
  const deleteBtn = e.target.closest('.delete-btn');
  if (deleteBtn) {
    const id = deleteBtn.getAttribute('data-id');
    if (!id) return;
    if (!confirm('Deseja realmente excluir esta transação? Esta ação não pode ser desfeita.')) return;
    try {
      const resp = await fetch(`${apiUrl}/${id}`, {
        method: 'DELETE'
      });
      if (!resp.ok) {
        alert('Erro ao excluir transação.');
        return;
      }
      const result = await resp.json();
      alert(result.message || 'Transação excluída com sucesso.');
      reloadGrid();
      fetchAndRenderSummary();
    } catch (err) {
      alert('Erro de rede ao excluir transação.');
    }
    return;
  }

    // Handler para botão de edição
    const editBtn = e.target.closest('.edit-btn');
    if (editBtn) {
      const id = editBtn.getAttribute('data-id');
      if (!id) return;

      // Buscar dados da transação
      try {
        const resp = await fetch(`${apiUrl}/${id}`);
        if (!resp.ok) {
          alert('Erro ao buscar dados da transação.');
          return;
        }
        const dados = await resp.json();
        abrirModalEdicao(dados);
      } catch (err) {
        alert('Erro de rede ao buscar dados da transação.');
      }
      return;
    }
// Função para abrir modal de edição (definida no escopo global)
window.abrirModalEdicao = function(dados) {
  // Remove modal anterior se existir
  var old = document.getElementById('modal-edicao-transacao');
  if (old) old.remove();

  // Cria modal
  var modal = document.createElement('div');
    modal.id = 'modal-edicao-transacao';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100vw';
    modal.style.height = '100vh';
    modal.style.background = 'rgba(0,0,0,0.3)';
    modal.style.zIndex = '9999';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';

    // Campos editáveis
    const campos = [
        { nome: 'descricao', label: 'Descrição', tipo: 'text' },
        { nome: 'valor', label: 'Valor (R$)', tipo: 'number', step: '0.01' },
        { nome: 'data_transacao', label: 'Data', tipo: 'date' },
        { nome: 'forma_pagamento', label: 'Forma de Pagamento', tipo: 'select', opcoes: ['Dinheiro','Cartão de Crédito','Cartão de Débito','Pix','Boleto','Transferência'] },
        { nome: 'status', label: 'Status', tipo: 'select', opcoes: ['Pago','Pendente'] },
        { nome: 'tipo', label: 'Tipo', tipo: 'select', opcoes: ['Receita','Despesa','Investimento'] }
    ];

    // Monta formulário
    let html = `<form id="form-edicao-transacao" style="background:#fff;padding:24px;border-radius:10px;min-width:320px;max-width:90vw;box-shadow:0 2px 16px #0002;">
        <h4 style="margin-bottom:16px;">${dados ? 'Editar' : 'Nova'} Transação</h4>`;
    campos.forEach(c => {
        html += `<div style="margin-bottom:12px;">
            <label style="font-weight:600;">${c.label}</label><br/>`;
        if (c.tipo === 'select') {
            html += `<select name="${c.nome}" style="width:100%;padding:6px;">`;
            c.opcoes.forEach(op => {
                const sel = (dados && dados[c.nome] === op) ? 'selected' : '';
                html += `<option value="${op}" ${sel}>${op}</option>`;
            });
            html += `</select>`;
        } else if (c.tipo === 'date') {
            let val = dados && dados[c.nome] ? dados[c.nome] : '';
            if (val && val.length >= 10) val = val.slice(0,10);
            html += `<input type="date" name="${c.nome}" value="${val||''}" style="width:100%;padding:6px;" />`;
        } else {
            html += `<input type="${c.tipo}" name="${c.nome}" value="${dados ? (dados[c.nome]||'') : ''}" style="width:100%;padding:6px;" step="${c.step||''}" />`;
        }
        html += `</div>`;
    });
    html += `<div style="display:flex;gap:12px;justify-content:flex-end;margin-top:24px;">
        <button type="button" id="btn-cancelar-edicao" class="btn btn-secondary">Cancelar</button>
        <button type="submit" class="btn btn-primary">Salvar</button>
    </div>
    </form>`;

    modal.innerHTML = html;
    document.body.appendChild(modal);

    // Cancelar
    document.getElementById('btn-cancelar-edicao').onclick = () => {
        modal.remove();
    };

    // Salvar
    document.getElementById('form-edicao-transacao').onsubmit = async function(ev) {
        ev.preventDefault();
        const fd = new FormData(ev.target);
        const payload = {};
        campos.forEach(c => {
            let v = fd.get(c.nome);
            if (c.tipo === 'number') v = v ? parseFloat(v) : null;
            payload[c.nome] = v;
        });
        try {
            let resp;
            if (dados && dados.id) {
                // PUT para editar
                resp = await fetch(`${apiUrl}/${dados.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            } else {
                // POST para criar
                resp = await fetch(`${apiUrl}/`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            }
            if (!resp.ok) {
                const err = await resp.json();
                alert('Erro ao salvar: ' + (err.error || JSON.stringify(err)));
                return;
            }
            alert(dados && dados.id ? 'Transação atualizada com sucesso.' : 'Transação criada com sucesso.');
            modal.remove();
            reloadGrid();
            fetchAndRenderSummary();
        } catch (err) {
            alert('Erro de rede ao salvar.');
        }
    };
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
