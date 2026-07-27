import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { serializeAskCandidates } from "../../credenza-search-fashion.js";

const require = createRequire(import.meta.url);
const { handler } = require("../netlify/functions/ask.js");
const limit = require("../netlify/functions/lib/limit.js");

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const SECRET = "test-secret";
const ASK_SOURCE = readFileSync(join(ROOT, "preview/netlify/functions/ask.js"), "utf8");

// LB-56. netlify/functions/ask.js opens with the claim "Mirror of the
// client-side serializeAskCandidates bounds". It was not a mirror. The client
// sent twenty fields and the function kept eleven of them, so seller, batch,
// size, colorway, agentLink, findSource, findStatus, ageDays and importance
// reached the boundary and were dropped before the model ever saw them.
//
// The cost was not theoretical. /how/ sells Ask with exactly two example
// questions, "what is still in Want under $40" and "which items are waiting on
// QC". The first needs a price and the second needs findStatus, and neither
// value crossed the wire. Both advertised questions were unanswerable.
//
// These tests exist so that comment stops being aspirational. Add a field to
// the client serializer and this file fails until the function accepts it.

// The one field the function allows that the client does not send. Keeping it
// is deliberate: /.netlify/functions/ask is a public endpoint, and a URL is
// both harmless and useful if a future caller supplies one. Any OTHER
// server-only field is drift and must fail this list, not be added to it.
const SERVER_ONLY = ["url"];

function askAllowedFields() {
  // Read the three declarations out of the source rather than exporting them.
  // ask.js is a Netlify function, not a library; widening its exports so a test
  // can look inside would change the shipped module to suit the test.
  const grab = (name) => {
    const match = ASK_SOURCE.match(new RegExp(`const ${name} = \\{([\\s\\S]*?)\\};`));
    if (!match) throw new Error(`${name} not found in ask.js`);
    // Strip comments first. A declaration explained in prose above it would
    // otherwise contribute its own words as field names.
    const body = match[1].replace(/\/\/.*$/gm, "");
    return [...body.matchAll(/(\w+)\s*:/g)].map((hit) => hit[1]);
  };
  return new Set([...grab("FIELD_LIMITS"), ...grab("LIST_LIMITS"), ...grab("NUMBER_FIELDS")]);
}

function clientFields() {
  const [card] = serializeAskCandidates("jacket", [
    {
      id: "a",
      title: "Arcteryx shell",
      summary: "hardshell",
      tags: ["outer"],
      note: "sized up",
      extractedIntent: "buy",
      project: "winter",
      people: ["kyle"],
      useCase: "rain",
      seller: "Top Fashion",
      batch: "PK",
      size: "L",
      colorway: "black",
      agentLink: "https://cnfans.com/x",
      findSource: "reddit",
      findStatus: "qc",
      host: "weidian.com",
      type: "link",
      price: 299,
      currency: "CNY",
      importance: "high",
      createdAt: 0,
    },
  ], { now: 0 });
  return Object.keys(card);
}

describe("LB-56 · the Ask boundary mirrors the client serializer", () => {
  it("accepts every field the client serializer sends", () => {
    const allowed = askAllowedFields();
    const missing = clientFields().filter((field) => !allowed.has(field));
    expect(missing).toEqual([]);
  });

  it("allows no server-side field the client never sends, except the listed one", () => {
    const sent = new Set(clientFields());
    const extra = [...askAllowedFields()].filter((field) => !sent.has(field));
    expect(extra.sort()).toEqual([...SERVER_ONLY].sort());
  });

  it("names every shelf field in the system prompt vocabulary", () => {
    // A code like "gl" or a bare number is not self-describing. If the boundary
    // forwards a field, the prompt has to say what it means, or the model is
    // guessing at the exact question the marketing page promises to answer.
    const prompt = ASK_SOURCE.slice(ASK_SOURCE.indexOf("Field key."), ASK_SOURCE.indexOf("Treat a question"));
    for (const field of ["findStatus", "priceUsd", "ageDays", "importance", "seller", "batch", "size", "colorway"]) {
      expect(prompt).toContain(field);
    }
    for (const status of ["want", "bought", "shipped", "qc", "gl", "rl", "returned"]) {
      expect(prompt).toMatch(new RegExp(`\\b${status}\\b`));
    }
  });
});

