// Kyle 2026-08-03: "why didn't this get pulled in. is because im out of free
// cards? if so we need to delegate the reason that this was not pulled in
// BECAUSE the customer is out of cards, and it should pull up a modal".
//
// On Weidian the size chart sits in the product-details feed. Fetching that
// feed costs one card. With the free cards spent the card holds only product
// shots, so the read can only fail. These two say the real reason.
import { afterEach, describe, expect, it } from "vitest";
import { chartCardsCapCopy, chartNeedsCards } from "../../credenza-fashion.jsx";
import { bumpUsage, PLAN_CAPS, USAGE_KEY } from "../src/usage.js";

const freePlan = { state: "free", lim: { ...PLAN_CAPS.free } };
const proPlan = { state: "pro", lim: { ...PLAN_CAPS.pro } };

const weidian = { url: "https://weidian.com/item.html?itemID=7796666481" };

function spendAllCards() {
  for (let i = 0; i < PLAN_CAPS.free.resolveTotal; i += 1) {
    bumpUsage("resolve", { audience: "free" });
  }
}

afterEach(() => {
  window.localStorage.removeItem(USAGE_KEY);
});

describe("chartNeedsCards", () => {
  it("is true for a free card with no photos once the cards run out", () => {
    expect(chartNeedsCards(weidian, freePlan)).toBe(false);
    spendAllCards();
    expect(chartNeedsCards(weidian, freePlan)).toBe(true);
  });

  it("stays false while the card already holds product-details photos", () => {
    spendAllCards();
    const withDesc = { ...weidian, descImages: ["https://si.geilicdn.com/a_1080_776.jpg"] };
    const withChart = { ...weidian, chartImages: ["https://si.geilicdn.com/b.jpg"] };
    expect(chartNeedsCards(withDesc, freePlan)).toBe(false);
    expect(chartNeedsCards(withChart, freePlan)).toBe(false);
  });

  it("stays false when no card can be spent on the link anyway", () => {
    spendAllCards();
    expect(chartNeedsCards({ url: "https://example.com/thing" }, freePlan)).toBe(false);
    expect(chartNeedsCards({}, freePlan)).toBe(false);
    expect(chartNeedsCards(null, freePlan)).toBe(false);
  });

  it("never blocks a Pro customer or a signed-out one", () => {
    spendAllCards();
    expect(chartNeedsCards(weidian, proPlan)).toBe(false);
    expect(chartNeedsCards(weidian, null)).toBe(false);
  });
});

describe("chartCardsCapCopy", () => {
  it("names the cards count, not the chart-read count", () => {
    const copy = chartCardsCapCopy(freePlan);
    expect(copy).toContain("product details");
    expect(copy).toContain("costs one card");
    expect(copy).toContain("your " + PLAN_CAPS.free.resolveTotal + " free cards");
    expect(copy).toContain("Upgrade for more.");
    // Not the chart-read sentence. The two counts are separate.
    expect(copy).not.toContain("chart reads");
  });

  it("asks a signed-out person to sign in instead of to upgrade", () => {
    const copy = chartCardsCapCopy(null);
    expect(copy).toContain("Sign in for more.");
    expect(copy).not.toContain("Upgrade");
  });

  it("writes no em dash", () => {
    expect(chartCardsCapCopy(freePlan)).not.toContain("—");
    expect(chartCardsCapCopy(proPlan)).not.toContain("—");
  });
});
