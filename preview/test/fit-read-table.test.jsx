// Split-rail handoff 2026-07-28 — the fit read table.
//
// The table shows one bar per measurement on the PICKED chart row: garment
// value (THEIRS), body value (YOURS), signed ease, and a mark on a
// tight↔loose track with a fixed 36–66% tolerance band. Row math is a pure
// function (fitReadRows) so the mapping is testable without the DOM; the
// component tests then check the two states the spec names — chart and ghost.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { huntMock, fileReadMock } = vi.hoisted(() => ({
  huntMock: vi.fn(),
  fileReadMock: vi.fn(),
}));
vi.mock("../../components/size-chart-hunt.js", () => ({ huntSizeChart: huntMock }));
// The upload door is mocked so a test can hold a photo read open and watch
// the table's reading state; everything else in the module stays real.
vi.mock("../../credenza-fashion.jsx", async () => {
  const real = await vi.importActual("../../credenza-fashion.jsx");
  return { ...real, readChartFromPhotoFiles: fileReadMock };
});

// Import order is load-bearing: DetailBody must resolve first so the mocked
// credenza-fashion module is the one bound into its graph. Importing the app
// root first hands DetailBody the REAL readChartFromPhotoFiles.
const { default: DetailBody } = await import("../../components/DetailBody.jsx");
const { fitReadRows, parseSizeChart, recommendSize } = await import("../../credenza-fashion.jsx");

const TOP_TEXT =
  "M: chest 116, shoulder 46, length 70\nL: chest 120, shoulder 48, length 72\nXL: chest 124, shoulder 50, length 74";
const BOTTOM_TEXT =
  "M: waist 78, hip 104, pants length 100\nL: waist 82, hip 108, pants length 102";

afterEach(() => {
  cleanup();
  huntMock.mockReset();
  fileReadMock.mockReset();
});

describe("fitReadRows", () => {
  it("maps a top chart onto worn order with ease and marks", () => {
    const chart = parseSizeChart(TOP_TEXT);
    const profile = { chest: 105, shoulder: 45 };
    const rec = recommendSize(chart, profile, "shirt");
    expect(rec.size).toBe("M");

    const rows = fitReadRows(chart, rec, profile, "shirt");
    // Sleeve is on neither side, so it never renders a row.
    expect(rows.map((r) => r.name)).toEqual(["Chest", "Body length", "Shoulder"]);

    const chest = rows[0];
    expect(chest.theirs).toBe(116);
    expect(chest.yours).toBe(105);
    expect(chest.ease).toBe(11);
    expect(chest.warn).toBe(false);
    // Ideal chest ease (12) maps to the band center; 11 sits just left of it.
    expect(chest.mark).toBeGreaterThan(36);
    expect(chest.mark).toBeLessThan(66);

    // Body length has no body-side field: information, never a verdict.
    const length = rows[1];
    expect(length.theirs).toBe(70);
    expect(length.yours).toBe(null);
    expect(length.ease).toBe(null);
    expect(length.mark).toBe(null);
  });

  it("warns when the ease leaves the tolerance band", () => {
    const chart = parseSizeChart(TOP_TEXT);
    // Chest 96 → the closest row still carries +20 ease: roomier than ideal.
    const profile = { chest: 96 };
    const rec = recommendSize(chart, profile, "shirt");
    const rows = fitReadRows(chart, rec, profile, "shirt");
    const chest = rows.find((r) => r.key === "chest");
    expect(chest.ease).toBe(20);
    expect(chest.warn).toBe(true);
    expect(chest.mark).toBeGreaterThan(66);
  });

  it("orders a bottoms chart waist-first and keeps 裤长 informational", () => {
    const chart = parseSizeChart(BOTTOM_TEXT);
    const profile = { waist: 78, hip: 100, inseam: 76 };
    const rec = recommendSize(chart, profile, "pants");
    expect(rec.size).toBe("M");

    const rows = fitReadRows(chart, rec, profile, "pants");
    expect(rows.map((r) => r.name)).toEqual(["Waist", "Hip", "Length"]);
    // Seller 裤长 is OUTSEAM; the inseam measures a different segment, so the
    // Length row must not claim a "yours" or an ease.
    const length = rows[2];
    expect(length.theirs).toBe(100);
    expect(length.yours).toBe(null);
    expect(length.ease).toBe(null);
  });

  it("ghosts without a chart: yours only, no marks", () => {
    const rows = fitReadRows(null, null, { chest: 105, shoulder: 45 }, "shirt");
    expect(rows.map((r) => r.key)).toEqual(["chest", "shoulder"]);
    for (const row of rows) {
      expect(row.theirs).toBe(null);
      expect(row.mark).toBe(null);
      expect(row.ease).toBe(null);
    }
    expect(rows[0].yours).toBe(105);
  });
});

