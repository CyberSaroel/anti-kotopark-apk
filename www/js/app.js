import { showIntroScreen } from "./screens/introScreen.js";
import { applyTheme } from "./theme.js";
import { restoreSelectedTheme } from "./screens/themeSelect.js";
import NavigationService from "./core/navigation.js";
import { VERSION, saveVersion } from "./core/version.js";

const root = document.getElementById("app");

// Apply book theme (dark/light via data-theme) on load
applyTheme();

// Restore previously selected decoration theme (CSS file) after page
// reload or browser restart, if one was saved
restoreSelectedTheme();

// Save current version
saveVersion();

// Add version label to body (persists across screen changes)
const versionLabel = document.createElement("div");
versionLabel.className = "version-label";
versionLabel.textContent = `v${VERSION}`;
document.body.appendChild(versionLabel);

// Initialize NavigationService
NavigationService.init(root);

// Show intro screen as the first screen (no history entry)
NavigationService.currentScreen = "intro";
NavigationService.saveCurrentRender(() => showIntroScreen(root));
showIntroScreen(root);

// ==== Автообновление игры (service worker) ====
if ("serviceWorker" in navigator) {
  let refreshing = false;
  // Когда новая версия воркера берёт управление — сами перезагружаем страницу
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" })
      .then((reg) => {
        // Раз в минуту проверяем, не вышла ли новая версия (для уже открытых вкладок)
        setInterval(() => reg.update(), 60 * 1000);
      })
      .catch(() => {});
  });
}