describe("LB-56 · the two questions /how/ advertises reach the model", () => {
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = "sk-test";
    process.env.CREDENZA_SEARCH_SECRET = SECRET;
    limit._resetForTest();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        content: [{ type: "tool_use", name: "return_credenza_matches", input: { results: [], answer: "none" } }],
      }),
    });
  });

  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.CREDENZA_SEARCH_SECRET;
    limit._resetForTest();
    vi.restoreAllMocks();
  });

  async function forwardedShelf(item) {
    const res = await handler({
      httpMethod: "POST",
      headers: { "x-credenza-key": SECRET },
      body: JSON.stringify({ query: "what is still in want under $40", shelf: [item] }),
    });
    expect(res.statusCode).toBe(200);
    const sent = JSON.parse(global.fetch.mock.calls[0][1].body);
    const text = sent.messages[0].content;
    return JSON.parse(text.slice(text.indexOf("[{")))[0];
  }

  it("forwards findStatus, priceUsd and ageDays instead of dropping them", async () => {
    const card = await forwardedShelf({
      id: "a",
      title: "Nike tee",
      findStatus: "qc",
      priceUsd: 38.5,
      ageDays: 12,
      seller: "Top Fashion",
      batch: "PK",
      size: "L",
      colorway: "black",
      importance: "high",
      agentLink: "https://cnfans.com/x",
      findSource: "reddit",
    });
    expect(card.findStatus).toBe("qc");
    expect(card.priceUsd).toBe(38.5);
    expect(card.ageDays).toBe(12);
    expect(card.seller).toBe("Top Fashion");
    expect(card.importance).toBe("high");
  });

  it("bounds the two numbers a hostile client controls", async () => {
    const card = await forwardedShelf({
      id: "a",
      title: "t",
      priceUsd: 9e12,
      ageDays: -5,
    });
    expect(card.priceUsd).toBe(1000000);
    expect(card.ageDays).toBe(0);
  });

  it("omits a price that is absent or not a number", async () => {
    const card = await forwardedShelf({ id: "a", title: "t", priceUsd: null, ageDays: "soon" });
    expect(card).not.toHaveProperty("priceUsd");
    expect(card).not.toHaveProperty("ageDays");
  });
});

describe("LB-56 · one fallback rate, three copies", () => {
  // credenza-fashion.jsx imports credenza-search-fashion.js, so the search
  // module cannot import back from it, and resolve.js is a CJS Netlify
  // function. The constant is duplicated on purpose. This pins the copies so a
  // shelf total and an Ask answer can never quote two different dollar figures
  // for the same item.
  const FILES = [
    "credenza-fashion.jsx",
    "credenza-search-fashion.js",
    "preview/netlify/functions/resolve.js",
  ];

  it("declares the same USD per CNY rate in all three places", () => {
    const rates = FILES.map((file) => {
      const source = readFileSync(join(ROOT, file), "utf8");
      const match = source.match(/FX_FALLBACK_USD_PER_CNY = ([0-9.]+)/);
      expect(match, `FX_FALLBACK_USD_PER_CNY missing from ${file}`).toBeTruthy();
      return match[1];
    });
    expect(new Set(rates).size, `rates differ: ${rates.join(", ")}`).toBe(1);
  });

  it("converts a CNY price with that rate", () => {
    const [card] = serializeAskCandidates("tee", [
      { id: "a", title: "tee", price: 299, currency: "CNY", createdAt: 0 },
    ], { now: 0 });
    expect(card.priceUsd).toBe(41.86);
  });

  it("passes a USD price through and refuses to invent one", () => {
    const [usd] = serializeAskCandidates("tee", [
      { id: "a", title: "tee", price: 40, currency: "USD", createdAt: 0 },
    ], { now: 0 });
    expect(usd.priceUsd).toBe(40);

    const [unknown] = serializeAskCandidates("tee", [
      { id: "a", title: "tee", price: 40, currency: "KRW", createdAt: 0 },
    ], { now: 0 });
    expect(unknown.priceUsd).toBe(null);
  });
});
