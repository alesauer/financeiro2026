const apiViagens = 'http://127.0.0.1:5000/api/viagens';
let gridViagens = null;
let filtros = { termo: '', status: '', ordenar: 'data_inicio', ordem: 'asc' };
let viagemDestinoNovoCusto = null;

const modalViagem = new bootstrap.Modal('#modalViagem');
const modalCusto = new bootstrap.Modal('#modalCusto');

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

function formatCurrency(valor) {
  const numero = typeof valor === 'string' ? parseFloat(valor) : valor;
  if (Number.isNaN(numero) || numero == null) return 'R$ 0,00';
  return numero.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(dataStr) {
  if (!dataStr) return '-';
  const data = new Date(dataStr);
  if (Number.isNaN(data.getTime())) return dataStr;
  return data.toLocaleDateString('pt-BR');
}

function escapeAttr(value) {
  if (value === undefined || value === null) return '';
  return String(value).replace(/"/g, '&quot;');
}

function statusClass(status) {
  const mapa = {
    'Planejada': 'status-planejada',
    'Em andamento': 'status-em-andamento',
    'Finalizada': 'status-finalizada',
    'Cancelada': 'status-cancelada'
  };
  return mapa[status] || 'status-planejada';
}

function atualizarContador(total) {
  const el = document.getElementById('contador-viagens');
  if (el) {
    el.textContent = `${total || 0} viagem${total === 1 ? '' : 's'}`;
  }
}

async function carregarViagens() {
  const params = new URLSearchParams({ page: 1, per_page: 10, ordenar_por: filtros.ordenar, ordem: filtros.ordem });
  if (filtros.status) params.append('status', filtros.status);
  if (filtros.termo) params.append('q', filtros.termo);
  const resp = await fetchJWT(`${apiViagens}?${params.toString()}`);
  if (!resp.ok) {
    throw new Error('Erro ao carregar viagens');
  }
  const json = await resp.json();
  atualizarContador(json.total_items || 0);
  return (json.items || []).map(item => ({
    id: item.id,
    titulo: item.titulo,
    destino: item.destino,
    data_inicio_fmt: formatDate(item.data_inicio),
    data_termino_fmt: formatDate(item.data_termino),
    status: item.status,
    custo_total: formatCurrency(parseFloat(item.custo_total || 0))
  }));
}

function criarGrid() {
  gridViagens = new gridjs.Grid({
    columns: [
      { id: 'id', name: 'ID' },
      {
        id: 'titulo',
        name: 'Viagem',
        formatter: cell => gridjs.html(`<div class="fw-semibold text-dark">${cell}</div>`)
      },
      { id: 'destino', name: 'Destino', formatter: cell => gridjs.html(`<span class="text-muted small">${cell}</span>`) },
      { id: 'data_inicio_fmt', name: 'Início' },
      { id: 'data_termino_fmt', name: 'Término' },
      {
        id: 'status',
        name: 'Status',
        formatter: cell => gridjs.html(`<span class="status-pill ${statusClass(cell)}">${cell}</span>`)
      },
      { id: 'custo_total', name: 'Custo total', formatter: cell => gridjs.html(`<strong>${cell}</strong>`) },
      {
        id: 'detalhes',
        name: 'Detalhes',
        width: '120px',
        formatter: (_, row) => {
          const viagemId = row.cells[0].data;
          return gridjs.html(`
            <div class="d-flex justify-content-center">
              <button type="button" class="btn btn-outline-primary btn-sm ver-detalhes px-3" data-id="${viagemId}">
                <i class="bi bi-eye me-1"></i> Ver
              </button>
            </div>
          `);
        }
      },
      {
        id: 'acoes',
        name: '',
        sort: false,
        width: '140px',
        formatter: (_, row) => {
          const viagemId = row.cells[0].data;
          const titulo = row.cells[1].data;
          return gridjs.html(`
            <div class="d-flex justify-content-end gap-2 pe-1">
              <div class="btn-group btn-group-sm" role="group">
                <button type="button" class="btn btn-outline-primary" data-action="add-custo" data-viagem-id="${viagemId}" data-viagem-nome="${escapeAttr(titulo)}" title="Adicionar custo">
                  <i class="bi bi-plus-lg"></i>
                </button>
                <button type="button" class="btn btn-outline-danger" data-action="excluir-viagem" data-viagem-id="${viagemId}" data-viagem-nome="${escapeAttr(titulo)}" title="Excluir viagem">
                  <i class="bi bi-trash"></i>
                </button>
              </div>
            </div>
          `);
        }
      }
    ],
    sort: false,
    pagination: { enabled: true, limit: 10 },
    data: () => carregarViagens(),
    rowAttributes: row => ({ 'data-id': row.cells[0].data, class: 'cursor-pointer' })
  }).render(document.getElementById('grid-viagens'));
}

function reloadGrid() {
  if (!gridViagens) {
    criarGrid();
    return;
  }
  gridViagens.updateConfig({ data: () => carregarViagens() }).forceRender();
}

function abrirModalViagem(dados = null) {
  document.getElementById('formViagem').reset();
  document.getElementById('viagem_id').value = dados?.id || '';
  document.getElementById('viagem_titulo').value = dados?.titulo || '';
  document.getElementById('viagem_destino').value = dados?.destino || '';
  document.getElementById('viagem_data_inicio').value = dados?.data_inicio || '';
  document.getElementById('viagem_data_termino').value = dados?.data_termino || '';
  document.getElementById('viagem_status').value = dados?.status || 'Planejada';
  document.getElementById('viagem_descricao').value = dados?.descricao || '';
  document.getElementById('tituloModalViagem').textContent = dados ? 'Editar Viagem' : 'Nova Viagem';
  modalViagem.show();
}

async function salvarViagem() {
  const id = document.getElementById('viagem_id').value;
  const payload = {
    titulo: document.getElementById('viagem_titulo').value.trim(),
    destino: document.getElementById('viagem_destino').value.trim(),
    data_inicio: document.getElementById('viagem_data_inicio').value,
    data_termino: document.getElementById('viagem_data_termino').value,
    status: document.getElementById('viagem_status').value,
    descricao: document.getElementById('viagem_descricao').value.trim() || null,
  };
  if (!payload.titulo || !payload.destino || !payload.data_inicio || !payload.data_termino) {
    alert('Preencha título, destino e datas.');
    return;
  }
  const method = id ? 'PUT' : 'POST';
  const url = id ? `${apiViagens}/${id}` : `${apiViagens}/`;
  const resp = await fetchJWT(url, { method, body: JSON.stringify(payload) });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    alert('Erro ao salvar viagem: ' + (err.error || JSON.stringify(err)));
    return;
  }
  modalViagem.hide();
  reloadGrid();
}

function abrirModalCusto(dados = null, viagemId = null) {
  const alvo = viagemId || viagemDestinoNovoCusto;
  if (!alvo) {
    alert('Selecione uma viagem primeiro.');
    return;
  }
  viagemDestinoNovoCusto = Number(alvo);
  document.getElementById('formCusto').reset();
  document.getElementById('custo_id').value = dados?.id || '';
  document.getElementById('custo_nome').value = dados?.nome || '';
  document.getElementById('custo_descricao').value = dados?.descricao || '';
  document.getElementById('custo_observacao').value = dados?.observacao || '';
  document.getElementById('custo_link').value = dados?.link || '';
  document.getElementById('custo_valor').value = dados?.valor || '';
  document.getElementById('custo_tipo').value = dados?.tipo || 'Outros';
  document.getElementById('custo_forma_pagamento').value = dados?.forma_pagamento || '';
  const dataInput = document.getElementById('custo_data');
  dataInput.value = dados?.data_gasto || new Date().toISOString().split('T')[0];
  document.getElementById('tituloModalCusto').textContent = dados ? 'Editar Custo' : 'Novo Custo';
  modalCusto.show();
}

async function salvarCusto() {
  if (!viagemDestinoNovoCusto) {
    alert('Selecione uma viagem.');
    return;
  }
  const id = document.getElementById('custo_id').value;
  const payload = {
    nome: document.getElementById('custo_nome').value.trim(),
    descricao: document.getElementById('custo_descricao').value.trim(),
    valor: document.getElementById('custo_valor').value,
    observacao: document.getElementById('custo_observacao').value.trim() || null,
    link: document.getElementById('custo_link').value.trim() || null,
    tipo: document.getElementById('custo_tipo').value,
    data_gasto: document.getElementById('custo_data').value,
    forma_pagamento: document.getElementById('custo_forma_pagamento').value.trim() || null,
  };
  if (!payload.nome || !payload.descricao || !payload.valor) {
    alert('Informe nome, descrição e valor.');
    return;
  }
  const valorNum = parseFloat(payload.valor);
  if (Number.isNaN(valorNum) || valorNum <= 0) {
    alert('Informe um valor válido.');
    return;
  }
  if (!payload.data_gasto) delete payload.data_gasto;
  if (!payload.tipo) delete payload.tipo;
  if (!payload.forma_pagamento) delete payload.forma_pagamento;
  if (!payload.observacao) delete payload.observacao;
  if (!payload.link) delete payload.link;

  const method = id ? 'PUT' : 'POST';
  const url = id ? `${apiViagens}/${viagemDestinoNovoCusto}/custos/${id}` : `${apiViagens}/${viagemDestinoNovoCusto}/custos`;
  const resp = await fetchJWT(url, { method, body: JSON.stringify(payload) });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    alert('Erro ao salvar custo: ' + (err.error || JSON.stringify(err)));
    return;
  }
  modalCusto.hide();
  reloadGrid();
}

