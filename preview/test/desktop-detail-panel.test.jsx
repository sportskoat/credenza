// DesktopDetailPanel (handoff turn 4 Fix B) regression tests: the two-column
// ≥1024px detail layer — photo pager with counter + chevrons, arrow keys
// stepping between cards (Kyle 2026-07-28), footer price next to Buy, and
// the ⋯ actions menu. Layout itself is CSS; these guard the behavior
// contract.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor, within } from "@testing-library/react";
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
        fireEvent.click(screen.getByRole("button", { name: "More actions" }));
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

  // Kyle 2026-07-29: "after hitting upload photo and cancelling out of this,
  // detail view gets exited out". A dismissed OS file picker fires a BUBBLING
  // "cancel" on <input type="file">, which reached the dialog's onCancel.
  it("stays open when a nested file picker is cancelled", () => {
    const onClose = vi.fn();
    const { container } = renderPanel(panelItem(), { onClose });
    const fileInput = container.querySelector('input[type="file"]');
    expect(fileInput).toBeTruthy();

    fireEvent(fileInput, new Event("cancel", { bubbles: true, cancelable: true }));
    expect(onClose).not.toHaveBeenCalled();

    // Escape on the dialog itself still closes it.
    fireEvent(
      container.querySelector("dialog.cz-dpanel-scrim"),
      new Event("cancel", { bubbles: false, cancelable: true })
    );
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

  it("filmstrip has no per-tile trash; delete lives in the card actions menu", async () => {
    const onAttachPhoto = vi.fn();
    const onRemovePhoto = vi.fn();
    const user = userEvent.setup();
    renderPanel(panelItem(), { onAttachPhoto, onRemovePhoto });

    // The right column still carries no second PHOTOS block — the left
    // filmstrip is the one place that adds. Album + seller meta sit under
    // the strip (replacing the old AlbumLinksRow tiles).
    expect(document.querySelector(".cz-detail-photos")).toBeNull();
    expect(document.querySelector(".cz-dpanel-left .cz-dpanel-meta")).not.toBeNull();
    expect(document.querySelector(".cz-dpanel-left .cz-album-links")).toBeNull();
    expect(screen.getByRole("button", { name: "Add photo" })).toBeInTheDocument();
    // Kyle 2026-07-29: the thin per-tile trash went away — an accident
    // magnet. A tap on a thumb pages the stage, and delete lives in the
    // "..." menu (and in the full-screen photo view).
    expect(screen.queryByRole("button", { name: /^Delete photo/ })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Show photo 2" }));
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "More actions" }));
    const menu = screen.getByRole("menu", { name: "More actions" });
    await user.click(within(menu).getByRole("menuitem", { name: "Delete this photo" }));
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
      await user.click(screen.getByRole("button", { name: "More actions" }));

      const menu = screen.getByRole("menu", { name: "More actions" });
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
      expect(screen.queryByRole("menu", { name: "More actions" })).toBeNull();
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

    await user.click(screen.getByRole("button", { name: "More actions" }));
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

  // Fit fold (2026-08-02): Chart tab is gone. Seller chart folds under Fit.
  it("folds the seller chart under Fit, opens it, and picks a size", async () => {
    window.__setMediaMatches("(min-width: 1024px)", true);
    const onSaveEdit = vi.fn();
    const user = userEvent.setup();
    const chartText =
      "M: chest 116, shoulder 46, length 70, sleeve 60\nL: chest 120, shoulder 48, length 72, sleeve 62\nXL: chest 124, shoulder 50, length 74, sleeve 64";
    renderPanel(
      panelItem({
        sizeNotes: chartText,
        sizeChartSource: { via: "album-text", at: "2026-07-25T10:00:00.000Z" },
        category: "shirt",
      }),
      {
        onSaveEdit,
        bodyProfile: { chest: 105, shoulder: 45, sleeve: 62 },
      }
    );

    expect(screen.queryByRole("tab", { name: "Chart" })).toBeNull();
    expect(screen.getByRole("tab", { name: "Fit" })).toBeInTheDocument();

    const foldToggle = await screen.findByRole("button", {
      name: /THE SELLER'S CHART/i,
    });
    expect(foldToggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("table", { name: /Size chart with ease/i })).toBeNull();

    await user.click(foldToggle);
    expect(foldToggle).toHaveAttribute("aria-expanded", "true");
    expect(await screen.findByText("PULLED FROM THE LISTING")).toBeInTheDocument();
    expect(screen.getByRole("table", { name: /Size chart with ease/i })).toBeInTheDocument();
    expect(screen.getByText("Yours")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Replace" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enter by hand" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Forget" })).toBeInTheDocument();

    const sizeName = [...document.querySelectorAll(".cz-chart-size-name")].find(
      (n) => /^L(arge)?$/i.test(n.textContent.trim()) || n.textContent.trim() === "L"
    );
    expect(sizeName).toBeTruthy();
    await user.click(sizeName.closest("button.cz-chart-row"));
    expect(onSaveEdit).toHaveBeenCalled();
    const patch = onSaveEdit.mock.calls.find((c) => c[1] && c[1].size);
    expect(patch).toBeTruthy();

    // One analysis paragraph under the size result — not three stanzas.
    expect(document.querySelector(".cz-fit-analysis")).toBeTruthy();
    expect(document.querySelector(".cz-fit-summary")).toBeNull();
    expect(document.querySelectorAll(".cz-fit-stanza").length).toBe(0);

    window.__setMediaMatches("(min-width: 1024px)", false);
  });

  it("keeps Fit bars and moves them when a size is picked from the folded chart", async () => {
    window.__setMediaMatches("(min-width: 1024px)", true);
    const user = userEvent.setup();
    const chartText =
      "M: chest 116, shoulder 46, length 70, sleeve 60\nL: chest 120, shoulder 48, length 72, sleeve 62\nXL: chest 124, shoulder 50, length 74, sleeve 64";
    renderPanel(
      panelItem({
        sizeNotes: chartText,
        sizeChartSource: { via: "album-text", at: "2026-07-25T10:00:00.000Z" },
        category: "shirt",
      }),
      {
        bodyProfile: { chest: 105, shoulder: 45, sleeve: 62 },
      }
    );

    // Open measurement bars on Fit.
    const readToggle = await screen.findByRole("button", {
      name: /Measurement by measurement/i,
    });
    await user.click(readToggle);
    const bars = await waitFor(() => {
      const el = document.querySelector(".cz-fitread");
      expect(el).toBeTruthy();
      return el;
    });
    expect(bars.querySelectorAll(".cz-fitread-mark").length).toBeGreaterThan(0);
    const marksBefore = [...bars.querySelectorAll(".cz-fitread-mark")].map(
      (n) => n.style.left
    );

    // Open seller chart and pick another size.
    await user.click(
      screen.getByRole("button", { name: /THE SELLER'S CHART/i })
    );
    const sizeRows = [...document.querySelectorAll("button.cz-chart-row.is-size")];
    expect(sizeRows.length).toBeGreaterThan(1);
    const pickRow =
      sizeRows.find(
        (row) => !row.classList.contains("is-rec") && !row.classList.contains("is-pick")
      ) || sizeRows[sizeRows.length - 1];
    await user.click(pickRow);

    const marksAfter = [
      ...document.querySelectorAll(".cz-fitread .cz-fitread-mark"),
    ].map((n) => n.style.left);
    expect(marksAfter.length).toBe(marksBefore.length);
    expect(marksAfter.some((left, i) => left !== marksBefore[i])).toBe(true);

    window.__setMediaMatches("(min-width: 1024px)", false);
  });

  it("hides the seller chart fold when there is no chart", async () => {
    window.__setMediaMatches("(min-width: 1024px)", true);
    renderPanel(
      panelItem({
        sizeNotes: "",
        sizeChartSource: null,
        sizeChartText: "",
        category: "shirt",
        gallery: ["https://si.geilicdn.com/img-2.jpg"],
      }),
      {
        bodyProfile: { chest: 105 },
      }
    );
    expect(screen.queryByRole("tab", { name: "Chart" })).toBeNull();
    expect(screen.queryByRole("button", { name: /THE SELLER'S CHART/i })).toBeNull();
    window.__setMediaMatches("(min-width: 1024px)", false);
  });

  // Phase 1 desktop Fit bugs (2026-08-02): expanded measurement table must
  // expose the same Edit / Forget links the phone FitReadTable already has.
  it("shows Edit my measurements and Forget this chart when measurement rows expand", async () => {
    window.__setMediaMatches("(min-width: 1024px)", true);
    const onOpenSizes = vi.fn();
    const onSaveEdit = vi.fn();
    const user = userEvent.setup();
    const chartText =
      "M: chest 116, shoulder 46, length 70\nL: chest 120, shoulder 48, length 72\nXL: chest 124, shoulder 50, length 74";
    renderPanel(
      panelItem({
        sizeNotes: chartText,
        sizeChartSource: { via: "album-text", at: "2026-07-25T10:00:00.000Z" },
        category: "shirt",
      }),
      {
        onOpenSizes,
        onSaveEdit,
        bodyProfile: { chest: 105, shoulder: 45 },
      }
    );

    const toggle = await screen.findByRole("button", { name: /Measurement by measurement/i });
    await user.click(toggle);

    const edit = await screen.findByRole("button", { name: "Edit my measurements" });
    await user.click(edit);
    expect(onOpenSizes).toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Forget this chart" }));
    expect(onSaveEdit).toHaveBeenCalledWith(
      "dp-1",
      expect.objectContaining({
        sizeNotes: "",
        sizeChartSource: null,
      })
    );

    // Selected + recommended size card keeps both classes (CSS keeps the
    // name dark on the white fill — see .is-pick.is-rec .cz-sizing-cell-k).
    const recPick = document.querySelector(".cz-sizing-cell.is-pick.is-rec");
    if (recPick) {
      expect(recPick.querySelector(".cz-sizing-cell-k")).toBeTruthy();
    }

    // Fit pane scroller must carry both classes so padding can re-apply.
    const pane = document.querySelector(".cz-detail-scroll.cz-fit-pane");
    expect(pane).not.toBeNull();

    window.__setMediaMatches("(min-width: 1024px)", false);
  });
});
