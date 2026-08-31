const MOVES_KEY = "socio-cats:totalMoves";
const TIME_KEY = "socio-cats:totalTimeMs";

let totalMoves = 0;
let totalTimeMs = 0;

function load() {
  try {
    totalMoves = parseInt(localStorage.getItem(MOVES_KEY), 10) || 0;
    totalTimeMs = parseInt(localStorage.getItem(TIME_KEY), 10) || 0;
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
