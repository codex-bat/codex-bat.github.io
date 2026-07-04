/* ================================================================
   map-builder.js – data loading, layout, node/connection rendering,
                     and category filters, now with locky stuff
   ================================================================ */
"use strict";

/* config */
var WORLD_PADDING = 200;
var SVG_NS = "http://www.w3.org/2000/svg";

/* colours for each type :3 */
var COLOR = {
  post: "#7f9eff",
  story: "#ffb36b",
  dreg: "#6c6f78",
};

/* world size (gets recalculated later) */
var worldW = 1000;
var worldH = 1000;

/* the holy data */
var nodes = [];
var links = [];
var postMap = {};

/* filter states – all true by default */
var filters = {
  post: true,
  story: true,
  dreg: true,
};

/* locky lock – for when i wanna stare at a node forever */
var lockNodeId = null; // locked (like my creativity)
var lockMode = null; // 'cumulative' or 'strict'
var highlightedNodes = {}; // set of node ids that are glowing

/* DOM refs – grabbing things by the neck */
var $svg = document.getElementById("world-svg");
var $conns = document.getElementById("connections-group");
var $tip = document.getElementById("node-tip");
var $filterPanel = document.getElementById("filter-panel");
var $filterToggle = document.getElementById("filter-handle");

/* --- mobile long‑press stuff --- */
var longPressTimer = null;
var longPressNode = null; // the node being long‑pressed
var $contextMenu = null; // the little popup menu
var longPressFired = false; // set to true when a long press actually happens

// check if we're on a touch device (can be true for laptops too, but mostly phones)
var isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0;

/* --- svg connections --- */
function renderConnections() {
  while ($conns.firstChild) $conns.removeChild($conns.firstChild);

  var frag = document.createDocumentFragment();

  links.forEach(function (conn, idx) {
    var from = postMap[conn.source];
    var to = postMap[conn.target];
    if (!from || !to) return; // dead link, skip

    var d = "M " + from.x + " " + from.y + " L " + to.x + " " + to.y;
    var g = document.createElementNS(SVG_NS, "g");
    g.classList.add("conn-g");
    g.dataset.from = conn.source;
    g.dataset.to = conn.target;

    // base line, barely visible
    var base = document.createElementNS(SVG_NS, "path");
    base.setAttribute("d", d);
    base.setAttribute("fill", "none");
    base.setAttribute(
      "stroke",
      conn.weak ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.12)",
    );
    base.setAttribute("stroke-width", conn.weak ? "0.8" : "1");
    base.classList.add("conn-base");
    g.appendChild(base);

    // pulsing dash line, looks alive
    var pulse = document.createElementNS(SVG_NS, "path");
    pulse.setAttribute("d", d);
    pulse.setAttribute("fill", "none");
    pulse.setAttribute(
      "stroke",
      conn.weak ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.5)",
    );
    pulse.setAttribute("stroke-width", conn.weak ? "0.8" : "1.2");
    pulse.setAttribute("stroke-dasharray", conn.weak ? "2 18" : "4 12");
    pulse.setAttribute("stroke-linecap", "round");
    pulse.classList.add("conn-pulse");
    if (conn.weak) pulse.classList.add("weak");
    pulse.style.animationDelay = -((idx * 0.37) % 3) + "s";
    g.appendChild(pulse);

    // fat invisible hitbox so we can click the line
    var hit = document.createElementNS(SVG_NS, "path");
    hit.setAttribute("d", d);
    hit.setAttribute("fill", "none");
    hit.setAttribute("stroke", "transparent");
    hit.setAttribute("stroke-width", "14");
    hit.classList.add("conn-hit");
    g.appendChild(hit);

    frag.appendChild(g);
  });

  $conns.appendChild(frag);
  connGroups = null; // invalidate cache
  applyFilters(); // reapply filters so hidden stuff stays hidden
}

/* --- HTML nodes (the little dots on the map) --- */
function renderNodes() {
  var oldNodes = $world.querySelectorAll(".map-node");
  for (var i = 0; i < oldNodes.length; i++) {
    oldNodes[i].remove();
  }

  var frag = document.createDocumentFragment();

  nodes.forEach(function (post) {
    var col = COLOR[post.type] || COLOR.post;

    var el = document.createElement("div");
    el.className = "map-node";
    el.dataset.id = post.id;
    el.dataset.type = post.type;
    el.style.left = post.x + "px";
    el.style.top = post.y + "px";

    var visual = document.createElement("div");
    visual.className = "node-visual";
    visual.style.setProperty("--node-color", col);
    el.appendChild(visual);

    var label = document.createElement("span");
    label.className = "node-label";
    label.innerHTML = post.title; // raw html so my <span> stylings work
    el.appendChild(label);

    frag.appendChild(el);
  });

  $world.appendChild(frag);
  applyFilters(); // hide/show according to current filters
}

