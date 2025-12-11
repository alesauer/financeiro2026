
class NavBar extends HTMLElement {
  connectedCallback() {
    fetch("nav.html")
      .then(res => res.text())
      .then(html => {
        this.innerHTML = html;
        // Adiciona evento de logout após inserir o HTML
        const btnLogout = this.querySelector('#btnLogout');
        if (btnLogout) {
          btnLogout.addEventListener('click', function (e) {
            e.preventDefault();
            localStorage.removeItem('access_token');
            window.location.href = 'login.html';
          });
        }
      });
  }
}

customElements.define("nav-bar", NavBar);

document.addEventListener('DOMContentLoaded', function () {
  setTimeout(() => {
    const nav = document.querySelector('nav-bar') || document;

    // Submenu
    const subs = nav.querySelectorAll('.has-sub');
    subs.forEach(li => {
      const trigger = li.querySelector('a');
      trigger.addEventListener('click', function (e) {
        e.preventDefault();
        li.classList.toggle('open');
      });

      document.addEventListener('click', function (e) {
        if (!li.contains(e.target)) {
          li.classList.remove('open');
        }
      });
    });

    // Logout
    const btnLogout = nav.querySelector('#btnLogout');
    if (btnLogout) {
      btnLogout.addEventListener('click', function (e) {
        e.preventDefault();
        localStorage.removeItem('access_token');
        window.location.href = 'login.html';
      });
    }
  }, 100);
});