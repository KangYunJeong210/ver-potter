// js/storage.js
const SAVE_KEY = "verpotter_save_v1";

export function saveState(state) {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}

export function loadState() {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
}

export function clearState() {
    localStorage.removeItem(SAVE_KEY);
}
