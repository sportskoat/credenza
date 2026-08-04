// Kyle 2026-08-03, Weidian item 7796666481: "why didn't this get pulled in.
// is because im out of free cards? if so we need to delegate the reason that
// this was not pulled in BECAUSE the customer is out of cards, and it should
// pull up a modal".
//
// The chart sat in the seller's product details. Reading that feed costs one
// card. With the day's cards spent the card holds only product shots, so the
// old state offered a read that could only fail, and then blamed the photo.
// This file pins the honest state instead: name the cards, offer the plans
// sheet, and hide the doomed read.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const { huntMock, needsCardsMock, limitsOpenMock } = vi.hoisted(() => ({
  huntMock: vi.fn(),
  needsCardsMock: vi.fn(),
  limitsOpenMock: vi.fn(),
}));

vi.mock("../../components/size-chart-hunt.js", () => ({ huntSizeChart: huntMock }));

vi.mock("../../credenza-fashion.jsx", async () => {
  const real = await vi.importActual("../../credenza-fashion.jsx");
  return { ...real, chartNeedsCards: needsCardsMock };
});

const { default: DetailBody } = await import("../../components/DetailBody.jsx");
const { setLimitsOpenHook } = await import("../../credenza-fashion.jsx");

function chartless(extra = {}) {
  return {
    id: "cards-1",
    createdAt: 1753400000000,
    url: "https://weidian.com/item.html?itemID=7796666481",
    title: "OOW short sleeve tee",
    image: "https://si.geilicdn.com/img-1.jpg",
    gallery: ["https://si.geilicdn.com/img-2.jpg"],
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

beforeEach(() => {
  huntMock.mockResolvedValue(null);
  needsCardsMock.mockReturnValue(true);
  setLimitsOpenHook(limitsOpenMock);
});

afterEach(() => {
  cleanup();
  huntMock.mockReset();
  needsCardsMock.mockReset();
  limitsOpenMock.mockReset();
  setLimitsOpenHook(null);
});

describe("out of cards, chart in the seller's product details", () => {
  it("names the cards instead of blaming the photo", async () => {
    renderBody(chartless());

    expect(await screen.findByText("Daily limit")).toBeInTheDocument();
    const body = document.querySelector(".cz-sizing-nochart-body");
    expect(body.textContent).toContain("product details");
    expect(body.textContent).toContain("costs one card");
    expect(body.textContent).toContain("cards");
    // The two sentences that used to appear instead.
    expect(screen.queryByText("No chart for this one yet.")).toBe(null);
    expect(body.textContent).not.toContain("chart reads");
  });

  it("opens the plans sheet from the card", async () => {
    renderBody(chartless());

    await screen.findByText("Daily limit");
    // Only a signed-in free customer can hit the cards wall, so the answer is
    // always the plans sheet — never "Sign in".
    const cta = screen.getByRole("button", { name: "See plans" });
    fireEvent.click(cta);
    expect(limitsOpenMock).toHaveBeenCalled();
  });

  it("hides the album read, because that read can only fail", async () => {
    renderBody(chartless());

    await screen.findByText("Daily limit");
    expect(document.querySelector(".cz-sizing-albumrow")).toBe(null);
    expect(screen.queryByText(/Read the \d+ album photos?/)).toBe(null);
  });

  it("leaves the state alone while cards remain", async () => {
    needsCardsMock.mockReturnValue(false);
    renderBody(chartless());

    expect(await screen.findByText("No chart")).toBeInTheDocument();
    expect(screen.getByText("No chart for this one yet.")).toBeInTheDocument();
    // Kyle 2026-08-03: no album read on any card now, cards left or not.
    expect(screen.queryByText(/Read the \d+ album photos?/)).toBe(null);
  });
});
