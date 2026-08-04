// ═══════════════════════════════════════════════════════════════════════════════
// entitlements.js — the server entitlement record (Execution-Plan Part 7)
//
// One record per user answers "may this account use a paid feature right now?"
// The record is storage-agnostic: these functions take and return plain
// objects; the caller (stripe-webhook, entitlement functions) persists them
// (Supabase table `entitlements`, service role only).
//
// Rules encoded here, all from the plan:
//   - The record holds plan, billing status, source, expiry, grace, limits,
//     usage, and the last check time (task 4).
//   - Billing messages apply one time each, even after a repeat (task 5) —
//     the caller stores processed event ids; applyStripeEvent is pure and
//     replay-safe because it only moves the record FORWARD.
//   - Expiry gets a short grace period (task 7). Local data survives a
//     cancellation — the record never deletes user data; it only downgrades.
//   - A signed snapshot lets the client work offline (task 6). The client
//     trusts the snapshot until it expires; the server re-checks every paid
//     request against the real record. A tampered snapshot cannot pass the
//     server — the signature never leaves it.
// ═══════════════════════════════════════════════════════════════════════════════

const { createHmac, timingSafeEqual } = require("node:crypto");

const GRACE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days past the period end

// Limits per plan (task 4). Part 8 wires the features to these numbers; the
// shape is stable now so the record and the client cache agree from day one.
const PLAN_LIMITS = {
  free: {
    askTotal: 8,
    chartVisionTotal: 8,
    resolveTotal: 8,
    qcPhotosPerItem: 4,
    haulsMax: 2,
  },
  // Pro usage refreshes each calendar month regardless of billing cadence.
  // These caps leave room against the observed blended model cost. Keep
  // measuring by route before raising them again.
  pro: {
    askPerMonth: 50,
    chartVisionPerMonth: 50,
    resolvePerMonth: 250,
    qcPhotosPerItem: 12,
    haulsMax: 100,
  },
  owner: {
    askPerMonth: null,
    chartVisionPerMonth: null,
    resolvePerMonth: null,
    qcPhotosPerItem: 12,
    haulsMax: 100,
  },
};

function splitList(value) {
  return String(value || "")
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
}

// Owner access is configured at deploy time and never inferred from billing.
// Email and user-id lists are both supported so a future email change cannot
// accidentally remove the creator's access.
function isOwnerClaims(claims, env = process.env) {
  if (!claims) return false;
  const emails = splitList(env.CREDENZA_OWNER_EMAILS);
  const ids = splitList(env.CREDENZA_OWNER_USER_IDS);
  return emails.includes(String(claims.email || "").trim().toLowerCase()) || ids.includes(String(claims.sub || "").toLowerCase());
}

function withOwner(record, owner) {
  return owner ? { ...record, owner: true } : record;
}

// ————— The record ————————————————————————————————————————————————————————————

function newEntitlement(userId, now = Date.now()) {
  return {
    userId,
    plan: "free",
    // billingStatus mirrors Stripe, lowercase: active | trialing | past_due |
    // canceled | unpaid | none. effectiveStatus() derives what the user FEELS.
    billingStatus: "none",
    source: "none", // stripe | manual | none
    currentPeriodEnd: null,
    graceUntil: null,
    limits: PLAN_LIMITS.free,
    usage: {}, // permanent Free counters and one counter set per calendar month
    lastCheckAt: now,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    updatedAt: now,
  };
}

// What the account may use RIGHT NOW (task 7):
//   pro    — paid and inside the period
//   grace  — period ended (failed renewal or cancellation) but grace holds
//   free   — never paid, or past grace
// Grace and pro both unlock Pro limits; free does not. Cloud writes stop when
// the state leaves grace — the caller enforces that per route.
function effectiveStatus(record, now = Date.now()) {
  if (!record) return "free";
  if (record.owner === true) return "owner";
  const paying =
    record.billingStatus === "active" ||
    record.billingStatus === "trialing" ||
    record.billingStatus === "past_due" ||
    // Canceled with time left on the paid period: Pro holds to the period
    // end (task 7), then the grace clock (set at cancellation) takes over.
    record.billingStatus === "canceled";
  const end = record.currentPeriodEnd || 0;
  if (paying && end > now) return "pro";
  if ((record.graceUntil || 0) > now) return "grace";
  return "free";
}

function limitsFor(record, now = Date.now()) {
  const state = effectiveStatus(record, now);
  if (state === "owner") return PLAN_LIMITS.owner;
  return state === "free" ? PLAN_LIMITS.free : PLAN_LIMITS.pro;
}

// May this account make a paid cloud WRITE right now? Grace reads Pro but
// stops new cloud writes (task 7).
function mayWriteCloud(record, now = Date.now()) {
  const state = effectiveStatus(record, now);
  return state === "pro" || state === "owner";
}

// ————— Usage counters ————————————————————————————————————————————————————————

function usageKey(record, feature, now = Date.now()) {
  const state = effectiveStatus(record, now);
  if (state === "free") return "free-v2:" + feature;
  const month = new Date(now).toISOString().slice(0, 7);
  return "month:" + month + ":" + feature;
}

// Increment the permanent Free counter or current calendar-month counter.
// Returns a NEW record (the caller persists it).
function recordUsage(record, feature, now = Date.now()) {
  if (effectiveStatus(record, now) === "owner") return { ...record, lastCheckAt: now };
  const key = usageKey(record, feature, now);
  const usage = { ...(record.usage || {}) };
  usage[key] = (usage[key] || 0) + 1;
  return { ...record, usage, lastCheckAt: now };
}

