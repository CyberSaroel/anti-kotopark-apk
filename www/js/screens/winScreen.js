// Экран победы поверх поля. Использует assets/ui/level_complete.png.
import { audioManager } from "../core/audioManager.js";
import { formatTime } from "../core/levelTimer.js";
import { getVictorySoundPath } from "./victorySoundSelect.js";
import { attachCollapseToggle } from "../ui/overlayCollapse.js";
import NavigationService from "../core/navigation.js";

function pluralMoves(n) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "ход";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "хода";
  return "ходов";
}

function formatMovesRecord(n) {
  return `${n} ${pluralMoves(n)}`;
}

function buildMoveDetail(current, record) {
  const { isNewRecord, improvement, previousBest } = record;

  if (isNewRecord && previousBest === undefined) {
    return "Первое прохождение — рекорд установлен";
  }
  if (isNewRecord && previousBest !== undefined) {
    return `Было ${previousBest} → стало ${current} (−${improvement} ${pluralMoves(improvement)})`;
  }
  if (previousBest !== undefined) {
    return `Ваш рекорд: ${formatMovesRecord(previousBest)}`;
  }
  return "";
}

function buildTimeDetail(currentMs, record) {
  const { isNewRecord, improvement, previousBest } = record;

  if (isNewRecord && previousBest === undefined) {
    return "Первое прохождение — рекорд установлен";
  }
  if (isNewRecord && previousBest !== undefined) {
    return `Было ${formatTime(previousBest)} → стало ${formatTime(currentMs)} (−${formatTime(improvement)})`;
  }
  if (previousBest !== undefined) {
    return `Ваш рекорд: ${formatTime(previousBest)}`;
  }
  return "";
}

function buildKingsDetail(current, record) {
  const { isNewRecord, improvement, previousBest } = record;

  if (isNewRecord && previousBest === undefined) {
    return "Первое прохождение — рекорд установлен";
  }
  if (isNewRecord && previousBest !== undefined) {
    return `Было ${previousBest} → стало ${current} (+${improvement})`;
  }
  if (previousBest !== undefined) {
    return `Ваш рекорд: ${previousBest}`;
  }
  return "";
}

function buildStatRow({ label, value, detail, isNewRecord }) {
  const row = document.createElement("div");
  row.className = "win-stat-row";

  const header = document.createElement("div");
  header.className = "win-stat-header";

  const labelEl = document.createElement("span");
  labelEl.className = "win-stat-label";
  labelEl.textContent = label;
  header.appendChild(labelEl);

  if (isNewRecord) {
    const badge = document.createElement("span");
    badge.className = "win-stat-badge";
    badge.textContent = "🏆 Новый рекорд";
    header.appendChild(badge);
  }

  const valueEl = document.createElement("div");
  valueEl.className = "win-stat-value";
  valueEl.textContent = value;

  row.appendChild(header);
  row.appendChild(valueEl);

  if (detail) {
    const detailEl = document.createElement("div");
    detailEl.className = "win-stat-detail";
    detailEl.textContent = detail;
    row.appendChild(detailEl);
  }

  return row;
}

function buildWinStats(moveCount, timeMs, moveRecord, timeRecord, kingsThisLevel, kingsRecord, rocketsTotal, rocketsGained, bonusErrors) {
  const stats = document.createElement("div");
  stats.className = "win-stats";

  stats.appendChild(buildStatRow({
    label: "Ходы",
    value: String(moveCount),
    detail: buildMoveDetail(moveCount, moveRecord),
    isNewRecord: moveRecord.isNewRecord
  }));

  stats.appendChild(buildStatRow({
    label: "Время",
    value: formatTime(timeMs),
    detail: buildTimeDetail(timeMs, timeRecord),
    isNewRecord: timeRecord.isNewRecord
  }));

  if (kingsThisLevel !== undefined) {
    stats.appendChild(buildStatRow({
      label: "Короли",
      value: String(kingsThisLevel),
      detail: buildKingsDetail(kingsThisLevel, kingsRecord),
      isNewRecord: kingsRecord ? kingsRecord.isNewRecord : false
    }));
  }

  if (bonusErrors > 0) {
    stats.appendChild(buildStatRow({
      label: "Право на ошибку",
      value: `+${bonusErrors}`,
      detail: "за каждые 3 короля"
    }));
  }

  if (rocketsTotal !== undefined) {
    stats.appendChild(buildStatRow({
      label: "Рыбок получено",
      value: `+${rocketsGained}`
    }));
  }

  if (rocketsTotal !== undefined) {
    stats.appendChild(buildStatRow({
      label: "Рыбок всего",
      value: String(rocketsTotal)
    }));
  }

  return stats;
}