function fitItem(extra = {}) {
  return {
    id: "fitread-1",
    createdAt: 1753400000000,
    url: "https://weidian.com/item.html?itemID=901",
    title: "Fit read shirt",
    seller: "replux",
    category: "shirt",
    findStatus: "want",
    sizeNotes: TOP_TEXT,
    sizeChartSource: { via: "album-text", at: "2026-07-25T10:00:00.000Z" },
    ...extra,
  };
}

function renderBody(item, extra = {}) {
  const onOpenSizes = extra.onOpenSizes || vi.fn();
  const utils = render(
    <DetailBody
      item={item}
      bodyProfile={{ chest: 105, shoulder: 45, height: 180, weight: 75 }}
      onSaveEdit={vi.fn()}
      onOpen={vi.fn()}
      onAttachPhoto={vi.fn()}
      onRemovePhoto={vi.fn()}
      {...extra}
      onOpenSizes={onOpenSizes}
    />
  );
  return { ...utils, onOpenSizes };
}

describe("FitReadTable in the detail body", () => {
  it("renders the chart state: heads, values, band, footnote", () => {
    const { container } = renderBody(fitItem());
    const table = container.querySelector(".cz-fitread");
    expect(table).not.toBe(null);
    expect(table.classList.contains("is-ghost")).toBe(false);

    const scoped = within(table);
    expect(scoped.getByText("FIT READ")).toBeInTheDocument();
    expect(scoped.getByText("THEIRS")).toBeInTheDocument();
    expect(scoped.getByText("YOURS")).toBeInTheDocument();
    expect(scoped.getByText("EASE")).toBeInTheDocument();
    expect(scoped.getByText("TIGHT")).toBeInTheDocument();

    // The picked row is M: chest 116 vs 105 = +11, shoulder 46 vs 45 = +1.
    expect(scoped.getByText("116cm")).toBeInTheDocument();
    expect(scoped.getByText("105cm")).toBeInTheDocument();
    expect(scoped.getByText("+11cm")).toBeInTheDocument();
    expect(scoped.getByText("+1cm")).toBeInTheDocument();

    expect(table.querySelectorAll(".cz-fitread-band").length).toBe(3);
    expect(table.querySelectorAll(".cz-fitread-mark").length).toBe(2);
    expect(table.querySelectorAll(".cz-fitread-mark.is-warn").length).toBe(0);
    expect(scoped.getByText("All two inside tolerance.")).toBeInTheDocument();
  });

  it("routes Edit my measurements to the profile sizes opener", async () => {
    const user = userEvent.setup();
    const { onOpenSizes } = renderBody(fitItem());
    await user.click(screen.getByRole("button", { name: "Edit my measurements" }));
    expect(onOpenSizes).toHaveBeenCalled();
  });

  it("Forget this chart clears the stored measurements", async () => {
    // "In production this is 'the parse was wrong', so it should also clear
    // the stored measurements for the item" — and a null sizeChartSource
    // takes the item out of the seller-cache pool too.
    const user = userEvent.setup();
    const onSaveEdit = vi.fn();
    renderBody(fitItem(), { onSaveEdit });
    await user.click(screen.getByRole("button", { name: "Forget this chart" }));
    expect(onSaveEdit).toHaveBeenCalledWith("fitread-1", {
      sizeNotes: "",
      sizeChartSource: null,
    });
  });

  it("hides Forget when the chart came from the listing text itself", () => {
    // Clearing sizeNotes would not kill a chart parsed from the summary, and
    // a link that does nothing teaches the customer not to trust links.
    renderBody(fitItem({ sizeNotes: undefined, sizeChartSource: undefined, summary: TOP_TEXT }));
    expect(screen.queryByRole("button", { name: "Forget this chart" })).toBe(null);
  });

  it("ghosts without a chart: yours kept, no band, waiting footnote", async () => {
    huntMock.mockResolvedValue(null);
    const { container } = renderBody(
      fitItem({ sizeNotes: undefined, sizeChartSource: undefined })
    );
    expect(await screen.findByText("No chart")).toBeInTheDocument();

    const table = container.querySelector(".cz-fitread");
    expect(table.classList.contains("is-ghost")).toBe(true);
    const scoped = within(table);
    expect(scoped.getByText("105cm")).toBeInTheDocument();
    expect(scoped.getAllByText("—").length).toBeGreaterThan(0);
    expect(table.querySelectorAll(".cz-fitread-band").length).toBe(0);
    expect(table.querySelectorAll(".cz-fitread-mark").length).toBe(0);
    expect(scoped.getByText("Your measurements, waiting on theirs.")).toBeInTheDocument();
    // The scale only means something once a chart puts marks on the track.
    expect(scoped.queryByText("TIGHT")).toBe(null);
  });

  it("stays out of skip categories", () => {
    const { container } = renderBody(fitItem({ category: "shoes", sizeNotes: undefined }));
    expect(container.querySelector(".cz-fitread")).toBe(null);
  });

  it("sheens a chart-read pick, and only that", () => {
    // The sheen means "this pick came off a real chart". A manual pick and a
    // chartless fallback both render still.
    const { container, unmount } = renderBody(fitItem());
    expect(container.querySelector(".cz-sizing-sheen")).not.toBe(null);
    unmount();

    const manual = renderBody(fitItem({ size: "XL" }));
    expect(manual.container.querySelector(".cz-sizing-sheen")).toBe(null);
    manual.unmount();

    huntMock.mockResolvedValue(null);
    const ghost = renderBody(fitItem({ sizeNotes: undefined, sizeChartSource: undefined }));
    expect(ghost.container.querySelector(".cz-sizing-sheen")).toBe(null);
  });

  it("shows the reading footnote and sweep while a photo read is open", async () => {
    // The state machine rides the real request, not a timer: the footnote
    // counts the photos handed to THIS read, and holding the promise open
    // holds the state.
    huntMock.mockResolvedValue(null);
    let finish;
    fileReadMock.mockImplementation(() => new Promise((r) => { finish = r; }));
    const user = userEvent.setup();
    const { container } = renderBody(
      fitItem({ sizeNotes: undefined, sizeChartSource: undefined })
    );
    await screen.findByText("No chart");

    await user.upload(
      document.querySelector(".cz-detail-chart-file"),
      new File(["xxxx"], "chart.jpg", { type: "image/jpeg" })
    );

    const table = container.querySelector(".cz-fitread");
    expect(table.classList.contains("is-reading")).toBe(true);
    expect(within(table).getByText("Reading one photo…")).toBeInTheDocument();

    finish(TOP_TEXT);
    // The read resolved: the reading state must drop without a timer.
    expect(await screen.findByRole("button", { name: "Use this chart" })).toBeInTheDocument();
    expect(container.querySelector(".cz-fitread.is-reading")).toBe(null);
  });
});
