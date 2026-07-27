// LB-7 merge core. Every test here is a way a user loses work, written as the
// scenario rather than as an assertion about the implementation.
//
// The two that matter most, and they pull in opposite directions:
//   - A delete that does not stay deleted (a union resurrects it).
//   - A delete that was never asked for (an empty new device erases the
//     account).
// Both are in this file, and a change that fixes one by breaking the other
// fails here.
import { describe, expect, it } from "vitest";
import {
  SHELF_DOC_VERSION,
  TOMBSTONE_TTL_MS,
  addTombstones,
  clearTombstones,
  itemStamp,
  mergeShelves,
  parseShelfDoc,
  pickItem,
  sweepTombstones,
  toShelfDoc,
} from "../../credenza-sync-merge.js";

const T0 = 1_700_000_000_000;
const card = (id, at, extra = {}) => ({
  id,
  title: "Card " + id,
  createdAt: at,
  updatedAt: at,
  ...extra,
});

describe("itemStamp", () => {
  it("uses the later of updatedAt and createdAt", () => {
    expect(itemStamp({ createdAt: T0, updatedAt: T0 + 5 })).toBe(T0 + 5);
    expect(itemStamp({ createdAt: T0 + 5, updatedAt: T0 })).toBe(T0 + 5);
  });

  it("reads a card with no stamps as the oldest possible", () => {
    // Losing is the safe direction: the other side then supplies the fields.
    expect(itemStamp({ id: "x" })).toBe(0);
    expect(itemStamp(null)).toBe(0);
  });
});

describe("pickItem", () => {
  it("keeps the newer edit", () => {
    const older = card("a", T0);
    const newer = card("a", T0 + 1000, { title: "Renamed" });
    expect(pickItem(older, newer)).toBe(newer);
    expect(pickItem(newer, older)).toBe(newer);
  });

  it("is deterministic on a tie, or the devices push at each other forever", () => {
    const a = card("a", T0, { title: "one" });
    const b = card("a", T0, { title: "two" });
    expect(pickItem(a, b)).toBe(pickItem(b, a));
  });

  it("never merges fields across two versions of a card", () => {
    // A title from one device and a price from the other is a card neither
    // user ever saw. The whole card wins or loses.
    const mine = card("a", T0 + 10, { title: "Mine", price: 100 });
    const theirs = card("a", T0, { title: "Theirs", price: 200 });
    expect(pickItem(mine, theirs)).toEqual(mine);
  });
});

describe("tombstones", () => {
  it("records a delete and keeps the later stamp on a re-delete", () => {
    let t = addTombstones({}, "a", T0);
    expect(t.a).toBe(T0);
    t = addTombstones(t, "a", T0 - 500);
    expect(t.a).toBe(T0); // not moved backwards
    t = addTombstones(t, "a", T0 + 500);
    expect(t.a).toBe(T0 + 500);
  });

  it("clears on undo, or Undo would put a card back and sync would eat it", () => {
    const t = addTombstones({}, ["a", "b"], T0);
    expect(clearTombstones(t, "a")).toEqual({ b: T0 });
  });

  it("does not mutate the map it is given", () => {
    const t = {};
    addTombstones(t, "a", T0);
    expect(t).toEqual({});
  });

  it("sweeps past the TTL", () => {
    const t = { old: T0, fresh: T0 + TOMBSTONE_TTL_MS - 1000 };
    expect(sweepTombstones(t, T0 + TOMBSTONE_TTL_MS)).toEqual({
      fresh: T0 + TOMBSTONE_TTL_MS - 1000,
    });
  });
});

describe("mergeShelves — the delete that must stay deleted", () => {
  it("does not resurrect a card the other device deleted", () => {
    // Device A deleted card 2 and pushed. Device B still holds it.
    const remote = { items: [card("1", T0), card("3", T0)], tombstones: { 2: T0 + 100 } };
    const local = { items: [card("1", T0), card("2", T0), card("3", T0)], tombstones: {} };
    const out = mergeShelves(local, remote, { now: T0 + 200 });
    expect(out.items.map((x) => x.id)).toEqual(["1", "3"]);
    expect(out.stats.deleted).toBe(1);
  });

  it("keeps an edit made AFTER the delete", () => {
    // The user deleted the card on the phone, then typed into it on the
    // laptop. The typing is the later intent and wins.
    const remote = { items: [], tombstones: { 2: T0 } };
    const local = { items: [card("2", T0 + 5000, { title: "Still want this" })] };
    const out = mergeShelves(local, remote, { now: T0 + 6000 });
    expect(out.items.map((x) => x.id)).toEqual(["2"]);
    // The tombstone is dropped, or the card dies again on the next sync.
    expect(out.tombstones["2"]).toBeUndefined();
  });

  it("carries the tombstone forward so the third device also deletes", () => {
    const out = mergeShelves(
      { items: [card("1", T0)] },
      { items: [card("1", T0)], tombstones: { 9: T0 } },
      { now: T0 + 10 }
    );
    expect(out.tombstones["9"]).toBe(T0);
  });
});

