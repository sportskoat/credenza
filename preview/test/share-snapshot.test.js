// LB-8: what a shared haul link contains.
//
// The one rule worth most of these tests: a toggled-off field must be ABSENT
// from the snapshot, not merely unrendered. The server prints what it is
// given, so anything that reaches this document reaches the public page.

import { describe, it, expect } from "vitest";
import {
  SHARE_DOC_VERSION,
  SHARE_FIELDS,
  SHARE_MAX_ITEMS,
  DEFAULT_SHARE_FIELDS,
  buildShareSnapshot,
  parseShareSnapshot,
  makeShareCode,
  isShareCode,
  isExpired,
  expiryFromDays,
  shareUrl,
} from "../../credenza-share.js";

const T0 = 1_700_000_000_000;

const item = (extra = {}) => ({
  id: "a1",
  title: "Black cargo pants",
  image: "https://img.example.com/a1.jpg",
  url: "https://weidian.com/item.html?itemID=7376",
  priceUsd: 32.5,
  note: "waist runs small",
  seller: "Miumiu Store",
  batch: "LJR",
  qcPhotos: ["data:image/jpeg;base64,aaa", "data:image/jpeg;base64,bbb"],
  weightGrams: 620,
  size: "XL",
  colorway: "black",
  ...extra,
});

const ON = Object.fromEntries(SHARE_FIELDS.map((f) => [f, true]));

describe("the default share shows clothes and nothing else", () => {
  it("carries photos and titles with no toggles set", () => {
    const doc = buildShareSnapshot([item()], { now: T0 });
    expect(doc.items).toHaveLength(1);
    expect(doc.items[0].title).toBe("Black cargo pants");
    expect(doc.items[0].image).toBe("https://img.example.com/a1.jpg");
  });

  it("omits every optional field", () => {
    const doc = buildShareSnapshot([item()], { now: T0 });
    const card = doc.items[0];
    for (const key of ["priceUsd", "note", "seller", "batch", "qcCount", "weightGrams"]) {
      expect(card).not.toHaveProperty(key);
    }
    expect(doc).not.toHaveProperty("totalUsd");
  });

  it("defaults every toggle to off, so no field leaks by forgetting", () => {
    for (const key of SHARE_FIELDS) expect(DEFAULT_SHARE_FIELDS[key]).toBe(false);
  });

  it("treats any non-true value as off, not as truthy", () => {
    const doc = buildShareSnapshot([item()], { now: T0, fields: { prices: 1, notes: "yes" } });
    expect(doc.items[0]).not.toHaveProperty("priceUsd");
    expect(doc.items[0]).not.toHaveProperty("note");
  });
});

describe("each toggle adds exactly its own field", () => {
  it("prices adds the amount and the haul total", () => {
    const doc = buildShareSnapshot([item(), item({ id: "a2", priceUsd: 10 })], {
      now: T0,
      fields: { prices: true },
    });
    expect(doc.items[0].priceUsd).toBe(32.5);
    expect(doc.totalUsd).toBe(42.5);
    expect(doc.items[0]).not.toHaveProperty("seller");
  });

  it("quality sends the QC count, never the QC photos", () => {
    // The buyer's own pictures of their own parcel. Publishing them by
    // default is not ours to do.
    const doc = buildShareSnapshot([item()], { now: T0, fields: { quality: true } });
    expect(doc.items[0].qcCount).toBe(2);
    expect(JSON.stringify(doc)).not.toContain("base64");
  });

  it("sellers, notes and parcel each add one field", () => {
    expect(buildShareSnapshot([item()], { now: T0, fields: { sellers: true } })[
      "items"
    ][0].seller).toBe("Miumiu Store");
    expect(buildShareSnapshot([item()], { now: T0, fields: { notes: true } }).items[0].note).toBe(
      "waist runs small"
    );
    expect(buildShareSnapshot([item()], { now: T0, fields: { parcel: true } }).items[0].weightGrams).toBe(620);
  });

  it("records which toggles were on, so the page can say what it omits", () => {
    const doc = buildShareSnapshot([item()], { now: T0, fields: { prices: true } });
    expect(doc.fields.prices).toBe(true);
    expect(doc.fields.sellers).toBe(false);
  });
});

describe("nothing dangerous reaches an href", () => {
  it("drops a javascript: link rather than passing it through", () => {
    const doc = buildShareSnapshot([item({ url: "javascript:alert(1)", agentLink: "" })], { now: T0 });
    expect(doc.items[0]).not.toHaveProperty("link");
  });

  it("drops a data: URL used as a link", () => {
    const doc = buildShareSnapshot([item({ url: "data:text/html,<script>x</script>", agentLink: "" })], {
      now: T0,
    });
    expect(doc.items[0]).not.toHaveProperty("link");
  });

  it("keeps a data: image, which is a real shelf thumbnail", () => {
    const doc = buildShareSnapshot([item({ image: "data:image/jpeg;base64,zzz" })], { now: T0 });
    expect(doc.items[0].image).toBe("data:image/jpeg;base64,zzz");
  });

  it("refuses a script: image source", () => {
    const doc = buildShareSnapshot([item({ image: "javascript:alert(1)" })], { now: T0 });
    expect(doc.items[0].image).toBe(null);
  });

  it("prefers the agent link over the raw seller link", () => {
    const doc = buildShareSnapshot([item({ agentLink: "https://cnfans.com/product/?id=7376" })], { now: T0 });
    expect(doc.items[0].link).toBe("https://cnfans.com/product/?id=7376");
  });
});

