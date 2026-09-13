import { AntiGame } from "./core/antiGame.js";
import { renderAntiBoard } from "./core/antiRenderer.js";
import { TYPES, getTypeDisplayName } from "./socionics/types.js";
import { getBonusErrors, spendBonusError, addBonusErrors } from "./storage.js";
import { audioManager } from "./core/audioManager.js";
import NavigationService from "./core/navigation.js";
import { stopBoardLayoutListener, refitBoard, getStatsContentWidth } from "./core/boardLayout.js";
import { fetchLevel } from "./levels/levelLoader.js";
import { getBestKings, saveLevelKingsRecord, saveLevelRecord, saveLevelTimeRecord } from "./levels/levelRecords.js";
import { markCompleted } from "./levels/levelProgress.js";
import {
  onKingCreated,
  onKingLost,
  commitLevel,
  resetLevel,
  getKingsThisLevel,
  getKingsTotal,
  getRockets,
  spendRocket,
  addRockets,
  addTotalMoves,
  addTotalTime
} from "./core/royalStats.js";
import { showStatBoost } from "./ui/statBoost.js";
import { launchLevel } from "./screens/gameScreen.js";
import { showImpeachmentScreen } from "./screens/impeachmentScreen.js";
import { showWinScreen } from "./screens/winScreen.js";

/**
 * Уровень 10 «Антикотопарк» (план v4).
 *
 * Геймплей: тап по коту (рамка) → меню социотипов → выбор.
 * Ошибка не показывает правильный ответ, только красная вспышка + счётчик.
 * Импичмент: время (120 с), ходы (60), ошибки (минимум 3; при рестарте не меньше 3).
 * Победа: все коты довольны (зелёные, настроение >= +1).
 * Бонус за королей (настроение >= +6): за каждые 3 короля +1 право на ошибку.
 *
 * Начиная с v5 функция обобщена: уровни 10–51 «Антикотопарка» используют
 * одну и ту же логику (startAntiLevel / startLevel10). Константы режима
 * одинаковы для всех анти-уровней.
 */

const START_TIME = 120;           // секунд
const START_MOVES = 60;           // ходов
const START_ERRORS = 3;           // лимит ошибок
const MOVE_BONUS_HAPPY = 10;      // +ходов за довольного кота
const TIME_BONUS_HAPPY = 20;      // +секунд за довольного кота
const MOVE_PENALTY_ERROR = 5;     // −ходов за неправильное угадывание
const TIME_PENALTY_ERROR = 10;    // −секунд за неправильное угадывание
const KING_MOOD = 6;              // король: настроение >= 6

export const LEVEL10_ID = 10;

let levelActive = false;
let timerId = null;
// Таймер подавления «выделения» вариантов при первом появлении окна
let modalHoldTimer = null;

/**
 * Загрузить конфигурацию анти-уровня.
 * Уровень 10 использует встроенный хардкод (совпадает с прежним геймплеем),
 * уровни 11–51 — из json/levels/levelNNN.json.
 * @param {number} levelId
 * @returns {Promise<object>}
 */
async function loadAntiLevel(levelId) {
  if (levelId === LEVEL10_ID) {
    return makeLevel();
  }
  return fetchLevel(levelId);
}

/**
 * Запустить анти-уровень («Антикотопарк»).
 * @param {HTMLElement} root — контейнер #app
 * @param {number} levelId — номер уровня (10–51)
 */
