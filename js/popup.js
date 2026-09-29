// FB Helper — read-only helper: EAAB token, session cookies, ad account status.
// Nothing leaves the browser except GET calls to graph.facebook.com: on a click, or when the Accounts tab opens with
// nothing loaded yet / after the FB page was reloaded.
// Reading the token from the FB tab is local.
// Token and account cache live in chrome.storage.session (gone when the browser closes). The account cache
// belongs to the FB user (c_user), not to a token string: FB pages hand out different tokens, and switching
// or reloading them must not throw away accounts you just loaded. Another user in the profile drops it;
// storage.local holds only a newer Graph API version learned from Graph itself.

import { t, tn, has, locale, getLang, setLang, loadLang, applyStatic } from "./i18n.js";
import { isSessionError, sessionLabel, verNum, latestVersion, AD_PROBLEMS, adRank, reviewLines, ownerVerdict, lifetimeSpend, spendFloor } from "./pure.js";

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

// Graph API version: v26.0 is the newest on 2026-09-28 (released 2026-07-29). Marketing API versions (ad
// accounts, ads, insights) stop working ~90 days after the next release. Graph then either auto-upgrades the
// call and names the new version in X-Ad-Api-Version-Warning, or fails with #2635 "…update to the latest
// version: vNN.0". Either way the newer version is remembered (adoptVersion), so the extension keeps working
// without a release. Still bump this constant when you ship an update.
const API_VERSION = "v26.0";
const DEPRECATED_VERSION_CODE = 2635;
const MIN_REFRESH_MS = 60 * 1000;            // accounts: one attempt per minute (failed attempts count too)
const ADS_LOCK_MS = 30 * 1000;               // ads: one read per account per 30 s
const COOLDOWN_MS = 30 * 60 * 1000;          // throttle → 30 min hands off, no retries
const TIMEOUT_MS = 20 * 1000;
const TAB_READ_MS = 2500;                    // a slow FB tab ahead of one that already gave a token is waited this long…
const TAB_WAIT_MS = 12 * 1000;               // …and this long in all when none has a token yet (busy machine, heavy page)
const THROTTLE_CODES = new Set([4, 17, 32, 613]);
const SESSION_COOKIES = ["c_user", "xs", "datr", "fr", "sb"];   // must-haves, listed first
const GRAPH_URL = "https://graph.facebook.com/";
// A token is "EAA" + 62+ alphanumerics. grabInPage (runs in the page) repeats this pattern; keep them equal.
// The page's answer is re-checked here: the MAIN world is the page's own JS and can return anything.
const TOKEN_RE = /^EAA[A-Za-z0-9]{62,}$/;
// First-party token prefixes: each is a different Meta app with its own fixed scope set.
// app = the Meta app behind the prefix; what it can do = t("kind.<prefix>") (live-checked 2026-09-27 on one profile).
// ads: does this token actually launch/edit ads (ads_management)? live-checked per prefix.
// false → show the "not an ads token · open Ads Manager" hint; true → hide it.
const TOKEN_KIND = {
  EAAB: { app: "Ads Manager", tone: "ok", ads: true },
  EAAG: { app: "Business Manager", tone: "info", ads: true },
  EAAH: { app: "Commerce Manager", tone: "info", ads: false },
  EAAd: { app: "Events Manager", tone: "info", ads: false },
  EAAI: { app: "Automated Rules", tone: "info", ads: true },
};
// Every grabbed value already matched the token regex, so it IS a token — just from an app we didn't
// hardcode. "Check" reads the real app from Graph, so keep this calm, not "this is not a token".
const UNKNOWN_KIND = { tone: "info" };                  // app / use come from t("kind.unknown.*")
// Friendly names for the first-party apps behind the tokens (shown after "Check").
const KNOWN_APPS = {
  "119211728144504": "Ads Manager", "436761779744620": "Business Manager",
  "515496645328243": "Commerce Manager", "2094176354154603": "Events Manager",
  "624541620938530": "Automated Rules",
};
const ADS_MANAGER_URL = "https://adsmanager.facebook.com/adsmanager/manage/campaigns";
// Which FB surface the tab is on, from host + path. App names as-is; the two translated ones are t() keys.
function surfaceOf(host = "", path = "") {
  if (host.startsWith("adsmanager.")) return "Ads Manager";
  if (/account_billing|\/billing/.test(path)) return "surface.billing";
  if (host.startsWith("business.")) {
    if (path.startsWith("/commerce")) return "Commerce Manager";
    if (path.startsWith("/events_manager")) return "Events Manager";
    if (path.startsWith("/settings") || path.startsWith("/latest/settings")) return "surface.bm";
    if (path.includes("/adsmanager")) return "Ads Manager (Business Suite)";
    return "Business Suite";
  }
  return "Facebook";
}
const BASE_FIELDS = ["name", "account_id", "account_status", "disable_reason", "currency", "timezone_name",
  "amount_spent", "balance", "spend_cap", "created_time", "business{id,name}",
  "business_country_code"];
// Extras that some tokens can't read. On a field error only the named one is dropped and the page retried.
// Today's spend rides on the same call (date_preset=today = each account's own timezone).
const OPTIONAL_FIELDS = {
  funding_source_details: "funding_source_details",
  adtrust_dsl: "adtrust_dsl",
  adspaymentcycle: "adspaymentcycle{threshold_amount}",
  adspixels: "adspixels{id,name}",
  // All periods in one request via field aliases (live-checked 2026-09-27; alias = letters/underscore only).
  insights: ["today:p_today", "yesterday:p_yesterday", "last_7d:p_week", "last_30d:p_month"]
    .map((x) => { const [preset, alias] = x.split(":"); return `insights.date_preset(${preset}).as(${alias}){spend,impressions,inline_link_clicks}`; })
    .join(","),
};
// Spend periods. Meta's last_7d / last_30d end yesterday (today excluded). "all" = Meta's amount_spent, raised to 30 days + today if that is more.
const PERIODS = [
  { key: "today", label: "period.today", alias: "p_today" },
  { key: "yesterday", label: "period.yesterday", alias: "p_yesterday" },
  { key: "week", label: "period.week", alias: "p_week" },
  { key: "month", label: "period.month", alias: "p_month" },
  { key: "all", label: "period.all" },
];

// Tone per Meta status code; the label is t("status.<code>") / t("ad.<status>"), disable reasons t("reason.<n>").
const ACCOUNT_STATUS = { 1: "ok", 2: "bad", 3: "warn", 7: "warn", 8: "warn", 9: "warn", 100: "bad", 101: "bad" };
const AD_STATUS = {
  ACTIVE: "ok", PAUSED: "", PENDING_REVIEW: "warn", IN_PROCESS: "warn", DISAPPROVED: "bad", WITH_ISSUES: "bad",
  CAMPAIGN_PAUSED: "", ADSET_PAUSED: "", PREAPPROVED: "warn", PENDING_BILLING_INFO: "warn", DELETED: "", ARCHIVED: "",
};

const state = {
  token: null, apiVersion: API_VERSION, accounts: [], fetchedAt: 0, truncated: false, owner: null,
  filter: "", statusFilter: null, cooldownUntil: 0, usage: null, cookies: [], accLoading: false,
  // Tokens Graph reported as dead ([{ token, code }], newest last, at most 5): no request is sent with them again.
  // The ⟳ next to the token clears the current one's mark (the deliberate retry). Persisted in storage.session.
  dead: [],
  checked: null,                                     // last token↔c_user answer: { token, user, verdict, meId }
  // Rate locks survive popup reopen (storage.session), unlike the data cache.
  locks: { accountsAt: 0, ads: {} },
  open: new Set(), ads: {}, adsBusy: new Set(), adsHidden: new Set(),
  // Generation: bumped on token change. Every request captures it;
  // a response from an older generation is dropped (Stale) and in-flight fetches are aborted.
  gen: 0, ctl: new AbortController(), skip: new Set(),
  grabOp: 0,                                         // latest token grab wins; older ones are dropped
  period: "today",
};
class Stale extends Error {}

