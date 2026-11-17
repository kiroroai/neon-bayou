// Neon Bayou — save and continue, in localStorage. One job: persist
// progress and hand it back, never touching the game loop.
const KEY = 'neon-bayou-save-v1';

export function saveGame(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); return true; }
  catch (e) { return false; }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (typeof d !== 'object' || d === null) return null;
    return d;
  } catch (e) { return null; }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
}
