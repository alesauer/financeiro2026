// JS Investimentos: KPIs, gráficos e tabela consumindo o backend

let state = {
  page: 1,
  per_page: 10,
  inicio: null,
  fim: null,
  categoria_id: '',
  ultimoResumo: null,
  chartEvolucao: null,
  chartCategorias: null,
};

function fmtBRL(v){
  const n = Number(v || 0);
  return n.toLocaleString('pt-BR', { style:'currency', currency:'BRL' });
}

// Detecta base da API: quando rodando via Live Server (5500), usa backend 5000
const API_BASE = (() => {
  const stored = localStorage.getItem('api_base');
  if (stored) return stored.replace(/\/$/, '');
  if (window.location.port === '5500') return 'http://localhost:5000';
  return '';
})();

function api(path){
  return `${API_BASE}${path}`;
}

function getToken(){
  return localStorage.getItem('access_token');
}

function headersAuth(){
  const t = getToken();
  return t ? { 'Authorization': 'Bearer ' + t } : {};
}

function periodoDefault(){
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth();
  const inicio = new Date(ano, mes, 1);
  const fim = new Date(ano, mes+1, 0);
  return {
    inicio: inicio.toISOString().slice(0,10),
    fim: fim.toISOString().slice(0,10),
    ano: ano,
    mes: mes+1
  };
}

async function init(){
  // set default period
  const p = periodoDefault();
  const elInicio = document.getElementById('inicio');
  const elFim = document.getElementById('fim');
  if(elInicio) elInicio.value = p.inicio;
  if(elFim) elFim.value = p.fim;
  state.inicio = p.inicio;
  state.fim = p.fim;

  // carregar categorias
  await carregarCategorias();

  // carregar KPIs e gráficos
  await carregarResumoMes(p.ano, p.mes);
  await carregarKpisPeriodo();

  // carregar tabela
  await carregarTabela();

  // bind eventos
  const btnAplicar = document.getElementById('btn-aplicar');
  if(btnAplicar){
    btnAplicar.addEventListener('click', async ()=>{
      state.inicio = (document.getElementById('inicio')||{}).value || p.inicio;
      state.fim = (document.getElementById('fim')||{}).value || p.fim;
      state.categoria_id = (document.getElementById('filtro-categoria')||{}).value || '';
      state.page = 1;
      await carregarKpisPeriodo();
      await carregarTabela();
      await carregarGraficoCategorias();
    });
  }

  const btnPrev = document.getElementById('btn-prev');
  const btnNext = document.getElementById('btn-next');
  if(btnPrev) btnPrev.addEventListener('click', async ()=>{ if(state.page>1){ state.page--; await carregarTabela(); }});
  if(btnNext) btnNext.addEventListener('click', async ()=>{ state.page++; await carregarTabela(); });

  const btnSalvar = document.getElementById('btn-salvar');
  if(btnSalvar) btnSalvar.addEventListener('click', salvarInvestimento);
}

async function carregarCategorias(){
  try{
    const r = await fetch(api('/api/categorias'));
    const data = await r.json();
    const selFiltro = document.getElementById('filtro-categoria');
    const selNv = document.getElementById('nv-categoria');
    if(selNv) selNv.innerHTML = '';
    (data||[]).forEach(c=>{
      if(selNv){ const opt1 = document.createElement('option'); opt1.value = c.id; opt1.textContent = c.nome; selNv.appendChild(opt1); }
      if(selFiltro){ const opt2 = document.createElement('option'); opt2.value = c.id; opt2.textContent = c.nome; selFiltro.appendChild(opt2); }
    });
  }catch(e){ console.error('categorias', e); }
}

async function carregarResumoMes(ano, mes){
  try{
    const r = await fetch(api(`/api/relatorios/resumo?ano=${ano}&mes=${mes}`));
    const data = await r.json();
    state.ultimoResumo = data;
    const totalMes = (data.acum_invest && data.acum_invest.length) ? data.acum_invest[data.acum_invest.length-1] : 0;
    const kpiMes = document.getElementById('kpi-total-mes');
    if(kpiMes) kpiMes.textContent = fmtBRL(totalMes);
    desenharGraficoEvolucao(data.dias, data.acum_invest);
  }catch(e){ console.error('resumo mes', e); }
}

async function carregarKpisPeriodo(){
  let totalPeriodo = 0;
  try{
    const r = await fetch(api(`/api/relatorios/totais?inicio=${state.inicio}&fim=${state.fim}`));
    const arr = await r.json();
    const inv = (arr||[]).find(x=>x.tipo==='Investimento');
    totalPeriodo = inv ? Number(inv.total) : 0;
    const kpiPeriodo = document.getElementById('kpi-total-periodo');
    if(kpiPeriodo) kpiPeriodo.textContent = fmtBRL(totalPeriodo);
  }catch(e){ console.error('totais', e); }

  try{
    const url = new URL(api('/api/transacoes'));
    url.searchParams.set('tipo','Investimento');
    url.searchParams.set('inicio', state.inicio);
    url.searchParams.set('fim', state.fim);
    url.searchParams.set('per_page', 1); // só precisamos da contagem
    const r = await fetch(url);
    const js = await r.json();
    const qtde = js && js.total_items ? Number(js.total_items) : 0;
    const elQtde = document.getElementById('kpi-qtde'); if(elQtde) elQtde.textContent = qtde;
    const medio = qtde>0 ? (totalPeriodo/qtde) : 0;
    const elMedio = document.getElementById('kpi-medio'); if(elMedio) elMedio.textContent = fmtBRL(medio);
  }catch(e){ console.error('listar inv', e); }

  await carregarGraficoCategorias();
}

