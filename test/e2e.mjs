// End-to-end: real Chromium + the unpacked extension, Facebook and Graph answered by route() mocks (fictional data,
// nothing leaves the machine). Local only — CI runs the unit tests. Run: `node test/e2e.mjs`
// Needs playwright-core (`npm i -g playwright-core`, or PLAYWRIGHT_CORE=/path/to/playwright-core) and a Chromium.
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const EXT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
function loadPlaywright() {
  for (const p of [process.env.PLAYWRIGHT_CORE, "playwright-core", "/opt/homebrew/lib/node_modules/@playwright/cli/node_modules/playwright-core"].filter(Boolean)) {
    try { return require(p); } catch { /* next */ }
  }
  throw new Error("playwright-core not found: npm i -g playwright-core, or set PLAYWRIGHT_CORE");
}
const { chromium } = loadPlaywright();

const TOK = "EAAB" + "x".repeat(70), TOK2 = "EAAB" + "y".repeat(70), TOK_H = "EAAH" + "h".repeat(70), TOK_W = "EAAW" + "w".repeat(70);
let fails = 0, total = 0;
const ok = (name, cond, detail = "") => {
  total++; if (!cond) fails++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : `   -> ${detail}`}`);
};
const has = (s, part) => String(s).includes(part);

// One browser context = one profile. fb(url) → html of a Facebook page; graph(url) → { status?, headers?, body }.
async function boot({ user = "1001", fb, graph } = {}) {
  const page$ = { hits: [], fb: fb || (() => ""), graph: graph || (() => ({ body: { data: [] } })), user };
  const ctx = await chromium.launchPersistentContext("", { channel: "chromium", headless: true,
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`] });
  if (user) await ctx.addCookies([["c_user", user], ["xs", "47%3Aabc%3A2"], ["datr", "d1"]]
    .map(([name, value]) => ({ name, value, domain: ".facebook.com", path: "/", secure: true })));
  // Registered first, so the graph route below (matched first) wins for graph.facebook.com.
  await ctx.route("https://*.facebook.com/**", (r) => r.fulfill({ contentType: "text/html", body: page$.fb(new URL(r.request().url())) }));
  await ctx.route("https://graph.facebook.com/**", (r) => {
    const u = new URL(r.request().url());
    page$.hits.push(u.pathname.replace(/^\/v[\d.]+\//, "/") + u.search);
    const out = page$.graph(u, page$.hits.length) || {};
    const body = out.body ?? out;
    r.fulfill({ status: out.status || 200, contentType: "application/json",
      headers: { "access-control-allow-origin": "*", ...(out.headers || {}) }, body: JSON.stringify(body) });
  });
  const pg = await ctx.newPage(); await pg.goto("chrome://extensions");
  const id = await pg.evaluate(() => document.querySelector("extensions-manager").shadowRoot
    .querySelector("extensions-item-list").shadowRoot.querySelector("extensions-item").id);
  await pg.close();
  Object.assign(page$, { ctx, id, langSet: false, errs: [] });
  return page$;
}
const adsPage = (b, url = "https://adsmanager.facebook.com/adsmanager/manage/campaigns") =>
  b.ctx.newPage().then(async (p) => { await p.goto(url); return p; });
async function popup(b, tab) {
  const p = await b.ctx.newPage();
  p.on("pageerror", (e) => b.errs.push(e.message));
  p.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) b.errs.push(m.text()); });
  await p.goto(`chrome-extension://${b.id}/popup.html`);
  if (!b.langSet) { await p.evaluate(() => chrome.storage.local.set({ lang: "en" })); await p.reload(); b.langSet = true; }
  // The token field leaves "—" once the silent token read has finished (with a token or with the reason it has none).
  await p.waitForFunction(() => document.querySelector("#tokenBox").textContent.trim() !== "—", null, { timeout: 5000 }).catch(() => {});
  if (tab) await p.click(`[data-tab="${tab}"]`);
  return p;
}
const text = (p, sel) => p.evaluate((s) => document.querySelector(s)?.textContent.trim() ?? null, sel);
// Poll from Node, not with waitForFunction: page.evaluate awaits promises (chrome.storage.*) and survives reloads.
const until = async (p, fn, arg, ms = 4000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try { if (await p.evaluate(fn, arg)) return true; } catch { /* page navigating */ }
    await p.waitForTimeout(100);
  }
  return false;
};
const rowsAre = (p, sel, n) => until(p, ([s, k]) => document.querySelectorAll(s).length === k, [sel, n]);
const resetLocks = (p) => p.evaluate(() => chrome.storage.session.set({ locks: { accountsAt: 0, ads: {} } })).then(() => p.waitForTimeout(200));
// Click and wait for the toast it produces (cleared first, so an older toast cannot answer).
async function clickToast(p, sel, ms = 3500) {
  await p.evaluate(() => { const t = document.querySelector("#toast"); t.textContent = ""; t.classList.remove("show"); });
  await p.click(sel);
  await until(p, () => document.querySelector("#toast").textContent.length > 0, null, ms);
  return text(p, "#toast");
}
const captureClipboard = (p) => p.evaluate(() => { window.__clip = []; navigator.clipboard.writeText = async (s) => { window.__clip.push(s); }; });
const clip = (p) => p.evaluate(() => window.__clip);
const accountsJson = { data: [{ account_id: "111", name: "Acc A", account_status: 1, currency: "USD", timezone_name: "UTC", amount_spent: "500" }] };
const isAds = (u) => /\/act_\d+\/ads$/.test(u.pathname);
const adsFb = (tok) => (u) => u.hostname.startsWith("adsmanager") && tok ? `<script>window.__accessToken=${JSON.stringify(tok)}</script>ads` : "<p>feed</p>";


