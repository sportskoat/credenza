import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { handler } = require("../netlify/functions/chart-vision.js");
const guard = require("../netlify/functions/lib/guard.js");
const limit = require("../netlify/functions/lib/limit.js");
const SECRET = "test-secret";
const IMG = "https://photo.yupoo.com/seller/abc123/big.jpg";

function post(images = [IMG], secret = SECRET) {
  return {
    httpMethod: "POST",
    headers: { "x-credenza-key": secret },
    body: JSON.stringify({ images }),
  };
}

function anthropicOk(toolInput) {
  return {
    status: 200,
    ok: true,
    json: async () => ({
      content: [{ type: "tool_use", name: "return_size_chart", input: toolInput }],
    }),
  };
}

describe("chart-vision function", () => {
  beforeEach(() => {
    process.env.CREDENZA_SEARCH_SECRET = SECRET;
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    guard._setLookupForTest(async () => [{ address: "93.184.216.34" }]);
    limit._resetForTest();
  });

  afterEach(() => {
    delete process.env.CREDENZA_SEARCH_SECRET;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.CREDENZA_DAILY_COST_CAP_USD;
    guard._setLookupForTest(null);
    limit._resetForTest();
    vi.restoreAllMocks();
  });

  it("rejects wrong auth, bad methods, and non-image URLs", async () => {
    expect((await handler(post([IMG], "nope"))).statusCode).toBe(401);
    expect((await handler({ httpMethod: "GET", headers: { "x-credenza-key": SECRET } })).statusCode).toBe(405);
    expect((await handler(post(["javascript:alert(1)"]))).statusCode).toBe(400);
  });

  it("returns 500 with a clear error when ANTHROPIC_API_KEY is missing", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const res = await handler(post());
    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body).error).toMatch(/ANTHROPIC_API_KEY/);
  });

  it("fetches album photos server-side and returns the transcribed chart", async () => {
    const calls = [];
    global.fetch = vi.fn(async (url) => {
      calls.push(url);
      if (url === IMG) {
        return {
          ok: true,
          headers: { get: () => "image/jpeg" },
          arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
        };
      }
      return anthropicOk({ found: true, chartText: "M 胸围112 衣长70\nL 胸围116 衣长72", note: "" });
    });
    const res = await handler(post());
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.found).toBe(true);
    expect(body.chartText).toContain("胸围112");
    expect(body.scanned).toBe(1);
    expect(calls).toContain("https://api.anthropic.com/v1/messages");
  });

  it("reports found:false when no photo holds a chart", async () => {
    global.fetch = vi.fn(async (url) => {
      if (url === IMG) {
        return {
          ok: true,
          headers: { get: () => "image/jpeg" },
          arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
        };
      }
      return anthropicOk({ found: false, chartText: "" });
    });
    const res = await handler(post());
    const body = JSON.parse(res.body);
    expect(res.statusCode).toBe(200);
    expect(body.found).toBe(false);
  });

  it("502s when every photo fetch fails", async () => {
    global.fetch = vi.fn(async () => ({ ok: false, headers: { get: () => null } }));
    const res = await handler(post());
    expect(res.statusCode).toBe(502);
  });

  it("sends the album page as referer when the client provides one", async () => {
    // The yupoo photo CDN 567-blocks requests whose referer is not an album
    // page — this header is what makes the whole function work live.
    let photoHeaders = null;
    global.fetch = vi.fn(async (url, opts) => {
      if (url === IMG) {
        photoHeaders = (opts && opts.headers) || {};
        return {
          ok: true,
          headers: { get: () => "image/jpeg" },
          arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
        };
      }
      return anthropicOk({ found: false, chartText: "" });
    });
    const req = post();
    req.body = JSON.stringify({ images: [IMG], referer: "https://seller.x.yupoo.com/albums/123?uid=1" });
    const res = await handler(req);
    expect(res.statusCode).toBe(200);
    expect(photoHeaders.referer).toBe("https://seller.x.yupoo.com/albums/123?uid=1");
    expect(photoHeaders["user-agent"]).toContain("CredenzaPreview/1.0");
  });

  it("derives a seller-subdomain referer from photo.yupoo.com paths", async () => {
    let photoHeaders = null;
    global.fetch = vi.fn(async (url, opts) => {
      if (url === IMG) {
        photoHeaders = (opts && opts.headers) || {};
        return {
          ok: true,
          headers: { get: () => "image/jpeg" },
          arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
        };
      }
      return anthropicOk({ found: false, chartText: "" });
    });
    const res = await handler(post());
    expect(res.statusCode).toBe(200);
    expect(photoHeaders.referer).toBe("https://seller.x.yupoo.com/");
  });

  it("rejects non-Yupoo image URLs before any fetch (SSRF lockdown)", async () => {
    global.fetch = vi.fn();
    for (const url of [
      "http://169.254.169.254/latest/meta-data",
      "http://localhost/admin",
      "http://2130706433/", // decimal 127.0.0.1
      "https://evil.example.com/chart.jpg",
      "https://photo.yupoo.com.evil.example.com/x.jpg",
    ]) {
      const res = await handler(post([url]));
      expect(res.statusCode, url).toBe(400);
    }
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("skips a photo whose redirect leaves the Yupoo hosts", async () => {
    global.fetch = vi.fn(async () => ({
      status: 302,
      ok: false,
      headers: { get: () => "http://169.254.169.254/latest/meta-data" },
    }));
    const res = await handler(post());
    // The only photo was dropped → nothing to scan.
    expect(res.statusCode).toBe(502);
  });

  it("returns 429 once the per-IP window is drained", async () => {
    global.fetch = vi.fn(async (url) =>
      url === IMG
        ? {
            ok: true,
            headers: { get: () => "image/jpeg" },
            arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
          }
        : anthropicOk({ found: false, chartText: "" })
    );
    const cap = limit.ROUTES["chart-vision"].perIpPerMin;
    for (let i = 0; i < cap; i++) {
      expect((await handler(post())).statusCode).toBe(200);
    }
    const res = await handler(post());
    expect(res.statusCode).toBe(429);
    expect(res.headers["retry-after"]).toBeTruthy();
  });

  it("stops above the daily cost ceiling without calling Anthropic", async () => {
    process.env.CREDENZA_DAILY_COST_CAP_USD = "0.005";
    limit.recordUsage("chart-vision", "claude-haiku-4-5", { input_tokens: 100000, output_tokens: 1000 });
    global.fetch = vi.fn();
    const res = await handler(post());
    expect(res.statusCode).toBe(429);
    expect(JSON.parse(res.body).error).toMatch(/cost ceiling/);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
