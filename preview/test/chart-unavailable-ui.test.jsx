// Kyle 2026-08-03, after the cards-wall fix: "yes" to fixing the last honest
// gap. A slow server, a timeout, or no internet still printed "I could not
// read that photo." The photo was never looked at, so that sentence is a lie.
//
// This file pins what the customer sees instead: "Not answering", a sentence
// that clears the photo, and a "Try again" button that repeats the SAME read.
// The file picker is never the first offer, because nothing was picked wrong.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const { huntMock, fetchMock } = vi.hoisted(() => ({
  huntMock: vi.fn(),
  fetchMock: vi.fn(),
}));

vi.mock("../../components/size-chart-hunt.js", async () => {
  const actual = await vi.importActual("../../components/size-chart-hunt.js");
  // Keep the real fingerprint + version: the hook reads them to skip a
  // stamped miss. Only the hunt itself is stubbed.
  return { ...actual, huntSizeChart: huntMock };
});

const { default: DetailBody } = await import("../../components/DetailBody.jsx");
const {
  CHART_OFFLINE_COPY,
  CHART_UNAVAILABLE_COPY,
  CHART_HUNT_UNAVAILABLE_COPY,
  CHART_RATE_LIMITED_COPY,
  CHART_READER_OFF_COPY,
} = await import("../../credenza-fashion.jsx");

const PHOTOS = ["https://si.geilicdn.com/img-2.jpg", "https://si.geilicdn.com/img-3.jpg"];

// The hunt keeps a module-level list of item ids it already tried, so two
// tests that share an id would skip the second hunt. Give every case its own.
let nextId = 0;

function chartless(extra = {}) {
  nextId += 1;
  return {
    id: "out-" + nextId,
    createdAt: 1753400000000,
    url: "https://weidian.com/item.html?itemID=7796666481",
    title: "OOW short sleeve tee",
    image: "https://si.geilicdn.com/img-1.jpg",
    gallery: PHOTOS,
    seller: "oow",
    category: "shirt",
    findStatus: "want",
    ...extra,
  };
}

function renderBody(item, extra = {}) {
  return render(
    <DetailBody
      item={item}
      bodyProfile={{ chest: "96", height: "180", weight: "75" }}
      buyLabel="Buy via Superbuy"
      onOpen={vi.fn()}
      onAttachPhoto={vi.fn()}
      onRemovePhoto={vi.fn()}
      onOpenSizes={vi.fn()}
      onSaveEdit={vi.fn()}
      {...extra}
    />
  );
}

// Answer the chart-vision door with a status. Everything that is not 200,
// 401, 403 or 429 is the server failing, not the photo.
function serverAnswers(status, body) {
  fetchMock.mockResolvedValue({
    ok: status === 200,
    status,
    json: async () => body || {},
    text: async () => "",
  });
}

// jsdom draws nothing. The upload path shrinks the frame before it posts it,
// so give that path a canvas that answers. Without these the frame is dropped
// and no read ever reaches the door under test.
const canvasStubs = [];
function stubCanvas() {
  const proto = HTMLCanvasElement.prototype;
  canvasStubs.push(
    ["getContext", Object.getOwnPropertyDescriptor(proto, "getContext")],
    ["toBlob", Object.getOwnPropertyDescriptor(proto, "toBlob")]
  );
  proto.getContext = () => ({ drawImage: () => {} });
  proto.toBlob = function (callback, type) {
    callback(new Blob(["x"], { type: type || "image/webp" }));
  };
}
function restoreCanvas() {
  for (const [name, descriptor] of canvasStubs.splice(0)) {
    if (descriptor) Object.defineProperty(HTMLCanvasElement.prototype, name, descriptor);
    else delete HTMLCanvasElement.prototype[name];
  }
}

beforeEach(() => {
  huntMock.mockResolvedValue(null);
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("createImageBitmap", async () => ({ width: 80, height: 60, close() {} }));
  stubCanvas();
});

afterEach(() => {
  cleanup();
  restoreCanvas();
  vi.unstubAllGlobals();
  huntMock.mockReset();
  fetchMock.mockReset();
});

