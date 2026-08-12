/* ================================================================
   map-builder.js + map-interaction.js – merged & optimised
   - Radial initial layout around first-post
   - Edge‑node repulsion to avoid lines crossing unrelated nodes
   - Single file, DOM‑ready init, no visual changes
   ================================================================ */
(function () {
  "use strict";

  /* ---------- config ---------- */
  var WORLD_PADDING = 200;
  var SVG_NS = "http://www.w3.org/2000/svg";

  var COLOR = {
    post: "#7f9eff",
    story: "#ffb36b",
    dreg: "#6c6f78",
  };

  /* --- utility functions --- */
  function clamp(v, lo, hi) {
    return Math.min(hi, Math.max(lo, v));
  }

  function esc(s) {
    var d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  /* distance from point (px,py) to line segment a-b */
  function pointToSegmentDist(px, py, ax, ay, bx, by) {
    var dx = bx - ax,
      dy = by - ay;
    if (dx === 0 && dy === 0) return Math.hypot(px - ax, py - ay);
    var t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy);
    t = clamp(t, 0, 1);
    var projx = ax + t * dx,
      projy = ay + t * dy;
    return Math.hypot(px - projx, py - projy);
  }

  /* ---------- world & view state ---------- */
  var worldW = 1000,
    worldH = 1000;
  var nodes = [],
    links = [],
    postMap = {};
  var filters = { post: true, story: true, dreg: true };
  var lockNodeId = null,
    lockMode = null,
    highlightedNodes = {};

  /* --- DOM references (set in init) --- */
  var $world, $svg, $conns, $tip, $filterPanel, $filterToggle, $viewport,
    $zoomPct, $hud, $hudToggle;
  var connGroups = null; // cache for connection groups

  /* interaction state */
  var view = { panX: 0, panY: 0, scale: 0.72 };
  var drag = { active: false, ox: 0, oy: 0 };
  var touch = { active: false, lx: 0, ly: 0, ldist: 0 };
  var isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0;

  /* ---------- force layout with edge‑node repulsion ---------- */
  function runLayout() {
    var n = nodes.length;
    if (!n) return;

    // ---- BFS depths from first-post ----
    var depths = {};
    var adj = {};
    nodes.forEach(function (d) {
      adj[d.id] = [];
      depths[d.id] = null;
    });
    links.forEach(function (l) {
      if (adj[l.source] && adj[l.target]) {
        adj[l.source].push(l.target);
        adj[l.target].push(l.source);
      }
    });
    var queue = ["first-post"];
    var head = 0;
    depths["first-post"] = 0;
    while (head < queue.length) {
      var id = queue[head++];
      var nd = depths[id] + 1;
      (adj[id] || []).forEach(function (nid) {
        if (depths[nid] === null) {
          depths[nid] = nd;
          queue.push(nid);
        }
      });
    }
    var maxDepth = 0;
    nodes.forEach(function (d) {
      if (depths[d.id] !== null) maxDepth = Math.max(maxDepth, depths[d.id]);
    });

    // ---- initial positions (radial) ----
    var spacing = 180; // base radius per depth level
    nodes.forEach(function (d) {
      if (d.id === "first-post") {
        d.x = 0;
        d.y = 0;
        return;
      }
      var depth = depths[d.id] !== null ? depths[d.id] : maxDepth + 1;
      var r = depth * spacing + (Math.random() - 0.5) * 40; // slight jitter
      var angle = Math.random() * 2 * Math.PI;
      d.x = r * Math.cos(angle);
      d.y = r * Math.sin(angle);
    });

    var area = worldW * worldH || 800 * 600;
    var k = Math.sqrt(area / n);
    var temp = 50;
    var hw = worldW / 2 - 50;
    var hh = worldH / 2 - 50;
    var maxIter = isTouchDevice ? 60 : 200;

    // pre-build lookup for edge endpoints (for performance)
    var edgeEndpoints = links.map(function (l) {
      return { a: postMap[l.source], b: postMap[l.target] };
    });

    for (var iter = 0; iter < maxIter; iter++) {
      // zero displacements
      var disp = {};
      nodes.forEach(function (d) {
        disp[d.id] = { x: 0, y: 0 };
      });

      // pairwise repulsion (all nodes)
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

      // link attraction
      edgeEndpoints.forEach(function (e) {
        var a = e.a,
          b = e.b;
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

      // edge‑node repulsion (push nodes away from edges they aren't part of)
      var edgeNodeThresh = 30; // node radius (15) + margin
      var edgeNodeStrength = 2.5;
      nodes.forEach(function (node) {
        edgeEndpoints.forEach(function (e) {
          var u = e.a,
            v = e.b;
          if (!u || !v) return;
          if (node === u || node === v) return; // skip own edges
          // quick bounding box reject
          if (
            node.x < Math.min(u.x, v.x) - edgeNodeThresh ||
            node.x > Math.max(u.x, v.x) + edgeNodeThresh ||
            node.y < Math.min(u.y, v.y) - edgeNodeThresh ||
            node.y > Math.max(u.y, v.y) + edgeNodeThresh
          )
            return;
          var dist = pointToSegmentDist(node.x, node.y, u.x, u.y, v.x, v.y);
          if (dist < edgeNodeThresh) {
            // direction: perpendicular away from the closest point on segment
            var dx = u.x - v.x,
              dy = u.y - v.y;
            var segLen = Math.sqrt(dx * dx + dy * dy);
            if (segLen < 1e-6) return;
            // vector perpendicular to the segment (rotate 90°)
            var perpX = -dy / segLen,
              perpY = dx / segLen;
            // sign: choose the side that points away from the node
            var projX = node.x - u.x,
              projY = node.y - u.y;
            var dot = projX * perpX + projY * perpY;
            if (dot > 0) { perpX = -perpX; perpY = -perpY; }
            var force = (edgeNodeThresh - dist) * edgeNodeStrength;
            disp[node.id].x += perpX * force;
            disp[node.id].y += perpY * force;
          }
        });
      });

      // apply displacements with temperature
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

  /* ---------- centre layout & resize world ---------- */
  function centerAndResizeWorld() {
    if (!nodes.length) {
      worldW = 800;
      worldH = 600;
      resizeWorld();
      fitView();
      return;
    }

    // shift so that first-post is at (0,0)
    var anchor = nodes.find(function (d) { return d.id === "first-post"; });
    if (anchor) {
      var ax = -anchor.x,
        ay = -anchor.y;
      nodes.forEach(function (d) { d.x += ax; d.y += ay; });
    } else {
      var cx = nodes.reduce(function (s, d) { return s + d.x; }, 0) / nodes.length;
      var cy = nodes.reduce(function (s, d) { return s + d.y; }, 0) / nodes.length;
      nodes.forEach(function (d) { d.x -= cx; d.y -= cy; });
    }

    var xs = nodes.map(function (p) { return p.x; });
    var ys = nodes.map(function (p) { return p.y; });
    var halfW = Math.max(Math.abs(Math.min.apply(null, xs)), Math.abs(Math.max.apply(null, xs))) + WORLD_PADDING;
    var halfH = Math.max(Math.abs(Math.min.apply(null, ys)), Math.abs(Math.max.apply(null, ys))) + WORLD_PADDING;
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

  /* ---------- DOM sizing ---------- */
  function resizeWorld() {
    $world.style.width = worldW + "px";
    $world.style.height = worldH + "px";
    $svg.setAttribute("width", worldW);
    $svg.setAttribute("height", worldH);
    $svg.setAttribute("viewBox", "0 0 " + worldW + " " + worldH);

    var bg = $svg.querySelector('rect:not([fill^="url"]):not([stroke-dasharray])');
    var grid = $svg.querySelector('rect[fill^="url"]');
    var border = $svg.querySelector("rect[stroke-dasharray]");
    if (bg) { bg.setAttribute("width", worldW); bg.setAttribute("height", worldH); }
    if (grid) { grid.setAttribute("width", worldW); grid.setAttribute("height", worldH); }
    if (border) { border.setAttribute("width", worldW - 2); border.setAttribute("height", worldH - 2); }
  }

  /* ---------- rendering ---------- */
  function renderConnections() {
    while ($conns.firstChild) $conns.removeChild($conns.firstChild);
    var frag = document.createDocumentFragment();

    links.forEach(function (conn, idx) {
      var from = postMap[conn.source],
        to = postMap[conn.target];
      if (!from || !to) return;

      var d = "M " + from.x + " " + from.y + " L " + to.x + " " + to.y;
      var g = document.createElementNS(SVG_NS, "g");
      g.classList.add("conn-g");
      g.dataset.from = conn.source;
      g.dataset.to = conn.target;

      var base = document.createElementNS(SVG_NS, "path");
      base.setAttribute("d", d);
      base.setAttribute("fill", "none");
      base.setAttribute("stroke", conn.weak ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.12)");
      base.setAttribute("stroke-width", conn.weak ? "0.8" : "1");
      base.classList.add("conn-base");
      g.appendChild(base);

      var pulse = document.createElementNS(SVG_NS, "path");
      pulse.setAttribute("d", d);
      pulse.setAttribute("fill", "none");
      pulse.setAttribute("stroke", conn.weak ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.5)");
      pulse.setAttribute("stroke-width", conn.weak ? "0.8" : "1.2");
      pulse.setAttribute("stroke-dasharray", conn.weak ? "2 18" : "4 12");
      pulse.setAttribute("stroke-linecap", "round");
      pulse.classList.add("conn-pulse");
      if (conn.weak) pulse.classList.add("weak");
      pulse.style.animationDelay = -((idx * 0.37) % 3) + "s";
      g.appendChild(pulse);

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
    connGroups = null;
    applyFilters();
  }

  function renderNodes() {
    var oldNodes = $world.querySelectorAll(".map-node");
    for (var i = 0; i < oldNodes.length; i++) oldNodes[i].remove();

    var frag = document.createDocumentFragment();
    nodes.forEach(function (post) {
      var col = COLOR[post.type] || COLOR.post;
      var el = document.createElement("div");
      el.className = "map-node";
      el.dataset.id = post.id;
      el.dataset.type = post.type;
      el.dataset.href = post.href;
      el.style.left = post.x + "px";
      el.style.top = post.y + "px";

      var visual = document.createElement("div");
      visual.className = "node-visual";
      visual.style.setProperty("--node-color", col);
      el.appendChild(visual);

      var label = document.createElement("span");
      label.className = "node-label";
      label.innerHTML = post.title;
      el.appendChild(label);

      frag.appendChild(el);
    });
    $world.appendChild(frag);
    applyFilters();
  }

  /* ---------- filters ---------- */
  function applyFilters() {
    var allNodes = $world.querySelectorAll(".map-node");
    for (var i = 0; i < allNodes.length; i++) {
      var node = allNodes[i];
      var type = node.dataset.type;
      var visible = filters[type] !== false;
      node.classList.toggle("filter-hidden", !visible);
    }
    var allConns = $conns.querySelectorAll(".conn-g");
    for (var j = 0; j < allConns.length; j++) {
      var g = allConns[j];
      var from = postMap[g.dataset.from],
        to = postMap[g.dataset.to];
      var visible = from && to && filters[from.type] !== false && filters[to.type] !== false;
      g.classList.toggle("filter-hidden", !visible);
    }
  }

  /* ---------- tooltip ---------- */
  var tipMoveHandler = null;
  function showTip(post, cx, cy) {
    var label = post.type.charAt(0).toUpperCase() + post.type.slice(1);
    $tip.innerHTML =
      '<span class="tip-title">' + post.title + "</span>" +
      '<span class="tip-meta">' + esc(post.date) + " &nbsp;·&nbsp; " + label + "</span>";
    $tip.classList.add("show");
    placeTip(cx, cy);
    if (!tipMoveHandler) {
      tipMoveHandler = function (e) { placeTip(e.clientX, e.clientY); };
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

  /* ---------- connection highlighting ---------- */
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
    if (lockNodeId) return;
    if (!connGroups) connGroups = $conns.querySelectorAll(".conn-g");
    for (var i = 0; i < connGroups.length; i++) {
      connGroups[i].classList.remove("conn-active", "conn-faded");
    }
  }
  function refreshHighlights() {
    if (!connGroups) connGroups = $conns.querySelectorAll(".conn-g");
    for (var i = 0; i < connGroups.length; i++) {
      var g = connGroups[i];
      var hit = highlightedNodes.hasOwnProperty(g.dataset.from) ||
                highlightedNodes.hasOwnProperty(g.dataset.to);
      g.classList.toggle("conn-active", hit);
      g.classList.toggle("conn-faded", !hit);
    }
  }

  /* ---------- lock logic ---------- */
  function lockFocus(nodeId, mode) {
    if (lockNodeId) {
      var prevEl = $world.querySelector('.map-node[data-id="' + lockNodeId + '"]');
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
    refreshHighlights();
    $viewport.classList.remove("locked-focus");
  }

  /* ---------- mobile context menu ---------- */
  var longPressTimer = null,
    longPressNode = null,
    $contextMenu = null,
    longPressFired = false;

  function showContextMenu(nodeEl, id) {
    if ($contextMenu) { $contextMenu.remove(); $contextMenu = null; }
    var rect = nodeEl.getBoundingClientRect();
    var nodeCenterX = rect.left + rect.width / 2;
    var nodeCenterY = rect.top + rect.height / 2;
    $contextMenu = document.createElement("div");
    $contextMenu.className = "node-ctx-menu";
    $contextMenu.innerHTML =
      '<button data-action="cumulative">Cumulative Lock</button>' +
      '<button data-action="strict">Strict Lock</button>';
    $contextMenu.style.cssText =
      "position:fixed;background:rgba(10,10,10,0.95);border:1px solid #333;" +
      "border-radius:6px;padding:4px 0;z-index:999;font-family:monospace;" +
      "font-size:0.75rem;color:#ccc;box-shadow:0 4px 12px rgba(0,0,0,0.8);" +
      "overflow:hidden;-webkit-tap-highlight-color:transparent;opacity:0;";
    document.body.appendChild($contextMenu);
    var menuRect = $contextMenu.getBoundingClientRect();
    var menuW = menuRect.width,
      menuH = menuRect.height;
    var left = nodeCenterX - menuW / 2;
    var top = nodeCenterY + 24;
    if (left < 4) left = 4;
    if (left + menuW > window.innerWidth - 4) left = window.innerWidth - menuW - 4;
    if (top + menuH > window.innerHeight - 4) top = nodeCenterY - menuH - 10;
    $contextMenu.style.left = left + "px";
    $contextMenu.style.top = top + "px";
    $contextMenu.style.opacity = "1";
    var buttons = $contextMenu.querySelectorAll("button");
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].style.cssText =
        "display:block;width:100%;background:transparent;border:none;" +
        "padding:6px 12px;text-align:left;color:inherit;cursor:pointer;" +
        "font-family:inherit;font-size:0.75rem;" +
        "-webkit-tap-highlight-color:transparent;outline:none;";
      buttons[i].addEventListener("mouseenter", function () { this.style.background = "#222"; });
      buttons[i].addEventListener("mouseleave", function () { this.style.background = "transparent"; });
    }
    $contextMenu.addEventListener("click", function (e) {
      e.stopPropagation();
      var action = e.target.getAttribute("data-action");
      if (action === "cumulative") lockFocus(id, "cumulative");
      else if (action === "strict") lockFocus(id, "strict");
      closeContextMenu();
    });
    $contextMenu.addEventListener("touchstart", function (e) { e.stopPropagation(); });
    setTimeout(function () {
      document.addEventListener("click", closeContextMenu, { once: true });
      document.addEventListener("touchstart", closeContextMenu, { once: true });
    }, 50);
  }

  function closeContextMenu() {
    if ($contextMenu) { $contextMenu.remove(); $contextMenu = null; }
  }

  /* ---------- node event delegation ---------- */
  function setupNodeEvents() {
    $world.removeEventListener("click", onNodeClick);
    $world.removeEventListener("mouseenter", onNodeEnter, true);
    $world.removeEventListener("mouseleave", onNodeLeave, true);
    $world.removeEventListener("touchstart", onNodeTouchStart, true);
    $world.removeEventListener("touchend", onNodeTouchEnd, true);
    $world.removeEventListener("touchmove", onNodeTouchMove, true);

    if (!isTouchDevice) {
      $world.addEventListener("click", onNodeClick);
      $world.addEventListener("mouseenter", onNodeEnter, true);
      $world.addEventListener("mouseleave", onNodeLeave, true);
    } else {
      $world.addEventListener("touchstart", onNodeTouchStart, true);
      $world.addEventListener("touchend", onNodeTouchEnd, true);
      $world.addEventListener("touchmove", onNodeTouchMove, true);
    }
  }

  function onNodeClick(e) {
    if (e.button && e.button !== 0) return;
    if (e.target.closest(".node-ctx-menu")) return;
    var nodeEl = e.target.closest(".map-node");
    if (!nodeEl || nodeEl.classList.contains("filter-hidden")) return;
    var id = nodeEl.dataset.id;
    var post = postMap[id];
    if (!post) return;
    if (e.shiftKey) {
      e.preventDefault();
      var isCtrl = e.ctrlKey || e.metaKey;
      if (isCtrl) {
        if (lockNodeId === id) unlockFocus();
        else lockFocus(id, "strict");
      } else {
        if (lockNodeId === id) unlockFocus();
        else lockFocus(id, "cumulative");
      }
      return;
    }
    if (post.href) window.location.href = post.href;
  }

  function onNodeTouchStart(e) {
    var nodeEl = e.target.closest(".map-node");
    if (!nodeEl || nodeEl.classList.contains("filter-hidden")) return;
    var touch = e.touches[0];
    longPressNode = nodeEl;
    var id = nodeEl.dataset.id;
    longPressTimer = setTimeout(function () {
      if (longPressNode === nodeEl) {
        longPressFired = true;
        highlightConns(id);
        showContextMenu(nodeEl, id);
      }
      longPressTimer = null;
    }, 500);
    nodeEl._touchStartX = touch.clientX;
    nodeEl._touchStartY = touch.clientY;
  }

  function onNodeTouchMove(e) {
    if (!longPressNode) return;
    var touch = e.touches[0];
    var nodeEl = longPressNode;
    var dx = touch.clientX - nodeEl._touchStartX;
    var dy = touch.clientY - nodeEl._touchStartY;
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
      longPressNode = null;
      resetConns();
    }
  }

  function onNodeTouchEnd(e) {
    if (!longPressNode) return;
    var nodeEl = longPressNode;
    var id = nodeEl.dataset.id;
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
      if (lockNodeId) {
        e.preventDefault();
        if (id === lockNodeId) unlockFocus();
        else if (lockMode === "cumulative") {
          if (highlightedNodes.hasOwnProperty(id)) delete highlightedNodes[id];
          else highlightedNodes[id] = true;
          refreshHighlights();
        }
      } else {
        e.preventDefault();
        var post = postMap[id];
        if (post && post.href) window.location.href = post.href;
      }
    } else {
      longPressFired = false;
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
      if (lockMode === "cumulative" && id !== lockNodeId) {
        highlightedNodes[id] = true;
        refreshHighlights();
      }
    } else {
      highlightConns(id);
    }
  }

  function onNodeLeave(e) {
    var nodeEl = e.target.closest(".map-node");
    if (!nodeEl) return;
    var id = nodeEl.dataset.id;
    hideTip();
    if (lockNodeId) {
      if (lockMode === "cumulative" && id !== lockNodeId) {
        delete highlightedNodes[id];
        refreshHighlights();
      }
    } else {
      resetConns();
    }
  }

  /* ---------- global unlock events ---------- */
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      closeContextMenu();
      if (lockNodeId) unlockFocus();
    }
  });

  // (viewport click to unlock or close menu – set in init after DOM ready)

  /* ---------- viewport interaction (pan/zoom) ---------- */
  var SCALE_MIN = 0.15,
    SCALE_MAX = 2.6,
    ZOOM_STEP = 0.12;

  function applyView() {
    var vw = $viewport.clientWidth;
    var vh = $viewport.clientHeight;
    var s = clamp(view.scale, SCALE_MIN, SCALE_MAX);
    view.scale = s;
    var halfW = worldW / 2,
      halfH = worldH / 2;
    var limitX = halfW * s,
      limitY = halfH * s;
    view.panX = clamp(view.panX, -limitX, limitX);
    view.panY = clamp(view.panY, -limitY, limitY);
    var tx = vw / 2 + view.panX - halfW * s;
    var ty = vh / 2 + view.panY - halfH * s;
    $world.style.transform = "translate(" + tx + "px," + ty + "px) scale(" + s + ")";
    $zoomPct.textContent = Math.round(s * 100) + "%";
  }

  function fitView() {
    var vw = $viewport.clientWidth,
      vh = $viewport.clientHeight,
      pad = 24;
    view.panX = 0;
    view.panY = 0;
    view.scale = clamp(Math.min((vw - pad * 2) / worldW, (vh - pad * 2) / worldH), SCALE_MIN, SCALE_MAX);
    applyView();
  }

  function zoomAt(sx, sy, delta) {
    var rect = $viewport.getBoundingClientRect();
    var vw = $viewport.clientWidth,
      vh = $viewport.clientHeight;
    var cx = sx - rect.left - vw / 2,
      cy = sy - rect.top - vh / 2;
    var wx = (cx - view.panX) / view.scale,
      wy = (cy - view.panY) / view.scale;
    var ns = clamp(view.scale * (1 + delta), SCALE_MIN, SCALE_MAX);
    view.panX = cx - wx * ns;
    view.panY = cy - wy * ns;
    view.scale = ns;
    applyView();
  }

  function zoomCenter(delta) {
    var rect = $viewport.getBoundingClientRect();
    zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, delta);
  }

  /* ---------- data loading ---------- */
  function loadData() {
    if (window.__MAP_DATA) {
      useData(window.__MAP_DATA);
    } else {
      showError("Could not load map data. Make sure <code>config/map-data.js</code> is loaded before this script.");
    }
  }

  function useData(data) {
    var allNodes = data.nodes || [];
    var allLinks = data.connections || data.links || [];
    nodes = allNodes.filter(function (n) { return !n.hideOnMap; });
    postMap = {};
    nodes.forEach(function (p) { postMap[p.id] = p; });
    links = allLinks.filter(function (l) { return postMap[l.source] && postMap[l.target]; });

    // update filter counts
    var types = { post: 0, story: 0, dreg: 0 };
    nodes.forEach(function (n) { if (types[n.type] !== undefined) types[n.type]++; });
    ["post", "story", "dreg"].forEach(function (t) {
      var badge = $filterPanel.querySelector('label[data-type="' + t + '"] .count-badge');
      if (badge) badge.textContent = types[t];
    });

    // rough initial world size
    var n = nodes.length || 1;
    worldW = isTouchDevice ? Math.max(600, n * 80) : Math.max(800, n * 120);
    worldH = isTouchDevice ? Math.max(400, n * 60) : Math.max(600, n * 80);

    runLayout();
    centerAndResizeWorld();
  }

  function showError(msg) {
    $world.innerHTML = "";
    var div = document.createElement("div");
    div.style.cssText =
      "position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#888;" +
      "text-align:center;font-size:1.2rem;pointer-events:none;";
    div.innerHTML = msg;
    $world.appendChild(div);
    nodes = [];
    worldW = 800;
    worldH = 600;
    resizeWorld();
    fitView();
  }

  /* ---------- initialisation (runs when DOM is ready) ---------- */
  function initMap() {
    // grab all DOM elements
    $world = document.getElementById("map-world");
    $svg = document.getElementById("world-svg");
    $conns = document.getElementById("connections-group");
    $tip = document.getElementById("node-tip");
    $filterPanel = document.getElementById("filter-panel");
    $filterToggle = document.getElementById("filter-handle");
    $viewport = document.getElementById("map-viewport");
    $zoomPct = document.getElementById("zoom-pct");
    $hud = document.getElementById("map-hud");
    $hudToggle = document.getElementById("hud-toggle");

    // filter panel behaviour
    if ($filterToggle && $filterPanel) {
      $filterToggle.addEventListener("click", function (e) {
        e.stopPropagation();
        $filterPanel.classList.toggle("open");
      });
      var closeBtn = $filterPanel.querySelector(".panel-close");
      if (closeBtn) {
        closeBtn.addEventListener("click", function (e) {
          e.stopPropagation();
          $filterPanel.classList.remove("open");
        });
      }
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && $filterPanel.classList.contains("open"))
          $filterPanel.classList.remove("open");
      });
      var resetBtn = document.getElementById("reset-filters");
      if (resetBtn) {
        resetBtn.addEventListener("click", function () {
          var cbs = $filterPanel.querySelectorAll("input[data-type]");
          for (var i = 0; i < cbs.length; i++) {
            cbs[i].checked = true;
            var evt = new Event("change", { bubbles: true });
            cbs[i].dispatchEvent(evt);
          }
        });
      }
    }

    // filter checkboxes
    var checkboxes = $filterPanel ? $filterPanel.querySelectorAll("input[data-type]") : [];
    for (var k = 0; k < checkboxes.length; k++) {
      (function (cb) {
        cb.addEventListener("change", function () {
          filters[cb.dataset.type] = cb.checked;
          applyFilters();
        });
      })(checkboxes[k]);
    }

    // viewport click to unlock / close menu
    $viewport.addEventListener("click", function (e) {
      if (e.target.closest(".node-ctx-menu")) return;
      if ($contextMenu && !e.target.closest(".node-ctx-menu")) closeContextMenu();
      if (!e.target.closest(".map-node") && lockNodeId) unlockFocus();
    });

    // mouse panning
    $viewport.addEventListener("mousedown", function (e) {
      if (e.button === 1) {
        e.preventDefault();
        drag.active = true;
        drag.ox = e.clientX - view.panX;
        drag.oy = e.clientY - view.panY;
        $viewport.classList.add("dragging");
        return;
      }
      if (e.button !== 0 || e.target.closest(".map-node")) return;
      drag.active = true;
      drag.ox = e.clientX - view.panX;
      drag.oy = e.clientY - view.panY;
      $viewport.classList.add("dragging");
      e.preventDefault();
    });
    window.addEventListener("mousemove", function (e) {
      if (!drag.active) return;
      view.panX = e.clientX - drag.ox;
      view.panY = e.clientY - drag.oy;
      applyView();
      drag.ox = e.clientX - view.panX;
      drag.oy = e.clientY - view.panY;
    });
    window.addEventListener("mouseup", function () {
      if (!drag.active) return;
      drag.active = false;
      $viewport.classList.remove("dragging");
    });
    $viewport.addEventListener("auxclick", function (e) { if (e.button === 1) e.preventDefault(); });

    // touch pan / pinch
    $viewport.addEventListener("touchstart", function (e) {
      if (e.touches.length === 1) {
        touch.active = true;
        touch.lx = e.touches[0].clientX;
        touch.ly = e.touches[0].clientY;
      } else if (e.touches.length === 2) {
        touch.active = false;
        touch.ldist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
      e.preventDefault();
    }, { passive: false });
    $viewport.addEventListener("touchmove", function (e) {
      if (e.touches.length === 1 && touch.active) {
        view.panX += e.touches[0].clientX - touch.lx;
        view.panY += e.touches[0].clientY - touch.ly;
        touch.lx = e.touches[0].clientX;
        touch.ly = e.touches[0].clientY;
        applyView();
      } else if (e.touches.length === 2) {
        var dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        var midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        var midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        zoomAt(midX, midY, (dist / touch.ldist - 1) * 0.8);
        touch.ldist = dist;
      }
      e.preventDefault();
    }, { passive: false });
    $viewport.addEventListener("touchend", function () { touch.active = false; });

    // scroll wheel zoom
    $viewport.addEventListener("wheel", function (e) {
      e.preventDefault();
      zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP);
    }, { passive: false });

    // zoom buttons
    document.getElementById("btn-zoom-in").addEventListener("click", function () { zoomCenter(ZOOM_STEP * 1.6); });
    document.getElementById("btn-zoom-out").addEventListener("click", function () { zoomCenter(-ZOOM_STEP * 1.6); });
    document.getElementById("btn-fit").addEventListener("click", fitView);

    if ($hudToggle) {
      $hudToggle.addEventListener("click", function (e) {
        e.stopPropagation();
        $hud.classList.toggle("collapsed");
      });
    }

    // keyboard shortcuts
    document.addEventListener("keydown", function (e) {
      if (e.key === "f" || e.key === "F" || e.key === "0") { fitView(); return; }
      if (e.key === "+" || e.key === "=") { zoomCenter(ZOOM_STEP * 1.5); return; }
      if (e.key === "-") { zoomCenter(-ZOOM_STEP * 1.5); return; }
    });

    // resize handler
    var resizeTimer;
    window.addEventListener("resize", function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(applyView, 60);
    });

    // load the data and build the map
    loadData();
  }

  // ---------- boot ----------
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initMap);
  } else {
    initMap();
  }
})();
