// The preview relay is the single largest Netlify cost driver: Yupoo refuses
// hotlinks, so every album photo crosses a function at full size, in and out.
// It used to POST, and a POST is never CDN-cacheable, so one pasted album cost
// one invocation per image PER CUSTOMER, every time. These tests pin the two
// fixes: a cacheable GET route, and cache headers the CDN will honour.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { handler } = require("../netlify/functions/preview.js");
const guard = require("../netlify/functions/lib/guard.js");
const limit = require("../netlify/functions/lib/limit.js");

const SECRET = "test-secret";
const IMG = "https://photo.yupoo.com/mook-official/asset0/medium.jpg";
const ALBUM = "https://mook-official.x.yupoo.com/albums/244505824?uid=1";
// A one-pixel JPEG: the SOI marker is what sniffImageMime reads.
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1]);

function get(params = { url: IMG, referer: ALBUM }, secret = SECRET) {
  return { httpMethod: "GET", headers: { "x-credenza-key": secret }, queryStringParameters: params };
}

function post(body = { url: IMG, referer: ALBUM }, secret = SECRET) {
  return { httpMethod: "POST", headers: { "x-credenza-key": secret }, body: JSON.stringify(body) };
}

function imageOk() {
  return {
    ok: true,
    status: 200,
    headers: new Map([["content-type", "image/jpeg"]]),
    arrayBuffer: async () => JPEG,
  };
}

describe("preview relay caching", () => {
  beforeEach(() => {
    process.env.CREDENZA_SEARCH_SECRET = SECRET;
    guard._setLookupForTest(async () => [{ address: "93.184.216.34" }]);
    limit._resetForTest();
    global.fetch = vi.fn(async () => imageOk());
  });

  afterEach(() => {
    delete process.env.CREDENZA_SEARCH_SECRET;
    guard._setLookupForTest(null);
    limit._resetForTest();
    vi.restoreAllMocks();
  });

  it("relays an image over GET, so the CDN can cache it", async () => {
    const res = await handler(get());
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toBe("image/jpeg");
    expect(res.isBase64Encoded).toBe(true);
  });

  it("marks the GET response durable, so one relay serves every edge node", async () => {
    const res = await handler(get());
    const cdn = res.headers["netlify-cdn-cache-control"];
    // `durable` is what puts it in the shared store. Without it each edge node
    // relays the same photo again, and the saving is per-node, not global.
    expect(cdn).toContain("durable");
    expect(cdn).toContain("public");
    expect(cdn).toContain("max-age=604800");
  });

  it("keys the cache on url + referer, not on the API key", async () => {
    // One shared key would make one entry anyway. Leaving it out of the key
    // means a hit never has to look at it.
    const res = await handler(get());
    expect(res.headers["netlify-vary"]).toBe("query=url|referer");
  });

  it("still answers POST, with private headers", async () => {
    // A POST is not CDN-cacheable, so promising a week here would mislead the
    // browser. The old callers keep working; they just do not get the saving.
    const res = await handler(post());
    expect(res.statusCode).toBe(200);
    expect(res.headers["cache-control"]).toBe("private, max-age=300");
    expect(res.headers["netlify-cdn-cache-control"]).toBeUndefined();
  });

  it("caches a not-found briefly, so a dead image cannot bill us on every retry", async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: new Map([["content-type", "text/html"]]),
      arrayBuffer: async () => Buffer.from("<html><body>no images</body></html>", "utf8"),
    }));
    const res = await handler(get({ url: "https://example.com/page" }));
    expect(res.statusCode).toBe(404);
    // Five minutes, not a week: a seller who re-uploads must not stay broken.
    expect(res.headers["netlify-cdn-cache-control"]).toBe("public, durable, max-age=300");
  });

  it("never caches a timeout — that is about the attempt, not about the URL", async () => {
    global.fetch = vi.fn(async () => {
      const err = new Error("aborted");
      err.name = "AbortError";
      throw err;
    });
    const res = await handler(get());
    expect(res.statusCode).toBe(504);
    expect(res.headers["netlify-cdn-cache-control"]).toBeUndefined();
  });

  it("rejects a GET with the wrong key", async () => {
    const res = await handler(get({ url: IMG }, "wrong"));
    expect(res.statusCode).toBe(401);
    expect(res.headers["netlify-cdn-cache-control"]).toBeUndefined();
  });

  it("rejects a GET with no url", async () => {
    expect((await handler(get({}))).statusCode).toBe(400);
  });
});
