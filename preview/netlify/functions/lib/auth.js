// ═══════════════════════════════════════════════════════════════════════════════
// auth.js — verify the caller's Supabase access token (Execution-Plan Part 7)
//
// Shared by every function that takes `Authorization: Bearer <token>`:
// entitlement.js (7c), checkout.js + portal.js (7d). ES256 against the
// project's JWKS (new signing-key system), HS256 against the legacy shared
// secret while old tokens are still around. verifyBearer returns the token
// claims on success, null on any failure — it never throws on a bad token.
//
// The JWKS is cached per warm instance; a key rotation is picked up within
// ten minutes, and an unknown kid forces one refetch.
// ═══════════════════════════════════════════════════════════════════════════════

const { verifyJwt } = require("./jwt.js");

const JWKS_TTL_MS = 10 * 60 * 1000;
let jwksCache = { at: 0, jwks: null };

async function getJwks(env, force = false) {
  if (!force && jwksCache.jwks && Date.now() - jwksCache.at < JWKS_TTL_MS) return jwksCache.jwks;
  const res = await fetch(env.SUPABASE_URL.replace(/\/+$/, "") + "/auth/v1/.well-known/jwks.json");
  if (!res.ok) throw new Error("jwks fetch -> " + res.status);
  jwksCache = { at: Date.now(), jwks: await res.json() };
  return jwksCache.jwks;
}

function bearerToken(event) {
  const header = event && event.headers && (event.headers.authorization || event.headers.Authorization);
  if (!header || typeof header !== "string") return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

// The caller's claims, or null. A dead JWKS endpoint throws — the function
// handler turns that into a 500 (our problem, not the caller's).
async function verifyBearer(event, env) {
  const token = bearerToken(event);
  if (!token) return null;
  let claims = verifyJwt(token, { secret: env.SUPABASE_JWT_SECRET, jwks: await getJwks(env) });
  if (!claims) claims = verifyJwt(token, { secret: env.SUPABASE_JWT_SECRET, jwks: await getJwks(env, true) });
  return claims;
}

function _resetJwksCache() {
  jwksCache = { at: 0, jwks: null };
}

module.exports = { verifyBearer, bearerToken, _resetJwksCache };
