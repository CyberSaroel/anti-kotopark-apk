export const VERSION = "1.10.0";

const STORAGE_KEY = "ak_version";

export function saveVersion() {
  try {
    localStorage.setItem(STORAGE_KEY, VERSION);
  } catch (e) {
    // ignore
  }
}

export function getSavedVersion() {
  try {
    return localStorage.getItem(STORAGE_KEY) || null;
  } catch (e) {
    return null;
  }
}