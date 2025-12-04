class NavBar extends HTMLElement {
  connectedCallback() {
    fetch("nav.html")
      .then(res => res.text())
      .then(html => {
        this.innerHTML = html;
      });
  }
}

customElements.define("nav-bar", NavBar);

document.addEventListener('DOMContentLoaded', function () {
  setTimeout(() => {
    const nav = document.querySelector('nav-bar') || document;

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
  }, 100);
});