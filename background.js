// background.js — MV3 service worker.
//
// The popup handles most UI; this worker exists so MV3 sees a registered
// background script and so future features (e.g. shortcuts, context menus)
// have somewhere to live. Today it just forwards a tiny ping.

chrome.runtime.onInstalled.addListener(() => {
  // No-op for MVP. Kept so we can verify install state in DevTools.
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "ping") {
    sendResponse({ ok: true, ts: Date.now() });
    return false;
  }
  return false;
});
