// ═══════════════════════════════════════════════════════════════════════════════
// jwt.js — verify Supabase access tokens (Execution-Plan Part 7c)
//
// Supabase signs access tokens with HS256 and the project JWT secret. The
// paid functions verify the token here instead of trusting x-credenza-key.
// verifyJwt returns the decoded payload on success, null on any failure —
// it never throws.
//
// signJwt exists for tests and local tooling only.
// ═══════════════════════════════════════════════════════════════════════════════

const { createHmac, timingSafeEqual } = require("node:crypto");

const b64u = (buf) => Buffer.from(buf).toString("base64url");

function signJwt(payload, secret, header = { alg: "HS256", typ: "JWT" }) {
  const body = b64u(JSON.stringify(header)) + "." + b64u(JSON.stringify(payload));
  return body + "." + createHmac("sha256", secret).update(body).digest("base64url");
}

function verifyJwt(token, secret, now = Date.now()) {
  if (!token || typeof token !== "string" || !secret) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const body = parts[0] + "." + parts[1];

  let header, payload;
  try {
    header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!header || header.alg !== "HS256") return null;
  if (!payload || typeof payload !== "object") return null;

  const want = createHmac("sha256", secret).update(body).digest();
  let got;
  try {
    got = Buffer.from(parts[2], "base64url");
  } catch {
    return null;
  }
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;

  // Expiry: `exp` is unix seconds. A token with no exp never expires — reject
  // it; a session token must expire.
  if (typeof payload.exp !== "number" || payload.exp * 1000 <= now) return null;
  if (typeof payload.sub !== "string" || !payload.sub) return null;
  return payload;
}

module.exports = { signJwt, verifyJwt };
