// outros.js - Lógica inicial para tela de configurações "Outros"

document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('btnGerarApiKey').addEventListener('click', gerarApiKey);
    document.getElementById('btnBackup').addEventListener('click', () => mostrarAlerta('Backup iniciado!'));
    document.getElementById('btnExportar').addEventListener('click', () => mostrarAlerta('Exportação iniciada!'));
    document.getElementById('btnImportar').addEventListener('click', () => mostrarAlerta('Importação iniciada!'));
    document.getElementById('btnLimparCache').addEventListener('click', () => mostrarAlerta('Cache limpo!'));
    document.getElementById('btnResetar').addEventListener('click', () => mostrarAlerta('Configurações resetadas!'));
    document.getElementById('outrosForm').addEventListener('submit', salvarConfiguracoes);
});

function gerarApiKey() {
    const key = 'api_' + Math.random().toString(36).substring(2, 18);
    document.getElementById('apiKey').value = key;
    mostrarAlerta('API Key gerada!');
}

function mostrarAlerta(msg) {
    const alertArea = document.getElementById('alert-area');
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
