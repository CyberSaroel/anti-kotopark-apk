// Состояния клетки
export const EMPTY = "empty";
export const WATER = "water";
export const CAT   = "cat";

export class Board {
  constructor(rows, cols) {
    this.rows = rows;
    this.cols = cols;
    this.grid = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => ({ kind: EMPTY }))
    );
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

  moveCat(from, to) {
    this.grid[to.r][to.c]     = this.grid[from.r][from.c];
    this.grid[from.r][from.c] = { kind: EMPTY };
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
    const res = [];
    for (let r = 0; r < this.rows; r++)
      for (let c = 0; c < this.cols; c++)
        if (this.isCat(r, c)) res.push({ r, c });
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
