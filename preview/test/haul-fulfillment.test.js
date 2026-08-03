// The haul fulfillment logic (haul handoff README, "The parcel calculator").
//
// README: "The one piece of real domain logic. Getting this right is most of
// the feature's value." Every number below comes from the README's worked
// formula, not from what the code happens to return.
import { describe, expect, it } from "vitest";
import {
  COST_FLOOR_USD,
  DEFAULT_PACKAGING_GRAMS,
  HAUL_STAGES,
  RED_REASONS,
  costOfLine,
  defaultRates,
  earliestStorageDays,
  estimateDelta,
  firstPendingQcItem,
  handoffMessage,
  haulCta,
  haulIndexCard,
  itemShipGrams,
  needsYouCount,
  landedTotal,
  normalizeStage,
  normalizeVerdict,
  parcelMaths,
  parcelTips,
  pendingQcCount,
  returnMessage,
  shipRange,
  stageBar,
  stageCounts,
  toHaulItem,
  unorderedLinks,
} from "../../haul-fulfillment.js";

function item(over = {}) {
  return {
    id: 1,
    title: "Cargo trousers",
    size: "Large",
    price: 42,
    est: 500,
    actual: null,
    vol: 3000,
    stage: "parcel",
    qc: "green",
    reason: null,
    photos: 8,
    storage: 90,
    order: "SB-8827101",
    url: "https://weidian.com/item.html?itemID=1",
    ...over,
  };
}

describe("stages", () => {
  it("keeps the five stages in the order the item moves through them", () => {
    expect(HAUL_STAGES).toEqual(["toOrder", "ordered", "warehouse", "qcd", "parcel"]);
  });

  it("sends an unknown stage back to the start of the line", () => {
    // A haul saved before this feature existed has no stage at all. It reads as
    // "not bought yet", which is the truthful answer.
    expect(normalizeStage(undefined)).toBe("toOrder");
    expect(normalizeStage("shipped")).toBe("toOrder");
    expect(normalizeStage("qcd")).toBe("qcd");
  });

  it("treats anything but green or red as not looked at yet", () => {
    expect(normalizeVerdict("green")).toBe("green");
    expect(normalizeVerdict("red")).toBe("red");
    expect(normalizeVerdict("maybe")).toBeNull();
    expect(normalizeVerdict(undefined)).toBeNull();
  });
});

describe("the weight that counts", () => {
  it("prefers the agent's scale over the person's guess", () => {
    // README: "actual weight overwrites est the moment the item reaches the
    // warehouse".
    expect(itemShipGrams(item({ est: 400, actual: 512 }))).toBe(512);
    expect(itemShipGrams(item({ est: 400, actual: null }))).toBe(400);
  });

  it("reads a weighed zero as zero, not as a missing value", () => {
    expect(itemShipGrams(item({ est: 400, actual: 0 }))).toBe(0);
  });
});

