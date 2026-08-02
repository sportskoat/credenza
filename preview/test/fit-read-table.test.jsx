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
const { effectiveBodyProfile, fitReadRows, parseSizeChart, recommendSize } = await import(
  "../../credenza-fashion.jsx"
);

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

  it("orders a bottoms chart waist-first and grades 裤长 against the saved length", () => {
    const chart = parseSizeChart(BOTTOM_TEXT);
    // Kyle 2026-07-30: the saved trouser length is waistband to hem, the same
    // measurement the seller prints, so the Length row grades like for like.
    const profile = { waist: 78, hip: 100, pantsLength: 102 };
    const rec = recommendSize(chart, profile, "pants");
    expect(rec.size).toBe("M");

    const rows = fitReadRows(chart, rec, profile, "pants");
    expect(rows.map((r) => r.name)).toEqual(["Waist", "Hip", "Length"]);
    const length = rows[2];
    expect(length.theirs).toBe(100);
    expect(length.yours).toBe(102);
    expect(length.ease).toBe(-2);
  });

  it("keeps the Length row informational when no trouser length is saved", () => {
    const chart = parseSizeChart(BOTTOM_TEXT);
    const profile = { waist: 78, hip: 100 };
    const rec = recommendSize(chart, profile, "pants");
    const length = fitReadRows(chart, rec, profile, "pants")[2];
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

  // Sleeve fix 2026-07-29: a confirmed short-sleeve garment keeps its sleeve
  // row as information only — numbers, no ease, no mark, no warn. Long or
  // unknown keeps the verdict. Profile arm is 62 cm.
  const SLEEVE_TEXT =
    "M: chest 116, shoulder 46, length 70, sleeve 22\nL: chest 120, shoulder 48, length 72, sleeve 23";

  it("shows the sleeve row as information only on a short-sleeve tee", () => {
    const chart = parseSizeChart(SLEEVE_TEXT);
    const profile = { chest: 105, sleeve: 62 };
    const rec = recommendSize(chart, profile, "shirt", null, null, "Vintage band tee");
    const rows = fitReadRows(chart, rec, profile, "shirt", "Vintage band tee");
    const sleeve = rows.find((r) => r.key === "sleeve");
    expect(sleeve.theirs).toBe(22);
    // Option B (Kyle 2026-07-29): the arm length measures a different thing,
    // so YOURS hides on a short sleeve. Only the garment number shows.
    expect(sleeve.yours).toBe(null);
    expect(sleeve.ease).toBe(null);
    expect(sleeve.mark).toBe(null);
    expect(sleeve.warn).toBe(false);
  });

  it("compares a saved short sleeve against a short-sleeve chart", () => {
    const chart = parseSizeChart(SLEEVE_TEXT);
    const profile = { chest: 105, shortSleeve: 22 };
    const rec = recommendSize(chart, profile, "shirt", null, null, "Vintage tee");
    const rows = fitReadRows(chart, rec, profile, "shirt", "Vintage tee");
    const sleeve = rows.find((r) => r.key === "sleeve");
    expect(sleeve.yours).toBe(22);
    expect(sleeve.ease).not.toBe(null);
  });

  it("shows the sleeve row as information only for a Chinese short-sleeve title", () => {
    const chart = parseSizeChart(SLEEVE_TEXT);
    const profile = { chest: 105, sleeve: 62 };
    const rec = recommendSize(chart, profile, "shirt", null, null, "短袖T恤");
    const rows = fitReadRows(chart, rec, profile, "shirt", "短袖T恤");
    const sleeve = rows.find((r) => r.key === "sleeve");
    expect(sleeve.yours).toBe(null);
    expect(sleeve.ease).toBe(null);
    expect(sleeve.warn).toBe(false);
  });

  it("keeps the sleeve warning on a long-sleeve title with a short chart", () => {
    const chart = parseSizeChart(SLEEVE_TEXT);
    const profile = { chest: 105, sleeve: 62 };
    const rec = recommendSize(chart, profile, "shirt", null, null, "长袖T恤");
    const rows = fitReadRows(chart, rec, profile, "shirt", "长袖T恤");
    const sleeve = rows.find((r) => r.key === "sleeve");
    // 22 vs 62 is far outside the band: the warning must stay.
    expect(sleeve.ease).toBe(-40);
    expect(sleeve.warn).toBe(true);
  });

  it("keeps the sleeve warning when the style is unknown", () => {
    const chart = parseSizeChart(
      "M: chest 116, shoulder 46, length 70, sleeve 58\nL: chest 120, shoulder 48, length 72, sleeve 60"
    );
    const profile = { chest: 105, sleeve: 68 };
    const rec = recommendSize(chart, profile, "shirt", null, null, "Oxford shirt");
    const rows = fitReadRows(chart, rec, profile, "shirt", "Oxford shirt");
    const sleeve = rows.find((r) => r.key === "sleeve");
    expect(sleeve.ease).not.toBe(null);
    expect(sleeve.warn).toBe(true);
  });

  it("drops the sleeve row when a ragged chart has no sleeve number", () => {
    // Oom 2026-07-29: short-sleeve title + a chart with no sleeve column.
    // The row would keep only the body arm length, then lose YOURS to the
    // info-only rule and print "Sleeve — — —". It must not render at all.
    const chart = parseSizeChart("M: chest 116, length 70\nL: chest 120, length 72");
    const profile = { chest: 105, sleeve: 62 };
    const rec = recommendSize(chart, profile, "shirt", null, null, "Vintage band tee");
    const rows = fitReadRows(chart, rec, profile, "shirt", "Vintage band tee");
    expect(rows.find((r) => r.key === "sleeve")).toBe(undefined);
  });

  it("applies the number rule with no title word: polo with 24 cm sleeves", () => {
    const chart = parseSizeChart(
      "M: chest 116, shoulder 46, length 70, sleeve 24\nL: chest 120, shoulder 48, length 72, sleeve 25"
    );
    const profile = { chest: 105, sleeve: 62 };
    const rec = recommendSize(chart, profile, "shirt", null, null, "Polo");
    const rows = fitReadRows(chart, rec, profile, "shirt", "Polo");
    const sleeve = rows.find((r) => r.key === "sleeve");
    expect(sleeve.ease).toBe(null);
    expect(sleeve.warn).toBe(false);
  });

  it("blocks the number rule when one sleeve is 40 cm or more: polo with 60 cm", () => {
    const chart = parseSizeChart(
      "M: chest 116, shoulder 46, length 70, sleeve 24\nL: chest 120, shoulder 48, length 72, sleeve 60"
    );
    const profile = { chest: 105, sleeve: 62 };
    const rec = recommendSize(chart, profile, "shirt", null, null, "Polo");
    const rows = fitReadRows(chart, rec, profile, "shirt", "Polo");
    const sleeve = rows.find((r) => r.key === "sleeve");
    expect(sleeve.ease).not.toBe(null);
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
    // Torso estimate (Kyle 2026-07-30): the profile has no torso number, so
    // the Body length row estimates from the 180cm height — "~" on the
    // number and a plain sentence in the footnote.
    expect(scoped.getByText("~54cm")).toBeInTheDocument();
    expect(
      scoped.getByText(
        "All two inside tolerance. Body length is estimated from your height."
      )
    ).toBeInTheDocument();
  });

  it("opens the full seller chart when FIT READ is tapped (Kyle 2026-07-31)", async () => {
    const user = userEvent.setup();
    const { container } = renderBody(fitItem());
    const table = container.querySelector(".cz-fitread");
    expect(table.querySelector(".cz-size-chart-table")).toBe(null);
    await user.click(screen.getByRole("button", { name: /Full chart/i }));
    expect(table.classList.contains("is-open")).toBe(true);
    expect(table.querySelector(".cz-size-chart-table")).not.toBe(null);
    // Ease help + every size row so length room is readable next to the pick.
    expect(within(table).getByText(/Ease/)).toBeInTheDocument();
    expect(table.querySelector(".cz-size-chart-table .is-rec")).not.toBe(null);
    await user.click(screen.getByRole("button", { name: /Hide full chart/i }));
    expect(table.querySelector(".cz-size-chart-table")).toBe(null);
  });

  it("routes Edit my measurements to the profile sizes opener", async () => {
    const user = userEvent.setup();
    const { onOpenSizes } = renderBody(fitItem());
    await user.click(screen.getByRole("button", { name: "Edit my measurements" }));
    expect(onOpenSizes).toHaveBeenCalled();
  });

  it("Forget this chart clears the stored measurements", async () => {
    // "In production this is 'the parse was wrong', so it should also clear
    // the stored measurements for the item."
    const user = userEvent.setup();
    const onSaveEdit = vi.fn();
    renderBody(fitItem(), { onSaveEdit });
    await user.click(screen.getByRole("button", { name: "Forget this chart" }));
    expect(onSaveEdit).toHaveBeenCalledWith("fitread-1", {
      sizeNotes: "",
      sizeChartSource: null,
      sizeChartNeedsClear: false,
    });
  });

  it("hides Forget when the chart came from the listing text itself", () => {
    // Clearing sizeNotes would not kill a chart parsed from the summary, and
    // a link that does nothing teaches the customer not to trust links.
    renderBody(fitItem({ sizeNotes: undefined, sizeChartSource: undefined, summary: TOP_TEXT }));
    expect(screen.queryByRole("button", { name: "Forget this chart" })).toBe(null);
  });

  it("drops the table entirely when the hunt finds no chart", async () => {
    // Fable RULED 2026-07-29 that the ghost table stays with no chart, and the
    // rule was "not without Kyle's word". KYLE'S WORD, 2026-07-30: "if we
    // can't find the chart, we don't want this to take up the entire right
    // side of the page." The empty table is the biggest of those blocks, so it
    // goes. The size, the size buttons and the two ways to get a chart stay.
    huntMock.mockResolvedValue(null);
    const { container } = renderBody(
      fitItem({ sizeNotes: undefined, sizeChartSource: undefined })
    );
    expect(await screen.findByText("No chart")).toBeInTheDocument();

    expect(container.querySelector(".cz-fitread")).toBe(null);
    expect(screen.getByText("No size chart found.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Upload chart photo" })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Input sizing chart manually" })).toBeInTheDocument();
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

// Kyle 2026-07-30: the Hip row warned against a hip the app had invented from
// height and weight. The app promises never to grade a guess.
describe("a guessed body number carries no verdict", () => {
  it("shows the guessed hip and passes no judgement", () => {
    const chart = parseSizeChart(BOTTOM_TEXT);
    const profile = effectiveBodyProfile({ height: 178, weight: 70, waist: 80 });
    const rec = recommendSize(chart, profile, "pants");
    const hip = fitReadRows(chart, rec, profile, "pants").find((r) => r.key === "hip");
    expect(hip.yours).not.toBe(null);
    expect(hip.estimated).toBe(true);
    expect(hip.ease).toBe(null);
    expect(hip.warn).toBe(false);
  });

  it("still grades a measured hip", () => {
    const chart = parseSizeChart(BOTTOM_TEXT);
    const profile = { waist: 80, hip: 100 };
    const rec = recommendSize(chart, profile, "pants");
    const hip = fitReadRows(chart, rec, profile, "pants").find((r) => r.key === "hip");
    expect(hip.estimated).toBe(false);
    expect(hip.ease).not.toBe(null);
  });
});

// Kyle 2026-07-30: "show a clear warning when it is not measured", and "let
// you type the chart numbers by hand in twenty seconds".
describe("a measurement the seller does not print", () => {
  const NO_SHOULDER_TEXT = "M: chest 116, length 70\nL: chest 120, length 72";

  it("marks the row as absent from the chart, not as an unread number", () => {
    const chart = parseSizeChart(NO_SHOULDER_TEXT);
    const profile = { chest: 105, shoulder: 45 };
    const rec = recommendSize(chart, profile, "shirt");
    const rows = fitReadRows(chart, rec, profile, "shirt");
    const shoulder = rows.find((r) => r.key === "shoulder");
    expect(shoulder.theirs).toBe(null);
    expect(shoulder.notOnChart).toBe(true);
    expect(rows.find((r) => r.key === "chest").notOnChart).toBe(false);
  });

  it("claims nothing about the chart when there is no chart at all", () => {
    const rows = fitReadRows(null, null, { chest: 105, shoulder: 45 }, "shirt");
    for (const row of rows) expect(row.notOnChart).toBe(false);
  });

  it("names the missing measurement in the footnote", () => {
    const { container } = renderBody(fitItem({ sizeNotes: NO_SHOULDER_TEXT }));
    const footnote = container.querySelector(".cz-fitread-footnote").textContent;
    expect(footnote).toContain("The seller does not print the shoulder.");
    expect(footnote).toContain("Type it in or read the chart photo.");
    expect(within(container.querySelector(".cz-fitread")).getAllByText("n/a").length).toBe(1);
  });
});

describe("typing a chart by hand", () => {
  it("opens an empty grid, then saves what was typed", async () => {
    const user = userEvent.setup();
    const onSaveEdit = vi.fn();
    const { container } = renderBody(fitItem(), { onSaveEdit });

    await user.click(screen.getByRole("button", { name: "Input sizing chart manually" }));
    const grid = container.querySelector(".cz-sizing-fix.is-typed");
    expect(grid).not.toBe(null);
    // Four size rows, four top columns, every measurement box empty.
    expect(grid.querySelectorAll(".cz-sizing-fix-row").length).toBe(4);
    expect(within(grid).getByLabelText("Small chest in cm")).toHaveValue("");

    await user.type(within(grid).getByLabelText("Small chest in cm"), "100");
    await user.type(within(grid).getByLabelText("Medium chest in cm"), "104");
    await user.click(screen.getByRole("button", { name: "Save this chart" }));

    expect(onSaveEdit).toHaveBeenCalledTimes(1);
    const [id, patch] = onSaveEdit.mock.calls[0];
    expect(id).toBe("fitread-1");
    expect(patch.sizeChartText).toBe("S: chest 100\nM: chest 104");
    expect(patch.sizeChartSource.via).toBe("customer-typed");
  });

  it("refuses to save an empty grid and says what is missing", async () => {
    const user = userEvent.setup();
    const onSaveEdit = vi.fn();
    renderBody(fitItem(), { onSaveEdit });

    await user.click(screen.getByRole("button", { name: "Input sizing chart manually" }));
    await user.click(screen.getByRole("button", { name: "Save this chart" }));
    expect(onSaveEdit).not.toHaveBeenCalled();
    expect(
      screen.getByText("Type at least two sizes with one measurement each, then save.")
    ).toBeInTheDocument();
  });

  it("keeps the seller's own size names", async () => {
    const user = userEvent.setup();
    const onSaveEdit = vi.fn();
    const { container } = renderBody(fitItem(), { onSaveEdit });

    await user.click(screen.getByRole("button", { name: "Input sizing chart manually" }));
    const grid = container.querySelector(".cz-sizing-fix.is-typed");
    const firstName = within(grid).getByLabelText("Size name, row 1");
    await user.clear(firstName);
    await user.type(firstName, "36");
    await user.type(within(grid).getByLabelText("36 chest in cm"), "100");
    const secondName = within(grid).getByLabelText("Size name, row 2");
    await user.clear(secondName);
    await user.type(secondName, "38");
    await user.type(within(grid).getByLabelText("38 chest in cm"), "104");
    await user.click(screen.getByRole("button", { name: "Save this chart" }));

    expect(onSaveEdit.mock.calls[0][1].sizeChartText).toBe("36: chest 100\n38: chest 104");
  });
});
