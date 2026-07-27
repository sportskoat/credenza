// Chart hunt (components/DetailBody.jsx) regression tests.
// 2026-07-25, Kyle: "WHAT IS GOING ON WITH THE SIZING CHARTS. WHY CAN'T IT
// WORK WITH RECOMMENDED SIZES." Root cause: the silent chart hunt lived in
// the orphaned desktop SizeRecommendation panel, so the live FitBlock only
// ever READ charts — it never fetched them. The hunt runs once per item
// (album text, then a vision read of the photos), writes the find into
// sizeNotes, and the recommendation appears.
//
// Handoff turn 9 §2 moved two things these tests depend on:
//   - the hunt starts when the DETAIL opens, not when a size cell is tapped,
//     because the sizing block is now always visible;
//   - the retired "Size · fit" cell is replaced by the sizing block's
//     "Full chart" button, which opens the same FitBlock sheet.
// So the hunt assertions need no click, and the sheet assertions click
// "Full chart". While the hunt runs the sizing block reads READING CHART.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

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

// A chartless item re-renders when the hunt returns nothing: turn 9 §3 swaps
// the ordinary sizing block for the no-chart block, and that mounts a fresh
// "Full chart" button. A node captured before the swap is detached, so the
// click lands nowhere. Wait for the swap, then query the live node.
async function clickFullChart(user) {
  await screen.findByText("No chart");
  await user.click(screen.getByRole("button", { name: /Full chart/ }));
}

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

    // The found chart writes into sizeNotes (+ its provenance tag) through
    // the normal save path.
    await waitFor(() => expect(onSaveEdit).toHaveBeenCalledWith("hunt-a", {
      sizeNotes: CHART_TEXT,
      sizeChartSource: { via: "desc-photos", photos: 10, at: expect.any(String) },
    }));
    expect(huntMock).toHaveBeenCalledTimes(1);
  });

  it("shows the recommendation once the item carries the hunted chart", async () => {
    huntMock.mockResolvedValue(null); // hunted already; nothing new
    const item = { ...noChartItem("hunt-b"), sizeNotes: CHART_TEXT };
    const user = userEvent.setup();
    renderBody(item);

    await user.click(screen.getByRole("button", { name: /Full chart/ }));
    expect(await screen.findByText("We recommend")).toBeInTheDocument();
    // A chart-bearing item never hunts.
    expect(huntMock).not.toHaveBeenCalled();
  });

  it("earns the precise badge when the deciding measurement is real", async () => {
    huntMock.mockResolvedValue(null);
    const item = { ...noChartItem("hunt-b2"), sizeNotes: CHART_TEXT };
    const user = userEvent.setup();
    // Chest measured; waist/hip estimated by effectiveBodyProfile. A shirt
    // decides on chest, so the verdict is not a guess.
    renderBody(item);

    await user.click(screen.getByRole("button", { name: /Full chart/ }));
    expect(await screen.findByText("Read from the seller's chart")).toBeInTheDocument();
    expect(screen.queryByText("Best guess")).not.toBeInTheDocument();
  });

  it("hedges the badge when the deciding measurement is estimated", async () => {
    huntMock.mockResolvedValue(null);
    const item = { ...noChartItem("hunt-b3"), sizeNotes: CHART_TEXT };
    const user = userEvent.setup();
    // No chest — every tape number comes from the height/weight estimate.
    renderBody(item, { bodyProfile: { height: "180", weight: "75" } });

    await user.click(screen.getByRole("button", { name: /Full chart/ }));
    expect(await screen.findByText("Best guess")).toBeInTheDocument();
    expect(screen.queryByText("Read from the seller's chart")).not.toBeInTheDocument();
  });

  it("a failed hunt falls back to the static empty copy", async () => {
    huntMock.mockResolvedValue(null);
    const user = userEvent.setup();
    renderBody(noChartItem("hunt-c"));

    await clickFullChart(user);
    expect(
      await screen.findByText(/No size chart on this listing\. Add your usual tops, bottoms, or shoes in My sizes\./)
    ).toBeInTheDocument();
    expect(huntMock).toHaveBeenCalledTimes(1);
  });

  it("does not stick on Looking when a remount aborts the first hunt", async () => {
    // Strict Mode / panel remount used to leave hunting=true after abort and
    // mark the item tried, so the spinner never cleared (Kyle 2026-07-25).
    let resolveHunt;
    huntMock.mockImplementation(() => new Promise((resolve) => { resolveHunt = resolve; }));
    const item = noChartItem("hunt-stuck");
    const user = userEvent.setup();
    const { unmount } = renderBody(item);
    await user.click(screen.getByRole("button", { name: /Full chart/ }));
    expect(await screen.findByText("Looking for the seller's size chart…")).toBeInTheDocument();
    unmount();
    // Stale resolve must not throw; hunting cleared on unmount.
    resolveHunt(null);

    huntMock.mockResolvedValue(null);
    renderBody(item);
    await user.click(screen.getByRole("button", { name: /Full chart/ }));
    // A completed null hunt must clear the spinner (retry allowed after abort).
    await waitFor(() => {
      expect(screen.queryByText("Looking for the seller's size chart…")).not.toBeInTheDocument();
    });
  });

  it("shows usual tops as the hero when body prefs exist but no chart", async () => {
    // Kyle 2026-07-25: saving body prefs still left "No recommendation" and
    // promoted the raw S–2XL run as the big size. Usual size must surface.
    huntMock.mockResolvedValue(null);
    const item = {
      ...noChartItem("hunt-usual"),
      variants: [{ title: "Size", values: ["S", "M", "L", "XL", "2XL"] }],
    };
    const user = userEvent.setup();
    renderBody(item, {
      bodyProfile: {
        height: "183",
        weight: "75",
        chest: "99",
        usualTops: "L",
      },
    });

    await clickFullChart(user);
    expect(await screen.findByText("Your usual")).toBeInTheDocument();
    expect(screen.getByText("Your usual size")).toBeInTheDocument();
    // Hero + override chip both say Large — not the full S–2XL run as hero.
    expect(screen.getAllByText("Large").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("No recommendation")).not.toBeInTheDocument();
    expect(screen.getByText(/Seller run S–2XL/)).toBeInTheDocument();
  });
});