// ---------- utils ----------
function toast(msg, err = false) {
  const box = $("#toast");
  box.textContent = msg;
  box.classList.toggle("err", err);
  box.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => box.classList.remove("show"), 2600);
}
async function copy(text, label = t("copied")) {
  try { await navigator.clipboard.writeText(text); toast(label); return true; }
  catch { toast(t("copyFail"), true); return false; }
}
function el(tag, attrs = {}, ...children) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") n.className = v;
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== null && v !== false) n.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat()) if (c !== null && c !== undefined && c !== false)
    n.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return n;
}
// replaceChildren that drops null/undefined/false (they would otherwise render as the text "null").
const fill = (node, ...kids) => node.replaceChildren(...kids.flat().filter((k) => k !== null && k !== undefined && k !== false));
const pill = (text, tone = "") => el("span", { class: `pill ${tone}` }, text);
const errText = (msg) => el("span", { class: "err-text" }, msg);
// Numbers/ids get equal-width digits (.num → tabular-nums), so they line up across rows.
const numEl = (text) => el("span", { class: "num" }, text);
// Meta currencies without a minor-unit offset (amounts are whole units).
const NO_OFFSET = new Set(["CLP", "COP", "CRC", "HUF", "ISK", "IDR", "JPY", "KRW", "PYG", "TWD", "VND"]);
const major = (minor, cur) => Number(minor) / (NO_OFFSET.has(cur) ? 1 : 100);
// Intl formatters are costly to build and run per row on every render (search, sort): one per currency / zone,
// keyed by the UI locale too, so a language switch just starts filling new entries.
const moneyFmts = new Map(), dayFmts = new Map(), numFmts = new Map();
const numFmt = () => { const l = locale(); if (!numFmts.has(l)) numFmts.set(l, new Intl.NumberFormat(l)); return numFmts.get(l); };
function fmt(value, cur) {
  const c = cur || "USD", k = `${locale()}:${c}`;
  if (!moneyFmts.has(k)) {
    try { moneyFmts.set(k, new Intl.NumberFormat(locale(), { style: "currency", currency: c, maximumFractionDigits: 2 })); }
    catch { moneyFmts.set(k, null); }                // unknown currency code → plain number + code
  }
  const f = moneyFmts.get(k);
  return f ? f.format(value) : `${Number(value).toFixed(2)} ${cur || ""}`;
}
function money(minor, cur) {
  if (minor === undefined || minor === null || minor === "") return "—";
  return fmt(major(minor, cur), cur);
}
function ago(ts) {
  const m = Math.round((Date.now() - ts) / 60000);
  return m < 1 ? t("ago.now") : m < 60 ? t("ago.min", { n: m }) : t("ago.h", { n: Math.round(m / 60) });
}
function dayIn(tz, ts) {
  let f = dayFmts.get(tz);
  if (!f) {
    try { f = new Intl.DateTimeFormat("en-CA", { timeZone: tz || undefined }); }
    catch { f = new Intl.DateTimeFormat("en-CA"); }
    dayFmts.set(tz, f);
  }
  return f.format(ts);
}
function isFacebookUrl(url) {
  try { const h = new URL(url).hostname; return h === "facebook.com" || h.endsWith(".facebook.com"); }
  catch { return false; }
}

// ---------- storage ----------
async function loadState() {
  // storage.session is wiped on extension update/reload, so a cache is always from this API_VERSION.
  const ses = await chrome.storage.session.get(["token", "tokenSource", "dead", ...CACHE_KEYS, "cooldownUntil", "usage", "locks"]);
  try { const { apiVersion } = await chrome.storage.local.get("apiVersion"); adoptVersion(apiVersion, false); } catch { /* */ }
  Object.assign(state, {
    token: ses.token || null, tokenSource: ses.tokenSource || null, dead: Array.isArray(ses.dead) ? ses.dead : [],
    accounts: ses.accounts || [], fetchedAt: ses.fetchedAt || 0, truncated: !!ses.truncated, owner: ses.owner || null,
    ads: ses.ads || {}, open: new Set(ses.view?.open), adsHidden: new Set(ses.view?.hidden),
    cooldownUntil: ses.cooldownUntil || 0, usage: ses.usage ?? null,
    locks: { accountsAt: ses.locks?.accountsAt || 0, ads: ses.locks?.ads || {} },
  });
}
const saveSession = (patch) => chrome.storage.session.set(patch);
const saveView = () => saveSession({ view: { open: [...state.open], hidden: [...state.adsHidden] } });
// The logged-in FB user of this profile (c_user cookie), or null when logged out.
async function fbUser() {
  try { return (await chrome.cookies.get({ url: GRAPH_URL, name: "c_user" }))?.value || null; }
  catch { return null; }
}
// The cached accounts are someone else's (other login, or logged out): drop them. true = dropped.
async function checkOwner() {
  if (!state.fetchedAt || state.owner === await fbUser()) return false;
  await dropCache();
  return true;
}
// Claim a rate slot atomically across every open page of this extension (popups in several windows):
// Web Locks are shared per origin, and the check re-reads storage inside the lock.
// key "accounts" = list refresh, otherwise an ad account id. Returns 0 if granted, else ms to wait.
function claimSlot(key) {
  return navigator.locks.request("fbh-rate", async () => {
    const { locks } = await chrome.storage.session.get("locks");
    const cur = { accountsAt: locks?.accountsAt || 0, ads: { ...(locks?.ads || {}) } };
    const now = Date.now();
    for (const [k, until] of Object.entries(cur.ads)) if (until < now) delete cur.ads[k];
    const until = key === "accounts" ? cur.accountsAt + MIN_REFRESH_MS : cur.ads[key] || 0;
    if (until > now) { state.locks = cur; return until - now; }
    if (key === "accounts") cur.accountsAt = now; else cur.ads[key] = now + ADS_LOCK_MS;
    await chrome.storage.session.set({ locks: cur });
    state.locks = cur;
    return 0;
  });
}

// Token changed: cancel in-flight requests (their answers are dropped as Stale).
// The account cache stays; rate locks and the throttle pause are kept on purpose.
function newGeneration() {
  state.gen++;
  state.ctl.abort();
  state.ctl = new AbortController();
  state.skip = new Set();
  state.adsBusy = new Set();
  $("#tokenInfo").classList.add("hidden");
}
// Accounts, ads and which rows are open: kept across popup reopen and token changes, dropped when the FB user changes.
const CACHE_KEYS = ["accounts", "fetchedAt", "truncated", "owner", "ads", "view"];
function dropCache() {
  Object.assign(state, { accounts: [], fetchedAt: 0, truncated: false, owner: null, open: new Set(), ads: {}, adsHidden: new Set() });
  return chrome.storage.session.remove(CACHE_KEYS);
}

// ---------- Graph ----------
// Switch to a newer API version named in Graph's text (upgrade warning, #2635, or our own storage).
// Only forward, and only a few majors ahead: a garbled message must not send us to v999.
function adoptVersion(text, persist = true) {
  const cur = verNum(state.apiVersion);
  const v = latestVersion(text, cur + 500);           // the newest one named (within reach), not the first
  const n = verNum(v);
  if (!n || n <= cur) return false;
  state.apiVersion = v;
  if (persist) chrome.storage.local.set({ apiVersion: v }).catch(() => {});
  return true;
}
function setUsage(headers) {
  let worst = null;
  for (const name of ["x-business-use-case-usage", "x-app-usage", "x-ad-account-usage"]) {
    const raw = headers?.get(name);
    if (!raw) continue;
    try {
      const data = JSON.parse(raw);
      const buckets = Object.values(data).some(Array.isArray) ? Object.values(data).flat() : [data];
      for (const b of buckets) for (const [k, v] of Object.entries(b || {}))
        if (/(_pct|call_count|total_cputime|total_time)$/.test(k) && typeof v === "number")
          worst = Math.max(worst ?? 0, Math.min(v, 100));
    } catch { /* ignore */ }
  }
  if (worst !== null) { state.usage = worst; saveSession({ usage: worst }); }
  renderUsage();
}
function renderUsage() {
  const u = $("#usage");
  const cd = state.cooldownUntil - Date.now();
  if (cd > 0) { u.textContent = t("usage.pause", { n: Math.ceil(cd / 60000) }); u.className = "pill bad"; return; }
  if (state.usage === null || state.usage < 50) { u.className = "pill hidden"; return; }
  u.textContent = `API ${Math.round(state.usage)}%`;
  u.className = `pill ${state.usage >= 75 ? "bad" : "warn"}`;
}
function startCooldown() {
  state.cooldownUntil = Date.now() + COOLDOWN_MS;
  saveSession({ cooldownUntil: state.cooldownUntil });
  renderUsage();
}

// The token is dead (Graph said so earlier): every call refuses before the network, so a dead login is never hammered.
const deadOf = (token) => (token ? state.dead.find((d) => d.token === token) : undefined);
const isDead = () => !!deadOf(state.token);
const deadCode = () => deadOf(state.token)?.code;
function sessionError(code) {
  const err = new Error(t("err.session", { c: code }));
  err.session = true;
  return err;
}
function markDead(token, code) {
  state.dead = [...state.dead.filter((d) => d.token !== token), { token, code }].slice(-5);
  saveSession({ dead: state.dead });
  renderToken();
}
function clearDead(token) {
  if (!deadOf(token)) return;
  state.dead = state.dead.filter((d) => d.token !== token);
  saveSession({ dead: state.dead });
}

