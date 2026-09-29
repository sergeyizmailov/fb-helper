# FB Helper 2.1.0

[![CI](https://github.com/slilbudget/fb-helper/actions/workflows/ci.yml/badge.svg)](https://github.com/slilbudget/fb-helper/actions/workflows/ci.yml) [![Release](https://img.shields.io/github/v/release/slilbudget/fb-helper)](https://github.com/slilbudget/fb-helper/releases/latest) [![License: MIT](https://img.shields.io/github/license/slilbudget/fb-helper)](LICENSE)

![FB Helper — token, cookies and ad accounts](docs/cover.png)

Chrome extension (MV3): Facebook access token, session cookies and ad account status in one popup. Read-only — it never changes anything in your ads.

## Install

1. Download `fb-helper-2.1.0.zip` from [Releases](https://github.com/slilbudget/fb-helper/releases/latest) and unpack (or `git clone`)
2. `chrome://extensions` → enable **Developer mode**
3. **Load unpacked** → pick the unpacked folder (keep the folder after installing)

Chrome 121+. A Facebook tab must be open in the same profile; the ads token (EAAB) comes from `adsmanager.facebook.com`.

## Features

- **Language** — English and Russian, `RU · EN` toggle in the header. The first run follows the browser's UI language; after that the choice is yours, stored in `chrome.storage.local`, and survives a browser restart. English account statuses and disable reasons use the Marketing API names (`Unsettled`, `Ads integrity policy`, …), the same as Ads Manager.
- **Token** — reads the token from the open FB tab and shows its type: EAAB (Ads Manager), EAAI (Automated Rules), EAAG (Business Manager), EAAH (Commerce Manager), EAAd (Events Manager). Each type links to the page where that token lives. **Check** shows the profile, the app and the permissions behind the token. The refresh button next to the field re-reads the token from the FB tab (and lets you retry a token that was reported dead).
- **Cookies** — as a header string or as JSON with attributes for importing into a browser profile; **Token + cookies** copies both in one block, after one `/me` read confirms the token belongs to the logged-in user (`c_user`). A token from another account is not copied.
- **Ad accounts** — status, disable reason, spend per period (today / yesterday / 7 / 30 days / all time — the larger of Meta's own total, which lags behind, and the last 30 days + today), clicks and CPC, daily limit, billing threshold, payment method, pixels, business owner; ads with statuses and rejection reasons (every reason with the placement it applies to; disapproved ads first). The loaded list and ads are kept until the browser closes and survive FB tab or token changes; logging in as another FB user drops them.

## Safety and limits

- Requests go only to `graph.facebook.com`: on a button press, or once when you first open the **Ad accounts** tab after opening the popup (it loads the list by itself, so you don't have to find the refresh button; later visits to the tab don't reload it). The token is shown only while an open Facebook tab has it and is never stored beyond the browser session.
- The account list refreshes at most once a minute (that slot is shared by the automatic load, the refresh button and every open popup; the automatic load is skipped during an API pause and with a dead session), one account's ads at most once per 30 s. On an API rate-limit error all requests stop for 30 min. On a dead session (error 190, subcodes 459 / 460 / 463 / 467) requests with that token stop until Facebook hands out a new one.
- Graph API version: `v26.0`. When Meta retires it, the extension switches to the newer version Graph names.

## Build the archive

An explicit list of what ships, so stray files in the folder never end up in the zip:

```
zip -qrD fb-helper-2.1.0.zip manifest.json popup.html css js fonts images LICENSE README.md SECURITY.md CONTRIBUTING.md -x '*.DS_Store'
```

## Tests

```
node --test test/*.test.mjs   # unit tests, no browser (CI runs these)
node test/e2e.mjs             # real Chromium + the unpacked extension, Facebook and Graph mocked; needs playwright-core
```

Icons: Lucide (ISC). Font: Golos Text (SIL OFL 1.1). Licenses sit next to the files.

[MIT](LICENSE) · [Security](SECURITY.md) · [Contributing](CONTRIBUTING.md)
