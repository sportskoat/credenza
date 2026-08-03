// The haul fulfillment logic (haul handoff README, "The parcel calculator").
//
// README: "The one piece of real domain logic. Getting this right is most of
// the feature's value." Every number below comes from the README's worked
// formula, not from what the code happens to return.
import { describe, expect, it } from "vitest";
import {
  BOARD_COLUMNS,
  COST_FLOOR_USD,
  DECLARED_THRESHOLD_USD,
  DEFAULT_PACKAGING_GRAMS,
  FIT_OPTIONS,
  HAUL_STAGES,
  MILESTONES,
  RED_REASONS,
  STAGE_LABELS,
  boardColumns,
  costOfLine,
  declaredWarning,
  defaultRates,
  earliestStorageDays,
  estimateDelta,
  RECEIVED_INDEX,
  firstPendingQcItem,
  fitRows,
  handoffLeftBehind,
  handoffMessage,
  handoffPackedRows,
  handoffView,
  haulCta,
  haulIndexCard,
  itemCardMeta,
  itemDrawer,
  itemShipGrams,
  landedNote,
  milestoneRows,
  needsYouCount,
  landedTotal,
  normalizeStage,
  normalizeVerdict,
  parcelMaths,
  parcelTips,
  pendingQcCount,
  qcProgress,
  qcQueue,
  redReasonText,
  remainingNote,
  resetToShelf,
  returnMessage,
  sellerRecord,
  shipRange,
  stageBar,
  stageCounts,
  storageLine,
  toHaulItem,
  trackMeta,
  trackingView,
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

describe("the QC queue", () => {
  it("holds only the items still waiting on a verdict", () => {
    const queue = qcQueue([
      item({ id: 1, stage: "warehouse", qc: null }),
      item({ id: 2, stage: "warehouse", qc: "green" }),
      item({ id: 3, stage: "warehouse", qc: null, photos: 0 }),
      item({ id: 4, stage: "ordered", qc: null }),
      item({ id: 5, stage: "warehouse", qc: null }),
    ]);
    expect(queue.map((entry) => entry.id)).toEqual([1, 5]);
  });

  it("keeps shelf order, so the next item is never a surprise", () => {
    const queue = qcQueue([
      item({ id: 9, stage: "warehouse", qc: null }),
      item({ id: 2, stage: "warehouse", qc: null }),
    ]);
    expect(queue.map((entry) => entry.id)).toEqual([9, 2]);
  });

  it("is empty for a haul with nothing at the warehouse", () => {
    expect(qcQueue([])).toEqual([]);
    expect(qcQueue([item({ stage: "parcel" })])).toEqual([]);
  });
});

describe("the QC counter", () => {
  it("counts what is ruled and what is still to rule", () => {
    expect(
      qcProgress([
        item({ id: 1, stage: "qcd", qc: "green" }),
        item({ id: 2, stage: "qcd", qc: "red" }),
        item({ id: 3, stage: "warehouse", qc: null }),
      ])
    ).toEqual({ green: 1, red: 1, done: 2, total: 3 });
  });

  it("reads zero of zero for an empty haul", () => {
    expect(qcProgress([])).toEqual({ green: 0, red: 0, done: 0, total: 0 });
  });

  it("leaves an item with no photos out of the total", () => {
    // Nobody can rule on a photo that never arrived, so it is not "to do".
    expect(qcProgress([item({ stage: "warehouse", qc: null, photos: 0 })]).total).toBe(0);
  });
});

describe("the seller's record", () => {
  const cards = [
    { seller: "Wu Store", haulVerdict: "green" },
    { seller: "wu store ", haulVerdict: "red" },
    { seller: "Wu Store", haulVerdict: null },
    { seller: "Other Store", haulVerdict: "green" },
  ];

  it("groups verdicts by seller, ignoring case and spaces", () => {
    expect(sellerRecord(cards, "WU STORE")).toEqual({
      green: 1,
      red: 1,
      label: "This seller: 1 green, 1 red across your shelf.",
    });
  });

  it("reads a haul-shaped item too", () => {
    expect(sellerRecord([{ seller: "Wu Store", qc: "green" }], "Wu Store").green).toBe(1);
  });

  it("says nothing without a seller or without history", () => {
    expect(sellerRecord(cards, "")).toBe(null);
    expect(sellerRecord(cards, "New Store")).toBe(null);
  });
});

describe("the board's columns", () => {
  it("runs left to right in the order the person works", () => {
    expect(BOARD_COLUMNS.map((column) => column.key)).toEqual([
      "toOrder",
      "ordered",
      "warehouse",
      "qcd",
    ]);
  });

  it("leaves the parcel out, because the parcel is the destination", () => {
    expect(BOARD_COLUMNS.some((column) => column.key === "parcel")).toBe(false);
  });

  it("puts every item in its stage's column", () => {
    const columns = boardColumns([
      item({ id: 1, stage: "toOrder" }),
      item({ id: 2, stage: "warehouse" }),
      item({ id: 3, stage: "warehouse" }),
      item({ id: 4, stage: "parcel" }),
    ]);
    expect(columns.map((column) => column.count)).toEqual([1, 0, 2, 0]);
    expect(columns[2].items.map((entry) => entry.item.id)).toEqual([2, 3]);
  });

  it("hides a column's action when the column is empty", () => {
    const columns = boardColumns([]);
    expect(columns.every((column) => column.footerLabel === null)).toBe(true);
  });

  it("offers the bulk action once a column has something in it", () => {
    const columns = boardColumns([item({ stage: "toOrder" })]);
    expect(columns[0].footerLabel).toBe("Copy all links");
    expect(columns[1].footerLabel).toBe(null);
  });
});

describe("one card on the board", () => {
  it("tells an unordered item what it should weigh", () => {
    expect(itemCardMeta(item({ stage: "toOrder", actual: null, est: 900 }))).toEqual({
      meta: "not ordered · est. 900 g",
      tone: "faint",
      action: "Copy link",
    });
  });

  it("shows the order number and the date once it is ordered", () => {
    expect(
      itemCardMeta(item({ stage: "ordered", order: "SB-8827104", when: "4 d ago" }))
    ).toEqual({ meta: "SB-8827104 · 4 d ago", tone: "faint", action: "Mark arrived" });
  });

  it("falls back to a plain word when the order number is missing", () => {
    expect(itemCardMeta(item({ stage: "ordered", order: "", when: "" })).meta).toBe("ordered");
  });

  it("counts the photos waiting on the warehouse card", () => {
    expect(itemCardMeta(item({ stage: "warehouse", actual: 512, storage: 58, photos: 12 }))).toEqual(
      { meta: "512 g actual · 58 d left", tone: "faint", action: "Review QC · 12" }
    );
  });

  it("drops the storage clock when the person turns it off", () => {
    const meta = itemCardMeta(item({ stage: "warehouse", actual: 512, storage: 58 }), {
      storageClock: false,
    });
    expect(meta.meta).toBe("512 g actual");
  });

  it("offers the parcel to a green-lit item", () => {
    expect(itemCardMeta(item({ stage: "qcd", qc: "green", actual: 268 }))).toEqual({
      meta: "green · 268 g",
      tone: "money",
      action: "Add to parcel",
    });
  });

  it("offers the return message to a red-lit item, and names the fault", () => {
    expect(itemCardMeta(item({ stage: "qcd", qc: "red", reason: "stitching" }))).toEqual({
      meta: "red · stitching",
      tone: "error",
      action: "Return message",
    });
  });

  // Kyle 2026-08-02: "flagged" answered nothing. A red light with no reason is
  // an unanswered question, and the card now says which one it is.
  it("says the reason is missing rather than calling it flagged", () => {
    expect(itemCardMeta(item({ stage: "qcd", qc: "red", reason: null })).meta).toBe(
      "red · reason not set"
    );
  });

  it("offers nothing to an item already in the box", () => {
    expect(itemCardMeta(item({ stage: "parcel", actual: 726 }))).toEqual({
      meta: "726 g",
      tone: "faint",
      action: null,
    });
  });

  it("has nothing to say about a missing item", () => {
    expect(itemCardMeta(null)).toBe(null);
  });
});

describe("the storage sentence", () => {
  it("names the days left on the oldest item at the warehouse", () => {
    expect(storageLine([item({ stage: "warehouse", storage: 58 }), item({ id: 2, storage: 90 })])).toBe(
      "Free storage ends in 58 days on your oldest item at the warehouse. " +
        "Your agent holds 90 days. The clock starts on arrival, not on ship."
    );
  });

  it("says the clock is not running when nothing is on one", () => {
    expect(storageLine([item({ stage: "toOrder", storage: null })])).toBe(
      "Nothing is sitting at the warehouse on a clock."
    );
    expect(storageLine([])).toBe("Nothing is sitting at the warehouse on a clock.");
  });
});

describe("the item drawer", () => {
  it("marks every stage behind the item as done and the one it is on as current", () => {
    const view = itemDrawer(item({ stage: "warehouse" }));
    expect(view.stages.map((s) => [s.key, s.done, s.current])).toEqual([
      ["toOrder", true, false],
      ["ordered", true, false],
      ["warehouse", false, true],
      ["qcd", false, false],
      ["parcel", false, false],
    ]);
  });

  it("keeps the labels the drawer shows, not the board's column labels", () => {
    expect(STAGE_LABELS.map((s) => s.label)).toEqual([
      "Not ordered",
      "Ordered",
      "At the warehouse",
      "QC done",
      "In parcel A",
    ]);
  });

  it("shows the estimate until the agent weighs the item", () => {
    const view = itemDrawer(item({ est: 500, actual: null }));
    expect(view.weight).toBe(500);
    expect(view.weighed).toBe(false);
    expect(view.weightNote).toBe(
      "Your estimate. It gets overwritten the moment the agent weighs it."
    );
  });

  it("shows the real weight and how far off the guess was", () => {
    const view = itemDrawer(item({ est: 1100, actual: 1140 }));
    expect(view.weight).toBe(1140);
    expect(view.weighed).toBe(true);
    expect(view.weightNote).toBe(
      "Weighed at the warehouse. Your estimate was 1.10 kg. +40 g out."
    );
  });

  it("says the guess was right rather than printing a zero difference", () => {
    expect(itemDrawer(item({ est: 500, actual: 500 })).weightNote).toBe(
      "Weighed at the warehouse. Your estimate was right."
    );
  });

  it("offers QC review only when photos exist, and reopening once a verdict stands", () => {
    expect(itemDrawer(item({ photos: 0, qc: null })).qcReady).toBe(false);
    expect(itemDrawer(item({ photos: 12, qc: null })).qcLabel).toBe("Review QC · 12 photos");
    expect(itemDrawer(item({ photos: 12, qc: "green" })).qcLabel).toBe("Reopen QC · 12 photos");
  });

  it("offers the parcel to a green-lit item that is not packed yet", () => {
    expect(itemDrawer(item({ qc: "green", stage: "qcd" })).canParcel).toBe(true);
    expect(itemDrawer(item({ qc: "green", stage: "parcel" })).canParcel).toBe(false);
    expect(itemDrawer(item({ qc: "red", stage: "qcd" })).canParcel).toBe(false);
  });

  it("hides the storage clock when the caller turns it off", () => {
    expect(itemDrawer(item({ storage: 58 })).storageNote).toBe("Free storage ends in 58 days.");
    expect(itemDrawer(item({ storage: 58 }), { storageClock: false }).storageNote).toBe(null);
    expect(itemDrawer(item({ storage: null })).storageNote).toBe(null);
  });

  // Kyle 2026-08-02: "there's not an actual thing to say, 'Hey, this caught
  // red light because of a mark on the shirt'". The drawer now carries the
  // sentence, so a screen can print it.
  it("names the problem behind a red light in words", () => {
    const view = itemDrawer(item({ qc: "red", reason: "stitching" }));
    expect(view.verdict).toBe("red");
    expect(view.reason).toBe("stitching");
    expect(view.reasonText).toBe("The stitching is coming apart.");
  });

  it("carries no reason for a green light", () => {
    const view = itemDrawer(item({ qc: "green", reason: "stitching" }));
    expect(view.reason).toBe(null);
    expect(view.reasonText).toBe(null);
  });

  it("leaves the sentence empty when nobody picked a reason", () => {
    const view = itemDrawer(item({ qc: "red", reason: null }));
    expect(view.verdict).toBe("red");
    expect(view.reasonText).toBe(null);
  });

  it("has nothing to show for a missing item", () => {
    expect(itemDrawer(null)).toBe(null);
  });
});

// A stored reason the app does not recognise is still the person's answer.
// Dropping it would make the screen say the question was never answered.
describe("the red-light sentence", () => {
  it("reads back every listed reason as a sentence", () => {
    expect(redReasonText("wrong size")).toBe("The size sent is not the size ordered.");
    expect(redReasonText("stain")).toBe("There is a stain on the fabric.");
  });

  it("echoes an unknown reason rather than hiding it", () => {
    expect(redReasonText("smells of smoke")).toBe("Smells of smoke.");
  });

  it("has nothing to say for no reason", () => {
    expect(redReasonText(null)).toBe(null);
    expect(redReasonText("")).toBe(null);
  });
});

describe("going back to the shelf", () => {
  it("clears every fulfillment number, not just the stage", () => {
    // A re-ordered item is a new item. A stale QC verdict on a fresh order is
    // worse than no verdict at all.
    expect(resetToShelf()).toEqual({
      haulStage: "toOrder",
      haulVerdict: null,
      haulReason: null,
      haulActualGrams: null,
      haulStorageDays: null,
      haulOrderNo: "",
      qcPhotos: [],
    });
  });
});

describe("the hand-off screen", () => {
  it("lists only what is really in the box", () => {
    // A red-lit item sitting in the parcel is not in the box. The packing
    // list is what the agent will actually see.
    const rows = handoffPackedRows([
      item({ id: 1, stage: "parcel", order: "SB-1", size: "L" }),
      item({ id: 2, stage: "parcel", qc: "red" }),
      item({ id: 3, stage: "qcd" }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(1);
    expect(rows[0].sub).toBe("L · SB-1");
    expect(rows[0].weight).toBe("500 g");
    expect(rows[0].price).toBe("$42.00");
  });

  it("gives a green-lit leftover full opacity and an action", () => {
    // This row is the point of the section. A green-lit item left out of the
    // box costs a second parcel for nothing.
    const [row] = handoffLeftBehind([item({ id: 9, stage: "qcd", qc: "green", actual: 268 })], {
      headroomG: 400,
    });
    expect(row.dim).toBe(false);
    expect(row.tone).toBe("money");
    expect(row.actionLabel).toBe("Add to the box");
    expect(row.staticLabel).toBe(null);
    expect(row.sub).toBe("green-lit · 268 g · fits in your headroom");
  });

  it("drops the headroom promise when it does not fit", () => {
    const [row] = handoffLeftBehind([item({ stage: "qcd", qc: "green", actual: 268 })], {
      headroomG: 100,
    });
    expect(row.sub).toBe("green-lit · 268 g");
  });

  it("dims a red-lit item and says it cannot ship", () => {
    const [row] = handoffLeftBehind([
      item({ stage: "qcd", qc: "red", reason: "stitching" }),
    ]);
    expect(row.dim).toBe(true);
    expect(row.tone).toBe("error");
    expect(row.sub).toBe("red-lit · stitching");
    expect(row.staticLabel).toBe("can't ship");
    expect(row.actionLabel).toBe(null);
  });

  it("dims an unreviewed item and counts its photos", () => {
    const [row] = handoffLeftBehind([item({ stage: "warehouse", qc: null, photos: 12 })]);
    expect(row.dim).toBe(true);
    expect(row.tone).toBe("faint");
    expect(row.sub).toBe("not reviewed yet · 12 photos");
    expect(row.staticLabel).toBe("stays behind");
  });

  it("leaves out anything not yet at the warehouse", () => {
    expect(
      handoffLeftBehind([item({ stage: "toOrder" }), item({ stage: "ordered" })])
    ).toHaveLength(0);
  });

  it("states the duty threshold and refuses to advise", () => {
    // Both branches end the same way. This is a customs liability boundary.
    const tail = " Your call, your risk. Credenza does not advise on this.";
    expect(DECLARED_THRESHOLD_USD).toBe(45);
    expect(declaredWarning(60)).toBe(
      "Over $45.00 your country usually charges duty on arrival." + tail
    );
    expect(declaredWarning(30)).toBe(
      "Under the $45.00 threshold your country usually charges duty at." + tail
    );
    expect(declaredWarning(45)).toBe(declaredWarning(30));
  });

  it("never tells the person what to declare", () => {
    for (const value of [0, 20, 45, 46, 500]) {
      const text = declaredWarning(value);
      expect(text).not.toMatch(/declare (less|more|under|below)/i);
      expect(text).toContain("Credenza does not advise on this.");
    }
  });

  it("adds the goods, the domestic leg and the line into one landed number", () => {
    const items = [
      item({ id: 1, stage: "parcel", price: 42, actual: 500, vol: 0 }),
      item({ id: 2, stage: "parcel", price: 58, actual: 500, vol: 0 }),
    ];
    const maths = parcelMaths({ items });
    const view = handoffView({ items, maths, line: "EMS", declared: 40, domesticUsd: 18.4 });
    expect(view.count).toBe(2);
    expect(view.goods).toBe("$100.00");
    expect(view.domestic).toBe("$18.40");
    expect(view.landed).toBe(
      "$" + (100 + 18.4 + costOfLine(defaultRates().EMS, maths.billedKg)).toFixed(2)
    );
    expect(view.line).toBe("EMS");
    expect(view.billed).toBe(maths.billedKg.toFixed(1) + " kg");
  });

  it("shows no weight at all when the box is empty", () => {
    const view = handoffView({ items: [item({ stage: "qcd" })] });
    expect(view.count).toBe(0);
    expect(view.chargeable).toBe("");
    expect(view.billed).toBe("");
  });

  it("carries the same instruction the board copies", () => {
    const items = [item({ id: 1, stage: "parcel", order: "SB-1" })];
    expect(handoffView({ items, line: "EMS", declared: 40 }).instruction).toBe(
      handoffMessage({ items, line: "EMS", declared: 40 })
    );
  });
});

// ── Tracking (README screens 10 and 11) ────────────────────────────────────
describe("the tracking screen", () => {
  it("offers exactly the four steps the README names, in order", () => {
    expect(MILESTONES.map((entry) => entry.label)).toEqual([
      "Submitted to the agent",
      "Shipped",
      "Cleared customs",
      "Received",
    ]);
    expect(RECEIVED_INDEX).toBe(3);
  });

  it("marks every step up to the current one as done", () => {
    const rows = milestoneRows(1, []);
    expect(rows.map((row) => row.done)).toEqual([true, true, false, false]);
    expect(rows.map((row) => row.current)).toEqual([false, true, false, false]);
  });

  it("lets a step be taken back, because a step marked early is a lie", () => {
    expect(milestoneRows(3, []).map((row) => row.done)).toEqual([true, true, true, true]);
    expect(milestoneRows(0, []).map((row) => row.done)).toEqual([true, false, false, false]);
  });

  it("clamps a milestone outside the four steps", () => {
    expect(milestoneRows(9, []).map((row) => row.done)).toEqual([true, true, true, true]);
    expect(milestoneRows(-4, []).map((row) => row.done)).toEqual([true, false, false, false]);
  });

  it("shows a short date only on a step the person has marked", () => {
    const rows = milestoneRows(1, ["2026-07-31T00:00:00.000Z", "2026-08-01T00:00:00.000Z", null, null]);
    expect(rows[0].when).toBeTruthy();
    expect(rows[1].when).toBeTruthy();
    expect(rows[2].when).toBe("");
    expect(rows[3].when).toBe("");
  });

  it("survives a stamp that is not a date", () => {
    expect(milestoneRows(1, ["not a date", null, null, null])[0].when).toBe("");
  });

  it("reads the parcel out in the mono meta line", () => {
    const items = [
      item({ id: 1, stage: "parcel", actual: 900, vol: 0 }),
      item({ id: 2, stage: "parcel", actual: 900, vol: 0 }),
    ];
    const maths = parcelMaths({ items });
    expect(trackMeta({ maths, line: "EMS" })).toBe(
      "2 ITEMS · " + maths.billedKg.toFixed(1) + " KG · EMS"
    );
  });

  it("says nothing about weight when the box is empty", () => {
    expect(trackMeta({ maths: parcelMaths({ items: [] }), line: "ems" })).toBe("0 ITEMS · 0 KG · EMS");
  });

  it("keeps the landed number a projection until the box arrives", () => {
    expect(landedNote(0)).toBe("Final once it clears customs. Duty is not in here.");
    expect(landedNote(2)).toBe("Final once it clears customs. Duty is not in here.");
  });

  it("turns the landed number into the answer once the box arrives", () => {
    expect(landedNote(3)).toBe("This is the number to quote when someone asks what the haul cost.");
  });

  it("never puts an em dash in a note the person reads", () => {
    for (const step of [0, 3]) expect(landedNote(step)).not.toContain("—");
    expect(remainingNote([])).not.toContain("—");
  });

  it("counts what stays at the warehouse while the parcel flies", () => {
    const items = [
      item({ id: 1, stage: "parcel" }),
      item({ id: 2, stage: "warehouse", storage: 12 }),
      item({ id: 3, stage: "qcd", storage: 40 }),
    ];
    expect(remainingNote(items)).toBe(
      "2 items stay behind, oldest has 12 days of free storage left. They can go in parcel B."
    );
  });

  it("uses the singular for one item left behind", () => {
    const items = [item({ id: 1, stage: "parcel" }), item({ id: 2, stage: "qcd", storage: 5 })];
    expect(remainingNote(items)).toContain("1 item stays behind");
  });

  it("says the haul is done when the box holds everything", () => {
    expect(remainingNote([item({ id: 1, stage: "parcel" })])).toBe("Nothing left. This haul is done.");
  });

  it("drops the storage clock when no item left behind has one", () => {
    const items = [item({ id: 1, stage: "parcel" }), item({ id: 2, stage: "qcd", storage: null })];
    expect(remainingNote(items)).toBe("1 item stays behind. They can go in parcel B.");
  });

  it("asks one fit question per packed item", () => {
    const items = [
      item({ id: 1, stage: "parcel", title: "Cargo trousers", size: "Large", order: "SB-1" }),
      item({ id: 2, stage: "warehouse" }),
    ];
    const rows = fitRows(items, {});
    expect(rows).toHaveLength(1);
    expect(rows[0].sizeLine).toBe("Large · SB-1");
    expect(rows[0].answer).toBe(null);
    expect(rows[0].options).toEqual(["tight", "right", "roomy"]);
    expect(FIT_OPTIONS).toEqual(["tight", "right", "roomy"]);
  });

  it("never asks how a red-lit item fitted, because it went back", () => {
    const items = [item({ id: 1, stage: "parcel", qc: "red", reason: "wrong-size" })];
    expect(fitRows(items, {})).toHaveLength(0);
  });

  it("keeps a saved answer and ignores one it does not recognise", () => {
    const items = [item({ id: 1, stage: "parcel" }), item({ id: 2, stage: "parcel" })];
    const rows = fitRows(items, { 1: "roomy", 2: "enormous" });
    expect(rows[0].answer).toBe("roomy");
    expect(rows[1].answer).toBe(null);
  });

  it("hides the fit questions until the box arrives", () => {
    const items = [item({ id: 1, stage: "parcel" })];
    expect(trackingView({ items, milestone: 2 }).fits).toHaveLength(0);
    expect(trackingView({ items, milestone: 2 }).received).toBe(false);
    expect(trackingView({ items, milestone: 3 }).fits).toHaveLength(1);
    expect(trackingView({ items, milestone: 3 }).received).toBe(true);
  });

  it("adds the goods, the domestic leg and the line into one landed number", () => {
    const items = [
      item({ id: 1, stage: "parcel", price: 42, actual: 500, vol: 0 }),
      item({ id: 2, stage: "parcel", price: 58, actual: 500, vol: 0 }),
    ];
    const maths = parcelMaths({ items });
    const view = trackingView({ items, maths, line: "EMS", domesticUsd: 18.4, milestone: 0 });
    expect(view.goods).toBe("$100.00");
    expect(view.domestic).toBe("$18.40");
    expect(view.landed).toBe(
      "$" + (100 + 18.4 + costOfLine(defaultRates().EMS, maths.billedKg)).toFixed(2)
    );
    expect(view.landed).toBe(
      "$" + landedTotal({ maths, line: "EMS", domesticUsd: 18.4 }).toFixed(2)
    );
  });

  it("works out its own numbers when the screen hands it none", () => {
    const items = [item({ id: 1, stage: "parcel", price: 42, actual: 500, vol: 0 })];
    expect(trackingView({ items }).goods).toBe("$42.00");
  });
});
