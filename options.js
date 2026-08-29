// options.js — settings page controller.
//
// Handles: auto-close toggle, JSON import/export, clear-all, stats rendering,
// and version display. All persistence goes through lib/storage.js.

import { applyI18n, getMsg } from "./lib/i18n.js";
import {
  clearAll,
  exportData,
  getSettings,
  getStats,
  importData,
  loadState,
  setSettings,
} from "./lib/storage.js";

const $ = (id) => document.getElementById(id);

document.addEventListener("DOMContentLoaded", init);

async function init() {
  applyI18n(document);
  await renderAll();
  bindEvents();
}

function bindEvents() {
  $("auto-close").addEventListener("change", async (e) => {
    await setSettings({ autoClose: e.target.checked });
    showToast(getMsg("toastRenamed", undefined, "Saved"));
  });

  $("export-btn").addEventListener("click", onExport);
  $("import-btn").addEventListener("click", () => $("import-file").click());
  $("import-file").addEventListener("change", onImport);
  $("clear-btn").addEventListener("click", onClear);
}

async function renderAll() {
  const [settings, stats, state] = await Promise.all([
    getSettings(),
    getStats(),
    loadState(),
  ]);

  $("auto-close").checked = !!settings.autoClose;

  // Version
  const manifest = chrome.runtime.getManifest();
  $("version").textContent = `${manifest.version} · manifest v${manifest.manifest_version}`;

  // Data summary
  const sessions = state.sessions || [];
  const totalTabs = sessions.reduce((sum, s) => sum + (s.tabs?.length || 0), 0);
  $("data-summary").textContent = `${sessions.length} ${sessions.length === 1 ? "session" : "sessions"} · ${totalTabs} tabs stored locally`;

  // Stats
  $("stats-week-saves").textContent = String(stats.weekSaves || 0);
  $("stats-all-saves").textContent = String(stats.totalSaves || 0);
  $("stats-all-tabs").textContent = String(stats.totalTabs || 0);
}

async function onExport() {
  const state = await loadState();
  const payload = exportData(state);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const dt = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `tabpal-export-${dt}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast(getMsg("toastExported", undefined, "Export downloaded"));
}

async function onImport(e) {
  const file = e.target.files?.[0];
  e.target.value = ""; // allow re-import of same filename
  if (!file) return;
  try {
    const text = await file.text();
    const payload = JSON.parse(text);
    const added = await importData(payload, { merge: false });
    showToast(getMsg("toastImported", [String(added)], `Imported ${added} sessions`));
    await renderAll();
  } catch (err) {
    console.error("[TabPal] import failed", err);
    showToast(getMsg("toastImportFailed", undefined, "Import failed"));
  }
}

async function onClear() {
  const ok = window.confirm(getMsg("clearAllConfirm", undefined, "Delete every saved session?"));
  if (!ok) return;
  await clearAll();
  showToast(getMsg("toastCleared", undefined, "All data cleared"));
  await renderAll();
}

let toastTimer = null;
function showToast(msg) {
  const el = $("toast");
  el.textContent = msg;
  el.classList.add("show");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2000);
}
