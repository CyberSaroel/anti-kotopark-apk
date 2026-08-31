/**
 * Универсальная анимация изменения счётчиков (адаптация boost-float/boost-glow
 * из royal-socio-cats). Использует ТЕ ЖЕ CSS-классы и keyframes:
 * - положительное изменение  → золотая рамка boost-glow + золотой текст boost-float
 * - отрицательное изменение  → красная рамка boost-glow-red + красный текст boost-float-red
 *
 * Красные классы — зеркальные копии золотых (та же структура, длительность,
 * форма появления/исчезновения), отличаются только цветом (требование anti-kotopark).
 */

/**
 * Показать вспышку рамки и всплывающий текст над элементом-счётчиком.
 * @param {HTMLElement} el — элемент .stat-item (или любой другой), над которым анимация
 * @param {string} text — текст бонуса/штрафа, например "+10" или "-5"
 * @param {boolean} positive — true = золотая (бонус), false = красная (штраф)
 */
export function showStatBoost(el, text, positive = true) {
  if (!el) return;
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return;

  // Золотая/красная рамка вокруг счётчика (поверх, но под текстом)
  const glow = document.createElement("div");
  glow.className = positive ? "boost-glow" : "boost-glow-red";
  glow.style.left = rect.left + "px";
  glow.style.top = rect.top + "px";
  glow.style.width = rect.width + "px";
  glow.style.height = rect.height + "px";
  document.body.appendChild(glow);
  glow.addEventListener("animationend", () => glow.remove());

  // Всплывающий текст "+N" / "-N"
  const float = document.createElement("div");
  float.className = positive ? "boost-float" : "boost-float-red";
  float.textContent = text;
  float.style.left = (rect.left + rect.width / 2) + "px";
  float.style.top = rect.top + "px";
  document.body.appendChild(float);
  float.addEventListener("animationend", () => float.remove());
}

/**
 * Найти .stat-item внутри блока статистики по подстроке его текста.
 * @param {HTMLElement} statsEl — контейнер статистики (#stats)
 * @param {string} word — подстрока, например "Ходы", "Время", "Короли"
 * @returns {HTMLElement|null}
 */
export function findStatItem(statsEl, word) {
  if (!statsEl) return null;
  const items = Array.from(statsEl.querySelectorAll(".stat-item"));
  return items.find((el) => el.textContent.includes(word)) || null;
}