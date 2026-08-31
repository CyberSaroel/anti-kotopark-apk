import { calcMood } from "../socionics/mood.js";

// Победа: у ВСЕХ котов настроение >= +1 (все зелёные).
export function isWin(board) {
  return board.allCats().every(({ r, c }) => calcMood(board, r, c) >= 1);
}

// Сколько котов ещё не зелёные (для подсказок/прогресса).
export function unhappyCount(board) {
  return board.allCats().filter(({ r, c }) => calcMood(board, r, c) < 1).length;
}
