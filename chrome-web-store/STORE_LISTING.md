# Chrome Web Store listing — Ads Helper 2.2.0

Copy each block into the Developer Dashboard. Every statement below matches the code of this version.

## Store listing tab

**Name** (shown from the manifest, max 75): `Ads Helper`

**Summary** (comes from the manifest `description`, max 132 chars; 121 used):
```
Facebook token, session cookies and ad account status. Requests go only to graph.facebook.com, with built-in rate limits.
```

**Category:** Tools (alternative: Workflow & Planning)

**Language:** English (the popup itself is English and Russian; add a Russian description below if you want a Russian listing)

**Detailed description (English):**
```
Ads Helper shows three things about the Facebook profile you are logged in to in this browser: the access token, the session cookies, and the status and spend of your ad accounts. It is read-only: it never creates, edits or deletes anything in your ads.

WHAT IT DOES
• Token: reads the access token from a Facebook tab you already have open and shows its type (EAAB Ads Manager, EAAI Automated Rules, EAAG Business Manager, EAAH Commerce Manager, EAAd Events Manager). "Check" shows the profile, the app and the permissions behind the token. One click copies it.
• Cookies: the Facebook session cookies of this browser profile, as a header string or as JSON. "Token + cookies" copies both in one block, after confirming the token belongs to the logged-in user.
• Ad accounts: every ad account of the profile with status, disable reason, spend for today / yesterday / 7 / 30 days / all time, clicks and CPC, daily limit, billing threshold, payment method label, pixels and business owner. Search; active accounts first, then by spend; one button copies the IDs of all active accounts.
• Ads: the ads of an account with their statuses and review results, every rejection reason with the placement it applies to, disapproved ads first, and each ad's spend, impressions, clicks and CPC for the selected period, including all time.
• English and Russian interface.

PRIVACY AND SAFETY
• Everything happens in your browser. There is no developer server, no analytics, no ads, no tracking. Nothing is sent to the developer.
• The only network requests go from your browser to graph.facebook.com (Meta's own API), read-only, and only when you use the extension: on a button press, when you open the Ad accounts tab with nothing loaded yet, or after you reloaded the Facebook page. Opening the popup again or switching tabs sends nothing.
• Built-in limits protect your token: the account list refreshes at most once a minute, one account's ads at most once per 30 seconds, and after a Meta rate-limit error every request pauses for 30 minutes. A dead session stops all requests with that token.
• Token, cookies and cached accounts stay in the browser's session storage and disappear when the browser closes. The token and cookies reach the clipboard only when you press a copy button.
• No remote code. The source code is open: https://github.com/slilbudget/fb-helper

IMPORTANT
The token and cookies are the keys to your Facebook session. Copy them only to places you trust, and never share them with anyone you do not trust with your account.

Ads Helper is an independent product. It is not affiliated with, endorsed by or sponsored by Meta Platforms, Inc. Facebook and Meta are trademarks of Meta Platforms, Inc.
```

