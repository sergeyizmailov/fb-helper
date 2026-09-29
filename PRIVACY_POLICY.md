# Privacy Policy — Ads Helper

Last updated: 2026-09-30

Ads Helper is a Chrome extension that shows, for the Facebook profile you are logged in to in your own browser, the access token, the session cookies and the status and spend of your ad accounts. This policy describes exactly what the extension does with data.

**Short version:** everything happens in your browser. The developer has no server and receives no data. The only network requests the extension makes go from your browser to `graph.facebook.com` (Meta's own API), and only when you use the extension.

## What the extension handles

| Data | Where it comes from | What happens to it |
|---|---|---|
| Facebook access token | Read from the Facebook tab you have open (the page's own script variables and HTML) | Shown in the popup; kept in `chrome.storage.session`; sent to `graph.facebook.com` as an `Authorization` header to read your ad accounts; copied to the clipboard only when you press a copy button |
| Facebook session cookies | `chrome.cookies` for `facebook.com` | Shown in the popup; copied to the clipboard (as a header string or JSON) only when you press a copy button. The `c_user` cookie is also read to notice that you switched Facebook accounts, so cached data of the previous account is dropped |
| Profile, app and permission data | `graph.facebook.com` (`me`, `app`, `me/permissions`) | Shown in the popup when you press **Check** or copy **Token + cookies** (one `me` read confirms the token belongs to the logged-in user) |
| Ad account data: names, IDs, status, disable reason, spend, clicks, limits, payment-method label, pixels, business owner, ads and their review status | `graph.facebook.com` (`me/adaccounts`, `act_<id>/ads`) | Shown in the popup; cached in `chrome.storage.session` |
| Settings: interface language, newer Graph API version learned from Meta, last open tab and spend period | Your choices / Meta's API responses | `chrome.storage.local` (language, API version) and the popup's `localStorage` (tab, period) |

The token and cookies are authentication data. The extension treats them as such: they are never written to disk by the extension, never logged, never sent anywhere except as described above.

## Network requests

- Requests go only to `https://graph.facebook.com/` and are read-only (`GET`). The extension cannot create, change or delete anything in your ads. This is enforced by the extension's Content Security Policy (`connect-src https://graph.facebook.com`).
- Requests are made when you press a button, when you open the **Ad accounts** tab with nothing loaded yet, or after you reloaded the Facebook page the token came from. Reopening the popup or switching tabs alone sends nothing.
- Requests are rate-limited by the extension (accounts once a minute, one account's ads once per 30 seconds, a 30-minute pause after a Meta rate-limit error).
- Because the request is made from your logged-in browser, the browser attaches your Facebook cookies to it, exactly as when you use facebook.com. Meta's handling of that data is governed by Meta's own privacy policy.

## What the extension does not do

- It does not send data to the developer or to any third party. No analytics, no telemetry, no crash reports, no advertising, no tracking.
- It does not sell data, does not use or transfer it for purposes unrelated to the single purpose above, and does not use it to determine creditworthiness or for lending.
- It does not load or run remote code. All scripts are inside the extension package. Fonts are bundled, not loaded from a font service.
- It does not read pages other than Facebook pages, and it does not read your browsing history.
- Humans do not read your data: the developer never receives it.

## Storage and retention

- Token, account cache, ads cache, rate-limit counters: `chrome.storage.session`. It lives in memory and is deleted when the browser closes or the extension is reloaded or updated.
- Language and Graph API version: `chrome.storage.local`, until you remove the extension.
- Last open tab and spend period: popup `localStorage`, until you remove the extension.
- Removing the extension deletes all of it. Cached accounts are also dropped when you log in to Facebook as a different user.

## Permissions

- `cookies` — read Facebook cookies to show and copy them on your request, and `c_user` to detect an account switch.
- `storage` — keep the session cache and your language choice.
- `scripting` — run a bundled function in your open Facebook tab to find the access token that Facebook's own page holds.
- Host access `https://*.facebook.com/*` — the tabs the token is read from, the cookies, and the Graph API (`graph.facebook.com`). No other site is accessible.

## Compliance with the Chrome Web Store User Data Policy

The use of information received from Chrome APIs and from Facebook pages adheres to the [Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq), including the Limited Use requirements.

## Your control

Remove the extension to delete everything it stored. Log out of Facebook to make the extension drop the cached accounts. Revoke or change your Facebook session and tokens in Facebook itself.

## Not affiliated with Meta

Ads Helper is an independent product. It is not affiliated with, endorsed by or sponsored by Meta Platforms, Inc. Facebook and Meta are trademarks of Meta Platforms, Inc.

## Changes and contact

Changes to this policy are published in this file with a new date. The source code is open: <https://github.com/slilbudget/fb-helper>. Questions and reports: <https://github.com/slilbudget/fb-helper/issues> (security issues: Security → Report a vulnerability in the same repository).

---

# Политика конфиденциальности — Ads Helper

Обновлено: 30.09.2026

Ads Helper показывает для профиля Facebook, в который вы вошли в своём браузере, токен доступа, cookie сессии и статус и расход рекламных кабинетов. Всё происходит в вашем браузере. У разработчика нет сервера, и он не получает никаких данных.

- **Что обрабатывается:** токен (читается из открытой вкладки Facebook), cookie facebook.com, данные профиля, приложения и прав токена (`me`, `app`, `me/permissions`), данные кабинетов и объявлений (`me/adaccounts`, `act_<id>/ads`), язык интерфейса, версия Graph API, последняя открытая вкладка и период.
- **Куда уходит:** только запросы `GET` из вашего браузера на `graph.facebook.com`, только на чтение. Токен уходит туда в заголовке `Authorization`; браузер, как и на facebook.com, прикладывает ваши cookie Facebook. Запросы идут по кнопке, при первом открытии вкладки «Ad accounts» без загруженных данных или после перезагрузки страницы Facebook. Повторное открытие окна и переключение вкладок ничего не отправляют. Частота ограничена самим расширением.
- **В буфер обмена** токен и cookie попадают только когда вы сами нажали кнопку копирования.
- **Хранение:** токен и кэш кабинетов — `chrome.storage.session` (в памяти, стираются при закрытии браузера, перезагрузке или обновлении расширения); язык и версия API — `chrome.storage.local`; последняя вкладка и период — `localStorage` окна. Удаление расширения стирает всё. Кэш кабинетов сбрасывается и при входе в другой аккаунт Facebook.
- **Чего нет:** передачи данных разработчику или третьим лицам, аналитики, телеметрии, рекламы, продажи данных, удалённого кода, чтения других сайтов и истории браузера.
- **Доступы:** `cookies`, `storage`, `scripting` и только `https://*.facebook.com/*`.
- **Не связано с Meta:** Ads Helper — независимый продукт, не связан с Meta Platforms, Inc., не одобрен и не спонсируется ею. Facebook и Meta — товарные знаки Meta Platforms, Inc.
- **Связь:** <https://github.com/slilbudget/fb-helper/issues>.
