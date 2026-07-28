// Mobile detail sheet (sheets/DetailSheet.jsx) regression tests.
// 2026-07-25 live defect: the sheet mapped EVERY role-buy link to a filled
// button, so a card with two buy links showed "Buy via Superbuy" and
// "Buy via Superbuy 2" side by side. The handoff sets ONE primary action —
// the first buy link. Desktop surfaces already do this with .find().
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DetailSheet from "../../sheets/DetailSheet.jsx";
import {
  lockBodyScroll,
  unlockBodyScroll,
} from "../../components/useBodyScrollLock.js";

const PHOTO = "data:image/png;base64,iVBORw0KGgo=";

function twoBuyLinkItem() {
  return {
    id: "sheet-1",
    createdAt: 1753400000000,
    url: "https://weidian.com/item.html?itemID=111",
    title: "Test hoodie",
    image: PHOTO,
    gallery: [],
    links: [{ url: "https://weidian.com/item.html?itemID=222", role: "buy" }],
    price: 229,
    currency: "CNY",
    seller: "Test seller",
    findStatus: "want",
  };
}

function renderSheet(item, extra = {}) {
  return render(
    <DetailSheet
      item={item}
      buyLabel="Buy via Superbuy"
      onSaveEdit={vi.fn()}
      onRemove={vi.fn()}
      onOpen={vi.fn()}
      onAttachPhoto={vi.fn()}
      onRemovePhoto={vi.fn()}
      onOpenSizes={vi.fn()}
      onClose={vi.fn()}
      {...extra}
    />
  );
}

afterEach(cleanup);

describe("DetailSheet buy action", () => {
  it("renders exactly one Buy button when the item has two buy links", () => {
    const { container } = renderSheet(twoBuyLinkItem());
    const buys = container.querySelectorAll(".cz-detail-buy");
    expect(buys).toHaveLength(1);
    expect(buys[0].textContent).toBe("Buy via Superbuy");
  });

  it("never shows the duplicate-label twin (\"Buy via Superbuy 2\")", () => {
    const { container } = renderSheet(twoBuyLinkItem());
    expect(container.textContent).not.toContain("Buy via Superbuy 2");
  });

  it("opens the first buy link on tap", () => {
    const onOpen = vi.fn();
    const { container } = render(
      <DetailSheet
        item={twoBuyLinkItem()}
        buyLabel="Buy via Superbuy"
        onSaveEdit={vi.fn()}
        onRemove={vi.fn()}
        onOpen={onOpen}
        onAttachPhoto={vi.fn()}
        onRemovePhoto={vi.fn()}
        onOpenSizes={vi.fn()}
        onClose={vi.fn()}
      />
    );
    container.querySelector(".cz-detail-buy").click();
    expect(onOpen).toHaveBeenCalledWith(
      expect.objectContaining({ id: "sheet-1" }),
      "https://weidian.com/item.html?itemID=111"
    );
  });

  it("renders no Buy button when the item has no buy link", () => {
    const item = {
      ...twoBuyLinkItem(),
      url: "https://x.yupoo.com/photos/seller/albums/1",
      links: [],
    };
    const { container } = renderSheet(item);
    expect(container.querySelectorAll(".cz-detail-buy")).toHaveLength(0);
  });
});

// 2026-07-25 (Kyle): "weight should have a g/kg toggle dropdown next to
// Done." The stored value stays grams; the toggle only changes the display.
describe("DetailSheet weight editor units", () => {
  it("the weight editor offers a g/kg toggle and converts kg to grams", () => {
    const onSaveEdit = vi.fn();
    render(
      <DetailSheet
        item={{ ...twoBuyLinkItem(), weightGrams: 1200 }}
        onSaveEdit={onSaveEdit}
        onRemove={vi.fn()}
        onOpen={vi.fn()}
        onAttachPhoto={vi.fn()}
        onRemovePhoto={vi.fn()}
        onSetCover={vi.fn()}
        onOpenSizes={vi.fn()}
        onClose={vi.fn()}
      />
    );
    const input = screen.getByRole("textbox", { name: "Weight · g" });
    expect(input).toHaveValue("1200");

    fireEvent.click(screen.getByRole("button", { name: "kg" }));
    expect(input).toHaveValue("1.2");

    fireEvent.change(input, { target: { value: "1.5" } });
    // The draft write-through is debounced, but the draft itself converts at
    // once: flip back to g and the grams value is already there.
    fireEvent.click(screen.getByRole("button", { name: "g" }));
    expect(input).toHaveValue("1500");
  });
});


