// Split-rail handoff 2026-07-28 — the fit read table.
//
// The table shows one bar per measurement on the PICKED chart row: garment
// value (THEIRS), body value (YOURS), signed ease, and a mark on a
// tight↔loose track with a data-driven tolerance band (per-garment domain).
// Row math is a pure function (fitReadRows) so the mapping is testable
// without the DOM; the component tests then check the two states the spec
// names — chart and ghost.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const FIT_CSS = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../../credenza-fashion.css"),
  "utf8"
);

const { huntMock, fileReadMock } = vi.hoisted(() => ({
  huntMock: vi.fn(),
  fileReadMock: vi.fn(),
}));
vi.mock("../../components/size-chart-hunt.js", async () => {
  const actual = await vi.importActual("../../components/size-chart-hunt.js");
  // Keep the real fingerprint + version: the hook reads them to skip a
  // stamped miss. Only the hunt itself is stubbed.
  return { ...actual, huntSizeChart: huntMock };
});
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
const {
  effectiveBodyProfile,
  fitReadRows,
  parseSizeChart,
  recommendSize,
  CHART_AUTH_REQUIRED,
  CHART_AUTH_COPY,
  CHART_CAP_REACHED,
  chartCapCopy,
} = await import("../../credenza-fashion.jsx");

const TOP_TEXT =
  "M: chest 116, shoulder 46, length 70\nL: chest 120, shoulder 48, length 72\nXL: chest 124, shoulder 50, length 74";
// L's waist sits 14cm off the M — outside the leg-length tie-break's ±6cm
// waist tolerance (F, 2026-08-01) — so a saved trouser length below can
// never move the pick off the M. Before that pass existed, L's waist (82)
// was close enough to tie on waist alone; once a test here saves a trouser
// length, that tie would otherwise resolve to L, not the M this file
// actually means to test the Length ROW math on.
const BOTTOM_TEXT =
  "M: waist 78, hip 104, pants length 100\nL: waist 92, hip 108, pants length 102";

afterEach(() => {
  cleanup();
  huntMock.mockReset();
  fileReadMock.mockReset();
});

