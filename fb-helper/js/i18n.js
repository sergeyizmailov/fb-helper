// UI strings: Russian and English, one flat dictionary each. The choice lives in chrome.storage.local — it
// must survive a browser restart, unlike the token and the account cache. First run: the browser's UI
// language, but only as a default — antidetect profiles are usually English while the user is not.
// Status labels follow the Meta enum names (ACTIVE, UNSETTLED, ADS_INTEGRITY_POLICY, …) so they match Ads Manager.

export const LANGS = ["ru", "en"];
let lang = "ru";

const D = {
  ru: {
    "lang.title": "Язык интерфейса",
    "tab.token": "Токен", "tab.cookies": "Cookie", "tab.accounts": "Кабинеты",
    "check": "Проверить", "check.title": "Профиль, приложение и права токена", "check.aria": "Проверить токен",
    "token.refresh": "Прочитать токен из вкладки FB заново", "token.refreshed": "Токен обновлён", "token.retry": "Токен тот же — отметку «сессия закрыта» снял, следующий запрос попробует его ещё раз",
    "copyToken": "Скопировать токен", "copyEnv": "Токен + cookie",
    "guide.title": "Типы токенов", "guide.open": "Открыть — токен этого типа будет на той вкладке",
    "guide.EAAB": "— основной для рекламы: запуск и правка.",
    "guide.EAAI": "— настройка автоправил.",
    "guide.EAAG": "— бизнес-активы: страницы, Instagram, лиды, WhatsApp, каталоги и реклама.",
    "guide.EAAH": "— каталоги: товары и расширенное управление.",
    "guide.EAAd": "— события: пиксели, датасеты и отслеживание.",
    "copyCookies": "Скопировать cookie", "copyCookies.title": "Строка cookie: c_user=…; xs=…; …",
    "copyJson.title": "Те же cookie с атрибутами (domain, path, срок) — для импорта в антидетект",
    "search": "Поиск", "search.aria": "Поиск кабинетов",
    "liveIds": "ID активных", "liveIds.title": "ID активных кабинетов списком, по одному в строке",
    "refresh": "Обновить", "period.aria": "Период спенда",

    "kind.EAAB": "Основной для рекламы: запуск и правка.",
    "kind.EAAG": "Бизнес-активы: страницы, Instagram, лиды, WhatsApp, каталоги и реклама.",
    "kind.EAAH": "Каталоги: товары и расширенное управление.",
    "kind.EAAd": "События: пиксели, датасеты и отслеживание.",
    "kind.EAAI": "Настройка автоправил.",
    "kind.unknown.app": "Другое приложение Meta", "kind.unknown.use": "Нажми «Проверить» — покажу приложение и права.",
    "kind.notAds": "Сейчас это не рекламный токен. ", "kind.goAds": "Перейти в Ads Manager", "kind.from": "Взят со вкладки: {s}",
    "kind.dead": "Сессия этого токена закрыта (код {c}) — запросы к Graph остановлены.",
    "surface.billing": "Биллинг", "surface.bm": "Настройки БМ",

    "period.today": "Сегодня", "period.yesterday": "Вчера", "period.week": "7 дней", "period.month": "30 дней", "period.all": "Всё время",
    "period.noToday": "Без сегодняшнего дня", "period.allNote": "Большее из двух: итог Meta или 30 дней + сегодня",

    "status.1": "Активен", "status.2": "Заблокирован", "status.3": "Не оплачен", "status.7": "Проверка риска",
    "status.8": "Ожидает оплаты", "status.9": "Льготный период", "status.100": "Закрывается", "status.101": "Закрыт",
    "status.other": "Статус {n}",
    "reason.1": "Правила рекламы / Integrity", "reason.2": "Проверка IP", "reason.3": "Платёжный риск", "reason.4": "Серый аккаунт закрыт",
    "reason.5": "Проверка AFC", "reason.6": "Integrity бизнеса", "reason.7": "Закрыт навсегда", "reason.8": "Неиспользуемый реселлер",
    "reason.9": "Неиспользуемый кабинет", "reason.10": "Umbrella-кабинет", "reason.11": "Правила БМ", "reason.12": "Искажённые данные",
    "reason.13": "Юрлицо отозвано", "reason.14": "Проверка переписки", "reason.15": "Кабинет взломан", "reason.other": "Причина",
    "ad.ACTIVE": "Активно", "ad.PAUSED": "Пауза", "ad.PENDING_REVIEW": "На проверке", "ad.IN_PROCESS": "Обработка",
    "ad.DISAPPROVED": "Отклонено", "ad.WITH_ISSUES": "С ошибками", "ad.CAMPAIGN_PAUSED": "Кампания на паузе",
    "ad.ADSET_PAUSED": "Группа на паузе", "ad.PREAPPROVED": "Предодобрено", "ad.PENDING_BILLING_INFO": "Нужна оплата",
    "ad.DELETED": "Удалено", "ad.ARCHIVED": "Архив",

    "copied": "Скопировано", "copyFail": "Не удалось скопировать в буфер",
    "ago.now": "только что", "ago.min": "{n} мин назад", "ago.h": "{n} ч назад",
    "usage.pause": "Пауза {n} мин",

    "err.noToken": "Сначала возьми токен",
    "err.cooldown": "Пауза после лимита API ещё {n} мин — не трогаем",
    "err.timeout": "Graph не ответил за {n} с", "err.net": "Сеть: {m}",
    "err.limit": "Лимит API ({c}). Пауза 30 мин, повторять нельзя", "err.code": "код {c}",
    "err.version": "Версия Graph API {v} устарела, а новую Graph не назвал — обнови расширение (API_VERSION в popup.js)",
    "err.graph": "Ошибка Graph", "err.empty": "Пустой ответ Graph", "err.noData": "Неожиданный ответ Graph (нет data)",
    "err.slot": "Не удалось занять слот запроса: {m}",
    "err.session": "Сессия недействительна или токен от другого аккаунта (код {c}) — запросы остановлены. Обнови вкладку FB или войди заново",

    "grab.noTab": "Открой Facebook в этом профиле", "grab.noAccess": "Нет доступа к вкладке FB — обнови её",
    "grab.notFound": "Токен не найден на {where}", "grab.thisTab": "этой вкладке", "grab.openTabs": "открытых вкладках Facebook",
    "grab.copied": "Токен скопирован", "grab.notAds": "Скопирован {k} — рекламу не запускает",

    "check.checking": "Проверка",
    "check.noPerms": "Токен этого приложения не отдаёт список прав — это нормально для Events и Commerce Manager. Что он умеет — видно в блоке «Типы токенов».",
    "check.failed": "не удалось проверить: {m}", "check.badPerms": "неожиданный ответ Graph (нет data)",
    "check.missing": "нет {p}", "check.allPerms": "Все права · {n}", "check.collapse": "Свернуть",
    "check.profile": "Профиль", "check.app": "Приложение", "check.perms": "Права", "check.permsN": "Права ({n})", "check.error": "Ошибка",

    "ck.none": "Cookie не найдены", "ck.loggedIn": "Вход выполнен", "ck.until": "сессия до ", "ck.untilClose": "сессия до закрытия браузера",
    "ck.count": ["cookie", "cookie", "cookie"], "ck.loggedOut": "Не залогинен в Facebook", "ck.noSession": "Нет c_user / xs — залогинься в FB",
    "ck.jsonCopied": "JSON скопирован", "ck.copied": "Cookie скопированы", "env.copied": "Токен + cookie скопированы",
    "env.mismatch": "Токен от другого аккаунта ({a}), а cookie — {b}. Обнови вкладку FB",
    "env.unverified": "Токен + cookie скопированы — владелец токена не проверен",

    "acc.wait": "Обновить можно через {n} с", "acc.loaded": "Кабинетов: {n}", "acc.truncated": " (не все — лимит 10 страниц)",
    "acc.noLive": "Активных кабинетов нет", "acc.idsCopied": "Скопировано ID: {n}", "acc.partial": " (список неполный)",
    "acc.found": "найдено {n} из {all}", "acc.count": ["кабинет", "кабинета", "кабинетов"], "acc.notAll": " (не все)",
    "acc.updated": "обновлено {t}", "acc.spend": "Спенд", "acc.refreshDash": "— обнови",
    "acc.notAllTitle": "По части кабинетов нет данных за период — обнови список", "acc.notAllShort": "не по всем",
    "acc.empty": "Кабинеты не загружены — нажми кнопку обновления сверху", "acc.loading": "Загрузка кабинетов…", "acc.noMatch": "Ничего не найдено", "acc.noName": "Без имени",
    "acc.copyId": "Копировать ID", "acc.idCopied": "ID скопирован", "acc.openAds": "Открыть в Ads Manager",
    "acc.noPeriod": "Нет данных за этот период — обнови список",
    "acc.inBm": "Кабинет в БМ {n} · {id}", "acc.bm": "БМ {n}",
    "acc.personalTitle": "Личный кабинет: Graph не вернул БМ-владельца", "acc.personal": "Личный",
    "acc.tz": "Часовой пояс кабинета: {tz}", "acc.imp": "{n} показов", "acc.clicks": " кликов",
    "acc.spent": "Всего потрачено", "acc.balance": "Не оплачено", "acc.threshold": "Порог списания", "acc.daily": "Лимит в день",
    "acc.noLimit": "без лимита", "acc.spendCap": "Spend cap", "acc.no": "нет", "acc.funding": "Оплата", "acc.pixels": "Пиксели",
    "acc.noPixel": "нет пикселя", "acc.owner": "Владелец", "acc.bmPrefix": "БМ ", "acc.noBm": "без БМ", "acc.country": "Страна / создан",

    "ads.btn": "Объявления", "ads.collapse": "Свернуть объявления", "ads.refresh": "Обновить объявления", "ads.none": "Объявлений нет",
    "ads.count": ["объявление", "объявления", "объявлений"], "ads.live": " · {n} активно", "ads.rejected": " · {n} отклонено",
    "ads.more": "Показано {n}, есть ещё — остальное в Ads Manager", "ads.wait": "Объявления этого кабинета можно запросить раз в 30 с",
    "ads.loading": "Загрузка…", "ads.imp": ["показ", "показа", "показов"], "ads.clk": ["клик", "клика", "кликов"], "ads.noDelivery": "Нет показов за период",
    "ads.statsLoading": "Загружаю цифры…", "ads.statsFail": "Цифры по объявлениям не загрузились", "ads.statsAt": " · цифры: {a}",
    "ads.noAll": "За всё время Graph не отдал цифры (слишком много данных)", "ads.allNote": "Всё время — не больше 37 месяцев (лимит Meta)", "ads.old": "Цифры устарели — обнови объявления", "ads.stale": "Не обновилось: {m}. Показан прошлый список",
  },
  en: {
    "lang.title": "Interface language",
    "tab.token": "Token", "tab.cookies": "Cookies", "tab.accounts": "Ad accounts",
    "check": "Check", "check.title": "Profile, app and permissions of the token", "check.aria": "Check token",
    "token.refresh": "Re-read the token from the FB tab", "token.refreshed": "Token refreshed", "token.retry": "Same token — the dead-session mark is cleared, the next request will try it again",
    "copyToken": "Copy token", "copyEnv": "Token + cookies",
    "guide.title": "Token types", "guide.open": "Open — that tab will hold a token of this type",
    "guide.EAAB": "— the main ads token: launch and edit.",
    "guide.EAAI": "— automated rules.",
    "guide.EAAG": "— business assets: pages, Instagram, leads, WhatsApp, catalogs and ads.",
    "guide.EAAH": "— catalogs: products and advanced management.",
    "guide.EAAd": "— events: pixels, datasets and tracking.",
    "copyCookies": "Copy cookies", "copyCookies.title": "Cookie string: c_user=…; xs=…; …",
    "copyJson.title": "Same cookies with attributes (domain, path, expiry) — for import into an antidetect browser",
    "search": "Search", "search.aria": "Search ad accounts",
    "liveIds": "Active IDs", "liveIds.title": "IDs of active ad accounts, one per line",
    "refresh": "Refresh", "period.aria": "Spend period",

    "kind.EAAB": "The main ads token: launch and edit.",
    "kind.EAAG": "Business assets: pages, Instagram, leads, WhatsApp, catalogs and ads.",
    "kind.EAAH": "Catalogs: products and advanced management.",
    "kind.EAAd": "Events: pixels, datasets and tracking.",
    "kind.EAAI": "Automated rules.",
    "kind.unknown.app": "Another Meta app", "kind.unknown.use": "Press “Check” to see the app and its permissions.",
    "kind.notAds": "This is not an ads token. ", "kind.goAds": "Open Ads Manager", "kind.from": "Taken from tab: {s}",
    "kind.dead": "This token's session is closed (code {c}) — Graph requests are stopped.",
    "surface.billing": "Billing", "surface.bm": "Business settings",

    "period.today": "Today", "period.yesterday": "Yesterday", "period.week": "7 days", "period.month": "30 days", "period.all": "All time",
    "period.noToday": "Excludes today", "period.allNote": "The larger of Meta's total and last 30 days + today",

    "status.1": "Active", "status.2": "Disabled", "status.3": "Unsettled", "status.7": "Pending risk review",
    "status.8": "Pending settlement", "status.9": "In grace period", "status.100": "Pending closure", "status.101": "Closed",
    "status.other": "Status {n}",
    "reason.1": "Ads integrity policy", "reason.2": "Ads IP review", "reason.3": "Payment risk", "reason.4": "Gray account shut down",
    "reason.5": "AFC review", "reason.6": "Business integrity (RAR)", "reason.7": "Permanent close", "reason.8": "Unused reseller account",
    "reason.9": "Unused account", "reason.10": "Umbrella ad account", "reason.11": "Business Manager integrity policy", "reason.12": "Misrepresented ad account",
    "reason.13": "Legal entity de-shared", "reason.14": "Thread review", "reason.15": "Compromised ad account", "reason.other": "Reason",
    "ad.ACTIVE": "Active", "ad.PAUSED": "Paused", "ad.PENDING_REVIEW": "Pending review", "ad.IN_PROCESS": "In process",
    "ad.DISAPPROVED": "Disapproved", "ad.WITH_ISSUES": "With issues", "ad.CAMPAIGN_PAUSED": "Campaign paused",
    "ad.ADSET_PAUSED": "Ad set paused", "ad.PREAPPROVED": "Preapproved", "ad.PENDING_BILLING_INFO": "Pending billing info",
    "ad.DELETED": "Deleted", "ad.ARCHIVED": "Archived",

    "copied": "Copied", "copyFail": "Could not copy to clipboard",
    "ago.now": "just now", "ago.min": "{n} min ago", "ago.h": "{n} h ago",
    "usage.pause": "Paused {n} min",

    "err.noToken": "Grab a token first",
    "err.cooldown": "API limit hit — hands off for another {n} min",
    "err.timeout": "Graph did not answer in {n} s", "err.net": "Network: {m}",
    "err.limit": "API limit ({c}). Paused 30 min, do not retry", "err.code": "code {c}",
    "err.version": "Graph API {v} is deprecated and Graph named no newer one — update the extension (API_VERSION in popup.js)",
    "err.graph": "Graph error", "err.empty": "Empty Graph response", "err.noData": "Unexpected Graph response (no data)",
    "err.slot": "Could not claim a request slot: {m}",
    "err.session": "Session is no longer valid, or the token is from another account (code {c}) — requests stopped. Reload the FB tab or log in again",

    "grab.noTab": "Open Facebook in this profile", "grab.noAccess": "No access to the FB tab — reload it",
    "grab.notFound": "No token found on {where}", "grab.thisTab": "this tab", "grab.openTabs": "the open Facebook tabs",
    "grab.copied": "Token copied", "grab.notAds": "Copied {k} — it cannot run ads",

    "check.checking": "Checking",
    "check.noPerms": "Tokens of this app do not expose their permission list — normal for Events and Commerce Manager. See “Token types” for what it can do.",
    "check.failed": "could not check: {m}", "check.badPerms": "unexpected Graph response (no data)",
    "check.missing": "no {p}", "check.allPerms": "All permissions · {n}", "check.collapse": "Collapse",
    "check.profile": "Profile", "check.app": "App", "check.perms": "Permissions", "check.permsN": "Permissions ({n})", "check.error": "Error",

    "ck.none": "No cookies found", "ck.loggedIn": "Logged in", "ck.until": "session until ", "ck.untilClose": "session until the browser closes",
    "ck.count": ["cookie", "cookies"], "ck.loggedOut": "Not logged in to Facebook", "ck.noSession": "No c_user / xs — log in to FB",
    "ck.jsonCopied": "JSON copied", "ck.copied": "Cookies copied", "env.copied": "Token + cookies copied",
    "env.mismatch": "The token belongs to another account ({a}), the cookies to {b}. Reload the FB tab",
    "env.unverified": "Token + cookies copied — token owner not verified",

    "acc.wait": "Refresh available in {n} s", "acc.loaded": "Ad accounts: {n}", "acc.truncated": " (not all — 10-page limit)",
    "acc.noLive": "No active ad accounts", "acc.idsCopied": "Copied IDs: {n}", "acc.partial": " (list incomplete)",
    "acc.found": "{n} of {all} found", "acc.count": ["ad account", "ad accounts"], "acc.notAll": " (not all)",
    "acc.updated": "updated {t}", "acc.spend": "Spend", "acc.refreshDash": "— refresh",
    "acc.notAllTitle": "Some accounts have no data for this period — refresh the list", "acc.notAllShort": "not all",
    "acc.empty": "Ad accounts not loaded — press the refresh button above", "acc.loading": "Loading ad accounts…", "acc.noMatch": "Nothing found", "acc.noName": "Unnamed",
    "acc.copyId": "Copy ID", "acc.idCopied": "ID copied", "acc.openAds": "Open in Ads Manager",
    "acc.noPeriod": "No data for this period — refresh the list",
    "acc.inBm": "Account in business portfolio {n} · {id}", "acc.bm": "{n}",
    "acc.personalTitle": "Personal account: Graph returned no business owner", "acc.personal": "Personal",
    "acc.tz": "Account timezone: {tz}", "acc.imp": "{n} impressions", "acc.clicks": " clicks",
    "acc.spent": "Total spent", "acc.balance": "Unpaid balance", "acc.threshold": "Billing threshold", "acc.daily": "Daily limit",
    "acc.noLimit": "no limit", "acc.spendCap": "Spend cap", "acc.no": "none", "acc.funding": "Payment", "acc.pixels": "Pixels",
    "acc.noPixel": "no pixel", "acc.owner": "Owner", "acc.bmPrefix": "Business ", "acc.noBm": "no business", "acc.country": "Country / created",

    "ads.btn": "Ads", "ads.collapse": "Hide ads", "ads.refresh": "Refresh ads", "ads.none": "No ads",
    "ads.count": ["ad", "ads"], "ads.live": " · {n} active", "ads.rejected": " · {n} disapproved",
    "ads.more": "Showing {n}, more exist — the rest is in Ads Manager", "ads.wait": "Ads of one account can be requested once per 30 s",
    "ads.loading": "Loading…", "ads.imp": ["impression", "impressions"], "ads.clk": ["click", "clicks"], "ads.noDelivery": "No delivery in this period",
    "ads.statsLoading": "Loading numbers…", "ads.statsFail": "Ad numbers did not load", "ads.statsAt": " · numbers: {a}",
    "ads.noAll": "Graph did not return all-time numbers (too much data)", "ads.allNote": "All time is capped at 37 months (Meta's limit)", "ads.old": "Numbers are out of date — refresh the ads", "ads.stale": "Not refreshed: {m}. Showing the previous list",
  },
};

