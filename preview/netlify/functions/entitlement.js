// ═══════════════════════════════════════════════════════════════════════════════
// entitlement.js — the client asks "what may I use?" (Execution-Plan Part 7c)
//
// POST with `Authorization: Bearer <supabase access token>`. Verifies the
// token, loads (or creates) the caller's entitlement record, and returns a
// signed offline snapshot (task 6). The client caches the snapshot and works
// offline; the server re-checks the real record on every paid request.
// ═══════════════════════════════════════════════════════════════════════════════

const limit = require("./lib/limit.js");
const auth = require("./lib/auth.js");
const ent = require("./lib/entitlements.js");
const { storeFromEnv } = require("./lib/entitlement-store.js");

const ROUTE = "entitlement";
const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

function response(statusCode, payload, extraHeaders) {
  return {
    statusCode,
    headers: { ...JSON_HEADERS, ...(extraHeaders || {}) },
    body: JSON.stringify(payload),
  };
}

async function handle(event) {
  const env = process.env;
  for (const name of ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "ENTITLEMENT_SIGNING_SECRET"]) {
    if (!env[name]) return response(500, { error: "Server not configured: missing " + name });
  }
  if (!event || event.httpMethod !== "POST") {
    return response(405, { error: "Method not allowed" });
  }

  // ES256 against the project's JWKS; HS256 against the legacy secret when it
  // is configured (tokens signed before a key rotation).
  const claims = await auth.verifyBearer(event, env);
  if (!claims) return response(401, { error: "Unauthorized" });

  const blocked = limit.enter(ROUTE, claims.sub);
  if (blocked) {
    return response(blocked.status, { error: blocked.msg }, { "retry-after": String(blocked.retryAfter) });
  }

  try {
    const store = storeFromEnv(env);
    let record = await store.loadEntitlement(claims.sub);
    if (!record) {
      // First sign-in: create the free record so usage counters and Stripe
      // events have a row to land on.
      record = ent.newEntitlement(claims.sub);
      await store.saveEntitlement(record);
    }
    const visible = ent.withOwner(record, ent.isOwnerClaims(claims, env));
    return response(200, {
      snapshot: ent.signEntitlement(visible, env.ENTITLEMENT_SIGNING_SECRET),
      state: ent.effectiveStatus(visible),
    });
  } finally {
    limit.leave(ROUTE);
  }
}

// Outcome log for every request — status + latency only, never content.
exports.handler = async (event) => {
  const started = Date.now();
  let res;
  try {
    res = await handle(event);
  } catch {
    res = response(500, { error: "Internal error" });
  }
  limit.logOutcome(ROUTE, limit.clientKey(event), res.statusCode, { ms: Date.now() - started });
  return res;
};

// Test hook: drop the cached JWKS.
exports._resetJwksCache = auth._resetJwksCache;
