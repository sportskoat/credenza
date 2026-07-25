// ═══════════════════════════════════════════════════════════════════════════════
// stripe.js — one form-encoded POST to the Stripe API (Execution-Plan Part 7d)
//
// No SDK: the functions only create Checkout Sessions and Billing Portal
// Sessions, so a single helper keeps the bundle dependency-free. Auth is HTTP
// Basic with the secret key as the username (Stripe's scheme). Nested params
// use Stripe's bracket encoding: line_items[0][price]=price_…
//
// stripePost throws on a non-ok response with Stripe's own error message; the
// caller (function handler) turns that into a 502 — Stripe failing is not the
// customer's fault and not a 500-bug in our code.
// ═══════════════════════════════════════════════════════════════════════════════

const API_BASE = "https://api.stripe.com";

// Flatten { a: { b: 1 }, c: [2] } → { "a[b]": 1, "c[0]": 2 }. Null/undefined
// values are dropped (Stripe treats an empty string as "unset"; absent is
// cleaner).
function flatten(params, prefix, out) {
  for (const [key, value] of Object.entries(params)) {
    if (value == null) continue;
    const name = prefix ? prefix + "[" + key + "]" : key;
    if (typeof value === "object") flatten(value, name, out);
    else out[name] = String(value);
  }
  return out;
}

async function stripePost(path, params, secretKey, fetchImpl = null) {
  if (!secretKey) throw new Error("stripePost needs a secret key");
  const call = fetchImpl || fetch;
  const res = await call(API_BASE + path, {
    method: "POST",
    headers: {
      authorization: "Basic " + Buffer.from(secretKey + ":").toString("base64"),
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(flatten(params, "", {})).toString(),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body && body.error && body.error.message ? body.error.message : "HTTP " + res.status;
    throw Object.assign(new Error("stripe " + path + " -> " + msg), { stripeStatus: res.status });
  }
  return body;
}

module.exports = { stripePost };
