# TabPal Privacy Policy

_Last updated: 2026-08-29_

TabPal ("the extension") is a Chrome / Edge extension that saves the tabs in
your current window so you can restore them later. This page explains exactly
what data the extension handles and where it goes.

## TL;DR

**Nothing leaves your machine.** All tab data — URLs, page titles, and favicons —
is stored locally in `chrome.storage.local` inside your browser profile. We do
not run any backend, do not collect telemetry, and do not call any third-party
service.

## What data the extension stores

| Field | Why we store it | Where it lives |
| --- | --- | --- |
| Tab URLs you choose to save | To restore them later | `chrome.storage.local` |
| Page titles you choose to save | To display the session in the popup | `chrome.storage.local` |
| Favicons | To display a small icon per tab | `chrome.storage.local` |
| Pinned state | To preserve your pinning on restore | `chrome.storage.local` |
| Session name + timestamps | To label and order sessions | `chrome.storage.local` |
| Settings (auto-close toggle) | To remember your preferences | `chrome.storage.local` |
| Aggregate counts (saves, tabs) | To show usage stats on the Settings page | `chrome.storage.local` |

We never read, store, or transmit:

- Cookies, passwords, autofill data, or form contents.
- Browsing history outside the tabs you explicitly save.
- Personal identifiers, IP addresses, or device fingerprints.

## Network usage

The extension itself **does not initiate any network request**. It does not
phone home, log analytics, or call remote APIs.

The only outbound network traffic that can occur is the unavoidable browser
behavior when restoring a session: Chrome must fetch the URLs you saved in
order to open them as tabs. That traffic goes from your browser to the URLs
themselves, exactly as if you had typed them in yourself.

## Permissions explained

The extension requests the minimum set of Chrome permissions:

- `tabs` — to read and create tabs in the current window.
- `storage` — to keep your saved sessions in `chrome.storage.local`.
- `activeTab` — to interact with the active tab when you click the toolbar icon.

We **do not** request `host_permissions`, `scripting`, `cookies`, or
`webRequest`. We never inject content scripts into pages.

## Where the data lives

`chrome.storage.local` is a per-extension, per-profile store managed by
Chrome itself. It is cleared when you:

- Uninstall TabPal.
- Use Chrome's "Clear browsing data → Cookies and other site data" with the
  "Extensions" option.
- Manually click **Clear all** on the Settings page.

It survives browser restarts and reinstalls of the extension (until you
explicitly remove it).

## Data export and import

The Settings page lets you export every saved session as a JSON file and
re-import it. The file stays on your machine unless you choose to share it.

## Children

TabPal is a general-purpose productivity extension. It is not directed at
children under 13 and does not knowingly collect data from children.

## Changes to this policy

If we ever change what the extension does with your data, we will update this
file and bump the version number in `manifest.json`. Material changes will
also be called out in the extension's release notes.

## Contact

Found a privacy issue? Open a ticket at
<https://github.com/xie-tw/tabpal/issues> or email the maintainer through the
GitHub profile.
