// tabs.js — capture and restore Chrome tabs.
//
// "Capture" reads the current window's tabs and returns a lightweight Session
// object. "Restore" opens a new window and creates each tab. We never touch
// network, cookies, host_permissions, or scripting — the data stays local.

import { formatDateTime, getMsg } from "./i18n.js";
import { newId } from "./storage.js";

// Capture all tabs in the given window (defaults to current window).
// We only keep url/title/favIconUrl — pinned flag is preserved because some
// users rely on it, but no other tab metadata is stored.
export async function captureWindow(windowId) {
  const winId = windowId ?? (await currentWindowId());
  const tabs = await chrome.tabs.query({ windowId: winId });
  return tabs
    .filter((t) => t.url && !t.url.startsWith("chrome://")) // never persist internal pages
    .map((t) => ({
      url: t.url,
      title: t.title || t.url,
      favIconUrl: t.favIconUrl || "",
      pinned: !!t.pinned,
    }));
}

export async function currentWindowId() {
  const w = await chrome.windows.getCurrent({ populate: false });
  return w.id;
}

// Build a Session object from captured tabs. `name` is optional — when omitted
// we generate "35 tabs · 2024-08-29 13:14" in the user's locale.
export function buildSession(tabs, { name } = {}) {
  const now = Date.now();
  const dt = formatDateTime(now);
  const fallback = getMsg("defaultSessionName", [String(tabs.length), dt], `${tabs.length} tabs · ${dt}`);
  return {
    id: newId(),
    name: (name && name.trim()) || fallback,
    tabs,
    createdAt: now,
    updatedAt: now,
  };
}

// Close the captured tabs in their window. Chrome keeps a window alive as long
// as it has at least one tab, so this is safe even with one tab.
export async function closeTabs(tabIds) {
  if (!tabIds || tabIds.length === 0) return;
  try {
    await chrome.tabs.remove(tabIds);
  } catch (e) {
    console.warn("[TabPal] closeTabs failed", e);
  }
}

// Restore a session by opening each URL in a new window. The first URL becomes
// the active tab; the rest are created in the background. Returns the new
// window id.
export async function restoreSession(session) {
  if (!session || !Array.isArray(session.tabs) || session.tabs.length === 0) {
    throw new Error("Cannot restore an empty session.");
  }
  const first = session.tabs[0];
  const win = await chrome.windows.create({ url: first.url, focused: true });
  if (session.tabs.length > 1) {
    // Create remaining tabs sequentially so Chrome doesn't drop URLs under load.
    for (let i = 1; i < session.tabs.length; i++) {
      const t = session.tabs[i];
      try {
        await chrome.tabs.create({ windowId: win.id, url: t.url, active: false, pinned: !!t.pinned });
      } catch (e) {
        console.warn("[TabPal] failed to recreate tab", t.url, e);
      }
    }
  }
  return win.id;
}

// Full save flow: capture → close (if setting allows) → return ids to close.
export async function snapshotCurrentWindow({ autoClose }) {
  const winId = await currentWindowId();
  const tabs = await chrome.tabs.query({ windowId: winId });
  const captured = tabs
    .filter((t) => t.url && !t.url.startsWith("chrome://"))
    .map((t) => ({
      url: t.url,
      title: t.title || t.url,
      favIconUrl: t.favIconUrl || "",
      pinned: !!t.pinned,
      id: t.id,
    }));
  const session = buildSession(captured.map(({ id, ...rest }) => rest));
  const idsToClose = autoClose ? captured.map((t) => t.id) : [];
  return { session, idsToClose };
}
