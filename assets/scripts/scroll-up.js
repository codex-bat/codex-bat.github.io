// scroll go up, nothing fancy

// Get the button element
(function () {
  var btn = document.querySelector(".back-to-top");
  if (!btn) return;

  // Show/hide button based on scroll position
  function toggleButton() {
    if (window.scrollY > 300) {
      btn.classList.add("show");
    } else {
      btn.classList.remove("show");
    }
  }

  // Scroll to top when clicked
  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Attach events
  window.addEventListener("scroll", toggleButton);
  btn.addEventListener("click", scrollToTop);

  // Initial check in case the page loads scrolled down
  toggleButton();
})();
