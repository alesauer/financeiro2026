const apiViagens = 'http://127.0.0.1:5000/api/viagens';
let gridViagens = null;
let filtros = { termo: '', status: '', ordenar: 'data_inicio', ordem: 'asc' };
let viagemSelecionada = null;
let custosAtuais = [];
let filtroCustoAtual = '';
let anexoCustoId = null;
let ultimaPaginacao = { total: 0 };

const modalViagem = new bootstrap.Modal('#modalViagem');
const modalCusto = new bootstrap.Modal('#modalCusto');
const modalAnexos = new bootstrap.Modal('#modalAnexos');

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
  ultimaPaginacao = json;
  atualizarContador(json.total_items || 0);
  return (json.items || []).map(item => ({
    id: item.id,
    titulo: item.titulo,
    destino: item.destino,
    periodo: `${formatDate(item.data_inicio)} — ${formatDate(item.data_termino)}`,
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
        formatter: (cell, row) => gridjs.html(`
          <div class="fw-semibold text-dark">${cell}</div>
          <div class="text-muted small">${row.cells[2].data}</div>
        `)
      },
      { id: 'destino', name: 'Destino', formatter: cell => gridjs.html(`<span class="text-muted small">${cell}</span>`) },
      { id: 'periodo', name: 'Período' },
      {
        id: 'status',
        name: 'Status',
        formatter: cell => gridjs.html(`<span class="status-pill ${statusClass(cell)}">${cell}</span>`)
      },
      { id: 'custo_total', name: 'Custo total', formatter: cell => gridjs.html(`<strong>${cell}</strong>`), sort: true }
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

function limparDetalhes() {
  viagemSelecionada = null;
  custosAtuais = [];
  filtroCustoAtual = '';
  document.getElementById('btn-exportar').setAttribute('disabled', 'disabled');
  document.getElementById('detalhes-conteudo').classList.add('d-none');
  document.getElementById('estado-vazio-detalhes').classList.remove('d-none');
  document.querySelector('#tabela-custos tbody').innerHTML = '';
  document.getElementById('lista-resumo').innerHTML = '';
}

function renderResumo(resumo) {
  const container = document.getElementById('lista-resumo');
  const subtitle = document.getElementById('resumo-subtitulo');
  container.innerHTML = '';
  if (!resumo || !resumo.length) {
    subtitle.textContent = 'sem custos';
    container.innerHTML = '<span class="text-muted small">Nenhum custo registrado ainda.</span>';
    return;
  }
  subtitle.textContent = `${resumo.length} categoria${resumo.length === 1 ? '' : 's'}`;
  resumo.forEach(item => {
    const line = document.createElement('div');
    line.className = 'summary-item d-flex justify-content-between align-items-center';
    line.innerHTML = `
      <div>
        <div class="fw-semibold">${item.tipo}</div>
        <small class="text-muted">${item.percentual}% do total</small>
      </div>
      <div class="fw-bold">${formatCurrency(item.total)}</div>
    `;
    container.appendChild(line);
  });
}

function renderCustos(lista) {
  const corpo = document.querySelector('#tabela-custos tbody');
  corpo.innerHTML = '';
  if (!lista.length) {
    corpo.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Nenhum custo cadastrado</td></tr>';
    return;
  }
  lista.forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${formatDate(item.data_gasto)}</td>
      <td>${item.tipo}</td>
      <td>
        <div class="fw-semibold">${item.descricao}</div>
        <small class="text-muted">${item.forma_pagamento || ''}</small>
      </td>
      <td class="text-end">${formatCurrency(parseFloat(item.valor || 0))}</td>
      <td class="text-end">
        <div class="btn-group btn-group-sm">
          <button class="btn btn-outline-secondary editar-custo" data-id="${item.id}"><i class="bi bi-pencil"></i></button>
          <button class="btn btn-outline-secondary anexos-custo" data-id="${item.id}" title="Comprovantes"><i class="bi bi-paperclip"></i></button>
          <button class="btn btn-outline-danger deletar-custo" data-id="${item.id}"><i class="bi bi-trash"></i></button>
        </div>
      </td>
    `;
    corpo.appendChild(tr);
  });
}

function aplicarFiltroCustos() {
  let dados = [...custosAtuais];
  if (filtroCustoAtual) {
    dados = dados.filter(c => c.tipo === filtroCustoAtual);
  }
  renderCustos(dados);
}

async function carregarDetalhes(id) {
  const resp = await fetchJWT(`${apiViagens}/${id}`);
  if (!resp.ok) {
    alert('Não foi possível carregar os detalhes da viagem.');
    return;
  }
  const viagem = await resp.json();
  viagemSelecionada = viagem;
  custosAtuais = viagem.custos || [];
  filtroCustoAtual = '';

  document.getElementById('detalhes-conteudo').classList.remove('d-none');
  document.getElementById('estado-vazio-detalhes').classList.add('d-none');
  document.getElementById('btn-exportar').removeAttribute('disabled');

  document.getElementById('detalhe-titulo').textContent = viagem.titulo;
  document.getElementById('detalhe-destino').textContent = viagem.destino;
  document.getElementById('detalhe-periodo').textContent = `${formatDate(viagem.data_inicio)} a ${formatDate(viagem.data_termino)}`;
  document.getElementById('detalhe-total').textContent = formatCurrency(parseFloat(viagem.custo_total || 0));

  const statusPill = document.getElementById('detalhe-status');
  statusPill.textContent = viagem.status;
  statusPill.className = `status-pill ${statusClass(viagem.status)}`;

  renderResumo(viagem.resumo_categorias || []);
  aplicarFiltroCustos();
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
  if (id && viagemSelecionada && viagemSelecionada.id === Number(id)) {
    carregarDetalhes(id);
  }
}

function abrirModalCusto(dados = null) {
  if (!viagemSelecionada) {
    alert('Selecione uma viagem primeiro.');
    return;
  }
  document.getElementById('formCusto').reset();
  document.getElementById('custo_id').value = dados?.id || '';
  document.getElementById('custo_tipo').value = dados?.tipo || 'Transporte';
  document.getElementById('custo_forma_pagamento').value = dados?.forma_pagamento || '';
  document.getElementById('custo_descricao').value = dados?.descricao || '';
  document.getElementById('custo_data').value = dados?.data_gasto || '';
  document.getElementById('custo_valor').value = dados?.valor || '';
  document.getElementById('tituloModalCusto').textContent = dados ? 'Editar Custo' : 'Novo Custo';
  modalCusto.show();
}

async function salvarCusto() {
  if (!viagemSelecionada) {
    alert('Selecione uma viagem.');
    return;
  }
  const id = document.getElementById('custo_id').value;
  const payload = {
    tipo: document.getElementById('custo_tipo').value,
    descricao: document.getElementById('custo_descricao').value.trim(),
    data_gasto: document.getElementById('custo_data').value,
    valor: document.getElementById('custo_valor').value,
    forma_pagamento: document.getElementById('custo_forma_pagamento').value.trim() || null,
  };
  if (!payload.descricao || !payload.data_gasto || !payload.valor) {
    alert('Preencha todos os campos obrigatórios.');
    return;
  }
  const method = id ? 'PUT' : 'POST';
  const url = id ? `${apiViagens}/${viagemSelecionada.id}/custos/${id}` : `${apiViagens}/${viagemSelecionada.id}/custos`;
  const resp = await fetchJWT(url, { method, body: JSON.stringify(payload) });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    alert('Erro ao salvar custo: ' + (err.error || JSON.stringify(err)));
    return;
  }
  modalCusto.hide();
  carregarDetalhes(viagemSelecionada.id);
  reloadGrid();
}

async function excluirViagem() {
  if (!viagemSelecionada) return;
  if (!confirm('Tem certeza que deseja excluir esta viagem e todos os custos?')) return;
  const resp = await fetchJWT(`${apiViagens}/${viagemSelecionada.id}`, { method: 'DELETE' });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    alert('Erro ao excluir viagem: ' + (err.error || JSON.stringify(err)));
    return;
  }
  limparDetalhes();
  reloadGrid();
}

async function excluirCusto(id) {
  if (!viagemSelecionada) return;
  if (!confirm('Excluir este custo?')) return;
  const resp = await fetchJWT(`${apiViagens}/${viagemSelecionada.id}/custos/${id}`, { method: 'DELETE' });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    alert('Erro ao excluir custo: ' + (err.error || JSON.stringify(err)));
    return;
  }
  carregarDetalhes(viagemSelecionada.id);
  reloadGrid();
}

async function abrirModalAnexos(custoId) {
  anexoCustoId = custoId;
  document.querySelector('#tabela-anexos tbody').innerHTML = '<tr><td colspan="3" class="text-center text-muted">Carregando...</td></tr>';
  modalAnexos.show();
  const resp = await fetchJWT(`${apiViagens}/${viagemSelecionada.id}/custos/${custoId}/anexos`);
  if (!resp.ok) {
    document.querySelector('#tabela-anexos tbody').innerHTML = '<tr><td colspan="3" class="text-center text-danger">Erro ao carregar anexos</td></tr>';
    return;
  }
  const anexos = await resp.json();
  renderAnexos(anexos);
}

function renderAnexos(lista) {
  const corpo = document.querySelector('#tabela-anexos tbody');
  corpo.innerHTML = '';
  if (!lista.length) {
    corpo.innerHTML = '<tr><td colspan="3" class="text-center text-muted">Nenhum comprovante enviado.</td></tr>';
    return;
  }
  lista.forEach(anexo => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${anexo.original_name}</td>
      <td class="text-end">${(anexo.size_bytes / 1024).toFixed(1)} KB</td>
      <td class="text-end">
        <div class="btn-group btn-group-sm">
          <button class="btn btn-outline-secondary baixar-anexo" data-id="${anexo.id}"><i class="bi bi-box-arrow-down"></i></button>
          <button class="btn btn-outline-danger deletar-anexo" data-id="${anexo.id}"><i class="bi bi-trash"></i></button>
        </div>
      </td>`;
    corpo.appendChild(tr);
  });
}

