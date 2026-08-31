/**
 * localStorage-хелперы для «Антикотопарка» (плана v4).
 */

const LS_BONUS = "ak_bonus_errors";
const LS_THEME = "ak_theme";

// ==== Бонусные ошибки за королей ====

export function getBonusErrors() {
  try {
    const v = parseInt(localStorage.getItem(LS_BONUS) || "0", 10);
    return Number.isFinite(v) && v > 0 ? v : 0;
  } catch {
    return 0;
  }
}

export function addBonusErrors(n) {
  const cur = getBonusErrors();
  try {
    localStorage.setItem(LS_BONUS, String(cur + n));
  } catch {
    // ignore
  }
  return cur + n;
}

/** Списать одно накопленное бонусное право на ошибку. Возвращает true, если удалось. */
export function spendBonusError() {
  const cur = getBonusErrors();
  if (cur <= 0) return false;
  try {
    localStorage.setItem(LS_BONUS, String(cur - 1));
  } catch {
    // ignore
  }
  return true;
}

// ==== Тема ====

export function getSavedTheme() {
  try {
    return localStorage.getItem(LS_THEME) || "anti-kotopark";
  } catch {
    return "anti-kotopark";
  }
}

export function setSavedTheme(name) {
  try {
    localStorage.setItem(LS_THEME, name);
  } catch {
    // ignore
  }
}