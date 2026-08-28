// outros.js - Lógica inicial para tela de configurações "Outros"
// API base: se não estiver no 5000, usa http://localhost:5000 por padrão
const API_BASE = window.API_BASE || (window.location.port === '5000' ? '' : 'http://localhost:5000');

document.addEventListener('DOMContentLoaded', function () {
    console.info('[outros.js] DOMContentLoaded');
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
    // Alertas config (switches + limite)
    loadAlertasConfigFromBackend().finally(() => {
        bindAlertasImmediateSave();
    });

    // Sobre o Sistema
    loadSobreSistemaFromBackend().finally(() => {
        bindSobreSistemaImmediateSave();
    });

    // Usuário (dados e troca de senha)
    loadUsuarioMeFromBackend();
    bindUserPasswordChange();

    // Rebind ao mostrar a aba de Usuário (por segurança)
    const usuarioTabBtn = document.getElementById('tab-usuario-tab');
    if (usuarioTabBtn) {
        usuarioTabBtn.addEventListener('shown.bs.tab', () => {
            console.info('[outros.js] aba Usuário exibida');
            bindUserPasswordChange();
        });
    }
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
    Promise.all([
        saveEmailsToBackend(),
        saveAlertasConfigToBackend(),
    ]).then(results => {
        const ok = results.every(Boolean);
        if (ok) mostrarAlerta('Configurações salvas!');
        else mostrarAlerta('Configurações salvas parcialmente. Verifique sua conexão ou login.');
    }).catch(() => mostrarAlerta('Configurações salvas localmente. (Erro ao salvar no servidor)'));
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

async function loadAlertasConfigFromBackend() {
    try {
        const resp = await fetch(`${API_BASE}/api/config/alertas-config`, {
            method: 'GET',
            headers: getAuthHeaders(),
            credentials: 'include',
        });
        if (!resp.ok) return false;
        const data = await resp.json();
        // aplica nos campos
        const ligado = document.getElementById('alertaLigado');
        const notifEmail = document.getElementById('notificacoesEmail');
        const notifZap = document.getElementById('notificacoesWhatsapp');
        const limite = document.getElementById('limiteAlerta');
        if (ligado) ligado.checked = !!data.ligado;
        if (notifEmail) notifEmail.checked = !!data.email;
        if (notifZap) notifZap.checked = !!data.whatsapp;
        if (limite && typeof data.limite !== 'undefined') limite.value = data.limite;
        return true;
    } catch (e) {
        return false;
    }
}

async function saveAlertasConfigToBackend() {
    try {
        const ligado = !!(document.getElementById('alertaLigado')?.checked);
        const email = !!(document.getElementById('notificacoesEmail')?.checked);
        const whatsapp = !!(document.getElementById('notificacoesWhatsapp')?.checked);
        const limiteStr = (document.getElementById('limiteAlerta')?.value || '').trim();
        const limite = limiteStr ? parseFloat(limiteStr) : 0;
        const body = { ligado, email, whatsapp, limite };
        const resp = await fetch(`${API_BASE}/api/config/alertas-config`, {
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

function bindAlertasImmediateSave() {
    const ligado = document.getElementById('alertaLigado');
    const notifEmail = document.getElementById('notificacoesEmail');
    const notifZap = document.getElementById('notificacoesWhatsapp');
    const limite = document.getElementById('limiteAlerta');

    const immediate = () => {
        saveAlertasConfigToBackend().then(ok => {
            if (!ok) mostrarAlerta('Não foi possível salvar preferências agora. Verifique sua conexão ou login.');
        });
    };

    if (ligado) ligado.addEventListener('change', immediate);
    if (notifEmail) notifEmail.addEventListener('change', immediate);
    if (notifZap) notifZap.addEventListener('change', immediate);

    let timer;
    const debounced = () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
            // Normaliza valor mínimo 0
            const el = document.getElementById('limiteAlerta');
            if (el) {
                const v = parseFloat((el.value || '0').replace(',', '.'));
                if (isNaN(v) || v < 0) el.value = 0;
            }
            immediate();
        }, 500);
    };
    if (limite) {
        limite.addEventListener('input', debounced);
        limite.addEventListener('change', immediate);
    }
}

// ================= Sobre o Sistema =================
async function loadSobreSistemaFromBackend() {
    try {
        const resp = await fetch(`${API_BASE}/api/config/sobre-sistema`, {
            method: 'GET',
            headers: getAuthHeaders(),
            credentials: 'include',
        });
        if (!resp.ok) return false;
        const data = await resp.json();
        const desc = document.getElementById('descricaoSistema');
        const versao = document.getElementById('versaoSistema');
        const usuario = document.getElementById('usuarioLogado');
        const dataHora = document.getElementById('dataHoraSistema');
        if (desc) desc.value = data.descricao || '';
        if (versao) versao.value = data.versao || '';
        if (usuario) usuario.textContent = data.usuario_logado || '—';
        if (dataHora) dataHora.textContent = data.data_hora || '—';
        return true;
    } catch (e) {
        return false;
    }
}

async function saveSobreSistemaToBackend() {
    try {
        const desc = (document.getElementById('descricaoSistema')?.value || '').trim();
        const versao = (document.getElementById('versaoSistema')?.value || '').trim();
        const body = { descricao: desc, versao };
        const resp = await fetch(`${API_BASE}/api/config/sobre-sistema`, {
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

function bindSobreSistemaImmediateSave() {
    const desc = document.getElementById('descricaoSistema');
    const versao = document.getElementById('versaoSistema');
    const immediate = () => {
        saveSobreSistemaToBackend().then(ok => {
            if (!ok) mostrarAlerta('Não foi possível salvar Sobre o Sistema agora. Verifique sua conexão ou login.');
        });
    };
    if (desc) {
        let t1;
        desc.addEventListener('input', () => {
            clearTimeout(t1);
            t1 = setTimeout(immediate, 600);
        });
        desc.addEventListener('change', immediate);
        desc.addEventListener('blur', immediate);
    }
    if (versao) {
        let t2;
        versao.addEventListener('input', () => {
            clearTimeout(t2);
            t2 = setTimeout(immediate, 600);
        });
        versao.addEventListener('change', immediate);
        versao.addEventListener('blur', immediate);
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

// ================= Usuário (Me e senha) =================
async function loadUsuarioMeFromBackend() {
    try {
        const resp = await fetch(`${API_BASE}/api/usuarios/me`, {
            method: 'GET',
            headers: getAuthHeaders(),
            credentials: 'include',
        });
        if (!resp.ok) return false;
        const data = await resp.json();
        const nome = document.getElementById('userNome');
        const email = document.getElementById('userEmail');
        if (nome) nome.textContent = data.nome || '—';
        if (email) email.textContent = data.email || '—';
        return true;
    } catch (e) {
        return false;
    }
}

function bindUserPasswordChange() {
    const btn = document.getElementById('btnChangePassword');
    if (!btn) {
        console.warn('[outros.js] btnChangePassword não encontrado no DOM');
        return;
    }
    // Evita múltiplos binds: remove listeners antigos marcando um flag
    if (btn._boundClick) return;
    btn._boundClick = true;
    console.info('[outros.js] bindUserPasswordChange: handler vinculado');

    btn.addEventListener('click', async () => {
        console.info('[outros.js] Alterar senha: click');
        const token = localStorage.getItem('access_token');
        if (!token) {
            console.warn('[outros.js] Sem token no localStorage');
            mostrarAlerta('Você precisa estar logado para alterar a senha. Faça login e tente novamente.');
            return;
        }
        const senhaAtual = (document.getElementById('senhaAtual')?.value || '').trim();
        const senhaNova = (document.getElementById('senhaNova')?.value || '').trim();
        const senhaConfirm = (document.getElementById('senhaNovaConfirm')?.value || '').trim();

        if (!senhaAtual || !senhaNova || !senhaConfirm) {
            mostrarAlerta('Preencha todos os campos de senha.');
            return;
        }
        if (senhaNova.length < 6) {
            mostrarAlerta('A nova senha deve ter pelo menos 6 caracteres.');
            return;
        }
        if (senhaNova !== senhaConfirm) {
            mostrarAlerta('A confirmação da senha não confere.');
            return;
        }

        try {
            btn.disabled = true;
            btn.textContent = 'Alterando...';
            console.info('[outros.js] Chamando API', `${API_BASE}/api/usuarios/change-password`);
            const resp = await fetch(`${API_BASE}/api/usuarios/change-password`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ senha_atual: senhaAtual, senha_nova: senhaNova, senha_confirm: senhaConfirm }),
                credentials: 'include',
            });
            const data = await resp.json().catch(() => ({}));
            console.info('[outros.js] Resposta change-password', resp.status, data);
            if (resp.ok) {
                mostrarAlerta(data.msg || 'Senha alterada com sucesso.');
                // Limpa campos manualmente
                const a = document.getElementById('senhaAtual');
                const n = document.getElementById('senhaNova');
                const c = document.getElementById('senhaNovaConfirm');
                if (a) a.value = '';
                if (n) n.value = '';
                if (c) c.value = '';
            } else {
                mostrarAlerta(data.erro || 'Não foi possível alterar a senha. Verifique os dados e tente novamente.');
            }
        } catch (e) {
            console.error('[outros.js] Erro change-password', e);
            mostrarAlerta('Erro ao comunicar com o servidor.');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Alterar senha';
        }
    });
}