describe("the parcel calculator", () => {
  it("adds packaging once, not once per item", () => {
    const maths = parcelMaths({
      items: [item({ id: 1, est: 500, vol: 0 }), item({ id: 2, est: 300, vol: 0 })],
      divisor: 6000,
    });
    expect(maths.goodsG).toBe(800);
    expect(maths.actualG).toBe(800 + DEFAULT_PACKAGING_GRAMS);
  });

  it("adds no packaging to an empty box", () => {
    const maths = parcelMaths({ items: [] });
    expect(maths.count).toBe(0);
    expect(maths.actualG).toBe(0);
  });

  it("counts only items in the parcel", () => {
    const maths = parcelMaths({
      items: [item({ id: 1, est: 500, vol: 0 }), item({ id: 2, stage: "qcd", est: 900, vol: 0 })],
    });
    expect(maths.count).toBe(1);
    expect(maths.goodsG).toBe(500);
  });

  it("never lets a red-lit item into the box", () => {
    // README: "A red-lit item can never enter a parcel. It is excluded from all
    // weight and cost maths."
    const maths = parcelMaths({
      items: [item({ id: 1, est: 500, vol: 0 }), item({ id: 2, qc: "red", est: 900, vol: 0 })],
    });
    expect(maths.count).toBe(1);
    expect(maths.goodsG).toBe(500);
  });

  it("adds 18 percent void space to the volume, then rounds", () => {
    // README: "volCm3 = round(sum(vol) * 1.18)  // void space between items".
    const maths = parcelMaths({ items: [item({ vol: 3000 })], divisor: 6000 });
    expect(maths.volCm3).toBe(3540);
    expect(maths.volG).toBeCloseTo(590, 5);
  });

  it("bills the larger of actual and volumetric", () => {
    // A big light box: volumetric wins.
    const airy = parcelMaths({ items: [item({ est: 300, vol: 20000 })], divisor: 6000 });
    expect(airy.volG).toBeGreaterThan(airy.actualG);
    expect(airy.chargeableG).toBe(airy.volG);
    // A small dense box: actual wins.
    const dense = parcelMaths({ items: [item({ est: 3000, vol: 1000 })], divisor: 6000 });
    expect(dense.chargeableG).toBe(dense.actualG);
  });

  it("changes every number when the divisor changes", () => {
    const six = parcelMaths({ items: [item({ est: 300, vol: 20000 })], divisor: 6000 });
    const five = parcelMaths({ items: [item({ est: 300, vol: 20000 })], divisor: 5000 });
    expect(five.volG).toBeGreaterThan(six.volG);
    expect(five.divisor).toBe(5000);
  });

  it("falls back to 6000 when the divisor is not one of the two", () => {
    expect(parcelMaths({ items: [item()], divisor: 4000 }).divisor).toBe(6000);
  });

  it("rounds the billed weight up to the next half kilo", () => {
    // README: "billedKg = max(0.5, ceil(chargeableG / 1000 * 2) / 2)".
    const light = parcelMaths({ items: [item({ est: 100, vol: 0 })] });
    expect(light.chargeableG).toBe(240);
    expect(light.billedKg).toBe(0.5);
    const mid = parcelMaths({ items: [item({ est: 2400, vol: 0 })] });
    expect(mid.chargeableG).toBe(2540);
    expect(mid.billedKg).toBe(3);
  });

  it("never bills less than half a kilo", () => {
    expect(parcelMaths({ items: [item({ est: 20, vol: 0 })] }).billedKg).toBe(0.5);
  });

  it("reports the headroom left inside the billed weight", () => {
    const maths = parcelMaths({ items: [item({ est: 2000, vol: 0 })] });
    // 2000 + 140 packaging = 2140 g, billed at 2.5 kg, so 360 g is spare.
    expect(maths.chargeableG).toBe(2140);
    expect(maths.billedKg).toBe(2.5);
    expect(maths.headroomG).toBe(360);
  });

  it("prices every line off the billed weight", () => {
    const maths = parcelMaths({ items: [item({ est: 2000, vol: 0 })], rates: defaultRates() });
    expect(maths.costs.EMS).toBeCloseTo(13.1 * 2.5, 5);
    expect(maths.costs.DHL).toBeCloseTo(22.3 * 2.5, 5);
  });

  it("holds the cost at the agent's floor for a tiny box", () => {
    // README: "costOf = line => max(8, rates[line] * billedKg)".
    expect(costOfLine(13.1, 0.5)).toBe(COST_FLOOR_USD);
    expect(costOfLine(22.3, 0.5)).toBeCloseTo(11.15, 5);
  });

  it("adds up the goods in the box", () => {
    const maths = parcelMaths({
      items: [item({ id: 1, price: 42 }), item({ id: 2, price: 18.5 })],
    });
    expect(maths.goodsUsd).toBeCloseTo(60.5, 5);
  });
});

describe("the landed total", () => {
  it("adds the goods, the agent's domestic charge and the line", () => {
    const maths = parcelMaths({ items: [item({ price: 100, est: 2000, vol: 0 })] });
    const total = landedTotal({ maths, line: "EMS", domesticUsd: 18.4 });
    expect(total).toBeCloseTo(100 + 18.4 + 13.1 * 2.5, 5);
  });
});

