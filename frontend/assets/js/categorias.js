// categorias.js - Lógica CRUD para categorias

document.addEventListener('DOMContentLoaded', function () {
    carregarCategorias();
    document.getElementById('btnAddCategoria').addEventListener('click', abrirModalAdicionar);
    document.getElementById('saveCategoriaBtn').addEventListener('click', salvarCategoria);
});

function fetchJWT(url, options = {}) {
    const token = localStorage.getItem('access_token');
    options.headers = options.headers || {};
    options.headers['Content-Type'] = options.headers['Content-Type'] || 'application/json';
    options.headers['Authorization'] = 'Bearer ' + token;
    return fetch(url, options);
}

function carregarCategorias() {
    fetchJWT('http://localhost:5000/api/categorias')
        .then(async res => {
            if (!res.ok) {
                let msg = await res.text();
                throw new Error('HTTP ' + res.status + ': ' + msg);
            }
            return res.json();
        })
        .then(data => preencherTabela(data))
        .catch(err => {
            console.error('Erro ao carregar categorias:', err);
            mostrarAlerta('Erro ao carregar categorias: ' + err.message, 'danger');
        });
}

function preencherTabela(categorias) {
    const tbody = document.querySelector('#categoriasTable tbody');
    tbody.innerHTML = '';
    categorias.forEach(cat => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${cat.id}</td>
            <td>${cat.nome}</td>
            <td>${cat.tipo}</td>
            <td>
                <button class="btn btn-sm btn-warning me-1" onclick="abrirModalEditar(${cat.id}, '${cat.nome}', '${cat.tipo}')">Editar</button>
                <button class="btn btn-sm btn-danger" onclick="excluirCategoria(${cat.id})">Excluir</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function abrirModalAdicionar() {
    document.getElementById('categoriaModalLabel').textContent = 'Adicionar Categoria';
    document.getElementById('categoriaId').value = '';
    document.getElementById('categoriaNome').value = '';
    document.getElementById('categoriaTipo').value = '';
    document.getElementById('modalMode').value = 'add';
    new bootstrap.Modal(document.getElementById('categoriaModal')).show();
}

function abrirModalEditar(id, nome, tipo) {
    document.getElementById('categoriaModalLabel').textContent = 'Editar Categoria';
    document.getElementById('categoriaId').value = id;
    document.getElementById('categoriaNome').value = nome;
    document.getElementById('categoriaTipo').value = tipo;
    document.getElementById('modalMode').value = 'edit';
    new bootstrap.Modal(document.getElementById('categoriaModal')).show();
}

function salvarCategoria() {
    const modo = document.getElementById('modalMode').value;
    const id = document.getElementById('categoriaId').value;
    const nome = document.getElementById('categoriaNome').value.trim();
    const tipo = document.getElementById('categoriaTipo').value;
    if (!nome || !tipo) {
        mostrarAlerta('Preencha todos os campos!', 'warning');
        return;
    }
    const categoria = { nome, tipo };
    let url = 'http://localhost:5000/api/categorias';
    let metodo = 'POST';
    if (modo === 'edit') {
        url += `/${id}`;
        metodo = 'PUT';
    }
    let options = {
        method: metodo,
        body: JSON.stringify(categoria)
    };
    fetchJWT(url, options)
    .then(async res => {
        let data = await res.json().catch(() => null);
        if (!res.ok) {
            let msg = (data && typeof data === 'object') ? JSON.stringify(data) : 'Erro ao salvar';
            throw new Error(msg);
        }
        return data;
    })
    .then(() => {
        mostrarAlerta('Categoria salva com sucesso!', 'success');
        bootstrap.Modal.getInstance(document.getElementById('categoriaModal')).hide();
        carregarCategorias();
    })
    .catch(err => mostrarAlerta('Erro ao salvar categoria: ' + err.message, 'danger'));
}

function excluirCategoria(id) {
    if (!confirm('Confirma a exclusão da categoria?')) return;
    let options = {
        method: 'DELETE'
    };
    fetchJWT(`http://localhost:5000/api/categorias/${id}`, options)
        .then(res => {
            if (!res.ok) throw new Error('Erro ao excluir');
            return res.json();
        })
        .then(() => {
            mostrarAlerta('Categoria excluída com sucesso!', 'success');
            carregarCategorias();
        })
        .catch(() => mostrarAlerta('Erro ao excluir categoria', 'danger'));
}

function mostrarAlerta(msg, tipo) {
    const alertArea = document.getElementById('alert-area');
    alertArea.innerHTML = `<div class="alert alert-${tipo} alert-dismissible fade show" role="alert">
        ${msg}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Fechar"></button>
    </div>`;
    setTimeout(() => { alertArea.innerHTML = ''; }, 4000);
}
