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
    expect(within(cards[0]).getByText("View ›")).toBeInTheDocument();
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
