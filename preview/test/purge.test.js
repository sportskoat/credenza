// LB-62: a deleted share has to leave the edge, not just the database.
//
// /how/ promises the page answers 404 "straight away". The row disappears in
// milliseconds; the CACHED page does not. share-page.js holds 300 s with an
// hour of stale-while-revalidate, and share-image.js holds seven days. Every
// test in this file asks the same question the LB-61 rule asks: does the
// delete change what a reader gets, or only what a table holds?
//
// Nothing here reaches the network. The purge API is a stubbed global fetch,
// and the assertions are on the REQUEST, because the request is the whole
// feature — a purge that names no tag purges the entire site, and a purge
// that names the wrong site purges nothing.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const purge = require("../netlify/functions/lib/purge.js");
const sharePage = require("../netlify/functions/share-page.js");
const shareImage = require("../netlify/functions/share-image.js");
const shareApi = require("../netlify/functions/share.js");
const deleteAccount = require("../netlify/functions/delete-account.js");
const limit = require("../netlify/functions/lib/limit.js");
const auth = require("../netlify/functions/lib/auth.js");
const ent = require("../netlify/functions/lib/entitlements.js");
const { signJwt } = require("../netlify/functions/lib/jwt.js");

const JWT_SECRET = "jwt-secret";
const CODE = "abcdefghjkmn";
const OTHER = "npqrstuvwxyz";

function doc() {
  return {
    v: 1,
    title: "Winter haul",
    count: 1,
    truncated: false,
    fields: { prices: false, notes: false, quality: false, sellers: false, parcel: false },
    items: [{ title: "Wool coat", image: "https://cdn.example.com/coat.jpg" }],
    createdAt: 1_700_000_000_000,
  };
}

// One in-memory Supabase plus a recorder for the purge API. `purges` holds the
// parsed body of every call to api.netlify.com, in order.
function fakeWorld() {
  const shares = new Map();
  const entitlements = new Map();
  const purges = [];
  const deletedUsers = [];

  const fetchMock = async (url, init = {}) => {
    const u = new URL(String(url));
    const method = (init.method || "GET").toUpperCase();
    const ok = (body, status = 200) => ({ ok: status < 300, status, json: async () => body });
    const eq = (name) => {
      const raw = u.searchParams.get(name);
      return raw && raw.startsWith("eq.") ? raw.slice(3) : null;
    };

    if (u.hostname === "api.netlify.com") {
      purges.push({ body: JSON.parse(init.body), headers: init.headers, method });
      return ok({}, 202);
    }

    if (u.pathname === "/auth/v1/.well-known/jwks.json") return ok({ keys: [] });
    const adminMatch = u.pathname.match(/^\/auth\/v1\/admin\/users\/(.+)$/);
    if (adminMatch && method === "DELETE") {
      deletedUsers.push(decodeURIComponent(adminMatch[1]));
      return ok({});
    }

    if (u.pathname === "/rest/v1/entitlements" && method === "GET") {
      const owner = eq("user_id");
      const row = owner ? entitlements.get(owner) : null;
      return ok(row ? [{ record: row }] : []);
    }
    if (u.pathname === "/rest/v1/entitlements" && method === "DELETE") return ok(null, 204);
    if (u.pathname === "/rest/v1/shelves" && method === "DELETE") return ok(null, 204);

    if (u.pathname === "/rest/v1/shares" && method === "GET") {
      const byId = eq("id");
      const owner = eq("user_id");
      let rows = [...shares.values()];
      if (byId) rows = rows.filter((r) => r.id === byId);
      if (owner) rows = rows.filter((r) => r.user_id === owner);
      return ok(rows.map((r) => ({ ...r, title: r.data && r.data.title, count: r.data && r.data.count })));
    }
    if (u.pathname === "/rest/v1/shares" && method === "DELETE") {
      const byId = eq("id");
      const owner = eq("user_id");
      for (const [key, row] of shares) {
        if (byId && row.id !== byId) continue;
        if (owner && row.user_id !== owner) continue;
        shares.delete(key);
      }
      return ok(null, 204);
    }
    throw new Error("unexpected " + method + " " + u.pathname + u.search);
  };

  return { shares, entitlements, purges, deletedUsers, fetchMock };
}

const tokenFor = (sub) => signJwt({ sub, exp: Math.floor(Date.now() / 1000) + 3600 }, JWT_SECRET);
const del = (token, code) => ({
  httpMethod: "DELETE",
  headers: token ? { authorization: "Bearer " + token } : {},
  queryStringParameters: { code },
});

