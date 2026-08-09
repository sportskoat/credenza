// Chart hunt (components/DetailBody.jsx) regression tests.
// 2026-07-25, Kyle: "WHAT IS GOING ON WITH THE SIZING CHARTS. WHY CAN'T IT
// WORK WITH RECOMMENDED SIZES." Root cause: the silent chart hunt lived in
// the orphaned desktop SizeRecommendation panel, so the live FitBlock only
// ever READ charts — it never fetched them. The hunt runs once per item
// (album text, then a vision read of the photos), writes the item chart field,
// and the recommendation appears.
//
// The hunt starts when the detail opens. The Size tab keeps the item size,
// recommendation, and seller chart together. No extra route opens the chart.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const { huntMock } = vi.hoisted(() => ({ huntMock: vi.fn() }));

vi.mock("../../components/size-chart-hunt.js", async () => {
  // Keep the real fingerprint: the hook reads it to skip a stamped miss, and
  // the tests below compute stamps with it. Only the hunt itself is stubbed.
  const actual = await vi.importActual("../../components/size-chart-hunt.js");
  return { ...actual, huntSizeChart: huntMock };
});

// Import AFTER the mock registration so DetailBody binds the stub.
const { default: DetailBody } = await import("../../components/DetailBody.jsx");
const { chartHuntFingerprint, CHART_HUNT_VERSION } = await import("../../components/size-chart-hunt.js");

const CHART_TEXT = "M: chest 116, length 70\nL: chest 120, length 72\nXL: chest 124, length 74";

function noChartItem(id = "hunt-1") {
  return {
    id,
    createdAt: 1753400000000,
    url: "https://weidian.com/item.html?itemID=111",
    title: "Celine Shirt 55or",
    image: "https://si.geilicdn.com/img-1.jpg",
    gallery: ["https://si.geilicdn.com/img-2.jpg"],
    links: [{ url: "https://weidian.com/item.html?itemID=222", role: "buy" }],
    price: 229,
    currency: "CNY",
    seller: "replux",
    category: "shirt",
    findStatus: "want",
  };
}

function renderBody(item, extra = {}) {
  return render(
    <DetailBody
      item={item}
      bodyProfile={{ chest: "96", height: "180", weight: "75" }}
      buyLabel="Buy via Superbuy"
      onSaveEdit={vi.fn()}
      onOpen={vi.fn()}
      onAttachPhoto={vi.fn()}
      onRemovePhoto={vi.fn()}
      onOpenSizes={vi.fn()}
      {...extra}
    />
  );
}

afterEach(() => {
  cleanup();
  huntMock.mockReset();
});