describe("mergeShelves — the delete that was never asked for", () => {
  it("a brand-new empty device does NOT erase the account", () => {
    // The single worst outcome in the feature. Absence is not a delete.
    const remote = { items: [card("1", T0), card("2", T0), card("3", T0)] };
    const local = { items: [], tombstones: {} };
    const out = mergeShelves(local, remote, { now: T0 + 100 });
    expect(out.items.map((x) => x.id)).toEqual(["1", "2", "3"]);
    expect(out.stats.deleted).toBe(0);
  });

  it("an empty remote does not erase the device", () => {
    const out = mergeShelves({ items: [card("1", T0)] }, { items: [] }, { now: T0 + 100 });
    expect(out.items).toHaveLength(1);
  });

  it("a missing remote document changes nothing", () => {
    const out = mergeShelves({ items: [card("1", T0)] }, null, { now: T0 });
    expect(out.items).toHaveLength(1);
    expect(out.changedLocal).toBe(false);
  });
});

describe("mergeShelves — two devices editing at once", () => {
  it("keeps BOTH edits when they touch different cards", () => {
    // A document-level last-write-wins throws one of these away. That is the
    // second most common way a user loses work.
    const local = { items: [card("1", T0 + 500, { title: "Phone edit" }), card("2", T0)] };
    const remote = { items: [card("1", T0), card("2", T0 + 400, { title: "Laptop edit" })] };
    const out = mergeShelves(local, remote, { now: T0 + 600 });
    expect(out.items.find((x) => x.id === "1").title).toBe("Phone edit");
    expect(out.items.find((x) => x.id === "2").title).toBe("Laptop edit");
  });

  it("the later edit wins on the same card", () => {
    const local = { items: [card("1", T0 + 100, { title: "Older" })] };
    const remote = { items: [card("1", T0 + 900, { title: "Newer" })] };
    expect(mergeShelves(local, remote, { now: T0 + 1000 }).items[0].title).toBe("Newer");
  });

  it("adds a card each device has that the other does not", () => {
    const out = mergeShelves(
      { items: [card("1", T0)] },
      { items: [card("2", T0)] },
      { now: T0 + 10 }
    );
    expect(out.items.map((x) => x.id).sort()).toEqual(["1", "2"]);
  });
});

describe("mergeShelves — the shelf a person is looking at", () => {
  it("keeps local order, so a sync does not reshuffle the screen", () => {
    const local = { items: [card("c", T0), card("a", T0), card("b", T0)] };
    const remote = { items: [card("a", T0), card("b", T0), card("c", T0)] };
    expect(mergeShelves(local, remote, { now: T0 }).items.map((x) => x.id)).toEqual([
      "c",
      "a",
      "b",
    ]);
  });

  it("never emits the same id twice", () => {
    const dupes = [card("1", T0), card("1", T0 + 5)];
    const out = mergeShelves({ items: dupes }, { items: dupes }, { now: T0 + 10 });
    expect(out.items).toHaveLength(1);
  });

  it("drops a card with no id rather than writing a broken row", () => {
    const out = mergeShelves(
      { items: [card("1", T0), { title: "no id" }] },
      { items: [] },
      { now: T0 }
    );
    expect(out.items).toHaveLength(1);
  });

  it("reports whether a write is worth doing", () => {
    const same = [card("1", T0)];
    const quiet = mergeShelves({ items: same }, { items: same }, { now: T0 });
    expect(quiet.changedLocal).toBe(false);
    expect(quiet.changedRemote).toBe(false);

    const busy = mergeShelves({ items: [card("1", T0)] }, { items: [card("2", T0)] }, { now: T0 });
    expect(busy.changedLocal).toBe(true);
    expect(busy.changedRemote).toBe(true);
  });
});

describe("the document on the wire", () => {
  it("round-trips", () => {
    const doc = toShelfDoc([card("1", T0)], { 2: T0 }, T0 + 5);
    const back = parseShelfDoc(JSON.parse(JSON.stringify(doc)));
    expect(back.items).toHaveLength(1);
    expect(back.tombstones).toEqual({ 2: T0 });
    expect(back.v).toBe(SHELF_DOC_VERSION);
  });

  it("refuses anything it cannot trust, and refusing means keep local", () => {
    // A truncated body, a proxy's HTML error page, or a bare array must never
    // read as "the shelf is empty" — that empty would be pushed back over
    // good data on the next write.
    for (const junk of [null, undefined, "", 0, "not json", [], [card("1", T0)], {}, { v: 1 }]) {
      expect(parseShelfDoc(junk)).toBeNull();
    }
  });

  it("refuses a document from a NEWER client", () => {
    // A newer build may carry fields this one would drop on the next push.
    // Refusing to merge is data loss avoided.
    expect(parseShelfDoc({ v: SHELF_DOC_VERSION + 1, items: [] })).toBeNull();
    expect(parseShelfDoc({ v: SHELF_DOC_VERSION, items: [] })).not.toBeNull();
  });

  it("accepts an empty shelf from a valid document", () => {
    // Distinct from the case above: this IS a real shelf that holds nothing,
    // and the merge (not the parser) decides it deletes nothing.
    expect(parseShelfDoc({ v: 1, items: [], updatedAt: T0 })).toEqual({
      v: 1,
      updatedAt: T0,
      items: [],
      tombstones: {},
    });
  });

  it("drops junk rows and junk tombstones rather than failing whole", () => {
    const doc = parseShelfDoc({
      v: 1,
      items: [card("1", T0), null, "x", { title: "no id" }],
      tombstones: { a: T0, b: "nope", c: 0 },
    });
    expect(doc.items).toHaveLength(1);
    expect(doc.tombstones).toEqual({ a: T0 });
  });
});
