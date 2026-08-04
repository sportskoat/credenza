// The v2 haul share snapshot (haul sharing handoff README + AGENT-NOTES).
// Pins the include-chip gating, the link routing (raw store links vs the
// affiliate Buy link), and the missing-data rule: an absent stat is absent
// from the document, never blank, zero, or "undefined".
import { describe, expect, it } from "vitest";
import {
  buildHaulShareSnapshot,
  DEFAULT_HAUL_INCLUDES,
  HAUL_SHARE_INCLUDES,
} from "../../credenza-share.js";

const ITEM = {
  title: "Fox 94 zip hoodie",
  image: "https://img.test/cover.jpg",
  photos: ["https://img.test/a.jpg", "https://img.test/b.jpg"],
  url: "https://weidian.com/item.html?itemID=1050009723785",
  albumUrl: "https://shop.x.yupoo.com/albums/123",
  platform: "weidian",
  seller: "beverly-luxury",
  category: "shirt",
  size: "XL",
  priceUsd: 65.03,
  weightGrams: 300,
  qcPhotos: ["https://img.test/qc1.jpg"],
};

const REVIEW = {
  note: "Heavy fleece, YKK zip.",
  rebuy: true,
  rating: 8,
  photos: ["https://img.test/mine1.jpg"],
};

const FIT = {
  translation: "Their XL fits like a US M.",
  short: "XL = US M",
  roomLine: "14cm of room on my 98cm. Regular fit.",
  advice: "Around a 98cm chest? Take the XL.",
  source: "Read from the seller's chart",
};

const HELPERS = {
  buyUrlFor: () => "https://www.superbuy.com/en/page/buy?url=encoded&partnercode=201444039",
  fitFor: () => FIT,
  weightKeyFor: () => "tee",
};

function build(overrides = {}, items = [{ ...ITEM, review: REVIEW }]) {
  return buildHaulShareSnapshot(items, {
    title: "8KG winter haul",
    now: 1754000000000,
    agent: "Superbuy",
    orderedAt: "2026-06-23T00:00:00.000Z",
    receivedAt: "2026-07-12T00:00:00.000Z",
    profile: { chest: 98, waist: 79, height: 178 },
    ship: { line: "EMS", costUsd: 39.3, chargeableG: 2753, domesticUsd: 0 },
    ...HELPERS,
    ...overrides,
  });
}

describe("the include chips", () => {
  it("defaults the first four on and QC + weights off", () => {
    expect(DEFAULT_HAUL_INCLUDES).toEqual({
      prices: true,
      w2c: true,
      fit: true,
      sellers: true,
      qc: false,
      weights: false,
    });
    expect(HAUL_SHARE_INCLUDES).toEqual(["prices", "w2c", "fit", "sellers", "qc", "weights"]);
  });

  it("drops prices everywhere when the prices chip is off", () => {
    const doc = build({ includes: { prices: false } });
    expect(doc.items[0].priceUsd).toBeUndefined();
    expect(doc.goodsUsd).toBeUndefined();
    expect(doc.shipUsd).toBeUndefined();
    expect(doc.landedUsd).toBeUndefined();
  });

  it("drops every link when the W2C chip is off", () => {
    const doc = build({ includes: { w2c: false } });
    const card = doc.items[0];
    expect(card.storeUrl).toBeUndefined();
    expect(card.albumUrl).toBeUndefined();
    expect(card.buyUrl).toBeUndefined();
  });

  it("drops the whole review when the fit chip is off", () => {
    const doc = build({ includes: { fit: false } });
    const card = doc.items[0];
    expect(card.fit).toBeUndefined();
    expect(card.note).toBeUndefined();
    expect(card.rebuy).toBeUndefined();
    expect(card.rating).toBeUndefined();
    expect(card.ownPhotos).toBeUndefined();
  });

  it("drops the seller when the sellers chip is off", () => {
    const doc = build({ includes: { sellers: false } });
    expect(doc.items[0].seller).toBeUndefined();
  });

  it("keeps QC photos out unless the QC chip is on", () => {
    expect(build().items[0].qcPhotos).toBeUndefined();
    const doc = build({ includes: { qc: true } });
    expect(doc.items[0].qcPhotos).toEqual(["https://img.test/qc1.jpg"]);
  });

  it("keeps weights out unless the weights chip is on", () => {
    const off = build();
    expect(off.items[0].weightGrams).toBeUndefined();
    expect(off.items[0].fabric).toBeUndefined();
    expect(off.chargeableG).toBeUndefined();
    const on = build({ includes: { weights: true } });
    expect(on.items[0].weightGrams).toBe(300);
    expect(on.items[0].fabric).toBe("heavyweight");
    expect(on.chargeableG).toBe(2753);
  });
});