function usageToday(record, feature, now = Date.now()) {
  return (record.usage || {})[usageKey(record, feature, now)] || 0;
}

function overLimit(record, feature, now = Date.now()) {
  const limits = limitsFor(record, now);
  const state = effectiveStatus(record, now);
  if (state === "owner") return false;
  const cap = limits[feature + (state === "free" ? "Total" : "PerMonth")];
  if (cap == null) return false; // unmetered feature
  return usageToday(record, feature, now) >= cap;
}

// ————— Stripe events (tasks 3, 5, 7) ————————————————————————————————————————
// applyStripeEvent is PURE and moves the record forward only — a replayed
// event lands on a record already at-or-past that state and changes nothing
// (task 5). The caller tracks processed event ids for the "one time each"
// guarantee and skips known ids before calling this.

// Stripe sends unix SECONDS; the record keeps ms.
const sec = (v) => (typeof v === "number" && v > 0 ? v * 1000 : null);

function applyStripeEvent(record, event, now = Date.now()) {
  if (!event || !event.type) return record;
  const obj = (event.data && event.data.object) || {};

  switch (event.type) {
    case "checkout.session.completed": {
      // First contact: link the customer. The subscription event that follows
      // sets the period. Idempotent — re-linking the same ids is a no-op.
      return {
        ...record,
        source: "stripe",
        stripeCustomerId: obj.customer || record.stripeCustomerId,
        stripeSubscriptionId: obj.subscription || record.stripeSubscriptionId,
        updatedAt: now,
      };
    }

    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const periodEnd = sec(obj.current_period_end);
      const status = String(obj.status || record.billingStatus).toLowerCase();
      const wasFree = effectiveStatus(record, now) === "free";
      const next = {
        ...record,
        plan: "pro",
        billingStatus: status,
        source: "stripe",
        stripeCustomerId: obj.customer || record.stripeCustomerId,
        stripeSubscriptionId: obj.id || record.stripeSubscriptionId,
        currentPeriodEnd: periodEnd || record.currentPeriodEnd,
        updatedAt: now,
      };
      // A renewal (or a first subscription) clears any old grace — the account
      // is paid up. Grace is only set by failure/cancel paths below.
      if (status === "active" || status === "trialing") next.graceUntil = null;
      // past_due inside the period keeps Pro via effectiveStatus; past the
      // period end it falls to grace, then free.
      if (status === "past_due" && wasFree) next.graceUntil = null;
      return next;
    }

    case "customer.subscription.deleted": {
      // Cancellation (task 7): the account keeps Pro until the paid period
      // ends, then grace, then free. Local data is untouched — this record is
      // the ONLY thing that downgrades.
      const end = sec(obj.current_period_end) || record.currentPeriodEnd;
      return {
        ...record,
        billingStatus: "canceled",
        currentPeriodEnd: end,
        graceUntil: end ? end + GRACE_MS : now + GRACE_MS,
        updatedAt: now,
      };
    }

    case "invoice.payment_failed": {
      // Failed renewal: grace runs from the PERIOD END (the user paid to that
      // point), even when the event arrives late — late delivery must not
      // extend grace.
      const end = record.currentPeriodEnd;
      return {
        ...record,
        billingStatus: "past_due",
        graceUntil: (end ? end : now) + GRACE_MS,
        updatedAt: now,
      };
    }

    case "invoice.paid": {
      // Recovery from past_due: paid again, grace clears, period extends.
      const periodEnd = sec(obj.lines && obj.lines.data && obj.lines.data[0] && obj.lines.data[0].period && obj.lines.data[0].period.end);
      return {
        ...record,
        billingStatus: "active",
        currentPeriodEnd: periodEnd || record.currentPeriodEnd,
        graceUntil: null,
        updatedAt: now,
      };
    }

    default:
      return record; // unhandled events change nothing
  }
}

// ————— Signed offline snapshot (task 6) —————————————————————————————————————
// payload: { sub: userId, plan, state, lim, exp, graceUntil }
// Compact JSON, base64url, HMAC-SHA256. The client decodes without verifying
// (offline use); the server verifies before trusting anything.

const b64u = (buf) => Buffer.from(buf).toString("base64url");

function signEntitlement(record, secret, now = Date.now(), ttlMs = 24 * 60 * 60 * 1000) {
  const state = effectiveStatus(record, now);
  const payload = {
    sub: record.userId,
    plan: state === "free" ? "free" : state === "owner" ? "owner" : "pro",
    state,
    lim: limitsFor(record, now),
    exp: now + ttlMs,
    graceUntil: record.graceUntil || null,
  };
  const body = b64u(JSON.stringify(payload));
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return body + "." + sig;
}

// Returns the decoded payload when the signature is valid and the token is
// unexpired; null otherwise. Never throws.
function verifyEntitlement(token, secret, now = Date.now()) {
  if (!token || typeof token !== "string") return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const want = createHmac("sha256", secret).update(body).digest();
  let got;
  try {
    got = Buffer.from(sig, "base64url");
  } catch {
    return null;
  }
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!payload || typeof payload.exp !== "number" || payload.exp <= now) return null;
    return payload;
  } catch {
    return null;
  }
}

module.exports = {
  GRACE_MS,
  PLAN_LIMITS,
  isOwnerClaims,
  withOwner,
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
};
