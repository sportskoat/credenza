// The link indexing strip's pure logic (components/indexing.js).
//
// Pins the rules the driver and the strip both lean on:
//   1. A row paints from the URL alone on the paste frame (platform + ID).
//   2. The stage label never moves the row: fixed words, tabular counts.
//   3. Progress only moves forward; every state has a target.
//   4. The header says what is happening in one line.
//   5. Visible rows keep paste order while live; completed rows leave first
//      over the cap; failed rows sink only after everything settles.
//   6. A card that gained nothing a person can see is the failed state.
import { describe, expect, it } from "vitest";

import {
  FAIL_COPY,
  failCopy,
  failReasonFor,
  gainedNothing,
  headerFor,
  isSettled,
  parseLinkMeta,
  platformTile,
  rowStageLabel,
  stageProgress,
  visibleRows,
} from "../../components/indexing.js";

describe("parseLinkMeta", () => {
  it("reads a Yupoo album ID from the path", () => {
    const meta = parseLinkMeta("https://x.yupoo.com/albums/12345678?uid=1");
    expect(meta.platform).toBe("yupoo");
    expect(meta.externalId).toBe("12345678");
    expect(meta.label).toBe("12345678");
  });

  it("reads a Weidian item ID from the query", () => {
    const meta = parseLinkMeta("https://weidian.com/item.html?itemID=4455667788");
    expect(meta.platform).toBe("weidian");
    expect(meta.externalId).toBe("4455667788");
  });

  it("reads a Taobao item ID from the query", () => {
    const meta = parseLinkMeta("https://item.taobao.com/item.htm?id=6655443322");
    expect(meta.platform).toBe("taobao");
    expect(meta.externalId).toBe("6655443322");
  });

  it("reads a 1688 offer ID from the path", () => {
    const meta = parseLinkMeta("https://detail.1688.com/offer/7123456789.html");
    expect(meta.platform).toBe("1688");
    expect(meta.externalId).toBe("7123456789");
  });

  it("falls back to the host for an unrecognised link", () => {
    const meta = parseLinkMeta("https://shop.example.com/p/abc");
    expect(meta.platform).toBe("other");
    expect(meta.label).toBe("shop.example.com");
  });

  it("gives an unparseable paste a neutral tile and a text label", () => {
    const meta = parseLinkMeta("not a url");
    expect(meta.platform).toBe("other");
    expect(platformTile(meta.platform).letter).toBe("·");
    expect(meta.label.length).toBeGreaterThan(0);
  });
});

describe("platformTile", () => {
  it("maps every known platform to a letter tile", () => {
    expect(platformTile("yupoo").letter).toBe("Y");
    expect(platformTile("weidian").letter).toBe("W");
    expect(platformTile("taobao").letter).toBe("T");
    expect(platformTile("tmall").letter).toBe("T");
    expect(platformTile("1688").letter).toBe("1");
  });
});

describe("rowStageLabel", () => {
  const base = { state: "photos", revealed: 3, photoTotal: 8 };

  it("names each live stage", () => {
    expect(rowStageLabel({ state: "queued" })).toBe("QUEUED");
    expect(rowStageLabel({ state: "fetching" })).toBe("FETCHING LINK");
    expect(rowStageLabel(base)).toBe("PULLING PHOTOS · 3 / 8");
    expect(rowStageLabel({ state: "sizing" })).toBe("SIZING");
    expect(rowStageLabel({ state: "indexed" })).toBe("INDEXED");
  });

  it("defaults the photo count to 8 when the total is unknown", () => {
    expect(rowStageLabel({ state: "photos", revealed: 1, photoTotal: 0 })).toBe(
      "PULLING PHOTOS · 1 / 8"
    );
  });

  it("says WAITING FOR NETWORK only while offline and not started", () => {
    expect(rowStageLabel({ state: "queued" }, { offline: true })).toBe(
      "WAITING FOR NETWORK"
    );
    expect(rowStageLabel(base, { offline: true })).toBe("PULLING PHOTOS · 3 / 8");
  });

  it("says STILL PULLING PHOTOS past the slow tail", () => {
    expect(rowStageLabel(base, { slowTail: true })).toBe(
      "STILL PULLING PHOTOS · 3 / 8"
    );
  });

  it("says nothing on a failed row (the sentence carries it)", () => {
    expect(rowStageLabel({ state: "failed" })).toBe("");
  });
});

describe("stageProgress", () => {
  it("moves forward through the stages", () => {
    const seq = [
      stageProgress({ state: "queued" }),
      stageProgress({ state: "fetching" }),
      stageProgress({ state: "photos", revealed: 4, photoTotal: 8 }),
      stageProgress({ state: "sizing" }),
      stageProgress({ state: "indexed" }),
    ];
    for (let i = 1; i < seq.length; i++) expect(seq[i]).toBeGreaterThan(seq[i - 1]);
  });

  it("scales the photos stage across 64% of the bar", () => {
    expect(stageProgress({ state: "photos", revealed: 0, photoTotal: 8 })).toBeCloseTo(0.16);
    expect(stageProgress({ state: "photos", revealed: 8, photoTotal: 8 })).toBeCloseTo(0.8);
  });

  it("never exceeds the bar when more photos arrive than expected", () => {
    expect(stageProgress({ state: "photos", revealed: 20, photoTotal: 8 })).toBeCloseTo(0.8);
  });

  it("ends full on indexed and failed", () => {
    expect(stageProgress({ state: "indexed" })).toBe(1);
    expect(stageProgress({ state: "failed" })).toBe(1);
  });
});

