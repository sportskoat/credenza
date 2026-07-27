// LB-8 server side: the public /s/:code page and the owner's share endpoint.
// Supabase is faked in memory; no real network.
//
// The assertion this file exists for is the acceptance criterion: a toggled-off
// field must be ABSENT from the served HTML, not hidden by CSS. Every "off"
// check below therefore looks at the response body text, because that is what
// View Source shows and what a scraper reads.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { signJwt } = require("../netlify/functions/lib/jwt.js");
const auth = require("../netlify/functions/lib/auth.js");
const ent = require("../netlify/functions/lib/entitlements.js");
const limit = require("../netlify/functions/lib/limit.js");
const sharePage = require("../netlify/functions/share-page.js");
const shareApi = require("../netlify/functions/share.js");

const JWT_SECRET = "jwt-secret";
const CODE = "abcdefghjkmn"; // 12 chars from the share alphabet
const OTHER = "npqrstuvwxyz";

function doc(extra = {}) {
  return {
    v: 1,
    title: "Winter haul",
    count: 1,
    truncated: false,
    fields: { prices: false, notes: false, quality: false, sellers: false, parcel: false },
    items: [{ title: "Wool coat", image: "https://cdn.example.com/coat.jpg" }],
    createdAt: 1_700_000_000_000,
    ...extra,
  };
}

