const apiLembretes = 'http://127.0.0.1:5000/api/lembretes';
let gridLembretes = null;
let filtrosAtuais = {
  status: '',
  prioridade: '',
  data_inicio: '',
  data_fim: '',
  busca: ''
};

function fetchJWT(url, options = {}) {
  const token = localStorage.getItem('access_token');
  if (!token) {
    alert('Sessão expirada. Faça login novamente.');
    window.location.href = 'login.html';
    return Promise.reject(new Error('Token ausente'));
  }
  options.headers = options.headers || {};
  if (options.body && !(options.body instanceof FormData) && !options.headers['Content-Type']) {
    options.headers['Content-Type'] = 'application/json';
  }
  options.headers['Authorization'] = 'Bearer ' + token;
  return fetch(url, options);
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function formatTime(value) {
  if (!value) return '';
  return value.slice(0, 5);
}

function badgeStatus(status) {
  const map = {
    'Pendente': 'warning',
    'Concluído': 'success'
  };
  const cls = map[status] || 'secondary';
  return `<span class="badge bg-${cls}">${status}</span>`;
}

function badgePrioridade(p) {
  const map = {
    'Alta': 'danger',
    'Média': 'primary',
    'Baixa': 'secondary'
  };
  const cls = map[p] || 'secondary';
  return `<span class="badge bg-${cls} bg-opacity-10 text-${cls}">${p || '-'}</span>`;
}

function buildQueryString(params) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) search.append(key, value);
  });
  return search.toString();
}

async function loadResumo() {
  try {
    const resp = await fetchJWT(`${apiLembretes}/dashboard`);
    if (!resp.ok) throw new Error('Erro ao carregar resumo');
    const data = await resp.json();
    document.getElementById('metric-total').textContent = data.total ?? 0;
    document.getElementById('metric-pendentes').textContent = data.pendentes ?? 0;
    document.getElementById('metric-concluidos').textContent = data.concluidos ?? 0;
    document.getElementById('metric-hoje').textContent = data.hoje ?? 0;
    renderProximos(data.proximos || []);
  } catch (err) {
    console.error(err);
  }
}

function renderProximos(lista) {
  const container = document.getElementById('lista-proximos');
  if (!container) return;
  container.innerHTML = '';
  if (!lista.length) {
    container.style.display = 'none';
    return;
  }
  container.style.display = 'flex';
  lista.forEach((item) => {
    const card = document.createElement('div');
    card.className = 'col-md-4';
    card.innerHTML = `
      <div class="card h-100 shadow-sm border-0">
        <div class="card-body">
          <div class="d-flex justify-content-between mb-2">
            <strong>${item.titulo}</strong>
            ${badgePrioridade(item.prioridade)}
          </div>
          <p class="text-muted small mb-1">
            <i class="bi bi-calendar-event me-1"></i>${formatDate(item.data_lembrete)}
            ${item.hora_lembrete ? ` · ${formatTime(item.hora_lembrete)}` : ''}
          </p>
          ${item.categoria ? `<span class="badge bg-light text-dark">${item.categoria}</span>` : ''}
        </div>
      </div>`;
    container.appendChild(card);
  });
}

async function fetchLembretesData() {
  const params = buildQueryString({
    page: 1,
    per_page: 20,
    status: filtrosAtuais.status,
    prioridade: filtrosAtuais.prioridade,
    data_inicio: filtrosAtuais.data_inicio,
    data_fim: filtrosAtuais.data_fim,
    busca: filtrosAtuais.busca
  });
  const resp = await fetchJWT(`${apiLembretes}/?${params}`);
  if (!resp.ok) throw new Error('Erro ao listar lembretes');
  return resp.json();
}

