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
  { nome: 'forma_pagamento_id', label: 'Forma de Pagamento', tipo: 'select-forma-pagamento' },
    { nome: 'status', label: 'Status', tipo: 'select', opcoes: ['Pago','Pendente'] },
    { nome: 'recorrente', label: 'Recorrente', tipo: 'checkbox' },
    { nome: 'recorrencia_tipo', label: 'Tipo de Recorrência', tipo: 'radio-recorrencia', opcoes: ['Assinatura','Parcelamento'] },
    { nome: 'frequencia', label: 'Frequência', tipo: 'select-frequencia', opcoes: ['Semanal','Mensal','Semestral','Anual'] },
    { nome: 'data_fim', label: 'Data Fim', tipo: 'date' }
  ];

  let html = `<form id="form-edicao-transacao" class="modal-transacao-form">
    <h4><i class="bi bi-${dados ? 'pencil-square' : 'plus-circle'}" style="margin-right:8px;"></i>${dados ? 'Editar' : 'Nova'} Transação</h4>`;
  let categorias = [];
  let formasPagamento = [];
  let tipoSelecionado = dados && dados.tipo ? dados.tipo : 'Receita';

  // Busca categorias do tipo informado e renderiza campos SEMPRE que abrir o modal
  function buscarECampos(tipoCat) {
    // Carregar categorias por tipo
    fetchJWT(`http://127.0.0.1:5000/api/categorias?tipo=${encodeURIComponent(tipoCat)}`)
      .then(resp => resp.json())
      .then(arr => { categorias = arr || []; })
      .catch(() => { categorias = []; })
      .finally(() => {
        // Carregar formas de pagamento ativas
        fetchJWT(`http://127.0.0.1:5000/api/formas_pagamento?ativo=true`)
          .then(resp => resp.json())
          .then(arr => { formasPagamento = Array.isArray(arr) ? arr : []; })
          .catch(() => { formasPagamento = []; })
          .finally(() => {
            document.getElementById('campos-modal-transacao').innerHTML = renderCampos();
            adicionarListeners();
          });
      });
  }

  // Sempre buscar categorias ao abrir o modal, inclusive para Nova Transação
  setTimeout(() => buscarECampos(tipoSelecionado), 0);

  function renderCampos() {
    const fullWidthCampos = ['descricao', 'frequencia', 'data_fim', 'total_parcelas'];
    let camposHtml = '<div class="modal-fields-grid">';
    campos.forEach(c => {
      const precisaFull = fullWidthCampos.includes(c.nome) || ['checkbox', 'radio-recorrencia'].includes(c.tipo);
      const wrapperClass = `modal-field${precisaFull ? ' modal-field--full' : ''}`;
      // Recorrente: checkbox
      if (c.tipo === 'checkbox') {
        const checked = dados && dados.recorrente ? 'checked' : '';
        camposHtml += `<div class="${wrapperClass}"><div class="modal-checkbox"><label style="font-weight:600;"><input type="checkbox" name="recorrente" ${checked}/> Recorrente</label></div></div>`;
        return;
      }
      // Tipo de Recorrência: só aparece se recorrente marcado
      if (c.tipo === 'radio-recorrencia') {
        const currentTipo = (dados && dados.recorrencia_tipo) || (dados && dados.parcelado ? 'Parcelamento' : (dados && dados.recorrente ? 'Assinatura' : 'Assinatura'));
        camposHtml += `<div class="${wrapperClass}" style="display:none;" id="div-radio-recorrencia"><label style="font-weight:600;color:#4a5568;margin-bottom:6px;display:block;">${c.label}</label>`;
        camposHtml += `<div class="modal-radio-group">`;
        c.opcoes.forEach(op => {
          const checked = (currentTipo === op) ? 'checked' : '';
          camposHtml += `<label style="font-weight:500;"><input type="radio" name="recorrencia_tipo" value="${op}" ${checked}/> ${op}</label>`;
        });
        camposHtml += `</div></div>`;
        return;
      }
      // Frequência: só aparece se recorrente marcado E tipo=Assinatura
      if (c.tipo === 'select-frequencia') {
        camposHtml += `<div class="${wrapperClass}" style="display:none;" id="div-frequencia"><label style="font-weight:600;color:#4a5568;margin-bottom:6px;display:block;">${c.label}</label>`;
        camposHtml += `<select name="frequencia" style="width:100%;padding:10px;border:1px solid #e0e0e0;border-radius:8px;transition:all 0.3s ease;" onfocus="this.style.borderColor='#1abc9c';this.style.boxShadow='0 0 0 3px rgba(26,188,156,0.1)'" onblur="this.style.borderColor='#e0e0e0';this.style.boxShadow='none'">`;
        c.opcoes.forEach(op => {
          let sel = dados && dados.frequencia === op ? 'selected' : '';
          camposHtml += `<option value="${op}" ${sel}>${op}</option>`;
        });
        camposHtml += `</select></div>`;
        return;
      }
      // Data Fim: só aparece se recorrente marcado E tipo=Assinatura
      if (c.nome === 'data_fim') {
        let val = dados && dados.data_fim ? dados.data_fim : '';
        if (val && val.length >= 10) val = val.slice(0,10);
        camposHtml += `<div class="${wrapperClass}" style="display:none;" id="div-data-fim"><label style="font-weight:600;color:#4a5568;margin-bottom:6px;display:block;">${c.label}</label>`;
        camposHtml += `<input type="date" name="data_fim" value="${val||''}" style="width:100%;padding:10px;border:1px solid #e0e0e0;border-radius:8px;transition:all 0.3s ease;" onfocus="this.style.borderColor='#1abc9c';this.style.boxShadow='0 0 0 3px rgba(26,188,156,0.1)'" onblur="this.style.borderColor='#e0e0e0';this.style.boxShadow='none'" /></div>`;
        return;
      }
      // Total de Parcelas: aparece quando recorrente e tipo=Parcelamento
      if (c.nome === 'total_parcelas') {
        const val = dados && dados.total_parcelas ? dados.total_parcelas : '';
        camposHtml += `<div class="${wrapperClass}" style="display:none;" id="div-total-parcelas"><label style="font-weight:600;color:#4a5568;margin-bottom:6px;display:block;">Total de Parcelas</label>`;
        camposHtml += `<input type="number" min="2" max="60" name="total_parcelas" value="${val}" style="width:100%;padding:10px;border:1px solid #e0e0e0;border-radius:8px;transition:all 0.3s ease;" onfocus="this.style.borderColor='#1abc9c';this.style.boxShadow='0 0 0 3px rgba(26,188,156,0.1)'" onblur="this.style.borderColor='#e0e0e0';this.style.boxShadow='none'" /></div>`;
        return;
      }
      // ...restante igual
      if (c.tipo === 'select') {
        camposHtml += `<div class="${wrapperClass}"><label style="font-weight:600;color:#4a5568;margin-bottom:6px;display:block;">${c.label}</label>`;
        camposHtml += `<select name="${c.nome}" style="width:100%;padding:10px;border:1px solid #e0e0e0;border-radius:8px;transition:all 0.3s ease;" onfocus="this.style.borderColor='#1abc9c';this.style.boxShadow='0 0 0 3px rgba(26,188,156,0.1)'" onblur="this.style.borderColor='#e0e0e0';this.style.boxShadow='none'">`;
        c.opcoes.forEach(op => {
          let sel = '';
          if (c.nome === 'tipo' && op === tipoSelecionado) sel = 'selected';
          else if (dados && dados[c.nome] === op) sel = 'selected';
          camposHtml += `<option value="${op}" ${sel}>${op}</option>`;
        });
        camposHtml += `</select></div>`;
      } else if (c.tipo === 'select-categoria') {
  camposHtml += `<div class="${wrapperClass}"><label style="font-weight:600;color:#4a5568;margin-bottom:6px;display:block;">${c.label}</label>`;
        camposHtml += `<select name="categoria_id" style="width:100%;padding:10px;border:1px solid #e0e0e0;border-radius:8px;transition:all 0.3s ease;" onfocus="this.style.borderColor='#1abc9c';this.style.boxShadow='0 0 0 3px rgba(26,188,156,0.1)'" onblur="this.style.borderColor='#e0e0e0';this.style.boxShadow='none'">`;
        categorias.forEach(cat => {
          const sel = (dados && dados.categoria_id == cat.id) ? 'selected' : '';
          camposHtml += `<option value="${cat.id}" ${sel}>${cat.nome}</option>`;
        });
        camposHtml += `</select></div>`;
      } else if (c.tipo === 'select-forma-pagamento') {
  camposHtml += `<div class="${wrapperClass}"><label style="font-weight:600;color:#4a5568;margin-bottom:6px;display:block;">${c.label}</label>`;
        camposHtml += `<select name="forma_pagamento_id" style="width:100%;padding:10px;border:1px solid #e0e0e0;border-radius:8px;transition:all 0.3s ease;" onfocus="this.style.borderColor='#1abc9c';this.style.boxShadow='0 0 0 3px rgba(26,188,156,0.1)'" onblur="this.style.borderColor='#e0e0e0';this.style.boxShadow='none'">`;
        formasPagamento.forEach(fp => {
          let sel = '';
          if (dados && (dados.forma_pagamento_id == fp.id || (dados.forma_pagamento_nome && dados.forma_pagamento_nome === fp.nome))) sel = 'selected';
          camposHtml += `<option value="${fp.id}" ${sel}>${fp.nome}</option>`;
        });
        camposHtml += `</select></div>`;
      } else if (c.tipo === 'date') {
        let val = dados && dados[c.nome] ? dados[c.nome] : '';
        if (val && val.length >= 10) val = val.slice(0,10);
        camposHtml += `<div class="${wrapperClass}"><label style="font-weight:600;color:#4a5568;margin-bottom:6px;display:block;">${c.label}</label>`;
        camposHtml += `<input type="date" name="${c.nome}" value="${val||''}" style="width:100%;padding:10px;border:1px solid #e0e0e0;border-radius:8px;transition:all 0.3s ease;" onfocus="this.style.borderColor='#1abc9c';this.style.boxShadow='0 0 0 3px rgba(26,188,156,0.1)'" onblur="this.style.borderColor='#e0e0e0';this.style.boxShadow='none'" /></div>`;
      } else {
        camposHtml += `<div class="${wrapperClass}"><label style="font-weight:600;color:#4a5568;margin-bottom:6px;display:block;">${c.label}</label>`;
        camposHtml += `<input type="${c.tipo}" name="${c.nome}" value="${dados ? (dados[c.nome]||'') : ''}" style="width:100%;padding:10px;border:1px solid #e0e0e0;border-radius:8px;transition:all 0.3s ease;" step="${c.step||''}" onfocus="this.style.borderColor='#1abc9c';this.style.boxShadow='0 0 0 3px rgba(26,188,156,0.1)'" onblur="this.style.borderColor='#e0e0e0';this.style.boxShadow='none'" /></div>`;
      }
    });
    camposHtml += '</div>';
    return camposHtml;
  }

  html += `<div id="campos-modal-transacao" class="modal-fields-wrapper"></div>`;
  // Campo total_parcelas é especial, inserir como último bloco no form
  // (O renderCampos controla a visibilidade via div-total-parcelas)
  campos.push({ nome: 'total_parcelas', label: 'Total de Parcelas', tipo: 'number' });
  html += `<div class="modal-actions">
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
    const divRadioRecorrencia = document.getElementById('div-radio-recorrencia');
    const divFrequencia = document.getElementById('div-frequencia');
    const divDataFim = document.getElementById('div-data-fim');
    const divTotalParcelas = document.getElementById('div-total-parcelas');
    const radiosRec = () => Array.from(document.querySelectorAll('input[name="recorrencia_tipo"]'));
    const getTipoRec = () => {
      const r = document.querySelector('input[name="recorrencia_tipo"]:checked');
      return r ? r.value : null;
    };
    function toggleRecorrenteFields() {
      if (recorrenteCheckbox && recorrenteCheckbox.checked) {
        if (divRadioRecorrencia) divRadioRecorrencia.style.display = '';
        const tipo = getTipoRec();
        if (tipo === 'Assinatura') {
          if (divFrequencia) divFrequencia.style.display = '';
          if (divDataFim) divDataFim.style.display = '';
          if (divTotalParcelas) divTotalParcelas.style.display = 'none';
        } else if (tipo === 'Parcelamento') {
          if (divFrequencia) divFrequencia.style.display = 'none';
          if (divDataFim) divDataFim.style.display = 'none';
          if (divTotalParcelas) divTotalParcelas.style.display = '';
        }
      } else {
        if (divRadioRecorrencia) divRadioRecorrencia.style.display = 'none';
        if (divFrequencia) divFrequencia.style.display = 'none';
        if (divDataFim) divDataFim.style.display = 'none';
        if (divTotalParcelas) divTotalParcelas.style.display = 'none';
      }
    }
    if (recorrenteCheckbox) {
      recorrenteCheckbox.onchange = toggleRecorrenteFields;
      toggleRecorrenteFields();
    }
    // mudar visibilidade quando trocar radio
    radiosRec().forEach(r => r.addEventListener('change', toggleRecorrenteFields));

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
        if (c.nome === 'forma_pagamento_id') v = v ? parseInt(v) : null;
        // Checkbox recorrente
        if (c.nome === 'recorrente') v = fd.get('recorrente') ? true : false;
        // Radio recorrencia_tipo
        if (c.nome === 'recorrencia_tipo') v = getTipoRec();
        // Corrige data_fim: só enviar para Assinatura e se preenchido
        if (c.nome === 'data_fim') {
          const tipo = getTipoRec();
          if (tipo !== 'Assinatura' || !v || v === '') {
            return; // não enviar
          }
        }
        // Frequência: só enviar se Assinatura
        if (c.nome === 'frequencia') {
          const tipo = getTipoRec();
          if (tipo !== 'Assinatura') {
            return;
          }
        }
        // total_parcelas: só enviar se Parcelamento
        if (c.nome === 'total_parcelas') {
          const tipo = getTipoRec();
          if (tipo !== 'Parcelamento') {
            return;
          }
          v = v ? parseInt(v) : null;
        }
        payload[c.nome] = v;
      });

      // Ajuste de parcelado conforme tipo recorrencia
      const tipoRec = getTipoRec();
      if (fd.get('recorrente')) {
        if (tipoRec === 'Parcelamento') {
          payload.parcelado = true;
        } else {
          payload.parcelado = false;
        }
      }
      
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
  refreshPeriodoData();
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
const GRID_PAGE_LIMIT = 30;
const MODAL_GRID_PAGE_LIMIT = 20;

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
  return `${base}?inicio=${inicio}&fim=${fim}&page=${page}&per_page=${per_page}&cartao_credito=false`;
}

// Create initial grid instance variable so we can update config later
let grid = null;

// Armazenar transações e agregações de cartão de crédito para o painel dedicado
let transacoesCartaoCredito = [];
let cartoesCreditoAgrupados = [];

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
  { id: 'forma_pagamento_nome', name: 'Forma Pagamento', sort: true },
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
      url: buildUrl(apiUrl, 1, GRID_PAGE_LIMIT),
      fetch: (url, opts) => fetchJWT(url, opts),
      then: data => {
        const items = data.items || data.rows || [];
        return items.map(row => [
          row.id,
          formatDate(row.data_transacao || row.data || row.data_transacao),
          row.descricao || '',
          row.categoria_nome || '',
          row.forma_pagamento_nome || '',
          row.status || '',
          row.tipo || '',
          formatCurrency((row && row.parcelado) ? row.valor_parcela : row.valor)
        ]);
      }
    },
    pagination: {
      enabled: true,
      limit: GRID_PAGE_LIMIT,
      server: {
        // Grid.js will call this to fetch specific pages; buildUrl adds mes/ano and pagination
        url: (prev, page, limit) => {
          const p = page || 1;
          const per = limit || GRID_PAGE_LIMIT;
          return buildUrl(apiUrl, p, per);
        }
      }
    },
  search: false,
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
window.abrirModalCartaoCredito = function(formaPagamentoId = null) {
  const dataset = formaPagamentoId
    ? transacoesCartaoCredito.filter(t => t.forma_pagamento_id === formaPagamentoId)
    : transacoesCartaoCredito;

  if (!dataset.length) {
    alert('Nenhuma transação encontrada para este cartão.');
    return;
  }

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

  const tituloModal = formaPagamentoId && dataset[0]
    ? `Transações - ${dataset[0].forma_pagamento_nome || 'Cartão'}`
    : 'Transações de Cartão de Crédito';

  const html = `
    <div style="background:#fff;padding:24px;border-radius:10px;min-width:80vw;max-width:95vw;max-height:90vh;overflow:auto;box-shadow:0 4px 20px rgba(0,0,0,0.2);">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
        <h4 style="margin:0;">${tituloModal}</h4>
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
    data: dataset.map(t => [
      t.id,
      formatDate(t.data_transacao || t.data),
      t.descricao || '',
      t.categoria_nome || '',
      t.status || '',
      formatCurrency(t && t.parcelado ? t.valor_parcela : t.valor)
    ]),
    sort: true,
    pagination: {
      enabled: true,
      limit: MODAL_GRID_PAGE_LIMIT
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
            refreshPeriodoData();
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
  const totalValor = transacoesCartaoCredito.reduce((sum, t) => {
    const valor = t.parcelado ? Number(t.valor_parcela) : Number(t.valor);
    return sum + (valor || 0);
  }, 0);
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
    const results = await Promise.allSettled(transacoesCartaoCredito.map(transacao => 
      fetchJWT(`${apiUrl}/${transacao.id}`, { method: 'DELETE' })
    ));
    
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
  await refreshPeriodoData();
    
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
      url: buildUrl(apiUrl, 1, GRID_PAGE_LIMIT),
      fetch: (url, opts) => fetchJWT(url, opts),
      then: data => {
        const items = data.items || data.rows || [];
        return items.map(row => [
          row.id,
          formatDate(row.data_transacao || row.data || row.data_transacao),
          row.descricao || '',
          row.categoria_nome || '',
          row.forma_pagamento_nome || '',
          row.status || '',
          row.tipo || '',
          formatCurrency((row && row.parcelado) ? row.valor_parcela : row.valor)
        ]);
      }
    },
    pagination: {
      enabled: true,
      limit: GRID_PAGE_LIMIT,
      server: {
        url: (prev, page, limit) => {
          const p = page || 1;
          const per = limit || GRID_PAGE_LIMIT;
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
  refreshPeriodoData();
  
  const btnAtualizarCartoes = document.getElementById('btn-recarregar-cartoes');
  if (btnAtualizarCartoes) {
    btnAtualizarCartoes.addEventListener('click', () => fetchCartaoCreditoDados(buildMonthRange(current)));
  }
  const btnDeletarTodosCartoes = document.getElementById('btn-cartoes-deletar-todos');
  if (btnDeletarTodosCartoes) {
    btnDeletarTodosCartoes.addEventListener('click', deletarTodasTransacoesCartao);
  }
  const btnMarcarPagoTodos = document.getElementById('btn-cartoes-marcar-pago');
  if (btnMarcarPagoTodos) {
    btnMarcarPagoTodos.addEventListener('click', () => atualizarStatusTodosCartoes('Pago'));
  }
  
  // Adiciona botão Nova Transação acima da grid
  setTimeout(function() {
    const gridContainer = document.getElementById('grid');
    if (gridContainer && !document.getElementById('btn-nova-transacao')) {
      const btn = document.createElement('button');
      btn.textContent = 'Nova Transação';
      btn.className = 'btn btn-success btn-sm mb-2';
      btn.id = 'btn-nova-transacao';
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
    refreshPeriodoData();
  });

  document.getElementById('nextMonth').addEventListener('click', function(){
    current.mes++;
    if (current.mes === 13) { current.mes = 1; current.ano++; }
    updateLabel();
    reloadGrid();
    refreshPeriodoData();
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
      refreshPeriodoData();
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
      await refreshPeriodoData();
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
  refreshPeriodoData();
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

async function fetchAndRenderSummary(range) {
  const { inicio, fim } = range || buildMonthRange(current);
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
    if (elC) elC.textContent = formatMoeda(data.cartao_credito_total || 0);

  } catch (err) {
    console.error('Erro fetch summary', err);
  }
}

async function fetchCartaoCreditoDados(range) {
  const { inicio, fim } = range || buildMonthRange(current);
  const container = document.getElementById('cartao-credito-conteudo');
  try {
    const resp = await fetchJWT(`${apiUrl}/cartao_credito?inicio=${inicio}&fim=${fim}`);
    if (!resp.ok) {
      throw new Error(`Status ${resp.status}`);
    }
    const data = await resp.json();
    transacoesCartaoCredito = data.transacoes || [];
    cartoesCreditoAgrupados = data.cartoes || [];
    renderCartaoCreditoPainel();
  } catch (err) {
    console.error('Erro ao carregar dados de cartões', err);
    if (container) {
      container.innerHTML = '<p class="text-danger mb-0">Erro ao carregar cartões de crédito.</p>';
    }
  }
}

function renderCartaoCreditoPainel() {
  const container = document.getElementById('cartao-credito-conteudo');
  if (!container) return;

  if (!cartoesCreditoAgrupados.length) {
    container.innerHTML = '<p class="text-muted mb-0">Nenhuma compra realizada no cartão neste período.</p>';
    return;
  }

  const rows = cartoesCreditoAgrupados.map(card => {
    const pendentes = Number(card.pendentes || 0);
    const statusClass = pendentes === 0 ? 'pago' : 'pendente';
    const statusLabel = pendentes === 0 ? 'Tudo pago' : `${pendentes} pendente(s)`;
    const ultimaData = card.ultima_data ? formatDate(card.ultima_data) : '-';
    return `
      <tr>
        <td class="fw-semibold">${card.forma_pagamento_nome || 'Cartão'}</td>
        <td>${card.quantidade || 0}</td>
        <td>${formatCurrency(card.total || 0)}</td>
        <td>${ultimaData}</td>
        <td>
          <span class="cartao-status-pill ${statusClass}">${statusLabel}</span>
        </td>
        <td class="text-end">
          <div class="btn-group btn-group-sm" role="group">
            <button class="btn btn-outline-primary" title="Ver detalhes" aria-label="Ver detalhes" onclick="abrirModalCartaoCredito(${card.forma_pagamento_id || 'null'})">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true">
                <path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8z"/>
                <path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z"/>
              </svg>
            </button>
            <button class="btn btn-outline-success" title="Marcar como pago" aria-label="Marcar como pago" onclick="atualizarStatusCartaoPorForma(${card.forma_pagamento_id}, 'Pago')">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true">
                <path d="M13.485 1.929a.75.75 0 0 1 .086 1.056l-7 8.25a.75.75 0 0 1-1.1.044l-3.5-3.5a.75.75 0 0 1 1.06-1.06l2.93 2.93 6.47-7.63a.75.75 0 0 1 1.054-.086z"/>
              </svg>
            </button>
            <button class="btn btn-outline-warning" title="Marcar como pendente" aria-label="Marcar como pendente" onclick="atualizarStatusCartaoPorForma(${card.forma_pagamento_id}, 'Pendente')">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true">
                <path d="M11.354 4.646a.5.5 0 0 0-.708 0L8 7.293 5.354 4.646a.5.5 0 0 0-.708.708L7.293 8l-2.647 2.646a.5.5 0 0 0 .708.708L8 8.707l2.646 2.647a.5.5 0 0 0 .708-.708L8.707 8l2.647-2.646a.5.5 0 0 0 0-.708z"/>
              </svg>
            </button>
            <button class="btn btn-outline-danger" title="Excluir" aria-label="Excluir" onclick="deletarTransacoesCartaoPorForma(${card.forma_pagamento_id})">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true">
                <path d="M5.5 5.5A.5.5 0 0 1 6 5h4a.5.5 0 0 1 .5.5v8A1.5 1.5 0 0 1 9 15H7a1.5 1.5 0 0 1-1.5-1.5v-8z"/>
                <path d="M14.5 3a1 1 0 0 1-1 1H13v9.5A2.5 2.5 0 0 1 10.5 16h-5A2.5 2.5 0 0 1 3 13.5V4H2.5a1 1 0 1 1 0-2H5l.5-1h5l.5 1h2.5a1 1 0 0 1 1 1z"/>
              </svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  container.innerHTML = `
    <table class="table table-sm align-middle mb-0">
      <thead>
        <tr>
          <th>Cartão</th>
          <th>Qtd.</th>
          <th>Total</th>
          <th>Última compra</th>
          <th>Status</th>
          <th class="text-end">Ações</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

async function atualizarStatusCartaoPorForma(formaPagamentoId, novoStatus) {
  const transacoes = transacoesCartaoCredito.filter(t => t.forma_pagamento_id === formaPagamentoId);
  if (!transacoes.length) {
    alert('Nenhuma transação encontrada para este cartão.');
    return;
  }

  const nome = transacoes[0].forma_pagamento_nome || 'Cartão de Crédito';
  if (!confirm(`Atualizar ${transacoes.length} transação(ões) do cartão "${nome}" para "${novoStatus}"?`)) {
    return;
  }

  try {
    const results = await Promise.allSettled(transacoes.map(tx =>
      fetchJWT(`${apiUrl}/${tx.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: novoStatus })
      })
    ));

    const falhas = results.filter(r => r.status === 'rejected' || (r.value && !r.value.ok)).length;
    if (falhas > 0) {
      alert(`${falhas} transação(ões) não puderam ser atualizadas.`);
    } else {
      alert('Status atualizado com sucesso.');
    }
  } catch (err) {
    console.error('Erro ao atualizar status do cartão', err);
    alert('Erro ao atualizar status.');
  }

  reloadGrid();
  await refreshPeriodoData();
}

async function deletarTransacoesCartaoPorForma(formaPagamentoId) {
  const transacoes = transacoesCartaoCredito.filter(t => t.forma_pagamento_id === formaPagamentoId);
  if (!transacoes.length) {
    alert('Nenhuma transação encontrada para este cartão.');
    return;
  }

  const nome = transacoes[0].forma_pagamento_nome || 'Cartão de Crédito';
  const totalValor = transacoes.reduce((sum, t) => sum + (t.parcelado ? Number(t.valor_parcela) : Number(t.valor) || 0), 0);
  const formatMoeda = totalValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const msg = `Excluir ${transacoes.length} transação(ões) do cartão "${nome}" totalizando ${formatMoeda}? Esta ação é irreversível.`;
  if (!confirm(msg)) return;

  try {
    const results = await Promise.allSettled(transacoes.map(tx =>
      fetchJWT(`${apiUrl}/${tx.id}`, { method: 'DELETE' })
    ));
    const falhas = results.filter(r => r.status === 'rejected' || (r.value && !r.value.ok)).length;
    if (falhas > 0) {
      alert(`${falhas} transação(ões) não puderam ser excluídas.`);
    } else {
      alert('Transações excluídas com sucesso.');
    }
  } catch (err) {
    console.error('Erro ao excluir transações', err);
    alert('Erro ao excluir transações.');
  }

  reloadGrid();
  await refreshPeriodoData();
}

async function atualizarStatusTodosCartoes(novoStatus) {
  if (!transacoesCartaoCredito.length) {
    alert('Nenhuma transação de cartão encontrada.');
    return;
  }
  if (!confirm(`Atualizar ${transacoesCartaoCredito.length} transação(ões) de cartão para "${novoStatus}"?`)) {
    return;
  }
  try {
    const results = await Promise.allSettled(transacoesCartaoCredito.map(tx =>
      fetchJWT(`${apiUrl}/${tx.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: novoStatus })
      })
    ));
    const falhas = results.filter(r => r.status === 'rejected' || (r.value && !r.value.ok)).length;
    if (falhas > 0) {
      alert(`${falhas} transação(ões) não puderam ser atualizadas.`);
    } else {
      alert('Status atualizado para todas as transações de cartão.');
    }
  } catch (err) {
    console.error('Erro ao atualizar status dos cartões', err);
    alert('Erro ao atualizar status dos cartões.');
  }
  reloadGrid();
  await refreshPeriodoData();
}

async function refreshPeriodoData() {
  const range = buildMonthRange(current);
  await fetchAndRenderSummary(range);
  await fetchCartaoCreditoDados(range);
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