/* --- filter application --- */
function applyFilters() {
  // Nodes
  var allNodes = $world.querySelectorAll(".map-node");
  for (var i = 0; i < allNodes.length; i++) {
    var node = allNodes[i];
    var type = node.dataset.type;
    var visible = filters[type] !== false;
    node.classList.toggle("filter-hidden", !visible);
  }

  // Connections
  var allConns = $conns.querySelectorAll(".conn-g");
  for (var j = 0; j < allConns.length; j++) {
    var g = allConns[j];
    var fromId = g.dataset.from;
    var toId = g.dataset.to;
    var from = postMap[fromId];
    var to = postMap[toId];
    var visible =
      from && to && filters[from.type] !== false && filters[to.type] !== false;
    g.classList.toggle("filter-hidden", !visible);
  }
}

/* --- filter panel open/close --- */
document.addEventListener("DOMContentLoaded", function () {
  var panel = document.getElementById("filter-panel");
  var handle = document.getElementById("filter-handle");
  var closeBtn = panel ? panel.querySelector(".panel-close") : null;
  var resetBtn = document.getElementById("reset-filters");

  if (handle && panel) {
    handle.addEventListener("click", function (e) {
      e.stopPropagation();
      panel.classList.toggle("open");
    });
  }

  if (closeBtn && panel) {
    closeBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      panel.classList.remove("open");
    });
  }

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && panel && panel.classList.contains("open")) {
      panel.classList.remove("open");
    }
  });

  if (resetBtn && panel) {
    resetBtn.addEventListener("click", function () {
      var checkboxes = panel.querySelectorAll("input[data-type]");
      for (var i = 0; i < checkboxes.length; i++) {
        checkboxes[i].checked = true;
        var evt = new Event("change", { bubbles: true });
        checkboxes[i].dispatchEvent(evt);
      }
    });
  }
});

/* --- filter checkbox events --- */
var checkboxes = $filterPanel
  ? $filterPanel.querySelectorAll("input[data-type]")
  : [];
for (var k = 0; k < checkboxes.length; k++) {
  (function (cb) {
    cb.addEventListener("change", function () {
      var type = cb.dataset.type;
      filters[type] = cb.checked;
      applyFilters();
    });
  })(checkboxes[k]);
}

/* --- tooltip that follows mouse --- */
var tipMoveHandler = null;

function showTip(post, cx, cy) {
  // please do :3
  var label = post.type.charAt(0).toUpperCase() + post.type.slice(1);
  $tip.innerHTML =
    '<span class="tip-title">' +
    post.title +
    "</span>" +
    '<span class="tip-meta">' +
    esc(post.date) +
    " &nbsp;·&nbsp; " +
    label +
    "</span>";
  $tip.classList.add("show");
  placeTip(cx, cy);
  if (!tipMoveHandler) {
    tipMoveHandler = function (e) {
      placeTip(e.clientX, e.clientY);
    };
    document.addEventListener("mousemove", tipMoveHandler);
  }
}

function hideTip() {
  $tip.classList.remove("show");
  if (tipMoveHandler) {
    document.removeEventListener("mousemove", tipMoveHandler);
    tipMoveHandler = null;
  }
}

function placeTip(cx, cy) {
  var TW = 220,
    TH = 54;
  var x = cx + 16,
    y = cy - 12;
  if (x + TW > window.innerWidth) x = cx - TW - 12;
  if (y + TH > window.innerHeight) y = cy - TH - 4;
  $tip.style.left = x + "px";
  $tip.style.top = y + "px";
}