// ---------- shared steps ----------
const boxWait = (p, re) => until(p, (src) => new RegExp(src).test(document.querySelector("#tokenBox").textContent.trim()), re.source);
const GONE = /^(?!EAA|—)/;                                   // the field holds a reason, not a token
const loadAccounts = async (p, n = 1) => { await p.click("#loadAccounts"); return rowsAre(p, ".acc", n); };
async function openAds(p) {
  await p.click(".acc .acc-title"); await p.click(".acc.open [data-ads]");
  return until(p, () => { const a = document.querySelector(".acc.open .ads"); return !!a && a.textContent.trim() !== "" && !/Loading/.test(a.textContent); });
}
const stored = (p, key) => p.evaluate((k) => chrome.storage.session.get(k).then((o) => o[k]), key);

// ---------- token ----------
async function tokenFlows() {
  console.log("\n# token");
  let tok = TOK;
  const b = await boot({ fb: (u) => adsFb(tok)(u) });
  const ads = await adsPage(b), feed = await b.ctx.newPage(); await feed.goto("https://www.facebook.com/");
  const pop = await popup(b);
  ok("silent open shows the Ads Manager token", await boxWait(pop, /^EAAB/), await text(pop, "#tokenBox"));
  tok = null; await ads.reload(); await pop.reload();
  ok("silent open, no token on any tab -> token dropped", await boxWait(pop, GONE), await text(pop, "#tokenBox"));
  ok("click with no token anywhere -> error toast", (await clickToast(pop, "#grabToken")).length > 0);
  tok = TOK_H; await ads.reload(); await pop.click("#grabToken");
  ok("new token from the tab replaces it (EAAH)", await boxWait(pop, /^EAAH/), await text(pop, "#tokenBox"));
  ok("EAAH card names the type", has(await text(pop, "#kindCard"), "EAAH"));
  tok = "EAAB<img src=x>" + "z".repeat(70); await ads.reload(); await pop.click("#grabToken");
  ok("spoofed token shape from the page is rejected", (await boxWait(pop, GONE)) && !has(await text(pop, "#tokenBox"), "<img"), await text(pop, "#tokenBox"));
  await ads.close(); await pop.reload();
  ok("no ads tab -> field shows a reason", await boxWait(pop, GONE), await text(pop, "#tokenBox"));
  ok("no ads tab -> nothing stored", !(await stored(pop, "token")));
  ok("no console errors", b.errs.length === 0, b.errs.join(" | "));
  await b.ctx.close();
}

