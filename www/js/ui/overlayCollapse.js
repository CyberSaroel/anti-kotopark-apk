// Кнопка "Свернуть" внутри полноэкранного окна результата (победа/импичмент)
// + кнопка "Развернуть" отдельным fixed-элементом поверх игры.
// Сворачивание убирает оверлей из рендера (display:none) — топбар
// (← Предыдущий / Следующий → / Покинуть уровень) становится кликабельным
// без правок в pointer-events и без пересчёта раскладки доски.

export function attachCollapseToggle(root, overlay, { icon = "", label = "Результат", onCollapse, onExpand } = {}) {
  const collapseBtn = document.createElement("button");
  collapseBtn.className = "result-collapse-btn";
  collapseBtn.textContent = "Свернуть";
  collapseBtn.setAttribute("data-compact", "−");
  collapseBtn.setAttribute("aria-label", `Свернуть окно: ${label}`);

  const reopenBtn = document.createElement("button");
  reopenBtn.className = "result-reopen-btn";
  reopenBtn.textContent = `${icon ? icon + " " : ""}Развернуть`;
  reopenBtn.setAttribute("aria-label", `Развернуть окно: ${label}`);
  reopenBtn.style.display = "none";

  function collapse() {
    overlay.style.display = "none";
    reopenBtn.style.display = "block";
    onCollapse?.();
  }

  function expand() {
    overlay.style.display = "";
    reopenBtn.style.display = "none";
    onExpand?.();
  }

  collapseBtn.addEventListener("click", collapse);
  reopenBtn.addEventListener("click", expand);

  overlay.prepend(collapseBtn);
  root.appendChild(reopenBtn);
}
