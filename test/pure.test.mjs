// Unit tests for js/pure.js — plain Node, no browser: `node --test test/*.test.mjs`
import test from "node:test";
import assert from "node:assert/strict";
import { isSessionError, sessionLabel, verNum, latestVersion, adRank, reviewLines, ownerVerdict } from "../js/pure.js";

test("session errors: 190 and subcodes 459/460/463/467", () => {
  for (const [c, s] of [[190, undefined], [190, 463], [190, 467], [1, 459], [1, 460], [459, undefined], [467, undefined]])
    assert.ok(isSessionError(c, s), `${c}/${s}`);
  for (const [c, s] of [[1, undefined], [10, undefined], [100, 33], [17, 2446079], [2635, undefined], [undefined, undefined]])
    assert.ok(!isSessionError(c, s), `${c}/${s}`);
  assert.equal(sessionLabel(190, 463), "190/463");
  assert.equal(sessionLabel(190), "190");
});

test("latestVersion: the newest named, not the first", () => {
  assert.equal(latestVersion("v26.0 is deprecated, the call was upgraded to v27.0"), "v27.0");
  assert.equal(latestVersion("upgraded to v28.0 as v27.0 has been deprecated"), "v28.0");
  assert.equal(latestVersion("update to the latest version: v27.0."), "v27.0");
  assert.equal(latestVersion("v9.0 and v26.1 and v26.0"), "v26.1");
  assert.equal(latestVersion("no version here"), null);
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
  assert.deepEqual(reviewLines({ issues_info: [null, {}, { error_summary: "S" }] }), ["S"]);
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