// One GET. The token and generation are fixed when the call starts.
// retried: already re-sent once after #2635 moved us to a newer API version.
async function graph(path, params = {}, retried = false) {
  const token = state.token, gen = state.gen, ctl = state.ctl;
  if (!token) throw new Error(t("err.noToken"));
  const dead = deadOf(token);
  if (dead) throw sessionError(dead.code);
  const left = state.cooldownUntil - Date.now();
  if (left > 0) throw new Error(t("err.cooldown", { n: Math.ceil(left / 60000) }));
  const qs = new URLSearchParams(params).toString();
  const url = `${GRAPH_URL}${state.apiVersion}/${path}${qs ? `?${qs}` : ""}`;
  const signal = AbortSignal.any([ctl.signal, AbortSignal.timeout(TIMEOUT_MS)]);
  let res;
  try {
    res = await fetchFromPopup(url, token, signal);
  } catch (e) {
    if (ctl.signal.aborted || gen !== state.gen) throw new Stale();
    if (e.name === "TimeoutError" || e.name === "AbortError") throw new Error(t("err.timeout", { n: TIMEOUT_MS / 1000 }));
    throw new Error(t("err.net", { m: e.message }));
  }
  // The throttle pause applies even to a stale response: the limit is real either way.
  const e = res.body?.error;
  if (res.status === 429 || (e && (THROTTLE_CODES.has(e.code) || (e.code >= 80000 && e.code <= 80999)))) {
    startCooldown();
    throw new Error(t("err.limit", { c: e ? t("err.code", { c: e.code }) : "HTTP 429" }));
  }
  if (gen !== state.gen) throw new Stale();
  setUsage(res.headers);
  adoptVersion(res.headers?.get("x-ad-api-version-warning"));   // auto-upgraded: use the new one next time
  if (e?.code === DEPRECATED_VERSION_CODE) {
    if (!retried && adoptVersion(e.message)) return graph(path, params, true);
    throw new Error(t("err.version", { v: state.apiVersion }));
  }
  // Invalid / expired token, checkpoint, password changed: nothing will work until FB hands out a new token.
  if (e && isSessionError(e.code)) {
    const code = sessionLabel(e.code, e.error_subcode);
    markDead(token, code);
    throw sessionError(code);
  }
  if (e) {
    const err = new Error(e.error_user_msg || e.message || t("err.graph"));
    err.code = e.code; err.subcode = e.error_subcode; err.raw = e.message || "";
    throw err;
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  if (!res.body || typeof res.body !== "object") throw new Error(t("err.empty"));
  return res.body;
}

// EAAB / EAAH are session-bound: the FB cookies must ride along (credentials: include; the extension's
// host permission makes them first-party here). No retry from inside the FB tab: Graph answers
// Access-Control-Allow-Origin: *, which forbids credentialed CORS from a page (checked 2026-09-28).
async function fetchFromPopup(url, token, signal) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, credentials: "include", signal });
  let body = null;
  try { body = await res.json(); } catch { body = null; }
  return { ok: res.ok, status: res.status, headers: res.headers, body };
}

