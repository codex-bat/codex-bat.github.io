(function () {
  const PHRASE_LIST = [
    "👁️ watching...",
    "psst... click something",
    "still here?",
    "the void whispers",
    "shh, it's listening",
    "welcome, wanderer",
    "need a secret?",
    "don't blink...",
    "so dark in here",
    "👁️‍🗨️ follow me",
    "👁️ follow me",
    "follow me",
    "time is thin here",
    "what do you seek?",
    "⚡ eerie hum",
    "eerie hum",
    "are you real?",
    "beware the silence",
  ];

  const FAR_AWAY_PHRASES = [
    "stop messing with me",
    "oh, you're back...",
    "where did you go?",
    "lost in the void?",
    "don't sneak up on me",
    "i felt your absence",
    "👁️‍🗨️ you returned",
    "👁️ you returned",
    "you returned",
    "careful with that cursor",
    "the eye sees all",
    "did you get lost?",
  ];

  const CLICK_PHRASES = [
    "don't poke me!",
    "ouch! that tickles",
    "respect the eye",
    "rude!",
    "👁️ i'm watching you",
    "i'm watching you.",
    "stop that",
    "gentle, please",
    "you dare?",
    "that's sensitive",
    "no touching!",
  ];

  const BLINK_INTERVAL_SEC = 5;
  const SPEAK_INTERVAL_SEC = 12;
  const SPEECH_DURATION_MS = 4000;
  const INTERACTION_PAUSE_MS = 2800;

  const eye = document.getElementById("magicEye");
  const pupil = document.getElementById("eyePupil");
  const speechBubble = document.getElementById("eyeSpeech");

  if (!eye || !pupil || !speechBubble) return;

  let eyeRect = {
    left: 0,
    top: 0,
    width: 0,
    height: 0,
    centerX: 0,
    centerY: 0,
  };
  let aRadius = 0;
  let bRadius = 0;
  let pupilRadius = 0;
  let lastMouseX = null;
  let lastMouseY = null;

  let speechTimeout = null;
  let blinkTimer = null;
  let speakTimer = null;

  let pointerOutside = false;
  let idleSuppressedUntil = 0;

  function randomFrom(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function suppressIdle(ms = INTERACTION_PAUSE_MS) {
    idleSuppressedUntil = Math.max(idleSuppressedUntil, Date.now() + ms);
  }

  function canIdleSpeak() {
    return Date.now() >= idleSuppressedUntil;
  }

  function updateMetrics() {
    const rect = eye.getBoundingClientRect();
    eyeRect = {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      centerX: rect.left + rect.width / 2,
      centerY: rect.top + rect.height / 2,
    };

    const pupilRect = pupil.getBoundingClientRect();
    pupilRadius = pupilRect.width / 2;
    aRadius = Math.max(0, eyeRect.width / 2 - pupilRadius);
    bRadius = Math.max(0, eyeRect.height / 2 - pupilRadius);
  }

  function resetPupilCenter() {
    pupil.style.transform = "translate(-50%, -50%)";
  }

  function movePupil(mouseX, mouseY) {
    if (aRadius <= 0 || bRadius <= 0) return;

    let dx = mouseX - eyeRect.centerX;
    let dy = mouseY - eyeRect.centerY;

    const normX = dx / aRadius;
    const normY = dy / bRadius;
    const distSq = normX * normX + normY * normY;

    if (distSq > 1 && distSq > 0.01) {
      const scale = 1 / Math.sqrt(distSq);
      dx *= scale;
      dy *= scale;
    }

    pupil.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  }

  function onPointerMove(clientX, clientY) {
    lastMouseX = clientX;
    lastMouseY = clientY;
    movePupil(clientX, clientY);
  }

  function onMouseMove(e) {
    onPointerMove(e.clientX, e.clientY);
  }

  function onTouchMove(e) {
    if (e.touches.length) {
      onPointerMove(e.touches[0].clientX, e.touches[0].clientY);
    }
  }

  function onTouchEnd() {
    resetPupilCenter();
    lastMouseX = null;
    lastMouseY = null;
  }

  function onDocumentMouseOut(e) {
    if (!e.relatedTarget && !e.toElement) {
      pointerOutside = true;
      window._mouseOutside = true;
      resetPupilCenter();
      suppressIdle(1200);
    }
  }

  function onDocumentMouseOver(e) {
    if (pointerOutside && !e.relatedTarget) {
      pointerOutside = false;
      window._mouseOutside = false;
      suppressIdle(2500);
      showSpeech(randomFrom(FAR_AWAY_PHRASES));
    }
  }

  function onWindowBlur() {
    pointerOutside = true;
    window._mouseOutside = true;
    resetPupilCenter();
    suppressIdle(1200);
  }

  function showSpeech(text) {
    speechBubble.textContent = text;
    speechBubble.classList.add("show");

    if (speechTimeout) clearTimeout(speechTimeout);
    speechTimeout = setTimeout(() => {
      speechBubble.classList.remove("show");
      speechTimeout = null;
    }, SPEECH_DURATION_MS);
  }

  function speakRandom() {
    showSpeech(randomFrom(PHRASE_LIST));
  }

  function blink() {
    eye.classList.add("blink");
    setTimeout(() => {
      eye.classList.remove("blink");
    }, 180);
  }

  function scheduleBlink() {
    if (blinkTimer) clearTimeout(blinkTimer);
    const delay = (BLINK_INTERVAL_SEC + (Math.random() * 3 - 1)) * 1000;
    blinkTimer = setTimeout(
      () => {
        blink();
        scheduleBlink();
      },
      Math.max(2000, delay),
    );
  }

  function scheduleSpeak() {
    if (speakTimer) clearTimeout(speakTimer);
    const delay = (SPEAK_INTERVAL_SEC + Math.random() * 10) * 1000;

    speakTimer = setTimeout(
      () => {
        if (canIdleSpeak()) {
          speakRandom();
        }
        scheduleSpeak();
      },
      Math.max(5000, delay),
    );
  }

  function onEyeClick(e) {
    e.stopPropagation();
    suppressIdle(3500);
    showSpeech(randomFrom(CLICK_PHRASES));

    eye.classList.add("poke");
    setTimeout(() => {
      eye.classList.remove("poke");
    }, 120);
  }

  function onEyePointerEnter() {
    suppressIdle(1000);
  }

  function handleResize() {
    updateMetrics();
    resetPupilCenter();

    if (
      lastMouseX !== null &&
      lastMouseY !== null &&
      lastMouseX >= 0 &&
      lastMouseX <= window.innerWidth &&
      lastMouseY >= 0 &&
      lastMouseY <= window.innerHeight
    ) {
      movePupil(lastMouseX, lastMouseY);
    } else {
      lastMouseX = null;
      lastMouseY = null;
    }
  }

  function updateFooterProximity() {
    const scrollBottom = window.scrollY + window.innerHeight;
    const pageBottom = document.body.scrollHeight;
    const threshold = 120;

    if (scrollBottom >= pageBottom - threshold) {
      eye.classList.add("near-footer");
    } else {
      eye.classList.remove("near-footer");
    }
  }

  function init() {
    updateMetrics();
    resetPupilCenter();

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd);
    window.addEventListener("touchcancel", onTouchEnd);

    document.addEventListener("mouseout", onDocumentMouseOut);
    document.addEventListener("mouseover", onDocumentMouseOver);
    window.addEventListener("blur", onWindowBlur);

    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);
    window.addEventListener(
      "scroll",
      () => {
        updateMetrics();
        if (lastMouseX !== null && lastMouseY !== null) {
          movePupil(lastMouseX, lastMouseY);
        }
      },
      { passive: true }
    );

    window.addEventListener("scroll", updateFooterProximity, { passive: true });
    updateFooterProximity();

    eye.addEventListener("click", onEyeClick);
    eye.addEventListener("pointerenter", onEyePointerEnter);

    window._mouseOutside = false;
    scheduleBlink();
    scheduleSpeak();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();