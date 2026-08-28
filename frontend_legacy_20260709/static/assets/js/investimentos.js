// JS para tela de investimentos: busca dados do backend e exibe resumo e gráfico

document.addEventListener('DOMContentLoaded', function() {
  carregarResumoInvestimentos();
});

async function carregarResumoInvestimentos() {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth() + 1;
  try {
    const resp = await fetch(`/api/relatorios/resumo?ano=${ano}&mes=${mes}`);
    if (!resp.ok) throw new Error('Erro ao buscar resumo');
    const data = await resp.json();
    exibirResumoInvestimentos(data);
  } catch (e) {
    document.getElementById('total-investido').textContent = 'Erro ao carregar';
  }
}

function exibirResumoInvestimentos(data) {
  // Total investido = último valor do array acum_invest
  const total = data.acum_invest && data.acum_invest.length > 0 ? data.acum_invest[data.acum_invest.length-1] : 0;
  document.getElementById('total-investido').textContent = `R$ ${total.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;

  // Gráfico de evolução
  const ctx = document.getElementById('grafico-investimentos').getContext('2d');
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.dias,
      datasets: [{
        label: 'Acúmulo de Investimentos',
        data: data.acum_invest,
        borderColor: '#198754',
        backgroundColor: 'rgba(25,135,84,0.1)',
        fill: true,
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        title: { display: false }
      },
      scales: {
        y: { beginAtZero: true }
      }
    }
  });
}
