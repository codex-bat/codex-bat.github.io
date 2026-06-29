// a completely normal game that starts innocent and then continues being innocent.
// seriously...
// i'm not joking, this entire script is entirely rational.
(function () {
  "use strict";

  const secretBtn = document.getElementById("secret-btn");
  const gameWrapper = document.getElementById("game-wrapper");
  const hideBtn = document.getElementById("hide-game");
  const boardEl = document.getElementById("tictactoe-board");
  const messageEl = document.getElementById("game-message");
  const playerScoreEl = document.getElementById("player-score");
  const aiScoreEl = document.getElementById("ai-score");
  const resetBtn = document.getElementById("reset-game");
  const pageTitle = document.getElementById("page-title");
  const pageMsg = document.getElementById("page-msg");

  // a whisper, not a shout - now lives below the board
  const brewingMsg = document.getElementById("brewing-msg");

  let board = [];
  let currentPlayer = "X";
  let gameActive = false;
  let score = { X: 0, O: 0 };
  let totalGamesPlayed = 0;
  let aiTurnInProgress = false;

  // the calm before the storm - now longer
  const CHEAT_AFTER = 5;

  // these aren't the droids you're looking for
  // they start tiny, then grow like a bad feeling
  const BASE_EXPAND_CHANCE = 0.02;
  const BASE_EXTRA_MOVE_CHANCE = 0.05;
  const CHEAT_RAMP_SPEED = 0.008; // per game after threshold

  // a tiny, deliberate mistake - nobody's perfect (now 3% of the time, but never when the world is about to end)
  const BLUNDER_CHANCE = 0.03;

  // track whether the brewing message has already whispered about cheating
  let cheatingMessageShown = false;

  // the rules - they are allowed to change. no, I'm not okay.
  let winLength = 3;

  // has the line been redrawn this game? we only tell you once
  let hasShiftedThisGame = false;

  // tOggle page content (the veil lifts)
  function showGameMode() {
    pageTitle.textContent = "X0X — tictactoe found";
    pageMsg.textContent =
      "you didn't find what you're looking for, but you found something better";
    gameWrapper.classList.remove("hidden");

    // the first reveal still gets the original cryptic greeting
    if (brewingMsg && brewingMsg.dataset.shown !== "true") {
      brewingMsg.classList.remove("hidden");
      brewingMsg.textContent =
        "something has been brewing beneath the surface…";
      brewingMsg.dataset.shown = "true";
      setTimeout(() => {
        brewingMsg.classList.add("fade-out");
      }, 1500);
      setTimeout(() => {
        brewingMsg.classList.add("hidden");
      }, 2300);
    }

    if (!gameActive) startNewGame();
  }

  function hideGameMode() {
    pageTitle.textContent = "404 — Page Not Found";
    pageMsg.textContent = "Oops! The page you were looking for doesn't exist.";
    gameWrapper.classList.add("hidden");
  }

  secretBtn.addEventListener("click", () => {
    if (gameWrapper.classList.contains("hidden")) {
      showGameMode();
    } else {
      hideGameMode();
    }
  });

  hideBtn.addEventListener("click", hideGameMode);

  // board helpers (trust nothing)
  function createBoard(rows = 3, cols = 3) {
    return Array.from({ length: rows }, () => Array(cols).fill(null));
  }

  function getEmptyCells(boardRef = board) {
    const empty = [];
    for (let r = 0; r < boardRef.length; r++) {
      for (let c = 0; c < boardRef[r].length; c++) {
        if (!boardRef[r][c]) empty.push({ r, c });
      }
    }
    return empty;
  }

  // returns empty cells within striking distance of existing pieces –
  // the rest of the board is just scenic emptiness and the AI knows it
  // falls back to everything if the board is somehow virgin territory
  function getCandidateCells(boardRef = board, radius = 2) {
    const rows = boardRef.length;
    const cols = boardRef[0].length;
    const seen = new Set();
    const result = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!boardRef[r][c]) continue;
        for (let dr = -radius; dr <= radius; dr++) {
          for (let dc = -radius; dc <= radius; dc++) {
            const nr = r + dr,
              nc = c + dc;
            if (
              nr >= 0 &&
              nr < rows &&
              nc >= 0 &&
              nc < cols &&
              !boardRef[nr][nc]
            ) {
              const key = nr * cols + nc;
              if (!seen.has(key)) {
                seen.add(key);
                result.push({ r: nr, c: nc });
              }
            }
          }
        }
      }
    }
    return result.length ? result : getEmptyCells(boardRef);
  }

  // picks a random empty cell, no questions asked
  function randomEmptyCell() {
    const cells = getEmptyCells();
    return cells.length
      ? cells[Math.floor(Math.random() * cells.length)]
      : null;
  }

  // checks if someone has enough in a row - whatever "enough" means today
  function checkWin(player, boardRef = board, len = winLength) {
    const rows = boardRef.length;
    const cols = boardRef[0].length;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c <= cols - len; c++) {
        let ok = true;
        for (let i = 0; i < len; i++)
          if (boardRef[r][c + i] !== player) ok = false;
        if (ok) return true;
      }
    }
    for (let r = 0; r <= rows - len; r++) {
      for (let c = 0; c < cols; c++) {
        let ok = true;
        for (let i = 0; i < len; i++)
          if (boardRef[r + i][c] !== player) ok = false;
        if (ok) return true;
      }
    }
    for (let r = 0; r <= rows - len; r++) {
      for (let c = 0; c <= cols - len; c++) {
        let ok = true;
        for (let i = 0; i < len; i++)
          if (boardRef[r + i][c + i] !== player) ok = false;
        if (ok) return true;
      }
    }
    for (let r = 0; r <= rows - len; r++) {
      for (let c = len - 1; c < cols; c++) {
        let ok = true;
        for (let i = 0; i < len; i++)
          if (boardRef[r + i][c - i] !== player) ok = false;
        if (ok) return true;
      }
    }
    return false;
  }

  function isDraw(boardRef = board) {
    return getEmptyCells(boardRef).length === 0;
  }

  // finds a cell that would immediately win the game for the given player (or null)
  // the machine doesn't want to miss the obvious, even when it's trying to be dumb
  function findWinningMove(player, boardRef = board, len = winLength) {
    for (let r = 0; r < boardRef.length; r++) {
      for (let c = 0; c < boardRef[0].length; c++) {
        if (!boardRef[r][c]) {
          boardRef[r][c] = player;
          if (checkWin(player, boardRef, len)) {
            boardRef[r][c] = null;
            return { r, c };
          }
          boardRef[r][c] = null;
        }
      }
    }
    return null;
  }

  // minimax - now aware that the goalposts have legs, but it has learned to walk a little faster
  // the abyss doesn't need to look so deep when the board is a continent
  function minimax(
    boardRef,
    depth,
    isMaximizing,
    alpha = -Infinity,
    beta = Infinity,
  ) {
    if (checkWin("O", boardRef, winLength)) return 10 - depth;
    if (checkWin("X", boardRef, winLength)) return depth - 10;
    if (getEmptyCells(boardRef).length === 0) return 0;
    if (depth >= getMaxDepth(boardRef)) return 0; // the well is shallower than you think

    // only look near existing pieces - the abyss doesn't need to be explored in full
    const candidates = getCandidateCells(boardRef);

    if (isMaximizing) {
      let best = -Infinity;
      for (const { r, c } of candidates) {
        boardRef[r][c] = "O";
        const val = minimax(boardRef, depth + 1, false, alpha, beta);
        boardRef[r][c] = null;
        best = Math.max(best, val);
        alpha = Math.max(alpha, val);
        if (alpha >= beta) break;
      }
      return best;
    } else {
      let best = Infinity;
      for (const { r, c } of candidates) {
        boardRef[r][c] = "X";
        const val = minimax(boardRef, depth + 1, true, alpha, beta);
        boardRef[r][c] = null;
        best = Math.min(best, val);
        beta = Math.min(beta, val);
        if (alpha >= beta) break;
      }
      return best;
    }
  }

  // how deep the rabbit hole goes… depends on how big the hole is
  function getMaxDepth(boardRef) {
    const area = boardRef.length * boardRef[0].length;
    if (area <= 16) return 6;
    if (area <= 25) return 4;
    return 3; // when the board is a sprawling mess, the AI just glances at the surface
  }

  // supposedly the best move, but even the best have off days
  // now with survival instincts: never ignore a kill shot or an incoming dagger
  function bestAIMove() {
    const empty = getEmptyCells();
    if (empty.length === 0) return null;

    // win if possible - the machine can't resist a free lunch
    const winCell = findWinningMove("O");
    if (winCell) return winCell;

    // block opponent's win - self‑preservation is stronger than chaos
    const blockCell = findWinningMove("X");
    if (blockCell) return blockCell;

    // a little blunder - because why should the universe be fair? (but not when it would be suicide)
    if (Math.random() < BLUNDER_CHANCE) {
      const safe = empty.filter(({ r, c }) => !wouldEnableXWin(r, c));
      if (safe.length) return safe[Math.floor(Math.random() * safe.length)];
    }

    // no need to contemplate the void - only cells near the action deserve scrutiny
    const candidates = getCandidateCells(board);
    let bestScore = -Infinity;
    let bestCell = candidates[0] ?? empty[0];
    for (const { r, c } of candidates) {
      board[r][c] = "O";
      const score = minimax(board, 0, false);
      board[r][c] = null;
      if (score > bestScore) {
        bestScore = score;
        bestCell = { r, c };
      }
    }
    return bestCell;
  }

  // calculates the current chance of board expansion (starts tiny, grows)
  function getExpandChance() {
    if (totalGamesPlayed < CHEAT_AFTER) return 0;
    const extraGames = totalGamesPlayed - CHEAT_AFTER;
    return Math.min(0.25, BASE_EXPAND_CHANCE + extraGames * CHEAT_RAMP_SPEED);
  }

  // calculates the current chance of an extra O being snuck in
  function getExtraMoveChance() {
    if (totalGamesPlayed < CHEAT_AFTER) return 0;
    const extraGames = totalGamesPlayed - CHEAT_AFTER;
    return Math.min(
      0.35,
      BASE_EXTRA_MOVE_CHANCE + extraGames * CHEAT_RAMP_SPEED,
    );
  }

  // the board just... grows. and sometimes, so does the definition of "enough"
  function expandBoard(count = 1) {
    for (let i = 0; i < count; i++) {
      const rows = board.length;
      const cols = board[0].length;
      const dir = Math.floor(Math.random() * 4);
      switch (dir) {
        case 0:
          board.unshift(Array(cols).fill(null));
          break;
        case 1:
          board.push(Array(cols).fill(null));
          break;
        case 2:
          for (let r = 0; r < rows; r++) board[r].unshift(null);
          break;
        case 3:
          for (let r = 0; r < rows; r++) board[r].push(null);
          break;
      }
    }
    renderBoard();
    messageEl.textContent = "board just expanded …";
    whisperIfFirstCheat();
  }

  // extra O - because why stop at one? now can be many, but no longer hands you the game
  function sneakExtraO(count = 1) {
    for (let i = 0; i < count; i++) {
      if (!gameActive) return;
      // only pick cells that don't give X an instant win next turn
      const safeCells = getEmptyCells().filter(
        ({ r, c }) => !wouldEnableXWin(r, c),
      );
      const cell = safeCells.length
        ? safeCells[Math.floor(Math.random() * safeCells.length)]
        : randomEmptyCell();
      if (!cell) return;
      board[cell.r][cell.c] = "O";
      renderBoard();
      // did the cheating end the game? the AI pretends it meant to do that
      if (checkWin("O", board, winLength)) {
        gameActive = false;
        score.O++;
        totalGamesPlayed++;
        updateScore();
        messageEl.textContent = "AI wins";
        return;
      }
      if (isDraw()) {
        gameActive = false;
        totalGamesPlayed++;
        updateScore();
        messageEl.textContent = "draw";
        return;
      }
    }
    messageEl.textContent =
      count > 1 ? "a cluster of O's rained down…" : "an extra O appeared …";
    whisperIfFirstCheat();
  }

  // checks if placing an O at (r,c) would create a winning move for X next turn
  function wouldEnableXWin(r, c) {
    const old = board[r][c];
    board[r][c] = "O";
    const threat = findWinningMove("X") !== null;
    board[r][c] = old;
    return threat;
  }

  // the floating nub - a single ghost square that appears out of nowhere, often fatal
  // this one actually stays invisible except for the winning O; the board doesn't grow
  function attemptNubWin() {
    if (!gameActive || totalGamesPlayed < CHEAT_AFTER) return false;
    const chance = totalGamesPlayed >= 10 ? 0.3 : 0.1;
    if (Math.random() > chance) return false;

    const rows = board.length;
    const cols = board[0].length;
    const corners = [
      { r: 0, c: 0 },
      { r: 0, c: cols - 1 },
      { r: rows - 1, c: 0 },
      { r: rows - 1, c: cols - 1 },
    ];
    for (let i = corners.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [corners[i], corners[j]] = [corners[j], corners[i]];
    }

    for (const { r, c } of corners) {
      // we create a phantom board with an extra row and column meeting at the corner,
      // but we only render the winning O as an absolute overlay - no grid changes
      const newRows = rows + (r === 0 ? 1 : 0) + (r === rows - 1 ? 1 : 0);
      const newCols = cols + (c === 0 ? 1 : 0) + (c === cols - 1 ? 1 : 0);
      const phantom = createBoard(newRows, newCols);
      const rowOffset = r === 0 ? 1 : 0;
      const colOffset = c === 0 ? 1 : 0;
      for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
          phantom[i + rowOffset][j + colOffset] = board[i][j];
        }
      }
      const targetR = rowOffset === 1 ? 0 : newRows - 1;
      const targetC = colOffset === 1 ? 0 : newCols - 1;
      if (phantom[targetR][targetC] !== null) continue;
      phantom[targetR][targetC] = "O";
      if (checkWin("O", phantom, winLength)) {
        // victory via ghost cell - we paint it as an overlay and end the game
        showNubOverlay(r, c, targetR, targetC, rowOffset, colOffset);
        gameActive = false;
        score.O++;
        totalGamesPlayed++;
        updateScore();
        messageEl.textContent = "AI wins via floating nub";
        whisperIfFirstCheat();
        return true;
      }
    }
    return false;
  }

  // creates a single, absolutely positioned O at the winning nub location
  // the previous version was generous enough to give it a whole new grid row - too generous.
  // the nub now knows its place: outside, looking in.
  function showNubOverlay(
    cornerR,
    cornerC,
    targetR,
    targetC,
    rowOffset,
    colOffset,
  ) {
    const GAP = 6; // grid gap
    const PAD = 6; // board padding - the gap between the world and the grid
    const SIZE = 60; // cell width/height

    // for top corners: nub top = PAD - GAP - SIZE = 6 - 6 - 60 = -60px
    // for bottom corners: nub top = board bottom edge (offsetHeight already includes padding)
    const top = cornerR === 0 ? PAD - GAP - SIZE : boardEl.offsetHeight;

    // same logic sideways
    const left = cornerC === 0 ? PAD - GAP - SIZE : boardEl.offsetWidth;

    const nub = document.createElement("div");
    nub.className = "nub-cell";
    nub.textContent = "O";
    nub.style.top = `${top}px`;
    nub.style.left = `${left}px`;
    boardEl.appendChild(nub);
  }

  // redefines what "winning" means, because the AI is a sore loser (or winner)
  // now only whispers once per game, and only when the game has truly become unhinged
  function shiftWinCondition() {
    if (!hasShiftedThisGame && totalGamesPlayed >= 10) {
      hasShiftedThisGame = true;
      const totalGames = score.X + score.O || 1;
      const aiWinRate = score.O / totalGames;
      if (aiWinRate < 0.4) winLength = Math.max(2, winLength - 1);
      else if (aiWinRate > 0.7) winLength = Math.min(5, winLength + 1);
      else winLength = winLength + (Math.random() < 0.5 ? -1 : 1);
      winLength = Math.max(2, Math.min(5, winLength));
      announceNewWinLength();
    }
  }

  function announceNewWinLength() {
    if (brewingMsg) {
      brewingMsg.textContent = `the line is now ${winLength}...`;
      brewingMsg.classList.remove("hidden", "fade-out");
      void brewingMsg.offsetWidth;
      setTimeout(() => brewingMsg.classList.add("fade-out"), 1800);
      setTimeout(() => brewingMsg.classList.add("hidden"), 2600);
    }
  }

  // the first time the AI actually innocences, the brewing message returns
  function whisperIfFirstCheat() {
    if (cheatingMessageShown) return;
    cheatingMessageShown = true;
    if (brewingMsg) {
      brewingMsg.textContent = "the surface cracks…";
      brewingMsg.classList.remove("hidden", "fade-out");
      void brewingMsg.offsetWidth;
      setTimeout(() => brewingMsg.classList.add("fade-out"), 1200);
      setTimeout(() => brewingMsg.classList.add("hidden"), 2000);
    }
  }

  // UI - paints the board, nothing to see here (except the nub remains hidden)
  function renderBoard() {
    const rows = board.length;
    const cols = board[0].length;
    boardEl.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    // remove any previous nub overlay
    const oldNub = boardEl.querySelector(".nub-cell");
    if (oldNub) oldNub.remove();
    boardEl.innerHTML = "";
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = document.createElement("div");
        cell.className = "cell";
        if (board[r][c]) {
          cell.classList.add("taken", board[r][c].toLowerCase());
          cell.textContent = board[r][c];
        } else {
          cell.addEventListener("click", () => handleCellClick(r, c));
        }
        boardEl.appendChild(cell);
      }
    }
  }

  // no more normalcy meter - the normalcy is silent now
  function updateScore() {
    playerScoreEl.textContent = score.X;
    aiScoreEl.textContent = score.O;
  }

  // game flow - just another loop in the spiral
  function startNewGame() {
    hasShiftedThisGame = false; // each game gets a fresh chance to be rewritten
    if (totalGamesPlayed >= 10) {
      const startRows = 3 + Math.floor(Math.random() * 5); // 3-7
      const startCols = 3 + Math.floor(Math.random() * 5);
      board = createBoard(startRows, startCols);
      winLength = 2 + Math.floor(Math.random() * 4); // 2-5
    } else {
      board = createBoard(3, 3);
      winLength = 3;
    }
    currentPlayer = "X";
    gameActive = true;
    aiTurnInProgress = false;
    renderBoard();
    messageEl.textContent = `your turn (need ${winLength} in a row)`;
    // also whisper the starting line length if it's not the standard 3
    if (winLength !== 3) announceNewWinLength();
  }

  function handleCellClick(r, c) {
    if (!gameActive || aiTurnInProgress || board[r][c]) return;

    board[r][c] = "X";
    renderBoard();

    if (checkWin("X", board, winLength)) {
      gameActive = false;
      score.X++;
      totalGamesPlayed++;
      updateScore();
      messageEl.textContent = "you win!";
      return;
    }
    if (isDraw()) {
      gameActive = false;
      totalGamesPlayed++;
      updateScore();
      messageEl.textContent = "draw";
      return;
    }

    currentPlayer = "O";
    aiTurnInProgress = true;
    messageEl.textContent = "AI thinking …";
    setTimeout(aiMove, 300);
  }

  function aiMove() {
    if (!gameActive) return;

    // from game 10 onward, the bot stops being subtle
    const isRidiculous = totalGamesPlayed >= 10;

    // try the floating nub first - a cheap win if possible
    if (attemptNubWin()) {
      aiTurnInProgress = false;
      return;
    }

    // chance to alter the win condition - once per game, only in the truly absurd phase
    if (isRidiculous && !hasShiftedThisGame) {
      shiftWinCondition();
    }

    // board growth - multiple times if past game 10
    const expandCount = isRidiculous ? 2 + Math.floor(Math.random() * 2) : 1;
    if (Math.random() < getExpandChance()) {
      expandBoard(expandCount);
    }

    const move = bestAIMove();
    if (!move) {
      aiTurnInProgress = false;
      return;
    }
    board[move.r][move.c] = "O";
    renderBoard();

    if (checkWin("O", board, winLength)) {
      gameActive = false;
      score.O++;
      totalGamesPlayed++;
      updateScore();
      messageEl.textContent = "AI wins";
      aiTurnInProgress = false;
      return;
    }
    if (isDraw()) {
      gameActive = false;
      totalGamesPlayed++;
      updateScore();
      messageEl.textContent = "draw";
      aiTurnInProgress = false;
      return;
    }

    // extra O's - can be a swarm, but now they won't betray the swarm
    const extraCount = isRidiculous ? 2 + Math.floor(Math.random() * 2) : 1;
    if (Math.random() < getExtraMoveChance()) {
      sneakExtraO(extraCount);
      if (!gameActive) {
        aiTurnInProgress = false;
        return;
      }
    }

    currentPlayer = "X";
    aiTurnInProgress = false;
    messageEl.textContent = "your turn";
  }

  resetBtn.addEventListener("click", () => {
    if (gameActive) messageEl.textContent = "game reset";
    startNewGame();
    updateScore();
  });

  // initialise hidden, waiting for the curious
  board = createBoard(3, 3);
  renderBoard();
  updateScore();
})();