describe("the tips", () => {
  it("tells an empty box to fill up before it ships", () => {
    expect(parcelTips(parcelMaths({ items: [] }), [])).toEqual([
      "Two half-parcels almost always cost more than one full one. Fill the box before you ship it.",
    ]);
  });

  it("says you are paying for air when volume beats weight", () => {
    const items = [item({ est: 300, vol: 30000 })];
    const tips = parcelTips(parcelMaths({ items, divisor: 6000 }), items);
    expect(tips[0]).toContain("You're paying for air");
    expect(tips[0]).toContain("drop the shoe boxes");
  });

  it("stays quiet about air when the box is dense", () => {
    const items = [item({ est: 3000, vol: 500 })];
    const tips = parcelTips(parcelMaths({ items }), items);
    expect(tips.some((t) => t.includes("paying for air"))).toBe(false);
  });

  it("names the spare grams in the billed weight", () => {
    const items = [item({ est: 2000, vol: 0 })];
    const tips = parcelTips(parcelMaths({ items }), items);
    expect(tips).toContain("Billed at 2.5 kg. 360 g of headroom.");
  });

  it("offers the lightest green-lit item that still fits", () => {
    const items = [
      item({ id: 1, est: 2000, vol: 0 }),
      item({ id: 2, stage: "qcd", qc: "green", est: 180, vol: 0 }),
      item({ id: 3, stage: "qcd", qc: "green", est: 900, vol: 0 }),
    ];
    const tips = parcelTips(parcelMaths({ items }), items);
    expect(tips).toContain("Your lightest green-lit item (180 g) ships free.");
  });

  it("offers nothing when the lightest waiting item is too heavy", () => {
    const items = [
      item({ id: 1, est: 2000, vol: 0 }),
      item({ id: 2, stage: "qcd", qc: "green", est: 900, vol: 0 }),
    ];
    const tips = parcelTips(parcelMaths({ items }), items);
    expect(tips.some((t) => t.includes("ships free"))).toBe(false);
  });

  it("never offers a red-lit item, however light", () => {
    const items = [
      item({ id: 1, est: 2000, vol: 0 }),
      item({ id: 2, stage: "qcd", qc: "red", est: 40, vol: 0 }),
    ];
    const tips = parcelTips(parcelMaths({ items }), items);
    expect(tips.some((t) => t.includes("ships free"))).toBe(false);
  });

  it("stays quiet about headroom under 120 g", () => {
    // 2310 + 140 packaging = 2450 g, billed at 2.5 kg, so only 50 g is spare.
    const items = [item({ est: 2310, vol: 0 })];
    const maths = parcelMaths({ items });
    expect(maths.headroomG).toBe(50);
    expect(parcelTips(maths, items).some((t) => t.includes("headroom"))).toBe(false);
  });
});

describe("counts and clocks", () => {
  it("counts every stage, and tolerates all five at once", () => {
    // README: "Mixed progress is the normal state."
    const counts = stageCounts([
      item({ stage: "toOrder" }),
      item({ stage: "ordered" }),
      item({ stage: "warehouse" }),
      item({ stage: "warehouse" }),
      item({ stage: "qcd" }),
      item({ stage: "parcel" }),
    ]);
    expect(counts).toEqual({ toOrder: 1, ordered: 1, warehouse: 2, qcd: 1, parcel: 1 });
    expect(pendingQcCount([item({ stage: "warehouse" }), item({ stage: "qcd" })])).toBe(1);
  });

  it("shows the storage clock that runs out first", () => {
    // README: "Haul-level display shows the earliest expiry among items not yet
    // in a parcel."
    expect(
      earliestStorageDays([
        item({ stage: "warehouse", storage: 61 }),
        item({ stage: "qcd", storage: 12 }),
        item({ stage: "parcel", storage: 3 }),
      ])
    ).toBe(12);
  });

  it("shows no clock when nothing has arrived", () => {
    expect(earliestStorageDays([item({ stage: "toOrder", storage: null })])).toBeNull();
  });
});

