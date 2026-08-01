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

vi.mock("../../components/size-chart-hunt.js", () => ({ huntSizeChart: huntMock }));

// Import AFTER the mock registration so DetailBody binds the stub.
const { default: DetailBody } = await import("../../components/DetailBody.jsx");

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
    expect(await screen.findByText("READING CHART")).toBeInTheDocument();
    resolveHunt({ text: CHART_TEXT, source: { via: "desc-photos", photos: 10 } });

    // The found chart writes into its own item field through the normal path.
    await waitFor(() => expect(onSaveEdit).toHaveBeenCalledWith("hunt-a", {
      sizeChartText: CHART_TEXT,
      sizeChartNeedsClear: false,
      sizeChartSource: { via: "desc-photos", photos: 10, at: expect.any(String) },
    }));
    expect(huntMock).toHaveBeenCalledTimes(1);
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
      screen.getByText("No size chart found.")
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
    expect(await screen.findByText("READING CHART")).toBeInTheDocument();
    unmount();
    // Stale resolve must not throw; hunting cleared on unmount.
    resolveHunt(null);

    huntMock.mockResolvedValue(null);
    renderBody(item);
    // A completed null hunt must clear the spinner (retry allowed after abort).
    await waitFor(() => {
      expect(screen.queryByText("READING CHART")).not.toBeInTheDocument();
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
    expect(screen.getByText("your usual · not verified")).toBeInTheDocument();
    expect(screen.getAllByText("Large").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("button", { name: "Large" })).toBeInTheDocument();
  });

  it("keeps one cell height and one look for the fifth box (Kyle 2026-07-31)", async () => {
    // Kyle: a size tap stretched the row when the OUR PICK tag mounted, and
    // the fifth box echoed every pick ("Other" became "S"). The tag lane is
    // always rendered now, and the box shows a size only when no chart cell
    // carries it.
    huntMock.mockResolvedValue(null);
    const item = { ...noChartItem("hunt-one-look"), sizeNotes: CHART_TEXT, size: "L" };
    renderBody(item);

    await screen.findByText("SELLER'S CHART");
    const cells = [...document.querySelectorAll("button.cz-sizing-cell")];
    expect(cells.length).toBeGreaterThan(0);
    for (const cell of cells) {
      expect(cell.querySelector(".cz-sizing-cell-tag")).not.toBe(null);
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

  it("keeps one cell height when the pick tags mount (Kyle 2026-07-31)", async () => {
    // A size tap stretched the row when the OUR PICK / YOUR PICK tags
    // mounted. Both tag lanes are always rendered now — visible or blank —
    // so the row keeps one height on the phone pane and the desktop back.
    huntMock.mockResolvedValue(null);
    const item = { ...noChartItem("hunt-tag-lane"), sizeNotes: CHART_TEXT, size: "L" };
    renderBody(item);

    await screen.findByText("SELLER'S CHART");
    const cells = [...document.querySelectorAll("button.cz-sizing-cell")];
    expect(cells.length).toBeGreaterThan(0);
    for (const cell of cells) {
      expect(cell.querySelector(".cz-sizing-cell-tag")).not.toBe(null);
      expect(cell.querySelector(".cz-sizing-cell-tag-phone")).not.toBe(null);
    }
  });
});
