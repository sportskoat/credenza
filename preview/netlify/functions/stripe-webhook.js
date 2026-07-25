// ═══════════════════════════════════════════════════════════════════════════════
// stripe-webhook.js — Stripe tells us about money (Execution-Plan Part 7c)
//
// One endpoint for the six events in docs/Part-7-setup.md. The flow:
//   1. Verify the Stripe-Signature header against the RAW body (task 3).
//   2. Skip event ids already in processed_events (task 5 — one time each).
//   3. Find the record: checkout.session.completed links via
//      client_reference_id (the Supabase user id we put in the Checkout
//      Session); everything else links via the stored stripeCustomerId.
//   4. applyStripeEvent (pure, forward-only) and save.
//
// Ordering: Stripe does not guarantee delivery order. If a subscription or
// invoice event arrives before checkout.session.completed has linked the
// customer, we answer 500 — Stripe retries with backoff, and by then the
// link exists. checkout.session.completed itself never 500s on a missing
// record; it creates the link.
// ═══════════════════════════════════════════════════════════════════════════════

const { createHmac, timingSafeEqual } = require("node:crypto");
const limit = require("./lib/limit.js");
const ent = require("./lib/entitlements.js");
const { storeFromEnv } = require("./lib/entitlement-store.js");

const ROUTE = "stripe-webhook";
const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };
const TOLERANCE_MS = 5 * 60 * 1000; // Stripe's recommended replay window

function response(statusCode, payload) {
  return { statusCode, headers: JSON_HEADERS, body: JSON.stringify(payload) };
}

// Verify the Stripe-Signature header: `t=<unix>,v1=<hmac>[,v1=...]`.
// The signed payload is `${t}.${rawBody}` with the webhook secret.
function verifyStripeSignature(rawBody, header, secret, now = Date.now()) {
  if (!header || typeof header !== "string" || !secret) return false;
  let ts = null;
  const sigs = [];
  for (const part of header.split(",")) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    const key = part.slice(0, eq).trim();
    const val = part.slice(eq + 1).trim();
    if (key === "t") ts = val;
    if (key === "v1") sigs.push(val);
  }
  if (!ts || !sigs.length) return false;
  const tsMs = Number(ts) * 1000;
  if (!Number.isFinite(tsMs) || Math.abs(now - tsMs) > TOLERANCE_MS) return false;

  const want = createHmac("sha256", secret).update(ts + "." + rawBody).digest();
  return sigs.some((sig) => {
    let got;
    try {
      got = Buffer.from(sig, "hex");
    } catch {
      return false;
    }
    return got.length === want.length && timingSafeEqual(got, want);
  });
}

async function handle(event) {
  const env = process.env;
  for (const name of ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "STRIPE_WEBHOOK_SECRET"]) {
    if (!env[name]) return response(500, { error: "Server not configured: missing " + name });
  }
  if (!event || event.httpMethod !== "POST") {
    return response(405, { error: "Method not allowed" });
  }

  // The signature covers the raw body — decode base64 if Netlify gives it to
  // us that way, and never touch the bytes before verification.
  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body || "", "base64").toString("utf8")
    : event.body || "";
  const header = event.headers && (event.headers["stripe-signature"] || event.headers["Stripe-Signature"]);
  if (!verifyStripeSignature(rawBody, header, env.STRIPE_WEBHOOK_SECRET)) {
    return response(400, { error: "Invalid signature" });
  }

  let stripeEvent;
  try {
    stripeEvent = JSON.parse(rawBody);
  } catch {
    return response(400, { error: "Invalid JSON body" });
  }
  if (!stripeEvent || typeof stripeEvent.id !== "string" || typeof stripeEvent.type !== "string") {
    return response(400, { error: "Invalid event shape" });
  }

  const store = storeFromEnv(env);

  // One time each (task 5). A replay gets a 200 and changes nothing — Stripe
  // stops retrying, and the record stays where the first delivery put it.
  if (await store.isEventProcessed(stripeEvent.id)) {
    return response(200, { received: true, replay: true });
  }

  const obj = (stripeEvent.data && stripeEvent.data.object) || {};
  let record = null;

  if (stripeEvent.type === "checkout.session.completed") {
    // client_reference_id carries the Supabase user id from Checkout (7d).
    const userId = typeof obj.client_reference_id === "string" ? obj.client_reference_id : null;
    if (!userId) {
      // A session we did not start (e.g. a Dashboard-created one). Nothing to
      // link; acknowledge it so Stripe stops retrying.
      await store.markEventProcessed(stripeEvent.id);
      return response(200, { received: true, skipped: "no-client-reference" });
    }
    record = (await store.loadEntitlement(userId)) || ent.newEntitlement(userId);
  } else {
    const customerId = typeof obj.customer === "string" ? obj.customer : null;
    if (customerId) record = await store.loadByStripeCustomer(customerId);
    if (!record) {
      // Out-of-order delivery (see the header comment). 500 = retry later.
      return response(500, { error: "Unknown customer; awaiting checkout link" });
    }
  }

  const next = ent.applyStripeEvent(record, stripeEvent);
  await store.saveEntitlement(next);
  await store.markEventProcessed(stripeEvent.id);
  return response(200, { received: true });
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
