// ═══════════════════════════════════════════════════════════════════════════════
// entitlement.js — the client asks "what may I use?" (Execution-Plan Part 7c)
//
// POST with `Authorization: Bearer <supabase access token>`. Verifies the
// token, loads (or creates) the caller's entitlement record, and returns a
// signed offline snapshot (task 6). The client caches the snapshot and works
// offline; the server re-checks the real record on every paid request.
// ═══════════════════════════════════════════════════════════════════════════════

const limit = require("./lib/limit.js");
const { verifyJwt } = require("./lib/jwt.js");
const ent = require("./lib/entitlements.js");
const { storeFromEnv } = require("./lib/entitlement-store.js");

const ROUTE = "entitlement";
const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };
const JWKS_TTL_MS = 10 * 60 * 1000;

// The project's public signing keys (ES256). Cached per warm instance; a key
// rotation is picked up within ten minutes, and an unknown kid forces one
// refetch below.
let jwksCache = { at: 0, jwks: null };

async function getJwks(env, force = false) {
  if (!force && jwksCache.jwks && Date.now() - jwksCache.at < JWKS_TTL_MS) return jwksCache.jwks;
  const res = await fetch(env.SUPABASE_URL.replace(/\/+$/, "") + "/auth/v1/.well-known/jwks.json");
  if (!res.ok) throw new Error("jwks fetch -> " + res.status);
  jwksCache = { at: Date.now(), jwks: await res.json() };
  return jwksCache.jwks;
}

function response(statusCode, payload, extraHeaders) {
  return {
    statusCode,
    headers: { ...JSON_HEADERS, ...(extraHeaders || {}) },
    body: JSON.stringify(payload),
  };
}

function bearerToken(event) {
  const header = event && event.headers && (event.headers.authorization || event.headers.Authorization);
  if (!header || typeof header !== "string") return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

async function handle(event) {
  const env = process.env;
  for (const name of ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "ENTITLEMENT_SIGNING_SECRET"]) {
    if (!env[name]) return response(500, { error: "Server not configured: missing " + name });
  }
  if (!event || event.httpMethod !== "POST") {
    return response(405, { error: "Method not allowed" });
  }

  const token = bearerToken(event);
  if (!token) return response(401, { error: "Unauthorized" });

  // ES256 against the project's JWKS; HS256 against the legacy secret when it
  // is configured (tokens signed before a key rotation).
  let claims = verifyJwt(token, { secret: env.SUPABASE_JWT_SECRET, jwks: await getJwks(env) });
  if (!claims) claims = verifyJwt(token, { secret: env.SUPABASE_JWT_SECRET, jwks: await getJwks(env, true) });
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
    return response(200, {
      snapshot: ent.signEntitlement(record, env.ENTITLEMENT_SIGNING_SECRET),
      state: ent.effectiveStatus(record),
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
exports._resetJwksCache = () => {
  jwksCache = { at: 0, jwks: null };
};
