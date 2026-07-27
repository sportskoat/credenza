// Handoff turn 9 §3 — the seller cache.
//
// One seller's tag chart covers every item they list. Reading it again for the
// second item costs money and returns the same numbers, so the second item
// must answer from the shelf.
//
// The cache IS the shelf. Every item already carries its chart in `sizeNotes`
// and its provenance in `sizeChartSource`, so a separate store would only be a
// copy that can go stale against the original.
//
// Two rules keep it honest:
//   - only READ charts qualify (CHART_CACHE_VIA), so a guess never spreads;
//   - the newest `at` wins, because a retake corrects an earlier read.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { chartCacheForSeller } from "../../credenza-fashion.jsx";

const { huntMock } = vi.hoisted(() => ({ huntMock: vi.fn() }));
vi.mock("../../components/size-chart-hunt.js", () => ({ huntSizeChart: huntMock }));
const { default: DetailBody } = await import("../../components/DetailBody.jsx");

const CHART_TEXT = "M: chest 116, length 70\nL: chest 120, length 72\nXL: chest 124, length 74";
const OTHER_CHART = "M: chest 100, length 66\nL: chest 104, length 68";

let seq = 0;
function item(extra = {}) {
  seq += 1;
  return {
    id: "sc-" + seq,
    createdAt: 1753400000000,
    url: "https://weidian.com/item.html?itemID=" + seq,
    title: "Item " + seq,
    seller: "replux",
    category: "shirt",
    findStatus: "want",
    ...extra,
  };
}

function withChart(extra = {}) {
  return item({
    sizeNotes: CHART_TEXT,
    sizeChartSource: {
      via: "customer-photo",
      photos: 1,
      at: "2026-07-25T10:00:00.000Z",
      seller: "replux",
    },
    ...extra,
  });
}

describe("chartCacheForSeller", () => {
  it("finds a read chart from the same seller", () => {
    const donor = withChart();
    const target = item();
    const hit = chartCacheForSeller([donor, target], target);
    expect(hit).not.toBe(null);
    expect(hit.text).toBe(CHART_TEXT);
    expect(hit.seller).toBe("replux");
  });

  it("matches the seller case-insensitively, ignoring stray spacing", () => {
    const donor = withChart({ seller: "  RePluX " });
    const target = item({ seller: "replux" });
    expect(chartCacheForSeller([donor, target], target)).not.toBe(null);
  });

  it("never crosses sellers", () => {
    const donor = withChart({
      seller: "chromeheartsrep",
      sizeChartSource: {
        via: "customer-photo",
        photos: 1,
        at: "2026-07-25T10:00:00.000Z",
        seller: "chromeheartsrep",
      },
    });
    const target = item({ seller: "replux" });
    expect(chartCacheForSeller([donor, target], target)).toBe(null);
  });

  it("trusts the chart's own tag over the item it is sitting on", () => {
    // A chart tagged for one seller must not be reused for another just
    // because the item carrying it was relisted or retitled. The tag records
    // which seller the numbers were read for; the item's field does not.
    const donor = withChart({
      seller: "replux",
      sizeChartSource: {
        via: "customer-photo",
        photos: 1,
        at: "2026-07-25T10:00:00.000Z",
        seller: "chromeheartsrep",
      },
    });
    expect(chartCacheForSeller([donor, item({ seller: "replux" })], item({ seller: "replux" }))).toBe(
      null
    );
    expect(
      chartCacheForSeller([donor, item({ seller: "chromeheartsrep" })], item({ seller: "chromeheartsrep" }))
    ).not.toBe(null);
  });

  it("refuses to answer for an item with no seller", () => {
    // With no seller there is no key, and any hit would be a guess dressed as
    // a fact.
    const donor = withChart();
    const target = item({ seller: "" });
    expect(chartCacheForSeller([donor, target], target)).toBe(null);
  });

  it("ignores a chart the customer typed or the app guessed", () => {
    // `via: "manual"` is not in CHART_CACHE_VIA. A hand-typed chart may be
    // right for the item it was typed on and wrong for every other one.
    const donor = withChart({
      sizeChartSource: { via: "manual", photos: 0, at: "2026-07-25T10:00:00.000Z", seller: "replux" },
    });
    const target = item();
    expect(chartCacheForSeller([donor, target], target)).toBe(null);
  });

  it("ignores an untagged chart", () => {
    const donor = item({ sizeNotes: CHART_TEXT, sizeChartSource: null });
    const target = item();
    expect(chartCacheForSeller([donor, target], target)).toBe(null);
  });

  it("ignores a chart whose text no longer parses", () => {
    const donor = withChart({ sizeNotes: "runs a bit small tbh" });
    const target = item();
    expect(chartCacheForSeller([donor, target], target)).toBe(null);
  });

  it("takes the newest read when a seller has two", () => {
    const old = withChart({
      sizeNotes: OTHER_CHART,
      sizeChartSource: {
        via: "album-photos",
        photos: 2,
        at: "2026-07-20T10:00:00.000Z",
        seller: "replux",
      },
    });
    const fresh = withChart({
      sizeChartSource: {
        via: "customer-photo",
        photos: 1,
        at: "2026-07-26T10:00:00.000Z",
        seller: "replux",
      },
    });
    const target = item();
    // Order in the shelf must not decide the answer.
    expect(chartCacheForSeller([old, fresh, target], target).text).toBe(CHART_TEXT);
    expect(chartCacheForSeller([fresh, old, target], target).text).toBe(CHART_TEXT);
  });

  it("never returns the item's own chart", () => {
    const self = withChart();
    expect(chartCacheForSeller([self], self)).toBe(null);
  });

  it("falls back to the donor's own seller field when the tag omits it", () => {
    // Charts read before the cache shipped carry no seller tag. The item they
    // sit on still names the seller, and that is the same fact.
    const donor = withChart({
      seller: "replux",
      sizeChartSource: { via: "album-text", photos: 0, at: "2026-07-25T10:00:00.000Z", seller: "" },
    });
    const target = item();
    expect(chartCacheForSeller([donor, target], target)).not.toBe(null);
  });

  it("survives junk in the shelf", () => {
    const target = item();
    expect(chartCacheForSeller([null, undefined, {}, target], target)).toBe(null);
    expect(chartCacheForSeller(null, target)).toBe(null);
  });
});

