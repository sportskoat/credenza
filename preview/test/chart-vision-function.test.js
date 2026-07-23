import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { handler } = require("../netlify/functions/chart-vision.js");
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
  });

  afterEach(() => {
    delete process.env.CREDENZA_SEARCH_SECRET;
    delete process.env.ANTHROPIC_API_KEY;
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
});
