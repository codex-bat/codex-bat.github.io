/* ================================================================
   map-interaction.js – makes the map draggable, zoomable, and stuff
   ================================================================ */
"use strict";

/* config stuff */
var SCALE_MIN = 0.15;
var SCALE_MAX = 2.6;
var SCALE_INIT = 0.72;
var ZOOM_STEP = 0.12;

/* current view state */
var view = { panX: 0, panY: 0, scale: SCALE_INIT };
var drag = { active: false, ox: 0, oy: 0 };
var touch = { active: false, lx: 0, ly: 0, ldist: 0 };

/* grabbing DOM elements */
var $viewport = document.getElementById("map-viewport");
var $world = document.getElementById("map-world");
var $zoomPct = document.getElementById("zoom-pct");
var $hud = document.getElementById("map-hud");
var $hudToggle = document.getElementById("hud-toggle");

/* helper function – keeps numbers in a box */
function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

/* applyView – takes the pan and zoom numbers and slaps them onto
   the world as a CSS transform. uses global worldW / worldH
   that the builder sets. */
function applyView() {
  var vw = $viewport.clientWidth;
  var vh = $viewport.clientHeight;
  var s = clamp(view.scale, SCALE_MIN, SCALE_MAX);
  view.scale = s;

  var halfW = worldW / 2;
  var halfH = worldH / 2;

  /* pan limits so you can't fly off into the void */
  var limitX = halfW * s;
  var limitY = halfH * s;

  view.panX = clamp(view.panX, -limitX, limitX);
  view.panY = clamp(view.panY, -limitY, limitY);

  var tx = vw / 2 + view.panX - halfW * s;
  var ty = vh / 2 + view.panY - halfH * s;

  $world.style.transform =
    "translate(" + tx + "px," + ty + "px) scale(" + s + ")";
  $zoomPct.textContent = Math.round(s * 100) + "%";
}

/* fitView – zooms out so you can see the whole dang map */
function fitView() {
  var vw = $viewport.clientWidth;
  var vh = $viewport.clientHeight;
  var pad = 24;
  view.panX = 0;
  view.panY = 0;
  view.scale = clamp(
    Math.min((vw - pad * 2) / worldW, (vh - pad * 2) / worldH),
    SCALE_MIN,
    SCALE_MAX,
  );
  applyView();
}

/* zoomAt – zooms in or out centered on a specific screen point */
function zoomAt(sx, sy, delta) {
  var rect = $viewport.getBoundingClientRect();
  var vw = $viewport.clientWidth;
  var vh = $viewport.clientHeight;

  var cx = sx - rect.left - vw / 2;
  var cy = sy - rect.top - vh / 2;

  var wx = (cx - view.panX) / view.scale;
  var wy = (cy - view.panY) / view.scale;

  var ns = clamp(view.scale * (1 + delta), SCALE_MIN, SCALE_MAX);

  view.panX = cx - wx * ns;
  view.panY = cy - wy * ns;
  view.scale = ns;

  applyView();
}

/* zoomCenter – zooms from the middle of the viewport */
function zoomCenter(delta) {
  var rect = $viewport.getBoundingClientRect();
  zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, delta);
}

/* panning with the mouse – now middle-click works too */
$viewport.addEventListener("mousedown", function (e) {
  // middle-click always pans, even on nodes (so lock stays safe)
  if (e.button === 1) {
    e.preventDefault();
    drag.active = true;
    drag.ox = e.clientX - view.panX;
    drag.oy = e.clientY - view.panY;
    $viewport.classList.add("dragging");
    return;
  }

  // left-click only on empty space (no node)
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
  // resync after clamping so you don't hit a weird dead zone
  drag.ox = e.clientX - view.panX;
  drag.oy = e.clientY - view.panY;
});

window.addEventListener("mouseup", function () {
  if (!drag.active) return;
  drag.active = false;
  $viewport.classList.remove("dragging");
});

/* stop the browser from pasting when you middle click */
$viewport.addEventListener("auxclick", function (e) {
  if (e.button === 1) e.preventDefault();
});

/* touch pan / pinch – for phones and tablets */
$viewport.addEventListener(
  "touchstart",
  function (e) {
    if (e.touches.length === 1) {
      touch.active = true;
      touch.lx = e.touches[0].clientX;
      touch.ly = e.touches[0].clientY;
    } else if (e.touches.length === 2) {
      touch.active = false;
      touch.ldist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
    }
    e.preventDefault();
  },
  { passive: false },
);

$viewport.addEventListener(
  "touchmove",
  function (e) {
    if (e.touches.length === 1 && touch.active) {
      view.panX += e.touches[0].clientX - touch.lx;
      view.panY += e.touches[0].clientY - touch.ly;
      touch.lx = e.touches[0].clientX;
      touch.ly = e.touches[0].clientY;
      applyView();
    } else if (e.touches.length === 2) {
      var dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
      var midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      var midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      zoomAt(midX, midY, (dist / touch.ldist - 1) * 0.8);
      touch.ldist = dist;
    }
    e.preventDefault();
  },
  { passive: false },
);

$viewport.addEventListener("touchend", function () {
  touch.active = false;
});

/* scroll wheel zoom – zooms where your cursor is pointing */
$viewport.addEventListener(
  "wheel",
  function (e) {
    e.preventDefault();
    zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP);
  },
  { passive: false },
);

/* zoom buttons on the HUD */
document.getElementById("btn-zoom-in").addEventListener("click", function () {
  zoomCenter(ZOOM_STEP * 1.6);
});
document.getElementById("btn-zoom-out").addEventListener("click", function () {
  zoomCenter(-ZOOM_STEP * 1.6);
});
document.getElementById("btn-fit").addEventListener("click", fitView);

/* hide/show the HUD if there's a toggle button */
if ($hudToggle) {
  $hudToggle.addEventListener("click", function (e) {
    e.stopPropagation();
    $hud.classList.toggle("collapsed");
  });
}

/* keyboard shortcuts: F for fit, + / - for zoom */
document.addEventListener("keydown", function (e) {
  if (e.key === "f" || e.key === "F" || e.key === "0") {
    fitView();
    return;
  }
  if (e.key === "+" || e.key === "=") {
    zoomCenter(ZOOM_STEP * 1.5);
    return;
  }
  if (e.key === "-") {
    zoomCenter(-ZOOM_STEP * 1.5);
    return;
  }
});

/* reapply view when window resizes, but wait a bit so it doesn't fire a million times */
var resizeTimer;
window.addEventListener("resize", function () {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(applyView, 60);
});
