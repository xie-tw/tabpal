# TabPal

> One-tap save and restore your Chrome tabs. Minimal, no login, fully local.

TabPal is a tiny Chrome / Edge extension (Manifest V3) that lets you park every
tab in the current window into a named session and reopen the whole batch in
one click. It is designed for the 30-to-80-tab "tab anxiety" workflow: keep
research windows around without keeping the tabs themselves open.

- 🚀 **One click** to save every tab in the current window.
- 🪟 **One click** to restore a session in a fresh window.
- 🌗 Light & dark UI, English + 中文 localization.
- 🔒 **100% local.** Nothing is uploaded anywhere. Ever.
- 🪶 Manifest V3, minimal permissions (`tabs`, `storage`, `activeTab`).

## Features

| Where | What it does |
| --- | --- |
| Popup | "Save _N_ tabs" button + list of recent sessions with restore / rename / delete + footer stats |
| Settings page | Auto-close toggle, JSON import / export, clear all, weekly + all-time stats, version, feedback link |
| Storage | All sessions live in `chrome.storage.local`; exportable as JSON; never leaves your machine |

## Install (development / unpacked)

1. Clone this repository.
2. Open `chrome://extensions/` (or `edge://extensions/`).
3. Toggle **Developer mode** on (top right).
4. Click **Load unpacked** and pick this folder.
5. Pin the TabPal icon from the puzzle-piece menu.

> Headed Web Store submission is owned by PM — see `PRIVACY.md` for the
> Chrome Web Store compliance notes.

## Permissions

The manifest asks for only what the popup needs to do its job:

| Permission | Why |
| --- | --- |
| `tabs` | Query and create tabs in the current window |
| `storage` | Persist saved sessions to `chrome.storage.local` |
| `activeTab` | Interact with the active tab from the toolbar action |

We deliberately **do not** request `host_permissions`, `scripting`,
`cookies`, `webRequest`, or `tabs` access to all URLs — that minimizes the
review surface and keeps the extension safe to install.

## Project layout

```
tabpal/
├── manifest.json
├── background.js           # MV3 service worker (thin)
├── popup.html / popup.js / popup.css
├── options.html / options.js / options.css
├── lib/
│   ├── i18n.js             # chrome.i18n helpers + relative time
│   ├── storage.js          # chrome.storage.local CRUD + import/export
│   └── tabs.js             # capture / restore / close helpers
├── _locales/
│   ├── en/messages.json
│   └── zh_CN/messages.json
├── icons/                  # 16/32/48/128 px placeholders
├── PRIVACY.md
└── README.md
```

## Privacy

TabPal does not call any network endpoint, does not run a backend, and does
not use analytics. All saved sessions live in your browser's local storage
and are wiped when you uninstall the extension. See [`PRIVACY.md`](./PRIVACY.md)
for the full policy — Chrome Web Store listing links to that file.

## Development

The extension is plain ES modules — no build step. Edit a file, hit the
reload button on `chrome://extensions/`, and your changes are live.

```bash
# Lint the locale JSON files
python3 -c "import json; json.load(open('_locales/en/messages.json'))"
python3 -c "import json; json.load(open('_locales/zh_CN/messages.json'))"

# Validate the manifest
python3 -c "import json; json.load(open('manifest.json'))"
```

## Roadmap (V1.1+)

These are explicitly **out of scope** for the MVP — see STUD-70:

- ❌ Account system
- ❌ Cross-device sync
- ❌ AI-powered grouping
- ❌ Tab Groups integration
- ❌ Firefox / Safari support
- ❌ Chrome Web Store auto-publish

## Feedback

Open an issue at <https://github.com/xie-tw/tabpal/issues> — bug reports,
feature ideas, and privacy concerns are all welcome.

## License

MIT — see [`LICENSE`](./LICENSE).
