import { getRelation, MOOD_DELTA } from "./relations.js";

// Настроение кота = сумма влияний соседей-котов, ограниченная [-6, +6].
// Вода и пустые клетки соседями НЕ считаются (см. board.catNeighbors).
export function calcMood(board, r, c) {
  const type = board.typeAt(r, c);
  if (!type) return null;
  let score = 0;
  for (const n of board.catNeighbors(r, c)) {
    const rel = getRelation(type, board.typeAt(n.r, n.c));
    score += (MOOD_DELTA[rel] ?? 0);
  }
  if (score > 6) score = 6;
  if (score < -6) score = -6;
  return score;
}

// Проверка, является ли кот королём
export function isKing(mood) {
  return mood >= 6;
}
