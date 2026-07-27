// Part 7e server side: delete-account. Supabase (Data API + admin API) is
// faked in memory; no real network.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { signJwt } = require("../netlify/functions/lib/jwt.js");
const auth = require("../netlify/functions/lib/auth.js");
const ent = require("../netlify/functions/lib/entitlements.js");
const limit = require("../netlify/functions/lib/limit.js");
const deleteAccount = require("../netlify/functions/delete-account.js");

const JWT_SECRET = "jwt-secret";

function fakeSupabase() {
  const entitlements = new Map(); // user_id -> row
  const shelves = new Map(); // user_id -> synced shelf document (LB-7)
  const shares = new Map(); // code -> share row (LB-8)
  const deletedUsers = [];
  const fetchMock = async (url, init = {}) => {
    const u = new URL(String(url));
    const method = (init.method || "GET").toUpperCase();
    const ok = (body, status = 200) => ({ ok: status < 300, status, json: async () => body });

    if (u.pathname === "/auth/v1/.well-known/jwks.json") return ok({ keys: [] });

    const adminMatch = u.pathname.match(/^\/auth\/v1\/admin\/users\/(.+)$/);
    if (adminMatch && method === "DELETE") {
      deletedUsers.push(decodeURIComponent(adminMatch[1]));
      return ok({});
    }

    if (u.pathname === "/rest/v1/entitlements" && method === "GET") {
      const userEq = u.searchParams.get("user_id");
      let rows = [...entitlements.values()];
      if (userEq && userEq.startsWith("eq.")) rows = rows.filter((r) => r.user_id === userEq.slice(3));
      return ok(rows.map((r) => ({ record: r.record })));
    }
    if (u.pathname === "/rest/v1/entitlements" && method === "DELETE") {
      const userEq = u.searchParams.get("user_id");
      if (userEq && userEq.startsWith("eq.")) entitlements.delete(userEq.slice(3));
      return ok(null, 204);
    }
    if (u.pathname === "/rest/v1/shelves" && method === "DELETE") {
      const userEq = u.searchParams.get("user_id");
      if (userEq && userEq.startsWith("eq.")) shelves.delete(userEq.slice(3));
      return ok(null, 204);
    }
    // The codes are listed before they are deleted, because the edge purge
    // needs them and the rows are about to be gone (LB-62).
    if (u.pathname === "/rest/v1/shares" && method === "GET") {
      const userEq = u.searchParams.get("user_id");
      let rows = [...shares.values()];
      if (userEq && userEq.startsWith("eq.")) rows = rows.filter((r) => r.user_id === userEq.slice(3));
      return ok(rows.map((r) => ({ ...r, title: r.data && r.data.title, count: r.data && r.data.count })));
    }
    // Shared links (LB-8). These are PUBLIC URLs, so account deletion has to
    // take them as well — see the shares assertions below.
    if (u.pathname === "/rest/v1/shares" && method === "DELETE") {
      const userEq = u.searchParams.get("user_id");
      if (userEq && userEq.startsWith("eq.")) {
        const owner = userEq.slice(3);
        for (const [code, row] of shares) if (row.user_id === owner) shares.delete(code);
      }
      return ok(null, 204);
    }
    throw new Error("unexpected " + method + " " + u.pathname + u.search);
  };
  return { entitlements, shelves, shares, deletedUsers, fetchMock };
}

const tokenFor = (sub) => signJwt({ sub, exp: Math.floor(Date.now() / 1000) + 3600 }, JWT_SECRET);
const post = (token) => ({
  httpMethod: "POST",
  headers: token ? { authorization: "Bearer " + token } : {},
  body: "",
});

