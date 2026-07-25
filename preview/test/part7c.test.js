// Part 7c: entitlement store, entitlement function, stripe-webhook.
// The Supabase Data API is faked in memory; Stripe signatures are computed
// with the same scheme Stripe uses (HMAC-SHA256 of `${t}.${rawBody}`).

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createRequire } from "node:module";
import { createHmac } from "node:crypto";

const require = createRequire(import.meta.url);
const { signJwt, verifyJwt } = require("../netlify/functions/lib/jwt.js");
const { makeStore } = require("../netlify/functions/lib/entitlement-store.js");
const ent = require("../netlify/functions/lib/entitlements.js");
const limit = require("../netlify/functions/lib/limit.js");
const entitlementFn = require("../netlify/functions/entitlement.js");
const stripeWebhook = require("../netlify/functions/stripe-webhook.js");

const JWT_SECRET = "jwt-secret";
const SIGN_SECRET = "sign-secret";
const WH_SECRET = "whsec_test";

// ————— Fake Supabase Data API ————————————————————————————————————————————————

function fakeSupabase() {
  const entitlements = new Map(); // user_id -> row
  const events = new Set();
  const calls = [];
  const fetchMock = async (url, init = {}) => {
    calls.push({ url: String(url), method: (init.method || "GET").toUpperCase() });
    const u = new URL(String(url));
    const method = (init.method || "GET").toUpperCase();
    const ok = (body, status = 200) => ({ ok: status < 300, status, json: async () => body });

    if (u.pathname === "/rest/v1/entitlements" && method === "GET") {
      const userEq = u.searchParams.get("user_id");
      const custEq = u.searchParams.get("record->>stripeCustomerId");
      let rows = [...entitlements.values()];
      if (userEq && userEq.startsWith("eq.")) rows = rows.filter((r) => r.user_id === userEq.slice(3));
      if (custEq && custEq.startsWith("eq.")) rows = rows.filter((r) => r.record.stripeCustomerId === custEq.slice(3));
      return ok(rows.map((r) => ({ record: r.record })));
    }
    if (u.pathname === "/rest/v1/entitlements" && method === "POST") {
      const body = JSON.parse(init.body);
      entitlements.set(body.user_id, body);
      return ok(null, 201);
    }
    if (u.pathname === "/rest/v1/processed_events" && method === "GET") {
      const idEq = u.searchParams.get("event_id");
      const id = idEq && idEq.slice(3);
      return ok(events.has(id) ? [{ event_id: id }] : []);
    }
    if (u.pathname === "/rest/v1/processed_events" && method === "POST") {
      const body = JSON.parse(init.body);
      if (events.has(body.event_id)) return { ok: false, status: 409, json: async () => ({}) };
      events.add(body.event_id);
      return ok(null, 201);
    }
    throw new Error("unexpected " + method + " " + u.pathname + u.search);
  };
  return { entitlements, events, calls, fetchMock };
}

function stripeSig(rawBody, tsSec) {
  const v1 = createHmac("sha256", WH_SECRET).update(tsSec + "." + rawBody).digest("hex");
  return "t=" + tsSec + ",v1=" + v1;
}

function webhookEvent(rawBody, sig) {
  return {
    httpMethod: "POST",
    headers: { "stripe-signature": sig },
    body: rawBody,
    isBase64Encoded: false,
  };
}

