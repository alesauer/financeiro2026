// outros.js - Lógica inicial para tela de configurações "Outros"
// API base: se não estiver no 5000, usa http://localhost:5000 por padrão
const API_BASE = window.API_BASE || (window.location.port === '5000' ? '' : 'http://localhost:5000');

document.addEventListener('DOMContentLoaded', function () {
    // Bind seguro: só adiciona listener se o elemento existir
    bindClick('btnGerarApiKey', gerarApiKey);
    bindClick('btnBackup', () => mostrarAlerta('Backup iniciado!'));
    bindClick('btnExportar', () => mostrarAlerta('Exportação iniciada!'));
    bindClick('btnImportar', () => mostrarAlerta('Importação iniciada!'));
    bindClick('btnLimparCache', () => mostrarAlerta('Cache limpo!'));
    bindClick('btnResetar', () => mostrarAlerta('Configurações resetadas!'));
    bindClick('btnDescartar', descartarAlteracoes);

    const form = document.getElementById('outrosForm');
    if (form) form.addEventListener('submit', salvarConfiguracoes);

    // Emails de alerta
    initEmailsAlerta();
});

function bindClick(id, handler) {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', handler);
}

function gerarApiKey() {
    const key = 'api_' + Math.random().toString(36).substring(2, 18);
    document.getElementById('apiKey').value = key;
    mostrarAlerta('API Key gerada!');
}

function mostrarAlerta(msg) {
    const alertArea = document.getElementById('alert-area');
    if (!alertArea) return;
    alertArea.innerHTML = `<div class="alert alert-info alert-dismissible fade show" role="alert">
        ${msg}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Fechar"></button>
    </div>`;
    setTimeout(() => { alertArea.innerHTML = ''; }, 3000);
}

function salvarConfiguracoes(e) {
    e.preventDefault();
    // Garante que o campo oculto esteja atualizado
    updateEmailsAlertaHidden();
    // Tenta salvar no backend
    saveEmailsToBackend()
        .then(ok => {
            if (ok) {
                mostrarAlerta('Configurações salvas!');
            } else {
                mostrarAlerta('Configurações salvas localmente. (Falha ao salvar no servidor)');
            }
        })
        .catch(() => mostrarAlerta('Configurações salvas localmente. (Erro ao salvar no servidor)'));
}

function descartarAlteracoes() {
    const form = document.getElementById('outrosForm');
    if (!form) return;
    form.reset();
    mostrarAlerta('Alterações descartadas.');
}

// ================= Emails de Alerta =================
let emailsAlerta = new Set();

function initEmailsAlerta() {
    const input = document.getElementById('emailAlertaInput');
    const btnAdd = document.getElementById('btnAddEmail');
    const list = document.getElementById('listaEmailsAlerta');

    if (!input || !btnAdd || !list) return;

    // Carrega do backend, com fallback para hidden
    loadEmailsFromBackend().finally(() => {
        if (emailsAlerta.size === 0) {
            const hidden = document.getElementById('emailsAlertaHidden');
            if (hidden && hidden.value) {
                try {
                    const parsed = JSON.parse(hidden.value);
                    if (Array.isArray(parsed)) parsed.forEach(e => emailsAlerta.add(String(e).trim().toLowerCase()));
                } catch {
                    // fallback: CSV
                    hidden.value.split(',').map(s => s.trim().toLowerCase()).filter(Boolean).forEach(e => emailsAlerta.add(e));
                }
                renderEmailsAlerta();
            }
        }
    });

    btnAdd.addEventListener('click', () => {
        const email = (input.value || '').trim().toLowerCase();
        if (!email) return;
        if (!isValidEmail(email)) {
            mostrarAlerta('E-mail inválido. Verifique e tente novamente.');
            return;
        }
        if (emailsAlerta.has(email)) {
            mostrarAlerta('Este e-mail já foi adicionado.');
            return;
        }
        emailsAlerta.add(email);
        input.value = '';
        renderEmailsAlerta();
        // Persistência imediata no backend
        addEmailToBackend(email).then(ok => {
            if (!ok) mostrarAlerta('Não foi possível salvar no servidor agora. Tente salvar as configurações.');
        });
    });

    input.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') {
            ev.preventDefault();
            btnAdd.click();
        }
    });

    list.addEventListener('click', (ev) => {
        const btn = ev.target.closest('[data-remove-email]');
        if (!btn) return;
        const email = btn.getAttribute('data-remove-email');
        if (email && emailsAlerta.has(email)) {
            emailsAlerta.delete(email);
            renderEmailsAlerta();
            // Remoção imediata no backend
            removeEmailFromBackend(email).then(ok => {
                if (!ok) mostrarAlerta('Não foi possível remover no servidor agora. Tente salvar as configurações.');
            });
        }
    });
}

function renderEmailsAlerta() {
    const list = document.getElementById('listaEmailsAlerta');
    if (!list) return;
    list.innerHTML = '';
    const items = Array.from(emailsAlerta.values());
    if (!items.length) {
        list.innerHTML = '<li class="list-group-item text-muted">Nenhum e-mail adicionado.</li>';
    } else {
        items.forEach(email => {
            const li = document.createElement('li');
            li.className = 'list-group-item d-flex justify-content-between align-items-center';
            li.innerHTML = `
                <span>${email}</span>
                <button type="button" class="btn btn-sm btn-outline-danger" data-remove-email="${email}">Remover</button>
            `;
            list.appendChild(li);
        });
    }
    updateEmailsAlertaHidden();
}

function updateEmailsAlertaHidden() {
    const hidden = document.getElementById('emailsAlertaHidden');
    if (!hidden) return;
    hidden.value = JSON.stringify(Array.from(emailsAlerta.values()));
}

function isValidEmail(email) {
    // Validação simples
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
    return re.test(email);
}

// ================= Backend integration =================
function getAuthHeaders() {
    const token = localStorage.getItem('access_token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
}

async function loadEmailsFromBackend() {
    try {
        const resp = await fetch(`${API_BASE}/api/config/emails-alerta`, {
            method: 'GET',
            headers: getAuthHeaders(),
            credentials: 'include',
        });
        if (!resp.ok) return false;
        const data = await resp.json();
        const arr = Array.isArray(data.emails) ? data.emails : [];
        emailsAlerta = new Set(arr.map(e => String(e).trim().toLowerCase()));
        renderEmailsAlerta();
        return true;
    } catch (e) {
        return false;
    }
}

async function saveEmailsToBackend() {
    try {
        const body = { emails: Array.from(emailsAlerta.values()) };
        const resp = await fetch(`${API_BASE}/api/config/emails-alerta`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(body),
            credentials: 'include',
        });
        return resp.ok;
    } catch (e) {
        return false;
    }
}

async function addEmailToBackend(email) {
    try {
        const resp = await fetch(`${API_BASE}/api/config/emails-alerta`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ email }),
            credentials: 'include',
        });
        return resp.ok;
    } catch (e) {
        return false;
    }
}

async function removeEmailFromBackend(email) {
    try {
        const resp = await fetch(`${API_BASE}/api/config/emails-alerta`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
            body: JSON.stringify({ email }),
            credentials: 'include',
        });
        return resp.ok;
    } catch (e) {
        return false;
    }
}
