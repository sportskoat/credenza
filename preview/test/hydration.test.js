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

  it("keeps posterStats, posterUser, and sourceText across a reload", () => {
    const migrated = migrateItem(base);
    expect(migrated.posterStats).toEqual({ height: "180cm", weight: "75kg", size: "L" });
    expect(migrated.posterUser).toBe("hauler42");
    expect(migrated.sourceText).toBe(base.sourceText);
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
