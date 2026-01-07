
class NavBar extends HTMLElement {
  connectedCallback() {
    fetch("nav.html")
      .then(res => res.text())
      .then(html => {
        this.innerHTML = html;
        
        // Inicializar sidebar após carregar o HTML
        initSidebar();
        
        // Adiciona evento de logout após inserir o HTML
        const btnLogout = this.querySelector('#btnLogout');
        if (btnLogout) {
          btnLogout.addEventListener('click', function (e) {
            e.preventDefault();
            localStorage.removeItem('access_token');
            window.location.href = 'login.html';
          });
        }
        
        // Destacar página ativa na sidebar
        highlightActivePage();
      });
  }
}

customElements.define("nav-bar", NavBar);

// Web Component para o Footer
class AppFooter extends HTMLElement {
  connectedCallback() {
    fetch("footer.html")
      .then(res => res.text())
      .then(html => {
        this.innerHTML = html;
      });
  }
}

customElements.define("app-footer", AppFooter);

// Função para inicializar a sidebar
function initSidebar() {
  const sidebar = document.getElementById('sidebar');
  const sidebarToggle = document.getElementById('sidebarToggle');
  const body = document.body;
  
  if (!sidebar || !sidebarToggle) return;
  
  // Carregar estado salvo do localStorage
  const isMobile = window.innerWidth <= 768;
  const savedState = localStorage.getItem('sidebarCollapsed');
  
  if (isMobile) {
    // Mobile: sidebar começa oculta
    sidebar.classList.remove('show');
    body.classList.remove('sidebar-open');
  } else {
    // Desktop: usar estado salvo ou expandida por padrão
    if (savedState === 'true') {
      sidebar.classList.add('collapsed');
      body.classList.add('sidebar-collapsed');
    } else {
      sidebar.classList.remove('collapsed');
      body.classList.remove('sidebar-collapsed');
    }
  }
  
  // Toggle sidebar ao clicar no botão
  sidebarToggle.addEventListener('click', function() {
    if (window.innerWidth <= 768) {
      // Mobile: mostrar/ocultar sidebar
      sidebar.classList.toggle('show');
      body.classList.toggle('sidebar-open');
    } else {
      // Desktop: recolher/expandir sidebar
      sidebar.classList.toggle('collapsed');
      body.classList.toggle('sidebar-collapsed');
      
      // Salvar preferência
      const isCollapsed = sidebar.classList.contains('collapsed');
      localStorage.setItem('sidebarCollapsed', isCollapsed);
    }
  });
  
  // Fechar sidebar ao clicar fora (mobile)
  document.addEventListener('click', function(e) {
    if (window.innerWidth <= 768 && 
        !sidebar.contains(e.target) && 
        !sidebarToggle.contains(e.target) &&
        sidebar.classList.contains('show')) {
      sidebar.classList.remove('show');
      body.classList.remove('sidebar-open');
    }
  });
  
  // Ajustar ao redimensionar janela
  let resizeTimer;
  window.addEventListener('resize', function() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function() {
      const isMobile = window.innerWidth <= 768;
      
      if (isMobile) {
        // Mobile: remover classes de desktop
        sidebar.classList.remove('collapsed');
        body.classList.remove('sidebar-collapsed');
        if (!sidebar.classList.contains('show')) {
          sidebar.classList.remove('show');
          body.classList.remove('sidebar-open');
        }
      } else {
        // Desktop: remover classes de mobile e restaurar estado salvo
        sidebar.classList.remove('show');
        body.classList.remove('sidebar-open');
        
        const savedState = localStorage.getItem('sidebarCollapsed');
        if (savedState === 'true') {
          sidebar.classList.add('collapsed');
          body.classList.add('sidebar-collapsed');
        }
      }
    }, 250);
  });
}

// Função para destacar a página ativa na sidebar
function highlightActivePage() {
  const currentPage = window.location.pathname.split('/').pop() || 'transacoes.html';
  const sidebarLinks = document.querySelectorAll('.sidebar-link');
  
  sidebarLinks.forEach(link => {
    const linkPage = link.getAttribute('href');
    if (linkPage === currentPage) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
}

document.addEventListener('DOMContentLoaded', function () {
  setTimeout(() => {
    // Logout (caso não tenha sido inicializado pelo Web Component)
    const btnLogout = document.querySelector('#btnLogout');
    if (btnLogout && !btnLogout.hasAttribute('data-listener')) {
      btnLogout.setAttribute('data-listener', 'true');
      btnLogout.addEventListener('click', function (e) {
        e.preventDefault();
        localStorage.removeItem('access_token');
        window.location.href = 'login.html';
      });
    }
  }, 100);
});