// The rendered-DOM fallback: read on ads / billing pages, never on feed-like pages full of other people's text.
async function fallbackFlows() {
  console.log("\n# token fallback (DOM scan)");
  const stray = `<p>comment: ${TOK_W}</p>`;
  for (const [url, expect] of [
    ["https://www.facebook.com/", false],
    ["https://www.facebook.com/groups/1/", false],
    ["https://www.facebook.com/groups/billing-tips/posts/1", false],
    ["https://www.facebook.com/billing.smith", false],
    ["https://www.facebook.com/billing_hub/payment_settings", true],
    ["https://adsmanager.facebook.com/adsmanager/manage/campaigns", true],
    ["https://www.facebook.com/ads/manager/account_settings/account_billing/", true],
    ["https://business.facebook.com/settings/", true],
  ]) {
    const b = await boot({ fb: () => stray });
    await (await b.ctx.newPage()).goto(url);
    const pop = await popup(b);
    await boxWait(pop, /^(?!—)/);
    const got = (await text(pop, "#tokenBox")).startsWith("EAAW");
    ok(`${new URL(url).host}${new URL(url).pathname}: token in plain DOM text ${expect ? "found" : "ignored"}`, got === expect, await text(pop, "#tokenBox"));
    await b.ctx.close();
  }
}

// ---------- API version ----------
async function versionFlows() {
  console.log("\n# api version");
  const b = await boot({ fb: adsFb(TOK), graph: (u) => {
    if (u.pathname.startsWith("/v26.0/")) return { status: 400, body: { error: { code: 2635, message: "(#2635) You are calling a deprecated version of the Ads API. Please update to the latest version: v27.0." } } };
    if (u.pathname.startsWith("/v27.0/")) return { headers: { "x-ad-api-version-warning": "Version v27.0 is deprecated; the call was upgraded to v28.0" }, body: accountsJson };
    return { body: accountsJson };
  } });
  await adsPage(b);
  const pop = await popup(b, "accounts");
  ok("no request on open", b.hits.length === 0, b.hits.join());
  ok("rows rendered", await loadAccounts(pop, 1));
  ok("#2635 -> retried on v27.0", b.hits.length === 2, b.hits.join());
  const v = await until(pop, () => chrome.storage.local.get("apiVersion").then((o) => o.apiVersion === "v28.0")) && "v28.0";
  ok("header names v27.0 first and v28.0 second -> v28.0 is stored (newest, not first)", v === "v28.0", String(v));
  await b.ctx.close();
}

// ---------- account cache keyed by FB user ----------
async function cacheFlows() {
  console.log("\n# account cache");
  let calls = 0;
  const b = await boot({ fb: adsFb(TOK), graph: (u) => { calls++; return { body: isAds(u) ? { data: [{ id: "a1", name: "Ad 1", effective_status: "ACTIVE" }] }
    : { data: [{ account_id: "111", name: "Acc A", account_status: 1, currency: "USD", timezone_name: "UTC" }, { account_id: "222", name: "Acc B", account_status: 2, currency: "USD", timezone_name: "UTC" }] } }; } });
  const fb = await adsPage(b);
  let pop = await popup(b, "accounts");
  ok("accounts loaded", await loadAccounts(pop, 2));
  ok("ads loaded", await openAds(pop) && (await pop.locator(".ad").count()) === 1);
  pop = await popup(b, "accounts");
  ok("reopen keeps rows, open row and ads", (await rowsAre(pop, ".acc", 2)) && (await rowsAre(pop, ".acc.open", 1)) && (await rowsAre(pop, ".ad", 1)));
  await fb.close(); pop = await popup(b, "accounts");
  ok("no FB tab: token gone", await boxWait(pop, GONE), await text(pop, "#tokenBox"));
  ok("no FB tab: cache stays", await rowsAre(pop, ".acc", 2));
  const c0 = calls; await clickToast(pop, "#loadAccounts");
  ok("refresh without a token sends nothing", calls === c0);
  await b.ctx.addCookies([{ name: "c_user", value: "2002", domain: ".facebook.com", path: "/", secure: true }]);
  pop = await popup(b, "accounts");
  ok("another FB user -> cache dropped", (await rowsAre(pop, ".acc", 0)) && (await until(pop, () => chrome.storage.session.get("accounts").then((o) => !o.accounts))));
  await b.ctx.close();
}