async function excluirViagem(viagemId, viagemNome = '') {
  const alvoId = Number(viagemId);
  if (!alvoId) return;
  const mensagem = viagemNome
    ? `Tem certeza que deseja excluir a viagem "${viagemNome}" e todos os custos?`
    : 'Tem certeza que deseja excluir esta viagem e todos os custos?';
  if (!confirm(mensagem)) return;
  const resp = await fetchJWT(`${apiViagens}/${alvoId}`, { method: 'DELETE' });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    alert('Erro ao excluir viagem: ' + (err.error || JSON.stringify(err)));
    return;
  }
  reloadGrid();
}

function abrirDetalhesEmNovaPagina(id) {
  if (!id) return;
  window.location.href = `viagem_detalhe.html?id=${id}`;
}

function setupEventos() {
  document.getElementById('btn-aplicar-filtros').addEventListener('click', () => {
    filtros = {
      termo: document.getElementById('filtro-busca').value.trim(),
      status: document.getElementById('filtro-status').value,
      ordenar: document.getElementById('filtro-ordenacao').value,
      ordem: 'asc'
    };
    reloadGrid();
  });

  document.getElementById('btn-limpar-filtros').addEventListener('click', () => {
    document.getElementById('filtro-busca').value = '';
    document.getElementById('filtro-status').value = '';
    document.getElementById('filtro-ordenacao').value = 'data_inicio';
    filtros = { termo: '', status: '', ordenar: 'data_inicio', ordem: 'asc' };
    reloadGrid();
  });

  document.getElementById('btn-nova-viagem').addEventListener('click', () => abrirModalViagem());
  document.getElementById('btn-salvar-viagem').addEventListener('click', salvarViagem);
  document.getElementById('btn-salvar-custo').addEventListener('click', salvarCusto);

  document.getElementById('grid-viagens').addEventListener('click', (event) => {
    const actionBtn = event.target.closest('[data-action]');
    if (actionBtn) {
      event.preventDefault();
      event.stopPropagation();
      const viagemId = actionBtn.dataset.viagemId;
      const viagemNome = actionBtn.dataset.viagemNome;
      if (actionBtn.dataset.action === 'add-custo') {
        abrirModalCusto(null, viagemId);
      } else if (actionBtn.dataset.action === 'excluir-viagem') {
        excluirViagem(viagemId, viagemNome);
      }
      return;
    }
    const detalhesBtn = event.target.closest('.ver-detalhes');
    if (detalhesBtn) {
      event.preventDefault();
      abrirDetalhesEmNovaPagina(detalhesBtn.dataset.id);
      return;
    }
    const row = event.target.closest('.gridjs-tr');
    if (row && row.dataset.id) {
      abrirDetalhesEmNovaPagina(row.dataset.id);
    }
  });
}

window.addEventListener('DOMContentLoaded', () => {
  criarGrid();
  setupEventos();
});