function fakeSupabase() {
  const entitlements = new Map();
  const shares = new Map(); // code -> row
  const fetchMock = async (url, init = {}) => {
    const u = new URL(String(url));
    const method = (init.method || "GET").toUpperCase();
    const ok = (body, status = 200) => ({ ok: status < 300, status, json: async () => body });
    const eq = (name) => {
      const raw = u.searchParams.get(name);
      return raw && raw.startsWith("eq.") ? raw.slice(3) : null;
    };

    if (u.pathname === "/auth/v1/.well-known/jwks.json") return ok({ keys: [] });

    if (u.pathname === "/rest/v1/entitlements" && method === "GET") {
      const owner = eq("user_id");
      const row = owner ? entitlements.get(owner) : null;
      return ok(row ? [{ record: row }] : []);
    }
    if (u.pathname === "/rest/v1/entitlements" && method === "POST") {
      const body = JSON.parse(init.body);
      entitlements.set(body.user_id, body.record);
      return ok(null, 201);
    }

    if (u.pathname === "/rest/v1/shares" && method === "GET") {
      const byId = eq("id");
      const owner = eq("user_id");
      let rows = [...shares.values()];
      if (byId) rows = rows.filter((r) => r.id === byId);
      if (owner) rows = rows.filter((r) => r.user_id === owner);
      // PostgREST returns the jsonb arrow selections as flat columns.
      const select = u.searchParams.get("select") || "";
      if (select.includes("->>title")) {
        return ok(rows.map((r) => ({ ...r, title: r.data && r.data.title, count: r.data && r.data.count })));
      }
      return ok(rows);
    }
    if (u.pathname === "/rest/v1/shares" && method === "POST") {
      const body = JSON.parse(init.body);
      if (shares.has(body.id)) return ok({ message: "duplicate key" }, 409);
      shares.set(body.id, body);
      return ok(null, 201);
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
  return { entitlements, shares, fetchMock };
}

const tokenFor = (sub) => signJwt({ sub, exp: Math.floor(Date.now() / 1000) + 3600 }, JWT_SECRET);
const get = (code) => ({ httpMethod: "GET", headers: {}, path: "/s/" + code });
const apiPost = (token, body) => ({
  httpMethod: "POST",
  headers: token ? { authorization: "Bearer " + token } : {},
  body: JSON.stringify(body),
});

function proRecord(userId) {
  return {
    ...ent.newEntitlement(userId),
    plan: "pro",
    billingStatus: "active",
    currentPeriodEnd: Date.now() + 30 * 24 * 3600 * 1000,
  };
}

beforeEach(() => {
  limit._resetForTest();
  auth._resetJwksCache();
  process.env.SUPABASE_URL = "https://test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "svc-key";
  process.env.SUPABASE_JWT_SECRET = JWT_SECRET;
  process.env.SITE_URL = "https://credenzafashion.com";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ───────────────────────────────────────────────────────────────────────────
describe("the public page renders what the sharer chose", () => {
  it("shows photos and titles, and nothing the toggles left off", async () => {
    const sb = fakeSupabase();
    sb.shares.set(CODE, {
      id: CODE,
      user_id: "user-1",
      data: doc({
        items: [
          {
            title: "Wool coat",
            image: "https://cdn.example.com/coat.jpg",
            link: "https://weidian.com/item/1",
            size: "L",
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", sb.fetchMock);

    const res = await sharePage.handler(get(CODE));
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/html");
    expect(res.body).toContain("Wool coat");
    expect(res.body).toContain("https://cdn.example.com/coat.jpg");
    expect(res.body).toContain("Size L");
    // The default share carries no price, note, seller, batch or weight, so
    // none of those can appear anywhere in the source.
    expect(res.body).not.toContain("$");
    expect(res.body).not.toContain("seller");
  });

  it("prints a price only when the snapshot carries one", async () => {
    const sb = fakeSupabase();
    sb.shares.set(CODE, {
      id: CODE,
      user_id: "user-1",
      data: doc({
        fields: { prices: true, notes: false, quality: false, sellers: false, parcel: false },
        items: [{ title: "Wool coat", image: "https://cdn.example.com/coat.jpg", priceUsd: 42.5 }],
        totalUsd: 42.5,
      }),
    });
    vi.stubGlobal("fetch", sb.fetchMock);

    const res = await sharePage.handler(get(CODE));
    expect(res.body).toContain("$42.50");
    expect(res.body).toContain("total");
  });

  it("carries Open Graph tags a chat client can unfurl", async () => {
    const sb = fakeSupabase();
    sb.shares.set(CODE, { id: CODE, user_id: "user-1", data: doc() });
    vi.stubGlobal("fetch", sb.fetchMock);

    const html = (await sharePage.handler(get(CODE))).body;
    expect(html).toContain('<meta property="og:title" content="Winter haul" />');
    expect(html).toContain('<meta property="og:image" content="https://cdn.example.com/coat.jpg" />');
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image" />');
    // A shared haul is the sharer's, not search-index material.
    expect(html).toContain('content="noindex, nofollow"');
  });

  it("falls back to the site card when no photo is a fetchable URL", async () => {
    const sb = fakeSupabase();
    sb.shares.set(CODE, {
      id: CODE,
      user_id: "user-1",
      // A crawler cannot fetch a data: URL, so an honest fallback beats a
      // broken unfurl.
      data: doc({ items: [{ title: "Coat", image: "data:image/png;base64,AAAA" }] }),
    });
    vi.stubGlobal("fetch", sb.fetchMock);

    const html = (await sharePage.handler(get(CODE))).body;
    expect(html).toContain('<meta property="og:image" content="https://credenzafashion.com/og.png" />');
  });

  it("keeps the Credenza footer unless the share hides it", async () => {
    const sb = fakeSupabase();
    sb.shares.set(CODE, { id: CODE, user_id: "user-1", data: doc() });
    sb.shares.set(OTHER, { id: OTHER, user_id: "user-1", data: doc(), hide_footer: true });
    vi.stubGlobal("fetch", sb.fetchMock);

    expect((await sharePage.handler(get(CODE))).body).toContain("Made with");
    expect((await sharePage.handler(get(OTHER))).body).not.toContain("Made with");
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe("nothing from the snapshot can execute", () => {
  it("escapes text the sharer typed", () => {
    const html = sharePage._internal.itemHtml({
      title: '<script>alert(1)</script>',
      note: '"><img onerror=alert(2)>',
      image: null,
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("refuses a javascript: link and a non-image data: src", () => {
    const { safeHref, safeSrc } = sharePage._internal;
    expect(safeHref("javascript:alert(1)")).toBe(null);
    expect(safeHref("  JavaScript:alert(1)")).toBe(null);
    expect(safeHref("https://weidian.com/x")).toBe("https://weidian.com/x");
    expect(safeSrc("data:text/html;base64,PHNjcmlwdD4=")).toBe(null);
    expect(safeSrc("data:image/png;base64,AAAA")).toBe("data:image/png;base64,AAAA");
  });

  it("never renders a javascript: link that reached the database", async () => {
    const sb = fakeSupabase();
    sb.shares.set(CODE, {
      id: CODE,
      user_id: "user-1",
      data: doc({ items: [{ title: "Coat", image: null, link: "javascript:alert(1)" }] }),
    });
    vi.stubGlobal("fetch", sb.fetchMock);

    const html = (await sharePage.handler(get(CODE))).body;
    expect(html).not.toContain("javascript:");
    expect(html).toContain("Coat");
  });

  it("marks seller links nofollow ugc noopener", () => {
    const html = sharePage._internal.itemHtml({
      title: "Coat",
      image: null,
      link: "https://weidian.com/item/1",
    });
    expect(html).toContain('rel="nofollow ugc noopener"');
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe("a miss is always the same miss", () => {
  it("answers 404 for a wrong shape, a missing row, and an expired share", async () => {
    const sb = fakeSupabase();
    sb.shares.set(OTHER, {
      id: OTHER,
      user_id: "user-1",
      data: doc(),
      expires_at: new Date(Date.now() - 1000).toISOString(),
    });
    vi.stubGlobal("fetch", sb.fetchMock);

    const badShape = await sharePage.handler(get("NOT-A-CODE"));
    const missing = await sharePage.handler(get(CODE));
    const expired = await sharePage.handler(get(OTHER));

    expect(badShape.statusCode).toBe(404);
    expect(missing.statusCode).toBe(404);
    expect(expired.statusCode).toBe(404);
    // Identical bodies: the page must not tell a prober which codes exist.
    expect(missing.body).toBe(expired.body);
    expect(badShape.body).toBe(missing.body);
  });

  it("checks the code shape before it queries at all", async () => {
    const fetchSpy = vi.fn(async () => {
      throw new Error("should not be called");
    });
    vi.stubGlobal("fetch", fetchSpy);
    expect((await sharePage.handler(get("short"))).statusCode).toBe(404);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("answers 404 for a document version this deploy does not know", async () => {
    const sb = fakeSupabase();
    sb.shares.set(CODE, { id: CODE, user_id: "user-1", data: { v: 99, items: [] } });
    vi.stubGlobal("fetch", sb.fetchMock);
    expect((await sharePage.handler(get(CODE))).statusCode).toBe(404);
  });

  it("refuses a write method", async () => {
    expect((await sharePage.handler({ httpMethod: "POST", path: "/s/" + CODE })).statusCode).toBe(405);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe("the CDN carries the load, not the function", () => {
  it("caches a hit durably and a miss briefly", async () => {
    const sb = fakeSupabase();
    sb.shares.set(CODE, { id: CODE, user_id: "user-1", data: doc() });
    vi.stubGlobal("fetch", sb.fetchMock);

    const hit = await sharePage.handler(get(CODE));
    const miss = await sharePage.handler(get(OTHER));
    expect(hit.headers["cache-control"]).toContain("durable");
    // A bot walking random codes must not bill a function call per guess.
    expect(miss.headers["cache-control"]).toContain("durable");
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe("the owner's endpoint", () => {
  it("needs an account", async () => {
    vi.stubGlobal("fetch", fakeSupabase().fetchMock);
    expect((await shareApi.handler(apiPost(null, {}))).statusCode).toBe(401);
    expect((await shareApi.handler(apiPost("garbage", {}))).statusCode).toBe(401);
    expect((await shareApi.handler({ httpMethod: "PUT", headers: {} })).statusCode).toBe(405);
  });

  it("creates a share and answers the link", async () => {
    const sb = fakeSupabase();
    vi.stubGlobal("fetch", sb.fetchMock);

    const res = await shareApi.handler(apiPost(tokenFor("user-1"), { code: CODE, doc: doc() }));
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).url).toBe("https://credenzafashion.com/s/" + CODE);
    expect(sb.shares.get(CODE).user_id).toBe("user-1");
  });

  it("refuses a document it cannot trust", async () => {
    vi.stubGlobal("fetch", fakeSupabase().fetchMock);
    const token = tokenFor("user-1");
    const bad = [
      { code: CODE, doc: null },
      { code: CODE, doc: { v: 99, items: [] } },
      { code: "NOPE", doc: doc() },
      { code: CODE, doc: doc({ items: Array.from({ length: 61 }, () => ({ title: "x" })) }) },
    ];
    for (const body of bad) {
      expect((await shareApi.handler(apiPost(token, body))).statusCode).toBe(400);
    }
  });

  it("forces the Pro options off for a free account", async () => {
    const sb = fakeSupabase();
    vi.stubGlobal("fetch", sb.fetchMock);

    // A free share still WORKS — the options are dropped, not refused.
    const res = await shareApi.handler(
      apiPost(tokenFor("free-1"), {
        code: CODE,
        doc: doc(),
        unlisted: true,
        hideFooter: true,
        expiresAt: Date.now() + 86_400_000,
      })
    );
    expect(res.statusCode).toBe(200);
    const row = sb.shares.get(CODE);
    expect(row.unlisted).toBe(false);
    expect(row.hide_footer).toBe(false);
    expect(row.expires_at).toBe(null);
  });

  it("honours the Pro options for a paying account", async () => {
    const sb = fakeSupabase();
    sb.entitlements.set("pro-1", proRecord("pro-1"));
    vi.stubGlobal("fetch", sb.fetchMock);

    const expiresAt = Date.now() + 86_400_000;
    const res = await shareApi.handler(
      apiPost(tokenFor("pro-1"), { code: CODE, doc: doc(), unlisted: true, hideFooter: true, expiresAt })
    );
    expect(res.statusCode).toBe(200);
    const row = sb.shares.get(CODE);
    expect(row.unlisted).toBe(true);
    expect(row.hide_footer).toBe(true);
    expect(Date.parse(row.expires_at)).toBe(expiresAt);
  });

  it("caps how many links a free account keeps", async () => {
    const sb = fakeSupabase();
    for (let i = 0; i < 3; i++) {
      const code = "aaaaaaaaaaa" + "bcd"[i];
      sb.shares.set(code, { id: code, user_id: "free-2", data: doc() });
    }
    vi.stubGlobal("fetch", sb.fetchMock);

    const res = await shareApi.handler(apiPost(tokenFor("free-2"), { code: CODE, doc: doc() }));
    expect(res.statusCode).toBe(409);
    expect(JSON.parse(res.body).error).toContain("Pro");
  });

  it("lists this account's shares and nobody else's", async () => {
    const sb = fakeSupabase();
    sb.shares.set(CODE, { id: CODE, user_id: "user-1", data: doc() });
    sb.shares.set(OTHER, { id: OTHER, user_id: "user-2", data: doc() });
    vi.stubGlobal("fetch", sb.fetchMock);

    const res = await shareApi.handler({
      httpMethod: "GET",
      headers: { authorization: "Bearer " + tokenFor("user-1") },
    });
    const list = JSON.parse(res.body).shares;
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(CODE);
    expect(list[0].title).toBe("Winter haul");
  });

  it("deletes only a share this account owns", async () => {
    const sb = fakeSupabase();
    sb.shares.set(OTHER, { id: OTHER, user_id: "someone-else", data: doc() });
    vi.stubGlobal("fetch", sb.fetchMock);

    const res = await shareApi.handler({
      httpMethod: "DELETE",
      headers: { authorization: "Bearer " + tokenFor("user-1") },
      queryStringParameters: { code: OTHER },
    });
    expect(res.statusCode).toBe(200);
    // The service role bypasses RLS, so the owner filter has to be in the
    // query. Without it this delete would have taken another account's link.
    expect(sb.shares.has(OTHER)).toBe(true);
  });
});
