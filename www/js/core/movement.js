// Кот ходит ровно на 1 соседнюю ПУСТУЮ клетку по 8 направлениям.
// Запрещено: дальше 1 клетки, на воду, на занятую клетку, обмен местами.
export function canMove(board, from, to) {
  if (!board.isCat(from.r, from.c)) return false;          // в from должен стоять кот
  if (!board.inBounds(to.r, to.c)) return false;           // цель в пределах поля
  const dr = Math.abs(to.r - from.r);
  const dc = Math.abs(to.c - from.c);
  if (Math.max(dr, dc) !== 1) return false;                // ровно 1 клетка (диагональ ок)
  if (!board.isEmpty(to.r, to.c)) return false;            // только пустая (не вода, не кот) => нет обмена
  return true;
}

export function applyMove(board, from, to) {
  if (!canMove(board, from, to)) return false;
  board.moveCat(from, to);
  return true;
}

// Диагональ разрешена ВСЕГДА, даже если смежные ортогональные клетки — вода.
// (Вода не блокирует «угол» — отдельной проверки не требуется.)
