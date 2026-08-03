import { describe, it, expect } from "vitest";
import { mergeLoadedItems, migrateItem } from "../../credenza-fashion.jsx";

describe("mergeLoadedItems (storage race, audit 2026-07-24)", () => {
  const stored = [
    { id: "s1", title: "Stored one" },
    { id: "s2", title: "Stored two" },
  ];

  it("keeps an item stashed during the load window", () => {
    const stashed = { id: "new1", title: "Fast stash" };
    const merged = mergeLoadedItems(stored, [stashed]);
    expect(merged.map((x) => x.id)).toEqual(["new1", "s1", "s2"]);
  });

  it("returns the stored list untouched when nothing happened during load", () => {
    const merged = mergeLoadedItems(stored, []);
    expect(merged).toBe(stored);
    expect(merged.map((x) => x.id)).toEqual(["s1", "s2"]);
  });

  it("does not duplicate an id that exists in both lists", () => {
    const dup = { id: "s1", title: "Stale in-memory copy" };
    const merged = mergeLoadedItems(stored, [dup]);
    expect(merged.filter((x) => x.id === "s1")).toHaveLength(1);
    expect(merged.find((x) => x.id === "s1").title).toBe("Stored one");
  });

  it("keeps several during-load items ahead of the stored order", () => {
    const merged = mergeLoadedItems(stored, [
      { id: "a" },
      { id: "b" },
    ]);
    expect(merged.map((x) => x.id)).toEqual(["a", "b", "s1", "s2"]);
  });
});

describe("migrateItem poster data (audit 2026-07-24)", () => {
  const base = {
    id: "p1",
    createdAt: 100,
    rawText: "https://weidian.com/item.html?itemID=1",
    url: "https://weidian.com/item.html?itemID=1",
    title: "Haul tee",
    posterStats: { height: "180cm", weight: "75kg", size: "L" },
    posterUser: "hauler42",
    sourceText: "stats: 180cm 75kg size L\n[tee](https://weidian.com/item.html?itemID=1)",
    findSource: "https://www.reddit.com/r/FashionReps/comments/abc/haul/",
  };

  it("keeps the hand-picked category pin across a reload (CH-07 follow-up)", () => {
    const migrated = migrateItem({ ...base, category: "shoes", categoryManual: true });
    expect(migrated.category).toBe("shoes");
    expect(migrated.categoryManual).toBe(true);
    // Absent or junk pins default to false — the auto-classify path owns it.
    expect(migrateItem({ ...base, category: "shoes" }).categoryManual).toBe(false);
    expect(migrateItem({ ...base, category: "shoes", categoryManual: "yes" }).categoryManual).toBe(false);
  });

  it("keeps posterStats, posterUser, and sourceText across a reload", () => {
    const migrated = migrateItem(base);
    expect(migrated.posterStats).toEqual({ height: "180cm", weight: "75kg", size: "L" });
    expect(migrated.posterUser).toBe("hauler42");
    expect(migrated.sourceText).toBe(base.sourceText);
  });

  it("keeps descImages across a reload and gates junk", () => {
    const migrated = migrateItem({
      ...base,
      descImages: ["https://si.geilicdn.com/a_467_207.jpg", "data:image/png;base64,AAAA", 42],
    });
    expect(migrated.descImages).toEqual(["https://si.geilicdn.com/a_467_207.jpg"]);
    expect(migrateItem({ id: "p3", rawText: "note" }).descImages).toEqual([]);
  });

  it("keeps sizeChartSource across a reload and gates junk", () => {
    const migrated = migrateItem({
      ...base,
      sizeChartSource: { via: "desc-photos", photos: 10, at: "2026-07-25T01:00:00.000Z" },
    });
    expect(migrated.sizeChartSource).toEqual({
      via: "desc-photos",
      photos: 10,
      imageHash: "",
      at: "2026-07-25T01:00:00.000Z",
      // The source can name the seller for display and support work.
      seller: "",
    });
    // Junk shapes sanitize, absent defaults to null.
    expect(
      migrateItem({ ...base, sizeChartSource: { via: 42, photos: "lots", at: null } }).sizeChartSource
    ).toEqual({ via: "", photos: 0, at: "", seller: "", imageHash: "" });
    expect(migrateItem({ id: "p4", rawText: "note" }).sizeChartSource).toBe(null);
  });

  it("keeps the item chart fields across a reload", () => {
    const migrated = migrateItem({
      ...base,
      sizeChartText: "M: chest 116\nL: chest 120",
      sizeChartNeedsClear: true,
      sizeChartIgnoreNotes: true,
      sizeChartSource: {
        via: "customer-photo",
        photos: 1,
        at: "2026-07-26T01:00:00.000Z",
        seller: "chromeheartsrep",
      },
    });
    expect(migrated.sizeChartText).toBe("M: chest 116\nL: chest 120");
    expect(migrated.sizeChartNeedsClear).toBe(true);
    expect(migrated.sizeChartIgnoreNotes).toBe(true);
    expect(migrated.sizeChartSource.seller).toBe("chromeheartsrep");
    expect(migrated.sizeChartSource.via).toBe("customer-photo");
    expect(migrateItem(base).sizeChartIgnoreNotes).toBe(false);
    // A non-string seller is not a seller.
    expect(
      migrateItem({ ...base, sizeChartSource: { via: "customer-photo", seller: 42 } }).sizeChartSource
        .seller
    ).toBe("");
  });

  it("defaults the poster fields when they are absent", () => {
    const migrated = migrateItem({ id: "p2", rawText: "note", title: "Note" });
    expect(migrated.posterStats).toBe(null);
    expect(migrated.posterUser).toBe("");
    expect(migrated.sourceText).toBe("");
  });

  it("rejects a malformed posterStats value", () => {
    expect(migrateItem({ ...base, posterStats: "big" }).posterStats).toBe(null);
    expect(migrateItem({ ...base, posterStats: [1, 2] }).posterStats).toBe(null);
  });

  it("keeps the A5/A6 fields across a reload", () => {
    const migrated = migrateItem({
      ...base,
      weightGrams: 430,
      qcPhotos: ["data:image/png;base64,AAAA"],
      qcNote: "stain on sleeve",
      qcVerdictAt: "2026-07-24T10:00:00.000Z",
    });
    expect(migrated.weightGrams).toBe(430);
    expect(migrated.qcPhotos).toEqual(["data:image/png;base64,AAAA"]);
    expect(migrated.qcNote).toBe("stain on sleeve");
    expect(migrated.qcVerdictAt).toBe("2026-07-24T10:00:00.000Z");
  });
});

