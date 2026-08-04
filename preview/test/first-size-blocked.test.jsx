// Lane D (2026-08-04) — the honest-copy ladder.
//
// FirstSizeBlock renders for every brand-new / signed-out visitor (no saved
// measurements, no usual size) and REPLACES the whole sizing block, so the
// failure-state reasons below it (needsSignIn, chart cap, cards cap, reader
// outage) never rendered for exactly the population that hits the 5-card
// wall. The visitor out of free cards read "No seller chart on this listing"
// — blaming the seller for our cap. The reason line now rides above the
// chips.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const { huntMock } = vi.hoisted(() => ({ huntMock: vi.fn() }));

vi.mock("../../components/size-chart-hunt.js", async () => {
  const actual = await vi.importActual("../../components/size-chart-hunt.js");
  return { ...actual, huntSizeChart: huntMock };
});

const { default: DetailBody } = await import("../../components/DetailBody.jsx");
const { FIRST_SIZE_COPY } = await import("../../components/FirstSizeBlock.jsx");

const SIGN_IN_COPY =
  "Sign in to finish this card. Credenza then reads the product, the photos, and the size chart.";

function chartlessItem(extra = {}) {
  return {
    id: "lane-d-" + Math.random().toString(36).slice(2),
    createdAt: 1753400000000,
    url: "https://weidian.com/item.html?itemID=7796666481",
    title: "OOW short sleeve tee",
    image: "https://si.geilicdn.com/img-1.jpg",
    gallery: [],
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
      // A brand-new visitor: no saved measurements, no usual size.
      bodyProfile={{}}
      buyLabel="Buy via Superbuy"
      onOpen={vi.fn()}
      onAttachPhoto={vi.fn()}
      onRemovePhoto={vi.fn()}
      onOpenSizes={vi.fn()}
      onSaveEdit={vi.fn()}
      onSaveBodyProfile={vi.fn()}
      {...extra}
    />
  );
}

beforeEach(() => {
  huntMock.mockResolvedValue(null);
});

afterEach(() => {
  cleanup();
  huntMock.mockReset();
});

describe("FirstSizeBlock under a wall", () => {
  it("shows the sign-in reason, not the seller-blaming line, on a refused card", async () => {
    renderBody(chartlessItem({ needsSignIn: true }));
    expect(await screen.findByText(SIGN_IN_COPY)).toBeInTheDocument();
    expect(screen.queryByText(FIRST_SIZE_COPY.ask1BodyNoChart)).toBeNull();
    // The chips stay the primary action.
    expect(screen.getByRole("radiogroup", { name: /Usual size/i })).toBeInTheDocument();
  });

  it("keeps the no-chart sentence when nothing is blocked", async () => {
    renderBody(chartlessItem());
    expect(await screen.findByText(FIRST_SIZE_COPY.ask1BodyNoChart)).toBeInTheDocument();
    expect(screen.queryByText(SIGN_IN_COPY)).toBeNull();
  });
});
