// Part 7f: paid functions authorize through paid-gate — account (Bearer +
// server-side plan allowances) or the legacy shared key until REQUIRE_ACCOUNTS
// flips. Supabase and Anthropic are faked in memory; no real network.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { signJwt } = require("../netlify/functions/lib/jwt.js");
const auth = require("../netlify/functions/lib/auth.js");
const ent = require("../netlify/functions/lib/entitlements.js");
const limit = require("../netlify/functions/lib/limit.js");
const ask = require("../netlify/functions/ask.js");

const JWT_SECRET = "jwt-secret";
const SHARED = "shared-secret";

// ————— Fake Supabase + Anthropic behind one fetch ——————————————————————————————

function fakeBackends() {
  const entitlements = new Map(); // user_id -> row
  const anthropicCalls = [];
  const fetchMock = async (url, init = {}) => {
    const u = new URL(String(url));
    const method = (init.method || "GET").toUpperCase();
    const ok = (body, status = 200) => ({ ok: status < 300, status, json: async () => body });

    if (u.hostname === "api.anthropic.com") {
      anthropicCalls.push(u.pathname);
      return ok({
        content: [
          { type: "tool_use", name: "return_credenza_matches", input: { results: [], answer: "ok" } },
        ],
        usage: { input_tokens: 10, output_tokens: 5 },
      });
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
  return { entitlements, anthropicCalls, fetchMock };
}

const tokenFor = (sub, extra = {}) =>
  signJwt({ sub, exp: Math.floor(Date.now() / 1000) + 3600, ...extra }, JWT_SECRET);

function post(headers) {
  return {
    httpMethod: "POST",
    headers,
    body: JSON.stringify({ query: "black jacket", shelf: [] }),
  };
}

beforeEach(() => {
  limit._resetForTest();
  auth._resetJwksCache();
  process.env.ANTHROPIC_API_KEY = "sk-ant-test";
  process.env.CREDENZA_SEARCH_SECRET = SHARED;
  process.env.SUPABASE_URL = "https://test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "svc-key";
  process.env.SUPABASE_JWT_SECRET = JWT_SECRET;
  delete process.env.REQUIRE_ACCOUNTS;
  delete process.env.CREDENZA_OWNER_EMAILS;
  delete process.env.CREDENZA_OWNER_USER_IDS;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("paid gate (via ask)", () => {
  it("shared key still works while REQUIRE_ACCOUNTS is off", async () => {
    const sb = fakeBackends();
    vi.stubGlobal("fetch", sb.fetchMock);

    const res = await ask.handler(post({ "x-credenza-key": SHARED }));
    expect(res.statusCode).toBe(200);
    expect(sb.anthropicCalls.length).toBe(1);
  });

  it("REQUIRE_ACCOUNTS=true ends the anonymous path", async () => {
    process.env.REQUIRE_ACCOUNTS = "true";
    const sb = fakeBackends();
    vi.stubGlobal("fetch", sb.fetchMock);

    const res = await ask.handler(post({ "x-credenza-key": SHARED }));
    expect(res.statusCode).toBe(401);
    expect(res.body).toContain("Sign in");
    expect(sb.anthropicCalls.length).toBe(0);
  });

  it("a bad Bearer never falls back to the shared-key path", async () => {
    const sb = fakeBackends();
    vi.stubGlobal("fetch", sb.fetchMock);

    const res = await ask.handler(post({ authorization: "Bearer garbage", "x-credenza-key": SHARED }));
    expect(res.statusCode).toBe(401);
    expect(sb.anthropicCalls.length).toBe(0);
  });

  it("account path: valid Bearer runs the call and records server-side usage", async () => {
    const sb = fakeBackends();
    vi.stubGlobal("fetch", sb.fetchMock);

    const res = await ask.handler(post({ authorization: "Bearer " + tokenFor("user-1") }));
    expect(res.statusCode).toBe(200);
    expect(sb.anthropicCalls.length).toBe(1);

    const record = sb.entitlements.get("user-1").record;
    expect(ent.usageToday(record, "ask")).toBe(1);
  });

  it("account path: at the permanent Free cap the call is a 429 and never reaches Anthropic", async () => {
    const sb = fakeBackends();
    // Put the full Free Ask allowance on the record already.
    let record = ent.newEntitlement("user-2");
    for (let i = 0; i < ent.PLAN_LIMITS.free.askTotal; i++) record = ent.recordUsage(record, "ask");
    sb.entitlements.set("user-2", { user_id: "user-2", record });
    vi.stubGlobal("fetch", sb.fetchMock);

    const res = await ask.handler(post({ authorization: "Bearer " + tokenFor("user-2") }));
    expect(res.statusCode).toBe(429);
    expect(res.headers["retry-after"]).toBeUndefined();
    expect(res.body).toContain("Upgrade to Pro");
    expect(sb.anthropicCalls.length).toBe(0);
  });

  it("account path: starting Pro opens a fresh monthly allowance", async () => {
    const sb = fakeBackends();
    let record = ent.newEntitlement("user-3");
    for (let i = 0; i < ent.PLAN_LIMITS.free.askTotal; i++) record = ent.recordUsage(record, "ask");
    record = {
      ...record,
      plan: "pro",
      billingStatus: "active",
      currentPeriodEnd: Date.now() + 30 * 24 * 3600e3,
    };
    sb.entitlements.set("user-3", { user_id: "user-3", record });
    vi.stubGlobal("fetch", sb.fetchMock);

    const res = await ask.handler(post({ authorization: "Bearer " + tokenFor("user-3") }));
    expect(res.statusCode).toBe(200);
    expect(sb.anthropicCalls.length).toBe(1);
  });

  it("account path: a spent Pro allowance returns next-month guidance", async () => {
    const sb = fakeBackends();
    let record = {
      ...ent.newEntitlement("user-4"),
      plan: "pro",
      billingStatus: "active",
      currentPeriodEnd: Date.now() + 30 * 24 * 3600e3,
    };
    for (let i = 0; i < ent.PLAN_LIMITS.pro.askPerMonth; i++) {
      record = ent.recordUsage(record, "ask");
    }
    sb.entitlements.set("user-4", { user_id: "user-4", record });
    vi.stubGlobal("fetch", sb.fetchMock);

    const res = await ask.handler(post({ authorization: "Bearer " + tokenFor("user-4") }));
    expect(res.statusCode).toBe(429);
    expect(res.body).toContain("More reads arrive next month");
    expect(sb.anthropicCalls.length).toBe(0);
  });

  it("owner access bypasses usage caps without changing the billing record", async () => {
    process.env.CREDENZA_OWNER_EMAILS = "creator@example.com";
    const sb = fakeBackends();
    let record = ent.newEntitlement("owner-1");
    for (let i = 0; i < ent.PLAN_LIMITS.free.askTotal; i++) record = ent.recordUsage(record, "ask");
    sb.entitlements.set("owner-1", { user_id: "owner-1", record });
    vi.stubGlobal("fetch", sb.fetchMock);

    const token = tokenFor("owner-1", { email: "Creator@Example.com" });
    const res = await ask.handler(post({ authorization: "Bearer " + token }));
    expect(res.statusCode).toBe(200);
    expect(sb.anthropicCalls.length).toBe(1);
    expect(sb.entitlements.get("owner-1").record.owner).toBeUndefined();
  });
});