**Detailed description (Russian, optional):**
```
Ads Helper показывает три вещи о профиле Facebook, в который вы вошли в этом браузере: токен доступа, cookie сессии, статус и расход рекламных кабинетов. Только чтение: ничего не создаёт, не меняет и не удаляет в вашей рекламе.

ЧТО УМЕЕТ
• Токен: читает токен из уже открытой вкладки Facebook и показывает его тип (EAAB, EAAI, EAAG, EAAH, EAAd). «Проверить» показывает профиль, приложение и права токена. Копируется одним кликом.
• Cookie: cookie сессии Facebook этого профиля браузера строкой заголовка или JSON. «Токен + cookie» копирует всё одним блоком, предварительно убедившись, что токен принадлежит вошедшему пользователю.
• Кабинеты: все рекламные кабинеты профиля со статусом, причиной блокировки, расходом за сегодня / вчера / 7 / 30 дней / всё время, кликами и CPC, дневным лимитом, порогом оплаты, способом оплаты, пикселями и владельцем БМ. Поиск; сначала активные, затем по расходу; одна кнопка копирует ID всех активных кабинетов.
• Объявления: объявления кабинета со статусами и результатом проверки, каждая причина отклонения с плейсментом, отклонённые сверху, и расход, показы, клики и CPC по каждому объявлению за выбранный период, включая всё время.
• Интерфейс на русском и английском.

КОНФИДЕНЦИАЛЬНОСТЬ
• Всё происходит в вашем браузере. Нет сервера разработчика, аналитики, рекламы и трекинга. Разработчику ничего не отправляется.
• Единственные запросы идут из браузера на graph.facebook.com (API самой Meta), только на чтение и только когда вы пользуетесь расширением: по кнопке, при открытии вкладки «Ad accounts» без загруженных данных или после перезагрузки страницы Facebook. Повторное открытие окна и переключение вкладок ничего не отправляют.
• Встроенные лимиты берегут токен: список кабинетов не чаще раза в минуту, объявления кабинета не чаще раза в 30 секунд, после ошибки лимита Meta все запросы стоят 30 минут. Закрытая сессия останавливает запросы с этим токеном.
• Токен, cookie и кэш кабинетов лежат в session storage браузера и исчезают при закрытии. В буфер обмена они попадают только по вашей кнопке копирования.
• Удалённого кода нет. Исходный код открыт: https://github.com/slilbudget/fb-helper

ВАЖНО
Токен и cookie — ключи от вашей сессии Facebook. Копируйте их только туда, где доверяете, и не передавайте тем, кому не доверили бы аккаунт.

Ads Helper — независимый продукт, не связан с Meta Platforms, Inc., не одобрен и не спонсируется ею. Facebook и Meta — товарные знаки Meta Platforms, Inc.
```

**Official URL / Homepage / Support URL:** `https://github.com/slilbudget/fb-helper` (issues: `.../issues`)

**Privacy policy URL:** `https://github.com/slilbudget/fb-helper/blob/main/PRIVACY_POLICY.md` (the file must be pushed to `main` first)

---

## Privacy practices tab

**Single purpose description:**
```
View the status and spend of the ad accounts of the Facebook profile the user is logged in to, in one read-only popup. The popup uses the session already open in the browser: it also shows the profile's access token and session cookies and can copy them on request.
```

### Permission justifications

**cookies**
```
Reads the user's own facebook.com cookies to show them in the popup and to copy them when the user presses a button. The c_user cookie also tells the extension that another account logged in, so the previous account's cached data is dropped. Cookies go nowhere except to Facebook itself, attached by the browser to requests to graph.facebook.com.
```

**storage**
```
Keeps the loaded ad account list and the token in session storage until the browser closes, and the interface language in local storage.
```

**scripting**
```
Runs a function packaged in the extension in the user's open Facebook tab to find the access token that the page already holds. No remote code. Runs only on Facebook tabs.
```

### Host permission justification (`https://*.facebook.com/*`)
```
Facebook's own domain only: the open Facebook tabs the token is read from, Facebook cookies, and read-only requests to graph.facebook.com for the user's profile, ad accounts and ads. No other site, no <all_urls>.
```

### Remote code
**Are you using remote code?** No, I am not using remote code.
(No `<script>` or module from outside the package, no `eval`, no `new Function`; fonts and icons are bundled. The manifest CSP is `script-src 'self'; object-src 'none'; connect-src https://graph.facebook.com`.)

### Data usage
Tick these:

| Category | Why |
|---|---|
| Authentication information | Facebook access token and session cookies are read, shown and copied on request |
| Personally identifiable information | The profile name and user ID (Check, c_user) and business/ad account names are shown |
| Financial and payment information | Ad account spend, billing threshold and the payment-method label are shown |

Leave unticked: Health information, Personal communications, Location, Web history, User activity. Website content is not collected: the Facebook page is scanned only to find the token, nothing else from it is kept (tick it too only if you want to be maximally conservative).

Certifications: tick all three (does not sell user data; does not use or transfer it for unrelated purposes; does not use it for creditworthiness or lending). All three are true: nothing leaves the browser except read requests to Meta's own API.

### Disclaimer text (also used at the end of the description)
```
Ads Helper is an independent product. It is not affiliated with, endorsed by or sponsored by Meta Platforms, Inc. Facebook and Meta are trademarks of Meta Platforms, Inc.
```

---

## Distribution tab
- Visibility: Public (or Unlisted for a first run — unlisted still goes through the same review)
- Regions: all regions
- Trader declaration: choose honestly. A free extension without commercial activity is normally a non-trader; if you sell services around it, declare trader.
