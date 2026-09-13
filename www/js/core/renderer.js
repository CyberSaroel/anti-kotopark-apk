import { getSelectedSkin } from "../screens/skinSelect.js";
import { fitBoardToViewport } from "./boardLayout.js";
import { bindCellInteraction } from "../ui/cellInteraction.js";
import { getTypeDisplayName } from "../socionics/types.js";
import { EMPTY as EMPTY_KIND, WATER as WATER_KIND, CAT as CAT_KIND } from "./board.js";

let skinPath = null;
let imagesPreloaded = false;

// Кэш построенного DOM по контейнеру поля: между перерисовками НЕ пересоздаём
// все клетки целиком, а переиспользуем существующие DOM-узлы и обновляем только
// то, что реально изменилось (позиция кота, выделение, настроение). Это убирает
// задержку отклика и делает перемещение кота практически мгновенным.
//
// cache.cell[i]          — DOM-узел клетки (индекс i = row*cols + col)
// cache.cat[i], образ   — ссылки на <img> и подпись, если в клетке кот
// cache.flagCat[i]      — был ли кот в клетке на прошлой отрисовке
// cache.flagWater[i]    — была ли клетка водой
// cache.flagEmpty[i]    — была ли клетка пустой
// cache.flagSel[i]      — была ли выбрана клетка
// cache.flagTgt[i]      — была ли клетка целью перемещения
// cache.mood[i]         — настроение кота на прошлой отрисовке
const boardCache = new WeakMap();

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

// Гарантированно подготовить массивы кэша нужной размерности.
function ensureBoardCache(container, total) {
  let cache = boardCache.get(container);
  if (!cache || cache.cell.length !== total) {
    container.innerHTML = "";
    cache = {
      cell: new Array(total).fill(null),
      catImg: new Array(total).fill(null),
      catLabel: new Array(total).fill(null),
      flagCat: new Uint8Array(total),
      flagWater: new Uint8Array(total),
      flagEmpty: new Uint8Array(total),
      flagSel: new Uint8Array(total),
      flagTgt: new Uint8Array(total),
      mood: new Int8Array(total),
      hasMood: new Uint8Array(total)
    };
    boardCache.set(container, cache);
  }
  return cache;
}

// Чистая отрисовка поля по состоянию игры. Клик пробрасывается через onCell(r, c).
export async function renderBoard(container, game, onCell) {
  if (!skinPath) skinPath = await loadSkinPath();
  preloadCatImages();

  const board = game.board;
  container.style.setProperty("--rows", board.rows);
  container.style.setProperty("--cols", board.cols);

  const total = board.rows * board.cols;
  const cache = ensureBoardCache(container, total);

  // ПРОИЗВОДИТЕЛЬНОСТЬ: клетки-цели вычисляются один раз (см. antiRenderer.js).
  const targets = new Set();
  if (game.selected) {
    const sr = game.selected.r, sc = game.selected.c;
    const g0 = board.grid;
    for (let dr = -1; dr <= 1; dr++) {
      const nr = sr + dr;
      if (nr < 0 || nr >= board.rows) continue;
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nc = sc + dc;
        if (nc < 0 || nc >= board.cols) continue;
        if (g0[nr][nc].kind === EMPTY_KIND) targets.add(nr * board.cols + nc);
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

      // --- Клетка: создаём один раз и переиспользуем между ходами ---
      let cell = cache.cell[idx];
      if (!cell) {
        cell = document.createElement("div");
        cell.className = "cell";
        const rr = r, cc = c; // замыкание на позицию клетки
        bindCellInteraction(cell, () => onCell(rr, cc));
        cache.cell[idx] = cell;
        container.appendChild(cell);
      }

      // --- Дифф классов water/empty (не трогаем, если не изменились) ---
      if ((cache.flagWater[idx] ? 1 : 0) !== (isWater ? 1 : 0)) {
        cell.classList.toggle("water", isWater);
        cache.flagWater[idx] = isWater ? 1 : 0;
      }
      if ((cache.flagEmpty[idx] ? 1 : 0) !== (isEmpty ? 1 : 0)) {
        cell.classList.toggle("empty", isEmpty);
        cache.flagEmpty[idx] = isEmpty ? 1 : 0;
      }

      // --- Дифф выделения и цели ---
      if ((cache.flagSel[idx] ? 1 : 0) !== (sel ? 1 : 0)) {
        cell.classList.toggle("selected", sel);
        cache.flagSel[idx] = sel ? 1 : 0;
      }
      if ((cache.flagTgt[idx] ? 1 : 0) !== (tgt ? 1 : 0)) {
        cell.classList.toggle("target", tgt);
        cache.flagTgt[idx] = tgt ? 1 : 0;
      }

      // --- Содержимое кота: добавляем/убираем/обновляем при изменении ---
      if (isCat) {
        const mood = game.moodAt(r, c);
        const typeName = board.typeAt(r, c);

        // Кот появился в клетке (раньше её не было) — построить под-дерево.
        if (!cache.catImg[idx]) {
          const img = document.createElement("img");
          img.className = "cat";
          const label = document.createElement("div");
          label.className = "label";
          cell.appendChild(img);
          cell.appendChild(label);
          cache.catImg[idx] = img;
          cache.catLabel[idx] = label;
        }
        // Настроение изменилось — обновить картинку/данные (цвета берёт CSS).
        if (!cache.hasMood[idx] || cache.mood[idx] !== mood) {
          cache.hasMood[idx] = 1;
          cache.mood[idx] = mood;
          cell.dataset.mood = String(mood);
          const img = cache.catImg[idx];
          img.src = skinPath.replace("{mood}", mood);
          img.alt = String(mood);
          cache.catLabel[idx].textContent = getTypeDisplayName(typeName);
        }
        cache.flagCat[idx] = 1;
      } else if (cache.flagCat[idx]) {
        // Кот покинул клетку — убрать его содержимое (оставляем DOM клетки).
        const img = cache.catImg[idx];
        const label = cache.catLabel[idx];
        if (img) img.remove();
        if (label) label.remove();
        cache.catImg[idx] = null;
        cache.catLabel[idx] = null;
        cache.flagCat[idx] = 0;
        cache.hasMood[idx] = 0;
        cache.mood[idx] = 0;
        delete cell.dataset.mood;
      }
    }
  }

  fitBoardToViewport(container, board.rows, board.cols);
}

// Сброс кэша скина (для обновления после смены)
export function resetSkinCache() {
  skinPath = null;
  imagesPreloaded = false;
}
