export function bindCellInteraction(cell, handler) {
  let touchHandled = false;

  cell.addEventListener("touchend", (e) => {
    // NB: touchend НЕ отменяем (cancelable=false), поэтому preventDefault() тут
    // бессмысленен и вызывает intervention-предупреждение в консоли Chrome.
    // Защита от двойного срабатывания — через флаг touchHandled ниже.
    touchHandled = true;
    handler();
    setTimeout(() => {
      touchHandled = false;
    }, 450);
  }, { passive: false });

  cell.addEventListener("click", () => {
    if (touchHandled) return;
    handler();
  });
}
