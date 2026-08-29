// storage.js — chrome.storage.local wrapper for sessions and settings.
//
// Data shape:
//   {
//     sessions: Session[],      // newest first
//     settings: { autoClose: boolean },
//     stats:    { totalSaves: number, totalTabs: number, weekSaves: number, weekTabs: number, weekStart: number },
//     schemaVersion: 1
//   }

const KEY = "tabpalState";

const DEFAULT_STATE = Object.freeze({
  sessions: [],
  settings: { autoClose: true },
  stats: { totalSaves: 0, totalTabs: 0, weekSaves: 0, weekTabs: 0, weekStart: 0 },
  schemaVersion: 1,
});

export async function loadState() {
  try {
    const data = await chrome.storage.local.get(KEY);
    const raw = data?.[KEY];
    if (!raw) return clone(DEFAULT_STATE);
    return mergeDefaults(raw);
  } catch (e) {
    console.warn("[TabPal] loadState failed, returning defaults", e);
    return clone(DEFAULT_STATE);
  }
}

export async function saveState(state) {
  await chrome.storage.local.set({ [KEY]: state });
}

// Patch a partial state and persist. Returns the merged state.
export async function patchState(patch) {
  const cur = await loadState();
  const next = { ...cur, ...patch };
  await saveState(next);
  return next;
}

export function newId() {
  // crypto.randomUUID is available in service workers and the popup since Chrome 110.
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
}

// ---------- Sessions ----------

export async function listSessions() {
  const s = await loadState();
  return s.sessions;
}

export async function getSession(id) {
  const all = await listSessions();
  return all.find((x) => x.id === id) || null;
}

export async function addSession(session) {
  const state = await loadState();
  const sessions = [session, ...state.sessions].slice(0, 200); // cap to keep storage sane
  // Update stats
  const stats = bumpStats(state.stats, session.tabs.length);
  await saveState({ ...state, sessions, stats });
  return session;
}

export async function updateSession(id, patch) {
  const state = await loadState();
  const idx = state.sessions.findIndex((x) => x.id === id);
  if (idx < 0) return null;
  const updated = { ...state.sessions[idx], ...patch, updatedAt: Date.now() };
  const sessions = state.sessions.slice();
  sessions[idx] = updated;
  await saveState({ ...state, sessions });
  return updated;
}

export async function removeSession(id) {
  const state = await loadState();
  const sessions = state.sessions.filter((x) => x.id !== id);
  await saveState({ ...state, sessions });
}

export async function clearAll() {
  const state = await loadState();
  await saveState({ ...state, sessions: [] });
}

// ---------- Settings ----------

export async function getSettings() {
  const s = await loadState();
  return s.settings;
}

export async function setSettings(patch) {
  const state = await loadState();
  const settings = { ...state.settings, ...patch };
  await saveState({ ...state, settings });
  return settings;
}

// ---------- Stats ----------

export async function getStats() {
  const s = await loadState();
  return s.stats;
}

// ---------- Import / Export ----------

export function exportData(state) {
  return {
    schemaVersion: state.schemaVersion,
    exportedAt: Date.now(),
    sessions: state.sessions,
    settings: state.settings,
  };
}

export async function importData(payload, { merge = false } = {}) {
  if (!payload || !Array.isArray(payload.sessions)) {
    throw new Error("Invalid TabPal export: missing sessions array.");
  }
  const state = await loadState();
  const sessions = merge
    ? [...payload.sessions, ...state.sessions]
    : payload.sessions;
  const settings = payload.settings && typeof payload.settings === "object"
    ? { ...state.settings, ...payload.settings }
    : state.settings;
  await saveState({ ...state, sessions, settings });
  return sessions.length - (merge ? state.sessions.length : 0);
}

// ---------- Helpers ----------

function clone(o) {
  return JSON.parse(JSON.stringify(o));
}

function mergeDefaults(raw) {
  return {
    sessions: Array.isArray(raw.sessions) ? raw.sessions : [],
    settings: { ...DEFAULT_STATE.settings, ...(raw.settings || {}) },
    stats: { ...DEFAULT_STATE.stats, ...(raw.stats || {}) },
    schemaVersion: raw.schemaVersion || 1,
  };
}

function bumpStats(stats, tabsAdded) {
  const now = Date.now();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  let { weekStart, weekSaves, weekTabs } = stats;
  if (!weekStart || now - weekStart > weekMs) {
    weekStart = now;
    weekSaves = 0;
    weekTabs = 0;
  }
  return {
    totalSaves: (stats.totalSaves || 0) + 1,
    totalTabs: (stats.totalTabs || 0) + tabsAdded,
    weekSaves: weekSaves + 1,
    weekTabs: weekTabs + tabsAdded,
    weekStart,
  };
}
