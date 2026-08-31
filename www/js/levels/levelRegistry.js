/**
 * Реестр уровней 10–100 (план v4/v5).
 *
 * - Уровень 10 — «Антикотопарк» (главный, запускается кнопкой «Начать игру»).
 * - Уровни 1–9 НЕ существуют (выключены).
 * - Уровни 11–100 — «Антикотопарк»: используют ту же логику, что уровень 10,
 *   конфигурация загружается из json/levels/levelNNN.json.
 */

export const LEVELS = {
  // 1–9: не существуют
  10: { id: 10, title: "Антикотопарк", enabled: true, mode: "anti" },
  11: { id: 11, title: "Уровень 11", enabled: true, mode: "anti" },
  12: { id: 12, title: "Уровень 12", enabled: true, mode: "anti" },
  13: { id: 13, title: "Уровень 13", enabled: true, mode: "anti" },
  14: { id: 14, title: "Уровень 14", enabled: true, mode: "anti" },
  15: { id: 15, title: "Уровень 15", enabled: true, mode: "anti" },
  16: { id: 16, title: "Уровень 16", enabled: true, mode: "anti" },
  17: { id: 17, title: "Уровень 17", enabled: true, mode: "anti" },
  18: { id: 18, title: "Уровень 18", enabled: true, mode: "anti" },
  19: { id: 19, title: "Уровень 19", enabled: true, mode: "anti" },
  20: { id: 20, title: "Уровень 20", enabled: true, mode: "anti" },
  21: { id: 21, title: "Уровень 21", enabled: true, mode: "anti" },
  22: { id: 22, title: "Уровень 22", enabled: true, mode: "anti" },
  23: { id: 23, title: "Уровень 23", enabled: true, mode: "anti" },
  24: { id: 24, title: "Уровень 24", enabled: true, mode: "anti" },
  25: { id: 25, title: "Уровень 25", enabled: true, mode: "anti" },
  26: { id: 26, title: "Уровень 26", enabled: true, mode: "anti" },
  27: { id: 27, title: "Уровень 27", enabled: true, mode: "anti" },
  28: { id: 28, title: "Уровень 28", enabled: true, mode: "anti" },
  29: { id: 29, title: "Уровень 29", enabled: true, mode: "anti" },
  30: { id: 30, title: "Уровень 30", enabled: true, mode: "anti" },
  31: { id: 31, title: "Уровень 31", enabled: true, mode: "anti" },
  32: { id: 32, title: "Уровень 32", enabled: true, mode: "anti" },
  33: { id: 33, title: "Уровень 33", enabled: true, mode: "anti" },
  34: { id: 34, title: "Уровень 34", enabled: true, mode: "anti" },
  35: { id: 35, title: "Уровень 35", enabled: true, mode: "anti" },
  36: { id: 36, title: "Уровень 36", enabled: true, mode: "anti" },
  37: { id: 37, title: "Уровень 37", enabled: true, mode: "anti" },
  38: { id: 38, title: "Уровень 38", enabled: true, mode: "anti" },
  39: { id: 39, title: "Уровень 39", enabled: true, mode: "anti" },
  40: { id: 40, title: "Уровень 40", enabled: true, mode: "anti" },
  41: { id: 41, title: "Уровень 41", enabled: true, mode: "anti" },
  42: { id: 42, title: "Уровень 42", enabled: true, mode: "anti" },
  43: { id: 43, title: "Уровень 43", enabled: true, mode: "anti" },
  44: { id: 44, title: "Уровень 44", enabled: true, mode: "anti" },
  45: { id: 45, title: "Уровень 45", enabled: true, mode: "anti" },
  46: { id: 46, title: "Уровень 46", enabled: true, mode: "anti" },
  47: { id: 47, title: "Уровень 47", enabled: true, mode: "anti" },
  48: { id: 48, title: "Уровень 48", enabled: true, mode: "anti" },
  49: { id: 49, title: "Уровень 49", enabled: true, mode: "anti" },
  50: { id: 50, title: "Уровень 50", enabled: true, mode: "anti" },
  51: { id: 51, title: "Уровень 51", enabled: true, mode: "anti" },
  52: { id: 52, title: "Уровень 52", enabled: true, mode: "anti" },
  53: { id: 53, title: "Уровень 53", enabled: true, mode: "anti" },
  54: { id: 54, title: "Уровень 54", enabled: true, mode: "anti" },
  55: { id: 55, title: "Уровень 55", enabled: true, mode: "anti" },
  56: { id: 56, title: "Уровень 56", enabled: true, mode: "anti" },
  57: { id: 57, title: "Уровень 57", enabled: true, mode: "anti" },
  58: { id: 58, title: "Уровень 58", enabled: true, mode: "anti" },
  59: { id: 59, title: "Уровень 59", enabled: true, mode: "anti" },
  60: { id: 60, title: "Уровень 60", enabled: true, mode: "anti" },
  61: { id: 61, title: "Уровень 61", enabled: true, mode: "anti" },
};

// Уровни 62–100 — «Антикотопарк» (новые анти-уровни)
for (let id = 62; id <= 100; id++) {
  LEVELS[id] = { id, title: `Уровень ${id}`, enabled: true, mode: "anti" };
}

/** Получить описание уровня или null. */
export function getLevel(id) {
  return LEVELS[id] || null;
}

/** Список включённых уровней в порядке возрастания. */
export function getEnabledLevels() {
  return Object.values(LEVELS)
    .filter(l => l.enabled)
    .sort((a, b) => a.id - b.id);
}

/** Список id включённых уровней. */
export const LEVEL_IDS = getEnabledLevels().map(l => l.id);