// Handoff turn 9 §3 — "no chart" is a request, not a dead end.
//
// The hunt reads the album text, the chart tiles, the description feed and the
// gallery. When all four come back empty the old block printed "No size chart
// on this listing" and stopped. That leaves the customer holding the one thing
// the app cannot reach on its own: a photo of the chart on the tag.
//
// §3 has three moving parts, and this file covers each one end to end:
//   1. the no-chart block asks for that photo (dashed, warn dot, unverified);
//   2. the read STAGES a chart, so the customer confirms before it lands;
//   3. the seller cache answers for free, so the second item from a seller
//      never pays for a second vision read.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { huntMock, urlReadMock, fileReadMock, createObjectUrlMock, revokeObjectUrlMock } = vi.hoisted(() => ({
  huntMock: vi.fn(),
  urlReadMock: vi.fn(),
  fileReadMock: vi.fn(),
  createObjectUrlMock: vi.fn(),
  revokeObjectUrlMock: vi.fn(),
}));

vi.mock("../../components/size-chart-hunt.js", async () => {
  const actual = await vi.importActual("../../components/size-chart-hunt.js");
  // Keep the real fingerprint + version: the hook reads them to skip a
  // stamped miss. Only the hunt itself is stubbed.
  return { ...actual, huntSizeChart: huntMock };
});

// Spy on the two vision doors without losing the rest of the module: the
// sizing block reads a dozen other exports from it.
vi.mock("../../credenza-fashion.jsx", async () => {
  const real = await vi.importActual("../../credenza-fashion.jsx");
  return { ...real, fetchChartFromPhotos: urlReadMock, readChartFromPhotoFiles: fileReadMock };
});

const { default: DetailBody } = await import("../../components/DetailBody.jsx");

const CHART_TEXT = "M: chest 116, length 70\nL: chest 120, length 72\nXL: chest 124, length 74";

let seq = 0;
function chartless(extra = {}) {
  seq += 1;
  return {
    id: "nc-" + seq,
    createdAt: 1753400000000,
    url: "https://weidian.com/item.html?itemID=111",
    title: "Celine Shirt 55or",
    image: "https://si.geilicdn.com/img-1.jpg",
    seller: "replux",
    category: "shirt",
    findStatus: "want",
    ...extra,
  };
}

function renderBody(item, extra = {}) {
  const onSaveEdit = extra.onSaveEdit || vi.fn();
  const utils = render(
    <DetailBody
      item={item}
      bodyProfile={{ chest: "96", height: "180", weight: "75" }}
      buyLabel="Buy via Superbuy"
      onOpen={vi.fn()}
      onAttachPhoto={vi.fn()}
      onRemovePhoto={vi.fn()}
      onOpenSizes={vi.fn()}
      {...extra}
      onSaveEdit={onSaveEdit}
    />
  );
  return { ...utils, onSaveEdit };
}

// jsdom has no real File encoder, but the read path only needs a Blob-shaped
// object it can hand to the mocked reader.
function fakePhoto(name = "chart.jpg") {
  return new File(["xxxx"], name, { type: "image/jpeg" });
}

beforeEach(() => {
  huntMock.mockResolvedValue(null);
  urlReadMock.mockResolvedValue(null);
  fileReadMock.mockResolvedValue(null);
  createObjectUrlMock.mockReturnValue("blob:thumb");
  URL.createObjectURL = createObjectUrlMock;
  URL.revokeObjectURL = revokeObjectUrlMock;
});

afterEach(() => {
  cleanup();
  huntMock.mockReset();
  urlReadMock.mockReset();
  fileReadMock.mockReset();
  createObjectUrlMock.mockReset();
  revokeObjectUrlMock.mockReset();
});