// ---------- token ----------
function grabInPage() {
  // Runs in the page (MAIN world). Returns candidates only; nothing is sent anywhere.
  // It is serialized into the page, so it can't see TOKEN_RE: the patterns below repeat it.
  // loadId changes on every reload of the page: the Accounts tab refreshes by itself once per FB page load.
  const base = { host: location.hostname, path: location.pathname, loadId: Math.round(performance.timeOrigin) };
  // The page's own token for the surface you're on (Ads Manager → EAAB, Commerce → EAAH, …).
  // Preferred over anything scraped, so switching pages shows the CURRENT token — and no scan is needed.
  try {
    const w = window.__accessToken;
    if (typeof w === "string" && /^EAA[A-Za-z0-9]{62,}$/.test(w)) return { ...base, primary: w, tokens: [] };
  } catch { /* */ }
  // A token stands alone (quotes around it). Inline base64 images also contain "EAA…" runs,
  // e.g. the JPEG Huffman table "EAACAQMDAg…": they are glued to other base64 chars (+ / =).
  const re = /(?<![A-Za-z0-9+/])EAA[A-Za-z0-9]{62,}(?![A-Za-z0-9+/=])/g;
  const out = new Set();
  const scan = (text) => { re.lastIndex = 0; let m; while (out.size < 20 && (m = re.exec(text))) out.add(m[0]); };
  // Inline scripts first: that's where the page embeds its tokens, and it's far cheaper than serializing
  // the whole DOM (megabytes on Ads Manager). The full HTML only if the scripts had none.
  for (const sc of document.scripts) if (!sc.src) scan(sc.textContent);
  // The rendered DOM is the last resort. On feed / profile / group pages it is other people's text (a comment can
  // contain anything shaped like a token), so there it is read only on ads and billing pages.
  const ugcHost = /^(www|web|m|mbasic)\.facebook\.com$|^facebook\.com$/.test(location.hostname);
  const adsPath = /^\/(ads|adsmanager|billing[\w-]*)(\/|$)/.test(location.pathname);   // path PREFIX, not any "billing" inside a slug
  if (!out.size && (!ugcHost || adsPath)) scan(document.documentElement.innerHTML);
  return { ...base, primary: null, tokens: [...out] };
}
// FB tabs to read, best first: the active tab (if it's FB), then Ads Manager tabs, then the most recent.
async function facebookTabs() {
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
  const isFb = (tab) => tab?.url && isFacebookUrl(tab.url) && !tab.discarded;
  const tabs = (await chrome.tabs.query({ url: ["https://*.facebook.com/*"] })).filter((tab) => isFb(tab) && tab.id !== active?.id);
  // Frozen tabs (Chrome's memory saver) run no scripts until activated: asked last, and only with a time limit.
  tabs.sort((a, b) => (!!a.frozen - !!b.frozen) || (/adsmanager/.test(b.url) - /adsmanager/.test(a.url)) || ((b.lastAccessed || 0) - (a.lastAccessed || 0)));
  return isFb(active) ? [active, ...tabs] : tabs;
}
// Best token from one page's answer: the page's own token (matches its surface), then the EAAB heuristic,
// then anything. Every candidate is re-checked against TOKEN_RE — the MAIN world could return anything.
function pickToken(r) {
  const valid = (s) => typeof s === "string" && TOKEN_RE.test(s);
  if (valid(r?.primary)) return r.primary;
  const tokens = Array.isArray(r?.tokens) ? r.tokens.filter(valid) : [];
  return tokens.find((s) => s.startsWith("EAAB")) || tokens[0] || null;
}
// Reads a fresh token from the FB tabs. Returns it, or null after showing why — never the old cached one.
// The field only ever shows a token some open FB tab has right now: with no FB tab, or none with a token,
// the old one is dropped (it couldn't be copied anyway — copying always re-reads the tab).
// silent: on popup open — no clipboard, no toasts; the reason goes into the token field.
// A request started while a grab is still reading the tabs waits for it: it must go out with the token being read now.
let grabbing = Promise.resolve();
const settledGrab = () => grabbing;
function grabToken(opts) {
  const p = grabTokenNow(opts);
  grabbing = p.catch(() => null);
  return p;
}
async function grabTokenNow({ toClipboard = true, silent = false } = {}) {
  const op = ++state.grabOp;
  let gen = state.gen;
  const current = () => op === state.grabOp && gen === state.gen;
  const none = async (msg) => {
    if (state.token) {
      newGeneration();                                 // also cancels requests still running on the old token
      gen = state.gen;                                 // our own bump, not a token change from elsewhere
      Object.assign(state, { token: null, tokenSource: null });
      await chrome.storage.session.remove(["token", "tokenSource"]);
      if (!current()) return null;
    }
    if (await checkOwner() && current()) renderAccounts();
    renderToken(msg);
    if (!silent) toast(msg, true);
    return null;
  };
  const tabs = await facebookTabs();
  if (!current()) return null;
  if (!tabs.length) return none(t("grab.noTab"));
  // Up to 5 tabs at once, so one frozen or busy tab can't stall the popup. Of the tabs that answered, the first in the
  // order above that has a token wins: the active FB tab may be a page without one (feed, still loading).
  const picked = tabs.slice(0, 5);
  const answers = picked.map(() => null);              // null = no answer (yet): no access, frozen, still busy
  const done = picked.map(() => false);
  let wake = null;
  picked.forEach((tab, i) => chrome.scripting.executeScript({ target: { tabId: tab.id }, world: "MAIN", func: grabInPage })
    .then((res) => { answers[i] = res?.[0]?.result ?? null; }, () => {})
    .finally(() => { done[i] = true; wake?.(); }));
  // Stop as soon as the answer can't change: every tab ahead of the first one with a token has answered. A slow tab
  // ahead of it is waited for TAB_READ_MS; with no token anywhere yet, up to TAB_WAIT_MS (a busy machine is not
  // "no access").
  const t0 = Date.now();
  for (;;) {
    const first = answers.findIndex((r) => r && pickToken(r));
    if (done.every(Boolean) || (first >= 0 && done.slice(0, first).every(Boolean))) break;
    const left = (first >= 0 ? TAB_READ_MS : TAB_WAIT_MS) - (Date.now() - t0);
    if (left <= 0) break;
    await new Promise((resolve) => { wake = resolve; setTimeout(resolve, left); });
  }
  wake = null;
  if (!current()) return null;                         // a newer grab happened meanwhile
  let pick = null, src = null, srcTab = null;
  const read = answers.filter(Boolean);
  for (const [i, r] of answers.entries()) {
    const p = r && pickToken(r);
    if (p) { pick = p; src = r; srcTab = picked[i]; break; }
  }
  if (!read.length) return none(t("grab.noAccess"));
  if (!pick) return none(t("grab.notFound", { where: read.length === 1 ? String(read[0].host || t("grab.thisTab")) : t("grab.openTabs") }));
  if (pick !== state.token) {
    newGeneration();
    gen = state.gen;                                   // our own bump, not a token change from elsewhere
    state.token = pick;
  }
  if (await checkOwner() && current()) renderAccounts();
  if (!current()) return null;
  state.token = pick;
  // page = this tab + this load of it (see autoLoadAccounts).
  const loadId = Number.isFinite(src.loadId) ? src.loadId : null;
  state.tokenSource = { surface: surfaceOf(String(src.host || ""), String(src.path || "")), page: loadId ? `${srcTab.id}:${loadId}` : null };
  await saveSession({ token: pick, tokenSource: state.tokenSource });
  // A token change during the write above (this window or another) supersedes us; if it happened, don't report success.
  if (!current()) return null;
  renderToken();
  if (toClipboard) {
    const ok = await copy(pick, t("grab.copied"));
    // Only warn for a token we know can't launch ads (EAAH/EAAd); ads-capable and unknown stay quiet.
    if (ok && TOKEN_KIND[pick.slice(0, 4)]?.ads === false) toast(t("grab.notAds", { k: pick.slice(0, 4) }));
  }
  return pick;
}
function renderToken(hint) {
  const tok = state.token;
  // Full token, one line; the field clips whatever runs past its right edge.
  $("#tokenBox").textContent = tok || hint || "—";
  $("#tokenBox").classList.toggle("filled", !!tok);
  $("#checkToken").disabled = !tok;
  // Card under the field: the current token's badge/app/use. For a token that can't launch ads we add
  // the "not an ads token · open Ads Manager" hint; ads-capable tokens (EAAB/EAAG/EAAI) don't get it.
  // With no token grabbed we still show a bare Ads Manager link — that's where the ads token lives.
  const card = $("#kindCard");
  const adsLink = (lead) => el("div", { class: "kind-ads" }, lead || null,
    el("a", { href: ADS_MANAGER_URL, target: "_blank", rel: "noopener noreferrer" }, t("kind.goAds"), el("i", { class: "i i-external" })));
  card.classList.remove("hidden");
  if (!tok) { card.className = "kind"; card.title = ""; return fill(card, adsLink()); }
  const kind = tok.slice(0, 4);
  const k = TOKEN_KIND[kind] || UNKNOWN_KIND;
  card.className = `kind ${k.tone}`;
  const surf = state.tokenSource?.surface;
  card.title = surf ? t("kind.from", { s: surf.startsWith("surface.") ? t(surf) : surf }) : "";
  fill(card,
    el("div", { class: "kind-head" }, el("span", { class: "kind-badge" }, kind), el("span", { class: "kind-app" }, k.app || t("kind.unknown.app"))),
    el("div", { class: "kind-use" }, k.app ? t(`kind.${kind}`) : t("kind.unknown.use")),
    isDead() ? el("div", { class: "err-text" }, t("kind.dead", { c: deadCode() })) : null,
    // ads-capable → nothing; known non-ads → "not an ads token" + link; unknown → bare link only.
    k.ads === true ? null : adsLink(k.ads === false ? t("kind.notAds") : null),
  );
}
async function checkToken() {
  const box = $("#tokenInfo");
  const btn = $("#checkToken");
  box.classList.remove("hidden");
  fill(box, el("dt", {}, t("check.checking")), el("dd", {}, "…"));
  btn.disabled = true;
  try {
    await settledGrab();
    const me = await graph("me", { fields: "id,name" });
    // Sequential on purpose: three small reads, never in parallel.
    // A failed step is shown as "couldn't check"; a Stale one aborts the chain before the next request.
    const soft = (p) => p.then((v) => ({ v }), (err) => { if (err instanceof Stale) throw err; return { err }; });
    const app = await soft(graph("app", { fields: "id,name" }));
    const perms = await soft(graph("me/permissions"));
    const need = ["ads_read", "ads_management", "business_management"];
    let permsDd, grantedCount = null;
    // A reply without a data array is "couldn't check", not "no permissions".
    if (!perms.err && !Array.isArray(perms.v?.data)) perms.err = new Error(t("check.badPerms"));
    // Events / Commerce Manager tokens can't read their own /me/permissions (#10). That's the token
    // type, not an error — say so plainly instead of a red failure.
    if (perms.err && perms.err.code === 10)
      permsDd = el("span", { class: "hint" }, t("check.noPerms"));
    else if (perms.err) permsDd = errText(t("check.failed", { m: perms.err.message }));
    else {
      // Every granted scope (the set is fixed by the Meta app the token came from), plus the
      // ads scopes that are missing in red. Green = granted.
      const granted = perms.v.data.filter((p) => p.status === "granted").map((p) => p.permission).sort();
      grantedCount = granted.length;
      const missing = need.filter((p) => !granted.includes(p));
      // Collapsed by default: the three ads scopes as pills, the full list (often 80+) behind a toggle.
      permsDd = el("div", { class: "perms" },
        el("div", { class: "chips" }, need.map((p) => pill(missing.includes(p) ? t("check.missing", { p }) : p, missing.includes(p) ? "bad" : "ok"))),
        granted.length ? el("details", { class: "more" },
          el("summary", {}, el("i", { class: "i i-chevron" }),
            el("span", { class: "when-closed" }, t("check.allPerms", { n: granted.length })), el("span", { class: "when-open" }, t("check.collapse"))),
          el("div", { class: "perm-list" }, granted.join(" · "))) : null);
    }
    fill(box,
      el("dt", {}, t("check.profile")), el("dd", {}, me.name ? `${me.name} · ` : "", numEl(me.id ?? "—")),
      el("dt", {}, t("check.app")), el("dd", {}, app.err ? errText(t("check.failed", { m: app.err.message }))
        : [`${app.v.name} · `, numEl(app.v.id), KNOWN_APPS[app.v.id] ? ` (${KNOWN_APPS[app.v.id]})` : ""]),
      el("dt", {}, grantedCount === null ? t("check.perms") : t("check.permsN", { n: grantedCount })), el("dd", {}, permsDd),
    );
  } catch (e) {
    if (e instanceof Stale) return;
    fill(box, el("dt", {}, t("check.error")), el("dd", {}, errText(e.message)));
  } finally { btn.disabled = !state.token; }
}