describe("link routing", () => {
  it("freezes the raw store URL for W2C and the affiliate link for Buy", () => {
    const card = build().items[0];
    expect(card.storeUrl).toBe("https://weidian.com/item.html?itemID=1050009723785");
    expect(card.albumUrl).toBe("https://shop.x.yupoo.com/albums/123");
    expect(card.buyUrl).toContain("superbuy.com");
    expect(card.buyUrl).toContain("partnercode=");
  });

  it("never lets a javascript: URL through", () => {
    const doc = build({}, [{ ...ITEM, url: "javascript:alert(1)", albumUrl: "javascript:alert(1)" }]);
    expect(doc.items[0].storeUrl).toBeUndefined();
    expect(doc.items[0].albumUrl).toBeUndefined();
  });
});

describe("haul stats", () => {
  it("freezes goods, shipping, and the landed total", () => {
    const doc = build();
    expect(doc.goodsUsd).toBe(65.03);
    expect(doc.shipUsd).toBe(39.3);
    expect(doc.shipLine).toBe("EMS");
    expect(doc.landedUsd).toBe(104.33);
    expect(doc.orderedAt).toBe("2026-06-23T00:00:00.000Z");
    expect(doc.receivedAt).toBe("2026-07-12T00:00:00.000Z");
  });

  it("hides the shipping rows an old haul does not have", () => {
    const doc = build({ ship: null, orderedAt: null, receivedAt: null });
    expect(doc.shipUsd).toBeUndefined();
    expect(doc.shipLine).toBeUndefined();
    expect(doc.landedUsd).toBeUndefined();
    expect(doc.chargeableG).toBeUndefined();
    expect(doc.orderedAt).toBeUndefined();
    expect(doc.receivedAt).toBeUndefined();
    // Goods is still known from the item prices.
    expect(doc.goodsUsd).toBe(65.03);
  });
});

describe("the review capture fields", () => {
  it("round-trips unset fields as absent, never empty strings", () => {
    const doc = build({}, [{ ...ITEM, review: {} }]);
    const card = doc.items[0];
    expect(card.note).toBeUndefined();
    expect("rebuy" in card).toBe(false);
    expect("rating" in card).toBe(false);
    expect(card.ownPhotos).toBeUndefined();
  });

  it("keeps an explicit no on the rebuy question", () => {
    const doc = build({}, [{ ...ITEM, review: { rebuy: false } }]);
    expect(doc.items[0].rebuy).toBe(false);
  });

  it("validates the 1-10 rating", () => {
    expect(build({}, [{ ...ITEM, review: { rating: 8 } }]).items[0].rating).toBe(8);
    expect(build({}, [{ ...ITEM, review: { rating: 11 } }]).items[0].rating).toBeUndefined();
    expect(build({}, [{ ...ITEM, review: { rating: 0 } }]).items[0].rating).toBeUndefined();
  });

  it("carries the run answer and drops anything else", () => {
    expect(build({}, [{ ...ITEM, review: { run: "small" } }]).items[0].run).toBe("small");
    expect(build({}, [{ ...ITEM, review: { run: "true" } }]).items[0].run).toBe("true");
    expect(build({}, [{ ...ITEM, review: { run: "large" } }]).items[0].run).toBe("large");
    expect(build({}, [{ ...ITEM, review: { run: "huge" } }]).items[0].run).toBeUndefined();
    expect(build({}, [{ ...ITEM, review: {} }]).items[0].run).toBeUndefined();
  });
});

describe("the intro line", () => {
  it("names the count, the agent, and the author measurements", () => {
    const doc = build({}, Array.from({ length: 6 }, (_, i) => ({ ...ITEM, title: "Item " + i })));
    expect(doc.intro).toBe(
      "Six pieces through Superbuy. Sizes are read against my own measurements: 98cm chest, 79cm waist, 178cm."
    );
  });

  it("hides measurements the author never saved", () => {
    const doc = build({ profile: { waist: 79 } });
    expect(doc.intro).toBe("One piece through Superbuy. Sizes are read against my own measurements: 79cm waist.");
  });

  it("works with no agent and no profile", () => {
    const doc = build({ agent: null, profile: null });
    expect(doc.intro).toBe("One piece.");
  });

  it("writes no em dash", () => {
    expect(build().intro).not.toContain("—");
  });
});

describe("the document shell", () => {
  it("defaults the layout to both and refuses an unknown layout", () => {
    expect(build().layout).toBe("both");
    expect(build({ layout: "sideways" }).layout).toBe("both");
    expect(build({ layout: "receipt" }).layout).toBe("receipt");
  });

  it("caps photos at 12 per item", () => {
    const many = Array.from({ length: 20 }, (_, i) => "https://img.test/p" + i + ".jpg");
    const doc = build({}, [{ ...ITEM, photos: many }]);
    expect(doc.items[0].photos.length).toBe(12);
  });
});
