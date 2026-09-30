// Pure helpers: no DOM, no chrome.*. Split out of popup.js so test/pure.test.mjs can run them in plain Node.

// Graph says "this login / token is dead": code 190 (invalid / expired token; subcodes 458–467 say why — checkpoint,
// password changed, logged out…) or 102 (API session). Subcodes alone are not trusted: they only mean this under 190.
export function isSessionError(code) {
  const c = Number(code);
  return c === 190 || c === 102;
}
// "190/463" for messages.
export const sessionLabel = (code, subcode) => (subcode ? `${code}/${subcode}` : String(code));

// "v26.0" → 2600. 0 when it is not a version.
export const verNum = (v) => { const m = /^v(\d+)\.(\d+)$/.exec(v || ""); return m ? Number(m[1]) * 100 + Number(m[2]) : 0; };
// The newest version named anywhere in Graph's text. A warning may name the old version first
// ("v26.0 is deprecated, upgraded to v27.0"), so the first match is not enough.
// cap: ignore versions above it (verNum scale), so a stray "v999.0" in the text cannot hide the real "v27.0".
export function latestVersion(text, cap = Infinity) {
  let best = null;
  for (const [v] of String(text || "").matchAll(/\bv\d+\.\d+\b/g))
    if (verNum(v) <= cap && (!best || verNum(v) > verNum(best))) best = v;
  return best;
}

// ---------- spend ----------
// "All time" of an account. Meta's amount_spent lags behind (a new account can still say 0 while it spent today) and
// restarts when a spend cap is reset, so it can sit BELOW what the insights already show. The last 30 days (they end
// yesterday) plus today can never exceed the lifetime total, so the answer is the larger of the two.
// floor: today + the last 30 days as they were when the list was fetched (spendFloor); still a valid lower bound the
// next day, so the figure does not jump when the cached "today" goes stale. null/undefined = no insights were read.
export const spendFloor = (today, last30) => (Number(today) || 0) + (Number(last30) || 0);
export const lifetimeSpend = (amountSpent, floor) => Math.max(Number(amountSpent) || 0, Number(floor) || 0);

// One period of nested insights ({ data: [row] }, as a field alias returns it) -> numbers, for accounts and ads alike.
// Graph omits the key entirely when there was no delivery in the period (a real 0); a spend that is not a number
// is unknown (null). `spend` is in major units already.
export function insightRow(ins) {
  const r = ins?.data?.[0];
  if (!r) return { spend: 0, imp: 0, clicks: 0 };
  const spend = Number(r.spend);
  if (!Number.isFinite(spend)) return null;
  return { spend, imp: Number(r.impressions) || 0, clicks: Number(r.inline_link_clicks) || 0, from: r.date_start, to: r.date_stop };
}

// ---------- ads ----------
export const AD_PROBLEMS = ["DISAPPROVED", "WITH_ISSUES"];
// Problem ads first; the rest keep Graph's order (Array.sort is stable).
export const adRank = (status) => (AD_PROBLEMS.includes(status) ? 0 : 1);

const asText = (v) => (typeof v === "string" ? v : v === null || v === undefined ? "" : JSON.stringify(v));
const placeName = (s) => { const w = String(s).replace(/_/g, " "); return w.charAt(0).toUpperCase() + w.slice(1); };
// Why an ad is rejected, one line per reason. Sources (Meta docs, AdgroupReviewFeedback / AdgroupIssuesInfo):
//   ad_review_feedback.global              map<reason, description> — all placements
//   ad_review_feedback.placement_specific  { facebook: map, instagram: map, … } — one placement only
//   issues_info[]                          { error_summary, error_message } — the reason for WITH_ISSUES
//                                          (read only for problem ads: a healthy ad must not show red text)
export function reviewLines(ad) {
  const lines = [], seen = new Set();
  const add = (place, key, desc) => {
    const k = asText(key).trim(), d = asText(desc).trim();
    const body = d && d !== k ? (k ? `${k} — ${d}` : d) : k;
    if (!body) return;
    const line = place ? `${placeName(place)}: ${body}` : body;
    if (!seen.has(line)) { seen.add(line); lines.push(line); }
  };
  const walk = (place, v) => {
    if (Array.isArray(v)) for (const x of v) add(place, x, "");
    else if (v && typeof v === "object") for (const [k, d] of Object.entries(v)) add(place, k, d);
    else add(place, v, "");
  };
  const fb = ad?.ad_review_feedback;
  walk("", fb?.global);
  const ps = fb?.placement_specific;
  if (ps && typeof ps === "object" && !Array.isArray(ps)) for (const [place, v] of Object.entries(ps)) walk(place, v);
  if (AD_PROBLEMS.includes(ad?.effective_status))
    for (const i of Array.isArray(ad?.issues_info) ? ad.issues_info : []) add("", i?.error_summary, i?.error_message);
  return lines;
}

// ---------- token owner ----------
// Does the token belong to the logged-in FB user? meId = /me.id, cookieUser = c_user.
// "mismatch" only for first-party token prefixes: tokens of a custom app get an app-scoped /me.id that never
// equals c_user (EAAW), so for those the answer is "unknown", not "mismatch".
export function ownerVerdict(firstParty, meId, cookieUser) {
  if (!meId || !cookieUser) return "unknown";
  if (String(meId) === String(cookieUser)) return "ok";
  return firstParty ? "mismatch" : "unknown";
}