// ─── Maximal migrateItem round-trip (Claude pure lane, plan §11) ───
import migrateFx from "./fixtures/migrate-maximal.json";

describe("migrateItem maximal round-trip (plan §11)", () => {
  it("keeps every mustSurvive field after JSON clone + migrate", () => {
    const raw = JSON.parse(JSON.stringify(migrateFx.maximal));
    const once = migrateItem(raw);
    const twice = migrateItem(JSON.parse(JSON.stringify(once)));
    for (const field of migrateFx.mustSurvive) {
      expect(twice[field], field).toEqual(once[field]);
      expect(once[field], field + " non-undefined").not.toBe(undefined);
    }
    // Spot-check high-value customer fields
    expect(once.sellerYupooLinks).toEqual(["https://goat.x.yupoo.com/"]);
    expect(once.weightGrams).toBe(950);
    expect(once.variants[0].title).toBe("鞋码");
    expect(once.favorite).toBe(true);
    // "qc" migrates forward to "bought": everything past want was bought
    // (shelf handoff 2026-07-28).
    expect(once.findStatus).toBe("bought");
  });

  it("drops unknown fields (whitelist trap)", () => {
    const once = migrateItem(JSON.parse(JSON.stringify(migrateFx.maximal)));
    expect(once.unknownFieldMustDrop).toBe(undefined);
  });

  for (const edge of migrateFx.edges) {
    it(edge.id, () => {
      const got = migrateItem(edge.input);
      if (edge.expect) {
        for (const [k, v] of Object.entries(edge.expect)) {
          expect(got[k], k).toEqual(v);
        }
      }
      if (edge.expectAbsent) {
        for (const k of edge.expectAbsent) {
          expect(got[k], k).toBe(undefined);
        }
      }
    });
  }
});

