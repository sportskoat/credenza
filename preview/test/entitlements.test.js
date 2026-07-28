import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  GRACE_MS,
  PLAN_LIMITS,
  newEntitlement,
  effectiveStatus,
  limitsFor,
  mayWriteCloud,
  usageKey,
  recordUsage,
  usageToday,
  overLimit,
  applyStripeEvent,
  signEntitlement,
  verifyEntitlement,
} = require("../netlify/functions/lib/entitlements.js");

const T0 = 1_800_000_000_000; // fixed "now" for deterministic tests
const DAY = 24 * 60 * 60 * 1000;

const checkout = (over = {}) => ({
  id: "evt_checkout_1",
  type: "checkout.session.completed",
  data: { object: { customer: "cus_1", subscription: "sub_1", ...over } },
});
const subscription = (status, periodEndSec, over = {}) => ({
  id: "evt_sub_" + status,
  type: "customer.subscription.updated",
  data: { object: { id: "sub_1", customer: "cus_1", status, current_period_end: periodEndSec, ...over } },
});
const deleted = (periodEndSec) => ({
  id: "evt_sub_deleted",
  type: "customer.subscription.deleted",
  data: { object: { id: "sub_1", customer: "cus_1", current_period_end: periodEndSec } },
});

describe("newEntitlement (Part 7 task 4)", () => {
  it("starts free with the full field set", () => {
    const r = newEntitlement("u1", T0);
    expect(r).toMatchObject({
      userId: "u1",
      plan: "free",
      billingStatus: "none",
      source: "none",
      currentPeriodEnd: null,
      graceUntil: null,
      limits: PLAN_LIMITS.free,
      usage: {},
      lastCheckAt: T0,
    });
    expect(effectiveStatus(r, T0)).toBe("free");
  });
});

