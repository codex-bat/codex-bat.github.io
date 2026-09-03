/**
 * replaceDashes - converts triple‑dashes (with optional internal whitespace)
 * to em‑dashes and double‑dashes to en‑dashes! YOU KNOW HOW LONG I'VE BEEN THINKING ABOUT THIS?
 * now I can either keep my quirky "---" style or use the proper "—" style,
 * and I can choose either whenever in case I want it.
 * either way, I don't change my writing process. (stupid symbol copying)
 *
 * @param {HTMLElement} container                  - root element to scan (default: document.body)
 * @param {Object}      options                    - optional flags
 * @param {boolean}     options.tripleDashToEmDash - replace --- patterns with — (default: true)
 * @param {boolean}     options.doubleDashToEnDash - replace -- patterns with – (default: true)
 */
function replaceDashes(container, options) {
  container = container || document.body;
  const opts = Object.assign(
    {
      tripleDashToEmDash: true,
      doubleDashToEnDash: true,
    },
    options || {},
  );

  // TreeWalker skips text inside script, style, noscript, code, and pre tags
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode: function (node) {
      const parent = node.parentElement;
      if (parent) {
        const tag = parent.tagName;
        if (
          ["SCRIPT", "STYLE", "NOSCRIPT", "CODE", "PRE"].indexOf(tag) !== -1
        ) {
          return NodeFilter.FILTER_REJECT;
        }
      }
      // only process nodes that contain at least two dash characters
      if (node.textContent && /--/.test(node.textContent)) {
        return NodeFilter.FILTER_ACCEPT;
      }
      return NodeFilter.FILTER_REJECT;
    },
  });

  const nodes = [];
  let node;
  while ((node = walker.nextNode())) {
    nodes.push(node);
  }

  function replacePattern(text, regex, dashChar) {
    let changed = false;
    const newText = text.replace(regex, function (match, left, right) {
      const hasLeft = left && left.length > 0;
      const hasRight = right && right.length > 0;
      let replacement;
      if (hasLeft && hasRight) {
        replacement = left + dashChar + right;
      } else {
        // only one side (or none) → drop all outer whitespace (formatting artifact)
        replacement = dashChar;
      }
      if (replacement !== match) changed = true;
      return replacement;
    });
    return { text: newText, changed };
  }

  for (const textNode of nodes) {
    let text = textNode.textContent;
    let anyChange = false;

    // order matters: triple first, then double.
    // I messed this up at first
    if (opts.tripleDashToEmDash) {
      const result = replacePattern(text, /(\s*)-\s*-\s*-(\s*)/g, "—");
      text = result.text;
      anyChange = anyChange || result.changed;
    }

    if (opts.doubleDashToEnDash) {
      const result = replacePattern(text, /(\s*)-\s*-(\s*)/g, "–");
      text = result.text;
      anyChange = anyChange || result.changed;
    }

    if (anyChange) {
      textNode.textContent = text;
    }
  }
}

// automatically run once the DOM is ready
document.addEventListener("DOMContentLoaded", function () {
  replaceDashes();
});

// expose globally for manual calls (on dynamic content)
window.replaceDashes = replaceDashes;