describe("fitReadRows", () => {
  it("maps a top chart onto worn order with ease and marks", () => {
    const chart = parseSizeChart(TOP_TEXT);
    // Chest 108 → M ease +8 sits inside the regular-knit band (5–10cm).
    // (Literal drafted range, no +4 visual slack — K 2026-08-02.)
    const profile = { chest: 108, shoulder: 45 };
    const rec = recommendSize(chart, profile, "shirt");
    expect(rec.size).toBe("M");

    const rows = fitReadRows(chart, rec, profile, "shirt");
    // Sleeve is on neither side, so it never renders a row.
    expect(rows.map((r) => r.name)).toEqual(["Chest", "Body length", "Shoulder"]);

    const chest = rows[0];
    expect(chest.theirs).toBe(116);
    expect(chest.yours).toBe(108);
    expect(chest.ease).toBe(8);
    expect(chest.warn).toBe(false);
    // Ideal ease lands at band center; +8 is right of knit ideal 7.5.
    expect(chest.bandLeft).toBeGreaterThan(0);
    expect(chest.bandWidth).toBeGreaterThan(0);
    const bandCenter = chest.bandLeft + chest.bandWidth / 2;
    expect(chest.mark).toBeGreaterThan(chest.bandLeft);
    expect(chest.mark).toBeLessThan(chest.bandLeft + chest.bandWidth);
    expect(chest.mark).toBeGreaterThan(bandCenter);

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
    // Warn edges === band edges (same domain map).
    expect(chest.mark).toBeGreaterThan(chest.bandLeft + chest.bandWidth);
  });

  it("keeps an extreme sleeve mark on the bar, not flush on the numbers", () => {
    // Kyle's oversized jacket case: garment sleeve far longer than saved
    // wrist length. Domain includes every size so the mark stays on-track
    // with room before THEIRS — not flush on the text (O 2026-08-02).
    const chart = parseSizeChart(
      "M: chest 116, shoulder 46, length 70, sleeve 82\nL: chest 120, shoulder 48, length 72, sleeve 84",
    );
    const profile = { chest: 105, sleeve: 61 };
    const rec = recommendSize(chart, profile, "shirt", null, null, "Oxford shirt");
    const rows = fitReadRows(chart, rec, profile, "shirt", "Oxford shirt");
    const sleeve = rows.find((r) => r.key === "sleeve");
    expect(sleeve, JSON.stringify(rows)).toBeTruthy();
    expect(sleeve.ease, JSON.stringify(sleeve)).toBeGreaterThan(15);
    expect(sleeve.warn).toBe(true);
    expect(sleeve.mark).toBeGreaterThanOrEqual(4);
    expect(sleeve.mark).toBeLessThanOrEqual(96);
    // Not pinned flush past the bar into the number column.
    expect(sleeve.mark).toBeLessThan(100);
  });

  it("moves the mark between sizes on an oversized coat (Kyle red-line pin)", () => {
    // Every size is oversized on sleeve (> +5"); fixed 6–90 clamp used to pin
    // all of them at 90 so the line sat still. Domain must keep marks distinct.
    const chart = parseSizeChart(
      "S: chest 124, shoulder 50, length 74, sleeve 80\n" +
        "M: chest 128, shoulder 52, length 76, sleeve 82\n" +
        "L: chest 132, shoulder 54, length 78, sleeve 84\n" +
        "XL: chest 136, shoulder 56, length 80, sleeve 86",
    );
    const profile = { chest: 105, sleeve: 61 };
    const title = "Oversized sports coat";
    const marks = {};
    for (const size of ["S", "M", "L", "XL"]) {
      const rec = recommendSize(chart, profile, "shirt", null, size, title);
      const sleeve = fitReadRows(chart, rec, profile, "shirt", title).find(
        (r) => r.key === "sleeve",
      );
      expect(sleeve, size).toBeTruthy();
      expect(sleeve.ease).toBeGreaterThan(12); // > ~5"
      expect(sleeve.mark).toBeGreaterThanOrEqual(4);
      expect(sleeve.mark).toBeLessThanOrEqual(96);
      // None at the absolute cap.
      expect(sleeve.mark).toBeLessThan(96);
      marks[size] = sleeve.mark;
    }
    // S and L must differ — the line visibly slides with the size pick.
    expect(marks.S).not.toBe(marks.L);
    expect(marks.S).toBeLessThan(marks.M);
    expect(marks.M).toBeLessThan(marks.L);
    expect(marks.L).toBeLessThan(marks.XL);
  });

  it("keeps band, orange zones, and tier flags on one map (three tiers)", () => {
    // Kyle 2026-08-02: GREEN inside the band, ORANGE within the soft delta of
    // an edge, RED past it. All three read off the same domain map, so the
    // flags must agree with the drawn geometry on every row.
    const chart = parseSizeChart(TOP_TEXT);
    // Chest 105 → M ease +11 on the 5–10 knit band: Kyle's orange example.
    const profile = { chest: 105, shoulder: 45 };
    const rec = recommendSize(chart, profile, "shirt");
    const rows = fitReadRows(chart, rec, profile, "shirt");
    let sawSoft = false;
    for (const row of rows) {
      if (row.mark == null) continue;
      const bandRight = row.bandLeft + row.bandWidth;
      const softRightEnd = row.softRight + row.softRightWidth;
      const outsideBand = row.mark < row.bandLeft || row.mark > bandRight;
      const beyondSoft = row.mark < row.softLeft || row.mark > softRightEnd;
      expect(row.warn).toBe(beyondSoft);
      expect(row.soft).toBe(outsideBand && !beyondSoft);
      // Zones flank the band and never overlap it.
      expect(row.softLeft).toBeLessThanOrEqual(row.bandLeft);
      expect(row.softRight).toBe(bandRight);
      if (row.soft) sawSoft = true;
    }
    // The +11 knit chest is orange in this fixture — the tier exists.
    expect(sawSoft).toBe(true);
  });

  it("tiers the chest row green → orange → red at the exact band edges", () => {
    // Knit band 5–10, soft delta 4: orange covers (10, 14] and [1, 5), red
    // past those, edges themselves green. Force M so the pick never moves.
    const chart = parseSizeChart(TOP_TEXT);
    const title = "Vintage band tee";
    const chestAt = (bodyChest) => {
      const profile = { chest: bodyChest };
      const rec = recommendSize(chart, profile, "shirt", null, "M", title);
      return fitReadRows(chart, rec, profile, "shirt", title).find(
        (r) => r.key === "chest"
      );
    };
    const cases = [
      // [body chest, ease (= 116 − body), soft, warn]
      [106, 10, false, false], // hi edge exactly: green
      [105, 11, true, false], // just past: orange (Kyle's +11 knit)
      [102, 14, true, false], // edge + delta: still orange (inclusive)
      [101, 15, false, true], // past edge + delta: red
      [111, 5, false, false], // lo edge exactly: green
      [112, 4, true, false], // below the band: orange
      [115, 1, true, false], // lo edge − delta: still orange
      [116, 0, false, true], // past lo edge − delta: red
    ];
    for (const [body, ease, soft, warn] of cases) {
      const chest = chestAt(body);
      expect(chest.ease, "body " + body).toBe(ease);
      expect(chest.soft, "body " + body).toBe(soft);
      expect(chest.warn, "body " + body).toBe(warn);
    }
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

  // Kyle 2026-08-02 item 6 acceptance: shorts + shortsLength must drive the
  // Length row — never pantsLength / 32in when the saved shorts length is 10in.
  // 10 inches stores as 25.4 cm; Length YOURS must be that value.
  it("shorts Length row compares against shortsLength, not pantsLength", () => {
    const chart = parseSizeChart(BOTTOM_TEXT);
    const shortsCm = 25.4; // 10 in
    const profile = {
      waist: 78,
      hip: 100,
      shortsLength: shortsCm,
      pantsLength: 81.28, // 32 in — the wrong field Kyle saw compared
    };
    const rec = recommendSize(chart, profile, "shorts");
    const length = fitReadRows(chart, rec, profile, "shorts").find(
      (r) => r.key === "pantsLength" || r.name === "Length"
    );
    expect(length, "Length row present").toBeTruthy();
    expect(length.yours).toBe(shortsCm);
    expect(length.yours).not.toBe(profile.pantsLength);
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
      // Chest 108 → M ease +8 inside regular-knit 5–10cm band (literal range).
      bodyProfile={{ chest: 108, shoulder: 45, height: 180, weight: 75 }}
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

    // The picked row is M: chest 116 vs 108 = +8, shoulder 46 vs 45 = +1.
    expect(scoped.getByText("116cm")).toBeInTheDocument();
    expect(scoped.getByText("108cm")).toBeInTheDocument();
    expect(scoped.getByText("+8cm")).toBeInTheDocument();
    expect(scoped.getByText("+1cm")).toBeInTheDocument();

    // Band only on graded rows (chest + shoulder). Estimated body length has no band.
    expect(table.querySelectorAll(".cz-fitread-band").length).toBe(2);
    expect(table.querySelectorAll(".cz-fitread-mark").length).toBe(2);
    expect(table.querySelectorAll(".cz-fitread-mark.is-warn").length).toBe(0);
    // Band geometry is inline from the domain map, not fixed CSS left/width.
    const band = table.querySelector(".cz-fitread-band");
    expect(band.style.left).toMatch(/%$/);
    expect(band.style.width).toMatch(/%$/);
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

  it("renders the orange tier: amber mark and ease, flank zones on the track", () => {
    // Kyle 2026-08-02: chest 105 → M ease +11 on the 5–10 knit band reads
    // ORANGE ("get away with it"), not red. His exact example.
    const { container } = renderBody(fitItem(), {
      bodyProfile: { chest: 105, shoulder: 45, height: 180, weight: 75 },
    });
    const table = container.querySelector(".cz-fitread");
    expect(table).not.toBe(null);
    expect(table.querySelectorAll(".cz-fitread-mark.is-soft").length).toBe(1);
    expect(table.querySelectorAll(".cz-fitread-mark.is-warn").length).toBe(0);
    expect(table.querySelectorAll(".cz-fitread-ease.is-soft").length).toBe(1);
    // Both graded rows (chest, shoulder) draw both flank zones from the map.
    expect(table.querySelectorAll(".cz-fitread-soft").length).toBe(4);
    // An orange row still counts as inside for the verdict line — the old
    // +4 slack's verdict, now shown honestly by the color.
    expect(
      within(table).getByText(
        "All two inside tolerance. Body length is estimated from your height."
      )
    ).toBeInTheDocument();
  });

  it("renders the red tier only past the orange zone", () => {
    // Chest 101 → M ease +15: past band edge 10 + delta 4, so RED.
    const { container } = renderBody(fitItem(), {
      bodyProfile: { chest: 101, shoulder: 45, height: 180, weight: 75 },
    });
    const table = container.querySelector(".cz-fitread");
    expect(table.querySelectorAll(".cz-fitread-mark.is-warn").length).toBe(1);
    expect(table.querySelectorAll(".cz-fitread-mark.is-soft").length).toBe(0);
    expect(table.querySelectorAll(".cz-fitread-ease.is-warn").length).toBe(1);
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
    expect(screen.getByText("No chart for this one yet.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add a chart photo" })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Type the chart" })).toBeInTheDocument();
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

    await user.click(screen.getByRole("button", { name: "Type the chart" }));
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

    await user.click(screen.getByRole("button", { name: "Type the chart" }));
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

    await user.click(screen.getByRole("button", { name: "Type the chart" }));
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

  // Bug B (2026-08-02): typed numbers are customer work product. A failed
  // photo path and a second "type by hand" tap used to wipe them.
  it("keeps typed numbers after a failed photo read", async () => {
    const user = userEvent.setup();
    const { container } = renderBody(fitItem({ sizeNotes: "", sizeChartSource: null }));
    fileReadMock.mockResolvedValue(null);

    await user.click(screen.getByRole("button", { name: "Type the chart" }));
    const grid = container.querySelector(".cz-sizing-fix.is-typed");
    await user.type(within(grid).getByLabelText("Small chest in cm"), "100");
    await user.type(within(grid).getByLabelText("Medium chest in cm"), "104");

    const file = new File(["fake"], "chart.jpg", { type: "image/jpeg" });
    const input = container.querySelector("input.cz-detail-chart-file");
    await user.upload(input, file);

    expect(
      await screen.findByText(/could not read that photo/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Your typed numbers are still here/i)).toBeInTheDocument();
    const gridAfter = container.querySelector(".cz-sizing-fix.is-typed");
    expect(gridAfter).not.toBe(null);
    expect(within(gridAfter).getByLabelText("Small chest in cm")).toHaveValue("100");
    expect(within(gridAfter).getByLabelText("Medium chest in cm")).toHaveValue("104");
  });

  it("does not wipe typed numbers when the type button is tapped again", async () => {
    const user = userEvent.setup();
    const { container } = renderBody(fitItem({ sizeNotes: "", sizeChartSource: null }));

    await user.click(screen.getByRole("button", { name: "Type the chart" }));
    let grid = container.querySelector(".cz-sizing-fix.is-typed");
    await user.type(within(grid).getByLabelText("Small chest in cm"), "100");

    await user.click(screen.getByRole("button", { name: "Type the chart" }));
    grid = container.querySelector(".cz-sizing-fix.is-typed");
    expect(grid).not.toBe(null);
    expect(within(grid).getByLabelText("Small chest in cm")).toHaveValue("100");
  });

  it("clears typed numbers only on Cancel", async () => {
    const user = userEvent.setup();
    const { container } = renderBody(fitItem({ sizeNotes: "", sizeChartSource: null }));

    await user.click(screen.getByRole("button", { name: "Type the chart" }));
    await user.type(
      within(container.querySelector(".cz-sizing-fix.is-typed")).getByLabelText(
        "Small chest in cm"
      ),
      "100"
    );
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(container.querySelector(".cz-sizing-fix.is-typed")).toBe(null);
  });

  // Bug B + Fix 0 composition: sawAuth on main wiped typed numbers before
  // the validate-fail restore ran. Auth-failed photo must keep cells.
  it("keeps typed numbers after an auth-failed photo read", async () => {
    const user = userEvent.setup();
    const { container } = renderBody(fitItem({ sizeNotes: "", sizeChartSource: null }));
    fileReadMock.mockResolvedValue(CHART_AUTH_REQUIRED);

    await user.click(screen.getByRole("button", { name: "Type the chart" }));
    const grid = container.querySelector(".cz-sizing-fix.is-typed");
    await user.type(within(grid).getByLabelText("Small chest in cm"), "100");
    await user.type(within(grid).getByLabelText("Medium chest in cm"), "104");

    const file = new File(["fake"], "chart.jpg", { type: "image/jpeg" });
    const input = container.querySelector("input.cz-detail-chart-file");
    await user.upload(input, file);

    expect(await screen.findByText(new RegExp(CHART_AUTH_COPY, "i"))).toBeInTheDocument();
    expect(screen.getByText(/Your typed numbers are still here/i)).toBeInTheDocument();
    const gridAfter = container.querySelector(".cz-sizing-fix.is-typed");
    expect(gridAfter).not.toBe(null);
    expect(within(gridAfter).getByLabelText("Small chest in cm")).toHaveValue("100");
    expect(within(gridAfter).getByLabelText("Medium chest in cm")).toHaveValue("104");
    // Sign-in path still surfaces (authRequired + honest copy).
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  // FIX 2b: cap-failed photo is not "could not read" and keeps typed cells.
  it("keeps typed numbers after a cap-blocked photo read", async () => {
    const user = userEvent.setup();
    const { container } = renderBody(fitItem({ sizeNotes: "", sizeChartSource: null }));
    fileReadMock.mockResolvedValue(CHART_CAP_REACHED);

    await user.click(screen.getByRole("button", { name: "Type the chart" }));
    const grid = container.querySelector(".cz-sizing-fix.is-typed");
    await user.type(within(grid).getByLabelText("Small chest in cm"), "100");
    await user.type(within(grid).getByLabelText("Medium chest in cm"), "104");

    const file = new File(["fake"], "chart.jpg", { type: "image/jpeg" });
    const input = container.querySelector("input.cz-detail-chart-file");
    await user.upload(input, file);

    const capCopy = chartCapCopy(null);
    expect(await screen.findByText(new RegExp(capCopy.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"))).toBeInTheDocument();
    expect(screen.getByText(/Your typed numbers are still here/i)).toBeInTheDocument();
    expect(screen.queryByText(/could not read that photo/i)).toBe(null);
    const gridAfter = container.querySelector(".cz-sizing-fix.is-typed");
    expect(gridAfter).not.toBe(null);
    expect(within(gridAfter).getByLabelText("Small chest in cm")).toHaveValue("100");
    expect(within(gridAfter).getByLabelText("Medium chest in cm")).toHaveValue("104");
    // Cap path shows Sign in (signed-out plan) or See plans (free signed-in).
    expect(
      screen.getByRole("button", { name: /sign in|see plans/i })
    ).toBeInTheDocument();
  });
});

// F 2026-08-02: number columns must fit CM worst case ("116.5cm", "+23.0cm")
// without shrinking the 11px mono font. ch units keep columns aligned across
// rows (max-content would rag short vs long values on separate row grids).
// After #42 the desktop panel is a 5-col GRID — floors live on that template,
// not on flex-item min-widths.
describe("fit-read number column widths (CM legibility)", () => {
  it("sizes the three number columns with ch floors on desktop and phone", () => {
    expect(FIT_CSS).toContain(
      "grid-template-columns: 70px 1fr max(40px, 8ch) max(40px, 8ch) max(54px, 9ch)"
    );
    expect(FIT_CSS).toContain(
      "grid-template-columns: 54px 1fr max(30px, 8ch) max(30px, 8ch) max(40px, 9ch)"
    );
    // Old fixed px tracks must not return — they overflowed "116.5cm".
    expect(FIT_CSS).not.toContain("grid-template-columns: 70px 1fr 40px 40px 54px");
    expect(FIT_CSS).not.toContain("grid-template-columns: 54px 1fr 30px 30px 40px");
  });

  it("keeps mono numbers nowrap + tabular at 11px (no font shrink)", () => {
    const block = FIT_CSS.match(
      /\.cz-fitread-theirs,\s*\.cz-fitread-yours,\s*\.cz-fitread-ease\s*\{[^}]+\}/
    );
    expect(block, "number cell rule missing").toBeTruthy();
    expect(block[0]).toContain("font-size: 11px");
    expect(block[0]).toContain("font-variant-numeric: tabular-nums");
    expect(block[0]).toContain("white-space: nowrap");
    expect(block[0]).toContain("text-align: right");
  });

  it("puts ch floors on the post-#42 dpanel 5-col grid (not dead flex floors)", () => {
    expect(FIT_CSS).toContain(
      "grid-template-columns: 84px minmax(120px, 1fr) max(48px, 8ch) max(48px, 8ch) max(54px, 9ch)"
    );
    // Pre-#42 flex-item floors must stay gone — they are dead on a grid row.
    expect(FIT_CSS).not.toMatch(
      /\.cz-dpanel \.cz-fitread-theirs,[\s\S]*?min-width:\s*max\(40px,\s*8ch\)/
    );
    expect(FIT_CSS).not.toMatch(
      /\.cz-dpanel \.cz-fitread-ease\s*\{[^}]*min-width:\s*max\(54px,\s*9ch\)/
    );
  });

  it("restores a 44px hit area on quiet chart links without growing the visual", () => {
    // F 2026-08-02: min-height:0 alone left a ~13px phone tap target.
    const link = FIT_CSS.match(/\.cz-detail-chart-link\s*\{[^}]+\}/);
    expect(link, "chart-link rule missing").toBeTruthy();
    expect(link[0]).toContain("min-height: 0");
    expect(link[0]).toContain("position: relative");
    const after = FIT_CSS.match(/\.cz-detail-chart-link::after\s*\{[^}]+\}/);
    expect(after, "chart-link ::after missing").toBeTruthy();
    expect(after[0]).toContain("height: 44px");
  });
});

// Kyle 2026-08-02 three tiers: the orange "get away with it" tier rides the
// theme's amber tokens in both palettes — a raw hex would rot on Blackout.
describe("three-tier orange paints from theme tokens", () => {
  const HEX = /#[0-9a-fA-F]{3,8}\b/;
  it("soft track zone, mark, and ease use var(--cz-warn*) and no hex", () => {
    const zone = FIT_CSS.match(/\.cz-fitread-soft\s*\{[^}]+\}/);
    expect(zone, "soft zone rule missing").toBeTruthy();
    expect(zone[0]).toContain("var(--cz-warn)");
    expect(zone[0]).not.toMatch(HEX);

    const mark = FIT_CSS.match(/\.cz-fitread-mark\.is-soft\s*\{[^}]+\}/);
    expect(mark, "soft mark rule missing").toBeTruthy();
    expect(mark[0]).toContain("var(--cz-warn)");
    expect(mark[0]).not.toMatch(HEX);

    const ease = FIT_CSS.match(/\.cz-fitread-ease\.is-soft\s*\{[^}]+\}/);
    expect(ease, "soft ease rule missing").toBeTruthy();
    expect(ease[0]).toContain("var(--cz-warn-ink)");
    expect(ease[0]).not.toMatch(HEX);
  });

  it("seller-chart ease gets the same amber tier", () => {
    const cell = FIT_CSS.match(/\.cz-chart-ease\.is-soft\s*\{[^}]+\}/);
    expect(cell, "chart soft ease rule missing").toBeTruthy();
    expect(cell[0]).toContain("var(--cz-warn-ink)");
    expect(cell[0]).not.toMatch(HEX);
  });
});
