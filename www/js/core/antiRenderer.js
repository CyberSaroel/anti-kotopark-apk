import { getSelectedSkin } from "../screens/skinSelect.js";
import { fitBoardToViewport } from "./boardLayout.js";
import { bindCellInteraction } from "../ui/cellInteraction.js";
import { getTypeDisplayName } from "../socionics/types.js";

let skinPath = null;
let imagesPreloaded = false;

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

// Уменьшить шрифт подписи, чтобы имя социотипа помещалось в одну строку
function fitTypeLabel(label) {
  requestAnimationFrame(() => {
    const cellEl = label.closest(".cell");
    if (!cellEl) return;
    const maxW = cellEl.clientWidth - 6;
    if (maxW <= 0) return;
    let fs = parseFloat(getComputedStyle(label).fontSize) || 11;
    let attempts = 0;
    while (label.scrollWidth > maxW && fs > 7 && attempts < 12) {
      fs -= 0.5;
      label.style.fontSize = `${fs}px`;
      attempts++;
    }
  });
}

// Render board for Anti-Kotopark mode with cat numbers and sociotype display
export async function renderAntiBoard(container, game, onCell, onCatClick) {
  if (!skinPath) skinPath = await loadSkinPath();
  preloadCatImages();

  const board = game.board;
  container.innerHTML = "";
  container.style.setProperty("--rows", board.rows);
  container.style.setProperty("--cols", board.cols);

  for (let r = 0; r < board.rows; r++) {
    for (let c = 0; c < board.cols; c++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      let catIndex = null;

      if (board.isWater(r, c)) cell.classList.add("water");
      else if (board.isEmpty(r, c)) cell.classList.add("empty");

      if (game.isSelected(r, c)) cell.classList.add("selected");
      if (game.isTarget(r, c)) cell.classList.add("target");

      let typeLabel = null;

      if (board.isCat(r, c)) {
        const mood = game.moodAt(r, c);
        cell.dataset.mood = String(mood);
        
        const catNum = game.getCatNumber(r, c);
        catIndex = game.getCatIndex(r, c);

        // Клик/тап по коту или его подписи открывает меню социотипов.
        // На сенсорных экранах после touchend браузер шлёт эмуляционный click,
        // поэтому используем флаг, чтобы не вызвать обработчик дважды.
        let touchUsed = false;
        const fireCatClick = () => {
          if (onCatClick && catIndex !== null && !game.isTypeKnown(catIndex)) {
            onCatClick(catIndex, r, c);
          }
        };
        const guardClick = () => {
          if (touchUsed) {
            touchUsed = false;
            return;
          }
          fireCatClick();
        };

        // Cat image
        const img = document.createElement("img");
        img.className = "cat";
        const imgUrl = skinPath.replace("{mood}", mood);
        img.src = imgUrl;
        img.alt = String(mood);
        
        // Cat number in top-right corner
        const numberBadge = document.createElement("div");
        numberBadge.className = "cat-number";
        numberBadge.textContent = catNum;
        
        // Sociotype display (or ? for unknown) at bottom
        typeLabel = document.createElement("div");
        typeLabel.className = "cat-type-label";
        
        if (game.isTypeKnown(catIndex)) {
          const typeName = game.getGuessedType(catIndex);
          typeLabel.textContent = getTypeDisplayName(typeName);
          typeLabel.classList.add("known");
          // Bootstrap-утилиты (vendor): переносим длинные имена социотипов
          // по словам и внутри слов, чтобы текст не обрезался на узких экранах
          typeLabel.classList.add("text-wrap", "text-break");
          fitTypeLabel(typeLabel);
        } else {
          typeLabel.textContent = "?";
          typeLabel.classList.add("unknown");
          // Неизвестный тип: подпись работает как кнопка (свечение, hover, tap)
          typeLabel.classList.add("cat-type-btn-label");
        }

        cell.appendChild(img);
        cell.appendChild(numberBadge);
        cell.appendChild(typeLabel);
        
        // Интерактивная подпись социотипа: работает как кнопка
        typeLabel.addEventListener("click", (e) => {
          e.stopPropagation();
          guardClick();
        });
        // Общий таймер сброса флага (как в cellInteraction: 450 мс)
        const markTouch = () => {
          touchUsed = true;
          setTimeout(() => { touchUsed = false; }, 500);
        };

        typeLabel.addEventListener("touchend", (e) => {
          e.preventDefault();
          e.stopPropagation();
          markTouch();
          fireCatClick();
          typeLabel.classList.add("cat-type-label--tap");
          setTimeout(() => typeLabel.classList.remove("cat-type-label--tap"), 300);
        }, { passive: false });
        
        // Кот целиком кликабелен (и на сенсорных экранах)
        cell.addEventListener("click", (e) => {
          e.stopPropagation();
          guardClick();
        });
        cell.addEventListener("touchend", (e) => {
          e.preventDefault();
          e.stopPropagation();
          markTouch();
          fireCatClick();
        }, { passive: false });
      }

      const rr = r, cc = c;
      // Кот с неизвестным типом (подпись "?"): клик/тап полностью обрабатывает
      // onCatClick (первый тап — выбор, второй — меню). onCell вызывать нельзя:
      // clickCell получит повторный клик по только что выбранному коту и сбросит
      // game.selected, из-за чего такого кота невозможно передвинуть.
      if (catIndex === null || game.isTypeKnown(catIndex)) {
        bindCellInteraction(cell, () => onCell(rr, cc));
      }
      container.appendChild(cell);
      if (typeLabel) fitTypeLabel(typeLabel);
    }
  }

  fitBoardToViewport(container, board.rows, board.cols);
}

export function resetSkinCache() {
  skinPath = null;
  imagesPreloaded = false;
}
