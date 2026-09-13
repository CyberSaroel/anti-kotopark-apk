// Победа: у ВСЕХ котов настроение >= +1 (все зелёные).
// Используем кэширующий board.moodAt(): один и тот же mood переиспользуется
// между отрисовкой, HUD и проверкой победы в пределах одного хода.
export function isWin(board) {
  const cats = board.allCats();
  for (let i = 0; i < cats.length; i++) {
    if (board.moodAt(cats[i].r, cats[i].c) < 1) return false;
  }
  return true;
}

// Сколько котов ещё не зелёные (для подсказок/прогресса).
export function unhappyCount(board) {
  const cats = board.allCats();
  let n = 0;
  for (let i = 0; i < cats.length; i++) {
    if (board.moodAt(cats[i].r, cats[i].c) < 1) n++;
  }
  return n;
}
