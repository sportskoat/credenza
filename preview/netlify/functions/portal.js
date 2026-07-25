// ═══════════════════════════════════════════════════════════════════════════════
// portal.js — open the Stripe Customer Portal (Execution-Plan Part 7d)
//
// POST with `Authorization: Bearer <supabase access token>`. The Portal is
// where the customer changes a card, cancels, and downloads invoices — Stripe
// hosts it, so none of that UI lives in the app.
//
// The link from account to Stripe customer is the entitlement record's
// stripeCustomerId (written by the webhook on checkout.session.completed).
// No customer id yet → the account has never paid → 400, and the client
// shows the upgrade path instead of a portal button.
//
// The return URL is built HERE from the site URL, never taken from the
// request body — a client-supplied return URL is an open-redirect.
// ═══════════════════════════════════════════════════════════════════════════════

const limit = require("./lib/limit.js");
const auth = require("./lib/auth.js");
const { storeFromEnv } = require("./lib/entitlement-store.js");
const { stripePost } = require("./lib/stripe.js");

const ROUTE = "portal";
const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

function response(statusCode, payload, extraHeaders) {
  return {
    statusCode,
    headers: { ...JSON_HEADERS, ...(extraHeaders || {}) },
    body: JSON.stringify(payload),
  };
}

function siteUrl(env) {
  const raw = env.SITE_URL || env.URL || "https://credenzafashion.com";
  return String(raw).replace(/\/+$/, "");
}

async function handle(event) {
  const env = process.env;
  for (const name of ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "STRIPE_SECRET_KEY"]) {
    if (!env[name]) return response(500, { error: "Server not configured: missing " + name });
  }
  if (!event || event.httpMethod !== "POST") {
    return response(405, { error: "Method not allowed" });
  }

  const claims = await auth.verifyBearer(event, env);
  if (!claims) return response(401, { error: "Unauthorized" });

  const blocked = limit.enter(ROUTE, claims.sub);
  if (blocked) {
    return response(blocked.status, { error: blocked.msg }, { "retry-after": String(blocked.retryAfter) });
  }

  try {
    const store = storeFromEnv(env);
    const record = await store.loadEntitlement(claims.sub);
    if (!record || !record.stripeCustomerId) {
      return response(400, { error: "No billing account yet" });
    }

    const session = await stripePost(
      "/v1/billing_portal/sessions",
      {
        customer: record.stripeCustomerId,
        return_url: siteUrl(env) + "/?profile=1",
      },
      env.STRIPE_SECRET_KEY
    );
    if (!session || typeof session.url !== "string") {
      return response(502, { error: "Stripe did not return a portal URL" });
    }
    return response(200, { url: session.url });
  } catch (err) {
    if (err && err.stripeStatus) return response(502, { error: "Stripe error: " + err.message });
    throw err;
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
