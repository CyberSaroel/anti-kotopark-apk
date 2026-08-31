import { Game } from "../core/game.js";
import { renderBoard } from "../core/renderer.js";
import { fetchLevel } from "../levels/levelLoader.js";
import { getLevel } from "../levels/levelRegistry.js";
import { startAntiLevel } from "../game.js";
import { markCompleted } from "../levels/levelProgress.js";
import { saveLevelRecord, saveLevelTimeRecord, saveLevelKingsRecord, getBestKings } from "../levels/levelRecords.js";
import { LevelTimer, LevelCountdown, formatTime, LEVEL_REMAINING_MOVES_INITIAL } from "../core/levelTimer.js";
import { showWinScreen } from "./winScreen.js";
import { showImpeachmentScreen } from "./impeachmentScreen.js";
import { calcMood, isKing } from "../socionics/mood.js";
import {
  onKingCreated,
  onKingLost,
  commitLevel,
  resetLevel,
  getKingsThisLevel,
  getKingsTotal,
  getRockets,
  spendRocket,
} from "../core/royalEconomy.js";
import { stopBoardLayoutListener, refitBoard } from "../core/boardLayout.js";
import { mountFloatingAudioControls } from "../ui/floatingAudioControls.js";
import { audioManager } from "../core/audioManager.js";
import NavigationService from "../core/navigation.js";
import { addTotalMoves, addTotalTime } from "../core/gameStats.js";
import { showStatBoost, findStatItem } from "../ui/statBoost.js";

function isCompactUI() {
  return window.matchMedia("(max-width: 768px)").matches;
}

/**
 * Запустить уровень с учётом режима:
 * mode: "anti" (10–51) → startAntiLevel, иначе классика.
 */
export function launchLevel(root, levelId) {
  if (getLevel(levelId)?.mode === "anti") {
    return startAntiLevel(root, levelId);
  }
  return showGameScreen(root, levelId);
}