describe("§3 no-chart state", () => {
  it("asks for the chart photo once the hunt comes back empty", async () => {
    renderBody(chartless());

    // Spec step 3 (2026-08-08): the plain no-chart state is the locked pick
    // screen — the missing-chart line, chips, the truthful helper, and the
    // same two chart-entry actions Settings carries. No green, no wall.
    expect(await screen.findByText("No chart")).toBeInTheDocument();
    expect(
      screen.getByText("No size chart for this one yet.")
    ).toBeInTheDocument();
    expect(screen.getByText("Pick a size. It's saved on this card for when you order.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upload chart photo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enter chart by hand" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Upload chart photo" })).toHaveLength(1);
    // The bottom chart-actions row would say the same thing twice — it hides.
    expect(screen.queryByRole("button", { name: "Add a chart photo" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Type the chart" })).toBeNull();
    expect(document.querySelector(".cz-sizing-nochart")).not.toBe(null);
  });

  it("names the usual size in words, never as a shimmering AI pick", async () => {
    renderBody(chartless({ variants: [{ title: "Size", values: ["S", "M", "L"] }] }), {
      bodyProfile: { height: "183", weight: "75", chest: "99", usualTops: "L" },
    });

    expect(await screen.findByText("No chart")).toBeInTheDocument();
    expect(screen.getByText("Your usual size is Large.")).toBeInTheDocument();
    // The old big-letter value row is gone — nothing on this screen can
    // shimmer like an AI pick, because there is no pick without a chart.
    expect(document.querySelector(".cz-sizing-value")).toBe(null);
    // And no chip wears the green recommended mark before a chart exists.
    expect(document.querySelector(".cz-detail-size-choice.is-recommended")).toBe(null);
  });

  // Kyle 2026-08-03: "We got a big Fit section where there's nothing to do."
  // A lone letter above a missing-chart sentence answered nothing. The pane now
  // names the size in words, right under that sentence.
  it("names the size it is holding, in words", async () => {
    renderBody(chartless({ variants: [{ title: "Size", values: ["S", "M", "L"] }] }), {
      bodyProfile: { height: "183", weight: "75", chest: "99", usualTops: "L" },
    });

    expect(await screen.findByText("No chart")).toBeInTheDocument();
    // The line repeats the big word above it, so both say "Large", not "L".
    expect(screen.getByText("Your usual size is Large.")).toBeInTheDocument();
  });

  it("says the customer picked the size when the customer picked it", async () => {
    renderBody(
      chartless({
        size: "L",
        variants: [{ title: "Size", values: ["S", "M", "L"] }],
      }),
      { bodyProfile: { height: "183", weight: "75", chest: "99", usualTops: "M" } }
    );

    expect(await screen.findByText("No chart")).toBeInTheDocument();
    expect(screen.getByText("You picked Large.")).toBeInTheDocument();
    expect(screen.queryByText(/Your usual size is/)).toBe(null);
  });

  it("says so plainly when there is no usual size to fall back on", async () => {
    renderBody(chartless(), { bodyProfile: {} });

    expect(await screen.findByText("No chart")).toBeInTheDocument();
    // With no size to name, the pane prints no size line at all — the helper
    // and the two chart-entry actions still stand.
    expect(document.querySelector(".cz-sizing-picked")).toBe(null);
    expect(screen.getByText("Pick a size. It's saved on this card for when you order.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upload chart photo" })).toBeInTheDocument();
  });

  // Spec step 3 (2026-08-08), Kyle's shoe card: "(40) (41) (42) means nothing
  // to a US buyer." Every chip shows both systems, the run extends to cover
  // the saved usual, and no chip goes green before a chart exists.
  it("shoes: chips show both systems and the run covers the usual", async () => {
    renderBody(
      chartless({
        category: "shoes",
        variants: [{ title: "Size", values: ["40", "41", "42"] }],
      }),
      { bodyProfile: { usualShoes: "US 10" } }
    );

    expect(await screen.findByText("No chart")).toBeInTheDocument();
    expect(screen.getByText("Your usual size is US 10 (about EU 43).")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "EU 40 · US 7" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "EU 42 · US 9" })).toBeInTheDocument();
    // The run held 40–42; the buyer's converted usual adds the EU 43 chip.
    expect(screen.getByRole("button", { name: "EU 43 · US 10" })).toBeInTheDocument();
    expect(document.querySelector(".cz-detail-size-choice.is-recommended")).toBe(null);
  });

  it("shoes: one tap saves the size on the card", async () => {
    const onSaveEdit = vi.fn();
    renderBody(
      chartless({
        category: "shoes",
        variants: [{ title: "Size", values: ["40", "41", "42"] }],
      }),
      { bodyProfile: { usualShoes: "US 10" }, onSaveEdit }
    );

    expect(await screen.findByText("No chart")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "EU 43 · US 10" }));
    // Last tap wins, saved at once — the one-tap save rule (Kyle 2026-08-08).
    await waitFor(() =>
      expect(onSaveEdit).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ size: "43" })
      )
    );
  });

  // Kyle 2026-08-08: "buttons shift around in weird locations." The chip
  // window re-centred on every tap, so the next chip moved under the buyer's
  // finger. The pick screen shows the whole run, sorted, and it stays put.
  it("shoes: the full run shows sorted and stays put when a size is tapped", async () => {
    renderBody(
      chartless({
        category: "shoes",
        variants: [{ title: "Size", values: ["41", "42", "43", "46", "44", "45", "47"] }],
      }),
      { bodyProfile: { usualShoes: "US 10" } }
    );

    expect(await screen.findByText("No chart")).toBeInTheDocument();
    const names = () =>
      screen
        .getAllByRole("button", { name: /EU \d+ · US \d+/ })
        .map((b) => b.getAttribute("aria-label"));
    const before = names();
    // Seller order was 41, 42, 43, 46, 44, 45, 47 — the chips sort, and all
    // seven show (no ±2 window on the pick screen).
    expect(before).toEqual([
      "EU 41 · US 8",
      "EU 42 · US 9",
      "EU 43 · US 10",
      "EU 44 · US 11",
      "EU 45 · US 12",
      "EU 46 · US 13",
      "EU 47 · US 14",
    ]);
    fireEvent.click(screen.getByRole("button", { name: "EU 46 · US 13" }));
    expect(await screen.findByText("You picked 46.")).toBeInTheDocument();
    expect(names()).toEqual(before);
  });

  // Kyle 2026-08-08: "shoe size in measurements say 10, fit detail clocks me
  // as a 9." A hand pick that is not the saved usual names the usual in one
  // plain line. The same size in the other scale is not a gap.
  it("shoes: a pick that is not the saved usual shows the gap note", async () => {
    renderBody(
      chartless({
        category: "shoes",
        variants: [{ title: "Size", values: ["41", "42", "43"] }],
      }),
      { bodyProfile: { usualShoes: "US 10" } }
    );

    expect(await screen.findByText("No chart")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "EU 42 · US 9" }));
    expect(await screen.findByText("You picked 42.")).toBeInTheDocument();
    expect(
      screen.getByText("Your saved usual is US 10 (about EU 43).")
    ).toBeInTheDocument();

    // EU 43 IS the usual in the listing's scale — the note goes away.
    fireEvent.click(screen.getByRole("button", { name: "EU 43 · US 10" }));
    expect(await screen.findByText("You picked 43.")).toBeInTheDocument();
    expect(screen.queryByText(/Your saved usual is/)).toBe(null);
  });

  it("letters: a pick that is not the saved usual shows the gap note", async () => {
    renderBody(
      chartless({
        category: "shirt",
        variants: [{ title: "Size", values: ["S", "M", "L", "XL"] }],
      }),
      { bodyProfile: { usualTops: "L" } }
    );

    expect(await screen.findByText("No chart")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "X-Large" }));
    expect(await screen.findByText("You picked X-Large.")).toBeInTheDocument();
    expect(screen.getByText("Your saved usual is Large.")).toBeInTheDocument();
  });

  // Spec step 3b (2026-08-08): keychains, wallets and bags have no sizes.
  // One calm line — Kyle picked the words. No chips, no helper, and no
  // chart-entry buttons in the Fit tab; those stay in Settings only.
  it.each(["accessory", "bag"])("%s: one calm line, nothing else", async (category) => {
    renderBody(chartless({ category }));

    expect(await screen.findByText("No sizes")).toBeInTheDocument();
    expect(
      screen.getByText("One size only. The photos show how big it is.")
    ).toBeInTheDocument();
    expect(document.querySelector(".cz-detail-size-choices")).toBe(null);
    expect(screen.queryByText(/Pick a size/)).toBe(null);
    expect(screen.queryByRole("button", { name: "Upload chart photo" })).toBe(null);
    expect(screen.queryByRole("button", { name: "Enter chart by hand" })).toBe(null);
    expect(screen.queryByRole("button", { name: "Type the chart" })).toBe(null);
    expect(screen.queryByRole("button", { name: "Add a chart photo" })).toBe(null);
  });

  it("keeps item and profile sizing in the Size and fit section", async () => {
    const onOpenSizes = vi.fn();
    renderBody(chartless(), { onOpenSizes });

    await screen.findByText("No chart");
    const section = screen.getByRole("region", { name: "Size and fit" });
    // Round 4 point 1: the size editor sits inside the fit section, beside
    // the big size word — no rail Size section. The fifth box is visible with
    // no tap (Kyle 2026-07-29).
    expect(within(section).getByLabelText("Custom item size")).toBeInTheDocument();

    // Kyle 2026-07-30 shrank this state, and the fit-read table went with it.
    // "Edit my measurements" lived in that table's footnote, so the no-chart
    // card no longer offers it: with no seller numbers to compare, editing
    // your own changes nothing on this card. Profile still owns the route.
    expect(screen.queryByRole("button", { name: "Edit my measurements" })).toBe(null);
    expect(onOpenSizes).not.toHaveBeenCalled();
    // The two ways to get a chart are what this state offers instead (spec
    // step 3, 2026-08-08: same pair as Settings, full-width on the screen).
    expect(screen.getByRole("button", { name: "Upload chart photo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enter chart by hand" })).toBeInTheDocument();
  });

  // Kyle 2026-08-03: "if it doesnt catch it the first time it never does, take
  // it out." No button offers to read the album photos again, on any card.
  it("offers no album read, whatever photos the item holds", async () => {
    renderBody(
      chartless({ gallery: ["https://si.geilicdn.com/a.jpg", "https://si.geilicdn.com/b.jpg"] })
    );

    expect(await screen.findByText("No chart")).toBeInTheDocument();
    expect(screen.queryByText(/Read the \d+ album photos?/)).toBe(null);
    expect(document.querySelector(".cz-sizing-albumrow")).toBe(null);
  });

  it("offers no album read for a held-out chart tile either", async () => {
    renderBody(
      chartless({
        image: "https://si.geilicdn.com/product.jpg",
        gallery: [],
        chartImages: ["https://photo.yupoo.com/seller/chart1/big.jpg"],
      })
    );

    expect(await screen.findByText("No chart")).toBeInTheDocument();
    expect(screen.queryByText(/Read the \d+ album photos?/)).toBe(null);
    expect(document.querySelector(".cz-sizing-albumrow")).toBe(null);
  });
});

