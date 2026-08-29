// test/smoke.mjs — lightweight smoke tests for the pure parts of lib/.
// Run with `node test/smoke.mjs`. No test framework; we use node:assert.
//
// We mock chrome.* so storage.js / tabs.js / i18n.js can be loaded as ES
// modules outside the extension runtime. The tests cover:
//   - storage defaults & merge behavior
//   - addSession bumps stats correctly
//   - export/import roundtrip preserves data
//   - relativeTime returns the right bucket
//   - defaultSessionName placeholder substitution

import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

// ---- chrome stub --------------------------------------------------------
const store = new Map();
globalThis.chrome = {
  storage: {
    local: {
      async get(key) {
        if (typeof key === "string") return { [key]: store.get(key) };
        if (Array.isArray(key)) {
          const out = {};
          for (const k of key) out[k] = store.get(k);
          return out;
        }
        if (key == null) {
          const out = {};
          for (const [k, v] of store) out[k] = v;
          return out;
        }
        return {};
      },
      async set(obj) {
        for (const [k, v] of Object.entries(obj)) store.set(k, v);
      },
      async remove(keys) {
        const list = Array.isArray(keys) ? keys : [keys];
        for (const k of list) store.delete(k);
      },
    },
  },
  i18n: {
    getMessage(key, subs) {
      const messages = {
        justNow: "just now",
        minutesAgo: "$1 min ago",
        hoursAgo: "$1 h ago",
        daysAgo: "$1 d ago",
        defaultSessionName: "$1 tabs · $2",
      };
      let s = messages[key] ?? "";
      if (Array.isArray(subs)) {
        subs.forEach((v, i) => {
          s = s.replace(new RegExp(`\\$${i + 1}`, "g"), v);
        });
      }
      return s;
    },
  },
  runtime: {
    async getURL(p) { return p; },
    getManifest() { return { version: "0.1.0", manifest_version: 3 }; },
    async openOptionsPage() {},
    async sendMessage() { return { ok: true }; },
    onInstalled: { addListener() {} },
    onMessage: { addListener() {} },
  },
  windows: {
    async getCurrent() { return { id: 1 }; },
    async create() { return { id: 99 }; },
  },
  tabs: {
    async query() { return []; },
    async create() { return { id: 1 }; },
    async remove() {},
  },
};

// ---- Tests --------------------------------------------------------------
const storage = await import(path.join(root, "lib/storage.js"));
const i18n = await import(path.join(root, "lib/i18n.js"));

let pass = 0;
async function t(name, fn) {
  try {
    await fn();
    console.log("  ✓", name);
    pass++;
  } catch (e) {
    console.error("  ✗", name);
    console.error("   ", e.message);
    process.exitCode = 1;
  }
}

console.log("storage:");
await t("loadState returns defaults on empty store", async () => {
  store.clear();
  const s = await storage.loadState();
  assert.deepEqual(s.sessions, []);
  assert.equal(s.settings.autoClose, true);
  assert.equal(s.stats.totalSaves, 0);
});

await t("addSession persists and bumps stats", async () => {
  store.clear();
  const session = {
    id: "abc",
    name: "test",
    tabs: [{ url: "https://a", title: "A" }, { url: "https://b", title: "B" }],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await storage.addSession(session);
  const all = await storage.listSessions();
  assert.equal(all.length, 1);
  assert.equal(all[0].id, "abc");
  const stats = await storage.getStats();
  assert.equal(stats.totalSaves, 1);
  assert.equal(stats.totalTabs, 2);
  assert.equal(stats.weekSaves, 1);
});

await t("addSession caps history at 200 entries", async () => {
  store.clear();
  for (let i = 0; i < 205; i++) {
    await storage.addSession({
      id: "s" + i,
      name: "s" + i,
      tabs: [{ url: "u", title: "t" }],
      createdAt: i,
      updatedAt: i,
    });
  }
  const all = await storage.listSessions();
  assert.equal(all.length, 200);
  // newest first
  assert.equal(all[0].id, "s204");
});

await t("updateSession patches a session", async () => {
  store.clear();
  await storage.addSession({
    id: "x", name: "old", tabs: [{ url: "u", title: "t" }], createdAt: 1, updatedAt: 1,
  });
  const updated = await storage.updateSession("x", { name: "new" });
  assert.equal(updated.name, "new");
  assert.ok(updated.updatedAt >= 1);
});

await t("removeSession drops a session", async () => {
  store.clear();
  await storage.addSession({
    id: "z", name: "z", tabs: [{ url: "u", title: "t" }], createdAt: 1, updatedAt: 1,
  });
  await storage.removeSession("z");
  assert.equal((await storage.listSessions()).length, 0);
});

await t("setSettings merges with existing settings", async () => {
  store.clear();
  await storage.setSettings({ autoClose: false });
  assert.equal((await storage.getSettings()).autoClose, false);
  await storage.setSettings({}); // no-op shouldn't reset
  assert.equal((await storage.getSettings()).autoClose, false);
});

await t("export + import roundtrip", async () => {
  store.clear();
  const session = {
    id: "rt", name: "rt",
    tabs: [{ url: "https://x", title: "X" }],
    createdAt: 1, updatedAt: 1,
  };
  await storage.addSession(session);
  const state = await storage.loadState();
  const payload = storage.exportData(state);
  assert.equal(payload.sessions[0].id, "rt");

  store.clear();
  const added = await storage.importData(payload);
  assert.equal(added, 1);
  const restored = await storage.listSessions();
  assert.equal(restored.length, 1);
  assert.equal(restored[0].id, "rt");
});

await t("importData rejects payloads without sessions array", async () => {
  await assert.rejects(() => storage.importData({}), /missing sessions array/);
});

console.log("i18n:");
await t("relativeTime bucketing", async () => {
  const now = Date.now();
  assert.equal(i18n.relativeTime(now - 5_000), "just now");
  assert.equal(i18n.relativeTime(now - 5 * 60_000), "5 min ago");
  assert.equal(i18n.relativeTime(now - 3 * 60 * 60_000), "3 h ago");
  assert.equal(i18n.relativeTime(now - 2 * 24 * 60 * 60_000), "2 d ago");
});

await t("formatDateTime produces YYYY-MM-DD HH:MM", async () => {
  const ts = new Date(2024, 7, 29, 13, 14).getTime();
  assert.equal(i18n.formatDateTime(ts), "2024-08-29 13:14");
});

await t("getMsg falls back gracefully when key is missing", async () => {
  const out = i18n.getMsg("nonexistent_key", undefined, "FB");
  assert.equal(out, "FB");
});

await t("getMsg applies placeholders", async () => {
  const out = i18n.getMsg("defaultSessionName", ["35", "2024-08-29 13:14"], "fallback");
  assert.equal(out, "35 tabs · 2024-08-29 13:14");
});

console.log(`\n${pass} tests passed`);
if (process.exitCode) {
  console.error("FAILURES");
} else {
  console.log("OK");
}