function createGrid() {
  gridLembretes = new gridjs.Grid({
    columns: [
      { id: 'id', name: 'ID' },
      { id: 'titulo', name: 'Lembrete' },
      { id: 'data', name: 'Quando' },
      { id: 'prioridade', name: 'Prioridade' },
      { id: 'status', name: 'Status' },
      { id: 'acoes', name: 'Ações' }
    ],
    pagination: { enabled: true, limit: 20 },
    sort: true,
    search: false,
    data: async () => {
      const json = await fetchLembretesData();
      return json.items.map(item => ({
        id: item.id,
        titulo: gridjs.html(`
          <div>
            <div class="fw-semibold">${item.titulo}</div>
            <div class="text-muted small">${item.categoria || ''}</div>
          </div>`),
        data: gridjs.html(`
          <div>
            <div>${formatDate(item.data_lembrete)} ${item.hora_lembrete ? formatTime(item.hora_lembrete) : ''}</div>
          </div>`),
        prioridade: gridjs.html(badgePrioridade(item.prioridade)),
        status: gridjs.html(badgeStatus(item.status)),
        acoes: gridjs.html(actionButtons(item))
      }));
    }
  });
  gridLembretes.render(document.getElementById('grid-lembretes'));
}

function reloadGrid() {
  if (!gridLembretes) {
    createGrid();
    return;
  }
  gridLembretes.updateConfig({
    data: async () => {
      const json = await fetchLembretesData();
      return json.items.map(item => ({
        id: item.id,
        titulo: gridjs.html(`
          <div>
            <div class="fw-semibold">${item.titulo}</div>
            <div class="text-muted small">${item.categoria || ''}</div>
          </div>`),
        data: gridjs.html(`${formatDate(item.data_lembrete)} ${item.hora_lembrete ? formatTime(item.hora_lembrete) : ''}`),
        prioridade: gridjs.html(badgePrioridade(item.prioridade)),
        status: gridjs.html(badgeStatus(item.status)),
        acoes: gridjs.html(actionButtons(item))
      }));
    }
  }).forceRender();
}

function actionButtons(item) {
  const toggleLabel = item.status === 'Concluído' ? 'Reabrir' : 'Concluir';
  const nextStatus = item.status === 'Concluído' ? 'Pendente' : 'Concluído';
  return `
    <div class="btn-group btn-group-sm" role="group">
      <button class="btn btn-outline-success toggle-status" data-id="${item.id}" data-status="${nextStatus}">${toggleLabel}</button>
      <button class="btn btn-outline-primary edit-lembrete" data-id="${item.id}">Editar</button>
      <button class="btn btn-outline-danger delete-lembrete" data-id="${item.id}">Excluir</button>
    </div>`;
}

function limparFormulario() {
  document.getElementById('formLembrete').reset();
  document.getElementById('lembrete_id').value = '';
  document.getElementById('status').value = 'Pendente';
  document.getElementById('prioridade').value = 'Média';
}

function abrirModal(lembrete = null) {
  const modalEl = document.getElementById('modalLembrete');
  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
  limparFormulario();
  if (lembrete) {
    document.getElementById('tituloModalLembrete').textContent = 'Editar Lembrete';
    document.getElementById('lembrete_id').value = lembrete.id;
    document.getElementById('titulo').value = lembrete.titulo || '';
    document.getElementById('categoria').value = lembrete.categoria || '';
    document.getElementById('data_lembrete').value = lembrete.data_lembrete || '';
    document.getElementById('hora_lembrete').value = lembrete.hora_lembrete ? lembrete.hora_lembrete.slice(0,5) : '';
    document.getElementById('prioridade').value = lembrete.prioridade || 'Média';
    document.getElementById('descricao').value = lembrete.descricao || '';
    document.getElementById('status').value = lembrete.status || 'Pendente';
  } else {
    document.getElementById('tituloModalLembrete').textContent = 'Novo Lembrete';
  }
  modal.show();
}

async function carregarLembrete(id) {
  const resp = await fetchJWT(`${apiLembretes}/${id}`);
  if (!resp.ok) throw new Error('Erro ao carregar lembrete');
  return resp.json();
}

