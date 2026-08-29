// i18n.js — thin wrapper around chrome.i18n with safe fallbacks for tests.
// All UI strings live in _locales/<lang>/messages.json and are loaded by Chrome.
// `getMsg` returns the localized message, falling back to the supplied default
// (and warning once) so the popup still renders if a key is missing.

const warned = new Set();

export function getMsg(key, substitutions, fallback = "") {
  try {
    const msg = chrome?.i18n?.getMessage(key, substitutions);
    if (msg) return msg;
  } catch (_) {
    /* not running inside an extension — fall through */
  }
  if (!warned.has(key)) {
    warned.add(key);
    // eslint-disable-next-line no-console
    console.warn(`[TabPal] missing i18n key: ${key}`);
  }
  return fallback || key;
}

// Apply i18n to every element with `data-i18n` (text) or
// `data-i18n-placeholder` (placeholder). Runs after DOMContentLoaded.
export function applyI18n(root = document) {
  root.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    el.textContent = getMsg(key, undefined, el.textContent || "");
  });
  root.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const key = el.getAttribute("data-i18n-placeholder");
    el.setAttribute("placeholder", getMsg(key, undefined, el.getAttribute("placeholder") || ""));
  });
  root.querySelectorAll("[data-i18n-title]").forEach((el) => {
    const key = el.getAttribute("data-i18n-title");
    el.setAttribute("title", getMsg(key, undefined, el.getAttribute("title") || ""));
  });
  // <title> tag
  const titleEl = root.querySelector("title[data-i18n]");
  if (titleEl) {
    document.title = getMsg(titleEl.getAttribute("data-i18n"), undefined, document.title);
  }
}

// Format a session timestamp as a friendly relative string. Uses the current
// locale so the popup renders "just now" / "3 min ago" / "2 h ago" / "1 d ago".
export function relativeTime(ts) {
  if (!ts) return "";
  const diff = Date.now() - ts;
  if (diff < 60_000) return getMsg("justNow", undefined, "just now");
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return getMsg("minutesAgo", [String(minutes)], `${minutes} min ago`);
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return getMsg("hoursAgo", [String(hours)], `${hours} h ago`);
  const days = Math.floor(hours / 24);
  return getMsg("daysAgo", [String(days)], `${days} d ago`);
}

// "2024-08-29 13:14" in the user's locale (uses local date formatting).
export function formatDateTime(ts) {
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
         `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