describe("FitBlock chart hunt", () => {
  it("hunts once when the detail opens with no chart, then prescribes", async () => {
    // Hold the hunt open so the "looking" state is observable, then resolve.
    let resolveHunt;
    huntMock.mockImplementation(() => new Promise((resolve) => { resolveHunt = resolve; }));
    const item = noChartItem("hunt-a");
    const onSaveEdit = vi.fn();
    renderBody(item, { onSaveEdit });

    // No click: the sizing block is always visible, so the hunt starts here.
    // Spec step 2 (2026-08-08): the wait is ONE honest status line, not the
    // old bare-"-" wall under a READING CHART rail.
    expect(await screen.findByText("Looking for the size chart photo…")).toBeInTheDocument();
    resolveHunt({ text: CHART_TEXT, source: { via: "desc-photos", photos: 10 } });

    // The found chart writes into its own item field through the normal path.
    // A find also clears any old no-find stamp (Kyle 2026-08-04).
    await waitFor(() => expect(onSaveEdit).toHaveBeenCalledWith("hunt-a", {
      sizeChartText: CHART_TEXT,
      sizeChartNeedsClear: false,
      sizeChartHunt: null,
      sizeChartSource: { via: "desc-photos", photos: 10, at: expect.any(String) },
    }));
    expect(huntMock).toHaveBeenCalledTimes(1);
  });

  // Kyle 2026-08-04: "we can't charge for repopulating the chart!" A finished
  // hunt that found nothing used to leave no trace, so every page reload
  // hunted again and spent up to three more paid reads per chart-less item.
  it("stamps a finished miss on the item so a reload never re-hunts", async () => {
    huntMock.mockResolvedValue(null);
    const item = noChartItem("hunt-miss");
    const onSaveEdit = vi.fn();
    renderBody(item, { onSaveEdit });

    await waitFor(() =>
      expect(onSaveEdit).toHaveBeenCalledWith("hunt-miss", {
        sizeChartHunt: {
          at: expect.any(String),
          fp: chartHuntFingerprint(item),
          v: CHART_HUNT_VERSION,
        },
      })
    );
    expect(huntMock).toHaveBeenCalledTimes(1);
  });

  it("never hunts an item whose stamp matches its photos", async () => {
    huntMock.mockResolvedValue(null);
    const base = noChartItem("hunt-stamped");
    const item = {
      ...base,
      sizeChartHunt: {
        at: "2026-08-04T00:00:00.000Z",
        fp: chartHuntFingerprint(base),
        v: CHART_HUNT_VERSION,
      },
    };
    renderBody(item);

    // The empty state shows at once; no "looking", no paid read.
    expect(await screen.findByText("No size chart for this one yet.")).toBeInTheDocument();
    expect(huntMock).not.toHaveBeenCalled();
  });

  // Kyle 2026-08-04: v1 stamps predate the folded-strip read. The photos did
  // not change — the pipeline did. A stale version must earn one fresh hunt,
  // or every item stamped before the fix keeps hiding its chart forever.
  it("hunts once more when the stamp predates the current pipeline", async () => {
    huntMock.mockResolvedValue(null);
    const base = noChartItem("hunt-oldver");
    const item = {
      ...base,
      sizeChartHunt: {
        at: "2026-08-04T00:00:00.000Z",
        fp: chartHuntFingerprint(base),
        v: 1,
      },
    };
    renderBody(item);

    await waitFor(() => expect(huntMock).toHaveBeenCalledTimes(1));
  });

  it("hunts once more when new photos change the stamp", async () => {
    huntMock.mockResolvedValue(null);
    const base = noChartItem("hunt-stale");
    const item = {
      ...base,
      sizeChartHunt: { at: "2026-08-04T00:00:00.000Z", fp: "stale-print" },
    };
    renderBody(item);

    await waitFor(() => expect(huntMock).toHaveBeenCalledTimes(1));
  });

  it("never stamps a blocked hunt — the retry stays free", async () => {
    huntMock.mockResolvedValue({ capReached: true });
    const item = noChartItem("hunt-blocked");
    const onSaveEdit = vi.fn();
    renderBody(item, { onSaveEdit });

    await waitFor(() => expect(huntMock).toHaveBeenCalledTimes(1));
    await waitFor(() => {
      expect(screen.queryByText("No chart for this one yet.")).not.toBeInTheDocument();
    });
    const stamps = onSaveEdit.mock.calls.filter(([, patch]) => patch && patch.sizeChartHunt);
    expect(stamps).toHaveLength(0);
  });

  it("shows the recommendation once the item carries the hunted chart", async () => {
    huntMock.mockResolvedValue(null); // hunted already; nothing new
    const item = { ...noChartItem("hunt-b"), sizeNotes: CHART_TEXT };
    renderBody(item);

    expect(screen.getByText("AI size")).toBeInTheDocument();
    // Round 4 point 3 cut the SellerChartSection. The chart now reads as the
    // per-size cell row inside the pick block — one cell per charted size —
    // with the provenance in the header, not a separate table.
    expect(screen.getByText("SELLER'S CHART")).toBeInTheDocument();
    // Buttons only: the run ends with the custom-size field (Kyle 2026-07-29),
    // which is a cell in shape but not a size the chart offers.
    expect(document.querySelectorAll("button.cz-sizing-cell")).toHaveLength(3);
    // A chart-bearing item never hunts.
    expect(huntMock).not.toHaveBeenCalled();
  });

  it("earns the precise badge when the deciding measurement is real", async () => {
    huntMock.mockResolvedValue(null);
    const item = { ...noChartItem("hunt-b2"), sizeNotes: CHART_TEXT };
    // Chest measured; waist/hip estimated by effectiveBodyProfile. A shirt
    // decides on chest, so the verdict is not a guess.
    renderBody(item);

    expect(screen.getByText("SELLER'S CHART")).toBeInTheDocument();
    expect(screen.queryByText("BEST GUESS")).not.toBeInTheDocument();
    // The sheen marks a pick that came off a real chart — the precise badge.
    expect(document.querySelector(".cz-sizing-value-row.has-sheen")).not.toBe(null);
  });

  it("hedges the badge when the deciding measurement is estimated", async () => {
    huntMock.mockResolvedValue(null);
    const item = { ...noChartItem("hunt-b3"), sizeNotes: CHART_TEXT };
    // No chest — every tape number comes from the height/weight estimate.
    renderBody(item, { bodyProfile: { height: "180", weight: "75" } });

    expect(screen.getByText("BEST GUESS")).toBeInTheDocument();
    expect(screen.queryByText("SELLER'S CHART")).not.toBeInTheDocument();
    expect(document.querySelector(".cz-sizing-value-row.has-sheen")).toBe(null);
    // F 2026-08-01: chart-derived recSize still says "AI size"; BEST GUESS
    // is the hedge in provenance, not a "your usual size" kicker.
    expect(screen.getByText("AI size")).toBeInTheDocument();
    expect(screen.queryByText("your usual size")).not.toBeInTheDocument();
    // The fit read still scores the estimated tape against the chart.
    expect(document.querySelector(".cz-fitread")).not.toBe(null);
  });

  it("a failed hunt keeps the empty chart state in the Size and fit section", async () => {
    huntMock.mockResolvedValue(null);
    renderBody(noChartItem("hunt-c"));

    expect(await screen.findByText("No chart")).toBeInTheDocument();
    const section = screen.getByRole("region", { name: "Size and fit" });
    // Round 4 point 1: the size override lives inside this section, beside
    // the big size word — the rail "Size" section is gone. The fifth box is
    // visible with no tap (Kyle 2026-07-29).
    expect(within(section).getByLabelText("Custom item size")).toBeInTheDocument();
    expect(
      screen.getByText("No size chart for this one yet.")
    ).toBeInTheDocument();
    expect(huntMock).toHaveBeenCalledTimes(1);
  });

  it("does not stick on Looking when a remount aborts the first hunt", async () => {
    // Strict Mode / panel remount used to leave hunting=true after abort and
    // mark the item tried, so the spinner never cleared (Kyle 2026-07-25).
    let resolveHunt;
    huntMock.mockImplementation(() => new Promise((resolve) => { resolveHunt = resolve; }));
    const item = noChartItem("hunt-stuck");
    const { unmount } = renderBody(item);
    expect(await screen.findByText("Looking for the size chart photo…")).toBeInTheDocument();
    unmount();
    // Stale resolve must not throw; hunting cleared on unmount.
    resolveHunt(null);

    huntMock.mockResolvedValue(null);
    renderBody(item);
    // A completed null hunt must clear the status line (retry allowed after abort).
    await waitFor(() => {
      expect(screen.queryByText("Looking for the size chart photo…")).not.toBeInTheDocument();
    });
    expect(await screen.findByText("No chart")).toBeInTheDocument();
  });

  it("shows usual tops as the hero when body prefs exist but no chart", async () => {
    // Kyle 2026-07-25: saving body prefs still left "No recommendation" and
    // promoted the raw S–2XL run as the big size. Usual size must surface.
    huntMock.mockResolvedValue(null);
    const item = {
      ...noChartItem("hunt-usual"),
      variants: [{ title: "Size", values: ["S", "M", "L", "XL", "2XL"] }],
    };
    renderBody(item, {
      bodyProfile: {
        height: "183",
        weight: "75",
        chest: "99",
        usualTops: "L",
      },
    });

    await screen.findByText("No chart");
    // Spec step 3 (2026-08-08): the usual size surfaces in words on the pick
    // screen, and the chips stay tappable — but nothing is green pre-chart.
    expect(screen.getByText("Your usual size is Large.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Large" })).toBeInTheDocument();
    expect(document.querySelector(".cz-detail-size-choice.is-recommended")).toBe(null);
  });

  it("keeps one cell height and one look for the fifth box (Kyle 2026-07-31)", async () => {
    // Kyle: a size tap stretched the row when the OUR PICK tag mounted, and
    // the fifth box echoed every pick ("Other" became "S"). 2026-08-09: the
    // tag lane is retired — the graded chips keep one height because the two
    // ease lines are always rendered, visible or blank. The box shows a size
    // only when no chart cell carries it.
    huntMock.mockResolvedValue(null);
    const item = { ...noChartItem("hunt-one-look"), sizeNotes: CHART_TEXT, size: "L" };
    renderBody(item);

    await screen.findByText("SELLER'S CHART");
    const cells = [...document.querySelectorAll("button.cz-sizing-cell")];
    expect(cells.length).toBeGreaterThan(0);
    for (const cell of cells) {
      expect(cell.querySelectorAll(".cz-sizing-cell-ease").length).toBe(2);
    }
    const box = screen.getByLabelText("Custom item size");
    // The pick sits on a chart cell, so the box reads "Other".
    expect(box.value).toBe("");
    // A tap on another chart cell keeps the box on "Other".
    fireEvent.click(cells[0]);
    await waitFor(() => expect(box.value).toBe(""));
    // An odd size the chart never listed stays visible in the box.
    fireEvent.change(box, { target: { value: "EU 44" } });
    fireEvent.blur(box);
    await waitFor(() => expect(box.value).toBe("EU 44"));
  });

  it("keeps one cell height when the pick words mount (Kyle 2026-07-31)", async () => {
    // A size tap stretched the row when the OUR PICK / YOUR PICK tags
    // mounted. 2026-08-09: the graded chips retire the tag lanes. The word
    // slot and both ease lines are always rendered — visible or blank — so
    // the row keeps one height on the phone pane and the desktop back.
    huntMock.mockResolvedValue(null);
    const item = { ...noChartItem("hunt-tag-lane"), sizeNotes: CHART_TEXT, size: "L" };
    renderBody(item);

    await screen.findByText("SELLER'S CHART");
    const cells = [...document.querySelectorAll("button.cz-sizing-cell")];
    expect(cells.length).toBeGreaterThan(0);
    for (const cell of cells) {
      expect(cell.querySelector(".cz-sizing-cell-word")).not.toBe(null);
      expect(cell.querySelectorAll(".cz-sizing-cell-ease").length).toBe(2);
    }
  });
});