async function salvarLembrete() {
  const id = document.getElementById('lembrete_id').value;
  const payload = {
    titulo: document.getElementById('titulo').value.trim(),
    categoria: document.getElementById('categoria').value.trim() || null,
    data_lembrete: document.getElementById('data_lembrete').value || null,
    hora_lembrete: document.getElementById('hora_lembrete').value || null,
    prioridade: document.getElementById('prioridade').value,
    descricao: document.getElementById('descricao').value.trim() || null,
    status: document.getElementById('status').value
  };

  if (!payload.titulo) {
    alert('Informe um título.');
    return;
  }
  if (payload.hora_lembrete && !payload.data_lembrete) {
    alert('Para definir hora selecione também a data.');
    return;
  }

  const method = id ? 'PUT' : 'POST';
  const url = id ? `${apiLembretes}/${id}` : `${apiLembretes}/`;
  try {
    const resp = await fetchJWT(url, { method, body: JSON.stringify(payload) });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: 'Erro' }));
      throw new Error(err.error || JSON.stringify(err));
    }
    bootstrap.Modal.getInstance(document.getElementById('modalLembrete')).hide();
    reloadGrid();
    loadResumo();
  } catch (err) {
    alert('Erro ao salvar: ' + err.message);
  }
}

async function atualizarStatus(id, status) {
  try {
    const resp = await fetchJWT(`${apiLembretes}/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: 'Erro' }));
      throw new Error(err.error || JSON.stringify(err));
    }
    reloadGrid();
    loadResumo();
  } catch (err) {
    alert('Não foi possível atualizar o status: ' + err.message);
  }
}

async function excluirLembrete(id) {
  if (!confirm('Deseja realmente remover este lembrete?')) return;
  try {
    const resp = await fetchJWT(`${apiLembretes}/${id}`, { method: 'DELETE' });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: 'Erro' }));
      throw new Error(err.error || JSON.stringify(err));
    }
    reloadGrid();
    loadResumo();
  } catch (err) {
    alert('Erro ao excluir: ' + err.message);
  }
}

function lerFiltrosDaTela() {
  filtrosAtuais = {
    status: document.getElementById('filtro-status').value,
    prioridade: document.getElementById('filtro-prioridade').value,
    data_inicio: document.getElementById('filtro-data-inicio').value,
    data_fim: document.getElementById('filtro-data-fim').value,
    busca: document.getElementById('filtro-busca').value.trim()
  };
}

function limparFiltros() {
  document.getElementById('filtro-status').value = '';
  document.getElementById('filtro-prioridade').value = '';
  document.getElementById('filtro-data-inicio').value = '';
  document.getElementById('filtro-data-fim').value = '';
  document.getElementById('filtro-busca').value = '';
  lerFiltrosDaTela();
  reloadGrid();
}

function aplicarFiltros() {
  lerFiltrosDaTela();
  reloadGrid();
}

function setupEvents() {
  document.getElementById('btn-novo-lembrete').addEventListener('click', () => abrirModal());
  document.getElementById('btn-salvar-lembrete').addEventListener('click', salvarLembrete);
  document.getElementById('btn-aplicar-filtros').addEventListener('click', aplicarFiltros);
  document.getElementById('btn-limpar-filtros').addEventListener('click', limparFiltros);
  document.getElementById('btn-atualizar').addEventListener('click', () => {
    loadResumo();
    reloadGrid();
  });

  document.getElementById('grid-lembretes').addEventListener('click', async (event) => {
    const editBtn = event.target.closest('.edit-lembrete');
    if (editBtn) {
      const id = editBtn.getAttribute('data-id');
      if (!id) return;
      try {
        const lembrete = await carregarLembrete(id);
        abrirModal(lembrete);
      } catch (err) {
        alert('Erro ao editar: ' + err.message);
      }
      return;
    }
    const deleteBtn = event.target.closest('.delete-lembrete');
    if (deleteBtn) {
      excluirLembrete(deleteBtn.getAttribute('data-id'));
      return;
    }
    const toggleBtn = event.target.closest('.toggle-status');
    if (toggleBtn) {
      atualizarStatus(toggleBtn.getAttribute('data-id'), toggleBtn.getAttribute('data-status'));
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  lerFiltrosDaTela();
  createGrid();
  loadResumo();
  setupEvents();
});
