// DesktopDetailPanel (handoff turn 4 Fix B) regression tests: the two-column
// ≥1024px detail layer — photo pager with counter + ←/→ keys, footer price
// next to Buy, and the ⋯ actions menu. Layout itself is CSS; these guard the
// behavior contract.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import DesktopDetailPanel from "../../components/DesktopDetailPanel.jsx";

function panelItem(extra = {}) {
  return {
    id: "dp-1",
    createdAt: 1753400000000,
    url: "https://weidian.com/item.html?itemID=111",
    title: "M32126-109E Shirt",
    image: "https://si.geilicdn.com/img-1.jpg",
    gallery: ["https://si.geilicdn.com/img-2.jpg", "https://si.geilicdn.com/img-3.jpg"],
    links: [{ url: "https://weidian.com/item.html?itemID=222", role: "buy" }],
    price: 229,
    currency: "CNY",
    seller: "replux",
    category: "shirt",
    findStatus: "want",
    ...extra,
  };
}

function renderPanel(item, extra = {}) {
  return render(
    <DesktopDetailPanel
      item={item}
      bodyProfile={null}
      buyLabel="Buy via Superbuy"
      onSaveEdit={vi.fn()}
      onOpen={vi.fn()}
      onAttachPhoto={vi.fn()}
      onRemovePhoto={vi.fn()}
      onOpenSizes={vi.fn()}
      onToggleFavorite={vi.fn()}
      onDelete={vi.fn()}
      onClose={vi.fn()}
      {...extra}
    />
  );
}

afterEach(cleanup);

describe("DesktopDetailPanel (Fix B)", () => {
  it("shows the photo counter and pages with the arrow keys", async () => {
    renderPanel(panelItem());
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(await screen.findByText("2 / 3")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(await screen.findByText("1 / 3")).toBeInTheDocument();
  });

  it("disables the pager arrows at the ends instead of wrapping", () => {
    renderPanel(panelItem());
    expect(screen.getByRole("button", { name: "Previous photo" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next photo" })).toBeEnabled();
  });

  it("puts the price in the pinned footer next to Buy", () => {
    renderPanel(panelItem());
    const foot = document.querySelector(".cz-detail-foot.has-price");
    expect(foot).toBeTruthy();
    expect(foot.querySelector(".cz-detail-foot-price").textContent).toContain("229");
    expect(screen.getByRole("button", { name: "Buy via Superbuy" })).toBeInTheDocument();
  });

  it("keeps the full-width Buy footer when no footer price is passed", () => {
    render(
      <DesktopDetailPanel
        item={panelItem({ price: null, priceUsd: null })}
        buyLabel="Buy via Superbuy"
        onSaveEdit={vi.fn()}
        onOpen={vi.fn()}
        onAttachPhoto={vi.fn()}
        onRemovePhoto={vi.fn()}
        onOpenSizes={vi.fn()}
        onToggleFavorite={vi.fn()}
        onDelete={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(document.querySelector(".cz-detail-foot.has-price")).toBeNull();
    expect(screen.getByRole("button", { name: "Buy via Superbuy" })).toBeInTheDocument();
  });

  it("the ⋯ menu assigns a haul and removes the card", async () => {
    const onSaveEdit = vi.fn();
    const onDelete = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderPanel(panelItem(), { haulNames: ["Summer Europe"], onSaveEdit, onDelete, onClose });

    await user.click(screen.getByRole("button", { name: "Card actions" }));
    await user.click(screen.getByRole("menuitem", { name: /Summer Europe/ }));
    expect(onSaveEdit).toHaveBeenCalledWith("dp-1", { project: "Summer Europe" });

    await user.click(screen.getByRole("button", { name: "Card actions" }));
    await user.click(screen.getByRole("menuitem", { name: /Remove card/ }));
    expect(onDelete).toHaveBeenCalledWith("dp-1");
    expect(onClose).toHaveBeenCalled();
  });

  it("renders no pager chrome for a single photo", () => {
    renderPanel(panelItem({ gallery: [] }));
    expect(screen.queryByText("1 / 1")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next photo" })).not.toBeInTheDocument();
  });

  it("fills the stage with the marketplace brand tile when the item has no photos", () => {
    renderPanel(panelItem({ image: null, gallery: [] }));
    expect(document.querySelector(".cz-dpanel-slide-empty .cz-cover-tile")).toBeTruthy();
    expect(screen.getByText("Weidian")).toBeInTheDocument();
  });
});
