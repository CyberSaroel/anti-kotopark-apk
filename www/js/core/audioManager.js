const MUSIC_KEY = "socio-cats:musicEnabled";
const SFX_KEY = "socio-cats:sfxEnabled";
const MUSIC_VOLUME_KEY = "socio-cats:musicVolume";
const SFX_VOLUME_KEY = "socio-cats:sfxVolume";
// Уменьшаем максимальную громкость музыки в три раза
const MUSIC_VOLUME_SCALE = 1 / 3;

export function isMusicEnabled() {
  try {
    const value = localStorage.getItem(MUSIC_KEY);
    return value === null ? true : value === "true"; // По умолчанию true
  } catch {
    return true; // По умолчанию true
  }
}

export function setMusicEnabled(enabled) {
  localStorage.setItem(MUSIC_KEY, enabled.toString());
}

export function isSfxEnabled() {
  try {
    const value = localStorage.getItem(SFX_KEY);
    return value === null ? true : value === "true"; // По умолчанию true
  } catch {
    return true; // По умолчанию true
  }
}

export function setSfxEnabled(enabled) {
  localStorage.setItem(SFX_KEY, enabled.toString());
}

export function getMusicVolume() {
  try {
    const value = localStorage.getItem(MUSIC_VOLUME_KEY);
    return value === null ? 0.5 : parseFloat(value);
  } catch {
    return 0.5;
  }
}

export function setMusicVolume(volume) {
  localStorage.setItem(MUSIC_VOLUME_KEY, volume.toString());
}

export function getSfxVolume() {
  try {
    const value = localStorage.getItem(SFX_VOLUME_KEY);
    return value === null ? 0.5 : parseFloat(value);
  } catch {
    return 0.5;
  }
}

export function setSfxVolume(volume) {
  localStorage.setItem(SFX_VOLUME_KEY, volume.toString());
}

export class AudioManager {
  constructor() {
    this.audio = null;
    this.isPlaying = false;
    this.clickSfx = null;
    this.victorySfx = null;
    this.moveSfx = null;
    this.audioCtx = null;
    this.warningBeepInterval = null;
  }

