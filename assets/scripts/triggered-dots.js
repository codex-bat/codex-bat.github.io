(function () {
  // secret sauce
  const revealSpans = document.querySelectorAll(".hidden-reveal");
  if (revealSpans.length > 0) {
    const triggers = new Map();
    revealSpans.forEach((span) => {
      const key = span.getAttribute("data-key");
      if (!key) return;
      const fullText = span.textContent.trim();
      span.textContent = "";
      triggers.set(key, {
        element: span,
        fullText: fullText,
        done: false,
      });
    });

    const maxKeyLength = Math.max(
      ...Array.from(triggers.keys()).map((k) => k.length),
      1,
    );
    let buffer = "";

    function typeOut(element, text, speed = 50) {
      let i = 0;
      element.style.display = "inline";
      element.classList.add("active");
      const interval = setInterval(() => {
        element.textContent += text.charAt(i);
        i++;
        if (i >= text.length) {
          clearInterval(interval);
        }
      }, speed);
    }

    document.addEventListener("keydown", function (e) {
      const tag = document.activeElement
        ? document.activeElement.tagName.toLowerCase()
        : "";
      const isEditable =
        tag === "input" ||
        tag === "textarea" ||
        document.activeElement.isContentEditable;
      if (isEditable) return;

      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        buffer += e.key;
        // trim the fat, only keep the last maxKeyLength chars
        if (buffer.length > maxKeyLength) {
          buffer = buffer.slice(-maxKeyLength);
        }

        for (let [key, data] of triggers.entries()) {
          if (data.done) continue;
          if (buffer.endsWith(key)) {
            data.done = true;
            typeOut(data.element, data.fullText);
          }
        }
      }
    });
  }

  // dots clicky thing
  document.querySelectorAll(".dots-toggle").forEach((dot) => {
    const revealText = dot.getAttribute("data-reveal");
    if (!revealText) return;

    dot.addEventListener("click", function () {
      if (dot.classList.contains("revealed")) return;
      dot.classList.add("revealed");
      dot.textContent = revealText;
      dot.removeAttribute("data-reveal");
    });
  });
})();
