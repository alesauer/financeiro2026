// usuarios.js - Lógica CRUD para usuários

document.addEventListener('DOMContentLoaded', function () {
    carregarUsuarios();
    document.getElementById('btnAddUsuario').addEventListener('click', abrirModalAdicionar);
    document.getElementById('saveUsuarioBtn').addEventListener('click', salvarUsuario);
});

function carregarUsuarios() {
    fetch('http://localhost:5000/api/usuarios')
        .then(async res => {
            if (!res.ok) {
                let msg = await res.text();
                throw new Error('HTTP ' + res.status + ': ' + msg);
            }
            return res.json();
        })
        .then(data => preencherTabela(data))
        .catch(err => {
            console.error('Erro ao carregar usuários:', err);
            mostrarAlerta('Erro ao carregar usuários: ' + err.message, 'danger');
        });
}

function preencherTabela(usuarios) {
    const tbody = document.querySelector('#usuariosTable tbody');
    tbody.innerHTML = '';
    usuarios.forEach(u => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${u.id}</td>
            <td>${u.nome}</td>
            <td>${u.email}</td>
            <td>${u.data_criacao ? new Date(u.data_criacao).toLocaleString('pt-BR') : ''}</td>
            <td>
                <button class="btn btn-sm btn-warning me-1" onclick="abrirModalEditar(${u.id}, '${u.nome}', '${u.email}')">Editar</button>
                <button class="btn btn-sm btn-danger" onclick="excluirUsuario(${u.id})">Excluir</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function abrirModalAdicionar() {
    document.getElementById('usuarioModalLabel').textContent = 'Adicionar Usuário';
    document.getElementById('usuarioId').value = '';
    document.getElementById('usuarioNome').value = '';
    document.getElementById('usuarioEmail').value = '';
    document.getElementById('usuarioSenha').value = '';
    document.getElementById('senhaDiv').style.display = '';
    document.getElementById('modalMode').value = 'add';
    new bootstrap.Modal(document.getElementById('usuarioModal')).show();
}

function abrirModalEditar(id, nome, email) {
    document.getElementById('usuarioModalLabel').textContent = 'Editar Usuário';
    document.getElementById('usuarioId').value = id;
    document.getElementById('usuarioNome').value = nome;
    document.getElementById('usuarioEmail').value = email;
    document.getElementById('usuarioSenha').value = '';
    document.getElementById('senhaDiv').style.display = 'none';
    document.getElementById('modalMode').value = 'edit';
    new bootstrap.Modal(document.getElementById('usuarioModal')).show();
}

function salvarUsuario() {
    const modo = document.getElementById('modalMode').value;
    const id = document.getElementById('usuarioId').value;
    const nome = document.getElementById('usuarioNome').value.trim();
    const email = document.getElementById('usuarioEmail').value.trim();
    const senha = document.getElementById('usuarioSenha').value;
    if (!nome || !email || (modo === 'add' && !senha)) {
        mostrarAlerta('Preencha todos os campos!', 'warning');
        return;
    }
    let usuario = { nome, email };
    if (modo === 'add') usuario.senha = senha;
    let url = 'http://localhost:5000/api/usuarios';
    let metodo = 'POST';
    if (modo === 'edit') {
        url += `/${id}`;
        metodo = 'PUT';
        if (senha) usuario.senha = senha;
    }
    fetch(url, {
        method: metodo,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(usuario)
    })
    .then(async res => {
        let data = await res.json().catch(() => null);
        if (!res.ok) {
            let msg = (data && typeof data === 'object') ? JSON.stringify(data) : 'Erro ao salvar';
            throw new Error(msg);
        }
        return data;
    })
    .then(() => {
        mostrarAlerta('Usuário salvo com sucesso!', 'success');
        bootstrap.Modal.getInstance(document.getElementById('usuarioModal')).hide();
        carregarUsuarios();
    })
    .catch(err => mostrarAlerta('Erro ao salvar usuário: ' + err.message, 'danger'));
}

function excluirUsuario(id) {
    if (!confirm('Confirma a exclusão do usuário?')) return;
    fetch(`http://localhost:5000/api/usuarios/${id}`, { method: 'DELETE' })
        .then(res => {
            if (!res.ok) throw new Error('Erro ao excluir');
            return res.json();
        })
        .then(() => {
            mostrarAlerta('Usuário excluído com sucesso!', 'success');
            carregarUsuarios();
        })
        .catch(() => mostrarAlerta('Erro ao excluir usuário', 'danger'));
}

function mostrarAlerta(msg, tipo) {
    const alertArea = document.getElementById('alert-area');
    alertArea.innerHTML = `<div class="alert alert-${tipo} alert-dismissible fade show" role="alert">
        ${msg}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Fechar"></button>
    </div>`;
    setTimeout(() => { alertArea.innerHTML = ''; }, 4000);
}
