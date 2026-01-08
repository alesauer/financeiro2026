// Função para abrir modal de edição (definida globalmente)
window.abrirModalEdicao = function(dados) {
  console.log('🔵 abrirModalEdicao CHAMADA com dados:', dados);
  var old = document.getElementById('modal-edicao-transacao');
  if (old) {
    console.log('⚠️ Modal antigo encontrado, removendo...');
    old.remove();
  }

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
    { nome: 'tipo', label: 'Tipo', tipo: 'select', opcoes: ['Receita','Despesa','Investimento'] },
    { nome: 'categoria_id', label: 'Categoria', tipo: 'select-categoria' },
    { nome: 'descricao', label: 'Descrição', tipo: 'text' },
    { nome: 'valor', label: 'Valor (R$)', tipo: 'number', step: '0.01' },
    { nome: 'data_transacao', label: 'Data', tipo: 'date' },
    { nome: 'forma_pagamento', label: 'Forma de Pagamento', tipo: 'select', opcoes: ['Dinheiro','Cartão de Crédito','Cartão de Débito','Pix','Boleto','Transferência'] },
    { nome: 'status', label: 'Status', tipo: 'select', opcoes: ['Pago','Pendente'] },
    { nome: 'recorrente', label: 'Recorrente', tipo: 'checkbox' },
    { nome: 'frequencia', label: 'Frequência', tipo: 'select-frequencia', opcoes: ['Mensal'] },
    { nome: 'data_fim', label: 'Data Fim', tipo: 'date' }
  ];

  let html = `<form id="form-edicao-transacao" style="background:#fff;padding:24px;border-radius:10px;min-width:320px;max-width:90vw;box-shadow:0 2px 16px #0002;">
    <h4 style="margin-bottom:16px;"><i class="bi bi-${dados ? 'pencil-square' : 'plus-circle'}" style="margin-right:8px;"></i>${dados ? 'Editar' : 'Nova'} Transação</h4>`;
  let categorias = [];
  let tipoSelecionado = dados && dados.tipo ? dados.tipo : 'Receita';

  // Busca categorias do tipo informado e renderiza campos SEMPRE que abrir o modal
  function buscarECampos(tipoCat) {
  fetchJWT(`http://127.0.0.1:5000/api/categorias?tipo=${encodeURIComponent(tipoCat)}`)
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

  // Sempre buscar categorias ao abrir o modal, inclusive para Nova Transação
  setTimeout(() => buscarECampos(tipoSelecionado), 0);

  function renderCampos() {
    let camposHtml = '';
    campos.forEach(c => {
      // Recorrente: checkbox
      if (c.tipo === 'checkbox') {
        const checked = dados && dados.recorrente ? 'checked' : '';
        camposHtml += `<div style="margin-bottom:12px;"><label style="font-weight:600;"><input type="checkbox" name="recorrente" ${checked}/> Recorrente</label></div>`;
        return;
      }
      // Frequência: só aparece se recorrente marcado
      if (c.tipo === 'select-frequencia') {
        camposHtml += `<div style="margin-bottom:12px;display:none;" id="div-frequencia"><label style="font-weight:600;color:#4a5568;margin-bottom:6px;display:block;">${c.label}</label>`;
        camposHtml += `<select name="frequencia" style="width:100%;padding:10px;border:1px solid #e0e0e0;border-radius:8px;transition:all 0.3s ease;" onfocus="this.style.borderColor='#1abc9c';this.style.boxShadow='0 0 0 3px rgba(26,188,156,0.1)'" onblur="this.style.borderColor='#e0e0e0';this.style.boxShadow='none'">`;
        c.opcoes.forEach(op => {
          let sel = dados && dados.frequencia === op ? 'selected' : '';
          camposHtml += `<option value="${op}" ${sel}>${op}</option>`;
        });
        camposHtml += `</select></div>`;
        return;
      }
      // Data Fim: só aparece se recorrente marcado
      if (c.nome === 'data_fim') {
        let val = dados && dados.data_fim ? dados.data_fim : '';
        if (val && val.length >= 10) val = val.slice(0,10);
        camposHtml += `<div style="margin-bottom:12px;display:none;" id="div-data-fim"><label style="font-weight:600;color:#4a5568;margin-bottom:6px;display:block;">${c.label}</label>`;
        camposHtml += `<input type="date" name="data_fim" value="${val||''}" style="width:100%;padding:10px;border:1px solid #e0e0e0;border-radius:8px;transition:all 0.3s ease;" onfocus="this.style.borderColor='#1abc9c';this.style.boxShadow='0 0 0 3px rgba(26,188,156,0.1)'" onblur="this.style.borderColor='#e0e0e0';this.style.boxShadow='none'" /></div>`;
        return;
      }
      // ...restante igual
      if (c.tipo === 'select') {
        camposHtml += `<div style="margin-bottom:12px;"><label style="font-weight:600;color:#4a5568;margin-bottom:6px;display:block;">${c.label}</label>`;
        camposHtml += `<select name="${c.nome}" style="width:100%;padding:10px;border:1px solid #e0e0e0;border-radius:8px;transition:all 0.3s ease;" onfocus="this.style.borderColor='#1abc9c';this.style.boxShadow='0 0 0 3px rgba(26,188,156,0.1)'" onblur="this.style.borderColor='#e0e0e0';this.style.boxShadow='none'">`;
        c.opcoes.forEach(op => {
          let sel = '';
          if (c.nome === 'tipo' && op === tipoSelecionado) sel = 'selected';
          else if (dados && dados[c.nome] === op) sel = 'selected';
          camposHtml += `<option value="${op}" ${sel}>${op}</option>`;
        });
        camposHtml += `</select></div>`;
      } else if (c.tipo === 'select-categoria') {
        camposHtml += `<div style="margin-bottom:12px;"><label style="font-weight:600;color:#4a5568;margin-bottom:6px;display:block;">${c.label}</label>`;
        camposHtml += `<select name="categoria_id" style="width:100%;padding:10px;border:1px solid #e0e0e0;border-radius:8px;transition:all 0.3s ease;" onfocus="this.style.borderColor='#1abc9c';this.style.boxShadow='0 0 0 3px rgba(26,188,156,0.1)'" onblur="this.style.borderColor='#e0e0e0';this.style.boxShadow='none'">`;
        categorias.forEach(cat => {
          const sel = (dados && dados.categoria_id == cat.id) ? 'selected' : '';
          camposHtml += `<option value="${cat.id}" ${sel}>${cat.nome}</option>`;
        });
        camposHtml += `</select></div>`;
      } else if (c.tipo === 'date') {
        let val = dados && dados[c.nome] ? dados[c.nome] : '';
        if (val && val.length >= 10) val = val.slice(0,10);
        camposHtml += `<div style="margin-bottom:12px;"><label style="font-weight:600;color:#4a5568;margin-bottom:6px;display:block;">${c.label}</label>`;
        camposHtml += `<input type="date" name="${c.nome}" value="${val||''}" style="width:100%;padding:10px;border:1px solid #e0e0e0;border-radius:8px;transition:all 0.3s ease;" onfocus="this.style.borderColor='#1abc9c';this.style.boxShadow='0 0 0 3px rgba(26,188,156,0.1)'" onblur="this.style.borderColor='#e0e0e0';this.style.boxShadow='none'" /></div>`;
      } else {
        camposHtml += `<div style="margin-bottom:12px;"><label style="font-weight:600;color:#4a5568;margin-bottom:6px;display:block;">${c.label}</label>`;
        camposHtml += `<input type="${c.tipo}" name="${c.nome}" value="${dados ? (dados[c.nome]||'') : ''}" style="width:100%;padding:10px;border:1px solid #e0e0e0;border-radius:8px;transition:all 0.3s ease;" step="${c.step||''}" onfocus="this.style.borderColor='#1abc9c';this.style.boxShadow='0 0 0 3px rgba(26,188,156,0.1)'" onblur="this.style.borderColor='#e0e0e0';this.style.boxShadow='none'" /></div>`;
      }
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
    console.log('🟢 adicionarListeners CHAMADA');
    console.log('🟢 Formulário existe?', !!document.getElementById('form-edicao-transacao'));
    
    document.getElementById('btn-cancelar-edicao').onclick = () => {
      modal.remove();
    };
    // Exibir/ocultar campos de recorrência assim que renderiza os campos
    const recorrenteCheckbox = document.querySelector('input[name="recorrente"]');
    const divFrequencia = document.getElementById('div-frequencia');
    const divDataFim = document.getElementById('div-data-fim');
    function toggleRecorrenteFields() {
      if (recorrenteCheckbox && recorrenteCheckbox.checked) {
        if (divFrequencia) divFrequencia.style.display = '';
        if (divDataFim) divDataFim.style.display = '';
      } else {
        if (divFrequencia) divFrequencia.style.display = 'none';
        if (divDataFim) divDataFim.style.display = 'none';
      }
    }
    if (recorrenteCheckbox) {
      recorrenteCheckbox.onchange = toggleRecorrenteFields;
      toggleRecorrenteFields();
    }

    const formElement = document.getElementById('form-edicao-transacao');
    console.log('🟢 Registrando onsubmit no formulário:', formElement);
    
    formElement.onsubmit = async function(ev) {
      ev.preventDefault();
      console.log('=== INÍCIO DO SUBMIT ===' );
      console.log('Token no localStorage:', localStorage.getItem('access_token') ? 'PRESENTE' : 'AUSENTE');
      console.log('Dados da transação:', dados);
      
      const fd = new FormData(ev.target);
      const payload = {};
      campos.forEach(c => {
        let v = fd.get(c.nome);
        if (c.tipo === 'number') v = v ? parseFloat(v) : null;
        if (c.nome === 'categoria_id') v = v ? parseInt(v) : null;
        // Checkbox recorrente
        if (c.nome === 'recorrente') v = fd.get('recorrente') ? true : false;
        // Corrige data_fim: se vazio, não envia ou envia como null
        if (c.nome === 'data_fim') {
          if (!v || v === "") {
            // Pode remover ou enviar como null, aqui removendo:
            return;
          }
        }
        payload[c.nome] = v;
      });
      
      console.log('Payload:', payload);
      
      try {
        let resp;
        if (dados && dados.id) {
          console.log('Atualizando transação ID:', dados.id);
          console.log('Antes de chamar fetchJWT - Token em localStorage:', localStorage.getItem('access_token') ? 'SIM' : 'NÃO');
          resp = await fetchJWT(`${apiUrl}/${dados.id}`, {
            method: 'PUT',
            body: JSON.stringify(payload)
          });
          console.log('Resposta recebida do PUT - Status:', resp.status);
        } else {
          console.log('Criando nova transação');
          resp = await fetchJWT(`${apiUrl}/`, {
            method: 'POST',
            body: JSON.stringify(payload)
          });
          console.log('Resposta recebida do POST - Status:', resp.status);
        }
        if (!resp.ok) {
          const err = await resp.json();
          console.error('Erro do servidor (status ' + resp.status + '):', err);
          
          // Se for erro de autenticação, redirecionar para login
          if (resp.status === 401 || resp.status === 422) {
            alert('Sessão expirada. Você será redirecionado para o login.');
            localStorage.removeItem('access_token');
            window.location.href = '/login.html';
            return;
          }
          
          alert('Erro ao salvar: ' + (err.error || JSON.stringify(err)));
          return;
        }
        alert(dados && dados.id ? 'Transação atualizada com sucesso.' : 'Transação criada com sucesso.');
        modal.remove();
        reloadGrid();
        fetchAndRenderSummary();
      } catch (err) {
        console.error('Erro no catch do submit:', err);
        alert('Erro de rede ao salvar: ' + err.message);
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

// Armazenar transações de cartão de crédito para o modal de detalhes
let transacoesCartaoCredito = [];

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
          return gridjs.html(`<span style="color:${color};font-weight:bold;display:block;text-align:center;">${cell}</span>`);
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
          
          // Se for a linha agrupada de cartão, mostrar botões Visualizar e Deletar
          if (id === 'CARTAO_AGRUPADO') {
            return gridjs.html(`
              <div class="btn-group" role="group" aria-label="Ações Cartão">
                <button type="button" class="btn btn-sm btn-outline-primary" onclick="abrirModalCartaoCredito()" title="Visualizar transações" aria-label="Visualizar transações">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8zM1.173 8a13.133 13.133 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.133 13.133 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5c-2.12 0-3.879-1.168-5.168-2.457A13.134 13.134 0 0 1 1.172 8z"/>
                    <path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM4.5 8a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0z"/>
                  </svg>
                </button>
                <button type="button" class="btn btn-sm btn-outline-danger ms-1" onclick="deletarTodasTransacoesCartao()" title="Deletar todas as transações" aria-label="Deletar todas">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M5.5 5.5A.5.5 0 0 1 6 5h4a.5.5 0 0 1 .5.5v8A1.5 1.5 0 0 1 9 15H7a1.5 1.5 0 0 1-1.5-1.5v-8zM14.5 3a1 1 0 0 1-1 1H13v9.5A2.5 2.5 0 0 1 10.5 16h-5A2.5 2.5 0 0 1 3 13.5V4H2.5a1 1 0 1 1 0-2H5l.5-1h5l.5 1h2.5a1 1 0 0 1 1 1zM6.118 1L5.5 2h5l-.618-1H6.118z"/>
                  </svg>
                </button>
              </div>
            `);
          }
          
          // Para linhas normais, mostrar botões editar e excluir
          return gridjs.html(`
            <div class="btn-group" role="group" aria-label="Ações">
              <button type="button" class="btn btn-sm btn-outline-primary edit-btn" data-id="${id}" title="Editar" aria-label="Editar">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M12.854.146a.5.5 0 0 1 .646.057l2.343 2.343a.5.5 0 0 1 .057.646l-9.193 9.193a.5.5 0 0 1-.168.11l-4 1.5a.5.5 0 0 1-.65-.65l1.5-4a.5.5 0 0 1 .11-.168L12.854.146zM11.207 2L3 10.207V12h1.793L14 3.793 11.207 2z"/>
                </svg>
              </button>

              <button type="button" class="btn btn-sm btn-outline-danger delete-btn ms-1" data-id="${id}" title="Excluir" aria-label="Excluir">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M5.5 5.5A.5.5 0 0 1 6 5h4a.5.5 0 0 1 .5.5v8A1.5 1.5 0 0 1 9 15H7a1.5 1.5 0 0 1-1.5-1.5v-8zM14.5 3a1 1 0 0 1-1 1H13v9.5A2.5 2.5 0 0 1 10.5 16h-5A2.5 2.5 0 0 1 3 13.5V4H2.5a1 1 0 1 1 0-2H5l.5-1h5l.5 1h2.5a1 1 0 0 1 1 1zM6.118 1L5.5 2h5l-.618-1H6.118z"/>
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
      fetch: (url, opts) => fetchJWT(url, opts),
      then: data => {
        try {
          const items = data.items || data.rows || [];
          
          // Separar transações de cartão de crédito das demais
          const cartaoCredito = items.filter(t => t.forma_pagamento === 'Cartão de Crédito');
          const outrasTransacoes = items.filter(t => t.forma_pagamento !== 'Cartão de Crédito');
          
          // Armazenar transações de cartão globalmente para o modal
          transacoesCartaoCredito = cartaoCredito;
          
          // Criar linha agrupada para cartão de crédito se houver transações
          let linhaCartao = null;
          if (cartaoCredito.length > 0) {
            const totalCartao = cartaoCredito.reduce((sum, t) => sum + (Number(t.valor) || 0), 0);
            
            // Encontrar a data mais recente
            let dataRecente = null;
            for (const t of cartaoCredito) {
              const dt = parseDateOnly(t.data_transacao || t.data);
              if (dt && (!dataRecente || dt > dataRecente)) {
                dataRecente = dt;
              }
            }
            
            // Se não encontrou data válida, usar data atual
            if (!dataRecente) {
              dataRecente = new Date();
            }
            
            // Formatar data no formato YYYY-MM-DD
            const dataStr = dataRecente.toISOString().split('T')[0];
            
            // Determinar status: se todas estão pagas = Pago, senão = Pendente
            const todasPagas = cartaoCredito.every(t => (t.status || '').toLowerCase() === 'pago');
            const statusCartao = todasPagas ? 'Pago' : 'Pendente';
            
            linhaCartao = {
              id: 'CARTAO_AGRUPADO',
              data_transacao: dataStr,
              descricao: 'Cartão de Crédito',
              categoria_nome: 'Mista',
              forma_pagamento: 'Cartão de Crédito',
              status: statusCartao,
              tipo: 'Despesa',
              valor: totalCartao
            };
          }
          
          // Custom client-side sort: Receita first, then Despesa
          const orderMap = { 'receita': 0, 'despesa': 1 };
          outrasTransacoes.sort((a, b) => {
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
          
          // Adicionar linha de cartão agrupado no início se existir
          const finalItems = linhaCartao ? [linhaCartao, ...outrasTransacoes] : outrasTransacoes;

          return finalItems.map(row => [
            row.id,
            formatDate(row.data_transacao || row.data || row.data_transacao),
            row.descricao || '',
            row.categoria_nome || '',
            row.forma_pagamento || '',
            row.status || '',
            row.tipo || '',
            formatCurrency(row.valor)
          ]);
        } catch (error) {
          console.error('Erro ao processar dados da grid:', error);
          // Retornar dados sem processamento em caso de erro
          const items = data.items || data.rows || [];
          return items.map(row => [
            row.id,
            formatDate(row.data_transacao || row.data),
            row.descricao || '',
            row.categoria_nome || '',
            row.forma_pagamento || '',
            row.status || '',
            row.tipo || '',
            formatCurrency(row.valor)
          ]);
        }
      },
      total: data => {
        // Ajustar total considerando agrupamento de cartão de crédito
        const total = data.total_items || data.total || 0;
        const items = data.items || data.rows || [];
        const numCartao = items.filter(t => t.forma_pagamento === 'Cartão de Crédito').length;
        // Se há transações de cartão, reduz o total pelo número de transações agrupadas menos 1
        return numCartao > 0 ? total - numCartao + 1 : total;
      }
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

// Função para abrir modal com detalhes das transações de cartão de crédito
window.abrirModalCartaoCredito = function() {
  // Remover modal anterior se existir
  var old = document.getElementById('modal-cartao-credito');
  if (old) old.remove();

  var modal = document.createElement('div');
  modal.id = 'modal-cartao-credito';
  modal.style.position = 'fixed';
  modal.style.top = '0';
  modal.style.left = '0';
  modal.style.width = '100vw';
  modal.style.height = '100vh';
  modal.style.background = 'rgba(0,0,0,0.5)';
  modal.style.zIndex = '9999';
  modal.style.display = 'flex';
  modal.style.alignItems = 'center';
  modal.style.justifyContent = 'center';

  const html = `
    <div style="background:#fff;padding:24px;border-radius:10px;min-width:80vw;max-width:95vw;max-height:90vh;overflow:auto;box-shadow:0 4px 20px rgba(0,0,0,0.2);">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
        <h4 style="margin:0;">Transações de Cartão de Crédito</h4>
        <button onclick="fecharModalCartaoCredito()" style="border:none;background:transparent;font-size:24px;cursor:pointer;color:#666;">&times;</button>
      </div>
      <div id="grid-cartao-credito"></div>
    </div>
  `;

  modal.innerHTML = html;
  document.body.appendChild(modal);

  // Criar grid com as transações de cartão
  const gridCartao = new gridjs.Grid({
    columns: [
      {
        id: 'id',
        name: '',
        sort: false,
        formatter: () => gridjs.html('')
      },
      { id: 'data_transacao', name: 'Data', sort: true },
      { id: 'descricao', name: 'Descrição', sort: true },
      { id: 'categoria_nome', name: 'Categoria', sort: true },
      {
        id: 'status',
        name: 'Status',
        sort: true,
        formatter: (cell, row) => {
          if (cell === null || cell === undefined) return '';
          const txt = String(cell).trim();
          const lower = txt.toLowerCase();
          const baseStyle = 'padding:4px 8px;border-radius:6px;display:inline-block;font-weight:600;';
          if (lower === 'pago') {
            return gridjs.html(`<span style="${baseStyle}background:#198754;color:#fff;">${txt}</span>`);
          }
          if (lower === 'pendente') {
            return gridjs.html(`<span style="${baseStyle}background:#dc3545;color:#fff;">${txt}</span>`);
          }
          return gridjs.html(`<span style="${baseStyle}">${txt}</span>`);
        }
      },
      {
        id: 'valor',
        name: 'Valor',
        sort: true,
        formatter: (cell) => {
          const num = Number(String(cell).replace(/[^\d,-]/g, '').replace(',', '.'));
          if (isNaN(num)) return cell;
          const color = num < 0 ? 'red' : 'red'; // Despesas sempre em vermelho
          return gridjs.html(`<span style="color:${color}; font-weight:bold;">${formatCurrency(num)}</span>`);
        }
      },
      {
        id: 'acoes',
        name: 'Ações',
        sort: false,
        formatter: (cell, row) => {
          const idCell = (row && row.cells && row.cells[0]) ? (row.cells[0].data || row.cells[0]) : '';
          const id = idCell || '';
          return gridjs.html(`
            <div class="btn-group" role="group" aria-label="Ações">
              <button type="button" class="btn btn-sm btn-outline-danger delete-btn-modal" data-id="${id}" title="Excluir" aria-label="Excluir">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M5.5 5.5A.5.5 0 0 1 6 5h4a.5.5 0 0 1 .5.5v8A1.5 1.5 0 0 1 9 15H7a1.5 1.5 0 0 1-1.5-1.5v-8zM14.5 3a1 1 0 0 1-1 1H13v9.5A2.5 2.5 0 0 1 10.5 16h-5A2.5 2.5 0 0 1 3 13.5V4H2.5a1 1 0 1 1 0-2H5l.5-1h5l.5 1h2.5a1 1 0 0 1 1 1zM6.118 1L5.5 2h5l-.618-1H6.118z"/>
                </svg>
              </button>
            </div>
          `);
        }
      }
    ],
    data: transacoesCartaoCredito.map(t => [
      t.id,
      formatDate(t.data_transacao || t.data),
      t.descricao || '',
      t.categoria_nome || '',
      t.status || '',
      formatCurrency(t.valor)
    ]),
    sort: true,
    pagination: {
      enabled: true,
      limit: 10
    },
    search: false,
    language: {
      'search': {
        'placeholder': '🔍 Buscar...'
      },
      'pagination': {
        'previous': 'Anterior',
        'next': 'Próximo',
        'showing': 'Mostrando',
        'results': () => 'registros',
        'of': 'de',
        'to': 'a'
      }
    }
  });

  // Esconder primeira coluna (ID)
  const cssIdModal = 'hide-grid-modal-id-column-style';
  if (!document.getElementById(cssIdModal)) {
    const style = document.createElement('style');
    style.id = cssIdModal;
    style.innerHTML = `#grid-cartao-credito .gridjs-table th:nth-child(1), #grid-cartao-credito .gridjs-table td:nth-child(1) { display: none; }`;
    document.head.appendChild(style);
  }

  gridCartao.render(document.getElementById('grid-cartao-credito'));

  // Adicionar event listeners para editar e excluir dentro do modal
  setTimeout(() => {
    const gridElement = document.getElementById('grid-cartao-credito');
    if (!gridElement) return;

    gridElement.addEventListener('click', async function(e) {
      console.log('🔴 Click detectado no grid do modal de cartão');
      const editBtn = e.target.closest('.edit-btn-modal');
      const deleteBtn = e.target.closest('.delete-btn-modal');

      if (editBtn) {
        console.log('🔴 Botão EDITAR clicado no modal');
        const tid = editBtn.getAttribute('data-id');
        console.log('🔴 ID da transação:', tid);
        if (!tid) return;
        
        try {
          console.log('🔴 Buscando transação via fetchJWT...');
          const resp = await fetchJWT(`${apiUrl}/${tid}`);
          console.log('🔴 Resposta do GET:', resp.status);
          if (resp.ok) {
            const transacao = await resp.json();
            console.log('🔴 Transação obtida:', transacao);
            // Fechar modal de cartão e abrir modal de edição
            console.log('🔴 Fechando modal de cartão...');
            fecharModalCartaoCredito();
            console.log('🔴 Abrindo modal de edição...');
            window.abrirModalEdicao(transacao);
          }
        } catch (err) {
          console.error('Erro ao buscar transação', err);
          alert('Erro ao carregar transação');
        }
      }

      if (deleteBtn) {
        const tid = deleteBtn.getAttribute('data-id');
        if (!tid || !confirm('Tem certeza que deseja excluir esta transação?')) return;

        try {
          const resp = await fetchJWT(`${apiUrl}/${tid}`, { method: 'DELETE' });
          if (resp.ok) {
            alert('Transação excluída com sucesso!');
            fecharModalCartaoCredito();
            reloadGrid();
            fetchAndRenderSummary();
          } else {
            alert('Erro ao excluir transação');
          }
        } catch (err) {
          console.error('Erro ao excluir', err);
          alert('Erro ao excluir transação');
        }
      }
    });
  }, 100);

  // Fechar modal ao clicar fora
  modal.addEventListener('click', function(e) {
    if (e.target === modal) {
      fecharModalCartaoCredito();
    }
  });
};

// Função para fechar modal de cartão de crédito
window.fecharModalCartaoCredito = function() {
  var modal = document.getElementById('modal-cartao-credito');
  if (modal) modal.remove();
};

// Função para deletar todas as transações de cartão de crédito
window.deletarTodasTransacoesCartao = async function() {
  if (!transacoesCartaoCredito || transacoesCartaoCredito.length === 0) {
    alert('Nenhuma transação de cartão de crédito encontrada.');
    return;
  }
  
  const totalTransacoes = transacoesCartaoCredito.length;
  const totalValor = transacoesCartaoCredito.reduce((sum, t) => sum + (Number(t.valor) || 0), 0);
  const valorFormatado = totalValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  
  const msg = `⚠️ ATENÇÃO: Você está prestes a DELETAR ${totalTransacoes} transação(ões) de cartão de crédito no valor total de ${valorFormatado}.\n\nEsta ação NÃO pode ser desfeita!\n\nDeseja realmente continuar?`;
  
  if (!confirm(msg)) {
    return;
  }
  
  // Confirmação dupla para segurança
  if (!confirm('Tem certeza ABSOLUTA? Esta é sua última chance de cancelar.')) {
    return;
  }
  
  try {
    // Deletar todas as transações em paralelo
    const promises = transacoesCartaoCredito.map(transacao => 
      fetchJWT(`${apiUrl}/${transacao.id}`, {
        method: 'DELETE'
      })
    );
    
    const results = await Promise.allSettled(promises);
    
    // Contar sucessos e falhas
    const sucessos = results.filter(r => r.status === 'fulfilled' && r.value && r.value.ok).length;
    const falhas = results.filter(r => r.status === 'rejected' || (r.value && !r.value.ok)).length;
    
    if (falhas > 0) {
      alert(`⚠️ Resultado:\n✅ ${sucessos} transação(ões) deletada(s)\n❌ ${falhas} transação(ões) com erro\n\nRecarregando dados...`);
    } else {
      alert(`✅ Sucesso! ${sucessos} transação(ões) de cartão de crédito deletadas com sucesso!`);
    }
    
    // Limpar array global
    transacoesCartaoCredito = [];
    
    // Recarregar grid e summary
    reloadGrid();
    fetchAndRenderSummary();
    
  } catch (err) {
    console.error('Erro ao deletar transações de cartão:', err);
    alert('❌ Erro de rede ao deletar transações. Tente novamente.');
  }
};

function reloadGrid(){
  if (!grid) {
    createGrid();
    return;
  }
  // update server config to include current month/year, then force render
  grid.updateConfig({
    server: {
      url: buildUrl(apiUrl, 1, 10),
      fetch: (url, opts) => fetchJWT(url, opts),
      then: data => {
        try {
          const items = data.items || data.rows || [];
          
          // Separar transações de cartão de crédito das demais
          const cartaoCredito = items.filter(t => t.forma_pagamento === 'Cartão de Crédito');
          const outrasTransacoes = items.filter(t => t.forma_pagamento !== 'Cartão de Crédito');
          
          // Armazenar transações de cartão globalmente para o modal
          transacoesCartaoCredito = cartaoCredito;
          
          // Criar linha agrupada para cartão de crédito se houver transações
          let linhaCartao = null;
          if (cartaoCredito.length > 0) {
            const totalCartao = cartaoCredito.reduce((sum, t) => sum + (Number(t.valor) || 0), 0);
            
            // Encontrar a data mais recente
            let dataRecente = null;
            for (const t of cartaoCredito) {
              const dt = parseDateOnly(t.data_transacao || t.data);
              if (dt && (!dataRecente || dt > dataRecente)) {
                dataRecente = dt;
              }
            }
            
            // Se não encontrou data válida, usar data atual
            if (!dataRecente) {
              dataRecente = new Date();
            }
            
            // Formatar data no formato YYYY-MM-DD
            const dataStr = dataRecente.toISOString().split('T')[0];
            
            // Determinar status: se todas estão pagas = Pago, senão = Pendente
            const todasPagas = cartaoCredito.every(t => (t.status || '').toLowerCase() === 'pago');
            const statusCartao = todasPagas ? 'Pago' : 'Pendente';
            
            linhaCartao = {
              id: 'CARTAO_AGRUPADO',
              data_transacao: dataStr,
              descricao: 'Cartão de Crédito',
              categoria_nome: 'Mista',
              forma_pagamento: 'Cartão de Crédito',
              status: statusCartao,
              tipo: 'Despesa',
              valor: totalCartao
            };
          }
          
          // Custom client-side sort: Receita first, then Despesa
          const orderMap = { 'receita': 0, 'despesa': 1 };
          outrasTransacoes.sort((a, b) => {
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
          
          // Adicionar linha de cartão agrupado no início se existir
          const finalItems = linhaCartao ? [linhaCartao, ...outrasTransacoes] : outrasTransacoes;

          return finalItems.map(row => [
            row.id,
            formatDate(row.data_transacao || row.data || row.data_transacao),
            row.descricao || '',
            row.categoria_nome || '',
            row.forma_pagamento || '',
            row.status || '',
            row.tipo || '',
            formatCurrency(row.valor)
          ]);
        } catch (error) {
          console.error('Erro ao processar dados do reloadGrid:', error);
          // Retornar dados sem processamento em caso de erro
          const items = data.items || data.rows || [];
          return items.map(row => [
            row.id,
            formatDate(row.data_transacao || row.data),
            row.descricao || '',
            row.categoria_nome || '',
            row.forma_pagamento || '',
            row.status || '',
            row.tipo || '',
            formatCurrency(row.valor)
          ]);
        }
      },
      total: data => {
        // Ajustar total considerando agrupamento de cartão de crédito
        const total = data.total_items || data.total || 0;
        const items = data.items || data.rows || [];
        const numCartao = items.filter(t => t.forma_pagamento === 'Cartão de Crédito').length;
        // Se há transações de cartão, reduz o total pelo número de transações agrupadas menos 1
        return numCartao > 0 ? total - numCartao + 1 : total;
      }
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
  
  // Adiciona botão Nova Transação acima da grid
  setTimeout(function() {
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
  }, 100);

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
  // Handler para status badge (toggle Pago/Pendente)
  const statusEl = e.target.closest('.status-badge');
  if (statusEl) {
    const id = statusEl.getAttribute('data-id');
    const current = statusEl.getAttribute('data-status');
    if (!id || !current) return;
    const novoStatus = (current.toLowerCase() === 'pago') ? 'Pendente' : 'Pago';
    
    try {
      // Se for a linha consolidada de cartão de crédito, atualizar todas as transações
      if (id === 'CARTAO_AGRUPADO') {
        if (!transacoesCartaoCredito || transacoesCartaoCredito.length === 0) {
          alert('Nenhuma transação de cartão de crédito encontrada.');
          return;
        }
        
        // Confirmar ação
        const totalTransacoes = transacoesCartaoCredito.length;
        const msg = `Deseja atualizar o status de todas as ${totalTransacoes} transações de cartão de crédito para "${novoStatus}"?`;
        if (!confirm(msg)) return;
        
        // Atualizar todas as transações de cartão em paralelo
        const promises = transacoesCartaoCredito.map(transacao => 
          fetchJWT(`${apiUrl}/${transacao.id}`, {
            method: 'PUT',
            body: JSON.stringify({ status: novoStatus })
          })
        );
        
        const results = await Promise.allSettled(promises);
        
        // Verificar se todas foram atualizadas com sucesso
        const falhas = results.filter(r => r.status === 'rejected' || (r.value && !r.value.ok));
        
        if (falhas.length > 0) {
          alert(`${falhas.length} transação(ões) não puderam ser atualizadas. Recarregando dados...`);
        } else {
          alert(`${totalTransacoes} transação(ões) de cartão de crédito atualizadas com sucesso!`);
        }
        
        // Recarregar a grid para refletir as mudanças
        reloadGrid();
        fetchAndRenderSummary();
        
      } else {
        // Lógica original para transações individuais
        const resp = await fetchJWT(`${apiUrl}/${id}`, {
          method: 'PUT',
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
      }
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
      const resp = await fetchJWT(`${apiUrl}/${id}`, {
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
  const resp = await fetchJWT(`${apiUrl}/${id}`);
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
  const resp = await fetchJWT(`http://127.0.0.1:5000/api/transacoes/summary?inicio=${inicio}&fim=${fim}`);
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
    const elC = document.getElementById('card-cartao');
    if (elR) elR.textContent = formatMoeda(data.receitas || 0);
    if (elD) elD.textContent = formatMoeda(data.despesas || 0);
    if (elS) elS.textContent = formatMoeda(data.saldo || 0);
    // Soma despesas de cartão de crédito
    if (elC) {
      // Se o backend não retorna data.transacoes, buscar manualmente
      let totalCartao = 0;
      try {
        const respCartao = await fetch(`http://127.0.0.1:5000/api/transacoes?inicio=${inicio}&fim=${fim}`);
        if (respCartao.ok) {
          const dataCartao = await respCartao.json();
          const arr = dataCartao.items || dataCartao.rows || [];
          arr.forEach(t => {
            if (t.tipo === 'Despesa' && t.forma_pagamento === 'Cartão de Crédito') {
              totalCartao += Number(t.valor) || 0;
            }
          });
        }
      } catch {}
      elC.textContent = formatMoeda(totalCartao);
    }

  } catch (err) {
    console.error('Erro fetch summary', err);
  }
}

// Função para requisições fetch protegidas com token JWT
function fetchJWT(url, options = {}) {
    const token = localStorage.getItem('access_token');
    if (!token) {
        console.error('Token JWT não encontrado no localStorage');
        console.log('localStorage keys:', Object.keys(localStorage));
        alert('Sessão expirada. Faça login novamente.');
        window.location.href = '/login.html';
        return Promise.reject(new Error('Token ausente'));
    }
    options.headers = options.headers || {};
    options.headers['Content-Type'] = options.headers['Content-Type'] || 'application/json';
    options.headers['Authorization'] = 'Bearer ' + token;
    console.log('fetchJWT - URL:', url, 'Method:', options.method || 'GET', 'Token presente:', !!token);
    console.log('fetchJWT - Headers:', options.headers);
    console.log('fetchJWT - Token (primeiros 20 chars):', token.substring(0, 20));
    return fetch(url, options);
}

// Exemplo de uso:
// fetchJWT('http://127.0.0.1:5000/api/transacoes', { method: 'GET' })
// fetchJWT(`${apiUrl}/${id}`, { method: 'PUT', body: JSON.stringify(payload) })
// fetchJWT(`${apiUrl}/`, { method: 'POST', body: JSON.stringify(payload) })
// fetchJWT(`${apiUrl}/${id}`, { method: 'DELETE' })
// fetchJWT(`${apiUrl}/${id}`)
// fetchJWT(`http://127.0.0.1:5000/api/categorias?tipo=${encodeURIComponent(tipoCat)}`)
// fetchJWT(`http://127.0.0.1:5000/api/transacoes/summary?inicio=${inicio}&fim=${fim}`)
// fetchJWT(`http://127.0.0.1:5000/api/transacoes?inicio=${inicio}&fim=${fim}`)
