const API_BASE = 'http://127.0.0.1:5000';

document.getElementById('loginForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const senha = document.getElementById('senha').value;
    const msg = document.getElementById('msg');
    msg.textContent = '';

    try {
    const resp = await fetch(`${API_BASE}/api/usuarios/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, senha })
        });
        const data = await resp.json();
        if (resp.ok && data.access_token) {
            // Salva o token JWT corretamente
            localStorage.setItem('access_token', data.access_token);
            // Testa se o token foi salvo
            if (!localStorage.getItem('access_token')) {
                msg.textContent = 'Erro ao salvar token de autenticação.';
                msg.className = 'text-danger mt-3';
                return;
            }
            msg.textContent = 'Login realizado com sucesso!';
            msg.className = 'text-success mt-3';
            setTimeout(() => {
                window.location.href = 'transacoes.html';
            }, 1200);
        } else {
            msg.textContent = data.erro || 'Usuário ou senha inválidos.';
            msg.className = 'text-danger mt-3';
        }
    } catch (err) {
        msg.textContent = 'Erro ao conectar ao servidor.';
        msg.className = 'text-danger mt-3';
    }
});