describe("the document stays a size a page can serve", () => {
  it("caps the card count and says it truncated", () => {
    const many = Array.from({ length: SHARE_MAX_ITEMS + 5 }, (_, i) => item({ id: "x" + i }));
    const doc = buildShareSnapshot(many, { now: T0 });
    expect(doc.items).toHaveLength(SHARE_MAX_ITEMS);
    expect(doc.truncated).toBe(true);
    expect(doc.count).toBe(SHARE_MAX_ITEMS);
  });

  it("does not claim truncation when everything fit", () => {
    expect(buildShareSnapshot([item()], { now: T0 }).truncated).toBe(false);
  });

  it("drops inline photos rather than cards when over the byte budget", () => {
    const fat = "data:image/jpeg;base64," + "A".repeat(4000);
    const list = Array.from({ length: 5 }, (_, i) => item({ id: "f" + i, image: fat }));
    const doc = buildShareSnapshot(list, { now: T0, maxBytes: 9000 });
    expect(doc.items).toHaveLength(5);
    expect(JSON.stringify(doc).length).toBeLessThanOrEqual(9000);
    // The first card keeps its photo; the tail loses theirs.
    expect(doc.items[0].image).toBe(fat);
    expect(doc.items[4].image).toBe(null);
  });

  it("skips a card with neither a title nor a photo", () => {
    const doc = buildShareSnapshot([item({ title: "", image: null }), item()], { now: T0 });
    expect(doc.items).toHaveLength(1);
  });

  it("counts only the shared cards, so the page never claims more than it shows", () => {
    const doc = buildShareSnapshot([item(), item({ id: "b", title: "", image: null })], { now: T0 });
    expect(doc.count).toBe(1);
  });
});

describe("reading a stored document back", () => {
  it("round-trips through JSON", () => {
    const doc = buildShareSnapshot([item()], { now: T0, fields: ON });
    expect(parseShareSnapshot(JSON.stringify(doc))).toEqual(doc);
  });

  it("refuses anything it cannot trust", () => {
    for (const bad of [null, undefined, "", "not json", 0, [], [1], {}, { v: 1 }, { v: 99, items: [] }]) {
      expect(parseShareSnapshot(bad)).toBe(null);
    }
  });

  it("refuses a future version rather than guessing at its shape", () => {
    expect(parseShareSnapshot({ v: SHARE_DOC_VERSION + 1, items: [] })).toBe(null);
  });
});

describe("the code is the access control", () => {
  const crypto = {
    getRandomValues(buf) {
      for (let i = 0; i < buf.length; i++) buf[i] = (i * 37 + 11) % 256;
      return buf;
    },
  };

  it("makes a code of the documented shape", () => {
    expect(isShareCode(makeShareCode(crypto))).toBe(true);
  });

  it("refuses to run without a real random source", () => {
    // Math.random would make a guessable link, and the link is the only
    // thing standing between a stranger and the haul.
    expect(() => makeShareCode(null)).toThrow();
    expect(() => makeShareCode({})).toThrow();
  });

  it("uses no confusable characters, because people read these aloud", () => {
    const code = makeShareCode(crypto);
    expect(code).not.toMatch(/[01lIO]/);
  });

  it("rejects a wrong-length or wrong-alphabet code", () => {
    expect(isShareCode("abc")).toBe(false);
    expect(isShareCode("ABCDEFGHJKMN")).toBe(false);
    expect(isShareCode("abcdefghjkm0")).toBe(false);
    expect(isShareCode(null)).toBe(false);
  });
});

describe("expiry", () => {
  it("never expires without a date", () => {
    expect(isExpired({ expiresAt: null }, T0)).toBe(false);
    expect(isExpired(null, T0)).toBe(false);
  });

  it("expires at the moment, not after it", () => {
    expect(isExpired({ expiresAt: T0 }, T0)).toBe(true);
    expect(isExpired({ expiresAt: T0 + 1 }, T0)).toBe(false);
  });

  it("reads a timestamptz string as well as a number", () => {
    expect(isExpired({ expiresAt: new Date(T0 - 1000).toISOString() }, T0)).toBe(true);
  });

  it("counts days forward from now", () => {
    expect(expiryFromDays(7, T0)).toBe(T0 + 7 * 86400000);
    expect(expiryFromDays(null, T0)).toBe(null);
    expect(expiryFromDays(0, T0)).toBe(null);
    expect(expiryFromDays(-3, T0)).toBe(null);
  });
});

describe("the link", () => {
  it("is built on the canonical host with no double slash", () => {
    expect(shareUrl("abcdefghjkmn")).toBe("https://credenzafashion.com/s/abcdefghjkmn");
    expect(shareUrl("abcdefghjkmn", "https://deploy-preview.netlify.app/")).toBe(
      "https://deploy-preview.netlify.app/s/abcdefghjkmn"
    );
  });
});
