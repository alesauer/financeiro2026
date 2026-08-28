// Documentos - Grid e cadastro
const apiBase = 'http://127.0.0.1:5000/api/documentos';
const apiTipos = apiBase + '/tipos';
let grid = null;

function fetchJWT(url, options = {}) {
  const token = localStorage.getItem('access_token');
  if (!token) {
    alert('Sessão expirada. Faça login novamente.');
    window.location.href = 'login.html';
    return Promise.reject(new Error('Token ausente'));
  }
  options.headers = options.headers || {};
  const isFormData = options.body instanceof FormData;
  // Define Content-Type somente para payloads JSON; para FormData o browser define automaticamente
  if (!isFormData && options.body && !options.headers['Content-Type']) {
    options.headers['Content-Type'] = 'application/json';
  }
  options.headers['Authorization'] = 'Bearer ' + token;
  return fetch(url, options);
}

function createGrid(){
  grid = new gridjs.Grid({
    columns: [
      { id: 'id', name: 'ID' },
      { id: 'tipo_documento_nome', name: 'Tipo Documento' },
      { id: 'nome', name: 'Nome' },
      { id: 'registro', name: 'Registro' },
      { id: 'outras_informacoes', name: 'Outras informações' },
      { id: 'acoes', name: 'Ações', formatter: (_, row) => {
          const id = row.cells[0]?.data; // primeira coluna é o ID
          const verBtn = `<button class=\"btn btn-sm btn-primary ver-doc\" data-id=\"${id}\">Ver Documento</button>`;
          const delBtn = `<button class=\"btn btn-sm btn-outline-danger ms-1 delete-doc\" data-id=\"${id}\">Excluir</button>`;
          return gridjs.html(`<div class=\"btn-group\" role=\"group\" aria-label=\"Ações\">${verBtn}${delBtn}</div>`);
        }
      }
    ],
    pagination: { enabled: true, limit: 10 },
    search: true,
    sort: true,
    data: async () => {
      const page = 1;
      const resp = await fetchJWT(`${apiBase}?page=${page}&per_page=10`);
      if (!resp.ok) throw new Error('Erro ao listar documentos');
      const json = await resp.json();
      return json.items.map(item => ({
        id: item.id,
        tipo_documento_nome: item.tipo_documento_nome || '-',
        nome: item.nome,
        registro: item.registro || '-',
        outras_informacoes: item.outras_informacoes || '-',
      }));
    }
  });
  grid.render(document.getElementById('grid'));
  // Esconde coluna de ID via CSS para manter dados acessíveis no formatter
  const cssId = 'hide-docs-id-column-style';
  if (!document.getElementById(cssId)) {
    const style = document.createElement('style');
    style.id = cssId;
    style.innerHTML = `#grid .gridjs-table th:nth-child(1), #grid .gridjs-table td:nth-child(1) { display: none; }`;
    document.head.appendChild(style);
  }
}

function reloadGrid(){
  if (!grid) {
    createGrid();
    return;
  }
  grid.updateConfig({
    data: async () => {
      const page = 1;
      const resp = await fetchJWT(`${apiBase}?page=${page}&per_page=10`);
      if (!resp.ok) throw new Error('Erro ao listar documentos');
      const json = await resp.json();
      return json.items.map(item => ({
        id: item.id,
        tipo_documento_nome: item.tipo_documento_nome || '-',
        nome: item.nome,
        registro: item.registro || '-',
        outras_informacoes: item.outras_informacoes || '-',
      }));
    }
  }).forceRender();
}

async function carregarTipos(){
  const resp = await fetchJWT(apiTipos);
  if (!resp.ok) return [];
  const tipos = await resp.json();
  const sel = document.getElementById('tipo_documento_id');
  sel.innerHTML = '';
  tipos.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = t.nome;
    sel.appendChild(opt);
  });
}