function esc(s) {
  var d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

/* --- connection highlighting (normal / unlocked) --- */
var connGroups = null;

function highlightConns(nodeId) {
  if (!connGroups) connGroups = $conns.querySelectorAll(".conn-g");
  for (var i = 0; i < connGroups.length; i++) {
    var g = connGroups[i];
    var hit = g.dataset.from === nodeId || g.dataset.to === nodeId;
    g.classList.toggle("conn-active", hit);
    g.classList.toggle("conn-faded", !hit);
  }
}

function resetConns() {
  if (lockNodeId) return; // nah, not when locked
  if (!connGroups) connGroups = $conns.querySelectorAll(".conn-g");
  for (var i = 0; i < connGroups.length; i++) {
    var g = connGroups[i];
    g.classList.remove("conn-active", "conn-faded");
  }
}

/* --- set-based highlight (used while locked) --- */
function refreshHighlights() {
  if (!connGroups) connGroups = $conns.querySelectorAll(".conn-g");
  for (var i = 0; i < connGroups.length; i++) {
    var g = connGroups[i];
    var hit =
      highlightedNodes.hasOwnProperty(g.dataset.from) ||
      highlightedNodes.hasOwnProperty(g.dataset.to);
    g.classList.toggle("conn-active", hit);
    g.classList.toggle("conn-faded", !hit);
  }
}

/* --- lock / unlock functions --- */
function lockFocus(nodeId, mode) {
  // remove class from previously locked node
  if (lockNodeId) {
    var prevEl = $world.querySelector(
      '.map-node[data-id="' + lockNodeId + '"]',
    );
    if (prevEl) prevEl.classList.remove("locked");
  }

  lockNodeId = nodeId;
  lockMode = mode;

  var nodeEl = $world.querySelector('.map-node[data-id="' + nodeId + '"]');
  if (nodeEl) nodeEl.classList.add("locked");

  highlightedNodes = {};
  highlightedNodes[nodeId] = true;
  refreshHighlights();

  $viewport.classList.add("locked-focus");
}

function unlockFocus() {
  if (!lockNodeId) return;

  var nodeEl = $world.querySelector('.map-node[data-id="' + lockNodeId + '"]');
  if (nodeEl) nodeEl.classList.remove("locked");

  lockNodeId = null;
  lockMode = null;
  highlightedNodes = {};
  refreshHighlights(); // clear all highlights
  $viewport.classList.remove("locked-focus");
}

/* --- mobile context menu --- */
function showContextMenu(nodeEl, id) {
  // remove any existing menu
  if ($contextMenu) {
    $contextMenu.remove();
    $contextMenu = null;
  }

  var rect = nodeEl.getBoundingClientRect();
  var x = rect.left + rect.width / 2;
  var y = rect.top + rect.height / 2;

  $contextMenu = document.createElement("div");
  $contextMenu.className = "node-ctx-menu";
  $contextMenu.innerHTML =
    '<button data-action="cumulative">Cumulative Lock</button>' +
    '<button data-action="strict">Strict Lock</button>';

  // style it (minimal, can be overwritten by map.css)
  $contextMenu.style.cssText =
    "position:fixed;background:rgba(10,10,10,0.95);border:1px solid #333;" +
    "border-radius:6px;padding:4px 0;z-index:999;font-family:monospace;" +
    "font-size:0.75rem;color:#ccc;box-shadow:0 4px 12px rgba(0,0,0,0.8);";

  // position it so it doesn't go off screen
  var menuW = 150,
    menuH = 68; // rough
  var left = x - menuW / 2;
  var top = y + 30;
  if (left < 4) left = 4;
  if (left + menuW > window.innerWidth - 4)
    left = window.innerWidth - menuW - 4;
  if (top + menuH > window.innerHeight - 4) top = y - menuH - 15;

  $contextMenu.style.left = left + "px";
  $contextMenu.style.top = top + "px";

  // button styles
  var buttons = $contextMenu.querySelectorAll("button");
  for (var i = 0; i < buttons.length; i++) {
    buttons[i].style.cssText =
      "display:block;width:100%;background:transparent;border:none;" +
      "padding:6px 12px;text-align:left;color:inherit;cursor:pointer;" +
      "font-family:inherit;font-size:0.75rem;";
    buttons[i].addEventListener("mouseenter", function () {
      this.style.background = "#222";
    });
    buttons[i].addEventListener("mouseleave", function () {
      this.style.background = "transparent";
    });
  }

  // handle clicks on the menu buttons
  $contextMenu.addEventListener("click", function (e) {
    e.stopPropagation();
    var action = e.target.getAttribute("data-action");
    if (action === "cumulative") {
      lockFocus(id, "cumulative");
    } else if (action === "strict") {
      lockFocus(id, "strict");
    }
    closeContextMenu();
  });

  document.body.appendChild($contextMenu);

  // tap outside to close
  setTimeout(function () {
    document.addEventListener("click", closeContextMenu, { once: true });
    document.addEventListener("touchstart", closeContextMenu, { once: true });
  }, 50);
}

function closeContextMenu() {
  if ($contextMenu) {
    $contextMenu.remove();
    $contextMenu = null;
  }
}

/* --- event delegation for nodes (updated for mobile long press) --- */
function setupNodeEvents() {
  $world.removeEventListener("click", onNodeClick);
  $world.removeEventListener("mouseenter", onNodeEnter, true);
  $world.removeEventListener("mouseleave", onNodeLeave, true);
  $world.removeEventListener("touchstart", onNodeTouchStart, true);
  $world.removeEventListener("touchend", onNodeTouchEnd, true);
  $world.removeEventListener("touchmove", onNodeTouchMove, true);

  $world.addEventListener("click", onNodeClick);
  $world.addEventListener("mouseenter", onNodeEnter, true);
  $world.addEventListener("mouseleave", onNodeLeave, true);

  // mobile touch events only if touch device
  if (isTouchDevice) {
    $world.addEventListener("touchstart", onNodeTouchStart, true);
    $world.addEventListener("touchend", onNodeTouchEnd, true);
    $world.addEventListener("touchmove", onNodeTouchMove, true);
  }
}

/* --- click handler (now respects mobile context menu and lock taps) --- */
function onNodeClick(e) {
  // ignore if it was a right‑click or from the context menu
  if (e.button && e.button !== 0) return;
  if (e.target.closest(".node-ctx-menu")) return;

  var nodeEl = e.target.closest(".map-node");
  if (!nodeEl || nodeEl.classList.contains("filter-hidden")) return;

  var id = nodeEl.dataset.id;
  var post = postMap[id];
  if (!post) return;

  // if a long press just happened, ignore the click that follows
  if (longPressFired) {
    longPressFired = false;
    e.preventDefault();
    return;
  }

  // mobile lock interaction – tapping nodes while locked
  if (isTouchDevice && lockNodeId) {
    e.preventDefault();
    if (id === lockNodeId) {
      unlockFocus();
      return;
    }
    if (lockMode === "cumulative") {
      // toggle this node's connections
      if (highlightedNodes.hasOwnProperty(id)) {
        delete highlightedNodes[id];
      } else {
        highlightedNodes[id] = true;
      }
      refreshHighlights();
    }
    // strict mode – do nothing
    return;
  }

  // lock/unlock with shift / ctrl+shift (desktop only)
  if (e.shiftKey) {
    e.preventDefault();
    var isCtrl = e.ctrlKey || e.metaKey; // works on mac too

    if (isCtrl) {
      // ctrl+shift+click = strict mode
      if (lockNodeId === id) {
        unlockFocus();
      } else {
        lockFocus(id, "strict");
      }
    } else {
      // shift+click = cumulative mode
      if (lockNodeId === id) {
        unlockFocus();
      } else {
        lockFocus(id, "cumulative");
      }
    }
    return;
  }

  // normal click = open the post
  if (post.href) window.location.href = post.href;
}

/* --- mobile touch events for long press – now highlights before menu --- */
function onNodeTouchStart(e) {
  var nodeEl = e.target.closest(".map-node");
  if (!nodeEl || nodeEl.classList.contains("filter-hidden")) return;

  var touch = e.touches[0];
  longPressNode = nodeEl;
  var id = nodeEl.dataset.id;

  // start a timer for long press
  longPressTimer = setTimeout(function () {
    if (longPressNode === nodeEl) {
      longPressFired = true;
      // highlight this node's connections (like desktop hover)
      highlightConns(id);
      showContextMenu(nodeEl, id);
    }
    longPressTimer = null;
  }, 500);

  // store touch start position to detect movement
  nodeEl._touchStartX = touch.clientX;
  nodeEl._touchStartY = touch.clientY;
}

function onNodeTouchMove(e) {
  if (!longPressNode) return;
  var touch = e.touches[0];
  var nodeEl = longPressNode;
  var dx = touch.clientX - nodeEl._touchStartX;
  var dy = touch.clientY - nodeEl._touchStartY;
  // cancel if moved more than 10px
  if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
    longPressNode = null;
  }
}

