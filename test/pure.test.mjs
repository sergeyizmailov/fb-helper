// Unit tests for fb-helper/js/pure.js — plain Node, no browser: `node --test test/*.test.mjs`
import test from "node:test";
import assert from "node:assert/strict";
import { isSessionError, sessionLabel, verNum, latestVersion, adRank, reviewLines, ownerVerdict, lifetimeSpend, spendFloor } from "../fb-helper/js/pure.js";

test("session errors: code 190 (any subcode) and 102; subcodes alone are not enough", () => {
  for (const c of [190, "190", 102]) assert.ok(isSessionError(c), String(c));
  for (const c of [1, 10, 100, 17, 2635, 459, 463, undefined, null]) assert.ok(!isSessionError(c), String(c));
  assert.equal(sessionLabel(190, 463), "190/463");
  assert.equal(sessionLabel(190), "190");
});

test("latestVersion: the newest named, not the first", () => {
  assert.equal(latestVersion("v26.0 is deprecated, the call was upgraded to v27.0"), "v27.0");
  assert.equal(latestVersion("upgraded to v28.0 as v27.0 has been deprecated"), "v28.0");
  assert.equal(latestVersion("update to the latest version: v27.0."), "v27.0");
  assert.equal(latestVersion("v9.0 and v26.1 and v26.0"), "v26.1");
  assert.equal(latestVersion("no version here"), null);
  assert.equal(latestVersion("stray v999.0 in user data; update to the latest version: v27.0", verNum("v26.0") + 500), "v27.0", "cap hides absurd versions");
  assert.equal(latestVersion("only v999.0", verNum("v26.0") + 500), null);
  assert.equal(latestVersion(null), null);
  assert.equal(latestVersion("dev12.3 or v1.2x"), null, "must be a whole word");
  assert.ok(verNum("v26.0") > verNum("v25.9"));
  assert.equal(verNum("garbage"), 0);
});

test("reviewLines: reasons with their keys, per placement, plus issues_info", () => {
  const ad = {
    ad_review_feedback: {
      global: { "Personal attributes": "Your ad implies knowledge of personal traits" },
      placement_specific: { instagram: { "Misleading claims": "The ad makes unrealistic claims" }, audience_network: { Sensational: "" } },
    },
    effective_status: "WITH_ISSUES",
    issues_info: [{ error_summary: "Ad set has no budget", error_message: "Set a budget to deliver" }],
  };
  assert.deepEqual(reviewLines(ad), [
    "Personal attributes — Your ad implies knowledge of personal traits",
    "Instagram: Misleading claims — The ad makes unrealistic claims",
    "Audience network: Sensational",
    "Ad set has no budget — Set a budget to deliver",
  ]);
});

test("reviewLines: a placement-only rejection is not empty (the old code returned '')", () => {
  const ad = { ad_review_feedback: { placement_specific: { instagram: { "Misleading claims": "…" } } } };
  assert.deepEqual(reviewLines(ad), ["Instagram: Misleading claims — …"]);
});

test("reviewLines: odd shapes never throw, duplicates collapse", () => {
  assert.deepEqual(reviewLines(undefined), []);
  assert.deepEqual(reviewLines({}), []);
  assert.deepEqual(reviewLines({ ad_review_feedback: null, issues_info: "x" }), []);
  assert.deepEqual(reviewLines({ ad_review_feedback: { global: ["A", "A", "B"], placement_specific: [1] } }), ["A", "B"]);
  assert.deepEqual(reviewLines({ ad_review_feedback: { global: { k: { nested: 1 } } } }), ['k — {"nested":1}']);
  assert.deepEqual(reviewLines({ effective_status: "WITH_ISSUES", issues_info: [null, {}, { error_summary: "S" }] }), ["S"]);
});

test("reviewLines: issues_info of a healthy ad is not shown (no red text on ACTIVE rows)", () => {
  const info = [{ error_summary: "Ad set has no budget", error_message: "Set a budget" }];
  for (const st of ["ACTIVE", "PAUSED", "PENDING_REVIEW", undefined]) assert.deepEqual(reviewLines({ effective_status: st, issues_info: info }), [], String(st));
  assert.equal(reviewLines({ effective_status: "DISAPPROVED", issues_info: info }).length, 1);
});

test("adRank puts disapproved / with-issues first and keeps the rest stable", () => {
  const ads = ["ACTIVE", "PAUSED", "DISAPPROVED", "PENDING_REVIEW", "WITH_ISSUES"].map((s, i) => ({ s, i }));
  const sorted = [...ads].sort((a, b) => adRank(a.s) - adRank(b.s)).map((a) => a.s);
  assert.deepEqual(sorted, ["DISAPPROVED", "WITH_ISSUES", "ACTIVE", "PAUSED", "PENDING_REVIEW"]);
});

test("ownerVerdict: mismatch only for first-party tokens", () => {
  assert.equal(ownerVerdict(true, "1001", "1001"), "ok");
  assert.equal(ownerVerdict(true, 1001, "1001"), "ok");
  assert.equal(ownerVerdict(true, "999", "1001"), "mismatch");
  assert.equal(ownerVerdict(false, "122190171494905792", "1001"), "unknown", "app-scoped id of a custom app");
  assert.equal(ownerVerdict(true, null, "1001"), "unknown");
  assert.equal(ownerVerdict(true, "1001", null), "unknown");
});

test("lifetimeSpend: amount_spent that lags is lifted to the proven floor, never lowered", () => {
  assert.equal(spendFloor(3, 0), 3);
  assert.equal(spendFloor(3, 20), 23);
  assert.equal(spendFloor(NaN, undefined), 0, "missing insights rows count as 0");
  assert.equal(lifetimeSpend(0, spendFloor(3, 0)), 3, "new account: Meta says 0, today already $3");
  assert.equal(lifetimeSpend(100, spendFloor(3, 20)), 100, "Meta's total is bigger: keep it");
  assert.equal(lifetimeSpend(5, spendFloor(3, 50)), 53, "total was reset below the last 30 days");
  assert.equal(lifetimeSpend(5, undefined), 5, "no insights read: Meta's number as is");
  assert.equal(lifetimeSpend(undefined, undefined), 0);
  assert.equal(lifetimeSpend("12.5", 1), 12.5);
});
