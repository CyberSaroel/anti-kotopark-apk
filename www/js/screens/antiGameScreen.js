import { AntiGame } from "../core/antiGame.js";
import { renderAntiBoard } from "../core/antiRenderer.js";
import { TYPES, getTypeDisplayName } from "../socionics/types.js";
import { LevelTimer, formatTime } from "../core/levelTimer.js";
import { stopBoardLayoutListener, refitBoard } from "../core/boardLayout.js";
import { mountFloatingAudioControls } from "../ui/floatingAudioControls.js";
import { audioManager } from "../core/audioManager.js";
import NavigationService from "../core/navigation.js";
import { addTotalMoves, addTotalTime } from "../core/gameStats.js";

function isCompactUI() {
  return window.matchMedia("(max-width: 768px)").matches;
}

export async function showAntiGameScreen(root) {
  // Create test level: 6x6 board with 10 cats
  const level = {
    id: "anti-test",
    rows: 6,
    cols: 6,
    cats: [
      { r: 0, c: 0, type: "Дон Кихот" },    // Known type
      { r: 0, c: 2, type: "Гюго" },
      { r: 0, c: 4, type: "Максим" },
      { r: 1, c: 1, type: "Жуков" },
      { r: 1, c: 3, type: "Есенин" },
      { r: 2, c: 0, type: "Наполеон" },
      { r: 2, c: 2, type: "Бальзак" },
      { r: 2, c: 4, type: "Драйзер" },
      { r: 3, c: 1, type: "Штирлиц" },
      { r: 3, c: 3, type: "Гексли" }
    ],
    water: []
  };

  const game = new AntiGame(level);
  
  root.innerHTML = "";
  root.className = "game-screen anti-game-screen";

  const hud = document.createElement("div");
  hud.className = "game-hud";
  const audioControls = mountFloatingAudioControls(document.body);

  const timer = new LevelTimer();
  let elapsedMs = 0;
  let timerStarted = false;
  let resizeListener = null;

  // Resource tracking & cleanup
  let levelActive = true;
  const trackedTimeouts = [];
  let cleanedUp = false;

  function trackedSetTimeout(fn, delay) {
    const id = setTimeout(() => {
      const idx = trackedTimeouts.indexOf(id);
      if (idx !== -1) trackedTimeouts.splice(idx, 1);
      if (levelActive) fn();
    }, delay);
    trackedTimeouts.push(id);
    return id;
  }

  function cleanupLevel() {
    if (cleanedUp) return;
    cleanedUp = true;
    addTotalTime(elapsedMs);
    levelActive = false;
    timer.destroy();
    stopBoardLayoutListener();
    audioManager.stopWarningBeeps();
    trackedTimeouts.forEach(id => clearTimeout(id));
    trackedTimeouts.length = 0;
    if (resizeListener) {
      window.removeEventListener("resize", resizeListener);
      resizeListener = null;
    }
  }

  NavigationService.setOnLeave(cleanupLevel);

  function startTimer() {
    if (timerStarted) return;
    timerStarted = true;
    timer.start((ms) => {
      if (!levelActive) return;
      elapsedMs = ms;
      updateStats();
    });
  }

  function leaveLevel(navigate) {
    cleanupLevel();
    navigate();
  }

  // Top bar
  const bar = document.createElement("div");
  bar.className = "topbar";

  const topRow = document.createElement("div");
  topRow.className = "topbar-row";

  const title = document.createElement("span");
  title.className = "topbar-title";
  title.textContent = "Анти Котопарк";

  const leaveBtn = document.createElement("button");
  leaveBtn.className = "topbar-leave";
  leaveBtn.textContent = isCompactUI() ? "Меню" : "Покинуть";
  leaveBtn.addEventListener("click", () => {
    audioManager.initAudioContext();
    audioManager.playSoundEffect("assets/sounds/click.mp3");
    leaveLevel(() => NavigationService.backTo("intro"));
  });

  topRow.appendChild(title);
  topRow.appendChild(leaveBtn);
  bar.appendChild(topRow);
  root.appendChild(bar);

  // Main game area with left sidebar for type selection
  const stage = document.createElement("div");
  stage.className = "game-stage anti-game-stage";

  // Left sidebar for sociotype selection
  const sidebar = document.createElement("div");
  sidebar.className = "anti-sidebar";
  
  const sidebarTitle = document.createElement("div");
  sidebarTitle.className = "anti-sidebar-title";
  sidebarTitle.textContent = "Выберите социотип";
  sidebar.appendChild(sidebarTitle);

  const selectedCatInfo = document.createElement("div");
  selectedCatInfo.className = "anti-selected-cat-info";
  selectedCatInfo.textContent = "Кликните на кота с ?";
  sidebar.appendChild(selectedCatInfo);

  const typeButtonsContainer = document.createElement("div");
  typeButtonsContainer.className = "anti-type-buttons";
  sidebar.appendChild(typeButtonsContainer);

  // Create type buttons
  let selectedCatIndex = null;
  
  function createTypeButtons() {
    typeButtonsContainer.innerHTML = "";
    TYPES.forEach(type => {
      const btn = document.createElement("button");
      btn.className = "anti-type-btn";
      btn.textContent = getTypeDisplayName(type);
      btn.addEventListener("click", () => {
        if (selectedCatIndex !== null) {
          audioManager.initAudioContext();
          
          const result = game.makeGuess(selectedCatIndex, type);
          if (result.correct) {
            // Correct guess — весёлый звук правильного угадывания
            audioManager.playCorrectGuess();
            selectedCatInfo.textContent = `Кот #${selectedCatIndex + 1}: ${getTypeDisplayName(type)} ✓`;
            selectedCatInfo.style.color = "#4caf50";
            renderBoard();
            checkWin();
          } else {
            // Wrong guess — низкий противный звук
            audioManager.playLoseSound();
            selectedCatInfo.textContent = `Неверно! Это ${getTypeDisplayName(result.actualType)}`;
            selectedCatInfo.style.color = "#f44336";
          }
          
          selectedCatIndex = null;
          createTypeButtons();
        }
      });
      typeButtonsContainer.appendChild(btn);
    });
  }
  
  createTypeButtons();

  // Board area
  const boardArea = document.createElement("div");
  boardArea.className = "board-area";
  const boardWrap = document.createElement("div");
  boardWrap.className = "board-scroll-wrap";
  const boardEl = document.createElement("div");
  boardEl.id = "board";
  boardWrap.appendChild(boardEl);
  boardArea.appendChild(boardWrap);

  // Stats
  const stats = document.createElement("div");
  stats.id = "stats";
  stats.className = "stats";
  stats.style.position = "absolute";

  stage.appendChild(sidebar);
  stage.appendChild(boardArea);
  stage.appendChild(stats);
  root.appendChild(stage);

  function renderBoard() {
    renderAntiBoard(boardEl, game, (r, c) => {
      // Handle cell click for movement
      audioManager.initAudioContext();
      const result = game.clickCell(r, c);
      if (result.needRedraw) {
        if (result.moved) {
          audioManager.playSoundEffect("assets/sounds/move.mp3");
        }
        renderBoard();
      }
    }, (catIndex, r, c) => {
      // Handle cat click for type selection
      audioManager.initAudioContext();
      audioManager.playSoundEffect("assets/sounds/click.mp3");
      selectedCatIndex = catIndex;
      selectedCatInfo.textContent = `Кот #${catIndex + 1}: выберите тип`;
      selectedCatInfo.style.color = "#fff";
      
      // Highlight selected cat
      document.querySelectorAll(".cell").forEach(cell => cell.classList.remove("type-selected"));
      const cells = boardEl.querySelectorAll(".cell");
      const cellIndex = r * game.board.cols + c;
      if (cells[cellIndex]) {
        cells[cellIndex].classList.add("type-selected");
      }
    });
  }

  function updateStats() {
    stats.innerHTML = `
      <div class="stat-box">
        <div class="stat-label">Ходы</div>
        <div class="stat-value">${game.getMoveCount()}</div>
      </div>
      <div class="stat-box">
        <div class="stat-label">Время</div>
        <div class="stat-value">${formatTime(elapsedMs)}</div>
      </div>
      <div class="stat-box">
        <div class="stat-label">Зелёные</div>
        <div class="stat-value">${countHappy()}/${game.board.allCats().length}</div>
      </div>
    `;
  }

  function countHappy() {
    return game.board.allCats().filter(({ r, c }) => game.moodAt(r, c) >= 1).length;
  }

  function checkWin() {
    if (game.isWin()) {
      audioManager.playSoundEffect("assets/sounds/victory/1.mp3");
      const winOverlay = document.createElement("div");
      winOverlay.className = "win-overlay";
      winOverlay.innerHTML = `
        <div class="win-content">
          <h2>Победа!</h2>
          <p>Все коты довольны!</p>
          <p>Ходов: ${game.getMoveCount()}</p>
          <p>Время: ${formatTime(elapsedMs)}</p>
          <button class="win-restart-btn">Играть снова</button>
          <button class="win-menu-btn">В меню</button>
        </div>
      `;
      root.appendChild(winOverlay);
      
      winOverlay.querySelector(".win-restart-btn").addEventListener("click", () => {
        audioManager.initAudioContext();
        audioManager.playSoundEffect("assets/sounds/click.mp3");
        winOverlay.remove();
        showAntiGameScreen(root);
      });
      
      winOverlay.querySelector(".win-menu-btn").addEventListener("click", () => {
        audioManager.initAudioContext();
        audioManager.playSoundEffect("assets/sounds/click.mp3");
        leaveLevel(() => NavigationService.backTo("intro"));
      });
    }
  }

  function positionStats() {
    try {
      const compact = isCompactUI();
      if (compact) {
        stats.style.position = "";
        stats.style.left = "";
        stats.style.top = "";
        stats.style.right = "";
        stats.style.transform = "";
      } else {
        stats.style.position = "absolute";
        const stageRect = stage.getBoundingClientRect();
        const boardRect = boardWrap.getBoundingClientRect();
        const boardElRect = boardEl.getBoundingClientRect();
        stats.style.left = (boardRect.right - stageRect.left + 16) + "px";
        // Верхний край счётчиков точно совпадает с верхним краем игрового поля.
        const top = Math.round(boardElRect.top - stageRect.top);
        stats.style.top = top + "px";
      }
    } catch (e) {
      // Ignore positioning errors
    }
  }

  resizeListener = () => {
    refitBoard(boardEl);
    positionStats();
  };
  window.addEventListener("resize", resizeListener);

  // Initial render
  renderBoard();
  updateStats();
  trackedSetTimeout(() => positionStats(), 50);

  // Start timer on first interaction
  let firstInteraction = false;
  const startOnInteraction = () => {
    if (!firstInteraction) {
      firstInteraction = true;
      startTimer();
    }
  };
  
  boardEl.addEventListener("click", startOnInteraction, { once: true });
  boardEl.addEventListener("touchstart", startOnInteraction, { once: true });
}
