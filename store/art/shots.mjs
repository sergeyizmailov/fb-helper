// Store artwork, rendered from the STORE build (name "Ads Helper", neutral logo) with fictional data:
// popup captures -> raw/*.png, then the composed images in ./out (store screenshot 1280x800, small tile 440x280,
// cover 2100x1182, social preview 1280x640). Nothing leaves the machine: Facebook and Graph are route() mocks.
// Run:  store/build.sh && node store/art/shots.mjs
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EXT = path.resolve(HERE, "../../release/chrome-web-store");
const require = createRequire(import.meta.url);
const { chromium } = [process.env.PLAYWRIGHT_CORE, "playwright-core", "/opt/homebrew/lib/node_modules/@playwright/cli/node_modules/playwright-core"]
  .filter(Boolean).reduce((found, p) => found || (() => { try { return require(p); } catch { return null; } })(), null) || {};
if (!chromium) throw new Error("playwright-core not found");
fs.mkdirSync(path.join(HERE, "raw"), { recursive: true });
fs.mkdirSync(path.join(HERE, "out"), { recursive: true });

// ---------- fictional data ----------
const TOKEN = "EAAB" + "A5RNthUuuhqnyPXrrDqd5yHf5qnj44XUzUJSaS6itQwK3mVbLpYc8ZdT1eRxG2oHsJfNaWvBu9".slice(0, 70);
const USER = "100087452196634";
const PERMS = ["ads_management", "ads_read", "business_management", "catalog_management", "pages_manage_ads", "pages_manage_engagement",
  "pages_manage_metadata", "pages_manage_posts", "pages_read_engagement", "pages_read_user_content", "pages_show_list", "read_insights",
  "instagram_basic", "instagram_manage_comments", "instagram_manage_insights", "leads_retrieval", "public_profile", "email"];
const ins = (spend, clicks) => ({ data: [{ spend: String(spend), impressions: String(clicks * 38), inline_link_clicks: String(clicks) }] });
const acc = (o) => ({ account_id: o.id, name: o.name, account_status: o.status ?? 1, disable_reason: o.reason ?? 0, currency: o.cur,
  timezone_name: o.tz, amount_spent: String(Math.round(o.all * 100)), balance: "0", created_time: "2025-03-11T10:00:00+0000",
  business: { id: "9100" + o.id.slice(-6), name: o.biz }, business_country_code: o.cc,
  funding_source_details: { display_string: o.card }, adtrust_dsl: o.dsl, adspaymentcycle: { data: [{ threshold_amount: String(o.th * 100) }] },
  adspixels: { data: [{ id: "77" + o.id.slice(-8), name: o.biz + " Pixel" }] },
  p_today: ins(o.d0, o.c0), p_yesterday: ins(o.d1, o.c1), p_week: ins(o.d7, o.c7), p_month: ins(o.d30, o.c30) });
const ACCOUNTS = [
  acc({ id: "1187340965221094", name: "Nova · US Main", biz: "Nova Media", cur: "USD", tz: "America/New_York", cc: "US", card: "Visa *4242", dsl: 2500, th: 500, all: 31480.2, d0: 412.6, c0: 812, d1: 806.4, c1: 1604, d7: 5420.3, c7: 10730, d30: 12840.52, c30: 23870 }),
  acc({ id: "2210457893316620", name: "Nova · EU Scale", biz: "Nova Media", cur: "EUR", tz: "Europe/Berlin", cc: "DE", card: "Mastercard *8210", dsl: 1500, th: 300, all: 9204.7, d0: 148.2, c0: 262, d1: 390.7, c1: 741, d7: 2610.4, c7: 4990, d30: 4630.15, c30: 8710 }),
  acc({ id: "1509826643170382", name: "Lumen · Leadgen", biz: "Lumen Traffic", cur: "USD", tz: "Asia/Bangkok", cc: "TH", card: "Visa *1881", dsl: 1000, th: 250, all: 6120.4, d0: 96.1, c0: 190, d1: 240.9, c1: 470, d7: 1490.8, c7: 3020, d30: 1985.44, c30: 4310 }),
  acc({ id: "3390118227450811", name: "Atlas · Retail", biz: "Atlas Group", status: 3, cur: "USD", tz: "America/Chicago", cc: "US", card: "Visa *0093", dsl: 800, th: 200, all: 2240, d0: 0, c0: 0, d1: 0, c1: 0, d7: 0, c7: 0, d30: 214.7, c30: 380 }),
  acc({ id: "4402871960135522", name: "Old · Test", biz: "Nova Media", status: 2, reason: 1, cur: "USD", tz: "UTC", cc: "US", card: "—", dsl: 500, th: 100, all: 880.6, d0: 0, c0: 0, d1: 0, c1: 0, d7: 0, c7: 0, d30: 0, c30: 0 }),
];
const ADS = [
  { id: "a1", name: "Spring sale · video 1", effective_status: "ACTIVE" },
  { id: "a2", name: "Spring sale · carousel", effective_status: "ACTIVE" },
  { id: "a3", name: "Lookalike 1% · static", effective_status: "DISAPPROVED", ad_review_feedback: {
    global: { "Personal attributes": "Ad implies knowledge of personal traits" },
    placement_specific: { instagram: { "Misleading claims": "Ad makes unrealistic claims" } } } },
  { id: "a4", name: "Retarget 7d · story", effective_status: "PENDING_REVIEW" },
  { id: "a5", name: "Brand · reel", effective_status: "PAUSED" },
];