async function carregarGraficoCategorias(){
  try{
    const r = await fetch(api(`/api/relatorios/categorias?inicio=${state.inicio}&fim=${state.fim}&tipo=Investimento`));
    const data = await r.json();
    const labels = (data||[]).map(x=>x.categoria);
    const valores = (data||[]).map(x=>Number(x.total));
    desenharGraficoCategorias(labels, valores);
  }catch(e){ console.error('categorias periodo', e); }
}

async function carregarTabela(){
  try{
    const url = new URL(api('/api/transacoes'));
    url.searchParams.set('tipo', 'Investimento');
    url.searchParams.set('page', state.page);
    url.searchParams.set('per_page', state.per_page);
    url.searchParams.set('sort_field', 'data_transacao');
    url.searchParams.set('sort_order', 'desc');
    if(state.inicio && state.fim){
      url.searchParams.set('inicio', state.inicio);
      url.searchParams.set('fim', state.fim);
    }
    if(state.categoria_id){ url.searchParams.set('categoria_id', state.categoria_id); }

    const r = await fetch(url);
    const js = await r.json();

    const tbody = document.getElementById('tabela-investimentos');
    if(!tbody){ return; }
    tbody.innerHTML='';
    (js.items||[]).forEach(t=>{
      const tr = document.createElement('tr');
      const data = t.data_transacao;
      tr.innerHTML = `
        <td>${data||''}</td>
        <td>${t.descricao||''}</td>
        <td>${t.categoria_nome||t.categoria_id||''}</td>
        <td class="text-end">${fmtBRL(t.valor)}</td>
        <td>${t.forma_pagamento||''}</td>
        <td>${t.status||''}</td>
        <td>
          <button class="btn btn-sm btn-outline-primary" onclick="editar(${t.id})">Editar</button>
          <button class="btn btn-sm btn-outline-danger" onclick="excluir(${t.id})">Excluir</button>
        </td>`;
      tbody.appendChild(tr);
    });

    const info = document.getElementById('paginacao-info');
    if(info) info.textContent = `Página ${js.current_page||1} de ${js.total_pages||1}`;
  }catch(e){ console.error('tabela', e); }
}

function desenharGraficoEvolucao(labels, data){
  const ctx = document.getElementById('grafico-evolucao');
  if(!ctx) return;
  if(state.chartEvolucao){ state.chartEvolucao.destroy(); }
  state.chartEvolucao = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Acúmulo (mês)',
        data,
        borderColor: '#0d6efd',
        backgroundColor: 'rgba(13,110,253,0.1)',
        tension: 0.3,
        fill: true,
      }]
    },
    options: {responsive:true, plugins:{legend:{display:false}}}
  });
}

function desenharGraficoCategorias(labels, data){
  const ctx = document.getElementById('grafico-categorias');
  if(!ctx) return;
  if(state.chartCategorias){ state.chartCategorias.destroy(); }
  const colors = labels.map((_,i)=>`hsl(${(i*57)%360} 80% 55%)`);
  state.chartCategorias = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets:[{ data, backgroundColor: colors }] },
    options: {responsive:true}
  });
}

async function salvarInvestimento(){
  const msg = document.getElementById('nv-msg');
  if(msg){ msg.textContent=''; msg.className='small'; }
  const payload = {
    tipo: 'Investimento',
    descricao: (document.getElementById('nv-descricao')||{}).value?.trim(),
    valor: Number((document.getElementById('nv-valor')||{}).value),
    data_transacao: (document.getElementById('nv-data')||{}).value || undefined,
    categoria_id: Number((document.getElementById('nv-categoria')||{}).value),
    forma_pagamento: (document.getElementById('nv-forma')||{}).value?.trim(),
    status: (document.getElementById('nv-status')||{}).value || 'Pago'
  };
  if(!payload.descricao || !payload.valor || !payload.categoria_id || !payload.forma_pagamento){
    if(msg){ msg.textContent='Preencha os campos obrigatórios.'; msg.classList.add('text-danger'); }
    return;
  }
  try{
    const r = await fetch(api('/api/transacoes'), {
      method:'POST',
      headers: { 'Content-Type':'application/json', ...headersAuth() },
      body: JSON.stringify(payload)
    });
    if(!r.ok){
      const err = await r.json().catch(()=>({}));
      if(msg){ msg.textContent = 'Erro ao salvar: ' + (JSON.stringify(err) || r.status); msg.classList.add('text-danger'); }
      return;
    }
    if(msg){ msg.textContent='Salvo com sucesso!'; msg.classList.add('text-success'); }
    await carregarKpisPeriodo();
    await carregarTabela();
  }catch(e){ if(msg){ msg.textContent='Erro de rede'; msg.classList.add('text-danger'); } }
}

// ações editar/excluir (básico)
async function excluir(id){
  if(!confirm('Excluir este lançamento?')) return;
  try{
    const r = await fetch(api(`/api/transacoes/${id}`), { method:'DELETE', headers: headersAuth() });
    if(r.ok){ await carregarTabela(); await carregarKpisPeriodo(); }
  }catch(e){ console.error('excluir', e); }
}

function editar(id){
  alert('Em breve: edição do registro ' + id);
}

document.addEventListener('DOMContentLoaded', init);
