// ═══════════════════════════════════════════════════════════════════════════════
// limits.js — one meter and one sheet, for every limit in the app
//
// Kyle 2026-07-30: "each limit has its own words in its own corner, so the wall
// always feels like a surprise or a defect." Four rules came out of that:
//
//   1. One counter, always visible. A pill in the header says where you stand.
//   2. One sheet for every wall. The pill, a spent allowance, a plan cap and a
//      lapsed membership all open the SAME sheet.
//   3. Warn before the wall, never at it. The last free read turns the pill
//      amber.
//   4. A wall never breaks what you already have. Only a NEW read is refused.
//
// This file holds rule 1 and rule 3 — the sentence on the pill and the tone of
// it. components/LimitsSheet.jsx holds rule 2. The numbers all come from
// PLAN_CAPS in usage.js, so no cap is written twice.
// ═══════════════════════════════════════════════════════════════════════════════

import { PLAN_CAPS, usageAudience, usageTotal } from "./usage.js";

// The free taste a signed-out visitor gets. This MUST match ANON_FREE_TOTAL
// in preview/netlify/functions/lib/anon-allowance.js — the server is the real
// gate, and this number is only the promise the interface makes.
// preview/test/limits-meter.test.js compares the two and fails on drift.
export const ANON_FREE_CARDS = 5;

// The three permanent Free counters, in the order a person meets them. `noun` is what
// the pill and the sheet call one unit of the thing.
export const METERS = [
  { feature: "chartVision", noun: "chart read", plural: "chart reads" },
  { feature: "ask", noun: "ask", plural: "asks" },
  { feature: "resolve", noun: "card", plural: "cards" },
];

function countLeft(cap, feature, opts) {
  return Math.max(0, cap - usageTotal(feature, opts));
}

function words(left, noun, plural) {
  return left + " " + (left === 1 ? noun : plural);
}

// Where this visitor stands right now, in one object.
//
//   tone   "ok" | "warn" | "wall" — warn is the last free read, wall is spent.
//   label  the sentence on the pill.
//   left   reads remaining on the meter that runs out first.
//   cap    that meter's daily allowance.
//   kind   "anon" while signed out, "free" once signed in, "ended" after Pro
//          lapses to free with the grace period gone.
//
// There is no "ended" state on the server: an expired membership resolves to
// "free" (entitlements.js effectiveStatus). A grace date that has already
// passed is what tells the two apart — a person who never paid has none.
//
// Returns null when there is nothing to show: a Pro member has no meter, and
// neither does a device with accounts turned off.
export function proHasEnded(plan, now = Date.now()) {
  if (!plan || plan.state !== "free") return false;
  return typeof plan.graceUntil === "number" && plan.graceUntil > 0 && plan.graceUntil <= now;
}

export function limitStatus({ plan, signedIn = false, blocked = false, blockedFeature = "", host, now } = {}) {
  const state = plan && plan.state ? plan.state : null;
  if (state === "pro" || state === "grace" || state === "owner") return null;

  // Signed out. One meter only — the complete card — because a card is the
  // whole of what a visitor can do before sign-in.
  if (!signedIn) {
    const cap = ANON_FREE_CARDS;
    const left = blocked ? 0 : countLeft(cap, "resolve", { host, now, audience: "anon" });
    return {
      kind: "anon",
      feature: "resolve",
      noun: "card",
      cap,
      left,
      used: cap - left,
      tone: left === 0 ? "wall" : left === 1 ? "warn" : "ok",
      // Kyle's words. "Last free card" reads as a warning; "1 free card left"
      // reads as a number, and a number is easy to walk past.
      label: left === 0 ? "No free cards left" : left === 1 ? "Last free card" : left + " free cards left",
    };
  }

  // Signed in on the free plan. Three meters run at once, so the pill shows
  // the one that runs out first — that is the wall this person actually meets.
  const caps = PLAN_CAPS.free;
  let worst = null;
  for (const meter of METERS) {
    const cap = caps[meter.feature + "Total"];
    if (typeof cap !== "number" || cap <= 0) continue;
    const left =
      blockedFeature === meter.feature
        ? 0
        : countLeft(cap, meter.feature, { host, now, audience: usageAudience(plan, true) });
    if (!worst || left < worst.left) worst = { ...meter, cap, left };
  }
  if (!worst) return null;
  return {
    kind: proHasEnded(plan, now) ? "ended" : "free",
    feature: worst.feature,
    noun: worst.noun,
    cap: worst.cap,
    left: worst.left,
    used: worst.cap - worst.left,
    tone: worst.left === 0 ? "wall" : worst.left === 1 ? "warn" : "ok",
    label:
      worst.left === 0
        ? "No free " + worst.plural + " left"
        : words(worst.left, worst.noun, worst.plural) + " left",
  };
}

// The line under the sheet's title: where you are now, in whole numbers.
export function limitStandingLine(status) {
  if (!status) return "";
  if (status.kind === "anon") {
    return status.used + " of " + status.cap + " free cards used.";
  }
  return status.used + " of " + status.cap + " free " + (status.cap === 1 ? status.noun : status.noun + "s") + " used.";
}
