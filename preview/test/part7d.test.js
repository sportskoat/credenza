// Part 7d: checkout + portal functions. The Supabase Data API and the Stripe
// API are both faked in memory — one fetch mock dispatches on the hostname.
// No real network, no real keys.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { signJwt } = require("../netlify/functions/lib/jwt.js");
const auth = require("../netlify/functions/lib/auth.js");
const ent = require("../netlify/functions/lib/entitlements.js");
const limit = require("../netlify/functions/lib/limit.js");
const checkout = require("../netlify/functions/checkout.js");
const portal = require("../netlify/functions/portal.js");

const JWT_SECRET = "jwt-secret";
const SK = "sk_test_123";
const PRICE_WEEKLY = "price_week";
const PRICE_MONTHLY = "price_month";
const PRICE_YEARLY = "price_year";

// ————— Fake Supabase + Stripe behind one fetch ———————————————————————————————

function fakeBackends({ stripeHandler } = {}) {
  const entitlements = new Map(); // user_id -> row
  const stripeCalls = []; // { path, params }
  const fetchMock = async (url, init = {}) => {
    const u = new URL(String(url));
    const method = (init.method || "GET").toUpperCase();
    const ok = (body, status = 200) => ({ ok: status < 300, status, json: async () => body });

    if (u.hostname === "api.stripe.com") {
      const params = Object.fromEntries(new URLSearchParams(init.body));
      stripeCalls.push({ path: u.pathname, params, auth: init.headers.authorization });
      if (stripeHandler) return stripeHandler(u.pathname, params, ok);
      return ok({ url: "https://stripe.test/session/1" });
    }

    if (u.pathname === "/auth/v1/.well-known/jwks.json") return ok({ keys: [] });
    if (u.pathname === "/rest/v1/entitlements" && method === "GET") {
      const userEq = u.searchParams.get("user_id");
      let rows = [...entitlements.values()];
      if (userEq && userEq.startsWith("eq.")) rows = rows.filter((r) => r.user_id === userEq.slice(3));
      return ok(rows.map((r) => ({ record: r.record })));
    }
    if (u.pathname === "/rest/v1/entitlements" && method === "POST") {
      const body = JSON.parse(init.body);
      entitlements.set(body.user_id, body);
      return ok(null, 201);
    }
    throw new Error("unexpected " + method + " " + u.hostname + u.pathname + u.search);
  };
  return { entitlements, stripeCalls, fetchMock };
}

function post(token, body) {
  return {
    httpMethod: "POST",
    headers: token ? { authorization: "Bearer " + token } : {},
    body: body == null ? "" : JSON.stringify(body),
  };
}

const tokenFor = (sub, extra = {}) =>
  signJwt({ sub, exp: Math.floor(Date.now() / 1000) + 3600, ...extra }, JWT_SECRET);

