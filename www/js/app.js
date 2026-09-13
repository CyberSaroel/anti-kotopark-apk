import { runFreshStartOnce } from "./core/freshStart.js";
import { showIntroScreen } from "./screens/introScreen.js";
import { applyTheme } from "./theme.js";
import { restoreSelectedTheme } from "./screens/themeSelect.js";
import NavigationService from "./core/navigation.js";
import { VERSION, saveVersion } from "./core/version.js";

// Одноразовый форс-сброс кэша прогресса/настроек для новой версии.
// Выполняется самым первым — до чтения любого прогресса/настроек/статистики.
runFreshStartOnce();

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
// Намеренно не делаем мгновенный reload на ЛЮБОЙ controllerchange: из-за
// skipWaiting в sw.js новый воркер активируется сразу, и на самой первой
// загрузке/деплое контрол переходит к воркеру прямо во время игры, из-за чего
// страница «сбрасывается» на стартовый экран без причины.
//
// Правило:
//  - если вкладка УЖЕ была под управлением воркера при старте (hadController)
//    и потом к контролю пришёл новый воркер — это реальное обновление, релоадим;
//  - если на момент загрузки контролёра ещё не было (первый заход после деплоя) —
//    первый переход контроля игнорируем, чтобы не выбрасывать игрока с уровня.
if ("serviceWorker" in navigator) {
  const hadController = navigator.serviceWorker.controller !== null;
  let autoReloading = false;
  let updatePending = false;

  // Перезагрузка выполняется только в «безопасной» точке — главном меню (intro).
  // Так автообновление не выбросит игрока посреди уровня («переход на стартовую»).
  const tryReloadInIntro = () => {
    if (autoReloading) return;
    if (updatePending && NavigationService.currentScreen === "intro") {
      autoReloading = true;
      window.location.reload();
    }
  };

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    // Первый заход/деплой (контролёра ещё не было) не сбрасываем вкладку.
    if (!hadController || autoReloading) return;
    updatePending = true;
    tryReloadInIntro();
  });

  // Ждём момент, когда игрок вернётся в главное меню, чтобы применить обновление.
  setInterval(tryReloadInIntro, 1000);

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" })
      .then((reg) => {
        // Раз в минуту проверяем, не вышла ли новая версия (для уже открытых вкладок)
        setInterval(() => reg.update(), 60 * 1000);
      })
      .catch(() => {});
  });
}