import { getSavedTheme, setSavedTheme } from "./storage.js";

/**
 * Переключение темы оформления через data-theme на <html>.
 * Стили живут в css/themes.css (переменные :root / [data-theme], без хардкода).
 */
export function setTheme(name) {
  document.documentElement.setAttribute("data-theme", name);
  setSavedTheme(name);
}

export function getTheme() {
  const saved = getSavedTheme();
  return saved || "anti-kotopark";
}

export function applyTheme() {
  setTheme(getTheme());
}

/** Переключить между темами, вернуть новое имя. */
export function toggleTheme() {
  const cur = getTheme();
  const next = cur === "anti-kotopark" ? "dark" : "anti-kotopark";
  setTheme(next);
  return next;
}