beforeEach(() => {
  limit._resetForTest();
  auth._resetJwksCache();
  process.env.SUPABASE_URL = "https://test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "svc-key";
  process.env.SUPABASE_JWT_SECRET = JWT_SECRET;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("delete-account function", () => {
  it("rejects missing config, wrong method, and bad tokens", async () => {
    delete process.env.SUPABASE_URL;
    expect((await deleteAccount.handler(post("x"))).statusCode).toBe(500);
    process.env.SUPABASE_URL = "https://test.supabase.co";

    expect((await deleteAccount.handler({ httpMethod: "GET", headers: {} })).statusCode).toBe(405);
    expect((await deleteAccount.handler(post(null))).statusCode).toBe(401);

    vi.stubGlobal("fetch", fakeSupabase().fetchMock);
    expect((await deleteAccount.handler(post("garbage"))).statusCode).toBe(401);
  });

  it("deletes the record, the synced shelf, and the auth user", async () => {
    const sb = fakeSupabase();
    sb.entitlements.set("user-1", { user_id: "user-1", record: ent.newEntitlement("user-1") });
    // The customer's cards on our server (LB-7). Delete my account has to
    // take these too, or "delete my account" is not true.
    sb.shelves.set("user-1", { v: 1, items: [{ id: "a" }] });
    // A live public share link. Leaving this alive after "delete my account"
    // keeps the customer's cards on the open web.
    sb.shares.set("abcdefghjkmn", { id: "abcdefghjkmn", user_id: "user-1", data: { v: 1, items: [] } });
    sb.shares.set("zzzzzzzzzzzz", { id: "zzzzzzzzzzzz", user_id: "someone-else", data: { v: 1, items: [] } });
    vi.stubGlobal("fetch", sb.fetchMock);

    const res = await deleteAccount.handler(post(tokenFor("user-1")));
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).deleted).toBe(true);
    expect(sb.entitlements.has("user-1")).toBe(false);
    expect(sb.shelves.has("user-1")).toBe(false);
    expect(sb.shares.has("abcdefghjkmn")).toBe(false);
    // Another account's share survives.
    expect(sb.shares.has("zzzzzzzzzzzz")).toBe(true);
    expect(sb.deletedUsers).toEqual(["user-1"]);
  });

  it("leaves the synced shelf alone when the delete is refused", async () => {
    const sb = fakeSupabase();
    sb.entitlements.set("user-9", {
      user_id: "user-9",
      record: {
        ...ent.newEntitlement("user-9"),
        plan: "pro",
        billingStatus: "active",
        stripeCustomerId: "cus_9",
        stripeSubscriptionId: "sub_9",
      },
    });
    sb.shelves.set("user-9", { v: 1, items: [{ id: "a" }] });
    vi.stubGlobal("fetch", sb.fetchMock);

    expect((await deleteAccount.handler(post(tokenFor("user-9")))).statusCode).toBe(409);
    expect(sb.shelves.has("user-9")).toBe(true);
  });

  it("works when the account has no record yet (auth user still goes)", async () => {
    const sb = fakeSupabase();
    vi.stubGlobal("fetch", sb.fetchMock);

    const res = await deleteAccount.handler(post(tokenFor("user-2")));
    expect(res.statusCode).toBe(200);
    expect(sb.deletedUsers).toEqual(["user-2"]);
  });

  it("answers 409 while a subscription is active — cancel first", async () => {
    const sb = fakeSupabase();
    sb.entitlements.set("user-3", {
      user_id: "user-3",
      record: {
        ...ent.newEntitlement("user-3"),
        plan: "pro",
        billingStatus: "active",
        stripeCustomerId: "cus_1",
        stripeSubscriptionId: "sub_1",
        currentPeriodEnd: Date.now() + 30 * 24 * 3600e3,
      },
    });
    vi.stubGlobal("fetch", sb.fetchMock);

    const res = await deleteAccount.handler(post(tokenFor("user-3")));
    expect(res.statusCode).toBe(409);
    expect(res.body).toContain("Cancel your subscription");
    // Nothing was deleted — the user can still reach the Portal.
    expect(sb.entitlements.has("user-3")).toBe(true);
    expect(sb.deletedUsers).toEqual([]);
  });

  it("allows deletion after cancellation (subscription id cleared)", async () => {
    const sb = fakeSupabase();
    sb.entitlements.set("user-4", {
      user_id: "user-4",
      record: {
        ...ent.newEntitlement("user-4"),
        billingStatus: "canceled",
        stripeCustomerId: "cus_4",
        stripeSubscriptionId: null,
      },
    });
    vi.stubGlobal("fetch", sb.fetchMock);

    const res = await deleteAccount.handler(post(tokenFor("user-4")));
    expect(res.statusCode).toBe(200);
    expect(sb.deletedUsers).toEqual(["user-4"]);
  });
});
