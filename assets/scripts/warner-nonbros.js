(function () {
  "use strict";

  // ---- config ----
  const TARGET_URL = "https://codexbat.dev/story/HTML";
  const TARGET_PATH = "/story/HTML";

  // ---- state ----
  let pendingHref = null;
  let popupActive = false;

  let overlay = null;
  let popup = null;

  function buildPopup() {
    if (document.getElementById("flash-overlay")) return;

    const overlayEl = document.createElement("div");
    overlayEl.id = "flash-overlay";
    overlayEl.setAttribute("role", "dialog");
    overlayEl.setAttribute("aria-modal", "true");
    overlayEl.setAttribute("aria-labelledby", "flash-title");

    overlayEl.innerHTML = `
                <div id="flash-popup">
                    <button class="popup-close" aria-label="Close" id="flash-close-btn">✕</button>
                    <span class="popup-icon">;-;</span>
                    <div class="popup-title" id="flash-title">
                        flash <span class="accent">warning</span>
                    </div>
                    <div class="popup-message">
                        <span class="flash-emoji">⚠️</span>
                        You're about to get <strong>flashed</strong>. ⚠️<br>
                        This page contains <span style="color:#ffb36b;">bright</span> or <span style="color:#7f9eff;">intense</span> content.
                        <br><br>
                        <span style="font-size:0.8rem;color:#888;">Destination:</span><br>
                        <span class="target-url" id="flash-target-url">${escHTML(TARGET_URL)}</span>
                    </div>
                    <div class="popup-actions">
                        <button class="btn-deny" id="flash-deny">Deny</button>
                        <button class="btn-accept" id="flash-accept">Proceed</button>
                    </div>
                </div>
            `;

    document.body.appendChild(overlayEl);

    overlay = overlayEl;
    popup = document.getElementById("flash-popup");

    const closeBtn = document.getElementById("flash-close-btn");
    const denyBtn = document.getElementById("flash-deny");
    const acceptBtn = document.getElementById("flash-accept");

    function closePopup() {
      if (!overlay) return;
      overlay.classList.remove("show");
      popupActive = false;
      pendingHref = null;
      document.body.style.overflow = "";
    }

    function acceptAndGo() {
      const href = pendingHref;
      closePopup();
      if (href) {
        setTimeout(() => {
          window.location.href = href;
        }, 80);
      }
    }

    closeBtn.addEventListener("click", closePopup);
    denyBtn.addEventListener("click", closePopup);
    acceptBtn.addEventListener("click", acceptAndGo);

    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) {
        closePopup();
      }
    });

    document.addEventListener("keydown", function escHandler(e) {
      if (e.key === "Escape" && popupActive) {
        closePopup();
      }
    });

    popup.addEventListener("click", function (e) {
      e.stopPropagation();
    });
  }

  function escHTML(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function isTargetLink(href) {
    if (!href) return false;
    if (href === TARGET_URL) return true;
    if (href === TARGET_PATH) return true;

    try {
      const resolved = new URL(href, window.location.origin);
      if (resolved.href === TARGET_URL) return true;
      if (resolved.pathname === TARGET_PATH) return true;
      // also check if it ends with the target path (for things like /story/HTML?foo=bar)
      if (resolved.pathname === TARGET_PATH) return true;
    } catch (_) {
      /* ignore */
    }

    if (href.endsWith(TARGET_PATH)) return true;
    if (href.includes(TARGET_PATH)) return true;

    return false;
  }

  function getLinkHref(element) {
    const anchor = element.closest("a[href]");
    if (anchor) {
      const href = anchor.getAttribute("href");
      if (href) return href;
    }

    const dataEl = element.closest("[data-href]");
    if (dataEl) {
      const href = dataEl.getAttribute("data-href");
      if (href) return href;
    }

    const dataLinkEl = element.closest("[data-link]");
    if (dataLinkEl) {
      const href = dataLinkEl.getAttribute("data-link");
      if (href) return href;
    }

    if (element.hasAttribute && element.hasAttribute("href")) {
      return element.getAttribute("href");
    }

    return null;
  }

  function showFlashPopup(href) {
    if (popupActive) return;

    buildPopup();
    if (!overlay) return;

    pendingHref = href;

    const urlDisplay = document.getElementById("flash-target-url");
    if (urlDisplay) {
      urlDisplay.textContent = href || TARGET_URL;
    }

    overlay.classList.add("show");
    popupActive = true;

    document.body.style.overflow = "hidden";

    setTimeout(() => {
      const acceptBtn = document.getElementById("flash-accept");
      if (acceptBtn) acceptBtn.focus();
    }, 50);
  }

  function handleClick(e) {
    if (popupActive) return;

    const target = e.target;
    if (!target) return;

    const href = getLinkHref(target);
    if (!href) return;

    if (!isTargetLink(href)) return;

    // it's a match!
    e.preventDefault();
    e.stopPropagation();

    // figure out the resolved URL for display / navigation
    let resolvedHref = href;
    try {
      const url = new URL(href, window.location.origin);
      resolvedHref = url.href;
    } catch (_) {
      // keep as-is
    }

    showFlashPopup(resolvedHref);
  }

  function init() {
    // use capture phase to catch events before they bubble
    document.addEventListener("click", handleClick, true);
  }

  // ---- handle dynamic DOM changes (MutationObserver) ----
  // We don't need to re-attach because we use event delegation on document.
  // But we do need to rebuild the popup if it gets removed from the DOM.
  // (It won't be, but let's be safe.)

  // boot
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // expose for debugging
  window.__flashWarning = {
    target: TARGET_URL,
    isTargetLink: isTargetLink,
    getLinkHref: getLinkHref,
  };
})();
