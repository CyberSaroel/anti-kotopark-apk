import { typeIndex, MOOD_DELTA_MATRIX } from "./relations.js";

const N = 16;

// Настроение кота = сумма влияний соседей-котов, ограниченная [-6, +6].
// Вода и пустые клетки соседями НЕ считаются (см. board.catNeighbors).
//
// Оптимизация: вместо getRelation() + MOOD_DELTA[rel] (хеширование строк на
// каждый шаг) используется предвычисленная числовая матрица MOOD_DELTA_MATRIX,
// проиндексированная индексами типов. Дополнительно обходим соседей напрямую
// по сетке (dr/dc), не создавая массив объектов {r, c} через catNeighbors().
export function calcMood(board, r, c) {
  const type = board.typeAt(r, c);
  if (!type) return null;
  const i = typeIndex(type);
  if (i === -1) return 0;

  const grid = board.grid;
  const rows = board.rows;
  const cols = board.cols;
  const base = i * N;

  let score = 0;
  for (let dr = -1; dr <= 1; dr++) {
    const nr = r + dr;
    if (nr < 0 || nr >= rows) continue;
    const row = grid[nr];
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nc = c + dc;
      if (nc < 0 || nc >= cols) continue;
      const cell = row[nc];
      if (cell.kind !== "cat") continue;
      const j = typeIndex(cell.type);
      if (j === -1) continue;
      score += MOOD_DELTA_MATRIX[base + j];
    }
  }

  if (score > 6) score = 6;
  if (score < -6) score = -6;
  return score;
}

// Проверка, является ли кот королём
export function isKing(mood) {
  return mood >= 6;
}
