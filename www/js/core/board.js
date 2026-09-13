// Состояния клетки
export const EMPTY = "empty";
export const WATER = "water";
export const CAT   = "cat";

import { calcMood } from "../socionics/mood.js";

export class Board {
  constructor(rows, cols) {
    this.rows = rows;
    this.cols = cols;
    this.grid = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => ({ kind: EMPTY }))
    );
    // Кэш настроений (mood) по клеткам. calcMood() вызывается многократно за
    // ход (отрисовка, HUD, проверка победы, короли), а меняется настроение
    // только у котов ВОКРУГ перемещённой клетки. Кэш сбрасывается точечно
    // (invalidateMoodAround) при каждом ходе, а не целиком.
    this._moodCache = null;
    // Кэш списка координат котов: перестраивается только при ходе, чтобы
    // allCats() не пересканировал всю сетку на каждый вызов HUD.
    this._catsCache = null;
  }

  static fromLevel(level) {
    const b = new Board(level.rows, level.cols);
    for (const [r, c] of (level.water || [])) {
      b.grid[r][c] = { kind: WATER };
    }
    for (const cat of level.cats) {
      b.grid[cat.r][cat.c] = { kind: CAT, type: cat.type };
    }
    return b;
  }

  inBounds(r, c) { return r >= 0 && r < this.rows && c >= 0 && c < this.cols; }
  cell(r, c)     { return this.inBounds(r, c) ? this.grid[r][c] : null; }

  isCat(r, c)   { const x = this.cell(r, c); return !!x && x.kind === CAT; }
  isEmpty(r, c) { const x = this.cell(r, c); return !!x && x.kind === EMPTY; }
  isWater(r, c) { const x = this.cell(r, c); return !!x && x.kind === WATER; }
  typeAt(r, c)  { const x = this.cell(r, c); return (x && x.kind === CAT) ? x.type : null; }

  // Настроение кота с кэшированием. Один и тот же mood за ход запрашивается
  // многократно (отрисовка клетки, HUD, короли, проверка победы) — считаем
  // один раз и храним в Map по индексу клетки. Кэш точечно сбрасывается в
  // invalidateMoodAround() при ходе.
  moodAt(r, c) {
    if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) return null;
    if (!this._moodCache) this._moodCache = new Map();
    const key = r * this.cols + c;
    const cached = this._moodCache.get(key);
    if (cached !== undefined) return cached;
    const mood = calcMood(this, r, c);
    this._moodCache.set(key, mood);
    return mood;
  }

  moveCat(from, to) {
    this.grid[to.r][to.c]     = this.grid[from.r][from.c];
    this.grid[from.r][from.c] = { kind: EMPTY };
    // Позиция кота изменилась → списки котов и настроения соседей устарели.
    this._catsCache = null;
    this.invalidateMoodAround(from.r, from.c);
    this.invalidateMoodAround(to.r, to.c);
  }

  // Сбросить кэш настроений у клетки и всех её соседей (8 направлений + сама).
  // Сдвиг кота меняет настроение только у клеток в радиусе 1 от from и to.
  invalidateMoodAround(r, c) {
    if (!this._moodCache) return;
    for (let dr = -1; dr <= 1; dr++) {
      const nr = r + dr;
      if (nr < 0 || nr >= this.rows) continue;
      for (let dc = -1; dc <= 1; dc++) {
        const nc = c + dc;
        if (nc < 0 || nc >= this.cols) continue;
        this._moodCache.delete(nr * this.cols + nc);
      }
    }
  }

  // Соседи по 8 направлениям, ТОЛЬКО коты (вода и пустые исключены).
  catNeighbors(r, c) {
    const res = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr, nc = c + dc;
        if (this.isCat(nr, nc)) res.push({ r: nr, c: nc });
      }
    }
    return res;
  }

  allCats() {
    if (this._catsCache) return this._catsCache;
    const res = [];
    for (let r = 0; r < this.rows; r++)
      for (let c = 0; c < this.cols; c++)
        if (this.isCat(r, c)) res.push({ r, c });
    this._catsCache = res;
    return res;
  }

  emptyCells() {
    const res = [];
    for (let r = 0; r < this.rows; r++)
      for (let c = 0; c < this.cols; c++)
        if (this.isEmpty(r, c)) res.push({ r, c });
    return res;
  }
}