  // Инициализация Web Audio API (обязательно после взаимодействия с пользователем!)
  initAudioContext() {
    try {
      if (!this.audioCtx) {
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (this.audioCtx.state === "suspended") {
        this.audioCtx.resume();
      }
    } catch (e) {
      // Не даём ошибке инициализации аудио сломать игру
    }
  }

  // Один короткий "пик"
  playBeep(frequency = 900, duration = 0.1, volume = 0.1) {
    if (!isSfxEnabled() || !this.audioCtx) return;
    try {
      const oscillator = this.audioCtx.createOscillator();
      const gainNode = this.audioCtx.createGain();
      oscillator.type = "square";
      oscillator.frequency.setValueAtTime(frequency, this.audioCtx.currentTime);
      const finalVolume = Math.max(0.0001, volume * getSfxVolume());
      gainNode.gain.setValueAtTime(finalVolume, this.audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(
        0.001,
        this.audioCtx.currentTime + duration
      );
      oscillator.connect(gainNode);
      gainNode.connect(this.audioCtx.destination);
      oscillator.start();
      oscillator.stop(this.audioCtx.currentTime + duration);
    } catch (e) {
      // Звук не критичен для игры
    }
  }

  // Звук "Дзинь!" — приятный колокольчик при росте числа довольных котов
  playDing() {
    if (!isSfxEnabled() || !this.audioCtx) return;
    try {
      const now = this.audioCtx.currentTime;
      const oscillator = this.audioCtx.createOscillator();
      const gainNode = this.audioCtx.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(1568, now); // высокая чистая нота (G6)
      const finalVolume = Math.max(0.0001, 0.3 * getSfxVolume());
      gainNode.gain.setValueAtTime(finalVolume, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      oscillator.connect(gainNode);
      gainNode.connect(this.audioCtx.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.5);
    } catch (e) {
      // Звук не критичен для игры
    }
  }

  // Звук правильного угадывания социотипа — весёлое восходящее арпеджио
  playCorrectGuess() {
    if (!isSfxEnabled() || !this.audioCtx) return;
    try {
      const now = this.audioCtx.currentTime;
      const notes = [1046.5, 1318.5, 1568]; // C6 → E6 → G6
      notes.forEach((freq, i) => {
        const oscillator = this.audioCtx.createOscillator();
        const gainNode = this.audioCtx.createGain();
        const t = now + i * 0.09;
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(freq, t);
        const finalVolume = Math.max(0.0001, 0.25 * getSfxVolume());
        gainNode.gain.setValueAtTime(finalVolume, t);
        gainNode.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
        oscillator.connect(gainNode);
        gainNode.connect(this.audioCtx.destination);
        oscillator.start(t);
        oscillator.stop(t + 0.4);
      });
    } catch (e) {
      // Звук не критичен для игры
    }
  }

  // Звук поражения
  playLoseSound() {
    if (!isSfxEnabled()) return;
    try {
      // Гарантируем готовый к работе контекст: на некоторых устройствах
      // (особенно Android) AudioContext сам переходит в "suspended", и звук
      // пропадает после первого воспроизведения.
      this.initAudioContext();
      if (!this.audioCtx) return;
      const now = this.audioCtx.currentTime;
      const volume = getSfxVolume();
      // Всегда ненулевая амплитуда, иначе exponentialRampToValueAtTime
      // выбрасывает RangeError и повторные писки пропадают.
      const finalVolume = Math.max(0.0001, 0.3 * (Number.isFinite(volume) && volume > 0 ? volume : 0.5));
      const oscillator = this.audioCtx.createOscillator();
      const gainNode = this.audioCtx.createGain();
      oscillator.type = "sawtooth";
      oscillator.frequency.setValueAtTime(500, now);
      oscillator.frequency.exponentialRampToValueAtTime(120, now + 0.6);
      gainNode.gain.setValueAtTime(finalVolume, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      oscillator.connect(gainNode);
      gainNode.connect(this.audioCtx.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.6);
    } catch (e) {
      // Звук не критичен: не даём ошибке прервать обработку хода
    }
  }

  // Остановить текущее пиканье
  stopWarningBeeps() {
    if (this.warningBeepInterval) {
      clearInterval(this.warningBeepInterval);
      this.warningBeepInterval = null;
    }
  }

  // Запустить пиканье с заданной скоростью
  startWarningBeeps(intervalMs, frequency = 900) {
    this.stopWarningBeeps();
    this.playBeep(frequency);
    this.warningBeepInterval = setInterval(() => {
      this.playBeep(frequency);
    }, intervalMs);
  }

  // Обновление звукового предупреждения в зависимости от оставшегося времени (в миллисекундах)
  updateWarningSound(remainingMs) {
    const secondsLeft = Math.ceil(remainingMs / 1000);
    if (secondsLeft <= 0) {
      // Время вышло — гарантированно глушим пищалку, иначе интервал продолжит пикать вечно.
      this.stopWarningBeeps();
      return;
    }
    if (secondsLeft > 10) {
      this.stopWarningBeeps();
      return;
    }
    if (secondsLeft <= 10 && secondsLeft > 5) {
      // 10, 9, 8, 7, 6 секунд — спокойное предупреждение
      this.startWarningBeeps(1000, 800);
      return;
    }
    if (secondsLeft <= 5 && secondsLeft > 2) {
      // 5, 4, 3 секунды — быстрее и выше
      this.startWarningBeeps(500, 1000);
      return;
    }
    if (secondsLeft <= 2 && secondsLeft > 0) {
      // 2, 1 секунда — паника котопарка
      this.startWarningBeeps(250, 1300);
      return;
    }
  }

  play(src) {
    if (!isMusicEnabled()) return;
    
    if (this.audio) {
      this.audio.pause();
      this.audio = null;
    }

    this.audio = new Audio(src);
    this.audio.loop = true;
    // Применяем масштаб громкости музыки
    this.audio.volume = getMusicVolume() * MUSIC_VOLUME_SCALE;
    
    this.audio.play().catch(e => {
      console.log("Audio play failed:", e);
    });
    
    this.isPlaying = true;
  }

  // Метод для обновления громкости музыки с применением масштаба
  updateMusicVolume() {
    if (this.audio) {
      this.audio.volume = getMusicVolume() * MUSIC_VOLUME_SCALE;
    }
  }

  // Метод для обновления громкости всех активных звуковых эффектов
  updateSfxVolume() {
    if (this.victorySfx) {
      this.victorySfx.volume = getSfxVolume();
    }
    if (this.clickSfx) {
      this.clickSfx.volume = getSfxVolume() / 3;
    }
    if (this.moveSfx) {
      this.moveSfx.volume = getSfxVolume();
    }
  }

  stop() {
    if (this.audio) {
      this.audio.pause();
      this.audio = null;
    }
    this.isPlaying = false;
    this.stopWarningBeeps();
  }

  toggle() {
    const enabled = !isMusicEnabled();
    setMusicEnabled(enabled);
    
    if (enabled && this.isPlaying) {
      // Will play when next track is loaded
    } else if (!enabled) {
      this.stop();
    }
    
    return enabled;
  }

  isPlaying() {
    return this.isPlaying;
  }

  playSoundEffect(src) {
    if (!isSfxEnabled()) return;

    if (src.includes("victory")) {
      // Handle victory sound
      if (this.victorySfx) {
        this.victorySfx.pause();
        this.victorySfx.currentTime = 0;
        this.victorySfx = null;
      }
      this.victorySfx = new Audio(src);
      this.victorySfx.volume = getSfxVolume();
      this.victorySfx.addEventListener("ended", () => {
        this.victorySfx = null;
      });
      this.victorySfx.addEventListener("error", (e) => {
        console.log("Victory SFX error:", e);
        this.victorySfx = null;
      });
      this.victorySfx.play().catch(e => {
        console.log("Victory SFX play failed:", e);
        this.victorySfx = null;
      });
    } else if (src.includes("click")) {
      // Handle click sound - volume reduced by 3x
      if (this.clickSfx) {
        this.clickSfx.pause();
        this.clickSfx.currentTime = 0;
        this.clickSfx = null;
      }
      this.clickSfx = new Audio(src);
      this.clickSfx.volume = getSfxVolume() / 3;
      this.clickSfx.addEventListener("ended", () => {
        this.clickSfx = null;
      });
      this.clickSfx.addEventListener("error", (e) => {
        console.log("Click SFX error:", e);
        this.clickSfx = null;
      });
      this.clickSfx.play().catch(e => {
        console.log("Click SFX play failed:", e);
        this.clickSfx = null;
      });
    } else if (src.includes("move")) {
      // Handle move sound (cat interactions)
      if (this.moveSfx) {
        this.moveSfx.pause();
        this.moveSfx.currentTime = 0;
        this.moveSfx = null;
      }
      this.moveSfx = new Audio(src);
      this.moveSfx.volume = getSfxVolume();
      this.moveSfx.addEventListener("ended", () => {
        this.moveSfx = null;
      });
      this.moveSfx.addEventListener("error", (e) => {
        console.log("Move SFX error:", e);
        this.moveSfx = null;
      });
      this.moveSfx.play().catch(e => {
        console.log("Move SFX play failed:", e);
        this.moveSfx = null;
      });
    }
  }
}

// Global audio manager instance
export const audioManager = new AudioManager();
