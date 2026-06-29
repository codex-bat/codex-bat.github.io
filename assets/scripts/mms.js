// turns any button inside out and gruesomely snaps them out of existence like a scary god-like being.
// no, I'm joking. 
// turns them into a mobile collapsible toggle

(function () {
  "use strict";

  const BREAKPOINT = 720; // px – close menus above this width

  // find all toggle buttons
  const toggles = document.querySelectorAll("[data-mobile-toggle]");

  toggles.forEach((btn) => {
    const targetSelector = btn.getAttribute("data-mobile-toggle");
    if (!targetSelector) return;

    const target = document.querySelector(targetSelector);
    if (!target) return;

    // initial state: hidden (the script ensures it's hidden, CSS can default to display:none as well)
    target.style.display = "none";
    let isOpen = false;

    // new gamestop store (shop-- I mean store: the original button content so we can restore it)
    const closedHTML = btn.innerHTML;

    // create the open-state HTML (same but with chevron-up)
    const openHTML = closedHTML.replace("fa-chevron-down", "fa-chevron-up");

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      if (isOpen) {
        target.style.display = "none";
        btn.innerHTML = closedHTML;
        isOpen = false;
      } else {
        target.style.display = "flex"; // mobile‑links are flex column
        btn.innerHTML = openHTML;
        isOpen = true;
      }
    });

    // close menu on window resize above the breakpoint
    const handleResize = () => {
      if (window.innerWidth > BREAKPOINT && isOpen) {
        target.style.display = "none";
        btn.innerHTML = closedHTML;
        isOpen = false;
      }
    };
    window.addEventListener("resize", handleResize);
  });
})();
