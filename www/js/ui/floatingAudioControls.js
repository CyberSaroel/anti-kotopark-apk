import {
  audioManager,
  isMusicEnabled,
  setMusicEnabled,
  isSfxEnabled,
  setSfxEnabled,
  getMusicVolume,
  setMusicVolume,
  getSfxVolume,
  setSfxVolume
} from "../core/audioManager.js";

function preventPropagation(e) {
  e.stopPropagation();
}

function buildVolumePopup(labelText, getVolume, setVolume, onVolumeChange) {
  const popup = document.createElement("div");
  popup.className = "audio-volume-popup";

  const label = document.createElement("label");
  label.textContent = labelText;

  const slider = document.createElement("input");
  slider.type = "range";
  slider.min = "0";
  slider.max = "1";
  slider.step = "0.01";
  slider.value = String(getVolume());
  slider.className = "audio-volume-slider";
  slider.addEventListener("input", (e) => {
    const volume = parseFloat(e.target.value);
    setVolume(volume);
    onVolumeChange();
  });

  for (const el of [popup, label, slider]) {
    el.addEventListener("click", preventPropagation);
    el.addEventListener("mousedown", preventPropagation);
    el.addEventListener("mouseup", preventPropagation);
    el.addEventListener("touchstart", preventPropagation);
    el.addEventListener("touchend", preventPropagation);
  }

  popup.appendChild(label);
  popup.appendChild(slider);
  return popup;
}

function mountDesktopControls(parent) {
  const wrapper = document.createElement("div");
  wrapper.className = "floating-audio-controls";

  const musicToggle = document.createElement("button");
  musicToggle.className = "music-toggle-btn";
  musicToggle.textContent = "🎵";
  musicToggle.style.textDecoration = isMusicEnabled() ? "none" : "line-through";
  musicToggle.style.opacity = isMusicEnabled() ? "1" : "0.5";
  musicToggle.addEventListener("click", (e) => {
    e.stopPropagation();
    audioManager.playSoundEffect("assets/sounds/click.mp3");
    const enabled = !isMusicEnabled();
    setMusicEnabled(enabled);
    musicToggle.style.textDecoration = enabled ? "none" : "line-through";
    musicToggle.style.opacity = enabled ? "1" : "0.5";
    if (enabled) {
      audioManager.play("assets/music/background.mp3");
    } else {
      audioManager.stop();
    }
  });

  const musicVolumePopup = buildVolumePopup(
    "Громкость",
    getMusicVolume,
    setMusicVolume,
    () => audioManager.updateMusicVolume()
  );

  let musicHideTimeout;
  musicToggle.addEventListener("mouseenter", () => {
    clearTimeout(musicHideTimeout);
    musicVolumePopup.style.display = "block";
  });
  musicToggle.addEventListener("mouseleave", () => {
    musicHideTimeout = setTimeout(() => {
      musicVolumePopup.style.display = "none";
    }, 300);
  });

  musicToggle.appendChild(musicVolumePopup);

  const sfxToggle = document.createElement("button");
  sfxToggle.className = "music-toggle-btn";
  sfxToggle.textContent = "🔊";
  sfxToggle.style.textDecoration = isSfxEnabled() ? "none" : "line-through";
  sfxToggle.style.opacity = isSfxEnabled() ? "1" : "0.5";
  sfxToggle.addEventListener("click", (e) => {
    e.stopPropagation();
    audioManager.playSoundEffect("assets/sounds/click.mp3");
    const enabled = !isSfxEnabled();
    setSfxEnabled(enabled);
    sfxToggle.style.textDecoration = enabled ? "none" : "line-through";
    sfxToggle.style.opacity = enabled ? "1" : "0.5";
  });

  const sfxVolumePopup = buildVolumePopup(
    "Громкость",
    getSfxVolume,
    setSfxVolume,
    () => audioManager.updateSfxVolume()
  );

  let sfxHideTimeout;
  sfxToggle.addEventListener("mouseenter", () => {
    clearTimeout(sfxHideTimeout);
    sfxVolumePopup.style.display = "block";
  });
  sfxToggle.addEventListener("mouseleave", () => {
    sfxHideTimeout = setTimeout(() => {
      sfxVolumePopup.style.display = "none";
    }, 300);
  });

  sfxToggle.appendChild(sfxVolumePopup);

  wrapper.appendChild(musicToggle);
  wrapper.appendChild(sfxToggle);
  parent.appendChild(wrapper);

  return {
    destroy() {
      wrapper.remove();
    }
  };
}

