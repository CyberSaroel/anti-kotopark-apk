import { Board } from "./board.js";
import { canMove, applyMove } from "./movement.js";
import { calcMood } from "../socionics/mood.js";
import { TYPES } from "../socionics/types.js";

// Game controller for Anti-Kotopark mode
export class AntiGame {
  constructor(level) {
    this.level = level;
    this.board = Board.fromLevel(level);
    this.selected = null;
    this.moveCount = 0;
    
    // Track guessed sociotypes: map of cat index -> guessed type or null
    this.guessedTypes = new Map();
    
    // Cats with initially known types: first `knownCats` cats in the list.
    // Default is 1 (level 10 behavior); levels 11-21 set knownCats: 5.
    this.knownCatIndex = 0;
    const knownCats = level.knownCats || 1;
    const knownCount = Math.min(knownCats, level.cats.length);
    for (let i = 0; i < knownCount; i++) {
      const cat = level.cats[i];
      if (cat) {
        this.guessedTypes.set(i, cat.type);
      }
    }
    
    // Assign numbers to cats (1-10)
    this.catNumbers = new Map();
    level.cats.forEach((cat, index) => {
      this.catNumbers.set(`${cat.r},${cat.c}`, index + 1);
    });
  }

  moodAt(r, c) { return calcMood(this.board, r, c); }
  isSelected(r, c) { return !!this.selected && this.selected.r === r && this.selected.c === c; }
  isTarget(r, c) { return !!this.selected && canMove(this.board, this.selected, { r, c }); }
  getMoveCount() { return this.moveCount; }

  getCatNumber(r, c) {
    return this.catNumbers.get(`${r},${c}`) || null;
  }

  getCatIndex(r, c) {
    const num = this.getCatNumber(r, c);
    return num ? num - 1 : null;
  }

  isTypeKnown(catIndex) {
    return this.guessedTypes.has(catIndex) && this.guessedTypes.get(catIndex) !== null;
  }

  getGuessedType(catIndex) {
    return this.guessedTypes.get(catIndex);
  }

  getActualType(catIndex) {
    if (catIndex < this.level.cats.length) {
      return this.level.cats[catIndex].type;
    }
    return null;
  }

  // Check if guessed type is correct
  checkGuess(catIndex, guessedType) {
    const actualType = this.getActualType(catIndex);
    return actualType === guessedType;
  }

  // Make a guess for a cat's sociotype
  makeGuess(catIndex, guessedType) {
    const actualType = this.getActualType(catIndex);
    const isCorrect = actualType === guessedType;
    
    if (isCorrect) {
      this.guessedTypes.set(catIndex, guessedType);
    }
    
    return { correct: isCorrect, actualType };
  }

  // Check win condition: all cats are happy ("green", mood >= 1)
  isWin() {
    for (const cat of this.board.allCats()) {
      if (this.moodAt(cat.r, cat.c) < 1) return false;
    }
    return true;
  }

  // Get count of correctly guessed types
  getGuessedCount() {
    let count = 0;
    for (let i = 0; i < this.level.cats.length; i++) {
      if (this.isTypeKnown(i)) count++;
    }
    return count;
  }

  // Открыть типы всех котов (тестовая кнопка для заказчика).
  // Все коты на поле помечаются «угаданными» — их социотипы показываются.
  revealAllTypes() {
    for (let i = 0; i < this.level.cats.length; i++) {
      const cat = this.level.cats[i];
      if (cat) this.guessedTypes.set(i, cat.type);
    }
  }

  // Handle cell click
  clickCell(r, c) {
    if (this.selected) {
      if (this.board.isCat(r, c)) {
        if (this.selected.r === r && this.selected.c === c) {
          this.selected = null;
          return { needRedraw: true, moved: false };
        }
        this.selected = { r, c };
        return { needRedraw: true, moved: false };
      } else if (canMove(this.board, this.selected, { r, c })) {
        applyMove(this.board, this.selected, { r, c });
        this.moveCount++;
        
        // Update cat number mapping after move
        const catNum = this.catNumbers.get(`${this.selected.r},${this.selected.c}`);
        if (catNum) {
          this.catNumbers.delete(`${this.selected.r},${this.selected.c}`);
          this.catNumbers.set(`${r},${c}`, catNum);
        }
        
        this.selected = { r, c };
        return { needRedraw: true, moved: true };
      } else {
        this.selected = null;
        return { needRedraw: true, moved: false };
      }
    }
    if (this.board.isCat(r, c)) {
      this.selected = { r, c };
      return { needRedraw: true, moved: false };
    }
    return { needRedraw: false, moved: false };
  }
}