// Kyle 2026-08-03: "if it doesnt catch it the first time it never does, take it
// out." The album row used to start these reads. It is gone. The customer's own
// chart photo is the only manual read left, so every case drives that one.
async function readAChartPhoto() {
  const picker = await waitFor(() => {
    const input = document.querySelector(".cz-detail-chart-file");
    if (!input) throw new Error("no chart file input");
    return input;
  });
  fireEvent.change(picker, {
    target: { files: [new File(["xxxx"], "chart.jpg", { type: "image/jpeg" })] },
  });
}

describe("the reader does not answer", () => {
  it("says 'Not answering' instead of blaming the photo", async () => {
    serverAnswers(502);
    renderBody(chartless());
    await readAChartPhoto();

    expect(await screen.findByText("Not answering")).toBeInTheDocument();
    expect(screen.getByText(CHART_UNAVAILABLE_COPY)).toBeInTheDocument();
    expect(screen.queryByText(/could not read that photo/)).toBe(null);
  });

  it("names the state in the provenance line too", async () => {
    serverAnswers(504);
    renderBody(chartless());
    await readAChartPhoto();

    expect(await screen.findByText("NOT ANSWERING")).toBeInTheDocument();
    expect(screen.queryByText("COULD NOT READ")).toBe(null);
  });

  it("offers the same photos again, not the file picker", async () => {
    serverAnswers(502);
    renderBody(chartless());
    await readAChartPhoto();

    await screen.findByText("Not answering");
    const callsBefore = fetchMock.mock.calls.length;
    // "Try again" is the primary offer. A different photo is the second one.
    const retry = screen.getByRole("button", { name: "Try again" });
    expect(retry.className).toContain("is-primary");
    expect(screen.getByRole("button", { name: "Try another photo" })).toBeInTheDocument();

    fireEvent.click(retry);
    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(callsBefore));
  });

  it("tells an offline person to connect, and never calls the server", async () => {
    const online = Object.getOwnPropertyDescriptor(window.navigator, "onLine");
    Object.defineProperty(window.navigator, "onLine", { value: false, configurable: true });
    try {
      renderBody(chartless());
      await readAChartPhoto();

      expect(await screen.findByText(CHART_OFFLINE_COPY)).toBeInTheDocument();
      expect(screen.getByText("Not answering")).toBeInTheDocument();
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      if (online) Object.defineProperty(window.navigator, "onLine", online);
    }
  });

  it("still says 'no sizes' when a photo did come back with none", async () => {
    // A real answer beats a server fault. The customer learns the more useful
    // thing: this photo holds no table.
    serverAnswers(200, { found: false });
    renderBody(chartless());
    await readAChartPhoto();

    await waitFor(() => expect(screen.queryByText("Not answering")).toBe(null));
    expect(screen.queryByText(CHART_UNAVAILABLE_COPY)).toBe(null);
  });
});

