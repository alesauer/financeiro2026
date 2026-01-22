const apiViagens = 'http://127.0.0.1:5000/api/viagens';
let gridViagens = null;
let filtros = { termo: '', status: '', ordenar: 'data_inicio', ordem: 'asc' };
let viagemSelecionada = null;
let custosAtuais = [];
let filtroCustoAtual = '';
let ordenacaoCustos = { campo: 'data', direcao: 'asc' };
let anexoCustoId = null;
let ultimaPaginacao = { total: 0 };
let viagemDestinoNovoCusto = null;
let linhaViagemSelecionada = null;
const modalDetalhes = new bootstrap.Modal('#modalDetalhesViagem');

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

function escapeAttr(value) {
  if (value === undefined || value === null) return '';
  return String(value).replace(/"/g, '&quot;');
}

function escapeHtml(value) {
  if (value === undefined || value === null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatDateTime(dateTimeStr) {
  if (!dateTimeStr) return '-';
  const data = new Date(dateTimeStr);
  if (Number.isNaN(data.getTime())) return dateTimeStr;
  return data.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function destacarLinhaSelecionada(id) {
  linhaViagemSelecionada = id ? Number(id) : null;
  document.querySelectorAll('#grid-viagens .gridjs-tr.viagem-selecionada').forEach(tr => tr.classList.remove('viagem-selecionada'));
  if (!linhaViagemSelecionada) return;
  const alvo = document.querySelector(`#grid-viagens .gridjs-tr[data-id="${linhaViagemSelecionada}"]`);
  if (alvo) {
    alvo.classList.add('viagem-selecionada');
  }
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
    data_inicio: item.data_inicio,
    data_termino: item.data_termino,
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
        formatter: (cell) => gridjs.html(`
          <div class="fw-semibold text-dark">${cell}</div>
        `)
      },
      { id: 'destino', name: 'Destino', formatter: cell => gridjs.html(`<span class="text-muted small">${cell}</span>`) },
      { id: 'data_inicio_fmt', name: 'Início' },
      { id: 'data_termino_fmt', name: 'Término' },
      {
        id: 'status',
        name: 'Status',
        formatter: cell => gridjs.html(`<span class="status-pill ${statusClass(cell)}">${cell}</span>`)
      },
      { id: 'custo_total', name: 'Custo total', formatter: cell => gridjs.html(`<strong>${cell}</strong>`), sort: true },
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
          const titulo = escapeAttr(row.cells[1].data);
          return gridjs.html(`
            <div class="d-flex justify-content-end gap-2 pe-1">
              <div class="btn-group btn-group-sm" role="group">
              <button type="button" class="btn btn-outline-primary" data-action="add-custo" data-viagem-id="${viagemId}" data-viagem-nome="${titulo}" title="Adicionar custo">
                <i class="bi bi-plus-lg"></i>
              </button>
              <button type="button" class="btn btn-outline-danger" data-action="excluir-viagem" data-viagem-id="${viagemId}" data-viagem-nome="${titulo}" title="Excluir viagem">
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
  setTimeout(() => destacarLinhaSelecionada(linhaViagemSelecionada), 0);
}

function reloadGrid() {
  if (!gridViagens) {
    criarGrid();
    return;
  }
  gridViagens.updateConfig({ data: () => carregarViagens() }).forceRender();
  setTimeout(() => destacarLinhaSelecionada(linhaViagemSelecionada), 0);
}

function limparDetalhes() {
  viagemSelecionada = null;
  custosAtuais = [];
  filtroCustoAtual = '';
  destacarLinhaSelecionada(null);
  const btnExportar = document.getElementById('btn-exportar');
  if (btnExportar) btnExportar.setAttribute('disabled', 'disabled');
  const filtroTipo = document.getElementById('modalFiltroTipoCustos');
  if (filtroTipo) filtroTipo.value = '';
}

function renderResumo(resumo) {
  const container = document.getElementById('modalListaResumo');
  const subtitle = document.getElementById('modalResumoSubtitulo');
  container.innerHTML = '';
  const totalCustos = custosAtuais.length;
  if (!resumo || !resumo.length) {
    subtitle.textContent = totalCustos
      ? `${totalCustos} custo${totalCustos === 1 ? '' : 's'}`
      : 'sem custos';
    container.innerHTML = '<div class="text-muted small">Nenhum custo registrado ainda.</div>';
    return;
  }
  subtitle.textContent = `${resumo.length} categoria${resumo.length === 1 ? '' : 's'} • ${totalCustos} custo${totalCustos === 1 ? '' : 's'}`;
  resumo.forEach(item => {
    const col = document.createElement('div');
    col.className = 'col-md-4';
    col.innerHTML = `
      <div class="summary-item h-100">
        <div class="fw-semibold">${item.tipo}</div>
        <small class="text-muted">${item.percentual}% do total</small>
        <div class="fw-bold">${formatCurrency(item.total)}</div>
      </div>
    `;
    container.appendChild(col);
  });
}

function renderCustos(lista) {
  const corpo = document.querySelector('#modalTabelaCustos tbody');
  corpo.innerHTML = '';
  if (!lista.length) {
    corpo.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Nenhum custo cadastrado</td></tr>';
    return;
  }
  lista.forEach(item => {
    const tr = document.createElement('tr');
    const nome = escapeHtml(item.nome || '-');
    const descricao = escapeHtml(item.descricao || '');
    const observacao = escapeHtml(item.observacao || '');
    const link = escapeAttr(item.link || '');
    tr.innerHTML = `
      <td>${formatDate(item.data_gasto)}</td>
      <td>${item.tipo}</td>
      <td>
        <div class="fw-semibold">${nome}</div>
        <div class="text-muted small mb-1">${descricao}</div>
        ${observacao ? `<div class="small text-muted">${observacao}</div>` : ''}
        ${link ? `<a href="${link}" target="_blank" rel="noopener" class="small">Ver link</a>` : ''}
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
  dados = ordenarCustos(dados);
  renderCustos(dados);
}

function ordenarCustos(lista) {
  const dir = ordenacaoCustos.direcao === 'asc' ? 1 : -1;
  return lista.sort((a, b) => {
    if (ordenacaoCustos.campo === 'valor') {
      const valorA = typeof a.valor === 'string' ? parseFloat(a.valor) : a.valor;
      const valorB = typeof b.valor === 'string' ? parseFloat(b.valor) : b.valor;
      return ((Number.isNaN(valorA) ? 0 : valorA) - (Number.isNaN(valorB) ? 0 : valorB)) * dir;
    }
    const dataA = new Date(a.data_gasto);
    const dataB = new Date(b.data_gasto);
    const timeA = Number.isNaN(dataA.getTime()) ? 0 : dataA.getTime();
    const timeB = Number.isNaN(dataB.getTime()) ? 0 : dataB.getTime();
    return (timeA - timeB) * dir;
  });
}

function atualizarIndicadorOrdemCustos() {
  const btn = document.getElementById('modalBtnToggleOrdemCustos');
  if (!btn) return;
  const iconClass = ordenacaoCustos.direcao === 'asc' ? 'bi-arrow-up' : 'bi-arrow-down';
  btn.innerHTML = `<i class="bi ${iconClass}"></i>`;
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
  destacarLinhaSelecionada(viagem.id);
  filtroCustoAtual = '';
  ordenacaoCustos = { campo: 'data', direcao: 'asc' };
  const selectOrdenar = document.getElementById('modalSelectOrdenarCustos');
  if (selectOrdenar) selectOrdenar.value = 'data';
  const filtroTipo = document.getElementById('modalFiltroTipoCustos');
  if (filtroTipo) filtroTipo.value = '';
  atualizarIndicadorOrdemCustos();
  const btnExportar = document.getElementById('btn-exportar');
  if (btnExportar) btnExportar.removeAttribute('disabled');

  document.getElementById('modalDetalhesTitulo').textContent = viagem.titulo;
  document.getElementById('modalDetalhesDestino').textContent = viagem.destino;
  document.getElementById('modalDetalhesPeriodo').textContent = `${formatDate(viagem.data_inicio)} a ${formatDate(viagem.data_termino)}`;
  document.getElementById('modalDetalhesTotal').textContent = formatCurrency(parseFloat(viagem.custo_total || 0));
  document.getElementById('modalDetalhesCustosCount').textContent = custosAtuais.length;
  document.getElementById('modalDetalhesCriado').textContent = formatDateTime(viagem.created_at);
  document.getElementById('modalDetalhesAtualizado').textContent = formatDateTime(viagem.updated_at);
  const statusPill = document.getElementById('modalDetalhesStatus');
  statusPill.textContent = viagem.status;
  statusPill.className = `status-pill ${statusClass(viagem.status)}`;
  const descricaoEl = document.getElementById('modalDetalhesDescricao');
  if (descricaoEl) {
    const descricao = (viagem.descricao || '').trim();
    descricaoEl.textContent = descricao || 'Nenhuma observação adicionada ainda.';
    descricaoEl.classList.toggle('text-muted', descricao.length === 0);
  }

  renderResumo(viagem.resumo_categorias || []);
  aplicarFiltroCustos();
  modalDetalhes.show();
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

function abrirModalCusto(dados = null, viagemId = null) {
  const alvo = viagemId || viagemSelecionada?.id;
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
  const viagemId = viagemDestinoNovoCusto || viagemSelecionada?.id;
  if (!viagemId) {
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
  if (!payload.data_gasto) delete payload.data_gasto;
  if (!payload.tipo) delete payload.tipo;
  if (!payload.forma_pagamento) delete payload.forma_pagamento;
  if (!payload.observacao) delete payload.observacao;
  if (!payload.link) delete payload.link;
  const valorNum = parseFloat(payload.valor);
  if (Number.isNaN(valorNum) || valorNum <= 0) {
    alert('Informe um valor válido.');
    return;
  }
  const method = id ? 'PUT' : 'POST';
  const url = id ? `${apiViagens}/${viagemId}/custos/${id}` : `${apiViagens}/${viagemId}/custos`;
  const resp = await fetchJWT(url, { method, body: JSON.stringify(payload) });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    alert('Erro ao salvar custo: ' + (err.error || JSON.stringify(err)));
    return;
  }
  modalCusto.hide();
  if (viagemSelecionada && viagemSelecionada.id === Number(viagemId)) {
    carregarDetalhes(viagemSelecionada.id);
  }
  reloadGrid();
  viagemDestinoNovoCusto = null;
}

async function excluirViagem(viagemId = null, viagemNome = '') {
  const alvoId = Number(viagemId || viagemSelecionada?.id);
  if (!alvoId) return;
  const nomeAlvo = viagemNome || (viagemSelecionada && viagemSelecionada.id === alvoId ? viagemSelecionada.titulo : '');
  const mensagem = nomeAlvo
    ? `Tem certeza que deseja excluir a viagem "${nomeAlvo}" e todos os custos?`
    : 'Tem certeza que deseja excluir esta viagem e todos os custos?';
  if (!confirm(mensagem)) return;
  const resp = await fetchJWT(`${apiViagens}/${alvoId}`, { method: 'DELETE' });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    alert('Erro ao excluir viagem: ' + (err.error || JSON.stringify(err)));
    return;
  }
  if (viagemSelecionada && viagemSelecionada.id === alvoId) {
    limparDetalhes();
    modalDetalhes.hide();
  }
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
  document.getElementById('modalBtnEditar').addEventListener('click', () => {
    if (viagemSelecionada) abrirModalViagem(viagemSelecionada);
  });
  document.getElementById('modalBtnExcluir').addEventListener('click', () => excluirViagem());
  document.getElementById('modalBtnAdicionarCusto').addEventListener('click', () => abrirModalCusto());
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
      event.stopPropagation();
      carregarDetalhes(detalhesBtn.dataset.id);
      return;
    }
    const row = event.target.closest('.gridjs-tr');
    if (row && row.dataset.id) {
      carregarDetalhes(row.dataset.id);
    }
  });

  document.querySelector('#modalTabelaCustos tbody').addEventListener('click', (event) => {
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

  const selectOrdenarCustos = document.getElementById('modalSelectOrdenarCustos');
  if (selectOrdenarCustos) {
    selectOrdenarCustos.addEventListener('change', (event) => {
      ordenacaoCustos.campo = event.target.value;
      aplicarFiltroCustos();
    });
  }

  const btnToggleOrdemCustos = document.getElementById('modalBtnToggleOrdemCustos');
  if (btnToggleOrdemCustos) {
    btnToggleOrdemCustos.addEventListener('click', () => {
      ordenacaoCustos.direcao = ordenacaoCustos.direcao === 'asc' ? 'desc' : 'asc';
      atualizarIndicadorOrdemCustos();
      aplicarFiltroCustos();
    });
  }

  const filtroTipoCustos = document.getElementById('modalFiltroTipoCustos');
  if (filtroTipoCustos) {
    filtroTipoCustos.addEventListener('change', (event) => {
      filtroCustoAtual = event.target.value || '';
      aplicarFiltroCustos();
    });
  }

  atualizarIndicadorOrdemCustos();
}

window.addEventListener('DOMContentLoaded', () => {
  criarGrid();
  setupEventos();
});