describe("§3 cache in the sizing block", () => {
  beforeEach(() => {
    huntMock.mockResolvedValue(null);
  });
  afterEach(() => {
    cleanup();
    huntMock.mockReset();
  });

  function renderBody(target, shelfItems, onSaveEdit = vi.fn()) {
    render(
      <DetailBody
        item={target}
        shelfItems={shelfItems}
        bodyProfile={{ chest: "96", height: "180", weight: "75" }}
        buyLabel="Buy via Superbuy"
        onSaveEdit={onSaveEdit}
        onOpen={vi.fn()}
        onAttachPhoto={vi.fn()}
        onRemovePhoto={vi.fn()}
        onOpenSizes={vi.fn()}
      />
    );
    return onSaveEdit;
  }

  it("sizes a second item from the cache, with no vision read", async () => {
    const donor = withChart();
    const target = item();
    const onSaveEdit = renderBody(target, [donor, target]);

    await waitFor(() =>
      expect(onSaveEdit).toHaveBeenCalledWith(target.id, {
        sizeNotes: CHART_TEXT,
        sizeChartSource: {
          via: "seller-cache",
          photos: 0,
          at: expect.any(String),
          seller: "replux",
        },
      })
    );
    // The whole point: the cache is free.
    expect(huntMock).not.toHaveBeenCalled();
  });

  it("still hunts when the shelf holds no chart for this seller", async () => {
    const donor = withChart({
      seller: "someoneelse",
      sizeChartSource: {
        via: "customer-photo",
        photos: 1,
        at: "2026-07-25T10:00:00.000Z",
        seller: "someoneelse",
      },
    });
    const target = item();
    renderBody(target, [donor, target]);

    await waitFor(() => expect(huntMock).toHaveBeenCalledTimes(1));
  });

  it("labels a cached chart as cached, not as the seller's own read", async () => {
    // Provenance must not claim this listing was read. The customer needs to
    // know the numbers came from a sibling item.
    const target = item({
      sizeNotes: CHART_TEXT,
      sizeChartSource: {
        via: "seller-cache",
        photos: 0,
        at: "2026-07-26T10:00:00.000Z",
        seller: "replux",
      },
    });
    renderBody(target, [target]);

    expect(await screen.findByText("FROM REPLUX'S CHART (CACHED)")).toBeInTheDocument();
    expect(screen.queryByText("SELLER'S CHART")).toBe(null);
  });
});
