import { audioManager } from "../core/audioManager.js";
import NavigationService from "../core/navigation.js";

const THEME_KEY = "socio-cats:selectedTheme";

export function getSelectedTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY) || "anti-kotopark";
    if (saved === "brutal") return "vampire";
    if (saved === "royal-book") return "anti-kotopark";
    return saved;
  }
  catch { return "anti-kotopark"; }
}

export function setSelectedTheme(themeId) {
  localStorage.setItem(THEME_KEY, themeId);
  applyTheme(themeId);
}

/**
 * Восстановить выбранную ранее тему оформления при загрузке страницы.
 * Применяется только если тема была выбрана (значение сохранено в
 * localStorage, которое переживает обновление страницы и закрытие браузера).
 * Иначе остаётся стандартная тема из index.html.
 */
export async function restoreSelectedTheme() {
  let saved = null;
  try {
    saved = localStorage.getItem(THEME_KEY);
  } catch {
    return;
  }
  if (!saved) return;
  await applyTheme(getSelectedTheme());
}

export async function applyTheme(themeId) {
  try {
    const res = await fetch("json/data/themes.json");
    if (!res.ok) return;
    const data = await res.json();
    const theme = data.themes.find(t => t.id === themeId);
    if (!theme) return;

    // Remove existing theme link if any
    const existingLink = document.getElementById("theme-link");
    if (existingLink) existingLink.remove();

    // Add new theme link
    const link = document.createElement("link");
    link.id = "theme-link";
    link.rel = "stylesheet";
    link.href = theme.cssFile;
    document.head.appendChild(link);
  } catch (e) {
    console.error("Failed to apply theme:", e);
  }
}

export async function showThemeSelect(root) {
  root.innerHTML = "";

  const h = document.createElement("h1");
  h.textContent = "Выбор темы";
  root.appendChild(h);

  const backBtn = document.createElement("button");
  backBtn.className = "back-btn";
  backBtn.textContent = "← Вернуться к выбору уровня";
  backBtn.addEventListener("click", () => {
    audioManager.playSoundEffect("assets/sounds/click.mp3");
    NavigationService.goBack();
  });
  root.appendChild(backBtn);

  const p = document.createElement("p");
  p.textContent = "Выберите тему оформления";
  root.appendChild(p);

  const grid = document.createElement("div");
  grid.id = "theme-grid";
  root.appendChild(grid);

  let themes;
  try {
    const res = await fetch("json/data/themes.json");
    if (!res.ok) throw new Error("Не удалось загрузить темы");
    themes = (await res.json()).themes;
  } catch (e) {
    p.textContent = e.message;
    return;
  }

  const currentTheme = getSelectedTheme();

  for (const theme of themes) {
    const card = document.createElement("div");
    card.className = "theme-card" + (theme.id === currentTheme ? " selected" : "");

    const preview = document.createElement("div");
    preview.className = "theme-preview";
    preview.style.background = theme.preview.background;
    preview.style.border = `3px solid ${theme.preview.primary}`;

    const name = document.createElement("div");
    name.className = "theme-name";
    name.textContent = theme.name;

    const desc = document.createElement("div");
    desc.className = "theme-desc";
    desc.textContent = theme.description;

    const selectBtn = document.createElement("button");
    selectBtn.className = "theme-select-btn";
    selectBtn.textContent = theme.id === currentTheme ? "Выбрана" : "Выбрать";
    selectBtn.disabled = theme.id === currentTheme;
    selectBtn.addEventListener("click", () => {
      audioManager.playSoundEffect("assets/sounds/click.mp3");
      setSelectedTheme(theme.id);
      showThemeSelect(root);
    });

    card.appendChild(preview);
    card.appendChild(name);
    card.appendChild(desc);
    card.appendChild(selectBtn);
    grid.appendChild(card);
  }

  NavigationService.saveCurrentRender(() => showThemeSelect(root));
}
