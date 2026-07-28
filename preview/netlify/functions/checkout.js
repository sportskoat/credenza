// ═══════════════════════════════════════════════════════════════════════════════
// checkout.js — start a Stripe Checkout Session for Credenza Pro
// (Execution-Plan Part 7d)
//
// POST with `Authorization: Bearer <supabase access token>` and a JSON body:
//   { "price": "weekly" | "monthly" | "yearly" }
//
// The weekly plan carries a 3-day free trial (decided 2026-07-27): the card
// is collected up front by Checkout, the first charge lands on day 4. The
// trial lives HERE, not on the Stripe product — a product-level trial would
// attach to every price, and a trial on a yearly plan makes no sense.
//
// The flow:
//   1. Verify the token (shared auth helper) — checkout is account-only.
//   2. Load the entitlement record; create the free record on a first visit
//      so the webhook's checkout.session.completed has a row to land on.
//   3. Create the Checkout Session with client_reference_id = user id (the
//      webhook links the Stripe customer back to this account through it).
//      A returning subscriber checks out as the SAME Stripe customer, so a
//      lapsed-then-returning user never gets a duplicate customer record.
//   4. Answer { url } — the client redirects the browser to Stripe.
//
// Success/cancel URLs are built HERE from the site URL, never taken from the
// request body — a client-supplied return URL is an open-redirect. Stripe
// appends nothing we need; the webhook, not the return page, moves the plan.
// ═══════════════════════════════════════════════════════════════════════════════

const limit = require("./lib/limit.js");
const auth = require("./lib/auth.js");
const ent = require("./lib/entitlements.js");
const { storeFromEnv } = require("./lib/entitlement-store.js");
const { stripePost } = require("./lib/stripe.js");

const ROUTE = "checkout";
const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

// Weekly only: 3 days free, card up front, first charge on day 4. Monthly
// and yearly bill at once — a trial on a discounted anchor plan only delays
// revenue and invites churn games.
const TRIAL_DAYS_BY_PRICE = { weekly: 3 };

const PRICE_ENV_BY_NAME = {
  weekly: "STRIPE_PRICE_WEEKLY",
  monthly: "STRIPE_PRICE_MONTHLY",
  yearly: "STRIPE_PRICE_YEARLY",
};

function response(statusCode, payload, extraHeaders) {
  return {
    statusCode,
    headers: { ...JSON_HEADERS, ...(extraHeaders || {}) },
    body: JSON.stringify(payload),
  };
}

// Netlify sets URL (and DEPLOY_PRIME_URL on previews); localhost fallback for
// `netlify dev`. Trailing slash is stripped before paths are appended.
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

  let body = {};
  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch {
    return response(400, { error: "Invalid JSON body" });
  }
  const envName = PRICE_ENV_BY_NAME[body.price];
  if (!envName) {
    return response(400, { error: 'Body must be { "price": "weekly" | "monthly" | "yearly" }' });
  }
  const priceId = env[envName];
  if (!priceId) {
    return response(500, { error: "Server not configured: missing " + envName });
  }

  const blocked = limit.enter(ROUTE, claims.sub);
  if (blocked) {
    return response(blocked.status, { error: blocked.msg }, { "retry-after": String(blocked.retryAfter) });
  }

  try {
    const store = storeFromEnv(env);
    let record = await store.loadEntitlement(claims.sub);
    if (!record) {
      record = ent.newEntitlement(claims.sub);
      await store.saveEntitlement(record);
    }

    const base = siteUrl(env);
    const session = await stripePost(
      "/v1/checkout/sessions",
      {
        mode: "subscription",
        client_reference_id: claims.sub,
        // Same customer on a re-subscribe; otherwise let Stripe create one
        // from the account email when the token carries it.
        customer: record.stripeCustomerId || undefined,
        customer_email: record.stripeCustomerId ? undefined : claims.email || undefined,
        line_items: [{ price: priceId, quantity: 1 }],
        allow_promotion_codes: true,
        subscription_data: TRIAL_DAYS_BY_PRICE[body.price]
          ? { trial_period_days: TRIAL_DAYS_BY_PRICE[body.price] }
          : undefined,
        success_url: base + "/?upgraded=1",
        cancel_url: base + "/?upgrade=cancelled",
      },
      env.STRIPE_SECRET_KEY
    );
    if (!session || typeof session.url !== "string") {
      return response(502, { error: "Stripe did not return a checkout URL" });
    }
    return response(200, { url: session.url });
  } catch (err) {
    // Stripe's own failure (bad price id, API down) is a 502 — not our bug,
    // not the customer's. A store failure is a 500 (see the handler below).
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