// ---------- cookies ----------
// Exactly the cookies Chrome would send to graph.facebook.com (URL-matched by Chrome itself),
// one per name. The cookie box, the header string, the token + cookie block and the JSON all use this set.
async function readCookies() {
  const all = await chrome.cookies.getAll({ url: GRAPH_URL });
  const byName = {};
  for (const c of all) if (!byName[c.name] || c.domain === ".facebook.com") byName[c.name] = c;
  const rank = (n) => { const i = SESSION_COOKIES.indexOf(n); return i < 0 ? 99 : i; };
  state.cookies = Object.values(byName).sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name));
  renderCookies();
}
const cookieMap = () => Object.fromEntries(state.cookies.map((c) => [c.name, c]));
const hasSession = () => { const m = cookieMap(); return !!(m.c_user && m.xs); };
function renderCookies() {
  const byName = cookieMap();
  for (const id of ["#copyCookies", "#copyCookieJson"]) $(id).disabled = !state.cookies.length;
  // The whole cookie string, one colour like the token, in a short scrollable box;
  // the status line under it says whether the profile is logged in and how many cookies go out.
  const n = state.cookies.length;
  const box = $("#cookieBox");
  box.classList.toggle("filled", !!n);
  if (n) fill(box, el("div", { class: "ck-scroll" }, state.cookies.map((c) => `${c.name}=${c.value}`).join("; ")));
  else box.textContent = t("ck.none");
  const xs = byName.xs;
  const until = xs?.expirationDate ? new Date(xs.expirationDate * 1000).toLocaleDateString(locale()) : null;
  fill($("#cookieStatus"), hasSession()
    ? [pill(t("ck.loggedIn"), "ok"), el("span", {}, until ? t("ck.until") : t("ck.untilClose"),
        until ? numEl(until) : null, " · ", numEl(n), ` ${tn(n, "ck.count")}`)]
    : [pill(t("ck.loggedOut"), "bad")]);
}
const cookieHeader = () => state.cookies.map((c) => `${c.name}=${c.value}`).join("; ");
function cookiesJson() {
  return JSON.stringify(state.cookies.map((c) => ({
    name: c.name, value: c.value, domain: c.domain, path: c.path, secure: c.secure, httpOnly: c.httpOnly,
    sameSite: c.sameSite, hostOnly: c.hostOnly, session: c.session, storeId: c.storeId,
    ...(c.expirationDate ? { expirationDate: c.expirationDate } : {}),
  })), null, 2);
}
async function copyCookies(asJson) {
  await readCookies();
  if (!hasSession()) return toast(t("ck.noSession"), true);
  copy(asJson ? cookiesJson() : cookieHeader(), asJson ? t("ck.jsonCopied") : t("ck.copied"));
}
// ---------- token + cookie block ----------
// Whose token is it — the logged-in user's (c_user)? One /me read, remembered per token + login.
// An open FB tab can keep a token from before the profile switched accounts; exporting it next to the new
// cookies would hand out a pair that never worked. Throws Stale / a dead-session error; any other failure
// (network, API pause) is "unknown" and does not block the export.
async function ownerCheck(token) {
  const user = cookieMap().c_user?.value || null;
  if (state.checked?.token === token && state.checked.user === user) return state.checked;
  let meId = null, verdict = "unknown";
  try {
    meId = (await graph("me", { fields: "id" })).id;
    verdict = ownerVerdict(!!TOKEN_KIND[token.slice(0, 4)], meId, user);
  } catch (e) {
    if (e instanceof Stale || e.session) throw e;
  }
  const res = { token, user, verdict, meId };
  if (verdict !== "unknown") state.checked = res;
  return res;
}
async function copyEnv() {
  // Always a fresh token + a cookie snapshot taken right after it; nothing from the old cache.
  const token = await grabToken({ toClipboard: false });
  if (!token) return;
  const gen = state.gen;
  await readCookies();
  if (gen !== state.gen || state.token !== token) return;
  if (!hasSession()) return toast(t("ck.noSession"), true);
  if (isDead()) return toast(t("err.session", { c: deadCode() }), true);   // even when the owner check is cached
  let own;
  try { own = await ownerCheck(token); }
  catch (e) { if (!(e instanceof Stale)) toast(e.message, true); return; }
  if (gen !== state.gen || state.token !== token) return;
  if (own.verdict === "mismatch") return toast(t("env.mismatch", { a: own.meId, b: own.user }), true);
  // token, blank line, cookie header — nothing else
  copy(`${token}\n\n${cookieHeader()}`, own.verdict === "ok" ? t("env.copied") : t("env.unverified"));
}

// ---------- accounts ----------
function fieldsList() {
  return [...BASE_FIELDS, ...Object.entries(OPTIONAL_FIELDS).filter(([k]) => !state.skip.has(k)).map(([, f]) => f)].join(",");
}
// Which optional field did Graph complain about? null = the error is not about an optional field.
function optionalFieldIn(e) {
  if (!(e.code === 100 || /field/i.test(e.raw || ""))) return null;
  return Object.keys(OPTIONAL_FIELDS).find((k) => !state.skip.has(k) && (e.raw || e.message).includes(k)) || null;
}
// Mark rows fetched without an optional field (spend = unknown, not 0; pixels = unknown, not none)
// and keep only the display string of the funding source.
// _floor: what the insights already prove was spent (today + last 30 days), kept for the "All time" figure.
const spendOfRow = (x) => Number(x?.data?.[0]?.spend);
const slim = (a) => ({ ...a, _noInsights: state.skip.has("insights") || undefined,
  _floor: state.skip.has("insights") ? undefined : spendFloor(spendOfRow(a.p_today), spendOfRow(a.p_month)),
  _noPixels: state.skip.has("adspixels") || undefined,
  funding_source_details: a.funding_source_details ? { display_string: a.funding_source_details.display_string } : undefined });

