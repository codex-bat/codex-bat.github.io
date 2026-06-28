(function () {
  // find every dropdown container on the page
  const dropdowns = document.querySelectorAll('[data-dropdown]');

  dropdowns.forEach(container => {
    const titleEl = container.querySelector('[data-dropdown-title]');
    const menuEl = container.querySelector('[data-dropdown-menu]');
    if (!titleEl || !menuEl) return;

    // gather all content panels that belong to this dropdown (anywhere in the document)
    const contentMap = new Map();
    document.querySelectorAll('[data-dropdown-content]').forEach(panel => {
      const key = panel.getAttribute('data-dropdown-content');
      if (key) contentMap.set(key, panel);
    });

    // toggle open / close
    titleEl.addEventListener('click', (e) => {
      e.stopPropagation();
      container.classList.toggle('open');
    });

    // choose a tab
    menuEl.addEventListener('click', (e) => {
      const li = e.target.closest('li');
      if (!li) return;
      const tab = li.getAttribute('data-tab');
      if (!tab) return;

      // hide all panels, then show the matching one
      contentMap.forEach(panel => panel.classList.remove('active'));
      if (contentMap.has(tab)) {
        contentMap.get(tab).classList.add('active');
      }

      titleEl.textContent = tab;
      container.classList.remove('open');
    });

    // Close when clicking outside
    document.addEventListener('click', (e) => {
      if (!container.contains(e.target)) {
        container.classList.remove('open');
      }
    });
  });
})();

/**
 USAGE IN OTHER PAGES OTHER THAN HOME:
 
 ----
 <div data-dropdown>
  <button data-dropdown-title>First Tab</button>
  <ul data-dropdown-menu>
    <li data-tab="one">One</li>
    <li data-tab="two">Two</li>
  </ul>
 </div>
 <div data-dropdown-content="one"> … </div>
 <div data-dropdown-content="two"> … </div>
 ----

 DO YOU REMAMBA'!?
 */