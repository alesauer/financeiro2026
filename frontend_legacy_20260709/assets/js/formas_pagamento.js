// formas_pagamento.js - CRUD semelhante a categorias

let formasCache = [];

document.addEventListener('DOMContentLoaded', function () {
  carregarFormas();
  document.getElementById('btnAddForma').addEventListener('click', abrirModalAdicionar);
  document.getElementById('saveFormaBtn').addEventListener('click', salvarForma);
  const cartaoCheckbox = document.getElementById('formaCartaoCredito');
  if (cartaoCheckbox) {
    cartaoCheckbox.addEventListener('change', toggleCamposCartao);
  }
  toggleCamposCartao();
});

function fetchJWT(url, options = {}) {
  const token = localStorage.getItem('access_token');
  if (!token) {
    alert('Sessão expirada. Faça login novamente.');
    window.location.href = 'login.html';
    return Promise.reject(new Error('Token ausente'));
  }
  options.headers = options.headers || {};
  options.headers['Content-Type'] = options.headers['Content-Type'] || 'application/json';
  options.headers['Authorization'] = 'Bearer ' + token;
  return fetch(url, options);
}

const API_BASE = 'http://127.0.0.1:5000/api/formas_pagamento';

function carregarFormas() {
  fetchJWT(API_BASE)
    .then(async res => {
      if (!res.ok) {
        const msg = await res.text();
        throw new Error('HTTP ' + res.status + ': ' + msg);
      }
      return res.json();
    })
    .then(data => {
      formasCache = Array.isArray(data) ? data : [];
      preencherTabela(formasCache);
    })
    .catch(err => mostrarAlerta('Erro ao carregar formas de pagamento: ' + err.message, 'danger'));
}

function preencherTabela(formas) {
  const tbody = document.querySelector('#formasTable tbody');
  tbody.innerHTML = '';
  formas.forEach(fp => {
    const tr = document.createElement('tr');
    const fechamento = fp.dia_fechamento ? `Dia ${fp.dia_fechamento}` : '-';
    const vencimento = fp.dia_vencimento ? `Dia ${fp.dia_vencimento}` : '-';
    tr.innerHTML = `
      <td>${fp.id}</td>
      <td>${fp.nome}</td>
      <td>${fp.tipo}</td>
      <td>${fp.cartao_credito ? 'Sim' : 'Não'}</td>
      <td>${fechamento}</td>
      <td>${vencimento}</td>
      <td>${fp.ativo ? 'Sim' : 'Não'}</td>
      <td class="text-nowrap">
        <div class="btn-group" role="group" aria-label="Ações">
          <button class="btn btn-sm btn-warning" onclick="abrirModalEditar(${fp.id})">Editar</button>
          <button class="btn btn-sm btn-danger ms-1" onclick="excluirForma(${fp.id})">Excluir</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function abrirModalAdicionar() {
  document.getElementById('formaModalLabel').textContent = 'Adicionar Forma';
  document.getElementById('formaId').value = '';
  document.getElementById('formaNome').value = '';
  document.getElementById('formaTipo').value = '';
  document.getElementById('formaCartaoCredito').checked = false;
  document.getElementById('formaDiaFechamento').value = '';
  document.getElementById('formaDiaVencimento').value = '';
  document.getElementById('formaAtivo').checked = true;
  document.getElementById('modalMode').value = 'add';
  toggleCamposCartao();
  new bootstrap.Modal(document.getElementById('formaModal')).show();
}

function abrirModalEditar(id) {
  const forma = formasCache.find(f => f.id === id);
  if (!forma) {
    mostrarAlerta('Não foi possível carregar os dados da forma selecionada.', 'danger');
    return;
  }
  document.getElementById('formaModalLabel').textContent = 'Editar Forma';
  document.getElementById('formaId').value = id;
  document.getElementById('formaNome').value = forma.nome || '';
  document.getElementById('formaTipo').value = forma.tipo || '';
  document.getElementById('formaCartaoCredito').checked = !!forma.cartao_credito;
  document.getElementById('formaDiaFechamento').value = forma.dia_fechamento ?? '';
  document.getElementById('formaDiaVencimento').value = forma.dia_vencimento ?? '';
  document.getElementById('formaAtivo').checked = !!forma.ativo;
  document.getElementById('modalMode').value = 'edit';
  toggleCamposCartao();
  new bootstrap.Modal(document.getElementById('formaModal')).show();
}

function salvarForma() {
  const modo = document.getElementById('modalMode').value;
  const id = document.getElementById('formaId').value;
  const nome = document.getElementById('formaNome').value.trim();
  const tipo = document.getElementById('formaTipo').value.trim();
  const cartao_credito = document.getElementById('formaCartaoCredito').checked;
  const ativo = document.getElementById('formaAtivo').checked;
  const diaFechamentoInput = document.getElementById('formaDiaFechamento').value;
  const diaVencimentoInput = document.getElementById('formaDiaVencimento').value;
  if (!nome || !tipo) {
    mostrarAlerta('Preencha Nome e Tipo!', 'warning');
    return;
  }
  const payload = { nome, tipo, cartao_credito, ativo };
  if (cartao_credito) {
    payload.dia_fechamento = diaFechamentoInput ? Number(diaFechamentoInput) : null;
    payload.dia_vencimento = diaVencimentoInput ? Number(diaVencimentoInput) : null;
  } else {
    payload.dia_fechamento = null;
    payload.dia_vencimento = null;
  }
  let url = API_BASE;
  let metodo = 'POST';
  if (modo === 'edit') {
    url += `/${id}`;
    metodo = 'PUT';
  }
  const options = { method: metodo, body: JSON.stringify(payload) };
  fetchJWT(url, options)
    .then(async res => {
      const data = await res.json().catch(()=>null);
      if (!res.ok) {
        const msg = data ? JSON.stringify(data) : 'Erro ao salvar';
        throw new Error(msg);
      }
      return data;
    })
    .then(() => {
      mostrarAlerta('Forma de pagamento salva com sucesso!', 'success');
      bootstrap.Modal.getInstance(document.getElementById('formaModal')).hide();
      carregarFormas();
    })
    .catch(err => mostrarAlerta('Erro ao salvar forma: ' + err.message, 'danger'));
}

function excluirForma(id) {
  if (!confirm('Confirma a exclusão da forma de pagamento?')) return;
  const options = { method: 'DELETE' };
  fetchJWT(`${API_BASE}/${id}`, options)
    .then(res => {
      if (!res.ok) throw new Error('Erro ao excluir');
      return res.json();
    })
    .then(() => {
      mostrarAlerta('Forma de pagamento excluída com sucesso!', 'success');
      carregarFormas();
    })
    .catch(() => mostrarAlerta('Erro ao excluir forma de pagamento', 'danger'));
}

function mostrarAlerta(msg, tipo) {
  const alertArea = document.getElementById('alert-area');
  alertArea.innerHTML = `<div class="alert alert-${tipo} alert-dismissible fade show" role="alert">
    ${msg}
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Fechar"></button>
  </div>`;
  setTimeout(() => { alertArea.innerHTML = ''; }, 4000);
}

function toggleCamposCartao() {
  const isCartao = document.getElementById('formaCartaoCredito').checked;
  document.getElementById('formaDiaFechamento').disabled = !isCartao;
  document.getElementById('formaDiaVencimento').disabled = !isCartao;
  if (!isCartao) {
    document.getElementById('formaDiaFechamento').value = '';
    document.getElementById('formaDiaVencimento').value = '';
  }
}

function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