// auto: started by opening the Accounts tab, not by a click. Same limits as a click, but silent where a click
// would only complain (no token, dead session, the one-minute slot): the empty list explains itself.
let accBusy = false;                                    // one list load at a time: a click during an automatic load is a no-op
async function fetchAccounts(opts) {
  if (accBusy) return;
  accBusy = true;
  try { await loadAccountsNow(opts); } finally { accBusy = false; }
}
async function loadAccountsNow({ auto = false } = {}) {
  await settledGrab();
  if (!state.token && !(await grabToken({ toClipboard: false, silent: auto }))) return;   // no token: grabToken says why
  if (isDead()) return auto ? undefined : toast(t("err.session", { c: deadCode() }), true);   // before the slot: costs nothing
  const gen = state.gen;                              // fixed before waiting for the lock
  let wait;
  try { wait = await claimSlot("accounts"); }        // before sending: a failed attempt counts too
  catch (e) { return auto ? undefined : toast(t("err.slot", { m: e.message }), true); }
  if (gen !== state.gen) return;                      // new token while waiting
  if (wait > 0) return auto ? undefined : toast(t("acc.wait", { n: Math.ceil(wait / 1000) }), true);
  // The request goes out now (a failure counts too): this FB page load has had its list.
  saveSession({ autoPage: state.tokenSource?.page || null });
  const btn = $("#loadAccounts");
  btn.disabled = true; btn.setAttribute("aria-busy", "true");
  state.accLoading = true; renderAccounts();
  try {
    const rows = [];
    let after = null, pages = 0;
    while (pages < 10) {
      let page;
      try {
        page = await graph("me/adaccounts", { fields: fieldsList(), limit: "50", ...(after ? { after } : {}) });
      } catch (e) {
        const k = e instanceof Stale ? null : optionalFieldIn(e);
        if (k) { state.skip.add(k); continue; }       // same page again without that field
        throw e;
      }
      if (!Array.isArray(page.data)) throw new Error(t("err.noData"));
      rows.push(...page.data.map(slim));
      after = page.paging?.next ? page.paging.cursors?.after : null;
      pages++;
      if (!after) break;
    }
    if (gen !== state.gen) return;
    const owner = await fbUser();
    if (gen !== state.gen) return;
    // Another user's list: their ads and open rows don't belong to this one.
    if (owner !== state.owner) Object.assign(state, { open: new Set(), ads: {}, adsHidden: new Set() });
    Object.assign(state, { accounts: rows, fetchedAt: Date.now(), truncated: !!after, owner });
    await saveSession({ accounts: rows, fetchedAt: state.fetchedAt, truncated: state.truncated, owner, ads: adsToSave() });
    saveView();
    if (!auto || after) toast(t("acc.loaded", { n: rows.length }) + (after ? t("acc.truncated") : ""));   // the list itself is the answer to an automatic load
  } catch (e) {
    if (!(e instanceof Stale)) toast(e.message, true);
  } finally {
    state.accLoading = false;
    btn.disabled = false; btn.removeAttribute("aria-busy");
    renderAccounts();
  }
}
// The Accounts tab loads the list by itself when there is nothing loaded yet, or when the FB page the token came
// from was reloaded since the last load. Reopening the popup or switching tabs alone never sends a request.
// At most one try per popup open; the limits are a click's (the one-minute slot, the API pause, a dead session).
let autoTried = false, tokenReadyDone;
const tokenReady = new Promise((resolve) => { tokenReadyDone = resolve; });   // the silent token read on open has finished
async function autoLoadAccounts() {
  if (autoTried) return;
  autoTried = true;
  const placeholder = !state.accounts.length;           // "Loading…" at once, not "press refresh" and then "Loading…"
  if (placeholder) { state.accLoading = true; renderAccounts(); }
  try {
    // Without the silent token read the request could go out with a stale token. Not forever, though.
    await Promise.race([tokenReady, new Promise((resolve) => setTimeout(resolve, 15000))]);
    if (!state.token || isDead() || state.cooldownUntil > Date.now()) return;
    const page = state.tokenSource?.page || null;
    const { autoPage } = await chrome.storage.session.get("autoPage");
    if (state.fetchedAt && (!page || page === autoPage)) return;   // loaded before, same FB page load: keep the list
    await fetchAccounts({ auto: true });
  } finally {
    if (placeholder && !accBusy) { state.accLoading = false; renderAccounts(); }
  }
}
// Spend for the selected period. null = unknown (field unavailable, or the cache is from an earlier day
// in that account's timezone); a missing row = no delivery = 0.
// FIELD 2026-09-27: Graph omits a nested insights key entirely when there is no delivery in the
// period (not `data: []`), so a missing key on a row fetched WITH the field is a real 0.
function statsOf(a, key = state.period) {
  if (key === "all") {
    // Meta's total, but never below what the last 30 days + today showed when the list was fetched (see lifetimeSpend).
    return { spend: lifetimeSpend(major(a.amount_spent || 0, a.currency), a._floor), imp: null, clicks: null };
  }
  if (!state.fetchedAt || a._noInsights) return null;
  if (dayIn(a.timezone_name, state.fetchedAt) !== dayIn(a.timezone_name, Date.now())) return null;
  const r = a[PERIODS.find((p) => p.key === key).alias]?.data?.[0];
  if (!r) return { spend: 0, imp: 0, clicks: 0 };
  const spend = Number(r.spend);
  if (!Number.isFinite(spend)) return null;
  return { spend, imp: Number(r.impressions) || 0, clicks: Number(r.inline_link_clicks) || 0, from: r.date_start, to: r.date_stop };
}
// "29.08" in Russian, "Aug 29" in English (d = YYYY-MM-DD from Graph).
const shortDate = (d) => {
  if (!d) return "";
  if (getLang() === "ru") return `${d.slice(8, 10)}.${d.slice(5, 7)}`;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));
};
function periodRange() {
  for (const a of state.accounts) { const s = statsOf(a); if (s?.from) return s.from === s.to ? shortDate(s.from) : `${shortDate(s.from)}–${shortDate(s.to)}`; }
  return "";
}
// One format for every account timezone: "UTC+3 · Kiev", "UTC−3". Meta stores some as city names
// (Europe/Kiev) and some as Etc/GMT±N, whose sign is inverted (Etc/GMT+3 = UTC−3); Intl resolves both.
const tzLabels = new Map();
function tzLabel(tz) {
  if (!tz) return "";
  if (!tzLabels.has(tz)) tzLabels.set(tz, tzLabelOf(tz));
  return tzLabels.get(tz);
}
function tzLabelOf(tz) {
  let off;
  try {
    off = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "shortOffset" })
      .formatToParts(Date.now()).find((p) => p.type === "timeZoneName")?.value;
  } catch { return tz; }
  off = (off || "GMT").replace("GMT", "UTC").replace("-", "−");
  off = off.replace(/^UTC\+0$/, "UTC");
  const city = tz.includes("/") && !tz.startsWith("Etc/") ? tz.split("/").pop().replace(/_/g, " ") : "";
  return city ? `${off} · ${city}` : off;
}
// Rows matching the search + status filter. The total, the count and "Active IDs" all follow it.
function visibleRows() {
  const q = state.filter.trim().toLowerCase();
  return state.accounts.filter((a) => {
    const [label] = accStatus(a);
    if (state.statusFilter && label !== state.statusFilter) return false;
    return !q || `${a.name} ${a.account_id} ${label} ${a.business?.name || ""}`.toLowerCase().includes(q);
  });
}
const isFiltered = () => !!(state.filter.trim() || state.statusFilter);
function copyLiveIds() {
  const ids = visibleRows().filter((a) => a.account_status === 1).map((a) => a.account_id);
  if (!ids.length) return toast(t("acc.noLive"), true);
  copy(ids.join("\n"), t("acc.idsCopied", { n: ids.length }) + (state.truncated ? t("acc.partial") : ""));
}
// [label, tone] for an account; unknown codes are shown as their number.
function accStatus(a) {
  const c = a.account_status;
  return c in ACCOUNT_STATUS ? [t(`status.${c}`), ACCOUNT_STATUS[c]] : [t("status.other", { n: c }), "warn"];
}
function renderHint() {
  const total = $("#accountsTotal");
  if (!state.fetchedAt) return fill(total);
  const all = state.accounts.length, rows = visibleRows(), n = rows.length;
  const count = isFiltered() ? t("acc.found", { n, all }) : `${all} ${tn(all, "acc.count")}`;
  const meta = el("span", { class: "total-meta" }, `${count}${state.truncated ? t("acc.notAll") : ""} · ${t("acc.updated", { t: ago(state.fetchedAt) })}`);
  if (!n) return fill(total, meta);
  const totals = {};
  let unknown = false;
  for (const a of rows) {
    const s = statsOf(a);
    if (!s) { unknown = true; continue; }
    if (s.spend) totals[a.currency] = (totals[a.currency] || 0) + s.spend;
  }
  const sum = Object.entries(totals).map(([cur, v]) => fmt(v, cur)).join(" + ");
  const label = t(PERIODS.find((p) => p.key === state.period).label);
  const range = state.period === "all" ? "" : periodRange();
  // Row 1: what the number is (left) + how fresh / how many (right). Row 2: the number.
  fill(total,
    el("span", { class: "total-label" }, `${t("acc.spend")} · ${label.toLowerCase()}${range ? ` · ${range}` : ""}`),
    meta,
    el("span", { class: "total-value" }, unknown && !sum ? t("acc.refreshDash") : sum || fmt(0, rows[0].currency),
      unknown && sum ? el("small", { title: t("acc.notAllTitle") }, t("acc.notAllShort")) : null),
  );
}
// Re-rendering replaces nodes: put keyboard focus back on the control with the same data-focus key.
function keepFocus(render) {
  const key = document.activeElement?.dataset?.focus;
  render();
  if (key) document.querySelector(`[data-focus="${CSS.escape(key)}"]`)?.focus();
}
function renderPeriods() {
  keepFocus(() => fill($("#periodSeg"), ...PERIODS.map((p) => el("button", {
    class: `seg-btn${p.key === state.period ? " active" : ""}`, "aria-pressed": String(p.key === state.period), "data-focus": `period:${p.key}`,
    title: p.key === "week" || p.key === "month" ? t("period.noToday") : p.key === "all" ? t("period.allNote") : null,
    onclick: () => { state.period = p.key; try { localStorage.setItem("period", p.key); } catch { /* */ } renderPeriods(); renderAccounts(); },
  }, t(p.label)))));
}
function renderAccounts() { keepFocus(drawAccounts); }
function drawAccounts() {
  const list = $("#accountsList");
  renderHint();
  $("#copyLiveIds").disabled = !state.accounts.some((a) => a.account_status === 1);
  const counts = {};
  for (const a of state.accounts) { const [l] = accStatus(a); counts[l] = (counts[l] || 0) + 1; }
  if (state.statusFilter && !counts[state.statusFilter]) state.statusFilter = null;
  // A status filter is only useful when statuses differ; with one status it just repeats the count.
  if (Object.keys(counts).length < 2) { state.statusFilter = null; for (const k of Object.keys(counts)) delete counts[k]; }
  fill($("#statusChips"), ...Object.entries(counts).map(([label, n]) => {
    const tone = Object.entries(ACCOUNT_STATUS).find(([c]) => t(`status.${c}`) === label)?.[1] || "";
    const on = state.statusFilter === label;
    return el("button", { class: `pill chip ${tone}${on ? " on" : ""}`, "aria-pressed": String(on), "data-focus": `chip:${label}`,
      onclick: () => { state.statusFilter = on ? null : label; renderAccounts(); } }, `${label} ${n}`);
  }));
  const rows = visibleRows();
  if (!state.accounts.length) return fill(list, el("div", { class: "empty" }, state.accLoading ? t("acc.loading") : t("acc.empty")));
  if (!rows.length) return fill(list, el("div", { class: "empty" }, t("acc.noMatch")));
  // Stats once per row: the sort comparator would otherwise recompute them O(n log n) times.
  const stats = new Map(rows.map((a) => [a, statsOf(a)]));
  const spendOf = (a) => stats.get(a)?.spend ?? -1;
  rows.sort((a, b) => (b.account_status === 1) - (a.account_status === 1) || spendOf(b) - spendOf(a));
  fill(list, ...rows.map((a) => renderAccount(a, stats.get(a))));
}
function renderAccount(a, st) {
  const [label, tone] = accStatus(a);
  const cur = a.currency;
  const threshold = a.adspaymentcycle?.data?.[0]?.threshold_amount;
  const dsl = a.adtrust_dsl;
  const cpc = st?.clicks ? st.spend / st.clicks : null;
  const isOpen = state.open.has(a.account_id);
  const card = el("div", { class: `acc${isOpen ? " open" : ""}` });
  const toggle = () => {
    const open = card.classList.toggle("open");
    state.open[open ? "add" : "delete"](a.account_id);
    title.setAttribute("aria-expanded", String(open));
    saveView();
  };
  // The whole row toggles on click (mouse); the keyboard / screen-reader control is the title button.
  // Its click bubbles to the row, so it has no handler of its own. The row itself is not a button:
  // it holds the copy-ID button and the Ads Manager link, and interactive controls must not nest.
  const title = el("button", { type: "button", class: "acc-title", "aria-expanded": String(isOpen), "data-focus": `acc:${a.account_id}` },
    el("i", { class: "i i-chevron", "aria-hidden": "true" }),
    el("span", { class: "acc-name", title: a.name }, a.name || t("acc.noName")));
  const head = el("div", { class: "acc-head", onclick: toggle },
    title,
    pill(label, tone),
    el("div", { class: "acc-ids" },
      el("button", { class: "acc-id", title: t("acc.copyId"), "data-focus": `id:${a.account_id}`,
                     onclick: (ev) => { ev.stopPropagation(); copy(a.account_id, t("acc.idCopied")); } },
         a.account_id, el("i", { class: "i i-copy" })),
      // Open in Ads Manager straight from the collapsed row; must not toggle the row.
      el("a", { class: "acc-link", title: t("acc.openAds"), "aria-label": t("acc.openAds"), target: "_blank", rel: "noopener noreferrer", "data-focus": `link:${a.account_id}`,
                href: `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${a.account_id}`,
                onclick: (ev) => ev.stopPropagation() }, el("i", { class: "i i-external" }))),
    st ? el("div", { class: "acc-spend" }, fmt(st.spend, cur))
       : el("div", { class: "acc-spend muted", title: t("acc.noPeriod") }, "—"),  // .acc-spend uses the number font in CSS
    el("div", { class: "acc-meta" },
      a.business
        ? el("span", { class: "owner", title: t("acc.inBm", { n: a.business.name, id: a.business.id }) }, el("i", { class: "i i-bm" }), t("acc.bm", { n: a.business.name }))
        : el("span", { class: "owner", title: t("acc.personalTitle") }, el("i", { class: "i i-user" }), t("acc.personal")),
      a.timezone_name ? el("span", { title: t("acc.tz", { tz: a.timezone_name }) }, tzLabel(a.timezone_name)) : null,
      a.disable_reason ? el("span", { class: "err-text" }, `${has(`reason.${a.disable_reason}`) ? t(`reason.${a.disable_reason}`) : t("reason.other")} (${a.disable_reason})`) : null),
    st && st.imp !== null && (st.imp || st.clicks)
      ? el("div", { class: "acc-sub", title: t("acc.imp", { n: numFmt().format(st.imp) }) },
          numEl(numFmt().format(st.clicks)), t("acc.clicks"), cpc !== null ? [" · CPC ", numEl(fmt(cpc, cur))] : null)
      : el("div", { class: "acc-sub" }),
  );
  const adsBox = el("div", { class: "ads", "data-ads-box": a.account_id });
  const pixels = a.adspixels?.data;
  const body = el("div", { class: "acc-body" },
    el("dl", { class: "kv" },
      el("dt", {}, t("acc.spent")), el("dd", {}, numEl(fmt(statsOf(a, "all").spend, cur))),   // same number as the "All time" period
      el("dt", {}, t("acc.balance")), el("dd", {}, numEl(money(a.balance, cur))),
      el("dt", {}, t("acc.threshold")), el("dd", {}, threshold !== undefined ? numEl(money(threshold, cur)) : "—"),
      el("dt", {}, t("acc.daily")), el("dd", {}, dsl === undefined ? "—" : Number(dsl) < 0 ? t("acc.noLimit") : numEl(fmt(Number(dsl), cur))),
      el("dt", {}, t("acc.spendCap")), el("dd", {}, Number(a.spend_cap || 0) ? numEl(money(a.spend_cap, cur)) : t("acc.no")),
      el("dt", {}, t("acc.funding")), el("dd", {}, a.funding_source_details?.display_string || "—"),
      el("dt", {}, t("acc.pixels")), el("dd", {}, a._noPixels ? "—"
        : pixels?.length ? pixels.flatMap((p, i) => [i ? ", " : null, p.name, " · ", numEl(p.id)]) : pill(t("acc.noPixel"), "warn")),
      el("dt", {}, t("acc.owner")), el("dd", {}, a.business ? [t("acc.bmPrefix"), a.business.name, " · ", numEl(a.business.id)] : t("acc.noBm")),
      el("dt", {}, t("acc.country")), el("dd", {}, a.business_country_code || "—", " · ", a.created_time ? numEl(a.created_time.slice(0, 10)) : "—"),
    ),
    adsControls(a.account_id),
    adsBox,
  );
  card.append(head, body);
  if (state.ads[a.account_id]) renderAds(adsBox, state.ads[a.account_id]);
  return card;
}
// ---------- ads ----------
const adsBlocked = (id) => state.adsBusy.has(id) || (state.locks.ads[id] || 0) > Date.now();
// Buttons are looked up by account id each time: a re-render replaces the nodes.
function syncAdsButtons() {
  for (const b of $$("[data-ads]")) b.disabled = adsBlocked(b.dataset.ads);
}
const adsBox = (id) => document.querySelector(`[data-ads-box="${CSS.escape(id)}"]`);
// Only successful reads are kept across popup reopens: an error text would sit on the row long after it is stale.
const adsToSave = () => Object.fromEntries(Object.entries(state.ads).filter(([, v]) => !v.error).map(([k, { stale, ...v }]) => [k, v]));
// Before the first load: one "Ads" button. After: a show/hide toggle (no request, uses the
// cached list) + a refresh icon that re-reads Graph and is the only control bound to the 30 s lock.
function adsControls(id) {
  const data = state.ads[id];
  if (!data) return el("div", { class: "actions" },
    el("button", { class: "btn sm", "data-ads": id, "data-focus": `ads:${id}`, disabled: adsBlocked(id), onclick: () => loadAds(id) }, t("ads.btn")));
  const hidden = state.adsHidden.has(id);
  const n = data.ads?.length || 0;
  return el("div", { class: "actions" },
    el("button", { class: "btn sm", "aria-expanded": String(!hidden), "data-focus": `adsToggle:${id}`, onclick: () => {
      state.adsHidden[hidden ? "delete" : "add"](id); saveView(); renderAccounts();
    } }, el("i", { class: `i i-chevron${hidden ? "" : " up"}` }), hidden ? `${t("ads.btn")}${data.error ? "" : ` · ${n}`}` : t("ads.collapse")),
    el("button", { class: "icon-btn sm", "data-ads": id, "data-focus": `ads:${id}`, disabled: adsBlocked(id), title: t("ads.refresh"),
                   "aria-label": t("ads.refresh"), onclick: () => loadAds(id) }, el("i", { class: "i i-refresh" })));
}
function renderAds(box, { ads, more, error, stale }) {
  if (!box) return;
  const id = box.dataset.adsBox;
  if (state.adsHidden.has(id)) return fill(box);
  if (error) return fill(box, el("div", { class: "hint err-text" }, error));
  if (!ads.length) return fill(box, el("div", { class: "hint" }, t("ads.none")));
  const count = (st) => ads.filter((ad) => st.includes(ad.effective_status)).length;
  const live = count(["ACTIVE"]), rejected = count(AD_PROBLEMS);
  fill(box, el("div", { class: "ads-sum" },
      `${ads.length}${more ? "+" : ""} ${tn(ads.length, "ads.count")}`,
      live ? t("ads.live", { n: live }) : "", rejected ? el("span", { class: "err-text" }, t("ads.rejected", { n: rejected })) : ""),
    stale ? el("div", { class: "hint err-text" }, t("ads.stale", { m: stale })) : null,
    // Disapproved / with issues first, each with every reason and the placement it applies to.
    ...[...ads].sort((a, b) => adRank(a.effective_status) - adRank(b.effective_status)).map((ad) => {
    const st = ad.effective_status;
    const [l, tone] = st in AD_STATUS ? [t(`ad.${st}`), AD_STATUS[st]] : [st, ""];
    const why = reviewLines(ad);
    return el("div", { class: "ad" }, el("span", {}, ad.name), pill(l, tone),
      why.length ? el("small", {}, why.map((line) => el("span", { class: "why" }, line))) : null);
  }), ...(more ? [el("div", { class: "hint" }, t("ads.more", { n: ads.length }))] : []));
}
// One GET of an account's ads. issues_info (the reason for "with issues") is optional like the account fields:
// if Graph rejects it, the call is repeated once without it.
async function readAds(id, extra = {}) {
  for (;;) {
    const fields = `id,name,effective_status,ad_review_feedback${state.skip.has("issues_info") ? "" : ",issues_info"}`;
    try { return await graph(`act_${id}/ads`, { fields, limit: "100", ...extra }); }
    catch (e) {
      if (e instanceof Stale || state.skip.has("issues_info") || !(e.raw || e.message || "").includes("issues_info")) throw e;
      state.skip.add("issues_info");
    }
  }
}
async function loadAds(id) {
  if (state.adsBusy.has(id)) return;
  await settledGrab();
  if (!state.token && !(await grabToken({ toClipboard: false }))) return;
  if (isDead()) return toast(t("err.session", { c: deadCode() }), true);
  const gen = state.gen, busy = state.adsBusy;        // fixed before waiting for the lock
  busy.add(id);
  syncAdsButtons();
  let wait;
  try { wait = await claimSlot(id); }
  catch (e) { busy.delete(id); syncAdsButtons(); return toast(t("err.slot", { m: e.message }), true); }
  if (gen !== state.gen) { busy.delete(id); return; } // new token while waiting: old account list
  if (wait > 0) {
    busy.delete(id); syncAdsButtons();
    return toast(t("ads.wait"), true);
  }
  syncAdsButtons();
  setTimeout(syncAdsButtons, ADS_LOCK_MS + 50);
  const box = adsBox(id);
  if (box) fill(box, el("div", { class: "hint" }, t("ads.loading")));
  try {
    const res = await readAds(id);
    if (!Array.isArray(res.data)) throw new Error(t("err.noData"));
    let list = res.data;
    if (res.paging?.next) {
      // More than one page: the ads that need attention must not hide behind the first 100.
      try {
        const bad = await readAds(id, { effective_status: JSON.stringify(AD_PROBLEMS) });
        const have = new Set(list.map((a) => a.id));
        if (Array.isArray(bad.data)) list = list.concat(bad.data.filter((a) => !have.has(a.id)));
      } catch (e) {
        if (e instanceof Stale) throw e;
        toast(e.message, true);                        // the first page is still worth showing
      }
    }
    state.ads[id] = { ads: list, more: !!res.paging?.next };
  } catch (e) {
    if (e instanceof Stale) return;
    // A failed refresh must not wipe the list you already have (a pause, a dead session, a timeout),
    // but the row says the list is old.
    const prev = state.ads[id];
    if (prev && !prev.error) { state.ads[id] = { ...prev, stale: e.message }; toast(e.message, true); }
    else state.ads[id] = { ads: [], error: e.message };
  } finally {
    busy.delete(id);                                    // our generation's set, not a newer one's
    syncAdsButtons();
  }
  state.adsHidden.delete(id);                           // a fresh load is shown expanded
  saveSession({ ads: adsToSave() }); saveView();
  renderAccounts();
}

