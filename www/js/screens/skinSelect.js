import { audioManager } from "../core/audioManager.js";
import NavigationService from "../core/navigation.js";

const SKIN_KEY = "socio-cats:selectedSkin";

export function getSelectedSkin() {
  try { return localStorage.getItem(SKIN_KEY) || "classic"; }
  catch { return "classic"; }
}

export function setSelectedSkin(skinId) {
  localStorage.setItem(SKIN_KEY, skinId);
}

export async function showSkinSelect(root) {
  root.innerHTML = "";

  const h = document.createElement("h1");
  h.textContent = "Выбор скина";
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
  p.textContent = "Выберите внешний вид котов";
  root.appendChild(p);

  const grid = document.createElement("div");
  grid.id = "skin-grid";
  root.appendChild(grid);

  let skins;
  try {
    const res = await fetch("json/data/skins.json");
    if (!res.ok) throw new Error("Не удалось загрузить скины");
    skins = (await res.json()).skins;
  } catch (e) {
    p.textContent = e.message;
    return;
  }

  const currentSkin = getSelectedSkin();

  for (const skin of skins) {
    const card = document.createElement("div");
    card.className = "skin-card" + (skin.id === currentSkin ? " selected" : "");

    const preview = document.createElement("img");
    preview.className = "skin-preview";
    preview.src = skin.preview;
    preview.alt = skin.name;
    preview.onerror = () => { preview.style.display = "none"; };

    const name = document.createElement("div");
    name.className = "skin-name";
    name.textContent = skin.name;

    const desc = document.createElement("div");
    desc.className = "skin-desc";
    desc.textContent = skin.description;

    const selectBtn = document.createElement("button");
    selectBtn.className = "skin-select-btn";
    selectBtn.textContent = skin.id === currentSkin ? "Выбран" : "Выбрать";
    selectBtn.disabled = skin.id === currentSkin;
    selectBtn.addEventListener("click", () => {
      audioManager.playSoundEffect("assets/sounds/click.mp3");
      setSelectedSkin(skin.id);
      showSkinSelect(root);
    });

    card.appendChild(preview);
    card.appendChild(name);
    card.appendChild(desc);
    card.appendChild(selectBtn);
    grid.appendChild(card);
  }

  NavigationService.saveCurrentRender(() => showSkinSelect(root));
}