export const getLang = () => lang;
export const has = (key) => key in D[lang];
export const locale = () => (lang === "ru" ? "ru-RU" : "en-US");
// t("acc.found", { n: 3, all: 10 }) → "найдено 3 из 10". A missing key falls back to Russian, then to the key.
export function t(key, vars) {
  let s = D[lang][key] ?? D.ru[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}
// Count word for n: Russian one / few / many, English one / other.
export function tn(n, key) {
  const f = D[lang][key];
  if (lang !== "ru") return f[n === 1 ? 0 : 1];
  const m10 = n % 10, m100 = n % 100;
  return m10 === 1 && m100 !== 11 ? f[0] : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? f[1] : f[2];
}

// Static markup: data-i18n = text, data-i18n-title / -placeholder / -aria = that attribute.
export function applyStatic(root = document) {
  document.documentElement.lang = lang;
  for (const n of root.querySelectorAll("[data-i18n]")) n.textContent = t(n.dataset.i18n);
  for (const n of root.querySelectorAll("[data-i18n-title]")) n.title = t(n.dataset.i18nTitle);
  for (const n of root.querySelectorAll("[data-i18n-placeholder]")) n.placeholder = t(n.dataset.i18nPlaceholder);
  for (const n of root.querySelectorAll("[data-i18n-aria]")) n.setAttribute("aria-label", t(n.dataset.i18nAria));
  for (const b of root.querySelectorAll("[data-lang]")) {
    const on = b.dataset.lang === lang;
    b.classList.toggle("active", on); b.setAttribute("aria-pressed", String(on));
  }
}

const fromBrowser = () => (/^(ru|uk|be|kk)\b/.test(globalThis.chrome?.i18n?.getUILanguage?.() || "") ? "ru" : "en");
export async function loadLang() {
  let saved = null;
  try { saved = (await chrome.storage.local.get("lang")).lang; } catch { /* first run / no storage */ }
  lang = LANGS.includes(saved) ? saved : fromBrowser();
  return lang;
}
export async function setLang(l) {
  if (!LANGS.includes(l) || l === lang) return false;
  lang = l;
  try { await chrome.storage.local.set({ lang: l }); } catch { /* keep it for this popup at least */ }
  return true;
}