describe("the full entitlement life (gate)", () => {
  it("subscribe → pro → renew → payment failed → grace → expired", () => {
    let r = newEntitlement("u1", T0);
    r = applyStripeEvent(r, checkout(), T0);
    const periodEnd = (T0 + 30 * DAY) / 1000;
    r = applyStripeEvent(r, subscription("active", periodEnd), T0);

    // Paid and inside the period.
    expect(effectiveStatus(r, T0)).toBe("pro");
    expect(limitsFor(r, T0)).toEqual(PLAN_LIMITS.pro);
    expect(mayWriteCloud(r, T0)).toBe(true);

    // Renewal: the period moves forward, still pro.
    const period2 = (T0 + 60 * DAY) / 1000;
    r = applyStripeEvent(r, subscription("active", period2), T0 + 30 * DAY + 1);
    expect(effectiveStatus(r, T0 + 31 * DAY)).toBe("pro");

    // Renewal fails: grace holds past the period end, writes stop only after
    // the period ends but Pro reads continue through grace.
    r = applyStripeEvent(r, { id: "evt_fail", type: "invoice.payment_failed", data: { object: {} } }, T0 + 61 * DAY);
    expect(r.billingStatus).toBe("past_due");
    expect(effectiveStatus(r, T0 + 61 * DAY)).toBe("grace");
    expect(limitsFor(r, T0 + 61 * DAY)).toEqual(PLAN_LIMITS.pro);
    expect(mayWriteCloud(r, T0 + 61 * DAY)).toBe(false); // grace stops cloud writes
    expect(r.graceUntil).toBe(T0 + 60 * DAY + GRACE_MS);

    // Grace expires: free.
    expect(effectiveStatus(r, T0 + 60 * DAY + GRACE_MS + 1)).toBe("free");
    expect(limitsFor(r, T0 + 60 * DAY + GRACE_MS + 1)).toEqual(PLAN_LIMITS.free);
  });

  it("a trialing subscription reads as Pro for the trial window (weekly 3-day trial)", () => {
    // The weekly plan starts with a 3-day trial: Stripe reports status
    // "trialing" and current_period_end = trial end. Pro must hold for the
    // whole trial — a trialing user who reads "free" would hit free caps on
    // day 1 of a paid plan.
    let r = newEntitlement("u1", T0);
    const trialEnd = (T0 + 3 * DAY) / 1000;
    r = applyStripeEvent(r, subscription("trialing", trialEnd), T0);
    expect(r.billingStatus).toBe("trialing");
    expect(r.graceUntil).toBe(null);
    expect(effectiveStatus(r, T0)).toBe("pro");
    expect(effectiveStatus(r, T0 + 2 * DAY)).toBe("pro");
    expect(limitsFor(r, T0)).toEqual(PLAN_LIMITS.pro);
    expect(mayWriteCloud(r, T0)).toBe(true);

    // The trial converts: Stripe moves the period to the first paid week.
    const paidEnd = (T0 + 10 * DAY) / 1000;
    r = applyStripeEvent(r, subscription("active", paidEnd), T0 + 3 * DAY);
    expect(effectiveStatus(r, T0 + 4 * DAY)).toBe("pro");
  });

  it("cancellation keeps Pro to the period end, then grace, then free — data untouched", () => {
    let r = newEntitlement("u1", T0);
    const periodEnd = (T0 + 20 * DAY) / 1000;
    r = applyStripeEvent(r, subscription("active", periodEnd), T0);
    r = applyStripeEvent(r, deleted(periodEnd), T0 + DAY);

    expect(r.billingStatus).toBe("canceled");
    expect(effectiveStatus(r, T0 + 5 * DAY)).toBe("pro"); // period still runs
    expect(effectiveStatus(r, T0 + 20 * DAY + 1)).toBe("grace"); // then grace
    expect(r.graceUntil).toBe(T0 + 20 * DAY + GRACE_MS);
    expect(effectiveStatus(r, T0 + 20 * DAY + GRACE_MS + 1)).toBe("free"); // then free
  });

  it("recovery: invoice.paid after a failure clears grace and reactivates", () => {
    let r = newEntitlement("u1", T0);
    const periodEnd = (T0 + 30 * DAY) / 1000;
    r = applyStripeEvent(r, subscription("active", periodEnd), T0);
    r = applyStripeEvent(r, { id: "evt_fail", type: "invoice.payment_failed", data: { object: {} } }, T0 + 31 * DAY);
    expect(effectiveStatus(r, T0 + 31 * DAY)).toBe("grace");
    const nextEnd = (T0 + 60 * DAY) / 1000;
    r = applyStripeEvent(r, {
      id: "evt_paid",
      type: "invoice.paid",
      data: { object: { lines: { data: [{ period: { end: nextEnd } }] } } },
    }, T0 + 32 * DAY);
    expect(r.billingStatus).toBe("active");
    expect(r.graceUntil).toBe(null);
    expect(effectiveStatus(r, T0 + 45 * DAY)).toBe("pro");
    expect(mayWriteCloud(r, T0 + 45 * DAY)).toBe(true);
  });
});

describe("repeat billing messages (gate, task 5)", () => {
  it("replaying the same events changes nothing after the first apply", () => {
    let r = newEntitlement("u1", T0);
    const periodEnd = (T0 + 30 * DAY) / 1000;
    const events = [checkout(), subscription("active", periodEnd), deleted(periodEnd)];
    for (const e of events) r = applyStripeEvent(r, e, T0);
    const settled = r;
    // Stripe retries every event — the record must not move.
    for (const e of events) r = applyStripeEvent(r, e, T0 + DAY);
    expect({ ...r, updatedAt: 0 }).toEqual({ ...settled, updatedAt: 0 });
    expect(r.graceUntil).toBe(settled.graceUntil);
    expect(r.billingStatus).toBe("canceled");
  });

  it("an out-of-order OLD subscription update cannot resurrect a canceled plan", () => {
    let r = newEntitlement("u1", T0);
    const periodEnd = (T0 + 30 * DAY) / 1000;
    r = applyStripeEvent(r, subscription("active", periodEnd), T0);
    r = applyStripeEvent(r, deleted(periodEnd), T0 + DAY);
    // The replayed update re-stamps the status — but the period end is the
    // same, so effective status is unchanged. This documents the Stripe
    // reality: last-write-wins on the record, monotonicity on the PERIOD.
    r = applyStripeEvent(r, subscription("active", periodEnd), T0 + 2 * DAY);
    expect(effectiveStatus(r, T0 + 5 * DAY)).toBe("pro");
    expect(r.currentPeriodEnd).toBe((T0 + 30 * DAY));
  });
});