describe("headerFor", () => {
  it("says Indexing for one live link", () => {
    expect(headerFor([{ state: "fetching", revealed: 0, photoTotal: 0 }]).headline).toBe(
      "Indexing"
    );
  });

  it("counts links for many live rows", () => {
    const rows = [
      { state: "fetching", revealed: 0, photoTotal: 0 },
      { state: "photos", revealed: 2, photoTotal: 8 },
      { state: "queued", revealed: 0, photoTotal: 0 },
    ];
    expect(headerFor(rows).headline).toBe("Indexing 3 links");
  });

  it("totals the photos in the detail while live", () => {
    const rows = [
      { state: "photos", revealed: 2, photoTotal: 8 },
      { state: "photos", revealed: 1, photoTotal: 4 },
    ];
    expect(headerFor(rows).detail).toBe("3 OF 12 PHOTOS");
  });

  it("says Indexed when the only link finishes", () => {
    expect(headerFor([{ state: "indexed", revealed: 8, photoTotal: 8 }]).headline).toBe(
      "Indexed"
    );
  });

  it("counts links when many finish clean", () => {
    const rows = [
      { state: "indexed", revealed: 8, photoTotal: 8 },
      { state: "indexed", revealed: 8, photoTotal: 8 },
    ];
    expect(headerFor(rows).headline).toBe("2 links indexed");
  });

  it("says N of M indexed and N NEEDS YOU when a row fails", () => {
    const rows = [
      { state: "indexed", revealed: 8, photoTotal: 8 },
      { state: "failed", failReason: "private" },
    ];
    const header = headerFor(rows);
    expect(header.headline).toBe("1 of 2 indexed");
    expect(header.detail).toBe("1 NEEDS YOU");
  });

  it("returns empty copy for no rows", () => {
    expect(headerFor([])).toEqual({ headline: "", detail: "" });
  });
});

describe("visibleRows", () => {
  const row = (id, state) => ({ id, state });

  it("keeps paste order while anything is live", () => {
    const rows = [row("a", "indexed"), row("b", "photos"), row("c", "failed")];
    expect(visibleRows(rows, 4).map((r) => r.id)).toEqual(["a", "b", "c"]);
  });

  it("sinks failed rows only once every row has settled", () => {
    const rows = [row("a", "failed"), row("b", "indexed"), row("c", "indexed")];
    expect(visibleRows(rows, 4).map((r) => r.id)).toEqual(["b", "c", "a"]);
  });

  it("lets completed rows leave first when over the cap", () => {
    const rows = [
      row("a", "indexed"),
      row("b", "photos"),
      row("c", "queued"),
      row("d", "queued"),
      row("e", "queued"),
    ];
    const visible = visibleRows(rows, 4).map((r) => r.id);
    expect(visible).toContain("b");
    expect(visible).toContain("c");
    expect(visible).toContain("d");
    expect(visible).toContain("e");
    expect(visible).not.toContain("a");
  });

  it("keeps unsettled rows ahead of settled ones over the cap", () => {
    const rows = [
      row("a", "indexed"),
      row("b", "indexed"),
      row("c", "indexed"),
      row("d", "indexed"),
      row("e", "queued"),
    ];
    const visible = visibleRows(rows, 4).map((r) => r.id);
    expect(visible).toContain("e");
    expect(visible).toHaveLength(4);
  });

  it("returns every row when under the cap", () => {
    const rows = [row("a", "queued"), row("b", "fetching")];
    expect(visibleRows(rows, 4)).toHaveLength(2);
  });
});

describe("isSettled", () => {
  it("settles only on indexed or failed", () => {
    expect(isSettled({ state: "indexed" })).toBe(true);
    expect(isSettled({ state: "failed" })).toBe(true);
    expect(isSettled({ state: "photos" })).toBe(false);
    expect(isSettled({ state: "queued" })).toBe(false);
  });
});

describe("gainedNothing", () => {
  it("is true for a bare URL card", () => {
    expect(
      gainedNothing({ title: "https://weidian.com/item.html?itemID=1", price: null })
    ).toBe(true);
  });

  it("is false once a photo, a price, or a title lands", () => {
    expect(gainedNothing({ image: "https://img/x.jpg" })).toBe(false);
    expect(gainedNothing({ gallery: ["https://img/x.jpg"] })).toBe(false);
    expect(gainedNothing({ price: 120 })).toBe(false);
    expect(gainedNothing({ title: "Corduroy jacket" })).toBe(false);
  });

  it("treats the stash-time placeholder title as nothing gained", () => {
    // The stash names a bare link from its URL ("Weidian item 1050…"). A dead
    // read keeps that name, so a non-URL title alone cannot mark a success —
    // the probe watched a 500'd link settle as "indexed" until bornTitle
    // taught the check what the card started with.
    const born = "Weidian item 105000972378";
    expect(gainedNothing({ title: born, price: null }, born)).toBe(true);
    expect(gainedNothing({ title: "Corduroy jacket", price: null }, born)).toBe(false);
    expect(gainedNothing({ title: born, image: "https://img/x.jpg" }, born)).toBe(false);
  });
});

describe("failCopy and failReasonFor", () => {
  it("has a sentence for every reason", () => {
    for (const reason of Object.keys(FAIL_COPY)) {
      expect(failCopy(reason).length).toBeGreaterThan(0);
    }
  });

  it("falls back to the unknown sentence", () => {
    expect(failCopy("bogus")).toBe(FAIL_COPY.unknown);
  });

  it("calls a dead Yupoo read private", () => {
    expect(failReasonFor({ url: "https://x.yupoo.com/albums/12345678" })).toBe("private");
    expect(failReasonFor({ url: "https://weidian.com/item.html?itemID=1" })).toBe(
      "unknown"
    );
  });
});
