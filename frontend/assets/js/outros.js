// outros.js - Lógica inicial para tela de configurações "Outros"

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
    mostrarAlerta('Configurações salvas! (integração backend em breve)');
}

function descartarAlteracoes() {
    const form = document.getElementById('outrosForm');
    if (!form) return;
    form.reset();
    mostrarAlerta('Alterações descartadas.');
}