describe("§3 read and confirm", () => {
  // Kyle 2026-08-03: "it shouldn't have to REREAD." A read spends a daily
  // credit, so the answer lands on the card the moment it succeeds. The
  // preview still opens, so a correction is still possible.
  it("saves a read chart at once, and still shows the preview", async () => {
    fileReadMock.mockResolvedValue(CHART_TEXT);
    const user = userEvent.setup();
    const { onSaveEdit } = renderBody(chartless());

    await screen.findByText("No chart");
    const input = document.querySelector(".cz-detail-chart-file");
    await user.upload(input, fakePhoto());

    // The read-back names what it found, and counts it.
    expect(await screen.findByText("3 ROWS · 2 COLUMNS")).toBeInTheDocument();
    expect(screen.getByText("I found chest and length for 3 sizes.")).toBeInTheDocument();
    // The paid answer is on the card before the customer touches anything.
    expect(onSaveEdit).toHaveBeenCalledWith(expect.any(String), {
      sizeChartText: CHART_TEXT,
      sizeChartNeedsClear: false,
      sizeChartSource: {
        via: "customer-photo",
        photos: 1,
        at: expect.any(String),
        seller: "replux",
      },
    });
    expect(screen.getByRole("button", { name: "Use this chart" })).toBeInTheDocument();
  });

  it("writes the chart and its provenance on Use this chart", async () => {
    fileReadMock.mockResolvedValue(CHART_TEXT);
    const user = userEvent.setup();
    const { onSaveEdit } = renderBody(chartless());

    await screen.findByText("No chart");
    await user.upload(document.querySelector(".cz-detail-chart-file"), fakePhoto());
    await user.click(await screen.findByRole("button", { name: "Use this chart" }));

    expect(onSaveEdit).toHaveBeenCalledWith(expect.any(String), {
      sizeChartText: CHART_TEXT,
      sizeChartNeedsClear: false,
      sizeChartSource: {
        via: "customer-photo",
        photos: 1,
        at: expect.any(String),
        seller: "replux",
      },
    });
  });

  it("shows the scan line while the read is open", async () => {
    let finish;
    fileReadMock.mockImplementation(() => new Promise((r) => { finish = r; }));
    const user = userEvent.setup();
    renderBody(chartless());

    await screen.findByText("No chart");
    await user.upload(document.querySelector(".cz-detail-chart-file"), fakePhoto());

    expect(await screen.findByText("READING…")).toBeInTheDocument();
    expect(screen.getByText(/Reading the numbers off your photo/)).toBeInTheDocument();
    expect(document.querySelector(".cz-sizing-read-thumb.is-scanning")).not.toBe(null);
    // No confirm button exists while the answer is unknown.
    expect(screen.queryByRole("button", { name: "Use this chart" })).toBe(null);

    finish(CHART_TEXT);
    await waitFor(() =>
      expect(document.querySelector(".cz-sizing-read-thumb.is-scanning")).toBe(null)
    );
  });

  it("offers a retake when the photo does not read", async () => {
    fileReadMock.mockResolvedValue(null);
    const user = userEvent.setup();
    const { onSaveEdit } = renderBody(chartless());

    await screen.findByText("No chart");
    await user.upload(document.querySelector(".cz-detail-chart-file"), fakePhoto());

    expect(await screen.findByText("COULD NOT READ")).toBeInTheDocument();
    expect(screen.getByText(/whole table in frame/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try another photo" })).toBeInTheDocument();
    // The failed photo read saves nothing. The one allowed save is the silent
    // hunt's no-find stamp (Kyle 2026-08-04) — it carries no chart text.
    expect(
      onSaveEdit.mock.calls.filter(([, patch]) => patch && !patch.sizeChartHunt)
    ).toHaveLength(0);
  });

  it("Try another photo re-opens the file picker after a failed read", async () => {
    // Kyle 2026-08-02: the button was a dead dismiss. It must open the picker.
    fileReadMock.mockResolvedValue(null);
    const user = userEvent.setup();
    renderBody(chartless());

    await screen.findByText("No chart");
    await user.upload(document.querySelector(".cz-detail-chart-file"), fakePhoto());
    expect(await screen.findByText("COULD NOT READ")).toBeInTheDocument();

    const input = document.querySelector(".cz-detail-chart-file");
    const clickSpy = vi.spyOn(input, "click");
    await user.click(screen.getByRole("button", { name: "Try another photo" }));
    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });

  it("Try another photo keeps the failed-read prompt if the picker is cancelled", async () => {
    // Kyle 2026-08-02 item 8: dismiss-before-click tore the prompt down; cancel
    // never restored it. Open the picker without clearing error state.
    fileReadMock.mockResolvedValue(null);
    const user = userEvent.setup();
    renderBody(chartless());

    await screen.findByText("No chart");
    await user.upload(document.querySelector(".cz-detail-chart-file"), fakePhoto());
    expect(await screen.findByText("COULD NOT READ")).toBeInTheDocument();
    expect(screen.getByText(/whole table in frame/)).toBeInTheDocument();

    const input = document.querySelector(".cz-detail-chart-file");
    const clickSpy = vi.spyOn(input, "click");
    await user.click(screen.getByRole("button", { name: "Try another photo" }));
    expect(clickSpy).toHaveBeenCalled();
    // Simulate OS cancel: cancel event, no change/upload. Prompt must stay.
    fireEvent(input, new Event("cancel", { bubbles: true, cancelable: true }));
    expect(screen.getByText("COULD NOT READ")).toBeInTheDocument();
    expect(screen.getByText(/whole table in frame/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try another photo" })).toBeInTheDocument();
    clickSpy.mockRestore();
  });

  it("distinguishes a read photo with no sizes in it from an unreadable one", async () => {
    // Text came back, but no row parsed. That is a different mistake, and it
    // gets different advice: straighten the shot, do not reframe it.
    fileReadMock.mockResolvedValue("Machine wash cold. Do not bleach.");
    const user = userEvent.setup();
    renderBody(chartless());

    await screen.findByText("No chart");
    await user.upload(document.querySelector(".cz-detail-chart-file"), fakePhoto());

    expect(await screen.findByText(/could not find sizes in it/)).toBeInTheDocument();
    expect(screen.getByText(/straighter shot of the table/)).toBeInTheDocument();
  });

  it("corrects a misread digit in place, and saves the correction", async () => {
    // The vision read gets a digit wrong often enough that a chart with one bad
    // cell must be salvageable. Rejecting the whole read is the worse option.
    fileReadMock.mockResolvedValue(CHART_TEXT);
    const user = userEvent.setup();
    const { onSaveEdit } = renderBody(chartless());

    await screen.findByText("No chart");
    await user.upload(document.querySelector(".cz-detail-chart-file"), fakePhoto());
    await user.click(await screen.findByRole("button", { name: "Fix a number" }));

    // One input per cell, laid out as the table. Three sizes × two columns.
    const cells = document.querySelectorAll(".cz-sizing-fix-cell");
    expect(cells.length).toBe(6);
    const large = screen.getByLabelText("Large chest in cm");
    expect(large.value).toBe("120");

    await user.clear(large);
    await user.type(large, "118");
    await user.click(screen.getByRole("button", { name: "Use this chart" }));

    // Call 0 is the auto-save of the raw read. The correction is the last one.
    const patch = onSaveEdit.mock.calls[onSaveEdit.mock.calls.length - 1][1];
    expect(patch.sizeChartText).toContain("L: chest 118");
    expect(patch.sizeChartText).not.toContain("chest 120");
    expect(patch.sizeChartText).toContain("M: chest 116");
  });

  it("keeps the corrected chart across a re-render", async () => {
    // A fix that only touched the parsed object would vanish on the next
    // render. Reading the cell back proves the text round-tripped.
    fileReadMock.mockResolvedValue(CHART_TEXT);
    const user = userEvent.setup();
    renderBody(chartless());

    await screen.findByText("No chart");
    await user.upload(document.querySelector(".cz-detail-chart-file"), fakePhoto());
    await user.click(await screen.findByRole("button", { name: "Fix a number" }));
    const large = screen.getByLabelText("Large chest in cm");
    await user.clear(large);
    await user.type(large, "118");

    expect(screen.getByLabelText("Large chest in cm").value).toBe("118");
    // Close the editor: the preview row must show the corrected number.
    await user.click(screen.getByRole("button", { name: "Done fixing" }));
    expect(screen.getByText("118cm")).toBeInTheDocument();
  });

  it("keeps cm in the fix cells even when the display unit is inches", async () => {
    // The numbers on the tag are cm. Asking anyone to convert a correction back
    // to cm is how a second error gets in.
    fileReadMock.mockResolvedValue(CHART_TEXT);
    const user = userEvent.setup();
    renderBody(chartless(), { measureUnits: "in" });

    await screen.findByText("No chart");
    await user.upload(document.querySelector(".cz-detail-chart-file"), fakePhoto());
    await user.click(await screen.findByRole("button", { name: "Fix a number" }));

    expect(screen.getByLabelText("Large chest in cm").value).toBe("120");
    expect(screen.getByText("chest (cm)")).toBeInTheDocument();
  });

  it("refuses letters in a fix cell", async () => {
    fileReadMock.mockResolvedValue(CHART_TEXT);
    const user = userEvent.setup();
    renderBody(chartless());

    await screen.findByText("No chart");
    await user.upload(document.querySelector(".cz-detail-chart-file"), fakePhoto());
    await user.click(await screen.findByRole("button", { name: "Fix a number" }));
    const large = screen.getByLabelText("Large chest in cm");
    await user.clear(large);
    await user.type(large, "1x2y");
    expect(large.value).toBe("12");
  });

  it("takes the auto-saved chart back off the card on Not this one", async () => {
    fileReadMock.mockResolvedValue(CHART_TEXT);
    const user = userEvent.setup();
    const { onSaveEdit } = renderBody(chartless());

    await screen.findByText("No chart");
    await user.upload(document.querySelector(".cz-detail-chart-file"), fakePhoto());
    await user.click(await screen.findByRole("button", { name: "Not this one" }));

    // Back at the ask: the pick screen returns, nothing was saved. This
    // fixture saves no usual size, so the fallback line stays empty (Oom
    // review 2026-07-29). The pick screen's upload action replaces the old
    // bottom-row "Add a chart photo" (spec step 3, 2026-08-08).
    expect(await screen.findByRole("button", { name: "Upload chart photo" })).toBeInTheDocument();
    expect(screen.queryByText("FELL BACK TO YOUR USUAL")).toBeNull();
    // The read saved itself, so rejecting it must clear the card again.
    expect(onSaveEdit).toHaveBeenLastCalledWith(expect.any(String), {
      sizeChartText: "",
      sizeChartSource: null,
      sizeChartNeedsClear: false,
    });
    await waitFor(() => expect(revokeObjectUrlMock).toHaveBeenCalledWith("blob:thumb"));
  });

  it("revokes the upload preview on unmount", async () => {
    fileReadMock.mockResolvedValue(CHART_TEXT);
    const user = userEvent.setup();
    const { unmount } = renderBody(chartless());

    await screen.findByText("No chart");
    await user.upload(document.querySelector(".cz-detail-chart-file"), fakePhoto());
    await screen.findByRole("button", { name: "Use this chart" });
    unmount();

    expect(revokeObjectUrlMock).toHaveBeenCalledWith("blob:thumb");
  });

  // Kyle 2026-08-03: "if it doesnt catch it the first time it never does, take
  // it out." Two cases used to press the album row and pin how the paid read
  // picked its photo. The row is gone, so the cases went with it. The automatic
  // hunt still covers the same paid path in size-chart-hunt.test.js.

  it("sends a camera frame inline, never as a URL", async () => {
    fileReadMock.mockResolvedValue(CHART_TEXT);
    const user = userEvent.setup();
    renderBody(chartless());

    await screen.findByText("No chart");
    await user.upload(document.querySelector(".cz-detail-chart-file"), fakePhoto());

    await screen.findByText("Use this chart");
    expect(fileReadMock).toHaveBeenCalledTimes(1);
    expect(urlReadMock).not.toHaveBeenCalled();
  });
});
