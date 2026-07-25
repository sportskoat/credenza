// Mobile detail sheet (sheets/DetailSheet.jsx) regression tests.
// 2026-07-25 live defect: the sheet mapped EVERY role-buy link to a filled
// button, so a card with two buy links showed "Buy via Superbuy" and
// "Buy via Superbuy 2" side by side. The handoff sets ONE primary action —
// the first buy link. Desktop surfaces already do this with .find().
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import DetailSheet from "../../sheets/DetailSheet.jsx";

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

function renderSheet(item) {
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
