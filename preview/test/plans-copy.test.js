// Feature 2 · the tier spine.
// Sign-in handoff README, "The plan spine this rests on" plus its open
// product question. Kyle 2026-08-02 resolved that question against the
// shipped server: a free account raises the card ceiling, it does not
// remove it. These tests hold every surface to that one answer.
import { describe, it, expect } from "vitest";
import {
  PLAN_COPY,
  PLAN_REASSURANCE,
  PLAN_ROWS,
  PLAN_ROWS_NOTE,
  TIERS,
} from "../../components/plans.js";
import { PLAN_CAPS } from "../src/usage.js";
import { ANON_FREE_CARDS } from "../src/limits.js";

const everyString = [
  ...Object.values(PLAN_COPY),
  PLAN_ROWS_NOTE,
  ...PLAN_ROWS.flatMap((r) => [r.label, r.note, r.free, r.pro]),
  ...PLAN_REASSURANCE.flatMap((c) => [c.kicker, c.head, c.body]),
  ...Object.values(TIERS).flatMap((t) => [t.flag, t.cardsLine]),
];

describe("plan spine · numbers", () => {
  it("reads every cap from the server-bound tables, not from a literal", () => {
    expect(TIERS.anon.cards).toBe(ANON_FREE_CARDS);
    expect(TIERS.free.cards).toBe(PLAN_CAPS.free.resolveTotal);
    expect(TIERS.pro.cards).toBe(PLAN_CAPS.pro.resolvePerMonth);
  });

  it("gives a free account more cards than a signed-out device", () => {
    expect(TIERS.free.cards).toBeGreaterThan(TIERS.anon.cards);
    expect(TIERS.pro.cards).toBeGreaterThan(TIERS.free.cards);
  });

  it("prints the free card number on all four surfaces that mention it", () => {
    const free = String(PLAN_CAPS.free.resolveTotal);
    expect(PLAN_COPY.capBody).toContain(free);
    expect(PLAN_COPY.signInBody).toContain(free);
    expect(PLAN_COPY.freeCardBody).toContain(free);
    expect(PLAN_COPY.settingsSignedOutBody).toContain(free);
    expect(PLAN_COPY.menuFreeSub).toContain(free);
  });

  it("names the signed-out cap wherever it explains the wall", () => {
    const anon = String(ANON_FREE_CARDS);
    expect(PLAN_COPY.capBody).toContain(anon);
    expect(PLAN_COPY.settingsSignedOutBody).toContain(anon);
  });

  it("keeps one row per meter and lists eight of them", () => {
    // Kyle 2026-08-02 removed the Ask row: nine became eight. The Ask cap is
    // still enforced. The plan table no longer sells it.
    expect(PLAN_ROWS).toHaveLength(8);
    const labels = PLAN_ROWS.map((r) => r.label);
    expect(new Set(labels).size).toBe(8);
    expect(labels).not.toContain("Ask questions about your shelf");
    // The README's "Link resolves" row repeated the cards number under a
    // second name. One meter, one row.
    expect(labels).not.toContain("Link resolves");
  });

  it("matches every table number to the server caps", () => {
    const byLabel = Object.fromEntries(PLAN_ROWS.map((r) => [r.label, r]));
    expect(byLabel["AI size-chart reads"].free).toBe(PLAN_CAPS.free.chartVisionTotal + " total");
    expect(byLabel["AI size-chart reads"].pro).toBe(PLAN_CAPS.pro.chartVisionPerMonth + " a month");
    expect(byLabel["Hauls at once"].pro).toBe(String(PLAN_CAPS.pro.haulsMax));
    expect(byLabel["QC photos an item"].free).toBe(String(PLAN_CAPS.free.qcPhotosPerItem));
    expect(byLabel["Shared haul links"].pro).toBe(String(PLAN_CAPS.pro.sharedLinksMax));
  });
});

describe("plan spine · voice", () => {
  it("never calls any tier unlimited", () => {
    for (const s of everyString) expect(s).not.toMatch(/unlimited/i);
  });

  it("uses no emoji, no exclamation mark and no em dash", () => {
    for (const s of everyString) {
      expect(s).not.toMatch(/!/);
      expect(s).not.toMatch(/—/);
      expect(s).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });

  it("separates with the middle dot and nothing else", () => {
    for (const s of everyString) {
      expect(s).not.toMatch(/\s\|\s/);
      expect(s).not.toMatch(/\s\/\s/);
    }
  });

  it("ends every sentence of body copy in a full stop", () => {
    const bodies = [
      ...Object.values(PLAN_COPY).filter((s) => /\s/.test(s) && !s.startsWith("Free ·")),
      PLAN_ROWS_NOTE,
      ...PLAN_REASSURANCE.flatMap((c) => [c.head, c.body]),
    ];
    for (const s of bodies) expect(s.endsWith(".")).toBe(true);
  });
});
