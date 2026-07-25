// ═══════════════════════════════════════════════════════════════════════════════
// jwt.js — verify Supabase access tokens (Execution-Plan Part 7c)
//
// New Supabase projects sign access tokens with ES256 (ECC P-256) and publish
// the public keys at /auth/v1/.well-known/jwks.json. Projects rotated from
// the legacy scheme may still issue HS256 tokens with the shared JWT secret
// until the old tokens expire. This module verifies BOTH:
//   - ES256: against a JWKS key matched by `kid`
//   - HS256: against the shared secret (legacy fallback)
// verifyJwt returns the decoded payload on success, null on any failure —
// it never throws.
//
// signJwt (HS256) exists for tests and local tooling only.
// ═══════════════════════════════════════════════════════════════════════════════

const { createHmac, createPublicKey, verify: cryptoVerify, timingSafeEqual } = require("node:crypto");

const b64u = (buf) => Buffer.from(buf).toString("base64url");

function signJwt(payload, secret, header = { alg: "HS256", typ: "JWT" }) {
  const body = b64u(JSON.stringify(header)) + "." + b64u(JSON.stringify(payload));
  return body + "." + createHmac("sha256", secret).update(body).digest("base64url");
}

function decodePart(part) {
  try {
    return JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

function verifyHs256(body, sigPart, secret) {
  const want = createHmac("sha256", secret).update(body).digest();
  let got;
  try {
    got = Buffer.from(sigPart, "base64url");
  } catch {
    return false;
  }
  return got.length === want.length && timingSafeEqual(got, want);
}

function verifyEs256(body, sigPart, jwk) {
  try {
    const key = createPublicKey({ key: jwk, format: "jwk" });
    // JWS signatures are raw R||S — ieee-p1363 in Node terms.
    return cryptoVerify("sha256", Buffer.from(body), { key, dsaEncoding: "ieee-p1363" }, Buffer.from(sigPart, "base64url"));
  } catch {
    return false;
  }
}

// opts: { secret, jwks } — either may be missing; a bare string is treated as
// { secret } for the legacy callers.
function verifyJwt(token, opts, now = Date.now()) {
  const { secret, jwks } = typeof opts === "string" ? { secret: opts } : opts || {};
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const body = parts[0] + "." + parts[1];

  const header = decodePart(parts[0]);
  const payload = decodePart(parts[1]);
  if (!header || !payload || typeof payload !== "object") return null;

  let signed = false;
  if (header.alg === "HS256" && secret) {
    signed = verifyHs256(body, parts[2], secret);
  } else if (header.alg === "ES256" && jwks && Array.isArray(jwks.keys)) {
    const jwk = jwks.keys.find((k) => k && k.kty === "EC" && (!header.kid || k.kid === header.kid));
    signed = jwk ? verifyEs256(body, parts[2], jwk) : false;
  }
  if (!signed) return null;

  // Expiry: `exp` is unix seconds. A token with no exp never expires — reject
  // it; a session token must expire.
  if (typeof payload.exp !== "number" || payload.exp * 1000 <= now) return null;
  if (typeof payload.sub !== "string" || !payload.sub) return null;
  return payload;
}

module.exports = { signJwt, verifyJwt };