describe("the index card's recommended move", () => {
  it("puts QC review above everything else", () => {
    const cta = haulCta({
      items: [item({ stage: "warehouse" }), item({ stage: "parcel" })],
      submitted: true,
      milestone: 3,
    });
    expect(cta.label).toBe("Review QC · 1");
    expect(cta.flag).toBe("1 at QC");
    expect(cta.variant).toBe("primary");
    expect(cta.openQc).toBe(true);
  });

  it("reads delivered from the parcel, never from the open screen", () => {
    // README: "An early build gated the delivered branch on screen ===
    // 'tracking', which is unreachable while the index is rendering."
    const cta = haulCta({ items: [item({ stage: "parcel" })], submitted: true, milestone: 3 });
    expect(cta.flag).toBe("Delivered");
    expect(cta.label).toBe("Open");
    expect(cta.variant).toBe("outline");
  });

  it("offers tracking while the parcel is in flight", () => {
    const cta = haulCta({ items: [item({ stage: "parcel" })], submitted: true, milestone: 1 });
    expect(cta.flag).toBe("In transit");
    expect(cta.label).toBe("Track parcel A");
    expect(cta.to).toBe("tracking");
  });

  it("offers the hand-off once the box holds something", () => {
    const cta = haulCta({ items: [item({ stage: "parcel" })] });
    expect(cta.label).toBe("Review & hand off");
    expect(cta.to).toBe("ship");
  });

  it("offers the board when items sit at the warehouse", () => {
    const cta = haulCta({ items: [item({ stage: "qcd" })] });
    expect(cta.label).toBe("Open");
    const waiting = haulCta({ items: [item({ stage: "qcd", qc: "green" }), item({ stage: "toOrder" })] });
    expect(waiting.label).toBe("Start ordering");
  });

  it("offers ordering when nothing is bought yet", () => {
    const cta = haulCta({ items: [item({ stage: "toOrder" })] });
    expect(cta.label).toBe("Start ordering");
    expect(cta.variant).toBe("outline");
  });

  it("falls back to Open for an empty haul", () => {
    expect(haulCta({ items: [] }).label).toBe("Open");
  });

  it("names the first item still waiting on a verdict", () => {
    const first = firstPendingQcItem([
      item({ id: 1, stage: "qcd" }),
      item({ id: 2, stage: "warehouse" }),
      item({ id: 3, stage: "warehouse" }),
    ]);
    expect(first.id).toBe(2);
    expect(firstPendingQcItem([item({ stage: "parcel" })])).toBeNull();
  });
});

describe("the messages Credenza writes", () => {
  it("names the order, the fault and the exact photo", () => {
    // README: "The photo index is the one the user was looking at when they
    // flagged it. That specificity is what makes the request actionable."
    const text = returnText({ photoIndex: 2, reason: "stitching" });
    expect(text).toContain("SB-8827101");
    expect(text).toContain("Cargo trousers");
    expect(text).toContain("In QC photo 3, the stitching is coming apart.");
    expect(text).toContain("走线开裂");
    expect(text).toContain("质检图第3张");
  });

  it("carries an English and a Chinese clause for all six faults", () => {
    expect(RED_REASONS).toHaveLength(6);
    for (const reason of RED_REASONS) {
      const text = returnText({ reason: reason.key });
      expect(text).toContain(reason.en);
      expect(text).toContain(reason.zh);
    }
  });

  it("lists every packed item in the hand-off", () => {
    const text = handoffMessage({
      items: [
        item({ id: 1, title: "Cargo trousers", size: "Large", order: "SB-1" }),
        item({ id: 2, title: "Down jacket", size: "XL", order: "SB-2" }),
      ],
      line: "EMS",
      declared: 45,
    });
    expect(text).toContain("Please pack these 2 items into one parcel:");
    expect(text).toContain("· SB-1 · Cargo trousers (Large)");
    expect(text).toContain("· SB-2 · Down jacket (XL)");
    expect(text).toContain("Line: EMS. Declared value: $45.00.");
    expect(text).toContain("请将以上 2 件打包成一个包裹");
  });

  it("uses the singular for one item", () => {
    // README: "correct singular/plural everywhere".
    const text = handoffMessage({ items: [item()], line: "DHL", declared: 30 });
    expect(text).toContain("Please pack this item into one parcel:");
  });

  it("leaves a red-lit item out of the hand-off", () => {
    const text = handoffMessage({
      items: [item({ id: 1, title: "Cargo trousers" }), item({ id: 2, title: "Torn hoodie", qc: "red" })],
      line: "EMS",
      declared: 20,
    });
    expect(text).not.toContain("Torn hoodie");
    expect(text).toContain("Please pack this item into one parcel:");
  });

  it("joins every unordered link with a line break for the agent's box", () => {
    const text = unorderedLinks([
      item({ id: 1, stage: "toOrder", url: "https://weidian.com/a" }),
      item({ id: 2, stage: "ordered", url: "https://weidian.com/b" }),
      item({ id: 3, stage: "toOrder", url: "https://weidian.com/c" }),
    ]);
    expect(text).toBe("https://weidian.com/a\nhttps://weidian.com/c");
  });
});

