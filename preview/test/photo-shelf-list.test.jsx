import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import PhotoShelfList from "../../components/PhotoShelfList.jsx";

afterEach(cleanup);

function item(overrides = {}) {
  return {
    id: "item-1",
    title: "Palace x Nike jersey",
    seller: "Mook-official",
    image: "data:image/png;base64,iVBORw0KGgo=",
    price: 229,
    currency: "CNY",
    favorite: false,
    ...overrides,
  };
}

describe("PhotoShelfList", () => {
  it("renders one stable photo card for each item", () => {
    render(
      <PhotoShelfList
        items={[item(), item({ id: "item-2", title: "Second jacket" })]}
        selectedId="item-2"
        onOpenDetail={vi.fn()}
        onToggleFavorite={vi.fn()}
      />,
    );

    const list = screen.getByRole("list");
    const cards = within(list).getAllByRole("listitem");

    expect(cards).toHaveLength(2);
    expect(cards[1]).toHaveAttribute("aria-current", "true");
    expect(within(cards[0]).getByText("Mook-official")).toBeInTheDocument();
    expect(within(cards[0]).getByText("Palace x Nike jersey")).toBeInTheDocument();
  });

  // The card face carries the listing code and the photo count, and both open
  // the album. A card with no album shows neither, rather than a dead link.
  it("shows the listing code and the photo count as album links", () => {
    render(
      <PhotoShelfList
        items={[
          item({
            url: "https://x.yupoo.com/albums/98765432",
            albumId: "M29855-51E",
            albumPhotoCount: 3,
          }),
        ]}
        selectedId={null}
        onOpenDetail={vi.fn()}
        onToggleFavorite={vi.fn()}
      />,
    );

    expect(screen.getByRole("link", { name: "M29855-51E" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View all 3 photos" })).toBeInTheDocument();
  });

  it("marks a card Bought only after the item is ordered", () => {
    const { rerender } = render(
      <PhotoShelfList
        items={[item()]}
        selectedId={null}
        onOpenDetail={vi.fn()}
        onToggleFavorite={vi.fn()}
      />,
    );
    expect(screen.queryByText("Bought")).not.toBeInTheDocument();
    expect(document.querySelector(".cz-card-status-tag")).toBeNull();

    rerender(
      <PhotoShelfList
        items={[item({ findStatus: "bought" })]}
        selectedId={null}
        onOpenDetail={vi.fn()}
        onToggleFavorite={vi.fn()}
      />,
    );
    // Round 4 point 6: the shared StatusTag — the same mark the carousel card
    // draws, positioned by the is-grid modifier.
    const tag = document.querySelector(".cz-card-status-tag");
    expect(tag).not.toBeNull();
    expect(tag.className).toContain("is-grid");
    expect(screen.getByText("Bought")).toBeInTheDocument();
  });

  it("keeps detail and Favorite actions separate", () => {
    const onOpenDetail = vi.fn();
    const onToggleFavorite = vi.fn();
    render(
      <PhotoShelfList
        items={[item()]}
        selectedId={null}
        onOpenDetail={onOpenDetail}
        onToggleFavorite={onToggleFavorite}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open Palace x Nike jersey" }));
    expect(onOpenDetail).toHaveBeenCalledTimes(1);
    expect(onOpenDetail.mock.calls[0][0]).toMatchObject({ id: "item-1" });
    expect(onOpenDetail.mock.calls[0][1].photo).toBeInstanceOf(HTMLElement);
    expect(onOpenDetail.mock.calls[0][1].text).toBeInstanceOf(HTMLElement);

    fireEvent.click(screen.getByRole("button", { name: "Star Palace x Nike jersey" }));
    expect(onToggleFavorite).toHaveBeenCalledWith("item-1");
    expect(onOpenDetail).toHaveBeenCalledTimes(1);
  });
});
