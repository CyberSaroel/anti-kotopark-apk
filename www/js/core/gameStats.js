const MOVES_KEY = "ak_gs_total_moves";
const TIME_KEY = "ak_gs_total_time_ms";

// НЕ переносим значения из "socio-cats:*": это хранилище ДРУГОЙ игры
// (royal-socio-cats). Статистика anti-kotopark живёт только здесь, под
// ключами "ak_gs_total_moves"/"ak_gs_total_time_ms".

let totalMoves = 0;
let totalTimeMs = 0;

function load() {
  try {
    totalMoves = parseInt(localStorage.getItem(MOVES_KEY), 10) || 0;
    totalTimeMs = parseInt(localStorage.getItem(TIME_KEY), 10) || 0;

    // Миграция из "socio-cats:*" удалена: хранилища игр разделены.
    // Статистика стартует с "ak_gs_total_moves"/"ak_gs_total_time_ms"
    // (сброс выполняет js/core/freshStart.js).
  } catch (e) {
    totalMoves = 0;
    totalTimeMs = 0;
  }
}

function save() {
  try {
    localStorage.setItem(MOVES_KEY, String(totalMoves));
    localStorage.setItem(TIME_KEY, String(totalTimeMs));
  } catch (e) {
    // игнорируем ошибки хранилища
  }
}

load();

export function addTotalMoves(n) {
  totalMoves += n;
  save();
}

export function addTotalTime(ms) {
  totalTimeMs += ms;
  save();
}

export function getTotalMoves() {
  return totalMoves;
}

export function getTotalTimeMs() {
  return totalTimeMs;
}