// The ⟳ next to the token: read it again from the open FB tabs (no clipboard, no request to Graph).
// It is also the deliberate way to try a token Graph called dead: the mark is cleared first, so the next
// request with it goes out once. The account cache stays; rate locks and the throttle pause are not touched.
async function refreshToken() {
  const btn = $("#refreshToken");
  btn.disabled = true; btn.setAttribute("aria-busy", "true");
  const was = state.token, wasDead = isDead();
  clearDead(was);
  state.checked = null;                                 // the owner is verified again on the next export
  try {
    const got = await grabToken({ toClipboard: false });   // no token: grabToken toasts why
    if (got) toast(wasDead && got === was ? t("token.retry") : t("token.refreshed"));
  } finally { btn.disabled = false; btn.removeAttribute("aria-busy"); }
}

// ---------- wiring ----------
// Visual only. The popup opens at the height of the tab it shows: the Accounts tab takes Chrome's full 600 px from
// the start, so a list arriving a moment later doesn't make the window jump.
function showTab(name) {
  document.body.classList.toggle("tall", name === "accounts");
  $$(".tab").forEach((tab) => {
    const on = tab.dataset.tab === name;
    tab.classList.toggle("active", on); tab.setAttribute("aria-selected", String(on)); tab.tabIndex = on ? 0 : -1;
  });
  $$(".panel").forEach((p) => p.classList.toggle("active", p.id === `tab-${name}`));
  try { localStorage.setItem("tab", name); } catch { /* */ }
}
let started = false;                                    // start-up done: the auto-load may run
function switchTab(name) {
  showTab(name);
  if (name === "accounts" && started) autoLoadAccounts();
}
const savedTab = () => { try { const v = localStorage.getItem("tab"); return ["token", "cookies", "accounts"].includes(v) ? v : "token"; } catch { return "token"; } };
showTab(savedTab());                                    // module code runs before the first paint: open on the right tab and height