// ---------- dead session (190 / 459 / 460 / 463 / 467) ----------
async function sessionFlows() {
  console.log("\n# dead session");
  let tok = TOK;
  const dead = (code, sub) => ({ status: 400, body: { error: { code, error_subcode: sub, message: "Error validating access token: Session has expired" } } });
  for (const [code, sub] of [[190, 463], [190, 460], [190, 467], [190, 459], [190, undefined]]) {
    const b = await boot({ fb: adsFb(TOK), graph: () => dead(code, sub) });
    await adsPage(b);
    const pop = await popup(b, "accounts");
    const label = sub ? `${code}/${sub}` : String(code);
    const toast = await clickToast(pop, "#loadAccounts");
    ok(`${label}: one call goes out, the toast names the code`, b.hits.length === 1 && has(toast, label), `${b.hits.length} ${toast}`);
    await b.ctx.close();
  }
  const b = await boot({ fb: (u) => adsFb(tok)(u), graph: () => dead(190, 463) });
  const fb = await adsPage(b);
  let pop = await popup(b, "accounts");
  await clickToast(pop, "#loadAccounts");
  ok("dead flag persisted", (await stored(pop, "dead"))?.token === TOK);
  await resetLocks(pop);
  const again = await clickToast(pop, "#loadAccounts");
  ok("second click: no request, session message", b.hits.length === 1 && has(again, "no longer valid"), `${b.hits.length} ${again}`);
  pop = await popup(b, "token");
  ok("card says the session is closed", await until(pop, () => /190\/463/.test(document.querySelector("#kindCard").textContent)), await text(pop, "#kindCard"));
  await pop.click("#checkToken");
  ok("Check reports it and sends nothing", (await until(pop, () => /no longer valid/.test(document.querySelector("#tokenInfo").textContent))) && b.hits.length === 1, b.hits.join());
  pop = await popup(b, "accounts"); await resetLocks(pop);
  await clickToast(pop, "#loadAccounts");
  ok("popup reopen: still no request", b.hits.length === 1);
  b.graph = () => ({ body: accountsJson });
  tok = TOK2; await fb.reload();
  await pop.click('[data-tab="token"]'); await pop.click("#grabToken");
  ok("different token clears the dead flag", await until(pop, () => chrome.storage.session.get("dead").then((o) => !o.dead)));
  await pop.click('[data-tab="accounts"]');
  ok("new token works again", (await loadAccounts(pop, 1)) && b.hits.length === 2, `${b.hits.length}`);
  ok("no console errors", b.errs.length === 0, b.errs.join(" | "));
  await b.ctx.close();

  // a dead session must not replace an ads list you already have
  const b2 = await boot({ fb: adsFb(TOK), graph: (u) => isAds(u) ? { body: { data: [{ id: "a1", name: "Keep me", effective_status: "ACTIVE" }] } } : { body: accountsJson } });
  await adsPage(b2);
  pop = await popup(b2, "accounts");
  await loadAccounts(pop, 1); await openAds(pop);
  b2.graph = () => dead(190, 463); await resetLocks(pop);
  const toast = await clickToast(pop, ".acc.open .icon-btn[data-ads]");
  ok("failed ads refresh keeps the list", has(await text(pop, ".ads"), "Keep me"), await text(pop, ".ads"));
  ok("…and reports the code in a toast", has(toast, "190/463"), toast);
  await b2.ctx.close();
}

