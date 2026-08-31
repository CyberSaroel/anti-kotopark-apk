import { getAllRecords } from "../levels/levelRecords.js";
import { getKingsTotal, getRockets } from "../core/royalEconomy.js";
import { getTotalMoves, getTotalTimeMs } from "../core/gameStats.js";
import { audioManager } from "../core/audioManager.js";
import { formatTime } from "../core/levelTimer.js";
import NavigationService from "../core/navigation.js";

export function showRecordsScreen(root) {
  root.innerHTML = "";

  const h = document.createElement("h1");
  h.textContent = "🏆 Рекорды и статистика";
  root.appendChild(h);

  const backBtn = document.createElement("button");
  backBtn.className = "back-btn";
  backBtn.textContent = "← Вернуться к выбору уровня";
  backBtn.addEventListener("click", () => {
    audioManager.playSoundEffect("assets/sounds/click.mp3");
    NavigationService.goBack();
  });
  root.appendChild(backBtn);

  const p = document.createElement("p");
  p.textContent = "Ваши лучшие результаты по уровням";
  root.appendChild(p);

  // Всего добыто королей за всю игру
  const kingsTotalBanner = document.createElement("div");
  kingsTotalBanner.className = "kings-total-banner";
  kingsTotalBanner.textContent = `👑 Всего добыто королей за игру: ${getKingsTotal()}`;
  root.appendChild(kingsTotalBanner);

  const movesTotalBanner = document.createElement("div");
  movesTotalBanner.className = "kings-total-banner";
  movesTotalBanner.textContent = `🎯 Всего потраченных ходов: ${getTotalMoves()}`;
  root.appendChild(movesTotalBanner);

  const timeTotalBanner = document.createElement("div");
  timeTotalBanner.className = "kings-total-banner";
  timeTotalBanner.textContent = `⏱️ Всего потраченного времени: ${formatTime(getTotalTimeMs())}`;
  root.appendChild(timeTotalBanner);

  // === Данные из бывшего экрана «Статистика» ===
  const statsRecords = getAllRecords();
  const levelsDone = Object.keys(statsRecords).length;
  const bestKings = Object.values(statsRecords).reduce((max, r) => (r.kings !== undefined && r.kings > max ? r.kings : max), 0);

  const rocketsBanner = document.createElement("div");
  rocketsBanner.className = "kings-total-banner";
  rocketsBanner.textContent = `🐠 Рыбок сейчас: ${getRockets()}`;
  root.appendChild(rocketsBanner);

  const levelsDoneBanner = document.createElement("div");
  levelsDoneBanner.className = "kings-total-banner";
  levelsDoneBanner.textContent = `✅ Пройдено уровней: ${levelsDone}`;
  root.appendChild(levelsDoneBanner);

  const bestKingsBanner = document.createElement("div");
  bestKingsBanner.className = "kings-total-banner";
  bestKingsBanner.textContent = `🏅 Рекорд королей за уровень: ${bestKings}`;
  root.appendChild(bestKingsBanner);

  const tableContainer = document.createElement("div");
  tableContainer.className = "records-table-container";
  root.appendChild(tableContainer);

  const table = document.createElement("table");
  table.className = "records-table";
  
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  headerRow.innerHTML = `
    <th>Уровень</th>
    <th>Ходы</th>
    <th>Время</th>
    <th>Короли</th>
  `;
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  const records = getAllRecords();
  
  // Sort by level ID
  const sortedLevelIds = Object.keys(records).map(Number).sort((a, b) => a - b);
  
  if (sortedLevelIds.length === 0) {
    const emptyRow = document.createElement("tr");
    const emptyCell = document.createElement("td");
    emptyCell.colSpan = 4;
    emptyCell.textContent = "Пока нет рекордов. Пройдите уровни!";
    emptyRow.appendChild(emptyCell);
    tbody.appendChild(emptyRow);
  } else {
    for (const levelId of sortedLevelIds) {
      const entry = records[levelId];
      const moves = entry.moves !== undefined ? entry.moves : "—";
      const time = entry.timeMs !== undefined ? formatTime(entry.timeMs) : "—";
      const kings = entry.kings !== undefined ? entry.kings : "—";
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>Уровень ${levelId}</td>
        <td>${moves}</td>
        <td>${time}</td>
        <td>${kings}</td>
      `;
      tbody.appendChild(row);
    }
  }
  
  table.appendChild(tbody);
  tableContainer.appendChild(table);

  NavigationService.saveCurrentRender(() => showRecordsScreen(root));
}