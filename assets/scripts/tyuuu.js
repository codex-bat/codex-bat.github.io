(function() {
    const scoreEl = document.getElementById('player-score');
    if (!scoreEl) return;

    let lastKnownScore = null;

    // cheeky messages
    const TOASTS = {
      over100: [
        "Sure, 100+ wins… totally legit (bombastic side-eye)",
        "you think I can't tell you're messing with html?",
        "nice try, 'hacker'. your score is sus.",
        "did you really earn that? I'm watching you. 👀"
      ],
      magicNumber: [
        "3232321? That's oddly specific. Easter egg much? 🥚",
        "Busted. 3232321 isn't a coincidence.",
        "you found the magic number. Still cheating though."
      ]
    };

    function pickRandom(arr) {
      return arr[Math.floor(Math.random() * arr.length)];
    }

    function showToast(message) {
      // remove any existing toast
      const old = document.querySelector('.cheat-toast');
      if (old) old.remove();

      const toast = document.createElement('div');
      toast.className = 'cheat-toast';
      toast.textContent = message;
      document.body.appendChild(toast);

      // trigger show
      requestAnimationFrame(() => toast.classList.add('show'));

      // auto-dismiss after 4 seconds
      setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
      }, 4000);
    }

    function checkScore(newValue) {
      const num = parseInt(newValue, 10);
      if (isNaN(num)) return;

      if (num === 3232321) {
        showToast(pickRandom(TOASTS.magicNumber));
      } else if (num > 100 && lastKnownScore !== null && lastKnownScore <= 100) {
        // only trigger when crossing the threshold, not on every change above 100
        showToast(pickRandom(TOASTS.over100));
      }
      lastKnownScore = num;
    }

    // initial check
    checkScore(scoreEl.textContent);

    // watch for future changes (score text updates via JS)
    const observer = new MutationObserver(() => {
      const currentText = scoreEl.textContent;
      if (currentText !== String(lastKnownScore)) {
        checkScore(currentText);
      }
    });

    observer.observe(scoreEl, { characterData: true, subtree: true, childList: true });
  })();