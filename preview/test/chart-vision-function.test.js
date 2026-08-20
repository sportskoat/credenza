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
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
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
    const body = JSON.parse(res.body);
    expect(body.error).toMatch(/fetch/i);
    expect(body.diag).toMatchObject({ stage: "fetch" });
  });

  // A one-pixel JPEG. The SOI marker is what the byte check reads, and the
  // length must clear the 12-byte floor. Same fixture as share-image.test.js.
  const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1]);

  function photoReply(contentType, body = JPEG) {
    return {
      ok: true,
      headers: { get: () => contentType },
      arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
    };
  }

  it("reads a real JPEG when the host labels it octet-stream", async () => {
    // Yupoo and Weidian do this. The old label-only check dropped the photo
    // and answered 502 after sign-in, so Fit said there was no chart.
    let sentMedia = null;
    global.fetch = vi.fn(async (url, opts) => {
      if (url === IMG) return photoReply("application/octet-stream");
      const sent = JSON.parse(opts.body);
      sentMedia = sent.messages[0].content[0].source.media_type;
      return anthropicOk({ found: true, chartText: "M 胸围112 衣长70\nL 胸围116 衣长72", note: "" });
    });
    const res = await handler(post());
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).found).toBe(true);
    expect(sentMedia).toBe("image/jpeg");
  });

  it("treats image/jpg as jpeg, and sniffs when the host sends no type", async () => {
    global.fetch = vi.fn(async (url) => {
      if (url === IMG) return photoReply("image/jpg");
      return anthropicOk({ found: true, chartText: "M 胸围112\nL 胸围116", note: "" });
    });
    expect((await handler(post())).statusCode).toBe(200);

    global.fetch = vi.fn(async (url) => {
      if (url === IMG) return photoReply("");
      return anthropicOk({ found: true, chartText: "M 胸围112\nL 胸围116", note: "" });
    });
    expect((await handler(post())).statusCode).toBe(200);
  });

  it("still 502s when the body is not a photo Claude can read", async () => {
    global.fetch = vi.fn(async (url) => {
      if (url === IMG) return photoReply("application/octet-stream", Buffer.from("<html>not a photo</html>"));
      return anthropicOk({ found: false, chartText: "" });
    });
    const res = await handler(post());
    expect(res.statusCode).toBe(502);
    expect(JSON.parse(res.body).diag).toMatchObject({ stage: "fetch" });
  });

  it("asks the photo host for jpeg, not avif", async () => {
    // Claude cannot read avif. Asking for it first made hosts send a type
    // the reader then threw away.
    let photoHeaders = null;
    global.fetch = vi.fn(async (url, opts) => {
      if (url === IMG) {
        photoHeaders = (opts && opts.headers) || {};
        return photoReply("image/jpeg");
      }
      return anthropicOk({ found: false, chartText: "" });
    });
    const res = await handler(post());
    expect(res.statusCode).toBe(200);
    expect(photoHeaders.accept).toMatch(/image\/jpeg/);
    expect(photoHeaders.accept).not.toMatch(/image\/avif/);
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

  it("derives a weidian.com referer for geilicdn images when the client omits one", async () => {
    const WD = "https://si.geilicdn.com/open-abc_100_100.jpg";
    let photoHeaders = null;
    global.fetch = vi.fn(async (url, opts) => {
      if (url === WD) {
        photoHeaders = (opts && opts.headers) || {};
        return {
          ok: true,
          headers: { get: () => "image/jpeg" },
          arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
        };
      }
      return anthropicOk({ found: false, chartText: "" });
    });
    const res = await handler(post([WD]));
    expect(res.statusCode).toBe(200);
    expect(photoHeaders.referer).toBe("https://weidian.com/");
  });

  it("502s with vision diag when Anthropic rejects the key", async () => {
    global.fetch = vi.fn(async (url) => {
      if (url === IMG) {
        return {
          ok: true,
          headers: { get: () => "image/jpeg" },
          arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
        };
      }
      return {
        ok: false,
        status: 401,
        text: async () =>
          JSON.stringify({
            type: "error",
            error: { type: "authentication_error", message: "invalid x-api-key" },
          }),
      };
    });
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await handler(post());
    expect(res.statusCode).toBe(502);
    const body = JSON.parse(res.body);
    expect(body.error).toBe("Chart read failed");
    expect(body.diag).toMatchObject({
      stage: "vision",
      status: 401,
      type: "authentication_error",
    });
    expect(errSpy).toHaveBeenCalled();
    const logged = errSpy.mock.calls.some(
      (c) => typeof c[0] === "string" && c[0].includes("readChartWithClaude non-ok")
    );
    expect(logged).toBe(true);
    errSpy.mockRestore();
  });

  it("rejects non-allowlisted image URLs before any fetch (SSRF lockdown)", async () => {
    global.fetch = vi.fn();
    for (const url of [
      "http://169.254.169.254/latest/meta-data",
      "http://localhost/admin",
      "http://2130706433/", // decimal 127.0.0.1
      "https://evil.example.com/chart.jpg",
      "https://photo.yupoo.com.evil.example.com/x.jpg",
      "https://weidian.com/item.html?itemID=1",
      "javascript:alert(1)",
    ]) {
      const res = await handler(post([url]));
      expect(res.statusCode, url).toBe(400);
    }
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("accepts Weidian geilicdn image hosts (chart photos live there)", async () => {
    const WD = "https://si.geilicdn.com/hz_img_xxx-unadjust_800_800.jpeg";
    global.fetch = vi.fn(async (url) => {
      if (url === WD) {
        return {
          ok: true,
          headers: { get: () => "image/jpeg" },
          arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
        };
      }
      return anthropicOk({
        found: true,
        chartText: "M: 肩宽63 胸围130 衣长64\nL: 肩宽65 胸围136 衣长65",
        note: "",
      });
    });
    const res = await handler(post([WD]));
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.found).toBe(true);
    expect(body.chartText).toContain("胸围130");
  });

  it("skips a photo whose redirect leaves the allowlisted hosts", async () => {
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

  // ── Handoff turn 9 §3: inline photos ──
  // A camera frame has no CDN URL, so the album path cannot serve the customer
  // snapping the chart themselves. `photos` is the second door to the same room.
  const PNG_1PX =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==";

  function postPhotos(photos, secret = SECRET) {
    return {
      httpMethod: "POST",
      headers: { "x-credenza-key": secret },
      body: JSON.stringify({ photos }),
    };
  }

  it("reads a chart from an inline photo without fetching any CDN", async () => {
    const calls = [];
    global.fetch = vi.fn(async (url) => {
      calls.push(url);
      return anthropicOk({ found: true, chartText: "M 胸围112\nL 胸围116", note: "" });
    });
    const res = await handler(
      postPhotos([{ data: PNG_1PX, mediaType: "image/png" }])
    );
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.found).toBe(true);
    expect(body.chartText).toContain("胸围112");
    expect(body.scanned).toBe(1);
    // The server fetched nothing but Anthropic. There is no URL to forge here,
    // which is exactly why the allowlist does not apply to this path.
    expect(calls).toEqual(["https://api.anthropic.com/v1/messages"]);
  });

  it("accepts a whole data: URL, because that is what FileReader produces", async () => {
    let sentMedia = null;
    global.fetch = vi.fn(async (url, opts) => {
      const sent = JSON.parse(opts.body);
      sentMedia = sent.messages[0].content[0].source.media_type;
      return anthropicOk({ found: true, chartText: "M 胸围112", note: "" });
    });
    const res = await handler(postPhotos(["data:image/webp;base64," + PNG_1PX]));
    expect(res.statusCode).toBe(200);
    // The data URL's own type wins: it came from the encoder, while a
    // caller-supplied mediaType field is only a claim.
    expect(sentMedia).toBe("image/webp");
  });

  it("rejects a photo with no usable media type or payload", async () => {
    global.fetch = vi.fn();
    // A media type outside the image allowlist.
    expect((await handler(postPhotos([{ data: PNG_1PX, mediaType: "text/html" }]))).statusCode).toBe(400);
    // Not base64 at all.
    expect((await handler(postPhotos([{ data: "!!!!", mediaType: "image/png" }]))).statusCode).toBe(400);
    // An empty list is the same as no input.
    expect((await handler(postPhotos([]))).statusCode).toBe(400);
    // No Claude call is worth spending on a malformed body.
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("names both doors when neither images nor photos are usable", async () => {
    global.fetch = vi.fn();
    const res = await handler(postPhotos([{ data: "", mediaType: "image/png" }]));
    expect(res.statusCode).toBe(400);
    // A caller who sent `photos` must not be told about CDN URLs alone — they
    // would go looking in the wrong place.
    expect(JSON.parse(res.body).error).toMatch(/images.*photos|photos.*images/i);
  });

  it("puts the customer's own frame before the album photos", async () => {
    // When someone snapped the chart themselves, that photo is the one they
    // mean, and Claude reads the images in order.
    let sentTypes = null;
    global.fetch = vi.fn(async (url, opts) => {
      if (url === IMG) {
        return {
          ok: true,
          headers: { get: () => "image/jpeg" },
          arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
        };
      }
      const sent = JSON.parse(opts.body);
      sentTypes = sent.messages[0].content
        .filter((b) => b.type === "image")
        .map((b) => b.source.media_type);
      return anthropicOk({ found: true, chartText: "M 胸围112", note: "" });
    });
    const req = {
      httpMethod: "POST",
      headers: { "x-credenza-key": SECRET },
      body: JSON.stringify({ images: [IMG], photos: [{ data: PNG_1PX, mediaType: "image/png" }] }),
    };
    const res = await handler(req);
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).scanned).toBe(2);
    expect(sentTypes).toEqual(["image/png", "image/jpeg"]);
  });

  it("caps how many inline frames one request may carry", async () => {
    let count = null;
    global.fetch = vi.fn(async (url, opts) => {
      const sent = JSON.parse(opts.body);
      count = sent.messages[0].content.filter((b) => b.type === "image").length;
      return anthropicOk({ found: true, chartText: "M 胸围112", note: "" });
    });
    const many = Array.from({ length: 8 }, () => ({ data: PNG_1PX, mediaType: "image/png" }));
    const res = await handler(postPhotos(many));
    expect(res.statusCode).toBe(200);
    // Three covers a chart split across two frames plus a retake.
    expect(count).toBe(3);
  });

  it("keeps a body cap that an inline photo can actually fit inside", async () => {
    // The cap moved from 64KB to 2.5MB for §3. A cap below one compressed
    // frame would 413 every snapshot before the parser ever saw it.
    expect(limit.ROUTES["chart-vision"].bodyBytes).toBeGreaterThan(600 * 1024);
    const huge = "A".repeat(limit.ROUTES["chart-vision"].bodyBytes + 10);
    const res = await handler(postPhotos([{ data: huge, mediaType: "image/png" }]));
    expect(res.statusCode).toBe(413);
  });
});

// #40 (Kyle 2026-08-05): "IF ONE PERSON HAS LOOKED AT THIS SPECIFIC LINK AND
// GOT THE CHART, WHY ARE WE WASTING ANOTHER AI CHART READ?" The shared chart
// cache answers a repeat read of the same photo for free, and banks every
// paid read for the next person.
describe("the shared chart cache (#40)", () => {
  const SUPA = "https://supabase.test";
  const CACHED_TEXT = "S 衣长71 胸围110\nM 衣长73 胸围114\nL 衣长75 胸围118";
  // Local copies: the originals are scoped inside the §3 describe above.
  const PNG_1PX_LOCAL =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==";

  function postLocalPhotos(photos) {
    return {
      httpMethod: "POST",
      headers: { "x-credenza-key": SECRET },
      body: JSON.stringify({ photos }),
    };
  }

  // This describe is a sibling of the main one, so it sets up its own world.
  beforeEach(() => {
    process.env.CREDENZA_SEARCH_SECRET = SECRET;
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    guard._setLookupForTest(async () => [{ address: "93.184.216.34" }]);
    limit._resetForTest();
  });

  afterEach(() => {
    delete process.env.CREDENZA_SEARCH_SECRET;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    guard._setLookupForTest(null);
    limit._resetForTest();
    vi.restoreAllMocks();
  });

  function withStore() {
    process.env.SUPABASE_URL = SUPA;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test";
  }

  // One fetch router for all four doors the handler can knock on: the cache
  // read, the cache write, the photo CDN, and Anthropic.
  function mockFetchOver({ cacheRows, cacheGetOk = true, onCacheWrite }) {
    const calls = [];
    global.fetch = vi.fn(async (url, opts) => {
      calls.push({ url, method: (opts && opts.method) || "GET" });
      if (String(url).startsWith(SUPA + "/rest/v1/chart_cache")) {
        if ((opts && opts.method) === "POST") {
          if (onCacheWrite) onCacheWrite(JSON.parse(opts.body));
          return { ok: true, status: 201, json: async () => ({}) };
        }
        if (!cacheGetOk) return { ok: false, status: 500, json: async () => ({}) };
        return { ok: true, json: async () => cacheRows };
      }
      if (url === IMG) {
        return {
          ok: true,
          headers: { get: () => "image/jpeg" },
          arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
        };
      }
      return anthropicOk({ found: true, chartText: CACHED_TEXT, note: "" });
    });
    return calls;
  }

  it("answers a repeat read from the cache — no photo fetch, no Anthropic call", async () => {
    withStore();
    const calls = mockFetchOver({ cacheRows: [{ chart_text: CACHED_TEXT }] });
    const res = await handler(post());
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.found).toBe(true);
    expect(body.chartText).toBe(CACHED_TEXT);
    expect(body.cached).toBe(true);
    expect(calls.some((c) => c.url === IMG)).toBe(false);
    expect(calls.some((c) => String(c.url).includes("api.anthropic.com"))).toBe(false);
  });

  it("banks a paid read so the next reader pays nothing", async () => {
    withStore();
    let written = null;
    mockFetchOver({ cacheRows: [], onCacheWrite: (row) => (written = row) });
    const res = await handler(post());
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).cached).toBeUndefined();
    // The key names the PHOTO — never the album, never the link.
    expect(written).not.toBe(null);
    expect(written.image_key).toBe("yupoo:seller/abc123");
    expect(written.chart_text).toBe(CACHED_TEXT);
  });

  it("never looks up or banks a customer's own camera frame", async () => {
    withStore();
    const calls = mockFetchOver({ cacheRows: [{ chart_text: CACHED_TEXT }] });
    const res = await handler(postLocalPhotos([{ data: PNG_1PX_LOCAL, mediaType: "image/png" }]));
    expect(res.statusCode).toBe(200);
    // The daily-spend counters talk to Supabase on every paid call — that is
    // their job. The pin is narrower: the CHART CACHE never sees a camera
    // frame, not for a lookup and not for a write.
    expect(calls.some((c) => String(c.url).startsWith(SUPA + "/rest/v1/chart_cache"))).toBe(false);
    expect(calls.some((c) => String(c.url).includes("api.anthropic.com"))).toBe(true);
  });

  it("a broken cache never costs a read: it pays and answers anyway", async () => {
    withStore();
    mockFetchOver({ cacheRows: [], cacheGetOk: false });
    const res = await handler(post());
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).found).toBe(true);
  });

  it("does not bank a photo the reader found no chart in", async () => {
    withStore();
    let written = null;
    global.fetch = vi.fn(async (url, opts) => {
      if (String(url).startsWith(SUPA + "/rest/v1/chart_cache")) {
        if ((opts && opts.method) === "POST") {
          written = JSON.parse(opts.body);
          return { ok: true, status: 201, json: async () => ({}) };
        }
        return { ok: true, json: async () => [] };
      }
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
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).found).toBe(false);
    expect(written).toBe(null);
  });
});
