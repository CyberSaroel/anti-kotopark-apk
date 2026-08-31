export function bindCellInteraction(cell, handler) {
  let touchHandled = false;

  cell.addEventListener("touchend", (e) => {
    e.preventDefault();
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
