import { getSelectedSkin } from "../screens/skinSelect.js";
import { fitBoardToViewport } from "./boardLayout.js";
import { bindCellInteraction } from "../ui/cellInteraction.js";
import { getTypeDisplayName } from "../socionics/types.js";
import { EMPTY as EMPTY_KIND, WATER as WATER_KIND, CAT as CAT_KIND } from "./board.js";

let skinPath = null;
let imagesPreloaded = false;

function preloadCatImages() {
  if (imagesPreloaded || !skinPath) return;
  imagesPreloaded = true;
  for (let m = -6; m <= 6; m++) {
    const pre = new Image();
    pre.src = skinPath.replace("{mood}", m);
  }
}

async function loadSkinPath() {
  try {
    const res = await fetch("json/data/skins.json");
    if (!res.ok) return "assets/cats/mood_{mood}.png";
    const data = await res.json();
    const skinId = getSelectedSkin();
    const skin = data.skins.find(s => s.id === skinId);
    return skin ? skin.path : data.skins[0].path;
  } catch {
    return "assets/cats/mood_{mood}.png";
  }
}

// Уменьшить шрифт подписи, чтобы имя социотипа помещалось в ОДНУ строку
// (перенос строк отключён CSS white-space:nowrap). Уменьшаем до тех пор,
// пока текст не влезет по ширине клетки: мобильный минимум ниже, чтобы
// длинные имена Гуленко («Предприниматель» и т.п.) целиком умещались;
// на ПК минимум чуть больше, но подгонка всё равно доводит до одной строки.
//
// ПРОИЗВОДИТЕЛЬНОСТЬ: цикл читает label.scrollWidth (принудительный layout) до
// 40 раз на КАЖДУЮ клетку — это очень дорого. Теперь:
//  - подгонка запускается один раз на конкретную ширину клетки и текст
//    (ключ кэша), повторные вызовы с тем же текстом ничего не считают;
//  - результат кэшируется в WeakMap по самому узлу подписи.
//  - измерение откладывается на кадр и батчится, а не выполняется посреди
//    цикла отрисовки (избегаем layout thrashing).
const fittedLabels = new WeakMap();

function fitTypeLabel(label) {
  requestAnimationFrame(() => {
    const cellEl = label.closest(".cell");
    if (!cellEl) return;
    // Максимальная ширина текста с учётом паддингов/рамок подписи
    const style = getComputedStyle(label);
    const padLR = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
    const borderLR = (parseFloat(style.borderLeftWidth) || 0) + (parseFloat(style.borderRightWidth) || 0);
    const cellW = cellEl.clientWidth;
    const maxW = cellW - padLR - borderLR - 4;
    if (maxW <= 0) return;
    // Ключ кэша: если для этой клетки и этого текста уже подбирали шрифт —
    // выходим, не читая scrollWidth (не форсируем layout).
    const text = label.textContent || "";
    const cacheKey = cellW + "|" + text;
    if (fittedLabels.get(label) === cacheKey) return;

    const isMobile = window.matchMedia("(max-width: 768px)").matches;
    const minFs = isMobile ? 4.5 : 6;
    const maxAttempts = 40;
    let fs = parseFloat(style.fontSize) || 11;
    let attempts = 0;
    // Метка по ширине контента (textContent уже вставлен до вызова)
    while (label.scrollWidth > maxW && fs > minFs && attempts < maxAttempts) {
      fs -= 0.5;
      label.style.fontSize = `${fs}px`;
      attempts++;
    }
    fittedLabels.set(label, cacheKey);
  });
}

// Актуальные колбэки текущей перерисовки (ссылки обновляются при каждом вызове
// renderAntiBoard). Сохраняем на уровне модуля, чтобы buildAntiCell мог вызывать их.
let onCellRef = null;
let onCatClickRef = null;

// Инкрементальное построение поля Anti-уровня.
//
// Клетки DOM создаются ОДИН раз и далее переиспользуются между ходами. Полная
// пересборка клетки выполняется только тогда, когда меняется её «роль»
// (water / empty / knownCat / unknownCat), т.е. когда туда пришёл/ушёл кот или
// тип кота стал известен. В остальных случаях (смена выделения/цели/настроения,
// когда роль клетки не менялась) обновляются только изменённые атрибуты/классы.
// Это исключает задержку «клик → отклик» и делает передвижение кота мгновенным.
const antiCache = new WeakMap();

