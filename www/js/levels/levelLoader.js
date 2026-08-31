export function levelPath(id) {
  return `json/levels/level${String(id).padStart(3, "0")}.json`;
}

export async function fetchManifest() {
  const res = await fetch("json/levels/manifest.json");
  if (!res.ok) throw new Error("Не удалось загрузить manifest.json (запустите через локальный сервер).");
  return res.json();
}

export async function fetchLevel(id) {
  const res = await fetch(levelPath(id));
  if (!res.ok) throw new Error(`Не удалось загрузить уровень ${id} (запустите через локальный сервер).`);
  const level = await res.json();
  validateLevel(level);
  return level;
}

// Проверка корректности уровня (структура, не решаемость).
export function validateLevel(level) {
  const { rows, cols, cats = [], water = [] } = level;
  if (!Number.isInteger(rows) || !Number.isInteger(cols)) {
    throw new Error("Уровень: rows/cols должны быть целыми");
  }
  const occ = new Set();
  for (const [r, c] of water) {
    if (r < 0 || r >= rows || c < 0 || c >= cols) throw new Error("Вода вне поля: " + r + "," + c);
    occ.add(r + "," + c);
  }
  for (const cat of cats) {
    if (cat.r < 0 || cat.r >= rows || cat.c < 0 || cat.c >= cols)
      throw new Error("Кот вне поля: " + cat.r + "," + cat.c);
    const key = cat.r + "," + cat.c;
    if (occ.has(key)) throw new Error("Кот на воде или дубликат позиции: " + key);
    occ.add(key);
  }
  return true;
}
