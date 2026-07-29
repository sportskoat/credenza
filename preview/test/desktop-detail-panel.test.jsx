// DesktopDetailPanel (handoff turn 4 Fix B) regression tests: the two-column
// ≥1024px detail layer — photo pager with counter + chevrons, arrow keys
// stepping between cards (Kyle 2026-07-28), footer price next to Buy, and
// the ⋯ actions menu. Layout itself is CSS; these guard the behavior
// contract.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import DesktopDetailPanel from "../../components/DesktopDetailPanel.jsx";

// The command bar (item-detail handoff 2026-07-29) folded the always-open
// Colorway and Weight fields into chips. A test that wants the field has to
// open its chip first — which is the point of the redesign.
function openBarChip(key) {
  fireEvent.click(document.querySelector('[data-chip="' + key + '"]'));
}

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

afterEach(() => {
  cleanup();
  document.body.style.overflow = "";
});

describe("DesktopDetailPanel (Fix B)", () => {
  it("uses a native dialog, locks scroll, focuses Close, and restores the opener", async () => {
    document.body.style.overflow = "scroll";
    const opener = document.createElement("button");
    document.body.appendChild(opener);
    opener.focus();

    let unmountPanel = () => {};
    const onClose = vi.fn(() => unmountPanel());
    const rendered = renderPanel(panelItem(), { onClose });
    unmountPanel = rendered.unmount;
    const dialog = rendered.container.querySelector("dialog.cz-dpanel-scrim");

    expect(dialog).toHaveAttribute("open");
    expect(document.body.style.overflow).toBe("hidden");
    const closeButton = screen.getByRole("button", { name: "Close" });
    await waitFor(() => expect(closeButton).toHaveFocus());

    fireEvent.click(closeButton);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(dialog).not.toHaveAttribute("open");
    expect(document.body.style.overflow).toBe("scroll");
    expect(opener).toHaveFocus();
    opener.remove();
  });

  it.each(["Close", "backdrop", "Escape", "Remove"])(
    "flushes a pending DetailBody edit before %s",
    (path) => {
      const onSaveEdit = vi.fn();
      const onDelete = vi.fn();
      const onClose = vi.fn();
      const { container } = renderPanel(panelItem(), { onSaveEdit, onDelete, onClose });

      openBarChip("weight");
      fireEvent.change(screen.getByRole("textbox", { name: "Weight · g" }), {
        target: { value: "1200" },
      });

      if (path === "Close") {
        fireEvent.click(screen.getByRole("button", { name: "Close" }));
      } else if (path === "backdrop") {
        fireEvent.click(container.querySelector("dialog.cz-dpanel-scrim"));
      } else if (path === "Escape") {
        fireEvent(
          container.querySelector("dialog.cz-dpanel-scrim"),
          new Event("cancel", { bubbles: false, cancelable: true })
        );
      } else {
        fireEvent.click(screen.getByRole("button", { name: "Card actions" }));
        fireEvent.click(screen.getByRole("menuitem", { name: "Remove card" }));
      }

      expect(onSaveEdit).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onSaveEdit.mock.invocationCallOrder[0]).toBeLessThan(
        onClose.mock.invocationCallOrder[0]
      );
      if (path === "Remove") {
        expect(onDelete).toHaveBeenCalledWith("dp-1");
        expect(onSaveEdit.mock.invocationCallOrder[0]).toBeLessThan(
          onDelete.mock.invocationCallOrder[0]
        );
      } else {
        expect(onDelete).not.toHaveBeenCalled();
      }
    }
  );

  it("does not close the panel while a nested dialog is open", () => {
    const onClose = vi.fn();
    const { container } = renderPanel(panelItem(), { onClose });
    const panelDialog = container.querySelector("dialog.cz-dpanel-scrim");
    const nestedDialog = document.createElement("dialog");
    nestedDialog.setAttribute("open", "");
    panelDialog.appendChild(nestedDialog);

    fireEvent(panelDialog, new Event("cancel", { bubbles: false, cancelable: true }));
    expect(onClose).not.toHaveBeenCalled();

    nestedDialog.remove();
    fireEvent(panelDialog, new Event("cancel", { bubbles: false, cancelable: true }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not render the removed Open size chart action in the photo area", () => {
    const gallery = Array.from(
      { length: 20 },
      (_, index) => `https://si.geilicdn.com/img-${index + 2}.jpg`
    );
    renderPanel(panelItem({ gallery, albumPhotoCount: 40 }));

    expect(screen.getByRole("button", { name: "Show photo 21" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open size chart" })).toBeNull();
  });

  it("shows the photo counter and pages with the pager buttons", async () => {
    // Arrows step CARDS now (Kyle 2026-07-28: "when you click right on your
    // keyboard, it should go to the next card"). Photos page with the
    // chevrons.
    const user = userEvent.setup();
    renderPanel(panelItem());
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next photo" }));
    expect(await screen.findByText("2 / 3")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Previous photo" }));
    expect(await screen.findByText("1 / 3")).toBeInTheDocument();
  });

  it("arrow keys step between cards through onStepItem (Kyle 2026-07-28)", () => {
    const onStepItem = vi.fn();
    renderPanel(panelItem(), { onStepItem });
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(onStepItem).toHaveBeenCalledWith(1);
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(onStepItem).toHaveBeenCalledWith(-1);
    // The photo pager did not move — arrows belong to the cards now.
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
  });

  it("Delete and Backspace stage the delete modal (Kyle 2026-07-28)", () => {
    // "Pressing delete on this screen should give you the modal to delete
    // the card" — staged through onDelete, never fired while typing.
    const onDelete = vi.fn();
    renderPanel(panelItem(), { onDelete });
    fireEvent.keyDown(window, { key: "Delete" });
    expect(onDelete).toHaveBeenCalledWith("dp-1");
    fireEvent.keyDown(window, { key: "Backspace" });
    expect(onDelete).toHaveBeenCalledTimes(2);

    openBarChip("color");
    const colorway = screen.getByRole("textbox", { name: "Colorway" });
    colorway.focus();
    fireEvent.keyDown(colorway, { key: "Backspace" });
    expect(onDelete).toHaveBeenCalledTimes(2);
  });

  it("leaves arrow keys with a focused detail field", () => {
    // Arrow keys inside an editing field must not page the photos.
    renderPanel(panelItem());
    openBarChip("color");
    const colorway = screen.getByRole("textbox", { name: "Colorway" });
    colorway.focus();

    fireEvent.keyDown(colorway, { key: "ArrowRight" });

    expect(colorway).toHaveFocus();
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
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
    // USD primary: CNY 229 → $32.06 only — no ¥ dual line (Kyle 2026-07-26).
    const priceText = foot.querySelector(".cz-detail-foot-price").textContent;
    expect(priceText).toContain("$32.06");
    expect(priceText).not.toMatch(/¥|CNY/);
    expect(screen.getByRole("button", { name: "Buy via Superbuy" })).toBeInTheDocument();
  });

  it("filmstrip has add/delete and no right-column photos block", async () => {
    const onAttachPhoto = vi.fn();
    const onRemovePhoto = vi.fn();
    const user = userEvent.setup();
    renderPanel(panelItem(), { onAttachPhoto, onRemovePhoto });

    // The right column still carries no second PHOTOS block — the left
    // filmstrip is the one place that adds and deletes. Album + seller meta
    // sit under the strip (replacing the old AlbumLinksRow tiles).
    expect(document.querySelector(".cz-detail-photos")).toBeNull();
    expect(document.querySelector(".cz-dpanel-left .cz-dpanel-meta")).not.toBeNull();
    expect(document.querySelector(".cz-dpanel-left .cz-album-links")).toBeNull();
    expect(screen.getByRole("button", { name: "Add photo" })).toBeInTheDocument();
    // Cover (first photo) has no trash; gallery photo 2 does.
    expect(screen.queryByRole("button", { name: "Delete photo 1" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Delete photo 2" }));
    expect(onRemovePhoto).toHaveBeenCalledWith("dp-1", "https://si.geilicdn.com/img-2.jpg");
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

  it.each(["shared", "downloaded", "cancelled", "failed"])(
    "lists Share card before Remove card and keeps detail open after %s",
    async (outcome) => {
      const onSaveEdit = vi.fn();
      const onShareCard = vi.fn().mockResolvedValue(outcome);
      const onClose = vi.fn();
      const user = userEvent.setup();
      renderPanel(panelItem(), { onSaveEdit, onShareCard, onClose });

      openBarChip("color");
      fireEvent.change(screen.getByRole("textbox", { name: "Colorway" }), {
        target: { value: "Bone white" },
      });
      await user.click(screen.getByRole("button", { name: "Card actions" }));

      const menu = screen.getByRole("menu", { name: "Card actions" });
      const actions = [...menu.querySelectorAll('[role="menuitem"]')];
      // Kyle 2026-07-29: the "Change category" row is gone — the command bar
      // owns the Category chip. "Delete this photo" joins only when the pager
      // sits on a non-cover photo (point 5) — here it is on the cover, so it
      // hides.
      expect(actions.map((action) => action.textContent.trim())).toEqual([
        "Share card",
        "Remove card",
      ]);

      await user.click(actions[0]);
      await expect(onShareCard.mock.results[0].value).resolves.toBe(outcome);
      expect(onSaveEdit).toHaveBeenCalledWith(
        "dp-1",
        expect.objectContaining({ colorway: "Bone white" })
      );
      expect(onShareCard).toHaveBeenCalledWith(
        expect.objectContaining({ id: "dp-1", colorway: "Bone white" })
      );
      expect(onSaveEdit.mock.invocationCallOrder[0]).toBeLessThan(
        onShareCard.mock.invocationCallOrder[0]
      );
      expect(screen.queryByRole("menu", { name: "Card actions" })).toBeNull();
      expect(screen.getByRole("dialog", { name: "M32126-109E Shirt" })).toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();
    }
  );

  it("keeps haul off the More menu and removes the card", async () => {
    const onSaveEdit = vi.fn();
    const onDelete = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderPanel(panelItem(), { haulNames: ["Summer Europe"], onSaveEdit, onDelete, onClose });

    await user.click(screen.getByRole("button", { name: "Card actions" }));
    // The menu must not duplicate haul assignment: two writers for the same
    // field is how hauls got clobbered. The chip row owns it now.
    expect(screen.queryByRole("menuitem", { name: /Summer Europe/ })).toBeNull();

    await user.click(screen.getByRole("menuitem", { name: "Remove card" }));
    expect(onDelete).toHaveBeenCalledWith("dp-1");
    expect(onClose).toHaveBeenCalled();
    expect(onSaveEdit).not.toHaveBeenCalled();
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
