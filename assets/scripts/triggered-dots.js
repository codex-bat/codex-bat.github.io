(function () {
  // secret sauce
  const revealSpans = document.querySelectorAll(".hidden-reveal");
  if (revealSpans.length > 0) {
    const triggers = new Map();
    revealSpans.forEach((span) => {
      const key = span.getAttribute("data-key");
      if (!key) return;
      const fullHTML = span.innerHTML;
      span.innerHTML = "";
      triggers.set(key, {
        element: span,
        fullHTML: fullHTML,
        done: false,
      });
    });

    const maxKeyLength = Math.max(
      ...Array.from(triggers.keys()).map((k) => k.length),
      1,
    );
    let buffer = "";

    function typeOut(element, html, speed = 50) {
      const container = document.createElement("div");
      container.innerHTML = html;
      const textNodes = [];
      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        textNodes.push(walker.currentNode);
      }
      const fullStrings = textNodes.map((node) => node.nodeValue);
      const combined = fullStrings.join("");
      const trimmedStart = combined.length - combined.trimStart().length;
      const trimmedEnd = combined.length - combined.trimEnd().length;
      let removeStart = trimmedStart;
      for (let i = 0; i < fullStrings.length && removeStart > 0; i++) {
        const str = fullStrings[i];
        const match = str.match(/^\s+/);
        const removable = match ? Math.min(match[0].length, removeStart) : 0;
        if (removable > 0) {
          fullStrings[i] = str.slice(removable);
          removeStart -= removable;
        }
      }
      let removeEnd = trimmedEnd;
      for (let i = fullStrings.length - 1; i >= 0 && removeEnd > 0; i--) {
        const str = fullStrings[i];
        const match = str.match(/\s+$/);
        const removable = match ? Math.min(match[0].length, removeEnd) : 0;
        if (removable > 0) {
          fullStrings[i] = str.slice(0, str.length - removable);
          removeEnd -= removable;
        }
      }
      const totalLength = fullStrings.join("").length;
      textNodes.forEach((node) => {
        node.nodeValue = "";
      });
      element.innerHTML = "";
      while (container.firstChild) {
        element.appendChild(container.firstChild);
      }
      const hiddenElements = new Map();
      textNodes.forEach((node) => {
        const parent = node.parentNode;
        if (parent !== element && parent.children.length === 0) {
          const display = getComputedStyle(parent).display;
          if (display.startsWith("inline")) {
            hiddenElements.set(parent, parent.style.display);
            parent.style.display = "none";
          }
        }
      });
      const segments = textNodes.map((node, index) => {
        return {
          node: node,
          fullText: fullStrings[index],
          start: fullStrings.slice(0, index).join("").length,
        };
      });
      let charCount = 0;
      element.style.display = "inline";
      element.classList.add("active");
      const interval = setInterval(() => {
        charCount++;
        if (charCount > totalLength) {
          clearInterval(interval);
          return;
        }
        for (const segment of segments) {
          const visibleLength = Math.max(
            0,
            Math.min(charCount - segment.start, segment.fullText.length),
          );
          segment.node.nodeValue = segment.fullText.substring(0, visibleLength);
          if (
            visibleLength > 0 &&
            hiddenElements.has(segment.node.parentNode)
          ) {
            segment.node.parentNode.style.display = hiddenElements.get(
              segment.node.parentNode,
            );
            hiddenElements.delete(segment.node.parentNode);
          }
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
        if (buffer.length > maxKeyLength) {
          buffer = buffer.slice(-maxKeyLength);
        }

        for (let [key, data] of triggers.entries()) {
          if (data.done) continue;
          if (buffer.endsWith(key)) {
            data.done = true;
            typeOut(data.element, data.fullHTML);
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