// The haul fulfillment fields (haul handoff README, "State").
//
// README: "Three things must survive a reload: item stages (the user's manual
// marking is the only record that exists), the edited rate table, and parcel
// submission/milestone state." This covers the first one. Nothing else in the
// app knows an item reached the warehouse, so a dropped field loses real work.
describe("migrateItem haul fulfillment fields", () => {
  const base = {
    id: "h1",
    createdAt: 100,
    rawText: "https://weidian.com/item.html?itemID=1",
    url: "https://weidian.com/item.html?itemID=1",
    title: "Cargo trousers",
  };

  it("keeps every hand-marked haul field across a reload", () => {
    const migrated = migrateItem({
      ...base,
      haulStage: "qcd",
      haulVerdict: "red",
      haulReason: "stitching",
      haulActualGrams: 512,
      haulVolumeCm3: 3000,
      haulStorageDays: 61,
      haulOrderNo: "SB-8827101",
      haulStageAt: "2026-08-02T00:00:00.000Z",
    });
    expect(migrated.haulStage).toBe("qcd");
    expect(migrated.haulVerdict).toBe("red");
    expect(migrated.haulReason).toBe("stitching");
    expect(migrated.haulActualGrams).toBe(512);
    expect(migrated.haulVolumeCm3).toBe(3000);
    expect(migrated.haulStorageDays).toBe(61);
    expect(migrated.haulOrderNo).toBe("SB-8827101");
    expect(migrated.haulStageAt).toBe("2026-08-02T00:00:00.000Z");
  });

  // Found 2026-08-02. Every writer saves a moment as a number, and the reload
  // kept only text. So the app forgot when an item moved, every single reload.
  it("keeps a date saved as a number, not only one saved as text", () => {
    const migrated = migrateItem({
      ...base,
      haulActualGrams: 512,
      haulStageAt: 1754092800000,
      haulWeighedAt: 1754179200000,
    });
    expect(migrated.haulStageAt).toBe(1754092800000);
    expect(migrated.haulWeighedAt).toBe(1754179200000);
  });

  it("throws away a date that is not a date", () => {
    expect(migrateItem({ ...base, haulWeighedAt: 0 }).haulWeighedAt).toBeNull();
    expect(migrateItem({ ...base, haulWeighedAt: {} }).haulWeighedAt).toBeNull();
    expect(migrateItem({ ...base, haulWeighedAt: undefined }).haulWeighedAt).toBeNull();
  });

  it("reads an item saved before this feature as not bought yet", () => {
    const migrated = migrateItem(base);
    expect(migrated.haulStage).toBe("toOrder");
    expect(migrated.haulVerdict).toBeNull();
    expect(migrated.haulReason).toBeNull();
    expect(migrated.haulActualGrams).toBeNull();
    expect(migrated.haulOrderNo).toBe("");
  });

  it("refuses a stage, a verdict or a reason it does not recognise", () => {
    // The seven-stage findStatus pipeline is gone. One of its old values must
    // not sneak back in through a hand-edited backup.
    const migrated = migrateItem({
      ...base,
      haulStage: "shipped",
      haulVerdict: "amber",
      haulReason: "smells odd",
    });
    expect(migrated.haulStage).toBe("toOrder");
    expect(migrated.haulVerdict).toBeNull();
    expect(migrated.haulReason).toBeNull();
  });

  it("treats a zero or negative weight as not weighed yet", () => {
    expect(migrateItem({ ...base, haulActualGrams: 0 }).haulActualGrams).toBeNull();
    expect(migrateItem({ ...base, haulActualGrams: -5 }).haulActualGrams).toBeNull();
    expect(migrateItem({ ...base, haulActualGrams: "512" }).haulActualGrams).toBeNull();
  });

  it("keeps a storage clock that has run out", () => {
    // Zero days left is a real, urgent state. It is not a missing value.
    expect(migrateItem({ ...base, haulStorageDays: 0 }).haulStorageDays).toBe(0);
    expect(migrateItem({ ...base, haulStorageDays: -1 }).haulStorageDays).toBeNull();
  });

  it("caps a very long order number", () => {
    const migrated = migrateItem({ ...base, haulOrderNo: "S".repeat(200) });
    expect(migrated.haulOrderNo).toHaveLength(64);
  });
});
