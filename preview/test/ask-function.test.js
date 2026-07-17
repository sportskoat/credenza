import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { handler } = require("../netlify/functions/ask.js");

const SECRET = "test-secret";

function post(body, headers = {}) {
  return {
    httpMethod: "POST",
    headers: { "x-credenza-key": SECRET, ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  };
}

function anthropicOk(toolInput) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      content: [{ type: "tool_use", name: "return_credenza_matches", input: toolInput }],
    }),
  };
}

describe("ask function boundary", () => {
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = "sk-test";
    process.env.CREDENZA_SEARCH_SECRET = SECRET;
    global.fetch = vi.fn();
  });

  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.CREDENZA_SEARCH_SECRET;
    vi.restoreAllMocks();
  });

  it("refuses when unconfigured", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const res = await handler(post({ query: "q", shelf: [] }));
    expect(res.statusCode).toBe(500);
  });

  it("rejects a missing or wrong secret", async () => {
    const res = await handler(post({ query: "q", shelf: [] }, { "x-credenza-key": "wrong" }));
    expect(res.statusCode).toBe(401);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("rejects non-POST, bad JSON, and shapeless input", async () => {
    expect((await handler({ httpMethod: "GET", headers: { "x-credenza-key": SECRET } })).statusCode).toBe(405);
    expect((await handler(post("{nope"))).statusCode).toBe(400);
    expect((await handler(post({ query: "", shelf: [] }))).statusCode).toBe(400);
    expect((await handler(post({ query: "q", shelf: "no" }))).statusCode).toBe(400);
    expect((await handler(post({ query: "q", shelf: [{ noId: true }] }))).statusCode).toBe(400);
  });

  it("rejects more than 25 shelf items", async () => {
    const shelf = Array.from({ length: 26 }, (_, i) => ({ id: "i" + i }));
    const res = await handler(post({ query: "q", shelf }));
    expect(res.statusCode).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("clamps oversized fields and strips unknown ones before calling Anthropic", async () => {
    global.fetch.mockResolvedValue(anthropicOk({ results: [], answer: "none" }));
    const shelf = [
      {
        id: "a",
        title: "t".repeat(1000),
        note: "n".repeat(5000),
        image: "data:huge-thumbnail",
        secretField: "should never leave the client",
        tags: Array.from({ length: 40 }, (_, i) => "tag" + i),
      },
    ];
    const res = await handler(post({ query: "find it", shelf }));
    expect(res.statusCode).toBe(200);
    const sent = JSON.parse(global.fetch.mock.calls[0][1].body);
    const sentShelf = JSON.parse(sent.messages[0].content.split("Compact shelf:\n")[1]);
    expect(sentShelf[0].title.length).toBeLessThanOrEqual(160);
    expect(sentShelf[0].note.length).toBeLessThanOrEqual(500);
    expect(sentShelf[0].tags).toHaveLength(8);
    expect(sentShelf[0]).not.toHaveProperty("image");
    expect(sentShelf[0]).not.toHaveProperty("secretField");
  });

  it("accepts only result ids that exist on the sent shelf", async () => {
    global.fetch.mockResolvedValue(
      anthropicOk({ results: [{ id: "ghost", why: "made up" }], answer: "hm" })
    );
    const res = await handler(post({ query: "q", shelf: [{ id: "real" }] }));
    expect(res.statusCode).toBe(502);
  });

  it("passes through a valid structured response", async () => {
    global.fetch.mockResolvedValue(
      anthropicOk({ results: [{ id: "real", why: "matches" }], answer: "found it" })
    );
    const res = await handler(post({ query: "q", shelf: [{ id: "real", title: "hi" }] }));
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({
      results: [{ id: "real", why: "matches" }],
      answer: "found it",
    });
  });

  it("maps Anthropic failures to distinct statuses", async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 429, json: async () => ({}) });
    expect((await handler(post({ query: "q", shelf: [{ id: "a" }] }))).statusCode).toBe(429);
    global.fetch.mockRejectedValue(Object.assign(new Error("x"), { name: "TypeError" }));
    expect((await handler(post({ query: "q", shelf: [{ id: "a" }] }))).statusCode).toBe(502);
  });
});
