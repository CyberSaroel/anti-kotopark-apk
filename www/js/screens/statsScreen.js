import { getKingsTotal, getRockets } from "../core/royalEconomy.js";
import { getAllRecords } from "../levels/levelRecords.js";
import { audioManager } from "../core/audioManager.js";
import NavigationService from "../core/navigation.js";

export function showStatsScreen(root) {
  root.innerHTML = "";

  const h = document.createElement("h1");
  h.textContent = "📊 Статистика за игру";
  root.appendChild(h);

  const backBtn = document.createElement("button");
  backBtn.className = "back-btn";
  backBtn.textContent = "← Вернуться к выбору уровня";
  backBtn.addEventListener("click", () => {
    audioManager.playSoundEffect("assets/sounds/click.mp3");
    NavigationService.goBack();
  });
  root.appendChild(backBtn);

  const kingsTotal = getKingsTotal();
  const rockets = getRockets();
  const records = getAllRecords();
  const levelsDone = Object.keys(records).length;
  const bestKings = Object.values(records).reduce((max, r) => (r.kings !== undefined && r.kings > max ? r.kings : max), 0);

  const statsGrid = document.createElement("div");
  statsGrid.className = "row g-2 stats-grid";

  const statCards = [
    { label: "👑 Королей всего", value: kingsTotal },
    { label: "🐠 Рыбок сейчас", value: rockets },
    { label: "✅ Пройдено уровней", value: levelsDone },
    { label: "🏅 Рекорд королей за уровень", value: bestKings }
  ];

  for (const card of statCards) {
    const col = document.createElement("div");
    col.className = "col-6 col-sm-3";
    
    const cardInner = document.createElement("div");
    cardInner.className = "stat-item stats-card";
    cardInner.innerHTML = `
      <div>${card.label}</div>
      <div style="font-size: 1.5em; font-weight: bold; margin-top: 4px;">${card.value}</div>
    `;
    
    col.appendChild(cardInner);
    statsGrid.appendChild(col);
  }

  root.appendChild(statsGrid);

  if (levelsDone === 0) {
    const emptyMsg = document.createElement("p");
    emptyMsg.textContent = "Пока нет данных. Пройдите первый уровень!";
    emptyMsg.style.textAlign = "center";
    emptyMsg.style.marginTop = "20px";
    root.appendChild(emptyMsg);
  }

  NavigationService.saveCurrentRender(() => showStatsScreen(root));
}
