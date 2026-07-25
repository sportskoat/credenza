// ═══════════════════════════════════════════════════════════════════════════════
// paid-gate.js — who may call a paid function (Execution-Plan Part 7f)
//
// Every paid function (ask, resolve, chart-vision) authorizes through here.
// Two paths:
//   1. ACCOUNT: `Authorization: Bearer <supabase token>`. The token is
//      verified, the entitlement record is loaded (created on first use), and
//      the per-plan daily cap is enforced against REAL server usage. After a
//      successful call the caller invokes recordPaidUsage to count it.
//   2. SHARED KEY: `x-credenza-key` header (the anonymous free-beta path).
//      This path dies when REQUIRE_ACCOUNTS=true — set it once accounts are
//      verified in production (Part 7g), then VITE_CREDENZA_SEARCH_SECRET can
//      come out of the client bundle.
//
// A Bearer token that fails verification is a 401 — never a silent downgrade
// to the shared-key path (a forged request must not get anonymous access).
// ═══════════════════════════════════════════════════════════════════════════════

const auth = require("./auth.js");
const ent = require("./entitlements.js");
const { storeFromEnv } = require("./entitlement-store.js");

// Seconds until the UTC day rolls over — the Retry-After for a daily cap.
function secondsToUtcMidnight(now = Date.now()) {
  const d = new Date(now);
  d.setUTCHours(24, 0, 0, 0);
  return Math.max(1, Math.ceil((d.getTime() - now) / 1000));
}

// feature: "ask" | "resolve" | "chartVision" — matches <feature>PerDay in
// PLAN_LIMITS. Returns { ok, via, claims, record, store } or
// { ok: false, status, body, retryAfter? }.
async function authorizePaid(event, env, feature) {
  if (auth.bearerToken(event)) {
    for (const name of ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
      if (!env[name]) {
        return { ok: false, status: 500, body: { error: "Server not configured: missing " + name } };
      }
    }
    const claims = await auth.verifyBearer(event, env);
    if (!claims) return { ok: false, status: 401, body: { error: "Unauthorized" } };

    const store = storeFromEnv(env);
    let record = await store.loadEntitlement(claims.sub);
    if (!record) {
      record = ent.newEntitlement(claims.sub);
      await store.saveEntitlement(record);
    }
    if (ent.overLimit(record, feature)) {
      return {
        ok: false,
        status: 429,
        body: { error: "Daily " + feature + " limit reached — upgrade to Pro for more" },
        retryAfter: secondsToUtcMidnight(),
      };
    }
    return { ok: true, via: "account", claims, record, store };
  }

  // No Bearer: anonymous path. REQUIRE_ACCOUNTS=true ends it (Part 7f).
  if (env.REQUIRE_ACCOUNTS === "true") {
    return { ok: false, status: 401, body: { error: "Sign in to use this feature" } };
  }
  const secret = env.CREDENZA_SEARCH_SECRET;
  if (!secret) {
    return { ok: false, status: 500, body: { error: "Server not configured: missing CREDENZA_SEARCH_SECRET" } };
  }
  const supplied = event && event.headers && event.headers["x-credenza-key"];
  if (supplied !== secret) return { ok: false, status: 401, body: { error: "Unauthorized" } };
  return { ok: true, via: "shared-key" };
}

// Count one successful paid call against the account (task 4). Best-effort:
// a failed save must not turn the customer's completed request into an error.
async function recordPaidUsage(gate, feature) {
  if (!gate || gate.via !== "account") return;
  try {
    await gate.store.saveEntitlement(ent.recordUsage(gate.record, feature));
  } catch {}
}

module.exports = { authorizePaid, recordPaidUsage };
