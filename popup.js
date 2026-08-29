// popup.js — wires up the popup UI: save button, session list, footer stats,
// toast notifications, and a small import helper (export is also reachable
// from the options page).

import { applyI18n, getMsg, relativeTime } from "./lib/i18n.js";
import {
  addSession,
  getSettings,
  listSessions,
  removeSession,
  updateSession,
} from "./lib/storage.js";
import {
  closeTabs,
  currentWindowId,
  restoreSession,
  snapshotCurrentWindow,
} from "./lib/tabs.js";

const $ = (id) => document.getElementById(id);

let editingId = null;
let currentTabCount = 0;

document.addEventListener("DOMContentLoaded", init);

async function init() {
  applyI18n(document);
  await refreshTabCount();
  await render();
  bindEvents();
}

async function refreshTabCount() {
  try {
    const winId = await currentWindowId();
    const tabs = await chrome.tabs.query({ windowId: winId });
    currentTabCount = tabs.filter((t) => t.url && !t.url.startsWith("chrome://")).length;
  } catch {
    currentTabCount = 0;
  }
  updateSaveButton();
}

function updateSaveButton() {
  const btn = $("save-btn");
  const label = $("save-btn-label");
  btn.disabled = currentTabCount === 0;
  if (currentTabCount === 0) {
    label.textContent = getMsg("noTabs", undefined, "No tabs to save");
    $("save-btn-hint").textContent = "";
  } else if (currentTabCount === 1) {
    label.textContent = getMsg("saveOneTab", undefined, "Save 1 tab");
    $("save-btn-hint").textContent = "";
  } else {
    label.textContent = getMsg("saveTabs", [String(currentTabCount)], `Save ${currentTabCount} tabs`);
    $("save-btn-hint").textContent = "";
  }
}

function bindEvents() {
  $("save-btn").addEventListener("click", onSave);
  $("open-options").addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
    window.close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && editingId) {
      cancelEdit();
    }
  });
}

async function onSave() {
  if (currentTabCount === 0) return;
  const btn = $("save-btn");
  btn.disabled = true;
  try {
    const settings = await getSettings();
    const { session, idsToClose } = await snapshotCurrentWindow({ autoClose: settings.autoClose });
    if (!session.tabs.length) {
      showToast(getMsg("noTabs", undefined, "No tabs to save"));
      return;
    }
    await addSession(session);
    if (settings.autoClose && idsToClose.length) {
      await closeTabs(idsToClose);
      // Window may close; refresh tab count after a tick.
      setTimeout(refreshTabCount, 250);
    }
    showToast(getMsg("toastSaved", [String(session.tabs.length)], `Saved ${session.tabs.length} tabs`));
    await render();
  } catch (e) {
    console.error("[TabPal] save failed", e);
    showToast(String(e?.message || e));
  } finally {
    btn.disabled = currentTabCount === 0;
  }
}

async function onRestore(id) {
  const list = await listSessions();
  const session = list.find((s) => s.id === id);
  if (!session) return;
  try {
    await restoreSession(session);
    showToast(getMsg("toastRestored", [String(session.tabs.length)], `Restored ${session.tabs.length} tabs`));
    window.close();
  } catch (e) {
    console.error("[TabPal] restore failed", e);
    showToast(String(e?.message || e));
  }
}

function onRenameStart(id, currentName) {
  if (editingId && editingId !== id) cancelEdit();
  editingId = id;
  const li = document.querySelector(`[data-id="${id}"]`);
  if (!li) return;
  li.classList.add("editing");
  const nameEl = li.querySelector(".session-name");
  nameEl.innerHTML = "";
  const input = document.createElement("input");
  input.type = "text";
  input.value = currentName;
  input.maxLength = 120;
  nameEl.appendChild(input);
  input.focus();
  input.select();
  const finish = async (commit) => {
    if (!editingId) return;
    const newName = input.value.trim();
    if (commit && newName && newName !== currentName) {
      await updateSession(id, { name: newName });
      showToast(getMsg("toastRenamed", undefined, "Session renamed"));
    }
    editingId = null;
    await render();
  };
  input.addEventListener("blur", () => finish(true));
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      finish(true);
    } else if (e.key === "Escape") {
      e.preventDefault();
      finish(false);
    }
  });
}

function cancelEdit() {
  editingId = null;
  render();
}

async function onDelete(id) {
  await removeSession(id);
  showToast(getMsg("toastDeleted", undefined, "Session deleted"));
  await render();
}

// ---------- Rendering ----------

async function render() {
  const list = await listSessions();
  const ul = $("session-list");
  const empty = $("empty-state");
  ul.innerHTML = "";

  if (list.length === 0) {
    empty.hidden = false;
    ul.hidden = true;
  } else {
    empty.hidden = true;
    ul.hidden = false;
    const frag = document.createDocumentFragment();
    list.slice(0, 10).forEach((s) => frag.appendChild(buildSessionRow(s)));
    ul.appendChild(frag);
  }

  // Footer stats
  const stats = $("footer-stats");
  const totalTabs = list.reduce((sum, s) => sum + (s.tabs?.length || 0), 0);
  stats.textContent = getMsg(
    "footerStats",
    [String(list.length), String(totalTabs)],
    `${list.length} sessions · ${totalTabs} tabs saved`,
  );
}

function buildSessionRow(s) {
  const li = document.createElement("li");
  li.className = "session";
  li.setAttribute("data-id", s.id);

  const row = document.createElement("div");
  row.className = "session-row";

  const name = document.createElement("div");
  name.className = "session-name";
  name.textContent = s.name;
  name.title = s.name;

  const count = document.createElement("span");
  count.className = "session-count";
  count.textContent = getMsg("tabCount", [String(s.tabs.length)], `${s.tabs.length} tabs`);

  row.appendChild(name);
  row.appendChild(count);
  li.appendChild(row);

  const meta = document.createElement("div");
  meta.className = "session-meta";
  meta.textContent = relativeTime(s.updatedAt || s.createdAt);
  li.appendChild(meta);

  const actions = document.createElement("div");
  actions.className = "session-actions";

  const restoreBtn = document.createElement("button");
  restoreBtn.type = "button";
  restoreBtn.className = "btn-restore";
  restoreBtn.textContent = getMsg("restore", undefined, "Restore");
  restoreBtn.addEventListener("click", () => onRestore(s.id));

  const renameBtn = document.createElement("button");
  renameBtn.type = "button";
  renameBtn.textContent = getMsg("rename", undefined, "Rename");
  renameBtn.addEventListener("click", () => onRenameStart(s.id, s.name));

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "btn-delete";
  deleteBtn.textContent = getMsg("delete", undefined, "Delete");
  deleteBtn.addEventListener("click", () => onDelete(s.id));

  actions.append(restoreBtn, renameBtn, deleteBtn);
  li.appendChild(actions);
  return li;
}

// ---------- Toast ----------

let toastTimer = null;
function showToast(msg) {
  const el = $("toast");
  el.textContent = msg;
  el.classList.add("show");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 1800);
}