async function uploadAnexos() {
  if (!anexoCustoId) return;
  const input = document.getElementById('inputAnexos');
  if (!input.files.length) {
    alert('Selecione ao menos um arquivo.');
    return;
  }
  const formData = new FormData();
  Array.from(input.files).forEach(file => formData.append('files', file));
  const resp = await fetchJWT(`${apiViagens}/${viagemSelecionada.id}/custos/${anexoCustoId}/anexos`, {
    method: 'POST',
    body: formData
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    alert('Erro ao enviar anexos: ' + (err.error || JSON.stringify(err)));
    return;
  }
  input.value = '';
  const anexos = await resp.json();
  renderAnexos(anexos);
  carregarDetalhes(viagemSelecionada.id);
}

async function removerAnexo(id) {
  if (!anexoCustoId) return;
  const resp = await fetchJWT(`${apiViagens}/${viagemSelecionada.id}/custos/${anexoCustoId}/anexos/${id}`, {
    method: 'DELETE'
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    alert('Erro ao excluir anexo: ' + (err.error || JSON.stringify(err)));
    return;
  }
  abrirModalAnexos(anexoCustoId);
}

async function baixarAnexo(id) {
  if (!anexoCustoId) return;
  const resp = await fetchJWT(`${apiViagens}/${viagemSelecionada.id}/custos/${anexoCustoId}/anexos/${id}`);
  if (!resp.ok) {
    alert('Não foi possível baixar o comprovante.');
    return;
  }
  const blob = await resp.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `comprovante_${id}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

async function exportarViagem(formato) {
  if (!viagemSelecionada) return;
  const resp = await fetchJWT(`${apiViagens}/${viagemSelecionada.id}/export?formato=${formato}`);
  if (!resp.ok) {
    alert('Não foi possível exportar a viagem.');
    return;
  }
  const blob = await resp.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `viagem_${viagemSelecionada.id}.${formato}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
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
  document.getElementById('btn-editar-viagem').addEventListener('click', () => {
    if (viagemSelecionada) abrirModalViagem(viagemSelecionada);
  });
  document.getElementById('btn-excluir-viagem').addEventListener('click', excluirViagem);

  document.getElementById('btn-adicionar-custo').addEventListener('click', () => abrirModalCusto());
  document.getElementById('btn-salvar-custo').addEventListener('click', salvarCusto);

  document.getElementById('grid-viagens').addEventListener('click', (event) => {
    const row = event.target.closest('.gridjs-tr');
    if (row && row.dataset.id) {
      carregarDetalhes(row.dataset.id);
    }
  });

  document.querySelector('#tabela-custos tbody').addEventListener('click', (event) => {
    const id = event.target.closest('button')?.dataset.id;
    if (!id) return;
    if (event.target.closest('.editar-custo')) {
      const custo = custosAtuais.find(c => String(c.id) === String(id));
      abrirModalCusto(custo);
    } else if (event.target.closest('.deletar-custo')) {
      excluirCusto(id);
    } else if (event.target.closest('.anexos-custo')) {
      abrirModalAnexos(id);
    }
  });

  document.querySelectorAll('#detalhes-conteudo .dropdown-menu .dropdown-item').forEach(btn => {
    btn.addEventListener('click', (ev) => {
      filtroCustoAtual = ev.currentTarget.dataset.filter || '';
      aplicarFiltroCustos();
    });
  });

  document.getElementById('btn-upload-anexos').addEventListener('click', uploadAnexos);
  document.querySelector('#tabela-anexos').addEventListener('click', (event) => {
    if (event.target.closest('.deletar-anexo')) {
      const id = event.target.closest('button').dataset.id;
      removerAnexo(id);
    } else if (event.target.closest('.baixar-anexo')) {
      const id = event.target.closest('button').dataset.id;
      baixarAnexo(id);
    }
  });

  document.querySelectorAll('.export-option').forEach(option => {
    option.addEventListener('click', (event) => {
      const formato = event.currentTarget.dataset.format;
      exportarViagem(formato);
    });
  });
}

window.addEventListener('DOMContentLoaded', () => {
  criarGrid();
  setupEventos();
});