function onNodeTouchEnd(e) {
  if (longPressTimer) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
  longPressNode = null;
}

function onNodeEnter(e) {
  var nodeEl = e.target.closest(".map-node");
  if (!nodeEl || nodeEl.classList.contains("filter-hidden")) return;
  var id = nodeEl.dataset.id;
  var post = postMap[id];
  if (!post) return;

  showTip(post, e.clientX, e.clientY);

  if (lockNodeId) {
    // cumulative mode: add hovered node's connections too
    if (lockMode === "cumulative" && id !== lockNodeId) {
      highlightedNodes[id] = true;
      refreshHighlights();
    }
    // strict mode: don't touch the highlights
  } else {
    // normal hover just highlights that one node
    highlightConns(id);
  }
}

function onNodeLeave(e) {
  var nodeEl = e.target.closest(".map-node");
  if (!nodeEl) return;
  var id = nodeEl.dataset.id;

  hideTip();

  if (lockNodeId) {
    // cumulative mode: remove the hovered node from the set
    if (lockMode === "cumulative" && id !== lockNodeId) {
      delete highlightedNodes[id];
      refreshHighlights();
    }
    // strict mode: still nothing
  } else {
    resetConns();
  }
}

/* --- unlock on escape or background click --- */
document.addEventListener("keydown", function (e) {
  if (e.key === "Escape") {
    closeContextMenu();
    if (lockNodeId) unlockFocus();
  }
});