describe("the estimate delta", () => {
  it("says how far out the guess was", () => {
    expect(estimateDelta(item({ est: 400, actual: 512 })).label).toBe(
      "Your estimate was 400 g. +112 g out."
    );
    expect(estimateDelta(item({ est: 1100, actual: 1060 })).label).toBe(
      "Your estimate was 1.10 kg. -40 g out."
    );
  });

  it("says nothing before the agent weighs the item", () => {
    expect(estimateDelta(item({ est: 400, actual: null }))).toBeNull();
  });

  it("says nothing when the guess was right", () => {
    expect(estimateDelta(item({ est: 400, actual: 400 }))).toBeNull();
  });
});

// The index card (haul handoff README, "Hauls index" and screen 1).
//
// README: "The index is a projection of item and parcel state — never a stored
// status, and never derived from which screen is showing." Every assertion here
// feeds only items and parcel state, never a screen name.
describe("the index card", () => {
  it("puts the QC shortcut above everything else", () => {
    const card = haulIndexCard({
      items: [item({ stage: "warehouse" }), item({ stage: "warehouse" }), item()],
      submitted: true,
      milestone: 3,
    });
    expect(card.flag).toBe("2 at QC");
    expect(card.label).toBe("Review QC · 2");
    expect(card.note).toBe("2 items are waiting on your green light.");
    expect(card.tone).toBe("attention");
    expect(card.openQc).toBe(true);
  });

  it("counts one waiting item in the singular", () => {
    const card = haulIndexCard({ items: [item({ stage: "warehouse" })] });
    expect(card.note).toBe("1 item is waiting on your green light.");
  });

  it("shouts when the free storage is nearly out", () => {
    const items = [item({ stage: "qcd", storage: 6 }), item({ stage: "qcd", storage: 40 })];
    const card = haulIndexCard({ items });
    expect(card.tone).toBe("urgent");
    expect(card.flag).toBe("6 d left");
    expect(card.note).toBe("Free storage ends in 6 days on all 2 items.");
  });

  it("stays quiet about storage when the clock has plenty left", () => {
    const card = haulIndexCard({ items: [item({ stage: "toOrder", storage: 40 })] });
    expect(card.tone).toBe("idle");
    expect(card.flag).toBe(null);
    expect(card.note).toBe("1 item still to order.");
  });

  it("ignores the storage clock once the parcel is gone", () => {
    const items = [item({ stage: "parcel", storage: 2 })];
    const card = haulIndexCard({ items, submitted: true, maths: parcelMaths({ items }) });
    expect(card.tone).toBe("attention");
    expect(card.flag).toBe("In transit");
  });

  it("names the line and the chargeable weight in transit", () => {
    const items = [item({ est: 900, vol: 0 })];
    const card = haulIndexCard({
      items,
      submitted: true,
      line: "DHL",
      maths: parcelMaths({ items }),
    });
    expect(card.label).toBe("Track parcel A");
    expect(card.to).toBe("tracking");
    expect(card.note).toBe("Parcel A is with DHL · 1.04 kg.");
  });

  it("reads the landed total once the parcel arrives", () => {
    const items = [item({ price: 42, est: 900, vol: 0 })];
    const maths = parcelMaths({ items });
    const card = haulIndexCard({ items, submitted: true, milestone: 3, maths });
    // 42 goods + 18.40 agent + 13.10 x 1.5 kg = 80.05
    expect(card.note).toBe("Delivered · $80.05 landed.");
    expect(card.tone).toBe("done");
    expect(card.label).toBe("Open");
  });

  it("prices the ready parcel as a range across the lines", () => {
    const items = [item({ est: 900, vol: 0 })];
    const maths = parcelMaths({ items });
    const card = haulIndexCard({ items, maths });
    expect(card.label).toBe("Review & hand off");
    expect(card.flag).toBe("1.04 kg");
    expect(card.note).toBe("Parcel A is ready · ~$20–33 to ship.");
  });

  it("names the empty box when everything is reviewed", () => {
    const card = haulIndexCard({ items: [item({ stage: "qcd", storage: 90 })] });
    expect(card.note).toBe("Everything is reviewed. Nothing in the box yet.");
    expect(card.tone).toBe("attention");
  });

  it("asks for the box when items sit at the warehouse without photos", () => {
    const card = haulIndexCard({ items: [item({ stage: "warehouse", photos: 0, storage: 90 })] });
    expect(card.label).toBe("Build the parcel");
    expect(card.note).toBe("1 item is at the warehouse.");
  });

  it("does not send a person to QC on an item with no photos", () => {
    const items = [item({ stage: "warehouse", photos: 0, storage: 90 })];
    expect(haulIndexCard({ items }).openQc).toBe(false);
  });

  it("counts what is still to order", () => {
    const card = haulIndexCard({ items: [item({ stage: "toOrder" }), item({ stage: "toOrder" })] });
    expect(card.label).toBe("Start ordering");
    expect(card.note).toBe("2 items still to order.");
    expect(card.tone).toBe("idle");
    expect(card.flag).toBe(null);
  });

  it("says nothing about an empty haul", () => {
    const card = haulIndexCard({ items: [] });
    expect(card.label).toBe("Open");
    expect(card.note).toBe("Nothing ordered yet.");
    expect(card.flag).toBe(null);
  });

  it("counts the hauls that ask for something", () => {
    const cards = [{ tone: "attention" }, { tone: "urgent" }, { tone: "done" }, { tone: "idle" }];
    expect(needsYouCount(cards)).toBe(2);
    expect(needsYouCount([])).toBe(0);
  });
});