async function salvarDocumento(){
  const tipo_documento_id = parseInt(document.getElementById('tipo_documento_id').value, 10);
  const nome = document.getElementById('nome').value.trim();
  const registro = document.getElementById('registro').value.trim();
  const outras_informacoes = document.getElementById('outras_informacoes').value.trim();
  const filesEl = document.getElementById('files');
  const files = Array.from(filesEl.files || []);
  if (!tipo_documento_id || !nome) {
    alert('Preencha Tipo Documento e Nome');
    return;
  }
  if (files.length > 5) {
    alert('Você pode anexar no máximo 5 arquivos.');
    return;
  }
  // 1) cria documento
  const payload = { tipo_documento_id, nome, registro, outras_informacoes };
  const resp = await fetchJWT(apiBase + '/', { method: 'POST', body: JSON.stringify(payload) });
  if (!resp.ok) {
    const err = await resp.json().catch(()=>({error:'Erro'}));
    alert('Erro ao criar documento: ' + (err.error || JSON.stringify(err)));
    return;
  }
  const doc = await resp.json();
  // Atualiza a grid imediatamente após criar o documento (antes do upload)
  try { reloadGrid(); } catch(e){}
  // 2) upload anexos se houver
  if (files.length > 0) {
    const form = new FormData();
    files.forEach(f => form.append('files', f));
    const up = await fetchJWT(`${apiBase}/${doc.id}/anexos`, { method: 'POST', body: form });
    if (!up.ok) {
      const err = await up.json().catch(()=>({error:'Erro'}));
      alert('Erro ao enviar anexos: ' + (err.error || JSON.stringify(err)));
      return;
    }
    // Atualiza novamente após concluir upload
    try { reloadGrid(); } catch(e){}
  }
  // fechar modal e recarregar grid
  const modalEl = document.getElementById('modalDocumento');
  const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
  modal.hide();
  document.getElementById('formDocumento').reset();
  // Garantia final: recarregar grid sem refresh
  reloadGrid();
}

function setupEvents(){
  const btnNovo = document.getElementById('btn-novo-documento');
  const modalEl = document.getElementById('modalDocumento');
  const modal = new bootstrap.Modal(modalEl);
  btnNovo.addEventListener('click', async function(){
    await carregarTipos();
    modal.show();
  });
  document.getElementById('btn-salvar-documento').addEventListener('click', salvarDocumento);

  // Ver Documento: abrir primeira mídia
  document.getElementById('grid').addEventListener('click', async function(e){
    const btn = e.target.closest('.ver-doc');
    if (!btn) return;
    const id = btn.getAttribute('data-id');
    if (!id) return;
    const resp = await fetchJWT(`${apiBase}/${id}`);
    if (!resp.ok) return alert('Erro ao obter documento');
    const doc = await resp.json();
    const anexos = doc.anexos || [];
    if (anexos.length === 0) {
      alert('Documento sem anexos.');
      return;
    }
    const primeiro = anexos[0];
    // Buscar o arquivo com JWT e abrir via Object URL (evita 401 sem header)
    const fileResp = await fetchJWT(`${apiBase}/${id}/anexos/${primeiro.id}`, { method: 'GET' });
    if (!fileResp.ok) {
      alert('Erro ao abrir anexo.');
      return;
    }
    const blob = await fileResp.blob();
    const objectUrl = URL.createObjectURL(blob);
    const newWin = window.open(objectUrl, '_blank');
    if (!newWin) {
      // Caso popup seja bloqueado, abrir no mesmo tab
      window.location.href = objectUrl;
    }
  });

  // Excluir documento
  document.getElementById('grid').addEventListener('click', async function(e){
    const btn = e.target.closest('.delete-doc');
    if (!btn) return;
    const id = btn.getAttribute('data-id');
    if (!id) return;
    if (!confirm('Deseja excluir este documento? Esta ação não pode ser desfeita.')) return;
    try {
      const resp = await fetchJWT(`${apiBase}/${id}`, { method: 'DELETE' });
      if (!resp.ok) {
        const err = await resp.json().catch(()=>({error:'Erro'}));
        alert('Erro ao excluir: ' + (err.error || JSON.stringify(err)));
        return;
      }
      // Recarregar grid sem refresh
      reloadGrid();
    } catch (error) {
      alert('Erro de rede ao excluir.');
    }
  });
}

document.addEventListener('DOMContentLoaded', function(){
  createGrid();
  setupEvents();
});