$viewport.addEventListener("click", function (e) {
  // ignore clicks from the context menu – they shouldn't trigger unlock
  if (e.target.closest(".node-ctx-menu")) return;

  // close the context menu if tapping outside
  if ($contextMenu && !e.target.closest(".node-ctx-menu")) {
    closeContextMenu();
  }
  // unlock on empty space (but not when menu was just closed)
  if (
    !e.target.closest(".map-node") &&
    !e.target.closest(".node-ctx-menu") &&
    lockNodeId
  ) {
    unlockFocus();
  }
});

/* --- force-directed layout (makes the nodes spread out nicely) --- */
function runLayout() {
  var n = nodes.length;
  if (!n) return;

  var area = worldW * worldH;
  var k = Math.sqrt(area / n);
  var temp = 50;
  var hw = worldW / 2 - 50;
  var hh = worldH / 2 - 50;

  nodes.forEach(function (d) {
    if (d.x === undefined || d.x === null) {
      d.x = (Math.random() - 0.5) * worldW * 0.6;
      d.y = (Math.random() - 0.5) * worldH * 0.6;
    }
  });

  // fewer iterations on mobile – still looks okay, much faster
  var maxIter = isTouchDevice ? 60 : 200;

  for (var iter = 0; iter < maxIter; iter++) {
    var disp = {};
    nodes.forEach(function (d) {
      disp[d.id] = { x: 0, y: 0 };
    });

    for (var i = 0; i < n; i++) {
      for (var j = i + 1; j < n; j++) {
        var a = nodes[i],
          b = nodes[j];
        var dx = a.x - b.x,
          dy = a.y - b.y;
        var dist = Math.sqrt(dx * dx + dy * dy) || 1;
        var force = (k * k) / dist;
        disp[a.id].x += (dx / dist) * force;
        disp[a.id].y += (dy / dist) * force;
        disp[b.id].x -= (dx / dist) * force;
        disp[b.id].y -= (dy / dist) * force;
      }
    }

    links.forEach(function (l) {
      var a = postMap[l.source],
        b = postMap[l.target];
      if (!a || !b) return;
      var dx = a.x - b.x,
        dy = a.y - b.y;
      var dist = Math.sqrt(dx * dx + dy * dy) || 1;
      var force = (dist * dist) / k;
      disp[a.id].x -= (dx / dist) * force;
      disp[a.id].y -= (dy / dist) * force;
      disp[b.id].x += (dx / dist) * force;
      disp[b.id].y += (dy / dist) * force;
    });

    nodes.forEach(function (d) {
      var f = disp[d.id];
      var len = Math.sqrt(f.x * f.x + f.y * f.y);
      if (len > 0) {
        var sc = Math.min(len, temp) / len;
        d.x += f.x * sc;
        d.y += f.y * sc;
      }
      d.x = clamp(d.x, -hw, hw);
      d.y = clamp(d.y, -hh, hh);
    });

    temp *= 0.95;
    if (temp < 0.1) break;
  }
}