describe("the silent hunt cannot reach the reader", () => {
  it("does not claim the item has no chart", async () => {
    huntMock.mockResolvedValue({ unavailable: true });
    renderBody(chartless());

    expect(await screen.findByText("Not answering")).toBeInTheDocument();
    expect(screen.getByText(CHART_HUNT_UNAVAILABLE_COPY)).toBeInTheDocument();
    expect(screen.queryByText("No chart for this one yet.")).toBe(null);
  });

  // #31 (Kyle 2026-08-04): a rate-window 429 used to print "You used your 8
  // free chart reads" — on the owner's unlimited account. The wall now says
  // Busy and tells the person to wait one minute.
  it("says Busy, never the plan-cap sentence, on a rate window", async () => {
    huntMock.mockResolvedValue({ rateLimited: true });
    renderBody(chartless());

    expect(await screen.findByText("Busy")).toBeInTheDocument();
    expect(screen.getByText(CHART_RATE_LIMITED_COPY)).toBeInTheDocument();
    expect(screen.queryByText(/free chart reads/)).toBe(null);
    expect(screen.queryByText("No chart for this one yet.")).toBe(null);
  });

  // #31: the site-wide daily cost guard is its own wall, with its own
  // instruction — come back tomorrow. Never the plan-cap sentence.
  it("says Back tomorrow, never the plan-cap sentence, on the daily guard", async () => {
    huntMock.mockResolvedValue({ readerOff: true });
    renderBody(chartless());

    expect(await screen.findByText("Back tomorrow")).toBeInTheDocument();
    expect(screen.getByText(CHART_READER_OFF_COPY)).toBeInTheDocument();
    expect(screen.queryByText(/free chart reads/)).toBe(null);
    expect(screen.queryByText("No chart for this one yet.")).toBe(null);
  });

  // Kyle 2026-08-03: "if you wait around long enough, switch on and off, go to
  // different tabs, and come back." Every return started a new paid search.
  // #31e (Kyle 2026-08-04): the reopen must ALSO keep the true reason. The
  // tried-list stops the second search; the session map restores the wall.
  it("starts no second search when the card opens again, and keeps the reason", async () => {
    huntMock.mockResolvedValue({ unavailable: true });
    const item = chartless();
    renderBody(item);
    expect(await screen.findByText("Not answering")).toBeInTheDocument();
    const callsAfterFirst = huntMock.mock.calls.length;
    expect(callsAfterFirst).toBeGreaterThan(0);

    cleanup();
    renderBody(item);
    // The honest wall comes back — never the generic "No chart" claim, which
    // says something about the item that nobody checked.
    expect(await screen.findByText("Not answering")).toBeInTheDocument();
    expect(screen.getByText(CHART_HUNT_UNAVAILABLE_COPY)).toBeInTheDocument();
    expect(screen.queryByText("No chart for this one yet.")).toBe(null);
    expect(huntMock.mock.calls.length).toBe(callsAfterFirst);
  });

  // #31e: same rule for a traffic guard. The reopen says Busy again instead
  // of forgetting, and still spends nothing.
  it("keeps the Busy wall on a reopen, with no second search", async () => {
    huntMock.mockResolvedValue({ rateLimited: true });
    const item = chartless();
    renderBody(item);
    expect(await screen.findByText("Busy")).toBeInTheDocument();
    const callsAfterFirst = huntMock.mock.calls.length;

    cleanup();
    renderBody(item);
    expect(await screen.findByText("Busy")).toBeInTheDocument();
    expect(screen.getByText(CHART_RATE_LIMITED_COPY)).toBeInTheDocument();
    expect(screen.queryByText("No chart for this one yet.")).toBe(null);
    expect(huntMock.mock.calls.length).toBe(callsAfterFirst);
  });

  // Kyle 2026-08-06: "none of my chart reads work." The Busy wall says "wait
  // one minute, then open this card again", but the reopen was refused until a
  // page reload, so the wall looked permanent. A wall that promises a minute
  // must honour the minute.
  it("retries the Busy wall after one minute, and finds the chart", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      huntMock.mockResolvedValue({ rateLimited: true });
      const item = chartless();
      renderBody(item);
      expect(await screen.findByText("Busy")).toBeInTheDocument();
      const callsAfterFirst = huntMock.mock.calls.length;

      // The window has lifted, and the reader now answers.
      huntMock.mockResolvedValue({ text: "胸围 104" });
      vi.advanceTimersByTime(61 * 1000);
      cleanup();
      renderBody(item);

      await waitFor(() => expect(huntMock.mock.calls.length).toBeGreaterThan(callsAfterFirst));
      expect(screen.queryByText(CHART_RATE_LIMITED_COPY)).toBe(null);
    } finally {
      vi.useRealTimers();
    }
  });

  // The daily guard says it comes back tomorrow, so one minute changes nothing.
  // A second search there would spend against a ceiling that is already met.
  it("keeps the Back tomorrow wall after a minute, with no second search", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      huntMock.mockResolvedValue({ readerOff: true });
      const item = chartless();
      renderBody(item);
      expect(await screen.findByText("Back tomorrow")).toBeInTheDocument();
      const callsAfterFirst = huntMock.mock.calls.length;

      vi.advanceTimersByTime(61 * 1000);
      cleanup();
      renderBody(item);

      expect(await screen.findByText("Back tomorrow")).toBeInTheDocument();
      expect(huntMock.mock.calls.length).toBe(callsAfterFirst);
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps saying 'No size chart for this one yet.' when the hunt really found none", async () => {
    huntMock.mockResolvedValue(null);
    renderBody(chartless());

    expect(await screen.findByText("No size chart for this one yet.")).toBeInTheDocument();
    expect(screen.queryByText("Not answering")).toBe(null);
  });
});