beforeEach(() => {
  limit._resetForTest();
  auth._resetJwksCache();
  process.env.SUPABASE_URL = "https://test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "svc-key";
  process.env.SUPABASE_JWT_SECRET = JWT_SECRET;
  process.env.STRIPE_SECRET_KEY = SK;
  process.env.STRIPE_PRICE_WEEKLY = PRICE_WEEKLY;
  process.env.STRIPE_PRICE_MONTHLY = PRICE_MONTHLY;
  process.env.STRIPE_PRICE_YEARLY = PRICE_YEARLY;
  process.env.SITE_URL = "https://credenzafashion.com";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ————— checkout ———————————————————————————————————————————————————————————————

describe("checkout function", () => {
  it("rejects missing config, wrong method, no token, and a bad body", async () => {
    delete process.env.STRIPE_SECRET_KEY;
    expect((await checkout.handler(post("x", { price: "monthly" }))).statusCode).toBe(500);
    process.env.STRIPE_SECRET_KEY = SK;

    expect((await checkout.handler({ httpMethod: "GET", headers: {} })).statusCode).toBe(405);
    expect((await checkout.handler(post(null, { price: "monthly" }))).statusCode).toBe(401);

    vi.stubGlobal("fetch", fakeBackends().fetchMock);
    expect((await checkout.handler(post("garbage", { price: "monthly" }))).statusCode).toBe(401);

    const token = tokenFor("user-1");
    expect((await checkout.handler(post(token, { price: "daily" }))).statusCode).toBe(400);
    expect((await checkout.handler(post(token, {}))).statusCode).toBe(400);
  });

  it("attaches the 3-day trial to the weekly session, and to no other", async () => {
    // The trial is weekly-only (decided 2026-07-27): card up front, first
    // charge on day 4. A trial on monthly or yearly would only delay revenue.
    const sb = fakeBackends();
    vi.stubGlobal("fetch", sb.fetchMock);
    const token = tokenFor("user-1", { email: "u@example.com" });

    const res = await checkout.handler(post(token, { price: "weekly" }));
    expect(res.statusCode).toBe(200);
    const weekly = sb.stripeCalls.find((c) => c.path === "/v1/checkout/sessions");
    expect(weekly.params["line_items[0][price]"]).toBe(PRICE_WEEKLY);
    expect(weekly.params["subscription_data[trial_period_days]"]).toBe("3");

    for (const price of ["monthly", "yearly"]) {
      sb.stripeCalls.length = 0;
      const r = await checkout.handler(post(token, { price }));
      expect(r.statusCode).toBe(200);
      const call = sb.stripeCalls.find((c) => c.path === "/v1/checkout/sessions");
      expect(call.params["subscription_data[trial_period_days]"]).toBeUndefined();
    }
  });

  it("answers 500 when the chosen price id is not configured", async () => {
    delete process.env.STRIPE_PRICE_YEARLY;
    vi.stubGlobal("fetch", fakeBackends().fetchMock);
    const res = await checkout.handler(post(tokenFor("user-1"), { price: "yearly" }));
    expect(res.statusCode).toBe(500);
    expect(res.body).toContain("STRIPE_PRICE_YEARLY");
  });

  it("creates a monthly session: user id links the webhook, price matches the choice", async () => {
    const sb = fakeBackends();
    vi.stubGlobal("fetch", sb.fetchMock);

    const res = await checkout.handler(post(tokenFor("user-1", { email: "u@example.com" }), { price: "monthly" }));
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).url).toBe("https://stripe.test/session/1");

    const call = sb.stripeCalls.find((c) => c.path === "/v1/checkout/sessions");
    expect(call).toBeTruthy();
    expect(call.auth).toBe("Basic " + Buffer.from(SK + ":").toString("base64"));
    expect(call.params.mode).toBe("subscription");
    expect(call.params.client_reference_id).toBe("user-1");
    expect(call.params["line_items[0][price]"]).toBe(PRICE_MONTHLY);
    expect(call.params["line_items[0][quantity]"]).toBe("1");
    // No Stripe customer yet: the account email seeds the new customer.
    expect(call.params.customer_email).toBe("u@example.com");
    expect(call.params.customer).toBeUndefined();
    // Return URLs come from the server, never from the request body.
    expect(call.params.success_url).toBe("https://credenzafashion.com/?upgraded=1");
    expect(call.params.cancel_url).toBe("https://credenzafashion.com/?upgrade=cancelled");

    // The free record exists so checkout.session.completed has a row to land on.
    expect(sb.entitlements.has("user-1")).toBe(true);
  });

  it("reuses the stored Stripe customer on a re-subscribe (no duplicate customer)", async () => {
    const sb = fakeBackends();
    sb.entitlements.set("user-2", {
      user_id: "user-2",
      record: { ...ent.newEntitlement("user-2"), stripeCustomerId: "cus_9" },
    });
    vi.stubGlobal("fetch", sb.fetchMock);

    const res = await checkout.handler(post(tokenFor("user-2", { email: "u@example.com" }), { price: "yearly" }));
    expect(res.statusCode).toBe(200);

    const call = sb.stripeCalls.find((c) => c.path === "/v1/checkout/sessions");
    expect(call.params.customer).toBe("cus_9");
    expect(call.params.customer_email).toBeUndefined();
    expect(call.params["line_items[0][price]"]).toBe(PRICE_YEARLY);
  });

  it("answers 502 when Stripe fails (bad price id, API down)", async () => {
    const sb = fakeBackends({
      stripeHandler: (path, params, ok) => ok({ error: { message: "No such price" } }, 400),
    });
    vi.stubGlobal("fetch", sb.fetchMock);

    const res = await checkout.handler(post(tokenFor("user-1"), { price: "monthly" }));
    expect(res.statusCode).toBe(502);
    expect(res.body).toContain("No such price");
  });
});

// ————— portal —————————————————————————————————————————————————————————————————

describe("portal function", () => {
  it("rejects missing config, wrong method, and no token", async () => {
    delete process.env.STRIPE_SECRET_KEY;
    expect((await portal.handler(post("x"))).statusCode).toBe(500);
    process.env.STRIPE_SECRET_KEY = SK;

    expect((await portal.handler({ httpMethod: "GET", headers: {} })).statusCode).toBe(405);
    expect((await portal.handler(post(null))).statusCode).toBe(401);

    vi.stubGlobal("fetch", fakeBackends().fetchMock);
    expect((await portal.handler(post("garbage"))).statusCode).toBe(401);
  });

  it("answers 400 when the account has never paid (no customer to portal)", async () => {
    const sb = fakeBackends();
    vi.stubGlobal("fetch", sb.fetchMock);

    const res = await portal.handler(post(tokenFor("user-1")));
    expect(res.statusCode).toBe(400);
    expect(res.body).toContain("No billing account");
    expect(sb.stripeCalls.length).toBe(0);
  });

  it("opens a portal session for the stored customer", async () => {
    const sb = fakeBackends({
      stripeHandler: (path, params, ok) => ok({ url: "https://billing.stripe.test/p/1" }),
    });
    sb.entitlements.set("user-2", {
      user_id: "user-2",
      record: { ...ent.newEntitlement("user-2"), stripeCustomerId: "cus_9" },
    });
    vi.stubGlobal("fetch", sb.fetchMock);

    const res = await portal.handler(post(tokenFor("user-2")));
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).url).toBe("https://billing.stripe.test/p/1");

    const call = sb.stripeCalls.find((c) => c.path === "/v1/billing_portal/sessions");
    expect(call.params.customer).toBe("cus_9");
    expect(call.params.return_url).toBe("https://credenzafashion.com/?profile=1");
  });

  it("answers 502 when Stripe fails", async () => {
    const sb = fakeBackends({
      stripeHandler: (path, params, ok) => ok({ error: { message: "No such customer" } }, 400),
    });
    sb.entitlements.set("user-2", {
      user_id: "user-2",
      record: { ...ent.newEntitlement("user-2"), stripeCustomerId: "cus_gone" },
    });
    vi.stubGlobal("fetch", sb.fetchMock);

    const res = await portal.handler(post(tokenFor("user-2")));
    expect(res.statusCode).toBe(502);
    expect(res.body).toContain("No such customer");
  });
});
