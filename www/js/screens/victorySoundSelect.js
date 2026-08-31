import { audioManager } from "../core/audioManager.js";
import NavigationService from "../core/navigation.js";

const VICTORY_SOUND_KEY = "socio-cats:selectedVictorySound";

const VICTORY_SOUNDS = [
  {
    id: "1",
    name: "Звук 1",
    description: "Классический звук победы",
    path: "assets/sounds/victory/1.mp3"
  },
  {
    id: "2",
    name: "Звук 2",
    description: "Альтернативный звук победы",
    path: "assets/sounds/victory/2.mp3"
  }
];

export function getSelectedVictorySound() {
  try {
    const saved = localStorage.getItem(VICTORY_SOUND_KEY);
    if (saved && VICTORY_SOUNDS.some(s => s.id === saved)) return saved;
    return "1";
  } catch {
    return "1";
  }
}

export function getVictorySoundPath() {
  const sound = VICTORY_SOUNDS.find(s => s.id === getSelectedVictorySound());
  return sound ? sound.path : VICTORY_SOUNDS[0].path;
}

export function setSelectedVictorySound(soundId) {
  localStorage.setItem(VICTORY_SOUND_KEY, soundId);
}

export function showVictorySoundSelect(root) {
  root.innerHTML = "";

  const page = document.createElement("div");
  page.className = "victory-sound-page";

  const h = document.createElement("h1");
  h.textContent = "Звук победы";
  page.appendChild(h);

  const backBtn = document.createElement("button");
  backBtn.className = "back-btn";
  backBtn.textContent = "← Вернуться к выбору уровня";
  backBtn.addEventListener("click", () => {
    audioManager.playSoundEffect("assets/sounds/click.mp3");
    NavigationService.goBack();
  });
  page.appendChild(backBtn);

  const p = document.createElement("p");
  p.textContent = "Выберите, какой звук будет проигрываться после прохождения уровня";
  page.appendChild(p);

  const grid = document.createElement("div");
  grid.id = "victory-sound-grid";
  page.appendChild(grid);

  const currentSound = getSelectedVictorySound();

  for (const sound of VICTORY_SOUNDS) {
    const card = document.createElement("div");
    card.className = "victory-sound-card" + (sound.id === currentSound ? " selected" : "");

    const icon = document.createElement("div");
    icon.className = "victory-sound-icon";
    icon.textContent = "🔊";

    const name = document.createElement("div");
    name.className = "victory-sound-name";
    name.textContent = sound.name;

    const desc = document.createElement("div");
    desc.className = "victory-sound-desc";
    desc.textContent = sound.description;

    const actions = document.createElement("div");
    actions.className = "victory-sound-actions";

    const previewBtn = document.createElement("button");
    previewBtn.className = "victory-sound-preview-btn";
    previewBtn.textContent = "Прослушать";
    previewBtn.addEventListener("click", () => {
      audioManager.playSoundEffect(sound.path);
    });

    const selectBtn = document.createElement("button");
    selectBtn.className = "victory-sound-select-btn";
    selectBtn.textContent = sound.id === currentSound ? "Выбран" : "Выбрать";
    selectBtn.disabled = sound.id === currentSound;
    selectBtn.addEventListener("click", () => {
      audioManager.playSoundEffect("assets/sounds/click.mp3");
      setSelectedVictorySound(sound.id);
      showVictorySoundSelect(root);
    });

    actions.appendChild(previewBtn);
    actions.appendChild(selectBtn);

    card.appendChild(icon);
    card.appendChild(name);
    card.appendChild(desc);
    card.appendChild(actions);
    grid.appendChild(card);
  }

  root.appendChild(page);

  NavigationService.saveCurrentRender(() => showVictorySoundSelect(root));
}
