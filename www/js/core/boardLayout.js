let resizeHandler = null;
let viewportTarget = null;

function getViewportSize() {
  const vv = window.visualViewport;
  return {
    width: vv?.width ?? window.innerWidth,
    height: vv?.height ?? window.innerHeight
  };
}

function getReservedHeight() {
  const topbar = document.querySelector(".topbar");
  const hud = document.querySelector(".game-hud");
  const topbarH = topbar?.offsetHeight ?? 0;
  const hudH = hud?.offsetHeight ?? 0;
  const audioBar = document.querySelector(".mobile-audio-bar");
  const audioH = audioBar?.offsetHeight ?? 0;
  return topbarH + hudH + audioH + 24;
}

// Реальная ширина контента колонки счётчиков. Считаем по скрытой копии вне
// экрана: если счётчики временно стоят у правого края/за экраном, их собственная
// ширина сжимается (shrink-to-fit и перенос текста), и резерв получался неверным.
export function getStatsContentWidth() {
  const statsEl = document.querySelector(".game-stage .stats");
  if (!statsEl) return 0;
  const clone = statsEl.cloneNode(true);
  // Клон лежит вне .anti-game-stage, поэтому раскладку одноколоночной сетки
  // задаём явно (как в .anti-game-stage .level10-stats).
  clone.style.cssText =
    "position:fixed;left:-10000px;top:0;width:max-content;height:auto;" +
    "visibility:hidden;pointer-events:none;display:grid;grid-template-columns:1fr;";
  document.body.appendChild(clone);
  const w = Math.ceil(clone.getBoundingClientRect().width);
  clone.remove();
  return w;
}

export function fitBoardToViewport(boardEl, rows, cols) {
  viewportTarget = boardEl;

  const apply = () => {
    if (!viewportTarget) return;

    const { width, height } = getViewportSize();
    const gap = 4;
    const horizontalPad = 12;
    const reservedHeight = getReservedHeight();
    // На десктопе справа от поля стоит колонка счётчиков (.stats). Резервируем
    // под неё место с обеих сторон от центра: поле остаётся по центру экрана,
    // а счётчики не уходят за правый край. На мобильных (<=768px) счётчики
    // уходят вниз под поле — резерв не нужен.
    const compact = window.matchMedia("(max-width: 768px)").matches;
    let statsReserved = 0;
    if (!compact) {
      const statsW = getStatsContentWidth();
      if (statsW > 0) {
        const gapToStats = 20;   // отступ между полем и счётчиками
        const rightMargin = 16;  // небольшой запас до правого края экрана
        statsReserved = 2 * (gapToStats + statsW + rightMargin);
      }
    }
    const maxW = Math.max(200, width - horizontalPad * 2 - statsReserved);
    const maxH = Math.max(160, height - reservedHeight);

    const byWidth = Math.floor((maxW - gap * (cols - 1)) / cols);
    const byHeight = Math.floor((maxH - gap * (rows - 1)) / rows);
    const cellW = Math.min(90, Math.max(36, Math.min(byWidth, byHeight)));
    const cellH = Math.floor(cellW * 1.1);
    const catSize = Math.max(22, Math.floor(cellW * 0.74));
    const labelSize = cellW < 48 ? 8 : cellW < 60 ? 10 : cellW < 72 ? 11 : 13;
    const outline = Math.max(2, Math.round(cellW * 0.035));

    viewportTarget.style.setProperty("--cell-w", `${cellW}px`);
    viewportTarget.style.setProperty("--cell-h", `${cellH}px`);
    viewportTarget.style.setProperty("--cat-size", `${catSize}px`);
    viewportTarget.style.setProperty("--cell-font-size", `${labelSize}px`);
    viewportTarget.style.setProperty("--cell-outline", `${outline}px`);
  };

  apply();

  // После загрузки веб-шрифтов ширина текста счётчиков может измениться —
  // пересчитаем размер поля под актуальный резерв.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      if (viewportTarget === boardEl) apply();
    });
  }

  if (resizeHandler) {
    window.removeEventListener("resize", resizeHandler);
    window.visualViewport?.removeEventListener("resize", resizeHandler);
    window.visualViewport?.removeEventListener("scroll", resizeHandler);
  }

  resizeHandler = apply;
  window.addEventListener("resize", resizeHandler);
  window.visualViewport?.addEventListener("resize", resizeHandler);
  window.visualViewport?.addEventListener("scroll", resizeHandler);
}

export function refitBoard() {
  if (resizeHandler) resizeHandler();
}

export function stopBoardLayoutListener() {
  viewportTarget = null;
  if (resizeHandler) {
    window.removeEventListener("resize", resizeHandler);
    window.visualViewport?.removeEventListener("resize", resizeHandler);
    window.visualViewport?.removeEventListener("scroll", resizeHandler);
    resizeHandler = null;
  }
}