export async function startAntiLevel(root, levelId) {
  if (levelActive) return;
  levelActive = true;

  // Общий запас ошибок на уровне = 3 базовых + накопленные бонусные права
  // (+1 за каждые 3 короля на пройденных уровнях). Когда общий остаток
  // опускается ниже базовых 3 — ошибки списываются с бонусного пула.
  // Бонусы НЕ сгорают при старте: их можно копить и тратить на любых уровнях.
  let bonusErrorsLeft = getBonusErrors();

  let level;
  try {
    level = await loadAntiLevel(levelId);
  } catch (e) {
    levelActive = false;
    alert(e.message);
    return;
  }

  const game = new AntiGame(level);

  // Счётчики состояния
  let timeRemaining = START_TIME;
  let movesRemaining = START_MOVES;
  let errorsMade = 0;
  // Базовое право на ошибку на уровне — всегда 3. Накопленные бонусные права
  // (+1 за каждые 3 короля на пройденных уровнях) показываются отдельно
  // счётчиком «Бонус» и тратятся по одной, когда базовые закончились.
  let currentErrorsRemaining = START_ERRORS;
  let won = false;
  let impeached = false;
  let timerStarted = false;

  // ==== Дополнительные счётчики (адаптация royal-socio-cats) ====
  // Сброс королей уровня (если предыдущий уровень не был завершён).
  resetLevel();
  // Рыбки — общий баланс на всю игру (как в royal-socio-cats): копятся
  // за королей и выдаются ТОЛЬКО после победы (commitLevel в checkWin),
  // а тратятся кнопкой «Рыбки» на любом уровне. При старте не сбрасываем.
  let levelStartTime = Date.now();
  let elapsedMs = 0;                 // ⏰ На уровне
  let levelRemainingMs = START_TIME * 1000; // ⏱️ Время: осталось (новый счётчик)
  let maxHappyCats = 0;              // ⭐ Макс. довольных
  let maxHappyInitialized = false;
  let lastHappyCount = null;         // предыдущее число довольных (для анимации счётчика)
  let lastUnhappyCount = null;       // предыдущее число недовольных (для анимации счётчика)
  let previousKings = new Set();     // короли на прошлой отрисовке («клетка»)
  let prevAntiCatCells = null;       // клетки с котами на прошлой отрисовке (Set индексов)
  let prevAntiMoods = {};            // настроение котов на прошлой отрисовке (индекс → mood)
  // Переиспользуемые контейнеры для анимации котов (без аллокаций на каждый ход).
  const antiAnimIdx = new Set();
  let antiCurMoods = {};
  let kingsAtWin = 0;                // 👑 короли, зафиксированные при победе
  let levelCleaned = false;          // защита от двойного addTotalTime

  // ==== Чит-код «Aushra» ====
  // Игрок набирает «Aushra» на клавиатуре прямо на странице игры → +1000 рыбок,
  // появляется кнопка «Открыть типы всех котов» (с анимацией) и на игровом поле
  // всплывает надпись «Чит-код активирован» (исчезает через ~1 секунду).
  const CHEAT_CODE = "aushra";
  let cheatUnlocked = false;        // чит-код активирован
  let cheatBuffer = "";             // буфер последних нажатых клавиш
  let cheatBtnAnimUntil = 0;        // окно: до этого момента HUD не перерисовываем
  let royalTimerId = null;           // таймер новых счётчиков (200 мс)
  let lastSecondBeeped = Infinity;   // для однократных пиков на 30/20 секундах
  let beeped30 = false;              // пик на 30 сек уже прозвучал
  let beeped20 = false;              // пик на 20 сек уже прозвучал

  // --- Отображение ---
  root.innerHTML = "";
  root.className = "game-screen anti-game-screen";

  // Компактное отображение панели управления на мобильных (как в классическом режиме)
  function isCompactUI() {
    return window.matchMedia("(max-width: 768px)").matches;
  }

  // Переход между уровнями/в меню: сначала очистка текущего уровня, затем навигация.
  // Используется существующая система навигации NavigationService.
  function leaveLevel(navigate) {
    cleanupLevel();
    navigate();
  }

  const bar = document.createElement("div");
  bar.className = "topbar";

  const topRow = document.createElement("div");
  topRow.className = "topbar-row";

  // Индикатор текущего уровня
  const title = document.createElement("span");
  title.className = "topbar-title";
  title.textContent = `Уровень ${levelId}`;

  const buttonsWrapper = document.createElement("div");
  buttonsWrapper.className = "topbar-buttons";

  const navButtons = document.createElement("div");
  navButtons.className = "topbar-nav-buttons";

  // ← Предыдущий: активен только для уровней 12–51
  // (уровни 1–10 отключены, уровень 11 — первый доступный)
  const prevBtn = document.createElement("button");
  prevBtn.className = "topbar-prev";
  prevBtn.textContent = isCompactUI() ? "←" : "← Предыдущий";
  prevBtn.disabled = levelId <= 11;
  prevBtn.addEventListener("click", () => {
    audioManager.initAudioContext();
    audioManager.playSoundEffect("assets/sounds/click.mp3");
    leaveLevel(() => NavigationService.navigate("game", () => launchLevel(root, levelId - 1), { replace: true }));
  });

  // Следующий →: активен для уровней 10–60 (максимум анти-уровней — 61)
  const nextBtn = document.createElement("button");
  nextBtn.className = "topbar-next";
  nextBtn.textContent = isCompactUI() ? "→" : "Следующий →";
  // 61 — последний анти перед классическим блоком 62–71; 81 — последний анти-уровень
  nextBtn.disabled = levelId >= 100;
  nextBtn.addEventListener("click", () => {
    audioManager.initAudioContext();
    audioManager.playSoundEffect("assets/sounds/click.mp3");
    leaveLevel(() => NavigationService.navigate("game", () => launchLevel(root, levelId + 1), { replace: true }));
  });

  // Покинуть уровень: возврат на страницу выбора уровней (существующий экран)
  const leaveBtn = document.createElement("button");
  leaveBtn.className = "topbar-leave";
  leaveBtn.textContent = isCompactUI() ? "✕" : "Покинуть уровень";
  leaveBtn.addEventListener("click", () => {
    audioManager.initAudioContext();
    audioManager.playSoundEffect("assets/sounds/click.mp3");
    leaveLevel(() => NavigationService.backTo("levelSelect"));
  });

  if (isCompactUI()) {
    // Мобильная раскладка: стрелки навигации + кнопка выхода
    navButtons.appendChild(prevBtn);
    navButtons.appendChild(nextBtn);
    buttonsWrapper.appendChild(navButtons);
    buttonsWrapper.appendChild(leaveBtn);

    topRow.appendChild(title);
    topRow.appendChild(buttonsWrapper);
  } else {
    // Десктопная раскладка: назад, уровень, вперёд, выход в одну строку
    topRow.appendChild(prevBtn);
    topRow.appendChild(title);
    topRow.appendChild(nextBtn);
    topRow.appendChild(leaveBtn);
  }

  // Очистка при уходе с экрана (браузерная/аппаратная кнопка «Назад»)
  NavigationService.setOnLeave(cleanupLevel);

  bar.appendChild(topRow);
  root.appendChild(bar);

  // ===== Вёрстка экрана: по центру поле с котами, справа статистика =====
  const stage = document.createElement("div");
  stage.className = "game-stage anti-game-stage";

  // Игровое поле (по центру)
  const boardArea = document.createElement("div");
  boardArea.className = "board-area";
  const boardWrap = document.createElement("div");
  boardWrap.className = "board-scroll-wrap";
  const boardEl = document.createElement("div");
  boardEl.id = "board";
  boardWrap.appendChild(boardEl);
  boardArea.appendChild(boardWrap);

  // Статистика (справа)
  const stats = document.createElement("div");
  stats.id = "stats";
  stats.className = "stats level10-stats";

  stage.appendChild(boardArea);
  stage.appendChild(stats);
  root.appendChild(stage);

  // Модальное окно выбора социотипа (вместо постоянного левого сайдбара).
  // Каркас (подложка, центрирование, закрытие по фону/Escape) даёт Tingle.js,
  // содержимое окна — наша карточка .socio-modal-card.
  const socioModalCard = document.createElement("div");
  socioModalCard.className = "socio-modal-card";

  // Декоративные изображения в модальном окне
  const socioModalDecorationLeft = document.createElement("div");
  socioModalDecorationLeft.className = "socio-modal-decoration-left";
  socioModalCard.appendChild(socioModalDecorationLeft);

  const socioModalDecorationRight = document.createElement("div");
  socioModalDecorationRight.className = "socio-modal-decoration-right";
  socioModalCard.appendChild(socioModalDecorationRight);

  const socioModalHeader = document.createElement("div");
  socioModalHeader.className = "socio-modal-header";

  const socioModalTitle = document.createElement("div");
  socioModalTitle.className = "socio-modal-title";
  socioModalTitle.textContent = "Выберите социотип";

  const socioModalClose = document.createElement("button");
  socioModalClose.className = "socio-modal-close";
  socioModalClose.textContent = "✕";
  socioModalClose.setAttribute("aria-label", "Закрыть");
  socioModalClose.addEventListener("click", () => {
    audioManager.initAudioContext();
    audioManager.playSoundEffect("assets/sounds/click.mp3");
    closeSocioMenuKeepSelection();
  });

  socioModalHeader.appendChild(socioModalTitle);
  socioModalHeader.appendChild(socioModalClose);

  const socioModalList = document.createElement("div");
  socioModalList.className = "socio-modal-list";

  socioModalCard.appendChild(socioModalHeader);
  socioModalCard.appendChild(socioModalList);

  // Tingle.js даёт каркас окна: затемняющую подложку, центрирование,
  // закрытие по клику вне окна (overlay) и по Escape. Свою кнопку закрытия
  // Tingle не создаёт (её нет в closeMethods) — используем крестик в шапке.
  if (!window.tingle) {
    console.error("Tingle.js не загружен: проверьте vendor/tingle/tingle.min.js");
  }
  const socioTingle = new window.tingle.modal({
    cssClass: ["socio-modal-tingle"],
    closeMethods: ["overlay", "escape"],
    onOpen() {
      audioManager.initAudioContext();
    },
    onClose() {
      // Закрытие модалки (фон/Escape/крестик): кот остаётся выделенным,
      // при необходимости возвращаем состояние «выбран» и снимаем hold.
      if (catState === "choosing") catState = "selected";
      if (modalHoldTimer) { clearTimeout(modalHoldTimer); modalHoldTimer = null; }
      socioModalCard.classList.remove("socio-modal-hold", "closing");
      socioModalCard.style.animation = "";
    },
  });
  socioTingle.setContent(socioModalCard);

  // --- Состояние выбора кота ---
  let catState = "idle"; // idle | selected | choosing
  let selectedCatEl = null;
  let selectedCatRC = null; // {r, c} выбранного кота
  let currentCatIndex = null; // индекс выбранного кота
  // Время последнего выделения кота. На тач-экранах после touchend браузер
  // шлёт эмуляционный click: render() пересоздаёт клетку, и «защита от
  // двойного вызова» по старому узлу не срабатывает — тот же физический тап
  // может вызвать onCatClick дважды и сразу открыть меню («после первого
  // нажатия»). Чтобы меню открывалось только после ОСОЗНАННОГО второго тапа,
  // игнорируем повторное срабатывание в коротком окне после выделения.
  let lastSelectTs = 0;
  // Момент, когда модальное окно было ПОКАЗАНО. Эмуляционный click (который
  // браузер шлёт после touchend/клика, открывшего окно) может «долететь» уже
  // до кнопок и автоматически «нажать» социотип. Игнорируем нажатия кнопок в
  // небольшом окне после открытия, чтобы тип не выбирался сам.
  let menuOpenedAt = 0;

  // --- Рендер ---
  function render() {
    renderAntiBoard(boardEl, game, (r, c) => {
      // Пока открыто окно выбора социотипа, поле не реагирует на клики
      // (подложка Tingle перекрывает поле) — игровая логика не меняется.
      if (socioTingle.isOpen()) return;
      // Клик по пустой клетке при выбранном коте снимает выбор, НО только если
      // это не доступный ход выбранного кота — иначе дальше clickCell
      // передвинет кота. Раньше resetCatSelection() обнулял game.selected даже
      // на доступном ходе, и кот с неизвестным типом ("?") не мог сделать ход.
      if (catState === "selected" && !game.board.isCat(r, c) && !game.isTarget(r, c)) {
        resetCatSelection();
        render();
      }
      // Клик по коту с известным социотипом (для неизвестных onCell не
      // вызывается — их обрабатывает onCatClick). Если это уже выбранный
      // кот — повторное нажатие ничего не делает. Если это другой кот —
      // выбор переключается на него (выделение идёт за нажатым котом).
      const tappedCatIndex = game.getCatIndex(r, c);
      if (tappedCatIndex !== null) {
        if (game.isSelected(r, c)) return;
        selectCat(tappedCatIndex, r, c);
        return;
      }
      audioManager.initAudioContext();
      const result = game.clickCell(r, c);
      if (result.needRedraw) {
       if (result.moved) {
         movesRemaining--;
         // Пищалка: мало ходов (<= 20) — тихий пик низкой тональности (как в royal-socio-cats)
         if (movesRemaining <= 20) {
           audioManager.playBeep(440, 0.08, 0.08);
         }
         addTotalMoves(1); // общий счётчик ходов (адаптация royal-socio-cats)
         // Красная вспышка штрафа на счётчике ходов (адаптация boost-glow/boost-float)
         showStatBoost(statEl("Ходы"), "-1", false);
         audioManager.playSoundEffect("assets/sounds/move.mp3");
          // Мобильная версия (узкий экран, vendor/bootstrap): после перемещения
          // кота («?» в т.ч.) снимаем выбор. Иначе кот остаётся «наведённым на
          // меню», и следующий тап по нему сразу откроет модальное окно социотипов
          // — т.е. оно покажется «после первого же нажатия» и сразу после хода.
          // Нужный сценарий: первый тап выбирает кота, второй — уже осознанно
          // открывает меню. На десктопе выбор по-прежнему следует за котом.
          if (isCompactUI()) {
            resetCatSelection();
          } else {
            // Рамка выбора следует за котом на новую позицию
            selectedCatRC = { r, c };
          }
          render();
          if (movesRemaining <= 0) {
            checkImpeachment("Ходы закончились");
            return;
          }
          checkWin();
        } else if (!game.board.isCat(r, c)) {
          // Клик мимо кота (выделение/снятие через пустую клетку) — перерисовать.
          render();
          checkWin();
        } else {
          // Клик по коту без хода. Если тип кота уже известен, onCatClick
          // для него не вызывается (меню выбора социотипа не открывается),
          // поэтому рамку выбранного кота показывает перерисовка: первое
          // нажатие выделяет кота — игрок может начать передвижение,
          // второе нажатие на того же кота открывает меню (если тип неизвестен).
          const catIndex = game.getCatIndex(r, c);
          if (catIndex !== null && game.isTypeKnown(catIndex)) {
            // Не сбрасываем выделение для кота с известным типом,
            // чтобы рамка сохранялась после хода
            render();
          }
          // Для кота с неизвестным типом перерисовка не нужна: рамку и меню
          // обрабатывает onCatClick (на сенсорных экранах она ломала открытие меню).
        }
      }
    }, onCatClick);

    // === Анимация превращения котов (адаптация royal-socio-cats) ===
    // После пересчёта соседства и настроения сравниваем с прошлой отрисовкой:
    // - кот «приземлился» на новую клетку  → cat-land;
    // - настроение любого кота ИЗМЕНИЛОСЬ (вверх или вниз) → mood-change.
    // CSS-классы cat-land/mood-change уже есть в css/cats.css.
    //
    // ПРОИЗВОДИТЕЛЬНОСТЬ: раньше тут делался boardEl.querySelectorAll(".cell")
    // (построение NodeList на 64 узла) и ДВА прохода по нему + cell.querySelector
    // для каждой клетки на КАЖДЫЙ рендер. Теперь идём только по клеткам с
    // котами (их ≤ 20, известны из board.allCats()) и берём узлы из кэша.
    antiAnimIdx.clear();
    antiCurMoods = {};
    const catsNow = game.board.allCats();
    const cellsNow = boardEl.children;
    for (let i = 0; i < catsNow.length; i++) {
      const { r, c } = catsNow[i];
      const index = r * game.board.cols + c;
      const cell = cellsNow[index];
      if (!cell || cell.dataset.mood === undefined) continue;
      antiAnimIdx.add(index);
      antiCurMoods[index] = cell.dataset.mood;
      const catImg = cell.firstElementChild;
      if (!catImg || !catImg.classList.contains("cat")) continue;
      const arrived = prevAntiCatCells && !prevAntiCatCells.has(index);
      const moodChanged = prevAntiMoods[index] !== undefined && prevAntiMoods[index] !== antiCurMoods[index];
      if (arrived) {
        catImg.classList.add("cat-land");
        catImg.addEventListener("animationend", () => catImg.classList.remove("cat-land"), { once: true });
      } else if (moodChanged) {
        catImg.classList.add("mood-change");
        catImg.addEventListener("animationend", () => catImg.classList.remove("mood-change"), { once: true });
      }
    }
    prevAntiMoods = antiCurMoods;
    prevAntiCatCells = antiAnimIdx;

    updateKingTracking();
    updateStats();
    refitBoard();
    // Позиция счётчиков пересчитывается после того, как поле построено
    schedulePositionStats();
    // После перерисовки восстановить рамку выбранного кота
    if ((catState === "selected" || catState === "choosing") && selectedCatRC) {
      const el = findCatCell(selectedCatRC.r, selectedCatRC.c);
      if (el) {
        el.classList.add("cat--selected");
        selectedCatEl = el;
      }
    }
  }

  // Позиционирование счётчиков: игровое поле остаётся строго по центру экрана,
  // статистика — справа от поля с тем же отступом 20px, что был раньше
  // (flex gap в .anti-game-stage), верх счётчиков — по верху поля.
  //
  // ПРОИЗВОДИТЕЛЬНОСТЬ: читает getBoundingClientRect() (синхронный reflow).
  // Раньше вызывалась на КАЖДЫЙ updateStats (раз в 200 мс) и на каждый ход.
  // Теперь позиция кэшируется: если геометрия поля не изменилась — не трогаем
  // style вообще. Форс-пересчёт доступен через positionStats(true).
  let lastStatsPos = null;
  function positionStats(force = false) {
    try {
      if (isCompactUI()) {
        if (lastStatsPos !== "compact") {
          stats.style.position = "";
          stats.style.left = "";
          stats.style.top = "";
          stats.style.right = "";
          stats.style.transform = "";
          lastStatsPos = "compact";
        }
        return;
      }
      stats.style.position = "absolute";
      const stageRect = stage.getBoundingClientRect();
      const boardRect = boardEl.getBoundingClientRect();
      if (boardRect.width === 0) {
        // Поле ещё строится (renderAntiBoard асинхронный: клетки появляются
        // после await загрузки скинов) — пробуем на следующем кадре.
        requestAnimationFrame(() => {
          if (levelActive) positionStats();
        });
        return;
      }
      const left = Math.round(boardRect.right - stageRect.left + 20);
      const top = Math.round(boardRect.top - stageRect.top);
      // Страховка: не даём счётчикам уйти за правый край экрана.
      // Ширину берём по реальному контенту (может отличаться от offsetWidth,
      // если счётчики временно стоят у края).
      const statsW = getStatsContentWidth() || stats.offsetWidth;
      const maxLeft = window.innerWidth - statsW - 12;
      const posLeft = Math.max(12, Math.min(left, maxLeft));
      const posTop = top;
      // Геометрия не изменилась — не пишем style (это вызывает лишний reflow).
      if (!force && lastStatsPos &&
          lastStatsPos.left === posLeft && lastStatsPos.top === posTop &&
          lastStatsPos.statsW === statsW) {
        return;
      }
      lastStatsPos = { left: posLeft, top: posTop, statsW };
      stats.style.left = posLeft + "px";
      stats.style.top = posTop + "px";
      stats.style.right = "";
      stats.style.transform = "";
    } catch (e) {
      // Позиционирование не критично для игры
    }
  }

  // Пересчёт позиции счётчиков после отрисовки поля: renderAntiBoard асинхронный
  // (клетки строятся после await загрузки скинов), поэтому ждём кадр.
  // Батчинг: несколько вызовов в одном кадре схлопываются в один пересчёт.
  let posStatsScheduled = false;
  function schedulePositionStats() {
    if (posStatsScheduled) return;
    posStatsScheduled = true;
    requestAnimationFrame(() => {
      posStatsScheduled = false;
      if (levelActive) positionStats();
    });
  }

  // Выбрать кота: установить рамку, доступные ходы и состояние выбора.
  // Используется и для котов с известным типом (клик в onCell), и для
  // котов с неизвестным типом (первое нажатие в onCatClick).
  function selectCat(catIndex, r, c) {
    if (catState === "choosing") hideSocioMenu();
    catState = "selected";
    selectedCatRC = { r, c };
    currentCatIndex = catIndex;
    lastSelectTs = Date.now();
    if (selectedCatEl) selectedCatEl.classList.remove("cat--selected");
    selectedCatEl = findCatCell(r, c);
    if (selectedCatEl) selectedCatEl.classList.add("cat--selected");
    // Устанавливаем game.selected для отображения доступных ходов
    game.selected = { r, c };
    render();
  }

  // Логика выбора: первое нажатие выбирает кота, второе по тому же — открывает меню.
  // Нажатие на нового кота считается первым (выбор переключается на него).
  // NB: для котов без типа («?») не играем click.mp3 — по просьбе минимизировать
  // шум «нажатий» при работе с такими котами (в т.ч. во время их перемещения).
  function onCatClick(catIndex, r, c) {
    audioManager.initAudioContext();
    if (won || impeached) return;

    // Меню открыто: повторный тап по тому же коту закрывает его, но оставляет кот выделенным
    if (catState === "choosing" && currentCatIndex === catIndex) {
      catState = "selected";
      hideSocioMenu();
      return;
    }

    // Кот уже выбран рамкой: открыть меню социотипов.
    // На тач-экранах один физический тап может прийти сюда ДВАЖДЫ (touchend +
    // эмуляционный click после перерисовки клетки). Окно открываем только на
    // ОСОЗНАННОМ повторном тапе, т.е. когда кот был выделен заметное время
    // назад — иначе меню «выскочит после первого же нажатия».
    if (currentCatIndex === catIndex) {
      const repeatWindow = 400; // мс — окно эмуляционного повторного события
      if (isCompactUI() && Date.now() - lastSelectTs < repeatWindow) {
        return; // это повтор того же тапа: кот выделен, меню пока не открываем
      }
      catState = "choosing";
      showSocioMenu(catIndex);
      return;
    }

    // Новый кот (или первое нажатие): выбираем его; меню другого кота закрываем
    selectCat(catIndex, r, c);
  }

  function findCatCell(r, c) {
    // ПРОИЗВОДИТЕЛЬНОСТЬ: boardEl.children — живая коллекция, доступ по индексу
    // O(1), без построения NodeList через querySelectorAll на каждый вызов.
    const idx = r * game.board.cols + c;
    return boardEl.children[idx] || null;
  }

  // Кнопки социотипов в модальном окне (существующие стили анти-тайп-кнопок)
  function createTypeButtons() {
    socioModalList.innerHTML = "";
    TYPES.forEach(type => {
      const btn = document.createElement("button");
      btn.className = "anti-type-btn socio-modal-type-btn";
      btn.textContent = getTypeDisplayName(type);
      btn.addEventListener("click", () => {
        if (currentCatIndex === null) return;
        // Если окно только что открылось (меньше 500 мс назад), этот клик —
        // «долетевший» эмуляционный повтор тапа, открывшего окно. Пропускаем,
        // чтобы социотип НЕ выбирался автоматически сразу после появления окна.
        if (Date.now() - menuOpenedAt < 500) return;
        audioManager.initAudioContext();
        const catIdx = currentCatIndex;
        hideSocioMenu();
        handleGuess(catIdx, type);
      });
      socioModalList.appendChild(btn);
    });
  }

  function resetCatSelection() {
    if (selectedCatEl) selectedCatEl.classList.remove("cat--selected");
    selectedCatEl = null;
    selectedCatRC = null;
    currentCatIndex = null;
    catState = "idle";
    game.selected = null;
  }

  // Закрыть окно социотипов через Tingle: сначала проигрываем нашу анимацию
  // «ухода в огонь» (класс closing), затем прячем модалку средствами Tingle.
  function hideSocioMenu() {
    // Уже скрыто или закрытие уже запущено — повторно не запускаем
    if (!socioTingle.isOpen() || socioModalCard.classList.contains("closing")) return;
    socioModalCard.classList.add("closing");
    let finished = false;
    const finalize = () => {
      if (finished) return;
      finished = true;
      socioModalCard.classList.remove("closing");
      socioTingle.close();
    };
    socioModalCard.addEventListener("animationend", finalize, { once: true });
    // Страховка: если animationend не сработал (неактивная вкладка и т.п.)
    setTimeout(finalize, 350);
  }

  // Закрыть меню социотипов, но оставить кота выделенным (рамка сохраняется).
  // После закрытия окна выделенный кот сразу может передвинуться на соседнюю
  // клетку — повторный выбор не нужен.
  function closeSocioMenuKeepSelection() {
    if (catState === "choosing") catState = "selected";
    hideSocioMenu();
  }

  // Пересчёт позиции счётчиков при изменении размеров окна/масштабировании:
  // поле пересобирается под новый размер, счётчики остаются справа от него.
  const statsResizeListener = () => {
    refitBoard();
    // При resize геометрия могла измениться — снимаем кэш позиции и
    // пересчитываем принудительно (positionStats(true) в следующем кадре).
    positionStats(true);
  };
  window.addEventListener("resize", statsResizeListener);
  window.visualViewport?.addEventListener("resize", statsResizeListener);
  window.visualViewport?.addEventListener("scroll", statsResizeListener);

  function showSocioMenu(catIndex) {
    currentCatIndex = catIndex;
    // Заголовок условно «Выберите <br> социотип — кот №N»:
    // на мобильной версии CSS укладывает spans в 2 ряда — 1-я строка
    // «Выберите», 2-я «социотип — кот №N». На desktop они в одной строке.
    socioModalTitle.replaceChildren();
    const titlePrefix = document.createElement("span");
    titlePrefix.className = "socio-modal-title-prefix";
    titlePrefix.textContent = "Выберите ";
    const titleCat = document.createElement("span");
    titleCat.className = "socio-modal-title-cat";
    titleCat.textContent = `социотип — кот №${catIndex + 1}`;
    socioModalTitle.append(titlePrefix, titleCat);
    createTypeButtons();
    // Фиксируем момент открытия, чтобы подавить «долетевший» эмуляционный
    // клик, который иначе автоматически нажал бы социотип сразу после появления окна.
    menuOpenedAt = Date.now();
    // Перезапуск анимации появления, если окно закрывалось анимацией
    socioModalCard.classList.remove("closing");
    // Открываем окно средствами Tingle (подложка, центрирование, скролл-лок)
    socioTingle.open();
    socioModalCard.style.animation = "none";
    void socioModalCard.offsetWidth; // принудительный reflow для перезапуска
    socioModalCard.style.animation = "";

    // При первом/любом открытии ни один вариант ответа не должен выглядеть
    // «отмеченным». Снимаем возможный фокус/подсветку с кнопок типа (иначе
    // браузер держал бы его от предыдущего активного элемента и кнопка
    // выглядела бы выбранной без действий игрока).
    const modalActiveEl = document.activeElement;
    if (modalActiveEl && modalActiveEl.closest(".socio-modal-card")) {
      modalActiveEl.blur();
    }

    // Чтобы ни одна кнопка в момент появления окна не выглядела «выделенной»:
    // временно глушим hover/focus (класс socio-modal-hold) на короткое время,
    // пока игрок не совершит реального действия.
    socioModalCard.classList.remove("socio-modal-hold");
    if (modalHoldTimer) clearTimeout(modalHoldTimer);
    requestAnimationFrame(() => {
      socioModalCard.classList.add("socio-modal-hold");
      modalHoldTimer = setTimeout(() => {
        socioModalCard.classList.remove("socio-modal-hold");
        modalHoldTimer = null;
      }, 500);
    });
  }

  // ==== Чит-код «Aushra»: набор прямо на странице игры ====
  // Собираем печатные символы в буфер и сравниваем с кодом (без учёта регистра).
  const onCheatKeyDown = (e) => {
    if (cheatUnlocked) return;
    // Игнорируем модификаторы и служебные клавиши (Escape, Shift, стрелки…)
    if (e.ctrlKey || e.metaKey || e.altKey || e.key.length > 1) return;
    cheatBuffer = (cheatBuffer + e.key).slice(-CHEAT_CODE.length).toLowerCase();
    if (cheatBuffer === CHEAT_CODE) {
      activateCheat();
    }
  };
  document.addEventListener("keydown", onCheatKeyDown);

  // ==== Обработка выбора социотипа ====
  function handleGuess(catIndex, guessedType) {
    if (won || impeached) return;
    const result = game.makeGuess(catIndex, guessedType);
    if (result.correct) {
      // Успех: правильное угадывание социотипа — весёлый звук
      audioManager.playCorrectGuess();
      movesRemaining += MOVE_BONUS_HAPPY;
      timeRemaining += TIME_BONUS_HAPPY;
      levelRemainingMs += TIME_BONUS_HAPPY * 1000; // синхронизация нового счётчика
       showFloatingBonus(`+${MOVE_BONUS_HAPPY} 👣 +${TIME_BONUS_HAPPY} ⏱`);
       // Золотая анимация бонуса на счётчиках ходов и времени (как boost у рыбок)
       showStatBoost(statEl("Ходы"), `+${MOVE_BONUS_HAPPY}`, true);
       showStatBoost(statEl("Время"), `+${TIME_BONUS_HAPPY}`, true);
     } else {
      // Ошибка: НЕ показываем правильный ответ — низкий противный звук.
      // За неправильное угадывание убавляются ходы и время (как в royal-socio-cats).
      // Сначала тратим базовые 3 ошибки уровня. Когда «Осталось» = 0 — следующая
      // ошибка списывается с накопленного бонусного права (+1 за каждые 3 короля).
      // Импичмент наступает только когда исчерпаны и базовые, и бонусные права.
      errorsMade++;
      let outOfErrors = false;
      if (currentErrorsRemaining > 0) {
        currentErrorsRemaining--;
      } else if (bonusErrorsLeft > 0) {
        bonusErrorsLeft--;
        spendBonusError();
        // Визуальный фидбек, что ошибку покрыло бонусное право
        showFloatingBonus("❤️ Бонусное право на ошибку");
        showStatBoost(statEl("Ошибки"), "💛", false);
      } else {
        outOfErrors = true;
      }
      movesRemaining = Math.max(0, movesRemaining - MOVE_PENALTY_ERROR);
      timeRemaining = Math.max(0, timeRemaining - TIME_PENALTY_ERROR);
      levelRemainingMs = Math.max(0, levelRemainingMs - TIME_PENALTY_ERROR * 1000);
      // Противный писк за каждую ошибку: перед воспроизведением убеждаемся,
      // что аудиоконтекст не "заснул" (на Android он часто переходит в suspended).
      audioManager.initAudioContext();
      audioManager.playLoseSound();
      flashCatRed();
       showFloatingBonus(`-${MOVE_PENALTY_ERROR} 👣 -${TIME_PENALTY_ERROR} ⏱`);
       // Красная анимация штрафа на счётчиках ходов, времени и ошибок
       showStatBoost(statEl("Ходы"), `-${MOVE_PENALTY_ERROR}`, false);
       showStatBoost(statEl("Время"), `-${TIME_PENALTY_ERROR}`, false);
       showStatBoost(statEl("Ошибки"), "-1", false);
       if (outOfErrors) {
        // Импичмент вызываем СРАЗУ — чтобы сброс выделения/перерисовка поля
        // не могли помешать показать экран проигрыша (иначе получится «бессмертие»).
        checkImpeachment("Ошибки типирования сверх лимита");
        return;
      }
      if (timeRemaining <= 0) {
        catState = "idle";
        hideSocioMenu();
        if (selectedCatEl) selectedCatEl.classList.remove("cat--selected");
        selectedCatEl = null;
        selectedCatRC = null;
        currentCatIndex = null;
        render();
        checkImpeachment("Время вышло");
        return;
      }
      if (movesRemaining <= 0) {
        catState = "idle";
        hideSocioMenu();
        if (selectedCatEl) selectedCatEl.classList.remove("cat--selected");
        selectedCatEl = null;
        selectedCatRC = null;
        currentCatIndex = null;
        render();
        checkImpeachment("Ходы закончились");
        return;
      }
    }
    catState = "idle";
    hideSocioMenu();
    if (selectedCatEl) selectedCatEl.classList.remove("cat--selected");
    selectedCatEl = null;
    selectedCatRC = null;
    currentCatIndex = null;
    render();
    checkWin();
  }

  function flashCatRed() {
    if (!selectedCatRC) return;
    const cell = findCatCell(selectedCatRC.r, selectedCatRC.c);
    if (!cell) return;
    cell.classList.add("cat--error");
    setTimeout(() => cell.classList.remove("cat--error"), 400);
  }

  function showFloatingBonus(text) {
    const el = document.createElement("div");
    el.className = "level10-bonus-float";
    el.textContent = text;
    boardArea.appendChild(el);
    el.addEventListener("animationend", () => el.remove());
  }

  // ==== Бонус за довольных котов (mood >= +1), одноразово за уровень ====
  let happyBonusGranted = false;
  function checkHappyBonus() {
    if (happyBonusGranted || won || impeached) return;
    const cats = game.board.allCats();
    let happy = 0;
    for (const cat of cats) {
      const m = game.moodAt(cat.r, cat.c);
      if (m >= 1) happy++;
    }
    if (happy > 0) {
      happyBonusGranted = true;
      movesRemaining += happy;
      timeRemaining += happy * 2;
      levelRemainingMs += happy * 2 * 1000; // синхронизация нового счётчика
       showFloatingBonus(`+${happy} 👣 +${happy * 2} ⏱`);
       updateStats();
       // Золотая анимация бонуса за довольных котов
       showStatBoost(statEl("Ходы"), `+${happy}`, true);
       showStatBoost(statEl("Время"), `+${happy * 2}`, true);
     }
   }

  // ==== Импичмент ====
  function checkImpeachment(reason) {
    if (won || impeached) return;
    impeached = true;
    audioManager.playLoseSound();
    cleanupLevel();
    // Экран импичмента с видео — как в royal-socio-cats (assets/impeachment/impeachment.mp4).
    // reason больше не показывается: в экране есть заголовок и кнопки «Заново»/«К выбору уровня».
    showImpeachmentScreen(root, {
      onRetry: () => startAntiLevel(root, levelId),
      onMenu: showMenu
    });
  }

  // ==== Победа ====
  function checkWin() {
    if (won || impeached) return;
    if (game.isWin()) {
      won = true;
      // Фиксируем королей до очистки (для HUD)
      kingsAtWin = getKingsThisLevel();
      // Анти-фарм: в общий счёт королей/рыбок идёт только прибавка над прошлым рекордом
      const prevBestKings = getBestKings(levelId);
      const kingsDelta = (prevBestKings === undefined)
        ? kingsAtWin
        : Math.max(0, kingsAtWin - prevBestKings);
      commitLevel(kingsDelta);
      cleanupLevel();
      // Как в royal-socio-cats: помечаем уровень пройденным и сохраняем
      // рекорды ходов/времени — в меню уровней появится галочка «✓»
      // и трофей 🏆 с лучшими ходами.
      markCompleted(levelId);
      const moveRecord = saveLevelRecord(levelId, game.getMoveCount());
      const timeRecord = saveLevelTimeRecord(levelId, elapsedMs);
      // Рекорд королей уровня — для анти-фарма при повторных проходах:
      // в следующий раз зачислят только прибавку над этим числом.
      const kingsRecord = saveLevelKingsRecord(levelId, kingsAtWin);
      // Короли: настроение >= 6
      let kings = 0;
      for (const cat of game.board.allCats()) {
        if (game.moodAt(cat.r, cat.c) >= KING_MOOD) kings++;
      }
      // Бонус за королей: +1 право на ошибку за каждые 3 короля.
      // Анти-фарм как у рыбок: при повторном прохождении уровня начисляется
      // только прибавка над лучшим прошлым результатом прав на этом же уровне.
      // Например, в прошлый раз набрано 5 прав, в этот раз 7 — прибавится +2.
      const bonusErrors = Math.floor(kings / 3);
      const prevBestBonusErrors = (prevBestKings === undefined) ? 0 : Math.floor(prevBestKings / 3);
      const bonusErrorsDelta = Math.max(0, bonusErrors - prevBestBonusErrors);
      if (bonusErrorsDelta > 0) addBonusErrors(bonusErrorsDelta);
      updateStats();
      // Экран победы — тот же визуал, что и в royal-socio-cats:
      // картинка «Уровень пройден», статистика рекордов и конфетти.
      showWinScreen(root, level, {
        moveCount: game.getMoveCount(),
        timeMs: elapsedMs,
        moveRecord,
        timeRecord,
        kingsThisLevel: kings,
        kingsRecord,
        kingsTotal: getKingsTotal(),
        rocketsTotal: getRockets(),
        rocketsGained: kingsDelta,
        bonusErrors: bonusErrorsDelta,
        nextLabel: "Следующий уровень",
        menuLabel: "В меню",
        onNext: () => leaveLevel(() => NavigationService.navigate("game", () => launchLevel(root, levelId + 1), { replace: true })),
        onMenu: showMenu
      });
    }
  }

  // ==== Отслеживание королей (адаптация royal-socio-cats: updateKingTracking) ====
  function getCurrentKings() {
    const kings = new Set();
    for (const cat of game.board.allCats()) {
      if (game.moodAt(cat.r, cat.c) >= KING_MOOD) {
        kings.add(`${cat.r},${cat.c}`);
      }
    }
    return kings;
  }

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
      showStatBoost(statEl("Короли"), `+${newKings.size}`, true);
    }
    if (newKings.size > 0) {
      const cells = boardEl.children;
      for (const key of newKings) {
        const [r, c] = key.split(",").map(Number);
        const index = r * game.board.cols + c;
        if (cells[index]) {
          const flash = document.createElement("div");
          flash.className = "golden-flash";
          cells[index].appendChild(flash);
          flash.addEventListener("animationend", () => {
            if (flash.parentNode) flash.parentNode.removeChild(flash);
          });
        }
      }
    }

    // Рыбки за королей на уровне НЕ начисляются: короли копятся в
    // kingsThisLevel, а рыбки (1 рыбка за каждого короля) выдаются ТОЛЬКО
    // после победы в checkWin() через commitLevel() — как в royal-socio-cats.
    return newKings;
  }

  // Форматирование времени (адаптация formatTime из royal-socio-cats)
  function formatTime(ms) {
    const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }
    return `${minutes}:${String(secs).padStart(2, "0")}`;
  }

  // ==== Обновление HUD ====
  function updateStats() {
    // Чит-код «Aushra»: пока идёт анимация появления кнопки (≈0.6 с),
    // не перерисовываем статистику, чтобы анимация проигралась один раз.
    if (cheatUnlocked && Date.now() < cheatBtnAnimUntil) return;
    const seconds = Math.max(0, Math.ceil(timeRemaining));
    const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
    const ss = String(seconds % 60).padStart(2, "0");

    // Довольные/недовольные/максимум довольных (из royal-socio-cats)
    let happy = 0;
    let unhappy = 0;
    for (const cat of game.board.allCats()) {
      if (game.moodAt(cat.r, cat.c) >= 1) happy++;
      else unhappy++;
    }
    if (!maxHappyInitialized) {
      maxHappyCats = happy;
      maxHappyInitialized = true;
    } else if (happy > maxHappyCats) {
      const increase = happy - maxHappyCats; // на сколько вырос максимум
      // СТАРЫЕ ПРАВИЛА (royal-socio-cats): за каждое увеличение максимума
      // довольных котов начисляются +10 секунд времени и +5 ходов.
      timeRemaining += 10;
      levelRemainingMs += 10 * 1000; // синхронизация счётчика "Время: осталось"
      movesRemaining += 5;
      maxHappyCats = happy;
      // Красивая анимация бонуса на счётчиках ходов и времени
      showStatBoost(statEl("Ходы"), "+5", true);
      showStatBoost(statEl("Время"), "+10", true);
      // Звук "Дзинь!" — за каждое увеличение максимума довольных на 1,
      // как в royal-socio-cats (не за изменение mood отдельных котов).
      for (let i = 0; i < increase; i++) {
        const delay = i * 150;
        setTimeout(() => {
          if (levelActive && !won && !impeached) audioManager.playDing();
        }, delay);
      }
    }

    // Анимации на счётчиках довольных/недовольных при их изменении
    if (lastHappyCount !== null && happy !== lastHappyCount) {
      showStatBoost(statEl("Довольные"), `${happy - lastHappyCount > 0 ? "+" : ""}${happy - lastHappyCount}`, happy > lastHappyCount);
    }
    if (lastUnhappyCount !== null && unhappy !== lastUnhappyCount) {
      showStatBoost(statEl("Недовольные"), `${unhappy - lastUnhappyCount > 0 ? "+" : ""}${unhappy - lastUnhappyCount}`, unhappy < lastUnhappyCount);
    }
    lastHappyCount = happy;
    lastUnhappyCount = unhappy;

    // ==== Пищалки-напоминалки о нехватке времени (адаптация royal-socio-cats) ====
    // Однократные пики на 30 и 20 секундах.
    const secondsLeft = Math.ceil(levelRemainingMs / 1000);
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
    // Если время добавили (рыбка/бонус) — разрешаем пикнуть ещё раз.
    if (secondsLeft > 30) {
      beeped30 = false;
    }
    if (secondsLeft > 20) {
      beeped20 = false;
    }
    // Непрерывное пиканье при 10 и менее секундах (частота растёт к нулю).
    audioManager.updateWarningSound(levelRemainingMs);

    // Красная подсветка при нехватке времени/ходов (как в royal-socio-cats):
    // время — красным при 30 и менее секундах, ходы — красным при меньше 20.
    const isTimerCritical = secondsLeft <= 30;
    const timerColor = isTimerCritical ? "color: #ff3333; font-weight: bold;" : "";
    const movesColor = movesRemaining < 20 ? "color: #ff3333; font-weight: bold;" : "";

    const movesMade = game.getMoveCount();
    // Пока идёт победа — показываем зафиксированное число королей.
    const kingsCount = won ? kingsAtWin : getKingsThisLevel();
    const rocketsCount = getRockets();
    const canUseRocket = rocketsCount > 0 && !won && !impeached;
    // Кнопка «Открыть типы всех котов»: на уровнях 1–30 доступна всегда,
    // а после чит-кода «Aushra» появляется (с анимацией) на любом уровне.
    const showTestRevealBtn = cheatUnlocked || levelId <= 30;

    // ПРОИЗВОДИТЕЛЬНОСТЬ: раньше updateStats() полностью перезаписывал
    // stats.innerHTML КАЖДЫЕ 200 мс (таймер) и на каждый ход. Это парсинг HTML,
    // пересоздание всех узлов, 6+ вызовов findStatItem (querySelectorAll +
    // textContent.includes) и повторный reflow. Теперь структура HUD строится
    // ОДИН раз, а дальнейшие обновления меняют только textContent по ссылкам.
    updateStatsDom(stats, {
      compact: isCompactUI(),
      movesRemaining, movesMade, movesColor,
      timerColor, levelRemainingMs, elapsedMs,
      happy, unhappy, maxHappyCats, kingsCount,
      errorsMade, currentErrorsRemaining, bonusErrorsLeft,
      totalCats: game.board.allCats().length,
      canUseRocket,
      showTestRevealBtn
    });

    // Позиция счётчиков пересчитывается только при смене раскладки/размера.
    schedulePositionStats();
  }

  // Хранит ссылки на узлы HUD, чтобы не искать их каждый раз.
  const statsRefs = {
    built: false,
    compact: null,
    movesVal: null, movesVal2: null, movesWord: null,
    time: null, timeItem: null, elapsed: null, happy: null, unhappy: null,
    maxHappy: null, kings: null, errMade: null, errLeft: null, errBonus: null,
    goal: null, rockets: null, rocketBtn: null, testBtn: null
  };

  // Собрать структуру HUD ОДИН раз для текущей раскладки (мобильная/десктоп).
  function buildStatsDom(container, compact, hasTestBtn) {
    const items = [
      `<div class="stat-item">🎯 Ходы: ${
        compact
          ? `(<span data-k="movesVal"></span>/<span data-k="movesMade"></span>)`
          : `<span data-k="movesWord"></span> | сделано (<span data-k="movesVal"></span>/<span data-k="movesMade"></span>)`
      }</div>`,
      `<div class="stat-item" data-k="timeItem">⏱️ Время: осталось <span data-k="time"></span></div>`,
      `<div class="stat-item">⏰ На уровне: <span data-k="elapsed"></span></div>`,
      `<div class="stat-item">😊 Довольные: <span data-k="happy"></span></div>`,
      `<div class="stat-item">😾 Недовольные: <span data-k="unhappy"></span></div>`,
      `<div class="stat-item">⭐ Макс. довольных: <span data-k="maxHappy"></span></div>`,
      `<div class="stat-item">👑 Короли: <span data-k="kings"></span></div>`,
      `<div class="stat-item">❌ Ошибки: <span data-k="errMade"></span> | Осталось: <span data-k="errLeft"></span><span data-k="errBonus"></span></div>`,
      `<div class="stat-item">🏆 Цель: зелёные <span data-k="goal"></span></div>`
    ];

    const rocketBtn = `<button class="rocket-btn" id="rocket-btn"><img class="fish-icon" src="assets/icons/fish.png" alt="">&nbsp;Рыбки: <span data-k="rockets"></span></button>`;
    const testBtn = hasTestBtn
      ? `<button class="rocket-btn test-tool-btn" id="test-reveal-btn" type="button">🧠 Открыть типы всех котов</button>`
      : "";

    if (compact) {
      // Мобильная версия: Bootstrap-сетка (vendor/bootstrap/bootstrap-grid.min.css).
      container.innerHTML = `
        <div class="container-fluid px-0">
          <div class="row g-2">
            ${items.map(h => `<div class="col-6">${h}</div>`).join("")}
            <div class="col-6">${rocketBtn}</div>
            ${hasTestBtn ? `<div class="col-12">${testBtn}</div>` : ""}
          </div>
        </div>
      `;
    } else {
      container.innerHTML = `${items.join("")}${rocketBtn}${testBtn}`;
    }

    const q = (k) => container.querySelector(`[data-k="${k}"]`);
    statsRefs.movesVal = q("movesVal");
    statsRefs.movesVal2 = q("movesMade");
    statsRefs.movesWord = q("movesWord");
    statsRefs.time = q("time");
    statsRefs.timeItem = q("timeItem");
    statsRefs.elapsed = q("elapsed");
    statsRefs.happy = q("happy");
    statsRefs.unhappy = q("unhappy");
    statsRefs.maxHappy = q("maxHappy");
    statsRefs.kings = q("kings");
    statsRefs.errMade = q("errMade");
    statsRefs.errLeft = q("errLeft");
    statsRefs.errBonus = q("errBonus");
    statsRefs.goal = q("goal");
    statsRefs.rockets = q("rockets");
    statsRefs.rocketBtn = container.querySelector("#rocket-btn");
    statsRefs.testBtn = container.querySelector("#test-reveal-btn");
    statsRefs.built = true;
    statsRefs.compact = compact;
    // Индекс .stat-item по подстроке-ключу — строится один раз, чтобы
    // showStatBoost() не делал querySelectorAll на каждый бонус.
    buildStatItemIndex(container);
  }

  // Кэш .stat-item по ключевым словам («Ходы», «Время», «Довольные» и т.д.).
  let statItemIndex = null;
  function buildStatItemIndex(container) {
    statItemIndex = new Map();
    const items = container.querySelectorAll(".stat-item");
    const keys = ["Ходы", "Время", "Довольные", "Недовольные", "Короли", "Ошибки"];
    for (const key of keys) {
      let found = null;
      for (const el of items) {
        if (el.textContent.includes(key)) { found = el; break; }
      }
      statItemIndex.set(key, found);
    }
  }

  // Быстрый доступ к .stat-item без повторного поиска в DOM.
  function statEl(word) {
    if (!statItemIndex) buildStatItemIndex(stats);
    return statItemIndex.get(word) || null;
  }

  // Обновить HUD: при первом вызове/смене раскладки/появлении кнопки — собрать
  // структуру, далее менять только текст (дёшево, без пересборки DOM).
  function updateStatsDom(container, d) {
    const needRebuild = !statsRefs.built ||
      statsRefs.compact !== d.compact ||
      (!!statsRefs.testBtn !== d.showTestRevealBtn);
    if (needRebuild) buildStatsDom(container, d.compact, d.showTestRevealBtn);

    const set = (el, val) => { if (el && el.textContent !== val) el.textContent = val; };

    set(statsRefs.movesVal, String(d.movesRemaining));
    set(statsRefs.movesVal2, String(d.movesMade));
    if (statsRefs.movesWord) {
      set(statsRefs.movesWord, "осталось");
      statsRefs.movesWord.style.cssText = d.movesColor;
    }
    if (statsRefs.movesVal) statsRefs.movesVal.style.cssText = d.movesColor;
    if (statsRefs.movesVal2) statsRefs.movesVal2.style.cssText = d.movesColor;

    set(statsRefs.time, formatTime(d.levelRemainingMs));
    if (statsRefs.timeItem) statsRefs.timeItem.style.cssText = d.timerColor;
    set(statsRefs.elapsed, formatTime(d.elapsedMs));
    set(statsRefs.happy, String(d.happy));
    set(statsRefs.unhappy, String(d.unhappy));
    set(statsRefs.maxHappy, String(d.maxHappyCats));
    set(statsRefs.kings, String(d.kingsCount));
    set(statsRefs.errMade, String(d.errorsMade));
    set(statsRefs.errLeft, String(d.currentErrorsRemaining));
    set(statsRefs.errBonus, d.bonusErrorsLeft > 0 ? ` | Бонус: ${d.bonusErrorsLeft}` : "");
    set(statsRefs.goal, `${d.happy}/${d.totalCats}`);
    set(statsRefs.rockets, String(getRockets()));
    if (statsRefs.rocketBtn) {
      statsRefs.rocketBtn.classList.toggle("rocket-btn-disabled", !d.canUseRocket);
      statsRefs.rocketBtn.disabled = !d.canUseRocket;
    }
  }

  // ==== Рыбка (адаптация royal-socio-cats: useRocket + showRocketBoost) ====
  function useRocket() {
    if (won || impeached) return;
    if (!spendRocket()) return;
    audioManager.initAudioContext();
    audioManager.playSoundEffect("assets/sounds/click.mp3");
    startTimer();                // таймер счётчиков стартует и по клику на рыбку
    movesRemaining += 10;        // +10 ходов
    levelRemainingMs += 20_000;  // +20 сек
    timeRemaining += 20;         // синхронизация с существующим счётчиком AK
    updateStats();
    showRocketBoost();
  }

  function showRocketBoost() {
    // Используем кэшированные ссылки на .stat-item (без querySelectorAll).
    const targets = [
      { el: statEl("Ходы"), text: "+10 ходов" },
      { el: statEl("Время"), text: "+20 сек" },
      { el: statEl("Рыбки"), text: '-1 <img class="fish-icon" src="assets/icons/fish.png" alt="">' },
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

  // ==== Тестовые кнопки для заказчика ====
  // «Открыть типы всех котов»: показать социотип каждого кота на поле.
  function revealAllTypesTest() {
    game.revealAllTypes();
    render();
    showFloatingBonus("🧠 Типы всех котов открыты");
  }

  // ==== Чит-код «Aushra»: +1000 рыбок + кнопка «Открыть типы всех котов» ====
  function activateCheat() {
    if (cheatUnlocked) return;
    cheatUnlocked = true;
    addRockets(1000);            // +1000 рыбок
    updateStats();               // перерисовать HUD: счётчик рыбок + кнопка
    // Начинаем окно анимации: HUD не перерисовывается ~0.6 с, чтобы кнопка
    // успела появиться с анимацией один раз и не «мигала» при перерисовках.
    cheatBtnAnimUntil = Date.now() + 600;
    const btn = stats.querySelector("#test-reveal-btn");
    if (btn) btn.classList.add("test-tool-btn-appear");
    // Надпись на игровом поле: появляется и через ~1 секунду исчезает.
    const msg = document.createElement("div");
    msg.className = "cheat-code-float";
    msg.textContent = "Чит-код активирован";
    boardArea.appendChild(msg);
    msg.addEventListener("animationend", () => msg.remove());
  }

  // Один слушатель на весь блок статистики — переживает перерисовку кнопки
  // (updateStats перезаписывает innerHTML при каждом обновлении).
  let lastRocketPointerTime = 0;
  let lastTestBtnPointerTime = 0;
  stats.addEventListener("pointerdown", (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    // Тестовые кнопки: действие срабатывает сразу по pointerdown
    if (e.target.closest("#test-reveal-btn")) {
      lastTestBtnPointerTime = Date.now();
      revealAllTypesTest();
      return;
    }
    if (e.target.closest("#rocket-btn")) {
      lastRocketPointerTime = Date.now();
      useRocket();
    }
  });
  stats.addEventListener("click", (e) => {
    // Тестовая кнопка: повторный click после pointerdown игнорируем,
    // чтобы действие не сработало дважды за одно нажатие.
    if (e.target.closest("#test-reveal-btn")) {
      if (Date.now() - lastTestBtnPointerTime > 500) revealAllTypesTest();
      return;
    }
    if (e.target.closest("#rocket-btn")) {
      if (Date.now() - lastRocketPointerTime > 500) useRocket();
    }
  });

  // ==== Таймер дополнительных счётчиков (⏰ На уровне, ⏱️ Время осталось) ====
  function startRoyalTimer() {
    if (royalTimerId !== null) return;
    royalTimerId = setInterval(() => {
      if (!levelActive || won || impeached) return;
      elapsedMs = Date.now() - levelStartTime;
      levelRemainingMs = Math.max(0, levelRemainingMs - 200);
      updateStats();
    }, 200);
  }

  // ==== Таймер ====
  function startTimer() {
    if (timerStarted) return;
    timerStarted = true;
    startRoyalTimer();
    timerId = setInterval(() => {
      if (!levelActive || won || impeached) return;
      timeRemaining--;
      if (timeRemaining <= 0) {
        timeRemaining = 0;
        levelRemainingMs = 0;
        updateStats();
        checkImpeachment("Время вышло");
        return;
      }
      updateStats();
    }, 1000);
  }

  // ==== Очистка ====
  function cleanupLevel() {
    levelActive = false;
    if (timerId) { clearInterval(timerId); timerId = null; }
    if (royalTimerId !== null) { clearInterval(royalTimerId); royalTimerId = null; }
    // Глушим пищалки-напоминалки при любом выходе с уровня
    // (импичмент, победа, кнопка «Выйти», навигация) — как в royal-socio-cats.
    audioManager.stopWarningBeeps();
    // Копим общее время игры (адаптация addTotalTime из royal-socio-cats)
    if (!levelCleaned) {
      levelCleaned = true;
      elapsedMs = Date.now() - levelStartTime;
      addTotalTime(elapsedMs);
    }
    stopBoardLayoutListener();
    // Закрываем и уничтожаем модальное окно Tingle (снимает свои слушатели)
    if (modalHoldTimer) { clearTimeout(modalHoldTimer); modalHoldTimer = null; }
    try { socioTingle.destroy(); } catch (e) { /* окно могло не открываться */ }
    document.removeEventListener("keydown", onCheatKeyDown);
    window.removeEventListener("resize", statsResizeListener);
    window.visualViewport?.removeEventListener("resize", statsResizeListener);
    window.visualViewport?.removeEventListener("scroll", statsResizeListener);
  }

  // Возврат на экран выбора уровней (используется в оверлеях победы/импичмента
  // и раньше была кнопкой «Меню»). Используется существующая навигация.
  function showMenu() {
    leaveLevel(() => NavigationService.backTo("levelSelect"));
  }

  // Таймер стартует сразу при входе на уровень (по правилам royal-socio-cats:
  // startTimer() вызывается сразу, время идёт всегда). Раньше таймер стартовал
  // только по клику на поле, но обработчики кликов по котам в antiRenderer.js
  // делают stopPropagation() — и если игра начиналась с клика по коту (что
  // типично для неизвестных котов "?"), таймер не запускался вовсе.
  startTimer();

  render();
  // Одноразовый бонус за довольных котов с самого старта
  checkHappyBonus();
}

/**
 * Обратно совместимая обёртка: запуск уровня 10 «Антикотопарк».
 * @param {HTMLElement} root — контейнер #app
 */
export function startLevel10(root) {
  return startAntiLevel(root, LEVEL10_ID);
}

/** Конфигурация уровня 10 (поле 8x8, 10 котов). */
function makeLevel() {
  return {
    id: "level10",
    rows: 8,
    cols: 8,
    cats: [
      { r: 0, c: 1, type: "Дон Кихот" },
      { r: 0, c: 3, type: "Гюго" },
      { r: 0, c: 5, type: "Максим" },
      { r: 2, c: 1, type: "Жуков" },
      { r: 2, c: 3, type: "Есенин" },
      { r: 2, c: 5, type: "Наполеон" },
      { r: 4, c: 1, type: "Бальзак" },
      { r: 4, c: 3, type: "Драйзер" },
      { r: 4, c: 5, type: "Штирлиц" },
      { r: 6, c: 1, type: "Гексли" }
    ],
    water: [[0, 7], [7, 0], [7, 7], [0, 0]]
  };
}