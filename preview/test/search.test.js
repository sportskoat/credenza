import { describe, it, expect } from "vitest";
import {
  tokenizeQuery,
  buildSearchDocument,
  scoreSearchCandidate,
  searchItems,
  selectAskCandidates,
  serializeAskCandidates,
} from "../../credenza-search.js";

const shelf = [
  {
    id: "yupoo",
    title: "Jordan 4 haul album",
    url: "https://x.yupoo.com/albums/123",
    host: "x.yupoo.com",
    type: "link",
    links: [
      { url: "https://x.yupoo.com/albums/123", role: "photos" },
      { url: "https://weidian.com/item.html?itemID=9", role: "buy" },
    ],
    createdAt: 100,
  },
  {
    id: "note",
    title: "Gift ideas",
    type: "note",
    note: "vinyl record for dad's birthday in september",
    rawText: "vinyl record for dad's birthday in september",
    createdAt: 200,
  },
  {
    id: "video",
    title: "KRK monitor placement guide",
    url: "https://youtube.com/watch?v=abc",
    host: "youtube.com",
    type: "video",
    tags: ["audio", "studio"],
    project: "studio setup",
    createdAt: 300,
  },
];

describe("tokenizeQuery", () => {
  it("drops stopwords and short fragments", () => {
    expect(tokenizeQuery("what was the video about studio monitors")).toEqual([
      "studio",
      "monitors",
    ]);
  });

  it("handles empty and null queries", () => {
    expect(tokenizeQuery("")).toEqual([]);
    expect(tokenizeQuery(null)).toEqual([]);
  });
});

describe("multi-word realistic queries (the old includes(wholeQuery) bug)", () => {
  it("finds items when the exact phrase appears nowhere", () => {
    const results = searchItems(shelf, "birthday gift for dad");
    expect(results.map((i) => i.id)).toContain("note");
  });

  it("matches across fields, not only within one", () => {
    const results = searchItems(shelf, "studio monitor video");
    expect(results[0].id).toBe("video");
  });
});

describe("buildSearchDocument", () => {
  it("includes paired link urls and roles", () => {
    const doc = buildSearchDocument(shelf[0]);
    expect(doc).toContain("weidian.com");
    expect(doc).toContain("buy");
    expect(doc).toContain("photos");
  });
});

describe("searchItems", () => {
  it("returns all items for an empty query", () => {
    expect(searchItems(shelf, "")).toHaveLength(3);
  });

  it("returns nothing for a query matching no item", () => {
    expect(searchItems(shelf, "quantum sailboat")).toHaveLength(0);
  });

  it("ranks stronger matches first and is stable on ties", () => {
    const a = { id: "a", title: "coffee", createdAt: 1 };
    const b = { id: "b", title: "coffee", createdAt: 2 };
    const first = searchItems([a, b], "coffee");
    const second = searchItems([a, b], "coffee");
    expect(first.map((i) => i.id)).toEqual(second.map((i) => i.id));
  });

  it("finds items by url host", () => {
    expect(searchItems(shelf, "yupoo").map((i) => i.id)).toContain("yupoo");
  });
});

describe("scoreSearchCandidate", () => {
  it("scores zero for an empty query", () => {
    expect(scoreSearchCandidate(shelf[0], "")).toBe(0);
  });

  it("boosts whole-phrase matches over token matches", () => {
    const phrase = scoreSearchCandidate(shelf[2], "krk monitor placement guide");
    const scattered = scoreSearchCandidate(shelf[2], "guide placement");
    expect(phrase).toBeGreaterThan(scattered);
  });
});

describe("selectAskCandidates / serializeAskCandidates", () => {
  const bigShelf = Array.from({ length: 60 }, (_, i) => ({
    id: "item-" + i,
    title: "coffee brewing method " + i,
    createdAt: i,
  }));

  it("caps candidates at the limit", () => {
    expect(selectAskCandidates("coffee", bigShelf, 25)).toHaveLength(25);
  });

  it("falls back to newest items when nothing matches", () => {
    const picked = selectAskCandidates("zzz-no-match", bigShelf, 5);
    expect(picked).toHaveLength(5);
    expect(picked[0].id).toBe("item-59");
  });

  it("serializes at most 25 length-capped cards", () => {
    const long = "x".repeat(2000);
    const noisy = bigShelf.map((item) => ({ ...item, note: long, summary: long }));
    const cards = serializeAskCandidates("coffee", noisy, { now: 1000 * 864e5 });
    expect(cards).toHaveLength(25);
    for (const card of cards) {
      expect(card.note.length).toBeLessThanOrEqual(500);
      expect(card.summary.length).toBeLessThanOrEqual(360);
      expect(card).not.toHaveProperty("image");
      expect(card).not.toHaveProperty("rawText");
    }
  });

  it("computes ageDays from createdAt and defaults importance", () => {
    const [card] = serializeAskCandidates("gift", [shelf[1]], { now: 200 + 3 * 864e5 });
    expect(card.ageDays).toBe(3);
    expect(card.importance).toBe("medium");
  });
});
