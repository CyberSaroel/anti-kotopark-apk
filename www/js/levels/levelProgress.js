// Прогресс прохождения уровней — в localStorage браузера.
const KEY = "socio-cats:completed";

export function getCompleted() {
  try { return new Set(JSON.parse(localStorage.getItem(KEY) || "[]")); }
  catch { return new Set(); }
}

export function isCompleted(id) { return getCompleted().has(id); }

export function markCompleted(id) {
  const s = getCompleted();
  s.add(id);
  localStorage.setItem(KEY, JSON.stringify([...s]));
}

export function resetProgress() { localStorage.removeItem(KEY); }