beforeEach(() => {
  limit._resetForTest();
  process.env.SUPABASE_URL = "https://test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "svc-key";
  process.env.SUPABASE_JWT_SECRET = JWT_SECRET;
  process.env.ENTITLEMENT_SIGNING_SECRET = SIGN_SECRET;
  process.env.STRIPE_WEBHOOK_SECRET = WH_SECRET;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ————— jwt.js ————————————————————————————————————————————————————————————————

describe("jwt", () => {
  const valid = () => signJwt({ sub: "user-1", exp: Math.floor(Date.now() / 1000) + 3600 }, JWT_SECRET);

  it("round-trips a valid token", () => {
    const claims = verifyJwt(valid(), JWT_SECRET);
    expect(claims.sub).toBe("user-1");
  });

  it("rejects a wrong secret, expiry, garbage, non-HS256, and missing sub", () => {
    expect(verifyJwt(valid(), "other-secret")).toBeNull();
    const expired = signJwt({ sub: "user-1", exp: Math.floor(Date.now() / 1000) - 10 }, JWT_SECRET);
    expect(verifyJwt(expired, JWT_SECRET)).toBeNull();
    expect(verifyJwt("not-a-token", JWT_SECRET)).toBeNull();
    expect(verifyJwt(valid().slice(0, -2) + "xx", JWT_SECRET)).toBeNull();
    const none = signJwt({ sub: "user-1", exp: Math.floor(Date.now() / 1000) + 3600 }, JWT_SECRET, { alg: "none" });
    expect(verifyJwt(none, JWT_SECRET)).toBeNull();
    const noSub = signJwt({ exp: Math.floor(Date.now() / 1000) + 3600 }, JWT_SECRET);
    expect(verifyJwt(noSub, JWT_SECRET)).toBeNull();
  });
});

// ————— entitlement-store.js ——————————————————————————————————————————————————

describe("entitlement-store", () => {
  it("loads, saves, and finds records over the Data API", async () => {
    const sb = fakeSupabase();
    const store = makeStore({ url: "https://test.supabase.co", serviceKey: "svc-key", fetchImpl: sb.fetchMock });

    expect(await store.loadEntitlement("user-1")).toBeNull();

    const record = { ...ent.newEntitlement("user-1"), stripeCustomerId: "cus_9" };
    await store.saveEntitlement(record);
    const saveCall = sb.calls.find((c) => c.method === "POST" && c.url.includes("/entitlements"));
    expect(saveCall).toBeTruthy();

    expect(await store.loadEntitlement("user-1")).toMatchObject({ userId: "user-1", stripeCustomerId: "cus_9" });
    expect(await store.loadByStripeCustomer("cus_9")).toMatchObject({ userId: "user-1" });
    expect(await store.loadByStripeCustomer("cus_nope")).toBeNull();
  });

  it("tracks processed events and tolerates a duplicate mark (409)", async () => {
    const sb = fakeSupabase();
    const store = makeStore({ url: "https://test.supabase.co", serviceKey: "svc-key", fetchImpl: sb.fetchMock });

    expect(await store.isEventProcessed("evt_1")).toBe(false);
    await store.markEventProcessed("evt_1");
    expect(await store.isEventProcessed("evt_1")).toBe(true);
    await expect(store.markEventProcessed("evt_1")).resolves.toBeUndefined(); // 409 tolerated
  });

  it("sends the service key on every call and throws on a dead API", async () => {
    const seen = [];
    const fetchImpl = async (url, init) => {
      seen.push(init.headers);
      return { ok: false, status: 503, json: async () => ({}) };
    };
    const store = makeStore({ url: "https://test.supabase.co", serviceKey: "svc-key", fetchImpl });
    await expect(store.loadEntitlement("user-1")).rejects.toThrow("503");
    expect(seen[0].apikey).toBe("svc-key");
    expect(seen[0].authorization).toBe("Bearer svc-key");
  });
});

// ————— entitlement function ——————————————————————————————————————————————————

describe("entitlement function", () => {
  const post = (token) => ({
    httpMethod: "POST",
    headers: token ? { authorization: "Bearer " + token } : {},
    body: "",
  });

  it("rejects missing config, wrong method, and missing/bad tokens", async () => {
    delete process.env.SUPABASE_JWT_SECRET;
    expect((await entitlementFn.handler(post("x"))).statusCode).toBe(500);
    process.env.SUPABASE_JWT_SECRET = JWT_SECRET;

    expect((await entitlementFn.handler({ httpMethod: "GET", headers: {} })).statusCode).toBe(405);
    expect((await entitlementFn.handler(post(null))).statusCode).toBe(401);
    expect((await entitlementFn.handler(post("garbage"))).statusCode).toBe(401);
  });

  it("creates a free record on first sign-in and returns a verifiable snapshot", async () => {
    const sb = fakeSupabase();
    vi.stubGlobal("fetch", sb.fetchMock);
    const token = signJwt({ sub: "user-1", exp: Math.floor(Date.now() / 1000) + 3600 }, JWT_SECRET);

    const res = await entitlementFn.handler(post(token));
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.state).toBe("free");

    const snapshot = ent.verifyEntitlement(body.snapshot, SIGN_SECRET);
    expect(snapshot.sub).toBe("user-1");
    expect(snapshot.plan).toBe("free");
    expect(snapshot.lim).toEqual(ent.PLAN_LIMITS.free);

    // The record was persisted for usage counters and Stripe events.
    expect(sb.entitlements.has("user-1")).toBe(true);
  });

  it("returns the existing record for a pro user", async () => {
    const sb = fakeSupabase();
    vi.stubGlobal("fetch", sb.fetchMock);
    const pro = {
      ...ent.newEntitlement("user-2"),
      plan: "pro",
      billingStatus: "active",
      currentPeriodEnd: Date.now() + 30 * 24 * 60 * 60 * 1000,
    };
    sb.entitlements.set("user-2", { user_id: "user-2", record: pro });

    const token = signJwt({ sub: "user-2", exp: Math.floor(Date.now() / 1000) + 3600 }, JWT_SECRET);
    const res = await entitlementFn.handler(post(token));
    const body = JSON.parse(res.body);
    expect(body.state).toBe("pro");
    expect(ent.verifyEntitlement(body.snapshot, SIGN_SECRET).lim).toEqual(ent.PLAN_LIMITS.pro);
  });
});

// ————— stripe-webhook function ————————————————————————————————————————————————

describe("stripe-webhook", () => {
  const nowSec = () => Math.floor(Date.now() / 1000);

  function signedEvent(payload) {
    const rawBody = JSON.stringify(payload);
    return { rawBody, sig: stripeSig(rawBody, nowSec()) };
  }

  it("rejects a bad signature, a stale timestamp, and malformed json", async () => {
    vi.stubGlobal("fetch", fakeSupabase().fetchMock);

    const { rawBody } = signedEvent({ id: "evt_1", type: "checkout.session.completed", data: { object: {} } });
    expect((await stripeWebhook.handler(webhookEvent(rawBody, "t=1,v1=bad"))).statusCode).toBe(400);

    const stale = stripeSig(rawBody, nowSec() - 3600);
    expect((await stripeWebhook.handler(webhookEvent(rawBody, stale))).statusCode).toBe(400);

    const badJson = "{not json";
    expect((await stripeWebhook.handler(webhookEvent(badJson, stripeSig(badJson, nowSec())))).statusCode).toBe(400);
  });

  it("checkout.session.completed links the customer to the user record", async () => {
    const sb = fakeSupabase();
    vi.stubGlobal("fetch", sb.fetchMock);

    const { rawBody, sig } = signedEvent({
      id: "evt_co_1",
      type: "checkout.session.completed",
      data: { object: { customer: "cus_1", subscription: "sub_1", client_reference_id: "user-1" } },
    });
    const res = await stripeWebhook.handler(webhookEvent(rawBody, sig));
    expect(res.statusCode).toBe(200);

    const record = sb.entitlements.get("user-1").record;
    expect(record.stripeCustomerId).toBe("cus_1");
    expect(record.stripeSubscriptionId).toBe("sub_1");
    expect(sb.events.has("evt_co_1")).toBe(true);
  });

  it("a replayed event changes nothing and answers replay:true", async () => {
    const sb = fakeSupabase();
    vi.stubGlobal("fetch", sb.fetchMock);

    const { rawBody, sig } = signedEvent({
      id: "evt_co_2",
      type: "checkout.session.completed",
      data: { object: { customer: "cus_2", client_reference_id: "user-2" } },
    });
    await stripeWebhook.handler(webhookEvent(rawBody, sig));
    const saves = sb.calls.filter((c) => c.method === "POST" && c.url.includes("/entitlements")).length;

    const res = await stripeWebhook.handler(webhookEvent(rawBody, sig));
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).replay).toBe(true);
    expect(sb.calls.filter((c) => c.method === "POST" && c.url.includes("/entitlements")).length).toBe(saves);
  });

  it("accepts a base64-encoded body", async () => {
    const sb = fakeSupabase();
    vi.stubGlobal("fetch", sb.fetchMock);

    const rawBody = JSON.stringify({
      id: "evt_b64",
      type: "checkout.session.completed",
      data: { object: { customer: "cus_b", client_reference_id: "user-b" } },
    });
    const event = {
      httpMethod: "POST",
      headers: { "stripe-signature": stripeSig(rawBody, nowSec()) },
      body: Buffer.from(rawBody, "utf8").toString("base64"),
      isBase64Encoded: true,
    };
    expect((await stripeWebhook.handler(event)).statusCode).toBe(200);
    expect(sb.entitlements.has("user-b")).toBe(true);
  });

  it("answers 500 on an out-of-order subscription event, then applies it after the link", async () => {
    const sb = fakeSupabase();
    vi.stubGlobal("fetch", sb.fetchMock);

    const periodEnd = nowSec() + 30 * 24 * 3600;
    const sub = {
      id: "evt_sub_1",
      type: "customer.subscription.updated",
      data: { object: { id: "sub_1", customer: "cus_1", status: "active", current_period_end: periodEnd } },
    };
    // Customer not linked yet — Stripe must retry.
    const first = signedEvent(sub);
    expect((await stripeWebhook.handler(webhookEvent(first.rawBody, first.sig))).statusCode).toBe(500);

    const checkout = signedEvent({
      id: "evt_co_3",
      type: "checkout.session.completed",
      data: { object: { customer: "cus_1", subscription: "sub_1", client_reference_id: "user-1" } },
    });
    await stripeWebhook.handler(webhookEvent(checkout.rawBody, checkout.sig));

    const retry = signedEvent(sub);
    expect((await stripeWebhook.handler(webhookEvent(retry.rawBody, retry.sig))).statusCode).toBe(200);
    const record = sb.entitlements.get("user-1").record;
    expect(record.billingStatus).toBe("active");
    expect(record.currentPeriodEnd).toBe(periodEnd * 1000);
    expect(ent.effectiveStatus(record)).toBe("pro");
  });

  it("skips a checkout session without client_reference_id and ignores unknown event types", async () => {
    const sb = fakeSupabase();
    vi.stubGlobal("fetch", sb.fetchMock);

    const noRef = signedEvent({
      id: "evt_noref",
      type: "checkout.session.completed",
      data: { object: { customer: "cus_dash" } },
    });
    const res = await stripeWebhook.handler(webhookEvent(noRef.rawBody, noRef.sig));
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).skipped).toBe("no-client-reference");
    expect(sb.entitlements.size).toBe(0);

    // Unknown type on a linked customer: applied (a no-op) and marked processed.
    sb.entitlements.set("user-9", {
      user_id: "user-9",
      record: { ...ent.newEntitlement("user-9"), stripeCustomerId: "cus_9" },
    });
    const unknown = signedEvent({
      id: "evt_unk",
      type: "customer.updated",
      data: { object: { customer: "cus_9" } },
    });
    expect((await stripeWebhook.handler(webhookEvent(unknown.rawBody, unknown.sig))).statusCode).toBe(200);
    expect(sb.events.has("evt_unk")).toBe(true);
  });
});
