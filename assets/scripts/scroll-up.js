// scroll go up, nothing fancy

(function () {
  var btn = document.querySelector(".back-to-top");
  if (!btn) return;

  // Smooth scroll to top
  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Update visibility AND dynamic opacity (phone only)
  function toggleButton() {
    var scrollY = window.scrollY;
    var isVisible = scrollY > 300;

    btn.classList.toggle("show", isVisible);

    // Dynamic opacity for phones
    if (window.innerWidth <= 768) {
      if (isVisible) {
        // Map scrollY to opacity:
        //   scrollY = 300   → opacity ≈ 0.45  (more visible, near top)
        //   scrollY = 1800  → opacity ≈ 0.1   (very faint, deep down)
        //   beyond that stays at 0.1
        var maxOpacity = 0.85;
        var minOpacity = 0.1;
        var range = 1500; // pixels over which the opacity drops
        var progress = Math.max(0, 1 - (scrollY - 300) / range);
        var opacity = minOpacity + (maxOpacity - minOpacity) * progress;
        btn.style.opacity = opacity.toFixed(2);
      } else {
        // Hidden entirely – let the class handle it, but keep the base low
        btn.style.opacity = "0.85";
      }
    } else {
      // On desktop, just use the default full opacity when visible
      btn.style.opacity = "1";
    }
  }

  // Attach events
  window.addEventListener("scroll", toggleButton);
  window.addEventListener("resize", toggleButton); // re‑calculate on resize
  btn.addEventListener("click", scrollToTop);

  // Initial check
  toggleButton();
})();