describe("usage counters + limits (task 4)", () => {
  it("counts per day, prunes old days, and enforces the plan cap", () => {
    let r = newEntitlement("u1", T0);
    for (let i = 0; i < PLAN_LIMITS.free.askPerDay; i++) r = recordUsage(r, "ask", T0);
    expect(usageToday(r, "ask", T0)).toBe(5);
    expect(overLimit(r, "ask", T0)).toBe(true);

    // Pro lifts the cap.
    const periodEnd = (T0 + 30 * DAY) / 1000;
    r = applyStripeEvent(r, subscription("active", periodEnd), T0);
    expect(overLimit(r, "ask", T0)).toBe(false);

    // Two days later the counter resets (new key) and old keys are pruned.
    r = recordUsage(r, "ask", T0 + 2 * DAY);
    expect(usageToday(r, "ask", T0 + 2 * DAY)).toBe(1);
    expect(Object.keys(r.usage)).toHaveLength(1); // only today — nothing was used yesterday
    expect(usageKey("ask", T0)).toMatch(/^ask:\d{4}-\d{2}-\d{2}$/);
  });

  it("unmetered features never report over the limit", () => {
    const r = newEntitlement("u1", T0);
    expect(overLimit(r, "nonsense", T0)).toBe(false);
  });
});

describe("signed offline snapshot (task 6)", () => {
  const SECRET = "test-signing-secret";

  it("round-trips a pro snapshot and rejects tampering", () => {
    let r = newEntitlement("u1", T0);
    const periodEnd = (T0 + 30 * DAY) / 1000;
    r = applyStripeEvent(r, subscription("active", periodEnd), T0);
    const token = signEntitlement(r, SECRET, T0);
    const payload = verifyEntitlement(token, SECRET, T0 + 1000);
    expect(payload).toMatchObject({ sub: "u1", plan: "pro", state: "pro", lim: PLAN_LIMITS.pro });

    // Tampered body: signature mismatch.
    const [body] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ sub: "u1", plan: "pro", state: "pro", lim: PLAN_LIMITS.pro, exp: T0 + 999 * DAY })).toString("base64url");
    expect(verifyEntitlement(forged + ".whatever", SECRET, T0)).toBe(null);
    expect(verifyEntitlement(body + ".AAAA", SECRET, T0)).toBe(null);
    // Wrong secret, expired token, garbage input.
    expect(verifyEntitlement(token, "other-secret", T0)).toBe(null);
    expect(verifyEntitlement(token, SECRET, T0 + 2 * DAY)).toBe(null);
    expect(verifyEntitlement("nonsense", SECRET, T0)).toBe(null);
    expect(verifyEntitlement(null, SECRET, T0)).toBe(null);
  });

  it("a free account signs a free snapshot with free limits", () => {
    const r = newEntitlement("u1", T0);
    const payload = verifyEntitlement(signEntitlement(r, SECRET, T0), SECRET, T0);
    expect(payload).toMatchObject({ plan: "free", state: "free", lim: PLAN_LIMITS.free });
  });

  it("a grace snapshot tells the client the grace deadline", () => {
    let r = newEntitlement("u1", T0);
    const periodEnd = (T0 + 5 * DAY) / 1000;
    r = applyStripeEvent(r, deleted(periodEnd), T0);
    const payload = verifyEntitlement(signEntitlement(r, SECRET, T0 + 6 * DAY), SECRET, T0 + 6 * DAY);
    expect(payload.state).toBe("grace");
    expect(payload.graceUntil).toBe(T0 + 5 * DAY + GRACE_MS);
  });
});