function prepareAntiCache(container, total) {
  let cache = antiCache.get(container);
  if (!cache || cache.cell.length !== total) {
    container.innerHTML = "";
    cache = {
      cell: new Array(total).fill(null),
      role: new Array(total).fill(null),
      flagSel: new Uint8Array(total),
      flagTgt: new Uint8Array(total),
      mood: new Int8Array(total),
      hasMood: new Uint8Array(total)
    };
    antiCache.set(container, cache);
  }
  return cache;
}

// Роль клетки определяет необходимость пересборки DOM-узла.
// kind и catIndex передаются готовыми (вызывающий уже прочитал их из сетки),
// чтобы не делать повторные обращения к доске.
function antiRole(kind, catIndex, game) {
  if (kind === WATER_KIND) return "water";
  if (kind !== CAT_KIND) return "empty";
  const isKnown = catIndex !== null && game.isTypeKnown(catIndex);
  return isKnown ? "knownCat" : "unknownCat";
}

// Построить полностью новую клетку (или пересобрать клетку при смене роли).
// el в DOM пока не добавляется — это делает вызывающий код.
function buildAntiCell(r, c, st) {
  const cell = document.createElement("div");
  cell.className = "cell";
  if (st.isWater) cell.classList.add("water");
  if (st.isEmpty) cell.classList.add("empty");
  if (st.sel) cell.classList.add("selected");
  if (st.tgt) cell.classList.add("target");

  let typeLabel = null;

  if (st.isCat) {
    cell.dataset.mood = String(st.mood);

    const rr = r, cc = c;
    // Защита от двойного срабатывания на сенсоре (touchend + эмуляционный click).
    const touchFlag = { v: false };
    const fireCatClick = () => {
      if (onCatClickRef && st.catIndex !== null && !st.isKnown) {
        onCatClickRef(st.catIndex, rr, cc);
      }
    };
    const guardClick = () => {
      if (touchFlag.v) { touchFlag.v = false; return; }
      fireCatClick();
    };
    const markTouch = () => {
      touchFlag.v = true;
      setTimeout(() => { touchFlag.v = false; }, 500);
    };

    const img = document.createElement("img");
    img.className = "cat";
    img.src = skinPath.replace("{mood}", st.mood);
    img.alt = String(st.mood);
    cell.appendChild(img);

    const numberBadge = document.createElement("div");
    numberBadge.className = "cat-number";
    numberBadge.textContent = st.catNum;
    cell.appendChild(numberBadge);

    typeLabel = document.createElement("div");
    typeLabel.className = "cat-type-label " + (st.isKnown ? "known" : "unknown");
    typeLabel.textContent = st.typeText;
    if (st.isKnown) {
      cell.appendChild(typeLabel);
    } else {
      // Неизвестный тип: подпись работает как кнопка (свечение, hover, tap).
      typeLabel.classList.add("cat-type-btn-label");
      cell.appendChild(typeLabel);
      typeLabel.addEventListener("click", (e) => { e.stopPropagation(); guardClick(); });
      typeLabel.addEventListener("touchend", (e) => {
        e.stopPropagation();
        markTouch();
        fireCatClick();
        typeLabel.classList.add("cat-type-label--tap");
        setTimeout(() => typeLabel.classList.remove("cat-type-label--tap"), 300);
      }, { passive: false });

      cell.addEventListener("click", (e) => { e.stopPropagation(); guardClick(); });
      cell.addEventListener("touchend", (e) => {
        e.stopPropagation();
        markTouch();
        fireCatClick();
      }, { passive: false });
    }
  }

  // Обычный клик-обработчик: пустые клетки, вода и коты с известным типом.
  // Коты с неизвестным типом открывают меню своим обработчиком выше — onCell
  // им не вешают, иначе clickCell сбросил бы выделение передвинутого кота.
  if (!st.isCat || st.isKnown) {
    const rr = r, cc = c;
    bindCellInteraction(cell, () => onCellRef(rr, cc));
  }

  return { el: cell, typeLabel };
}

