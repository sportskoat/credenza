import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const limit = require("../netlify/functions/lib/limit.js");

describe("rate limits", () => {
  beforeEach(() => limit._resetForTest());
  afterEach(() => {
    limit._resetForTest();
    delete process.env.CREDENZA_DAILY_COST_CAP_USD;
  });

  it("stops a single address past the per-IP window", () => {
    const cfg = limit.ROUTES.resolve;
    for (let i = 0; i < cfg.perIpPerMin; i++) {
      expect(limit.enter("resolve", "1.2.3.4")).toBeNull();
      limit.leave("resolve");
    }
    const blocked = limit.enter("resolve", "1.2.3.4");
    expect(blocked.status).toBe(429);
    expect(blocked.retryAfter).toBeGreaterThan(0);
    // Another address still gets in.
    expect(limit.enter("resolve", "5.6.7.8")).toBeNull();
    limit.leave("resolve");
  });

  it("stops everyone past the per-route window", () => {
    const cfg = limit.ROUTES.resolve;
    for (let i = 0; i < cfg.routePerMin; i++) {
      expect(limit.enter("resolve", "ip-" + i)).toBeNull();
      limit.leave("resolve");
    }
    expect(limit.enter("resolve", "fresh-ip").status).toBe(429);
  });

  it("caps concurrent requests until a slot frees", () => {
    const cfg = limit.ROUTES["chart-vision"];
    for (let i = 0; i < cfg.maxConcurrent; i++) {
      expect(limit.enter("chart-vision", "ip-" + i)).toBeNull();
    }
    const blocked = limit.enter("chart-vision", "ip-extra");
    expect(blocked.status).toBe(429);
    expect(blocked.msg).toMatch(/Busy/);
    limit.leave("chart-vision");
    expect(limit.enter("chart-vision", "ip-extra")).toBeNull();
    for (let i = 0; i <= cfg.maxConcurrent; i++) limit.leave("chart-vision");
  });

  it("flags oversized bodies per route", () => {
    const event = { body: "x".repeat(9 * 1024) };
    expect(limit.bodyTooLarge(event, "resolve")).toBe(true); // 8 KB cap
    expect(limit.bodyTooLarge(event, "ask")).toBe(false); // 64 KB cap
    expect(limit.bodyTooLarge({ body: null }, "ask")).toBe(false);
  });
});

describe("daily cost ceiling", () => {
  beforeEach(() => limit._resetForTest());
  afterEach(() => {
    limit._resetForTest();
    delete process.env.CREDENZA_DAILY_COST_CAP_USD;
  });

  it("prices usage by model and accumulates", () => {
    const cost = limit.recordUsage("ask", "claude-sonnet-5", { input_tokens: 1000, output_tokens: 500 });
    // (1000*3 + 500*15) / 1e6 = 0.0105
    expect(cost).toBeCloseTo(0.0105, 6);
    expect(limit._dailyForTest().costUsd).toBeCloseTo(0.0105, 6);
    limit.recordUsage("resolve", "claude-haiku-4-5", { input_tokens: 1e6, output_tokens: 0 });
    expect(limit._dailyForTest().costUsd).toBeCloseTo(1.0105, 4);
  });

  it("charges the flat fallback when usage is missing", () => {
    const cost = limit.recordUsage("ask", "claude-sonnet-5", undefined);
    expect(cost).toBeGreaterThan(0);
  });

  it("stops paid routes above the ceiling, unpaid routes still run", () => {
    process.env.CREDENZA_DAILY_COST_CAP_USD = "0.02";
    limit.recordUsage("ask", "claude-sonnet-5", { input_tokens: 100000, output_tokens: 100000 });
    const blocked = limit.enter("ask", "1.2.3.4");
    expect(blocked.status).toBe(429);
    expect(blocked.msg).toMatch(/cost ceiling/);
    expect(limit.enter("chart-vision", "1.2.3.4")).not.toBeNull();
    // Unpaid routes are not cost-gated.
    expect(limit.enter("yupoo", "1.2.3.4")).toBeNull();
    limit.leave("yupoo");
  });

  it("honors the default cap when the env value is garbage", () => {
    process.env.CREDENZA_DAILY_COST_CAP_USD = "banana";
    limit.recordUsage("ask", "claude-sonnet-5", { input_tokens: 1e6, output_tokens: 1e6 }); // $18
    expect(limit.enter("ask", "1.2.3.4").status).toBe(429);
  });
});

describe("clientKey", () => {
  it("prefers the Netlify IP header, then the first forwarded hop", () => {
    expect(limit.clientKey({ headers: { "x-nf-client-connection-ip": "9.9.9.9" } })).toBe("9.9.9.9");
    expect(limit.clientKey({ headers: { "x-forwarded-for": "1.1.1.1, 2.2.2.2" } })).toBe("1.1.1.1");
    expect(limit.clientKey({ headers: {} })).toBe("unknown");
  });
});
