import { Board } from "./board.js";
import { canMove, applyMove } from "./movement.js";
import { isWin } from "./victory.js";
import { calcMood } from "../socionics/mood.js";

// Контроллер состояния игры. Не знает про DOM (рисует renderer.js).
export class Game {
  constructor(level) {
    this.level = level;
    this.board = Board.fromLevel(level);
    this.selected = null;
    this.moveCount = 0;
  }

  moodAt(r, c)     { return calcMood(this.board, r, c); }
  isSelected(r, c) { return !!this.selected && this.selected.r === r && this.selected.c === c; }
  isTarget(r, c)   { return !!this.selected && canMove(this.board, this.selected, { r, c }); }
  isWin()          { return isWin(this.board); }
  getMoveCount()   { return this.moveCount; }

  // Обработка клика по клетке. Возвращает объект { needRedraw: boolean, moved: boolean }.
  clickCell(r, c) {
    if (this.selected) {
      if (this.board.isCat(r, c)) {
        // Если клик на того же кота - снять выделение
        if (this.selected.r === r && this.selected.c === c) {
          this.selected = null;
          return { needRedraw: true, moved: false };
        }
        this.selected = { r, c };                          // выбрать другого кота
        return { needRedraw: true, moved: false };
      } else if (canMove(this.board, this.selected, { r, c })) {
        applyMove(this.board, this.selected, { r, c });    // сделать ход
        this.moveCount++;
        this.selected = { r, c };                          // сохранить выделение на новой позиции
        return { needRedraw: true, moved: true };
      } else {
        this.selected = null;                              // снять выделение
        return { needRedraw: true, moved: false };
      }
    }
    if (this.board.isCat(r, c)) {
      this.selected = { r, c };                            // выбрать кота
      return { needRedraw: true, moved: false };
    }
    return { needRedraw: false, moved: false };
  }
}
