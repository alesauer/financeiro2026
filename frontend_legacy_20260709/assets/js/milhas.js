// Milhas - Grid e cadastro
const apiMilhas = 'http://127.0.0.1:5000/api/milhas';
let gridMilhas = null;

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

function createGridMilhas(){
  gridMilhas = new gridjs.Grid({
    columns: [
      { id: 'id', name: 'ID' },
      { id: 'programa', name: 'Programa' },
      { id: 'tipo', name: 'Tipo', formatter: (v) => v === 'entrada' ? 'Entrada' : 'Saída' },
      { id: 'quantidade', name: 'Qtd' },
      { id: 'origem', name: 'Origem' },
      { id: 'data_movimentacao', name: 'Data Mov.' },
      { id: 'data_expiracao', name: 'Expira' },
      { id: 'descricao', name: 'Descrição' },
      { id: 'acoes', name: 'Ações', formatter: (_, row) => {
          const id = row.cells[0]?.data;
          const editBtn = `<button class="btn btn-sm btn-outline-primary me-2 edit-milha" data-id="${id}">Editar</button>`;
          const delBtn = `<button class="btn btn-sm btn-outline-danger delete-milha" data-id="${id}">Excluir</button>`;
          return gridjs.html(`${editBtn}${delBtn}`);
        }
      }
    ],
    pagination: { enabled: true, limit: 10 },
    search: true,
    sort: true,
    data: async () => {
      const resp = await fetchJWT(`${apiMilhas}?page=1&per_page=10`);
      if (!resp.ok) throw new Error('Erro ao listar milhas');
      const json = await resp.json();
      return json.items.map(item => ({
        id: item.id,
        programa: item.programa,
        tipo: item.tipo,
        quantidade: item.quantidade,
        origem: item.origem || '-',
        data_movimentacao: item.data_movimentacao || '-',
        data_expiracao: item.data_expiracao || '-',
        descricao: item.descricao || '-',
      }));
    }
  });
  gridMilhas.render(document.getElementById('grid-milhas'));
}

function reloadGridMilhas(){
  if (!gridMilhas) { createGridMilhas(); return; }
  gridMilhas.updateConfig({
    data: async () => {
      const resp = await fetchJWT(`${apiMilhas}?page=1&per_page=10`);
      if (!resp.ok) throw new Error('Erro ao listar milhas');
      const json = await resp.json();
      return json.items.map(item => ({
        id: item.id,
        programa: item.programa,
        tipo: item.tipo,
        quantidade: item.quantidade,
        origem: item.origem || '-',
        data_movimentacao: item.data_movimentacao || '-',
        data_expiracao: item.data_expiracao || '-',
        descricao: item.descricao || '-',
      }));
    }
  }).forceRender();
}

function limparFormulario(){
  document.getElementById('milha_id').value = '';
  document.getElementById('programa').value = '';
  document.getElementById('tipo').value = 'entrada';
  document.getElementById('quantidade').value = '';
  document.getElementById('origem').value = '';
  document.getElementById('data_movimentacao').value = '';
  document.getElementById('data_expiracao').value = '';
  document.getElementById('descricao').value = '';
}

async function salvarMilha(){
  const id = document.getElementById('milha_id').value;
  const payload = {
    programa: document.getElementById('programa').value.trim(),
    tipo: document.getElementById('tipo').value,
    quantidade: parseInt(document.getElementById('quantidade').value, 10),
    origem: document.getElementById('origem').value.trim() || null,
    data_movimentacao: document.getElementById('data_movimentacao').value || null,
    data_expiracao: document.getElementById('data_expiracao').value || null,
    descricao: document.getElementById('descricao').value.trim() || null,
  };

  if (!payload.programa || !payload.tipo || !payload.quantidade || payload.quantidade <= 0) {
    alert('Preencha Programa, Tipo e Quantidade (>0).');
    return;
  }

  const method = id ? 'PUT' : 'POST';
  const url = id ? `${apiMilhas}/${id}` : `${apiMilhas}/`;
  const resp = await fetchJWT(url, { method, body: JSON.stringify(payload) });
  if (!resp.ok) {
    const err = await resp.json().catch(()=>({error:'Erro'}));
    alert('Erro ao salvar: ' + (err.error || JSON.stringify(err)));
    return;
  }

  // Atualiza grid e fecha modal
  reloadGridMilhas();
  const modalEl = document.getElementById('modalMilha');
  const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
  modal.hide();
  limparFormulario();
}

async function carregarMilhaParaEdicao(id){
  const resp = await fetchJWT(`${apiMilhas}/${id}`);
  if (!resp.ok) { alert('Erro ao carregar milha'); return; }
  const m = await resp.json();
  document.getElementById('milha_id').value = m.id;
  document.getElementById('programa').value = m.programa || '';
  document.getElementById('tipo').value = m.tipo || 'entrada';
  document.getElementById('quantidade').value = m.quantidade || '';
  document.getElementById('origem').value = m.origem || '';
  document.getElementById('data_movimentacao').value = m.data_movimentacao || '';
  document.getElementById('data_expiracao').value = m.data_expiracao || '';
  document.getElementById('descricao').value = m.descricao || '';
  document.getElementById('tituloModalMilha').textContent = 'Editar Movimentação';
  new bootstrap.Modal(document.getElementById('modalMilha')).show();
}

function setupEventsMilhas(){
  const btnNovo = document.getElementById('btn-nova-milha');
  const modalEl = document.getElementById('modalMilha');
  const modal = new bootstrap.Modal(modalEl);
  btnNovo.addEventListener('click', function(){
    document.getElementById('tituloModalMilha').textContent = 'Nova Movimentação';
    limparFormulario();
    modal.show();
  });
  document.getElementById('btn-salvar-milha').addEventListener('click', salvarMilha);

  // Ações na grid
  document.getElementById('grid-milhas').addEventListener('click', async function(e){
    const editBtn = e.target.closest('.edit-milha');
    if (editBtn) {
      const id = editBtn.getAttribute('data-id');
      if (id) await carregarMilhaParaEdicao(id);
      return;
    }
    const delBtn = e.target.closest('.delete-milha');
    if (delBtn) {
      const id = delBtn.getAttribute('data-id');
      if (!id) return;
      if (!confirm('Deseja excluir esta movimentação de milhas?')) return;
      const resp = await fetchJWT(`${apiMilhas}/${id}`, { method: 'DELETE' });
      if (!resp.ok) {
        const err = await resp.json().catch(()=>({error:'Erro'}));
        alert('Erro ao excluir: ' + (err.error || JSON.stringify(err)));
        return;
      }
      reloadGridMilhas();
    }
  });
}

document.addEventListener('DOMContentLoaded', function(){
  createGridMilhas();
  setupEventsMilhas();
});