// ---------- ads: reasons, placements, issues_info, paging, failures ----------
async function adsFlows() {
  console.log("\n# ads");
  const base = { id: "a0", name: "Fine", effective_status: "ACTIVE", issues_info: [{ error_summary: "Soft note on a healthy ad", error_message: "ignore" }] };
  const rejected = { id: "a1", name: "Rejected", effective_status: "DISAPPROVED", ad_review_feedback: {
    global: { "Personal attributes": "Implies knowledge of personal traits" },
    placement_specific: { instagram: { "Misleading claims": "Unrealistic claims" } } } };
  const igOnly = { id: "a2", name: "IG only", effective_status: "DISAPPROVED", ad_review_feedback: { placement_specific: { instagram: { "Sensational content": "Shocking" } } } };
  const issues = { id: "a3", name: "Issues", effective_status: "WITH_ISSUES", issues_info: [{ error_summary: "Ad set has no budget", error_message: "Set a budget" }] };
  const open = async (b) => {
    await adsPage(b); const pop = await popup(b, "accounts");
    await loadAccounts(pop, 1); await openAds(pop);
    return pop;
  };

  let b = await boot({ fb: adsFb(TOK), graph: (u) => isAds(u) ? { body: { data: [base, rejected, igOnly, issues] } } : { body: accountsJson } });
  let pop = await open(b);
  const adHits = () => b.hits.filter((h) => h.includes("/ads?"));
  ok("issues_info is requested", has(adHits()[0], "issues_info"), adHits()[0]);
  const names = await pop.$$eval(".ad > span:first-child", (n) => n.map((x) => x.textContent));
  ok("problem ads come first", names.slice(0, 3).sort().join() === "IG only,Issues,Rejected" && names[3] === "Fine", names.join());
  const body = await text(pop, ".ads");
  ok("global reason shows its key AND description", has(body, "Personal attributes — Implies knowledge of personal traits"), body);
  ok("placement-specific reason shows the placement", has(body, "Instagram: Misleading claims — Unrealistic claims"), body);
  ok("rejection only on Instagram is explained (was empty)", has(body, "Instagram: Sensational content — Shocking"), body);
  ok("WITH_ISSUES reason comes from issues_info", has(body, "Ad set has no budget — Set a budget"), body);
  ok("issues_info of a healthy ad stays hidden", !has(body, "Soft note"), body);
  ok("summary counts the rejected", has(await text(pop, ".ads-sum"), "3 disapproved"), await text(pop, ".ads-sum"));
  await b.ctx.close();

  // more than one page: a second request pulls the problem ads that sit beyond the first 100
  const page1 = Array.from({ length: 100 }, (_, i) => ({ id: `p${i}`, name: `Ad ${i}`, effective_status: "ACTIVE" }));
  b = await boot({ fb: adsFb(TOK), graph: (u) => {
    if (!isAds(u)) return { body: accountsJson };
    if (u.searchParams.get("effective_status")) return { body: { data: [{ id: "late", name: "Late reject", effective_status: "DISAPPROVED", ad_review_feedback: { global: { Reason: "Beyond page one" } } }] } };
    return { body: { data: page1, paging: { next: "https://graph.facebook.com/next" } } };
  } });
  pop = await open(b);
  const filtered = b.hits.filter((h) => h.includes("effective_status="));
  ok("second request filters DISAPPROVED / WITH_ISSUES", filtered.length === 1 && has(decodeURIComponent(filtered[0]), '["DISAPPROVED","WITH_ISSUES"]'), filtered.join());
  ok("the late rejected ad is shown, first", (await text(pop, ".ad > span:first-child")) === "Late reject", await text(pop, ".ad > span:first-child"));
  ok("101 ads, 'more' hint present", has(await text(pop, ".ads-sum"), "101+") && has(await text(pop, ".ads"), "more exist"), await text(pop, ".ads-sum"));
  await b.ctx.close();

  // Graph refuses issues_info -> repeated once without it
  b = await boot({ fb: adsFb(TOK), graph: (u) => {
    if (!isAds(u)) return { body: accountsJson };
    if (u.searchParams.get("fields").includes("issues_info")) return { status: 400, body: { error: { code: 100, message: "(#100) Tried accessing nonexisting field (issues_info) on node type (Ad)" } } };
    return { body: { data: [base] } };
  } });
  pop = await open(b);
  const ah = b.hits.filter((h) => h.includes("/ads?"));
  ok("issues_info refused -> one retry without it", ah.length === 2 && !has(ah[1], "issues_info"), ah.join(" | "));
  ok("ads still shown", (await pop.locator(".ad").count()) === 1);
  await b.ctx.close();

  // a failed refresh keeps the list; error text is never persisted
  let fail = false;
  b = await boot({ fb: adsFb(TOK), graph: (u) => isAds(u) ? (fail ? { status: 500, body: { error: { code: 1, message: "boom" } } } : { body: { data: [base] } }) : { body: accountsJson } });
  pop = await open(b);
  fail = true; await resetLocks(pop);
  const toast = await clickToast(pop, ".acc.open .icon-btn[data-ads]");
  ok("failed refresh: list kept", (await pop.locator(".ad").count()) === 1);
  ok("failed refresh: error toast", has(toast, "boom"), toast);
  ok("failed refresh: the row says the list is old", has(await text(pop, ".ads"), "Not refreshed: boom"), await text(pop, ".ads"));
  ok("…and that mark is not persisted", !JSON.stringify(await stored(pop, "ads")).includes("stale"));
  ok("stored ads have no error text", !JSON.stringify(await stored(pop, "ads")).includes("boom"));
  await b.ctx.close();

  b = await boot({ fb: adsFb(TOK), graph: (u) => isAds(u) ? { status: 500, body: { error: { code: 1, message: "boom" } } } : { body: accountsJson } });
  pop = await open(b);
  ok("first load fails: error on the row", has(await text(pop, ".ads"), "boom"), await text(pop, ".ads"));
  ok("…and is not persisted", !JSON.stringify((await stored(pop, "ads")) || {}).includes("boom"));
  await b.ctx.close();
}