function mountMobileBar(parent) {
  const bar = document.createElement("div");
  bar.className = "mobile-audio-bar";

  const musicRow = document.createElement("div");
  musicRow.className = "mobile-audio-row";

  const musicToggle = document.createElement("button");
  musicToggle.className = "mobile-audio-btn";
  musicToggle.textContent = "🎵";
  musicToggle.style.textDecoration = isMusicEnabled() ? "none" : "line-through";
  musicToggle.style.opacity = isMusicEnabled() ? "1" : "0.5";
  musicToggle.addEventListener("click", () => {
    audioManager.playSoundEffect("assets/sounds/click.mp3");
    const enabled = !isMusicEnabled();
    setMusicEnabled(enabled);
    musicToggle.style.textDecoration = enabled ? "none" : "line-through";
    musicToggle.style.opacity = enabled ? "1" : "0.5";
    if (enabled) {
      audioManager.play("assets/music/background.mp3");
    } else {
      audioManager.stop();
    }
  });

  const musicSlider = document.createElement("input");
  musicSlider.type = "range";
  musicSlider.min = "0";
  musicSlider.max = "1";
  musicSlider.step = "0.01";
  musicSlider.value = String(getMusicVolume());
  musicSlider.className = "mobile-audio-slider";
  musicSlider.addEventListener("input", (e) => {
    setMusicVolume(parseFloat(e.target.value));
    audioManager.updateMusicVolume();
  });

  musicRow.appendChild(musicToggle);
  musicRow.appendChild(musicSlider);

  const sfxRow = document.createElement("div");
  sfxRow.className = "mobile-audio-row";

  const sfxToggle = document.createElement("button");
  sfxToggle.className = "mobile-audio-btn";
  sfxToggle.textContent = "🔊";
  sfxToggle.style.textDecoration = isSfxEnabled() ? "none" : "line-through";
  sfxToggle.style.opacity = isSfxEnabled() ? "1" : "0.5";
  sfxToggle.addEventListener("click", () => {
    audioManager.playSoundEffect("assets/sounds/click.mp3");
    const enabled = !isSfxEnabled();
    setSfxEnabled(enabled);
    sfxToggle.style.textDecoration = enabled ? "none" : "line-through";
    sfxToggle.style.opacity = enabled ? "1" : "0.5";
  });

  const sfxSlider = document.createElement("input");
  sfxSlider.type = "range";
  sfxSlider.min = "0";
  sfxSlider.max = "1";
  sfxSlider.step = "0.01";
  sfxSlider.value = String(getSfxVolume());
  sfxSlider.className = "mobile-audio-slider";
  sfxSlider.addEventListener("input", (e) => {
    setSfxVolume(parseFloat(e.target.value));
    audioManager.updateSfxVolume();
  });

  sfxRow.appendChild(sfxToggle);
  sfxRow.appendChild(sfxSlider);

  bar.appendChild(musicRow);
  bar.appendChild(sfxRow);
  parent.appendChild(bar);

  return {
    destroy() {
      bar.remove();
    }
  };
}

export function removeFloatingAudioControls() {
  document.querySelectorAll(".mobile-audio-bar, .floating-audio-controls").forEach((el) => el.remove());
}

export function mountFloatingAudioControls(parent = document.body) {
  // Если кнопки уже на экране — оставляем их как есть (не мигаем)
  const existing = document.querySelector(".floating-audio-controls, .mobile-audio-bar");
  if (existing) {
    return { destroy() { existing.remove(); } };
  }
  const useMobileBar = window.matchMedia("(max-width: 768px), (pointer: coarse)").matches;
  return useMobileBar ? mountMobileBar(parent) : mountDesktopControls(parent);
}