export function showWinScreen(root, level, {
  moveCount,
  timeMs,
  moveRecord,
  timeRecord,
  kingsThisLevel,
  kingsRecord,
  kingsTotal,
  rocketsTotal,
  rocketsGained,
  bonusErrors = 0,
  nextLabel = "Следующий уровень",
  menuLabel = "К выбору уровня",
  onNext,
  onMenu
}) {
  const overlay = document.createElement("div");
  overlay.id = "win-screen";

  const img = document.createElement("img");
  img.src = "assets/ui/level_complete.png";
  img.alt = "Уровень пройден";

  const title = document.createElement("div");
  title.className = "win-title";
  title.textContent = "🎉 Все коты зелёные! Уровень пройден";

  const stats = buildWinStats(moveCount, timeMs, moveRecord, timeRecord, kingsThisLevel, kingsRecord, rocketsTotal, rocketsGained, bonusErrors);

  const btns = document.createElement("div");
  btns.style.display = "flex";
  btns.style.gap = "10px";
  btns.style.justifyContent = "center";
  const next = document.createElement("button");
  next.className = "win-btn";
  next.textContent = nextLabel;
  next.addEventListener("click", () => {
    audioManager.playSoundEffect("assets/sounds/click.mp3");
    overlay.remove();
    onNext();
  });
  const menu = document.createElement("button");
  menu.className = "win-btn";
  menu.textContent = menuLabel;
  menu.addEventListener("click", () => {
    audioManager.playSoundEffect("assets/sounds/click.mp3");
    overlay.remove();
    onMenu();
  });
  btns.appendChild(next);
  btns.appendChild(menu);

  overlay.appendChild(img);
  overlay.appendChild(title);
  overlay.appendChild(stats);
  overlay.appendChild(btns);
  root.appendChild(overlay);

  NavigationService.openModal();

  // Hardware/browser back button while this modal is open:
  // same action as "К выбору уровня" button
  NavigationService.setOnModalBack(() => {
    overlay.remove();
    NavigationService.closeModal();
    onMenu();
  });

  attachCollapseToggle(root, overlay, { icon: "🏆", label: "Победа" });

  audioManager.playSoundEffect(getVictorySoundPath());
  fireConfetti();
  
  // Fire king rain if new kings record
  if (kingsRecord && kingsRecord.isNewRecord) {
    fireKingRain();
  }

  // Stop victory sound when clicking buttons
  next.addEventListener("click", () => {
    NavigationService.closeModal();
    if (audioManager.victorySfx) {
      audioManager.victorySfx.pause();
      audioManager.victorySfx = null;
    }
  });
  menu.addEventListener("click", () => {
    NavigationService.closeModal();
    if (audioManager.victorySfx) {
      audioManager.victorySfx.pause();
      audioManager.victorySfx = null;
    }
  });
}

function fireConfetti() {
  const canvas = document.createElement("canvas");
  canvas.id = "confetti-canvas";
  canvas.style.position = "fixed";
  canvas.style.top = "0";
  canvas.style.left = "0";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.pointerEvents = "none";
  canvas.style.zIndex = "9999";
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const particles = [];
  const colors = [
    "#ff0000",
    "#00ff00",
    "#0000ff",
    "#ffff00",
    "#ff00ff",
    "#00ffff",
    "#ff6b6b",
    "#4ecdc4",
    "#45b7d1",
    "#f9ca24"
  ];

  for (let i = 0; i < 150; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height - canvas.height,
      vx: (Math.random() - 0.5) * 10,
      vy: Math.random() * 5 + 5,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: Math.random() * 8 + 4,
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 10
    });
  }

  let animationId;
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.2;
      p.rotation += p.rotationSpeed;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation * Math.PI / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
    });

    for (let i = particles.length - 1; i >= 0; i--) {
      if (particles[i].y > canvas.height + 50) {
        particles.splice(i, 1);
      }
    }

  if (particles.length > 0) {
    animationId = requestAnimationFrame(animate);
  } else {
    canvas.remove();
  }
  }

  animate();

  const overlay = document.getElementById("win-screen");
  if (overlay) {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.removedNodes.length > 0) {
          cancelAnimationFrame(animationId);
          canvas.remove();
          observer.disconnect();
        }
      });
    });
    observer.observe(overlay.parentNode, { childList: true });
  }
}

function fireKingRain() {
  const container = document.createElement("div");
  container.className = "king-rain";
  document.body.appendChild(container);

  const count = 8 + Math.floor(Math.random() * 5); // 8-12 items
  const stats = document.querySelector(".win-stats");
  const startX = stats ? stats.getBoundingClientRect().left : window.innerWidth / 2;
  const endX = stats ? stats.getBoundingClientRect().right : window.innerWidth;

  for (let i = 0; i < count; i++) {
    const item = document.createElement("div");
    item.className = "king-rain-item";
    item.textContent = "👑";
    const left = startX + (Math.random() * (endX - startX));
    const delay = Math.random() * 0.5;
    const duration = 1.2 + Math.random() * 0.6; // 1.2-1.8s
    item.style.left = left + "px";
    item.style.top = (-30 - Math.random() * 30) + "px";
    item.style.animationDelay = delay + "s";
    item.style.animationDuration = duration + "s";
    container.appendChild(item);
  }

  // Clean up when animation ends
  const cleanup = () => {
    container.remove();
  };
  
  // Use the longest possible animation time
  setTimeout(cleanup, 2500);
  
  // Also clean up when win screen is removed
  const winScreen = document.getElementById("win-screen");
  if (winScreen) {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.removedNodes.length > 0) {
          cleanup();
          observer.disconnect();
        }
      });
    });
    observer.observe(winScreen.parentNode, { childList: true });
  }
}
