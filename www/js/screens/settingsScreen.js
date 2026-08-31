import { audioManager } from "../core/audioManager.js";
import NavigationService from "../core/navigation.js";
import { showThemeSelect } from "./themeSelect.js";
import { NAMING_KEY, getNamingStyle, setNamingStyle } from "../socionics/types.js";

export function showSettingsScreen(root) {
  root.innerHTML = "";

  const page = document.createElement("div");
  page.className = "settings-page";

  const h = document.createElement("h1");
  h.textContent = "⚙️ Настройки";
  page.appendChild(h);

  const backBtn = document.createElement("button");
  backBtn.className = "back-btn";
  backBtn.textContent = "← Вернуться";
  backBtn.addEventListener("click", () => {
    audioManager.playSoundEffect("assets/sounds/click.mp3");
    NavigationService.goBack();
  });
  page.appendChild(backBtn);
  page.appendChild(document.createElement("br"));
  page.appendChild(document.createElement("br"));

  // --- Раздел "Темы" ---
  const themeSection = document.createElement("div");
  themeSection.className = "settings-section";

  const themeTitle = document.createElement("h2");
  themeTitle.textContent = "🎭 Темы";
  themeSection.appendChild(themeTitle);

  const themeDesc = document.createElement("p");
  themeDesc.textContent = "Выберите тему оформления игры";
  themeSection.appendChild(themeDesc);

  const themeBtn = document.createElement("button");
  themeBtn.className = "settings-btn";
  themeBtn.textContent = "🎭 Выбрать тему";
  themeBtn.addEventListener("click", () => {
    audioManager.playSoundEffect("assets/sounds/click.mp3");
    NavigationService.navigate("themeSelect", () => showThemeSelect(root));
  });
  themeSection.appendChild(themeBtn);

  page.appendChild(themeSection);

  // --- Раздел "Стили наименований" ---
  const namingSection = document.createElement("div");
  namingSection.className = "settings-section";

  const namingTitle = document.createElement("h2");
  namingTitle.textContent = "📝 Стили наименований";
  namingSection.appendChild(namingTitle);

  const namingDesc = document.createElement("p");
  namingDesc.textContent = "Выберите, как называть типы котов";
  namingSection.appendChild(namingDesc);

  const currentStyle = getNamingStyle();

  // Радио-кнопка "Терминология Аушры"
  const optionAus = document.createElement("div");
  optionAus.className = "settings-option";
  const radioAus = document.createElement("input");
  radioAus.type = "radio";
  radioAus.name = "naming-style";
  radioAus.id = "naming-aushra";
  radioAus.value = "aushra";
  radioAus.checked = currentStyle === "aushra";
  radioAus.addEventListener("change", () => {
    if (radioAus.checked) {
      setNamingStyle("aushra");
    }
  });
  const labelAus = document.createElement("label");
  labelAus.htmlFor = "naming-aushra";
  labelAus.textContent = "Терминология Аушры (по умолчанию)";
  optionAus.appendChild(radioAus);
  optionAus.appendChild(labelAus);
  namingSection.appendChild(optionAus);

  // Радио-кнопка "Терминология Гуленко"
  const optionGul = document.createElement("div");
  optionGul.className = "settings-option";
  const radioGul = document.createElement("input");
  radioGul.type = "radio";
  radioGul.name = "naming-style";
  radioGul.id = "naming-gulenko";
  radioGul.value = "gulenko";
  radioGul.checked = currentStyle === "gulenko";
  radioGul.addEventListener("change", () => {
    if (radioGul.checked) {
      setNamingStyle("gulenko");
    }
  });
  const labelGul = document.createElement("label");
  labelGul.htmlFor = "naming-gulenko";
  labelGul.textContent = "Терминология Гуленко";
  optionGul.appendChild(radioGul);
  optionGul.appendChild(labelGul);
  namingSection.appendChild(optionGul);

  page.appendChild(namingSection);

  root.appendChild(page);

  NavigationService.saveCurrentRender(() => showSettingsScreen(root));
}
