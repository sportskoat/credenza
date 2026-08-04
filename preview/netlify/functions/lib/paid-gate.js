// ═══════════════════════════════════════════════════════════════════════════════
// paid-gate.js — who may call a paid function (Execution-Plan Part 7f)
//
// Every paid function (ask, resolve, chart-vision) authorizes through here.
// Two paths:
//   1. ACCOUNT: `Authorization: Bearer <supabase token>`. The token is
//      verified, the entitlement record is loaded (created on first use), and
//      the plan allowance is enforced against REAL server usage. After a
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
const anon = require("./anon-allowance.js");
const limit = require("./limit.js");
const { storeFromEnv } = require("./entitlement-store.js");

// feature: "ask" | "resolve" | "chartVision" — matches the plan cap in
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
    record = ent.withOwner(record, ent.isOwnerClaims(claims, env));
    if (ent.overLimit(record, feature)) {
      const monthly = ent.effectiveStatus(record) !== "free";
      return {
        ok: false,
        status: 429,
        body: {
          error: monthly
            ? "Monthly " + feature + " allowance used. More reads arrive next month."
            : "Free " + feature + " allowance used. Upgrade to Pro for more.",
        },
      };
    }
    return { ok: true, via: "account", claims, record, store };
  }

  // No Bearer: anonymous path. The shared key still has to be right — it
  // proves the caller is our own browser bundle rather than a script.
  const secret = env.CREDENZA_SEARCH_SECRET;
  if (!secret) {
    return { ok: false, status: 500, body: { error: "Server not configured: missing CREDENZA_SEARCH_SECRET" } };
  }
  const supplied = event && event.headers && event.headers["x-credenza-key"];
  if (supplied !== secret) return { ok: false, status: 401, body: { error: "Unauthorized" } };

  // REQUIRE_ACCOUNTS=true limits the anonymous path to five complete cards.
  // `code` tells the
  // browser WHICH refusal this is, so it can show "Sign in to read this link"
  // instead of leaving a blank card behind.
  if (env.REQUIRE_ACCOUNTS === "true") {
    const clientKey = limit.clientKey(event);
    if (!anon.allowAnon(feature, clientKey)) {
      return {
        ok: false,
        status: 401,
        body: { error: "Sign in to use this feature", code: "sign_in_required" },
      };
    }
    return { ok: true, via: "anon-free", clientKey, feature };
  }
  return { ok: true, via: "shared-key" };
}

// Count one successful paid call against the account (task 4), or against the
// signed-out visitor's five free reads. Best-effort: a failed save must not
// turn the customer's completed request into an error.
async function recordPaidUsage(gate, feature) {
  if (!gate) return;
  if (gate.via === "anon-free") {
    anon.recordAnon(feature, gate.clientKey);
    return;
  }
  if (gate.via !== "account") return;
  if (ent.effectiveStatus(gate.record) === "owner") return;
  try {
    await gate.store.saveEntitlement(ent.recordUsage(gate.record, feature));
  } catch {}
}

module.exports = { authorizePaid, recordPaidUsage };