/* --- centre layout, resize world, render --- */
function centerAndResizeWorld() {
  if (!nodes.length) {
    worldW = 800;
    worldH = 600;
    resizeWorld();
    fitView();
    return;
  }

  var anchor = nodes.find(function (d) {
    return d.id === "first-post";
  });
  if (anchor) {
    var ax = -anchor.x,
      ay = -anchor.y;
    nodes.forEach(function (d) {
      d.x += ax;
      d.y += ay;
    });
  } else {
    var cx =
      nodes.reduce(function (s, d) {
        return s + d.x;
      }, 0) / nodes.length;
    var cy =
      nodes.reduce(function (s, d) {
        return s + d.y;
      }, 0) / nodes.length;
    nodes.forEach(function (d) {
      d.x -= cx;
      d.y -= cy;
    });
  }

  var xs = nodes.map(function (p) {
    return p.x;
  });
  var ys = nodes.map(function (p) {
    return p.y;
  });
  var halfW =
    Math.max(
      Math.abs(Math.min.apply(null, xs)),
      Math.abs(Math.max.apply(null, xs)),
    ) + WORLD_PADDING;
  var halfH =
    Math.max(
      Math.abs(Math.min.apply(null, ys)),
      Math.abs(Math.max.apply(null, ys)),
    ) + WORLD_PADDING;
  worldW = 2 * halfW;
  worldH = 2 * halfH;

  nodes.forEach(function (d) {
    d.x += halfW;
    d.y += halfH;
  });

  resizeWorld();
  renderNodes();
  renderConnections();
  connGroups = null;
  setupNodeEvents();
  fitView();
}

/* --- sync world DOM and SVG sizes --- */
function resizeWorld() {
  $world.style.width = worldW + "px";
  $world.style.height = worldH + "px";

  $svg.setAttribute("width", worldW);
  $svg.setAttribute("height", worldH);
  $svg.setAttribute("viewBox", "0 0 " + worldW + " " + worldH);

  var bg = $svg.querySelector(
    'rect:not([fill^="url"]):not([stroke-dasharray])',
  );
  var grid = $svg.querySelector('rect[fill^="url"]');
  var border = $svg.querySelector("rect[stroke-dasharray]");

  if (bg) {
    bg.setAttribute("width", worldW);
    bg.setAttribute("height", worldH);
  }
  if (grid) {
    grid.setAttribute("width", worldW);
    grid.setAttribute("height", worldH);
  }
  if (border) {
    border.setAttribute("width", worldW - 2);
    border.setAttribute("height", worldH - 2);
  }
}

/* --- data loading – directly from global variable, no fetch --- */
function loadData() {
  if (window.__MAP_DATA) {
    useData(window.__MAP_DATA);
  } else {
    showError(
      "Could not load map data. " +
        "Make sure <code>config/map-data.js</code> is loaded before this script.",
    );
  }
}

function useData(data) {
  var allNodes = data.nodes || [];
  var allLinks = data.connections || data.links || [];

  // filter out nodes hidden on map
  nodes = allNodes.filter(function (n) {
    return !n.hideOnMap;
  });

  postMap = {};
  nodes.forEach(function (p) {
    postMap[p.id] = p;
  });

  // filter links so only existing nodes remain
  links = allLinks.filter(function (l) {
    return postMap[l.source] && postMap[l.target];
  });

  // update filter badge counts
  var types = { post: 0, story: 0, dreg: 0 };
  nodes.forEach(function (n) {
    if (types[n.type] !== undefined) types[n.type]++;
  });
  ["post", "story", "dreg"].forEach(function (t) {
    var badge = $filterPanel.querySelector(
      'label[data-type="' + t + '"] .count-badge',
    );
    if (badge) badge.textContent = types[t];
  });

  var n = nodes.length || 1;
  // initial world size – smaller on mobile to help the layout engine
  if (isTouchDevice) {
    worldW = Math.max(600, n * 80);
    worldH = Math.max(400, n * 60);
  } else {
    worldW = Math.max(800, n * 120);
    worldH = Math.max(600, n * 80);
  }

  runLayout();
  centerAndResizeWorld();
}

function showError(msg) {
  $world.innerHTML = "";
  var div = document.createElement("div");
  div.style.cssText =
    "position:absolute;top:50%;left:50%;" +
    "transform:translate(-50%,-50%);color:#888;" +
    "text-align:center;font-size:1.2rem;pointer-events:none;";
  div.innerHTML = msg;
  $world.appendChild(div);
  nodes = [];
  worldW = 800;
  worldH = 600;
  resizeWorld();
  fitView();
}

/* boot */
loadData();