// The overflow button opens a menu now; the delete lives inside it, and the
// menu carries the cover-photo action the mobile sheet lost in the redesign.
describe("DetailSheet overflow menu", () => {
  const PHOTO_B = "data:image/png;base64,iVBORw0KGgoA=";

  function multiPhotoItem() {
    return { ...twoBuyLinkItem(), gallery: [PHOTO_B] };
  }

  it("the overflow button opens a menu instead of removing the card", () => {
    const onRemove = vi.fn();
    const { container } = render(
      <DetailSheet
        item={twoBuyLinkItem()}
        onSaveEdit={vi.fn()}
        onRemove={onRemove}
        onOpen={vi.fn()}
        onAttachPhoto={vi.fn()}
        onRemovePhoto={vi.fn()}
        onSetCover={vi.fn()}
        onOpenSizes={vi.fn()}
        onClose={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    expect(onRemove).not.toHaveBeenCalled();
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it.each(["shared", "downloaded", "cancelled", "failed"])(
    "lists Share card before Remove from shelf and keeps detail open after %s",
    async (outcome) => {
      const onSaveEdit = vi.fn();
      const onShareCard = vi.fn().mockResolvedValue(outcome);
      const onClose = vi.fn();
      const user = userEvent.setup();
      renderSheet(twoBuyLinkItem(), { onSaveEdit, onShareCard, onClose });

      fireEvent.change(screen.getByRole("textbox", { name: "Colorway" }), {
        target: { value: "Bone white" },
      });
      await user.click(screen.getByRole("button", { name: "More actions" }));

      const menu = screen.getByRole("menu");
      const actions = [...menu.querySelectorAll('[role="menuitem"]')];
      expect(actions.map((action) => action.textContent.trim())).toEqual([
        "Share card",
        "Remove from shelf",
      ]);

      await user.click(actions[0]);
      await expect(onShareCard.mock.results[0].value).resolves.toBe(outcome);
      expect(onSaveEdit).toHaveBeenCalledWith(
        "sheet-1",
        expect.objectContaining({ colorway: "Bone white" })
      );
      expect(onShareCard).toHaveBeenCalledWith(
        expect.objectContaining({ id: "sheet-1", colorway: "Bone white" })
      );
      expect(onSaveEdit.mock.invocationCallOrder[0]).toBeLessThan(
        onShareCard.mock.invocationCallOrder[0]
      );
      expect(screen.queryByRole("menu")).toBeNull();
      expect(screen.getByRole("dialog", { name: "Test hoodie" })).toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();
    }
  );

  it("Remove from shelf inside the menu removes and closes", () => {
    const onRemove = vi.fn();
    const onClose = vi.fn();
    render(
      <DetailSheet
        item={twoBuyLinkItem()}
        onSaveEdit={vi.fn()}
        onRemove={onRemove}
        onOpen={vi.fn()}
        onAttachPhoto={vi.fn()}
        onRemovePhoto={vi.fn()}
        onSetCover={vi.fn()}
        onOpenSizes={vi.fn()}
        onClose={onClose}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Remove from shelf" }));
    expect(onRemove).toHaveBeenCalledWith("sheet-1");
    expect(onClose).toHaveBeenCalled();
  });

  it("swiping to a second photo offers Make this photo the cover", () => {
    const onSetCover = vi.fn();
    const { container } = render(
      <DetailSheet
        item={multiPhotoItem()}
        onSaveEdit={vi.fn()}
        onRemove={vi.fn()}
        onOpen={vi.fn()}
        onAttachPhoto={vi.fn()}
        onRemovePhoto={vi.fn()}
        onSetCover={onSetCover}
        onOpenSizes={vi.fn()}
        onClose={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    // Cover is showing: no cover action yet.
    expect(screen.queryByRole("menuitem", { name: "Make this photo the cover" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "More actions" }));

    // Swipe the pager to photo 2 (jsdom clientWidth is 0, so 1px = one page).
    const track = container.querySelector(".cz-detail-hero-track");
    track.scrollLeft = 1;
    fireEvent.scroll(track);

    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Make this photo the cover" }));
    expect(onSetCover).toHaveBeenCalledWith("sheet-1", PHOTO_B);
  });
});

// 2026-07-27: the sheet shares the reference-counted body scroll lock
// (components/useBodyScrollLock.js). Closing the sheet must not restore the
// body while another lock (a modal under or over it) is still held.
describe("DetailSheet body scroll lock", () => {
  afterEach(() => {
    document.body.style.overflow = "";
  });

  it("locks the body while open and restores the original value on close", () => {
    document.body.style.overflow = "scroll";
    const { unmount } = renderSheet(twoBuyLinkItem());
    expect(document.body.style.overflow).toBe("hidden");
    unmount();
    expect(document.body.style.overflow).toBe("scroll");
  });

  it("does not restore the body while a nested lock remains", () => {
    document.body.style.overflow = "scroll";
    lockBodyScroll(); // an outer modal opened first
    const { unmount } = renderSheet(twoBuyLinkItem());
    expect(document.body.style.overflow).toBe("hidden");

    unmount();
    expect(document.body.style.overflow).toBe("hidden");

    unlockBodyScroll();
    expect(document.body.style.overflow).toBe("scroll");
  });
});