beforeEach(() => {
  limit._resetForTest();
  auth._resetJwksCache();
  process.env.SUPABASE_URL = "https://test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "svc-key";
  process.env.SUPABASE_JWT_SECRET = JWT_SECRET;
  process.env.SITE_ID = "site-abc";
  process.env.NETLIFY_PURGE_API_TOKEN = "purge-token";
  delete process.env.SITE_NAME;
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.SITE_ID;
  delete process.env.SITE_NAME;
  delete process.env.NETLIFY_PURGE_API_TOKEN;
});

// ───────────────────────────────────────────────────────────────────────────
describe("the purge request names one tag and one site", () => {
  it("posts the code as a prefixed cache tag", async () => {
    const w = fakeWorld();
    vi.stubGlobal("fetch", w.fetchMock);

    const res = await purge.purgeShares([CODE], null, process.env);
    expect(res.ok).toBe(true);
    expect(w.purges.length).toBe(1);
    expect(w.purges[0].body.cache_tags).toEqual(["share-" + CODE]);
    expect(w.purges[0].body.site_id).toBe("site-abc");
    expect(w.purges[0].headers.authorization).toBe("Bearer purge-token");
  });

  // An ABSENT cache_tags list purges the whole site. One customer deleting one
  // link must never be able to clear the cache for every page Credenza serves.
  it("refuses to call the API at all when there is no code", async () => {
    const w = fakeWorld();
    vi.stubGlobal("fetch", w.fetchMock);

    const res = await purge.purgeShares([], null, process.env);
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("no-codes");
    expect(w.purges.length, "a tagless purge would clear the entire site").toBe(0);
  });

  it("prefers the scoped token Netlify puts on the context", async () => {
    const w = fakeWorld();
    vi.stubGlobal("fetch", w.fetchMock);

    const context = { clientContext: { custom: { purge_api_token: "scoped-token" } } };
    await purge.purgeShares([CODE], context, process.env);
    expect(w.purges[0].headers.authorization).toBe("Bearer scoped-token");
  });

  it("falls back to the site slug when only the name is set", async () => {
    const w = fakeWorld();
    vi.stubGlobal("fetch", w.fetchMock);

    delete process.env.SITE_ID;
    process.env.SITE_NAME = "credenza-kyle";
    await purge.purgeShares([CODE], null, process.env);
    expect(w.purges[0].body.site_slug).toBe("credenza-kyle");
    expect(w.purges[0].body.site_id).toBe(undefined);
  });

  it("reports a refusal instead of throwing when the API fails", async () => {
    vi.stubGlobal("fetch", async () => ({ ok: false, status: 429, json: async () => ({}) }));
    const res = await purge.purgeShares([CODE], null, process.env);
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("status-429");
  });

  it("reports a refusal instead of throwing when the network fails", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new Error("socket hang up");
    });
    const res = await purge.purgeShares([CODE], null, process.env);
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("network");
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe("every cached share response carries the tag that can purge it", () => {
  it("tags the page", async () => {
    const w = fakeWorld();
    w.shares.set(CODE, { id: CODE, user_id: "user-1", data: doc() });
    vi.stubGlobal("fetch", w.fetchMock);

    const res = await sharePage.handler({ httpMethod: "GET", headers: {}, path: "/s/" + CODE });
    expect(res.statusCode).toBe(200);
    expect(res.headers["netlify-cache-tag"]).toBe("share-" + CODE);
  });

  // The 404 caches for two minutes as well. Without a tag, a code that is
  // deleted and later reused would serve the stale miss.
  it("tags the cached 404 for a code that has no row", async () => {
    const w = fakeWorld();
    vi.stubGlobal("fetch", w.fetchMock);

    const res = await sharePage.handler({ httpMethod: "GET", headers: {}, path: "/s/" + CODE });
    expect(res.statusCode).toBe(404);
    expect(res.headers["netlify-cache-tag"]).toBe("share-" + CODE);
  });

  it("tags the card photo, which is the response cached for seven days", async () => {
    const w = fakeWorld();
    w.shares.set(CODE, { id: CODE, user_id: "user-1", data: doc() });
    vi.stubGlobal("fetch", async (url, init) => {
      if (String(url).startsWith("https://cdn.example.com/")) {
        // A one-pixel PNG, enough for the sniffer.
        const png = Buffer.from(
          "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6360000002000100ffff03000006000557bfabd40000000049454e44ae426082",
          "hex"
        );
        return { ok: true, status: 200, headers: { get: () => "image/png" }, arrayBuffer: async () => png, body: null };
      }
      return w.fetchMock(url, init);
    });

    const res = await shareImage.handler({ httpMethod: "GET", headers: {}, queryStringParameters: { code: CODE } });
    expect(res.headers["netlify-cache-tag"]).toBe("share-" + CODE);
  });

  // A malformed code never touched the database, so there is no row to purge
  // with — and a tag built from arbitrary input is a header injection risk.
  it("does not tag a response for a code that is not a share code", async () => {
    const w = fakeWorld();
    vi.stubGlobal("fetch", w.fetchMock);

    const res = await shareImage.handler({
      httpMethod: "GET",
      headers: {},
      queryStringParameters: { code: "not a code" },
    });
    expect(res.headers["netlify-cache-tag"]).toBe(undefined);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe("deleting a share purges it from the edge", () => {
  it("calls the purge API with that share's tag", async () => {
    const w = fakeWorld();
    w.shares.set(CODE, { id: CODE, user_id: "user-1", data: doc() });
    vi.stubGlobal("fetch", w.fetchMock);

    const res = await shareApi.handler(del(tokenFor("user-1"), CODE), null);
    expect(res.statusCode).toBe(200);
    expect(w.shares.has(CODE)).toBe(false);
    expect(w.purges.length, "the row went but the cached page stayed").toBe(1);
    expect(w.purges[0].body.cache_tags).toEqual(["share-" + CODE]);
  });

  // A purge that ran first would leave a window in which a request re-caches
  // the row on its way out.
  it("purges after the row is gone, never before", async () => {
    const w = fakeWorld();
    w.shares.set(CODE, { id: CODE, user_id: "user-1", data: doc() });
    const order = [];
    vi.stubGlobal("fetch", async (url, init) => {
      const u = new URL(String(url));
      if (u.hostname === "api.netlify.com") order.push("purge");
      else if (u.pathname === "/rest/v1/shares" && (init.method || "GET") === "DELETE") order.push("delete");
      return w.fetchMock(url, init);
    });

    await shareApi.handler(del(tokenFor("user-1"), CODE), null);
    expect(order).toEqual(["delete", "purge"]);
  });

  // The row is already gone. Failing the customer's delete because a cache API
  // blipped would be the worse outcome.
  it("still answers deleted when the purge fails", async () => {
    const w = fakeWorld();
    w.shares.set(CODE, { id: CODE, user_id: "user-1", data: doc() });
    vi.stubGlobal("fetch", async (url, init) => {
      if (new URL(String(url)).hostname === "api.netlify.com") throw new Error("down");
      return w.fetchMock(url, init);
    });

    const res = await shareApi.handler(del(tokenFor("user-1"), CODE), null);
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).deleted).toBe(true);
    expect(w.shares.has(CODE)).toBe(false);
  });

  it("purges nothing when the code was rejected as malformed", async () => {
    const w = fakeWorld();
    vi.stubGlobal("fetch", w.fetchMock);

    const res = await shareApi.handler(del(tokenFor("user-1"), "nope"), null);
    expect(res.statusCode).toBe(400);
    expect(w.purges.length).toBe(0);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe("deleting an account purges every share it owned", () => {
  it("names all of the account's codes in one purge", async () => {
    const w = fakeWorld();
    w.entitlements.set("user-1", ent.newEntitlement("user-1"));
    w.shares.set(CODE, { id: CODE, user_id: "user-1", data: doc() });
    w.shares.set(OTHER, { id: OTHER, user_id: "user-1", data: doc() });
    vi.stubGlobal("fetch", w.fetchMock);

    const res = await deleteAccount.handler(
      { httpMethod: "POST", headers: { authorization: "Bearer " + tokenFor("user-1") } },
      null
    );
    expect(res.statusCode).toBe(200);
    expect(w.purges.length).toBe(1);
    expect([...w.purges[0].body.cache_tags].sort()).toEqual(["share-" + CODE, "share-" + OTHER].sort());
  });

  // An account with no shares must not send a tagless purge, which would clear
  // the whole site's cache on every account deletion.
  it("sends no purge for an account that shared nothing", async () => {
    const w = fakeWorld();
    w.entitlements.set("user-2", ent.newEntitlement("user-2"));
    vi.stubGlobal("fetch", w.fetchMock);

    const res = await deleteAccount.handler(
      { httpMethod: "POST", headers: { authorization: "Bearer " + tokenFor("user-2") } },
      null
    );
    expect(res.statusCode).toBe(200);
    expect(w.purges.length).toBe(0);
  });

  it("reads the codes before the rows are deleted", async () => {
    const w = fakeWorld();
    w.entitlements.set("user-1", ent.newEntitlement("user-1"));
    w.shares.set(CODE, { id: CODE, user_id: "user-1", data: doc() });
    vi.stubGlobal("fetch", w.fetchMock);

    await deleteAccount.handler(
      { httpMethod: "POST", headers: { authorization: "Bearer " + tokenFor("user-1") } },
      null
    );
    // If the list ran after the delete it would be empty, and the purge would
    // have been skipped as tagless.
    expect(w.purges[0].body.cache_tags).toEqual(["share-" + CODE]);
  });
});