// ---------- token + cookies export: same account? ----------
async function exportFlows() {
  console.log("\n# token + cookies export");
  const run = async (name, tok, meReply, check) => {
    const b = await boot({ user: "1001", fb: adsFb(tok), graph: () => meReply });
    await adsPage(b);
    const pop = await popup(b, "token"); await captureClipboard(pop);
    const toast = await clickToast(pop, "#copyEnv");
    const out = await clip(pop);
    ok(name, check(out, toast, b.hits), `clip=${JSON.stringify(out).slice(0, 80)} toast=${toast} hits=${b.hits}`);
    await b.ctx.close();
  };
  await run("same account -> copied, one /me read", TOK, { body: { id: "1001" } },
    (c, t, h) => c.length === 1 && c[0].startsWith(TOK) && has(c[0], "c_user=1001") && has(t, "Token + cookies copied") && !has(t, "not verified") && h.length === 1);
  await run("token of another account -> NOT copied, both ids in the toast", TOK, { body: { id: "999" } },
    (c, t) => c.length === 0 && has(t, "999") && has(t, "1001"));
  await run("custom-app token (app-scoped /me.id) -> copied, marked unverified", TOK_W, { body: { id: "122190171494905792" } },
    (c, t) => c.length === 1 && has(t, "not verified"));
  await run("/me fails with an ordinary error -> copied, marked unverified", TOK, { status: 500, body: { error: { code: 2, message: "temporary" } } },
    (c, t) => c.length === 1 && has(t, "not verified"));
  await run("/me says the session is dead -> NOT copied", TOK, { status: 400, body: { error: { code: 190, error_subcode: 463, message: "expired" } } },
    (c, t) => c.length === 0 && has(t, "190/463"));

  // the answer is remembered for the token + login: the second export makes no request
  const b = await boot({ user: "1001", fb: adsFb(TOK), graph: () => ({ body: { id: "1001" } }) });
  await adsPage(b);
  const pop = await popup(b, "token"); await captureClipboard(pop);
  await clickToast(pop, "#copyEnv"); await clickToast(pop, "#copyEnv");
  ok("second export reuses the owner check", (await clip(pop)).length === 2 && b.hits.length === 1, `${b.hits.length} hits`);
  await b.ctx.close();
}

// dead token + a cached "owner ok": still not exported; "reset token" is the way to try the same token again
async function deadExportFlows() {
  console.log("\n# dead token: export and reset");
  let dead = false;
  const b = await boot({ fb: adsFb(TOK), graph: (u) => dead && u.pathname.endsWith("/adaccounts") ? { status: 400, body: { error: { code: 190, error_subcode: 463, message: "expired" } } }
    : u.pathname.endsWith("/me") ? { body: { id: "1001" } } : { body: accountsJson } });
  await adsPage(b);
  const pop = await popup(b, "token"); await captureClipboard(pop);
  await clickToast(pop, "#copyEnv");
  ok("first export is verified and copied", (await clip(pop)).length === 1);
  dead = true;
  await pop.click('[data-tab="accounts"]'); await clickToast(pop, "#loadAccounts");
  await pop.click('[data-tab="token"]');
  const t = await clickToast(pop, "#copyEnv");
  ok("token now dead: export refused although the owner check is cached", (await clip(pop)).length === 1 && has(t, "no longer valid"), `${(await clip(pop)).length} ${t}`);
  await pop.click("#clearSession");
  ok("reset removes the dead record (it holds the token)", await until(pop, () => chrome.storage.session.get("dead").then((o) => !o.dead)));
  dead = false; await resetLocks(pop);
  await pop.click("#grabToken"); await boxWait(pop, /^EAAB/);
  const before = b.hits.length;
  await pop.click('[data-tab="accounts"]'); const ok2 = await loadAccounts(pop, 1);
  ok("after reset the same token is tried again", ok2 && b.hits.length > before, `${b.hits.length} vs ${before}`);
  await b.ctx.close();
}

const only = process.argv[2];
const flows = { token: tokenFlows, fallback: fallbackFlows, version: versionFlows, cache: cacheFlows, session: sessionFlows, ads: adsFlows, export: exportFlows, deadexport: deadExportFlows };
try {
  for (const [name, fn] of Object.entries(flows)) if (!only || only === name) await fn();
} catch (e) { console.error("CRASH", e); fails++; }
console.log(`\n${total - fails}/${total} passed${fails ? `, ${fails} FAILED` : ""}`);
process.exit(fails ? 1 : 0);