// Reading a saved card as a haul item. One tested translation, so no screen
// invents its own field names.
describe("reading a saved card", () => {
  const card = {
    id: "c1",
    title: "Cargo trousers",
    size: "Large",
    platform: "weidian",
    url: "https://weidian.com/item.html?itemID=1",
    weightGrams: 480,
    qcPhotos: ["a", "b", "c"],
    haulStage: "warehouse",
    haulVerdict: "green",
    haulReason: "stitching",
    haulActualGrams: 512,
    haulVolumeCm3: 3000,
    haulStorageDays: 84,
    haulOrderNo: "SB-8827101",
    haulStageAt: "2026-07-30",
  };

  it("carries every hand-marked field across", () => {
    expect(toHaulItem(card, { estGrams: 480, priceUsd: 42 })).toEqual({
      id: "c1",
      title: "Cargo trousers",
      size: "Large",
      price: 42,
      platform: "weidian",
      est: 480,
      actual: 512,
      vol: 3000,
      stage: "warehouse",
      qc: "green",
      reason: "stitching",
      photos: 3,
      storage: 84,
      order: "SB-8827101",
      when: "2026-07-30",
      url: "https://weidian.com/item.html?itemID=1",
    });
  });

  it("reads a card saved before this feature as not bought yet", () => {
    const plain = toHaulItem({ id: "c2", title: "Tee" });
    expect(plain.stage).toBe("toOrder");
    expect(plain.qc).toBe(null);
    expect(plain.actual).toBe(null);
    expect(plain.storage).toBe(null);
    expect(plain.photos).toBe(0);
    expect(plain.price).toBe(0);
  });

  it("falls back to the card's own weight when no estimate is given", () => {
    expect(toHaulItem(card).est).toBe(480);
  });

  it("returns nothing for a missing card", () => {
    expect(toHaulItem(null)).toBe(null);
  });
});

describe("the stage bar", () => {
  it("draws one segment per occupied stage, in order", () => {
    const items = [
      item({ stage: "parcel" }),
      item({ stage: "toOrder" }),
      item({ stage: "toOrder" }),
      item({ stage: "warehouse" }),
    ];
    expect(stageBar(items)).toEqual([
      { stage: "toOrder", count: 2 },
      { stage: "warehouse", count: 1 },
      { stage: "parcel", count: 1 },
    ]);
  });

  it("draws nothing for an empty haul", () => {
    expect(stageBar([])).toEqual([]);
  });
});

describe("the shipping range", () => {
  it("spans the cheapest and the dearest line", () => {
    expect(shipRange(parcelMaths({ items: [item({ est: 900, vol: 0 })] }))).toBe("~$20–33");
  });

  it("collapses to one number when every line costs the same", () => {
    const maths = parcelMaths({ items: [item({ est: 100, vol: 0 })] });
    expect(maths.billedKg).toBe(0.5);
    // Every line falls to the $8 floor at this weight, so there is no range.
    expect(shipRange({ ...maths, costs: { EMS: 8, DHL: 8 } })).toBe("~$8");
    expect(shipRange(maths)).toBe("~$8–11");
  });

  it("says nothing about an empty box", () => {
    expect(shipRange(parcelMaths({ items: [] }))).toBe(null);
  });
});

function returnText(over = {}) {
  return returnMessage({ item: item(), photoIndex: 0, reason: "stitching", ...over });
}