export async function showGameScreen(root, levelId) {
  let level;
  try {
    level = await fetchLevel(levelId);
  } catch (e) {
    alert(e.message);
    return;
  }

  const game = new Game(level);
  resetLevel();
  
  // Инициализируем previousKings текущими королями доски ДО первой отрисовки
  function getCurrentKings() {
    const kings = new Set();
    const cats = game.board.allCats();
    for (const cat of cats) {
      const mood = calcMood(game.board, cat.r, cat.c);
      if (isKing(mood)) {
        kings.add(`${cat.r},${cat.c}`);
      }
    }
    return kings;
  }
  let previousKings = getCurrentKings();
  // Стартовые короли зачисляются игроку сразу при входе на уровень
  for (const _ of previousKings) onKingCreated();
  
  root.innerHTML = "";
  root.className = "game-screen";

  const hud = document.createElement("div");
  hud.className = "game-hud";
  const audioControls = mountFloatingAudioControls(document.body);

  const timer = new LevelTimer();
  const countdown = new LevelCountdown();
  let elapsedMs = 0;
  let remainingMs = countdown.remainingMs;
  let timerStarted = false;
  let resizeListener = null;
  let lastSecondBeeped = Infinity; // Для отслеживания однократных пиков
  let beeped30 = false;
  let beeped20 = false;

  // --- Resource tracking & cleanup ---
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
    addTotalTime(elapsedMs); // копим общее время игры
    levelActive = false;
    timer.destroy();
    countdown.destroy();
    stopBoardLayoutListener();
    // audioControls.destroy(); // Не удаляем кнопки при переходе между уровнями
    audioManager.stopWarningBeeps();
    trackedTimeouts.forEach(id => clearTimeout(id));
    trackedTimeouts.length = 0;
    if (resizeListener) {
      window.removeEventListener("resize", resizeListener);
      resizeListener = null;
    }
  }

  // Register cleanup so NavigationService calls it on ANY screen exit
  // (back button, goBack, backTo, goHome, navigate)
  NavigationService.setOnLeave(cleanupLevel);

  function startTimer() {
    if (timerStarted) return;
    timerStarted = true;
    timer.start((ms) => {
      if (!levelActive) return;
      elapsedMs = ms;
      updateStats(); // Обновляем интерфейс при каждом тике таймера
    });
    countdown.start(
      (ms) => {
        if (!levelActive) return;
        remainingMs = ms;
        updateStats();
      },
      () => {
        if (!levelActive) return;
        remainingMs = 0;
        checkDefeat();
      }
    );
  }

  function leaveLevel(navigate) {
    cleanupLevel();
    navigate();
  }

  const bar = document.createElement("div");
  bar.className = "topbar";

  // Top row: nav elements
  const topRow = document.createElement("div");
  topRow.className = "topbar-row";

  const title = document.createElement("span");
  title.className = "topbar-title";
  title.textContent = "Уровень " + level.id; // Always "Уровень N"

  const buttonsWrapper = document.createElement("div");
  buttonsWrapper.className = "topbar-buttons";

  const navButtons = document.createElement("div");
  navButtons.className = "topbar-nav-buttons";

  const prevBtn = document.createElement("button");
  prevBtn.className = "topbar-prev";
  prevBtn.textContent = isCompactUI() ? "←" : "← Предыдущий";
  prevBtn.disabled = levelId <= 1;
  prevBtn.addEventListener("click", () => {
    audioManager.initAudioContext();
    audioManager.playSoundEffect("assets/sounds/click.mp3");
    leaveLevel(() => NavigationService.navigate("game", () => launchLevel(root, levelId - 1), { replace: true }));
  });

  const nextBtn = document.createElement("button");
  nextBtn.className = "topbar-next";
  nextBtn.textContent = isCompactUI() ? "→" : "Следующий →";
  nextBtn.disabled = levelId >= 100;
  nextBtn.addEventListener("click", () => {
    audioManager.initAudioContext();
    audioManager.playSoundEffect("assets/sounds/click.mp3");
    leaveLevel(() => NavigationService.navigate("game", () => launchLevel(root, levelId + 1), { replace: true }));
  });

  const leave = document.createElement("button");
  leave.className = "topbar-leave";
  leave.textContent = isCompactUI() ? "Меню" : "Покинуть уровень";
  leave.addEventListener("click", () => {
    audioManager.initAudioContext();
    audioManager.playSoundEffect("assets/sounds/click.mp3");
    leaveLevel(() => NavigationService.backTo("levelSelect"));
  });

  if (isCompactUI()) {
    // Mobile/tablet layout - original order
    navButtons.appendChild(prevBtn);
    navButtons.appendChild(nextBtn);
    buttonsWrapper.appendChild(navButtons);
    buttonsWrapper.appendChild(leave);

    topRow.appendChild(title);
    topRow.appendChild(buttonsWrapper);
  } else {
    // Desktop layout - prev, title, next, leave in one row
    topRow.appendChild(prevBtn);
    topRow.appendChild(title);
    topRow.appendChild(nextBtn);
    topRow.appendChild(leave);
  }

  bar.appendChild(topRow);

  // Add subtitle if needed
  const defaultLevelName = "Уровень " + level.id;
  if (level.name && level.name !== defaultLevelName) {
    const subtitle = document.createElement("div");
    subtitle.className = "topbar-subtitle";
    subtitle.textContent = level.name;
    bar.appendChild(subtitle);
  }

  root.appendChild(bar);

  const stage = document.createElement("div");
  stage.className = "game-stage";
  stage.style.position = "relative";

  const boardArea = document.createElement("div");
  boardArea.className = "board-area";
  const boardWrap = document.createElement("div");
  boardWrap.className = "board-scroll-wrap";
  const boardEl = document.createElement("div");
  boardEl.id = "board";
  boardWrap.appendChild(boardEl);
  boardArea.appendChild(boardWrap);

  const stats = document.createElement("div");
  stats.id = "stats";
  stats.className = "stats";
  stats.style.position = "absolute";

  stage.appendChild(boardArea);
  stage.appendChild(stats);
  root.appendChild(stage);

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
        const boardWrapRect = boardWrap.getBoundingClientRect();
        // Ориентируемся на саму сетку поля (#board учитывает margin 12px у поля).
        const boardRect = boardEl.getBoundingClientRect();
        const left = Math.round(boardWrapRect.right - stageRect.left + 12);
        // Верхний край блока счётчиков точно совпадает с верхним краем игрового поля.
        const top = Math.round(boardRect.top - stageRect.top);
        stats.style.left = left + "px";
        stats.style.top = top + "px";
        stats.style.transform = "";
        stats.style.right = "";
      }
    } catch (e) {
      // ignore
    }
  }

  resizeListener = () => {
    refitBoard();
    positionStats();
  };
  window.addEventListener("resize", resizeListener);

  const msg = document.createElement("div");
  msg.id = "message";
  hud.appendChild(msg);
  root.appendChild(hud);

  let won = false;
  let impeached = false;
  let remainingMoves = LEVEL_REMAINING_MOVES_INITIAL;
  let maxHappyCats = 0;
  let maxHappyInitialized = false;
  let previousMoods = {};       // настроение котов на прошлой отрисовке (ключ — номер клетки)
  let previousCatCells = null;  // какие клетки были заняты котами на прошлой отрисовке

  function handleImpeachment() {
    if (won || impeached) return;
    impeached = true;
    resetLevel();
    timer.stop();
    countdown.stop();
    audioManager.playLoseSound();
    audioManager.stopWarningBeeps();
    msg.textContent = "";
    showImpeachmentScreen(root, {
      onRetry: () => {
        leaveLevel(() => launchLevel(root, levelId));
      },
      onMenu: () => {
        leaveLevel(() => NavigationService.backTo("levelSelect"));
      }
    });
    updateStats();
  }

  // Обновление состояния королей
  function updateKingTracking() {
    const currentKings = getCurrentKings();
    const newKings = new Set();
    // Новые короли
    for (const key of currentKings) {
      if (!previousKings.has(key)) {
        onKingCreated();
        newKings.add(key);
      }
    }
    // Потерявшиеся короли
    for (const key of previousKings) {
      if (!currentKings.has(key)) {
        onKingLost();
      }
    }
    previousKings = currentKings;
    // Золотая вспышка на счётчике королей при появлении каждого короля
    if (newKings.size > 0) {
      showStatBoost(findStatItem(stats, "Короли"), `+${newKings.size}`, true);
    }
    return newKings;
  }

  function checkDefeat() {
    if (won || impeached) return;
    if (remainingMs <= 0) {
      handleImpeachment();
    } else if (remainingMoves <= 0) {
      handleImpeachment();
    }
  }

  function onCell(r, c) {
    if (impeached || won) return;
    if (remainingMs <= 0 || remainingMoves <= 0) {
      checkDefeat();
      return;
    }
    audioManager.initAudioContext();
    const result = game.clickCell(r, c);
    if (result.needRedraw) {
      if (result.moved) {
        remainingMoves--;
        addTotalMoves(1); // копим общее число ходов за всю игру
        // Красная вспышка штрафа на счётчике ходов (адаптация boost-glow/boost-float)
        showStatBoost(findStatItem(stats, "Ходы"), "-1", false);
        audioManager.playSoundEffect("assets/sounds/move.mp3");
        // Если ходов мало — тихий пик в другой (низкой) тональности
        if (remainingMoves <= 20) {
          audioManager.playBeep(440, 0.08, 0.08);
        }
      }
      void draw();
    }
  }

  let rocketBtnDisabled = false;
  let kingsThisLevelAtWin = 0;

  // Нажатие рыбки. Слушатель ниже вешаем ОДИН раз на блок статистики,
  // поэтому кнопка срабатывает с первого раза, даже когда счётчики перерисовываются.
  function useRocket() {
    if (won || impeached || rocketBtnDisabled) return;
    if (!spendRocket()) return;
    audioManager.initAudioContext();
    audioManager.playSoundEffect("assets/sounds/click.mp3");
    remainingMoves += 10;
    countdown.addTime(20_000);
    remainingMs = countdown.remainingMs;
    rocketBtnDisabled = true;
    trackedSetTimeout(() => { rocketBtnDisabled = false; updateStats(); }, 500);
    updateStats();       // сперва обновляем цифры
    showRocketBoost();   // потом показываем поверх: куда прибавилось + полёт рыбки
  }

  // Показываем, КУДА прибавились цифры (надпись + подсветка над счётчиком) и запускаем рыбку.
  function showRocketBoost() {
    const items = Array.from(stats.querySelectorAll(".stat-item"));
    const find = (word) => items.find((el) => el.textContent.includes(word));
    const targets = [
      { el: find("Ходы"),   text: "+10 ходов" },
      { el: find("Время"),  text: "+20 сек" },
      { el: find("Рыбки"), text: '-1 <img class="fish-icon" src="assets/icons/fish.png" alt="">' },
    ];
    for (const t of targets) {
      if (!t.el) continue;
      const rect = t.el.getBoundingClientRect();
      const glow = document.createElement("div");
      glow.className = "boost-glow";
      glow.style.left = rect.left + "px";
      glow.style.top = rect.top + "px";
      glow.style.width = rect.width + "px";
      glow.style.height = rect.height + "px";
      document.body.appendChild(glow);
      glow.addEventListener("animationend", () => glow.remove());
      const float = document.createElement("div");
      float.className = "boost-float";
      float.innerHTML = t.text;
      float.style.left = (rect.left + rect.width / 2) + "px";
      float.style.top = rect.top + "px";
      document.body.appendChild(float);
      float.addEventListener("animationend", () => float.remove());
    }
    const rocket = document.createElement("div");
    rocket.className = "rocket-fly-big";
    rocket.innerHTML = '<img class="fish-icon" src="assets/icons/fish.png" alt="">';
    boardArea.appendChild(rocket);
    rocket.addEventListener("animationend", () => rocket.remove());
    boardArea.classList.add("screen-shake");
    boardArea.addEventListener("animationend", () => boardArea.classList.remove("screen-shake"), { once: true });
  }

  // Один слушатель на весь блок статистики — переживает перерисовку кнопки.
  // pointerdown срабатывает мгновенно, даже если кнопка будет пересоздана
  // таймером (updateStats вызывается каждые 200 мс и перезаписывает innerHTML).
  // click — fallback для активации с клавиатуры (Enter/Space),
  // не создаёт двойное срабатывание после pointerdown.
  let lastRocketPointerTime = 0;
  stats.addEventListener("pointerdown", (e) => {
    // Только основная кнопка мыши / касание.
    if (e.button !== undefined && e.button !== 0) return;
    if (e.target.closest("#rocket-btn")) {
      lastRocketPointerTime = Date.now();
      useRocket();
    }
  });
  stats.addEventListener("click", (e) => {
    if (e.target.closest("#rocket-btn")) {
      // Повторный click в течение 500 мс после pointerdown игнорируем,
      // чтобы не потратить рыбку дважды за одно нажатие (как в royal-socio-cats).
      if (Date.now() - lastRocketPointerTime > 500) useRocket();
    }
  });

  function updateStats() {
    const cats = game.board.allCats();
    let happy = 0;
    let unhappy = 0;
    for (const cat of cats) {
      const mood = calcMood(game.board, cat.r, cat.c);
      if (mood >= 1) {
        happy++;
      } else {
        unhappy++;
      }
    }

    if (!maxHappyInitialized) {
      maxHappyCats = happy;
      maxHappyInitialized = true;
    } else if (happy > maxHappyCats) {
      const increase = happy - maxHappyCats; // на сколько вырос максимум
      countdown.addTime(10_000);
      remainingMs = countdown.remainingMs;
      remainingMoves += 5;
      maxHappyCats = happy;
      // Золотая анимация бонуса за рост максимума довольных (как у рыбки)
      showStatBoost(findStatItem(stats, "Ходы"), "+5", true);
      showStatBoost(findStatItem(stats, "Время"), "+10", true);
      // Звук "Дзинь!" — за каждое увеличение максимума довольных на 1,
      // как в royal-socio-cats (не за изменение mood отдельных котов).
      for (let i = 0; i < increase; i++) {
        trackedSetTimeout(() => audioManager.playDing(), i * 150);
      }
    }

    // Работа с однократными пиками на 30 и 20 секунд
    const secondsLeft = Math.ceil(remainingMs / 1000);
    if (secondsLeft !== lastSecondBeeped) {
      lastSecondBeeped = secondsLeft;

      if (secondsLeft === 30 && !beeped30) {
        audioManager.playBeep(1100, 0.2);
        beeped30 = true;
      }
      if (secondsLeft === 20 && !beeped20) {
        audioManager.playBeep(1200, 0.2);
        beeped20 = true;
      }
    }

    // Проверка на добавление времени (если добавили >30 секунд, сбрасываем beeped30)
    if (secondsLeft > 30) {
      beeped30 = false;
    }
    if (secondsLeft > 20) {
      beeped20 = false;
    }

    audioManager.updateWarningSound(remainingMs);
    const movesMade = game.getMoveCount();
    const compact = isCompactUI();
    const isTimerCritical = secondsLeft <= 30;
    const timerColor = isTimerCritical ? "color: #ff3333; font-weight: bold;" : "";
    // Красным число оставшихся ходов и слово "осталось", когда их меньше 20
    const movesColor = remainingMoves < 20 ? "color: #ff3333; font-weight: bold;" : "";
    const remainingMovesHtml = `<span style="${movesColor}">${remainingMoves}</span>`;
    const kingsCount = won ? kingsThisLevelAtWin : getKingsThisLevel();
    const rocketsCount = getRockets();
    const canUseRocket = !rocketBtnDisabled && rocketsCount > 0 && !won && !impeached;
    const rocketBtnClass = `rocket-btn ${!canUseRocket ? 'rocket-btn-disabled' : ''}`;
    stats.innerHTML = compact ? `
      <div class="container-fluid px-0">
        <div class="row g-2 text-end justify-content-end">
          <div class="col-6 col-sm-4 col-md-3 col-lg-2"><div class="stat-item" style="${timerColor}">⏱️ Время: осталось ${formatTime(remainingMs)}</div></div>
          <div class="col-6 col-sm-4 col-md-3 col-lg-2"><div class="stat-item">😊 Довольные: ${happy}</div></div>
          <div class="col-6 col-sm-4 col-md-3 col-lg-2"><div class="stat-item">⏰ На уровне: ${formatTime(elapsedMs)}</div></div>
          <div class="col-6 col-sm-4 col-md-3 col-lg-2"><div class="stat-item">😾 Недовольные: ${unhappy}</div></div>
          <div class="col-6 col-sm-4 col-md-3 col-lg-2"><div class="stat-item">🎯 Ходы: ${remainingMovesHtml}|${movesMade}</div></div>
          <div class="col-6 col-sm-4 col-md-3 col-lg-2"><div class="stat-item">⭐ Макс. довольных: ${maxHappyCats}</div></div>
          <div class="col-6 col-sm-4 col-md-3 col-lg-2"><div class="stat-item">👑 Короли: ${kingsCount}</div></div>
          <div class="col-6 col-sm-4 col-md-3 col-lg-2"><button class="${rocketBtnClass}" id="rocket-btn" ${!canUseRocket ? 'disabled' : ''}><img class="fish-icon" src="assets/icons/fish.png" alt="">&nbsp;Рыбки: ${rocketsCount}</button></div>
        </div>
      </div>
    ` : `
      <div class="stat-item">🎯 Ходы: <span style="${movesColor}">осталось</span> | сделано (${remainingMovesHtml}/${movesMade})</div>
      <div class="stat-item" style="${timerColor}">⏱️ Время: осталось ${formatTime(remainingMs)}</div>
      <div class="stat-item">⏰ На уровне: ${formatTime(elapsedMs)}</div>
      <div class="stat-item">😊 Довольные: ${happy}</div>
      <div class="stat-item">😾 Недовольные: ${unhappy}</div>
      <div class="stat-item">⭐ Макс. довольных: ${maxHappyCats}</div>
      <div class="stat-item">👑 Короли: ${kingsCount}</div>
      <button class="${rocketBtnClass}" id="rocket-btn" ${!canUseRocket ? 'disabled' : ''}><img class="fish-icon" src="assets/icons/fish.png" alt="">&nbsp;Рыбки: ${rocketsCount}</button>
    `;
    // Кнопку рыбки теперь обрабатывает useRocket (делегированный слушатель выше).
    refitBoard();
    positionStats();
  }

  async function draw() {
    const newKings = updateKingTracking();
    await renderBoard(boardEl, game, onCell);
    
    // Добавляем золотую вспышку для новых королей
    if (newKings.size > 0) {
      const cells = boardEl.querySelectorAll(".cell");
      for (const key of newKings) {
        const [r, c] = key.split(",").map(Number);
        const index = r * game.board.cols + c;
        if (cells[index]) {
          const flash = document.createElement("div");
          flash.className = "golden-flash";
          cells[index].appendChild(flash);
          // Удаляем элемент по окончании анимации
          flash.addEventListener("animationend", () => {
            if (flash.parentNode) {
              flash.parentNode.removeChild(flash);
            }
          });
        }
      }
    }
    
    // === Анимации котов: приземление после хода + превращение при смене настроения ===
    const animCells = boardEl.querySelectorAll(".cell");
    const curMoods = {};
    const curCatCells = new Set();
    animCells.forEach((cell, index) => {
      if (cell.dataset.mood === undefined) return;
      curCatCells.add(index);
      curMoods[index] = cell.dataset.mood;
    });
    animCells.forEach((cell, index) => {
      if (cell.dataset.mood === undefined) return;
      const catImg = cell.querySelector(".cat");
      if (!catImg) return;
      const arrived = previousCatCells && !previousCatCells.has(index);
      const moodChanged = previousMoods[index] !== undefined && previousMoods[index] !== curMoods[index];
      if (arrived) {
        catImg.classList.add("cat-land");
        catImg.addEventListener("animationend", () => catImg.classList.remove("cat-land"), { once: true });
      } else if (moodChanged) {
        catImg.classList.add("mood-change");
        catImg.addEventListener("animationend", () => catImg.classList.remove("mood-change"), { once: true });
      }
    });
    previousMoods = curMoods;
    previousCatCells = curCatCells;

    updateStats();

    if (game.isWin() && !won && !impeached) {
      won = true;
      kingsThisLevelAtWin = getKingsThisLevel(); // Save before commit
      // --- Анти-фарм: в общий счёт идёт только прибавка над прошлым рекордом уровня ---
      const prevBestKings = getBestKings(level.id); // лучшее число королей на уровне (или undefined, если ещё не проходили)
      const kingsDelta = (prevBestKings === undefined)
        ? kingsThisLevelAtWin                              // первый раз — засчитываем всё
        : Math.max(0, kingsThisLevelAtWin - prevBestKings); // дальше — только сколько СВЕРХ прошлого рекорда
      commitLevel(kingsDelta);
      const timeMs = timer.stop();
      countdown.stop();
      audioManager.stopWarningBeeps();
      elapsedMs = timeMs;
      updateStats();
      markCompleted(level.id);
      const moveRecord = saveLevelRecord(level.id, game.getMoveCount());
      const timeRecord = saveLevelTimeRecord(level.id, timeMs);
      const kingsRecord = saveLevelKingsRecord(level.id, kingsThisLevelAtWin);
      showWinScreen(root, level, {
        moveCount: game.getMoveCount(),
        timeMs,
        moveRecord,
        timeRecord,
        kingsThisLevel: kingsThisLevelAtWin,
        kingsRecord,
        kingsTotal: getKingsTotal(),
        rocketsTotal: getRockets(),
        rocketsGained: kingsDelta,
        onNext: () => {
          leaveLevel(() => NavigationService.navigate("game", () => launchLevel(root, level.id + 1), { replace: true }));
        },
        onMenu: () => {
          leaveLevel(() => NavigationService.backTo("levelSelect"));
        }
      });
    } else {
      checkDefeat();
    }
  }
  startTimer();
  draw();
  
  // Ensure positionStats is called after initial rendering
  trackedSetTimeout(() => {
    positionStats();
  }, 100);

  NavigationService.saveCurrentRender(() => showGameScreen(root, levelId));
}