// RU · EN in the header. Everything is redrawn from state; the token field is re-read from the FB tab (local),
// the "Check" result is hidden (its text came from Graph in the old language — press again).
async function switchLang(l) {
  if (!(await setLang(l))) return;
  state.statusFilter = null;                            // it holds a translated label
  applyStatic();
  $("#tokenInfo").classList.add("hidden");
  renderToken(); renderPeriods(); renderAccounts(); renderUsage(); renderCookies();
  grabToken({ toClipboard: false, silent: true });
}

document.addEventListener("DOMContentLoaded", async () => {
  await loadLang(); applyStatic();
  $$("[data-lang]").forEach((b) => b.addEventListener("click", () => switchLang(b.dataset.lang)));
  await loadState();
  $$(".tab").forEach((tab) => tab.addEventListener("click", () => switchTab(tab.dataset.tab)));
  // WAI-ARIA tabs: arrows / Home / End move between tabs; Tab key goes straight into the panel.
  $(".tabs").addEventListener("keydown", (ev) => {
    const tabs = $$(".tab"), i = tabs.indexOf(document.activeElement), n = tabs.length;
    if (i < 0) return;
    const j = { ArrowRight: (i + 1) % n, ArrowLeft: (i + n - 1) % n, Home: 0, End: n - 1 }[ev.key];
    if (j === undefined) return;
    ev.preventDefault(); switchTab(tabs[j].dataset.tab); tabs[j].focus();
  });
  try { const p = localStorage.getItem("period"); if (PERIODS.some((x) => x.key === p)) state.period = p; } catch { /* */ }
  renderPeriods();

  $("#grabToken").addEventListener("click", () => grabToken());
  $("#checkToken").addEventListener("click", checkToken);
  $("#copyEnv").addEventListener("click", copyEnv);
  $("#copyCookies").addEventListener("click", () => copyCookies(false));
  $("#copyCookieJson").addEventListener("click", () => copyCookies(true));
  $("#loadAccounts").addEventListener("click", () => fetchAccounts());
  $("#copyLiveIds").addEventListener("click", copyLiveIds);
  $("#accountFilter").addEventListener("input", (e) => { state.filter = e.target.value; renderAccounts(); });
  $("#refreshToken").addEventListener("click", refreshToken);

  await checkOwner();                                   // cache from another FB login: don't show it
  renderToken(); renderAccounts(); renderUsage();
  readCookies();
  // Show the token right away: read it from the open FB tab (local page read, no network request).
  grabToken({ toClipboard: false, silent: true }).catch(console.error).finally(tokenReadyDone);
  started = true;
  if (document.body.classList.contains("tall")) autoLoadAccounts();   // opened straight on the Accounts tab
  chrome.storage.session.onChanged?.addListener((ch) => {
    if (ch.cooldownUntil) { state.cooldownUntil = ch.cooldownUntil.newValue || 0; renderUsage(); }
    if (ch.locks) { state.locks = ch.locks.newValue || { accountsAt: 0, ads: {} }; syncAdsButtons(); }
    // Another window found the token dead (or a new token replaced it): follow.
    if (ch.dead) { state.dead = Array.isArray(ch.dead.newValue) ? ch.dead.newValue : []; renderToken(); }
    // Token dropped or replaced in another window of this extension: drop ours too.
    if (ch.token && (ch.token.newValue || null) !== state.token) {
      newGeneration(); state.grabOp++;
      state.token = ch.token.newValue || null;
      state.tokenSource = ch.tokenSource?.newValue || null;
      renderToken();
    }
    // Accounts loaded or dropped in another window of this extension: show the same list.
    if (ch.fetchedAt && (ch.fetchedAt.newValue || 0) !== state.fetchedAt) {
      chrome.storage.session.get(CACHE_KEYS).then((c) => {
        Object.assign(state, { accounts: c.accounts || [], fetchedAt: c.fetchedAt || 0, truncated: !!c.truncated,
          owner: c.owner || null, ads: c.ads || {} });
        renderAccounts();
      });
    }
  });
  // Re-render rows only when some account's "today" goes stale (its day rolled over).
  const todaySig = () => state.accounts.map((a) => (statsOf(a, "today") ? 1 : 0)).join("");
  let sig = todaySig();
  setInterval(() => {
    renderUsage(); syncAdsButtons();
    const now = todaySig();
    if (now !== sig) { sig = now; renderAccounts(); } else renderHint();
  }, 30000);
});