// ---------- browser ----------
const ctx = await chromium.launchPersistentContext("", { channel: "chromium", headless: true, deviceScaleFactor: 2,
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`] });
const jar = { c_user: USER, xs: "47%3AuQ7ZkWnE2mB4xg%3A2%3A1759012345%3A-1%3A-1", datr: "z44q7Bvls3CIEGFAl6LIMPpc",
  fr: "19apwYZDOy8J5fHNl.KEQoid9EZTAAZFO5wvb17xpj.BmZVZeejs..AAA.0.0.BmZpnt209.AWUbe78WEV", sb: "Vh7yZ2nQ8c1KpTzLm4XeRuBd" };
await ctx.addCookies(Object.entries(jar).map(([name, value]) => ({ name, value, domain: ".facebook.com", path: "/", secure: true })));
await ctx.route("https://*.facebook.com/**", (r) => r.fulfill({ contentType: "text/html",
  body: r.request().url().includes("adsmanager") ? `<script>window.__accessToken=${JSON.stringify(TOKEN)}</script>Ads Manager` : "<p>feed</p>" }));
await ctx.route("https://graph.facebook.com/**", (r) => {
  const u = new URL(r.request().url()), p = u.pathname.replace(/^\/v[\d.]+\//, "/");
  const body = p === "/me" ? { id: USER, name: "Alex Carter" }
    : p === "/app" ? { id: "119211728144504", name: "Facebook Ads Manager" }
    : p === "/me/permissions" ? { data: PERMS.map((permission) => ({ permission, status: "granted" })) }
    : p === "/me/adaccounts" ? { data: ACCOUNTS }
    : /\/act_\d+\/ads$/.test(p) ? { data: ADS } : { data: [] };
  r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(body) });
});
const boot = await ctx.newPage(); await boot.goto("chrome://extensions");
const id = await boot.evaluate(() => document.querySelector("extensions-manager").shadowRoot.querySelector("extensions-item-list").shadowRoot.querySelector("extensions-item").id);
await boot.close();
const ads = await ctx.newPage(); await ads.goto("https://adsmanager.facebook.com/adsmanager/manage/campaigns");

const pop = await ctx.newPage();
await pop.setViewportSize({ width: 540, height: 600 });
await pop.goto(`chrome-extension://${id}/popup.html`);
await pop.evaluate(() => { chrome.storage.local.set({ lang: "en" }); localStorage.setItem("period", "month"); });
await pop.reload();
await pop.waitForFunction(() => /^EAA/.test(document.querySelector("#tokenBox").textContent.trim()), null, { timeout: 8000 });
const settle = (ms = 500) => pop.waitForTimeout(ms);
const shot = async (name, clip) => {
  await pop.evaluate(() => document.activeElement?.blur());
  const h = await pop.evaluate(() => Math.min(600, document.body.scrollHeight));
  await pop.screenshot({ path: path.join(HERE, "raw", name + ".png"), clip: { x: 0, y: 0, width: 540, height: clip || h } });
};

// 1 token + check
await pop.click("#checkToken"); await pop.waitForFunction(() => document.querySelectorAll("#tokenInfo dd").length >= 3 && !/…/.test(document.querySelector("#tokenInfo").textContent));
await settle(); await shot("check");
// 2 cookies
await pop.click('[data-tab="cookies"]'); await pop.waitForFunction(() => document.querySelector("#cookieBox").classList.contains("filled")); await settle(); await shot("cookies");
// 3 accounts
await pop.click('[data-tab="accounts"]'); await pop.waitForFunction(() => document.querySelectorAll(".acc").length === 5, null, { timeout: 15000 }).catch(async () => {
  await pop.click("#loadAccounts"); await pop.waitForFunction(() => document.querySelectorAll(".acc").length === 5, null, { timeout: 15000 }); });
await settle(700); await shot("accounts");
// cover variant: only the first three rows, cut right under the third (the header still says "5 ad accounts")
{
  const h = await pop.evaluate(() => { const r = [...document.querySelectorAll(".acc")]; r.slice(3).forEach((x) => { x.style.display = "none"; });
    return Math.ceil(r[2].getBoundingClientRect().bottom + 12); });
  await shot("accounts-cover", h);
  await pop.evaluate(() => document.querySelectorAll(".acc").forEach((x) => { x.style.display = ""; }));
}
await ctx.close();

// ---------- compose ----------
const b = await chromium.launch({ channel: "chromium", headless: true });
const render = async (html, out, w, h, scale = 1, type = "png") => {
  const pg = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: scale });
  await pg.goto(pathToFileURL(path.join(HERE, html.split("#")[0])).href + (html.includes("#") ? "#" + html.split("#")[1] : ""));
  await pg.evaluate(() => document.fonts.ready); await pg.waitForTimeout(500);
  await pg.screenshot({ path: path.join(HERE, "out", out), type, ...(type === "jpeg" ? { quality: 92 } : {}) });
  await pg.close();
};
await render("cover.html", "cover.png", 1400, 788, 1.5);
await render("social.html", "social-preview.png", 1280, 640, 1);
await render("tile.html", "promo-tile-440x280.png", 440, 280, 1);
await render("cover-1280x800.html", "store-screenshot-1280x800.png", 1280, 800, 1);
await b.close();
console.log("done ->", path.join(HERE, "out"));
