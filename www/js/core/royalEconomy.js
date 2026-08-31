/**
 * Королевская экономика.
 *
 * Единый модуль экономики для ВСЕХ уровней игры (анти- и классических).
 * Всё состояние живёт в js/core/royalStats.js (ключи localStorage "ak_*",
 * как в js/storage.js). Здесь — только реэкспорт, чтобы существующие импорты
 * (gameScreen, recordsScreen, statsScreen) работали с тем же общим балансом
 * рыбок и королей, что и анти-уровни (js/game.js).
 */
export {
  onKingCreated,
  onKingLost,
  commitLevel,
  resetLevel,
  getKingsThisLevel,
  getKingsTotal,
  getRockets,
  spendRocket,
} from "./royalStats.js";
