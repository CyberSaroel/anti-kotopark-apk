export function formatTime(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export const LEVEL_COUNTDOWN_INITIAL_MS = 60_000;
export const LEVEL_COUNTDOWN_BONUS_PER_HAPPY_MS = 15_000;
export const LEVEL_REMAINING_MOVES_INITIAL = 30;
export const LEVEL_REMAINING_MOVES_BONUS_PER_HAPPY = 5;

export class LevelCountdown {
  constructor(initialMs = LEVEL_COUNTDOWN_INITIAL_MS) {
    this.initialMs = initialMs;
    this.remainingMs = initialMs;
    this.running = false;
    this.intervalId = null;
    this.lastTick = 0;
  }

  start(onTick, onExpire) {
    if (this.running) return;
    this.running = true;
    this.lastTick = Date.now();
    this.intervalId = setInterval(() => {
      if (!this.running) return;

      const now = Date.now();
      const delta = now - this.lastTick;
      this.lastTick = now;
      this.remainingMs -= delta;

      if (this.remainingMs <= 0) {
        this.remainingMs = 0;
        this.running = false;
        clearInterval(this.intervalId);
        this.intervalId = null;
        onTick(0);
        onExpire?.();
        return;
      }

      onTick(this.remainingMs);
    }, 200);
  }

  addTime(ms) {
    this.remainingMs += ms;
  }

  stop() {
    this.running = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    return this.remainingMs;
  }

  destroy() {
    this.stop();
  }
}

export class LevelTimer {
  constructor() {
    this.startTime = Date.now();
    this.elapsedMs = 0;
    this.running = true;
    this.intervalId = null;
  }

  start(onTick) {
    this.intervalId = setInterval(() => {
      if (this.running) {
        this.elapsedMs = Date.now() - this.startTime;
        onTick(this.elapsedMs);
      }
    }, 200);
  }

  stop() {
    this.running = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.elapsedMs = Date.now() - this.startTime;
    return this.elapsedMs;
  }

  destroy() {
    this.running = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}