// Render board for Anti-Kotopark mode with cat numbers and sociotype display.
export async function renderAntiBoard(container, game, onCell, onCatClick) {
  onCellRef = onCell;
  onCatClickRef = onCatClick;

  if (!skinPath) skinPath = await loadSkinPath();
  preloadCatImages();

  const board = game.board;
  container.style.setProperty("--rows", board.rows);
  container.style.setProperty("--cols", board.cols);

  const total = board.rows * board.cols;
  const cache = prepareAntiCache(container, total);

  // ПРОИЗВОДИТЕЛЬНОСТЬ: вместо вызова game.isTarget() (а внутри canMove → 3
  // обращения к доске) для КАЖДОЙ из 60+ клеток на каждый ход — вычисляем
  // множество клеток-целей ОДИН раз (их не больше 8 вокруг выбранного кота).
  const targets = new Set();
  if (game.selected) {
    const sr = game.selected.r, sc = game.selected.c;
    const grid0 = board.grid;
    for (let dr = -1; dr <= 1; dr++) {
      const nr = sr + dr;
      if (nr < 0 || nr >= board.rows) continue;
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nc = sc + dc;
        if (nc < 0 || nc >= board.cols) continue;
        if (grid0[nr][nc].kind === EMPTY_KIND) targets.add(nr * board.cols + nc);
      }
    }
  }

  const selR = game.selected ? game.selected.r : -1;
  const selC = game.selected ? game.selected.c : -1;
  const grid = board.grid;

  for (let r = 0; r < board.rows; r++) {
    const row = grid[r];
    for (let c = 0; c < board.cols; c++) {
      const idx = r * board.cols + c;
      const kind = row[c].kind;
      const isWater = kind === WATER_KIND;
      const isEmpty = kind === EMPTY_KIND;
      const isCat = kind === CAT_KIND;
      const sel = (r === selR && c === selC);
      const tgt = targets.has(idx);
      // Индекс кота нужен и для роли, и для пересборки клетки — считаем один раз.
      const catIndex = isCat ? game.getCatIndex(r, c) : null;
      const role = antiRole(kind, catIndex, game);

      let cell = cache.cell[idx];
      const roleChanged = !cell || cache.role[idx] !== role;

      if (roleChanged) {
        // Роль сменилась (пришёл/ушёл кот, раскрыли тип) → осторожная пересборка
        // только этой клетки. Её старые замыкания могли указывать на другие
        // координаты/номера, поэтому узел пересоздаём целиком.
        const mood = isCat ? game.moodAt(r, c) : 0;
        const catNum = isCat ? game.getCatNumber(r, c) : null;
        const isKnown = isCat && catIndex !== null && game.isTypeKnown(catIndex);
        const typeClass = isKnown ? "known" : "unknown";
        const typeText = isKnown ? getTypeDisplayName(game.getGuessedType(catIndex)) : "?";
        const built = buildAntiCell(r, c, {
          isWater, isEmpty, isCat, isKnown, sel, tgt,
          mood, catNum, catIndex, typeText
        });
        if (cell) container.replaceChild(built.el, cell);
        else container.appendChild(built.el);
        cache.cell[idx] = built.el;
        cache.role[idx] = role;
        cache.flagSel[idx] = sel ? 1 : 0;
        cache.flagTgt[idx] = tgt ? 1 : 0;
        cache.hasMood[idx] = isCat ? 1 : 0;
        cache.mood[idx] = isCat ? mood : 0;
        if (built.typeLabel && typeClass === "known") fitTypeLabel(built.typeLabel);
        continue;
      }

      // Роль не менялась — обновляем только те атрибуты, что реально изменились.
      if ((cache.flagSel[idx] ? 1 : 0) !== (sel ? 1 : 0)) {
        cell.classList.toggle("selected", sel);
        cache.flagSel[idx] = sel ? 1 : 0;
      }
      if ((cache.flagTgt[idx] ? 1 : 0) !== (tgt ? 1 : 0)) {
        cell.classList.toggle("target", tgt);
        cache.flagTgt[idx] = tgt ? 1 : 0;
      }
      if (isCat) {
        const mood = game.moodAt(r, c);
        if (!cache.hasMood[idx] || cache.mood[idx] !== mood) {
          cache.hasMood[idx] = 1;
          cache.mood[idx] = mood;
          cell.dataset.mood = String(mood);
          const img = cell.querySelector(":scope > img.cat");
          if (img) {
            img.src = skinPath.replace("{mood}", mood);
            img.alt = String(mood);
          }
        }
      }
    }
  }

  fitBoardToViewport(container, board.rows, board.cols);
}

export function resetSkinCache() {
  skinPath = null;
  imagesPreloaded = false;
}
