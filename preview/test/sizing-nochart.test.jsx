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
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { huntMock, urlReadMock, fileReadMock, createObjectUrlMock, revokeObjectUrlMock } = vi.hoisted(() => ({
  huntMock: vi.fn(),
  urlReadMock: vi.fn(),
  fileReadMock: vi.fn(),
  createObjectUrlMock: vi.fn(),
  revokeObjectUrlMock: vi.fn(),
}));

vi.mock("../../components/size-chart-hunt.js", () => ({ huntSizeChart: huntMock }));

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

    // Provenance names the fallback rather than claiming a source.
    expect(await screen.findByText("No chart")).toBeInTheDocument();
    expect(screen.getByText("FELL BACK TO YOUR USUAL")).toBeInTheDocument();
    expect(
      screen.getByText("The listing had no measurements. Upload the seller chart to read its measurements.")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upload chart photo" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Upload chart photo" })).toHaveLength(1);
    expect(document.querySelector(".cz-sizing-nochart")).not.toBe(null);
  });

  it("renders the usual size flat, and says it is not verified", async () => {
    renderBody(chartless({ variants: [{ title: "Size", values: ["S", "M", "L"] }] }), {
      bodyProfile: { height: "183", weight: "75", chest: "99", usualTops: "L" },
    });

    expect(await screen.findByText("No chart")).toBeInTheDocument();
    expect(screen.getByText("your usual · not verified")).toBeInTheDocument();
    // A usual size is better than a dash, but it must never shimmer like an
    // AI pick. The shimmer class is the tell.
    const value = document.querySelector(".cz-sizing-value");
    expect(value.className).not.toContain("t-shimmer");
  });

  it("says so plainly when there is no usual size to fall back on", async () => {
    renderBody(chartless(), { bodyProfile: {} });

    expect(await screen.findByText("No chart")).toBeInTheDocument();
    expect(screen.getByText("no usual size saved")).toBeInTheDocument();
    expect(document.querySelector(".cz-sizing-value.is-empty")).not.toBe(null);
  });

  it("keeps item and profile sizing in the Size and fit section", async () => {
    const user = userEvent.setup();
    const onOpenSizes = vi.fn();
    renderBody(chartless(), { onOpenSizes });

    await screen.findByText("No chart");
    const section = screen.getByRole("region", { name: "Size and fit" });
    // Round 4 point 1: the size editor sits inside the fit section, beside
    // the big size word — visible with no tap, no rail Size section.
    expect(within(section).getByLabelText("Custom item size")).toBeInTheDocument();

    // Round 4 point 3: "Edit sizes and measurements" left the chart actions;
    // the profile-size route is the fit read footnote now.
    await user.click(screen.getByRole("button", { name: "Edit my measurements" }));
    expect(onOpenSizes).toHaveBeenCalledTimes(1);
  });

  it("offers the item's own album photos as a shortcut", async () => {
    renderBody(
      chartless({ gallery: ["https://si.geilicdn.com/a.jpg", "https://si.geilicdn.com/b.jpg"] })
    );

    expect(await screen.findByText("No chart")).toBeInTheDocument();
    // Three photos: the cover plus the two gallery frames.
    expect(screen.getByText("Read the 3 album photos")).toBeInTheDocument();
    expect(document.querySelectorAll(".cz-sizing-albumthumb").length).toBe(2);
  });

  it("hides the album row when the item has no remote photos", async () => {
    renderBody(chartless({ image: "" }));

    expect(await screen.findByText("No chart")).toBeInTheDocument();
    expect(document.querySelector(".cz-sizing-albumrow")).toBe(null);
  });
});

describe("§3 read and confirm", () => {
  it("stages a read chart instead of committing it", async () => {
    fileReadMock.mockResolvedValue(CHART_TEXT);
    const user = userEvent.setup();
    const { onSaveEdit } = renderBody(chartless());

    await screen.findByText("No chart");
    const input = document.querySelector(".cz-detail-chart-file");
    await user.upload(input, fakePhoto());

    // The read-back names what it found, and counts it.
    expect(await screen.findByText("3 ROWS · 2 COLUMNS")).toBeInTheDocument();
    expect(screen.getByText("I found chest and length for 3 sizes.")).toBeInTheDocument();
    // Nothing lands until the customer says so.
    expect(onSaveEdit).not.toHaveBeenCalled();
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
      sizeNotes: CHART_TEXT,
      // The seller tag is the cache key. Without it the next item from this
      // seller pays for a second vision read.
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
    expect(onSaveEdit).not.toHaveBeenCalled();
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

    // The correction lands as TEXT, because sizeNotes is the stored thing and
    // every render re-parses it.
    const patch = onSaveEdit.mock.calls[0][1];
    expect(patch.sizeNotes).toContain("L: chest 118");
    expect(patch.sizeNotes).not.toContain("chest 120");
    expect(patch.sizeNotes).toContain("M: chest 116");
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

  it("returns to the ask on Not this one, without saving", async () => {
    fileReadMock.mockResolvedValue(CHART_TEXT);
    const user = userEvent.setup();
    const { onSaveEdit } = renderBody(chartless());

    await screen.findByText("No chart");
    await user.upload(document.querySelector(".cz-detail-chart-file"), fakePhoto());
    await user.click(await screen.findByRole("button", { name: "Not this one" }));

    expect(await screen.findByText("FELL BACK TO YOUR USUAL")).toBeInTheDocument();
    expect(onSaveEdit).not.toHaveBeenCalled();
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

  it("sends album photos down the URL door, never inline", async () => {
    urlReadMock.mockResolvedValue(CHART_TEXT);
    const user = userEvent.setup();
    renderBody(chartless({ gallery: ["https://si.geilicdn.com/a.jpg"] }));

    await screen.findByText("No chart");
    await user.click(screen.getByRole("button", { name: /Read the 2 album photos/ }));

    await screen.findByText("Use this chart");
    expect(urlReadMock).toHaveBeenCalledTimes(1);
    expect(urlReadMock.mock.calls[0][0]).toEqual([
      "https://si.geilicdn.com/img-1.jpg",
      "https://si.geilicdn.com/a.jpg",
    ]);
    expect(fileReadMock).not.toHaveBeenCalled();
  });

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
