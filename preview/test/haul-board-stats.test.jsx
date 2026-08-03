// Budget bar + parcel weight bar on the haul board toolbar.
//
// Design review 2 · change 6.
// Kyle 2026-08-02: "set budget and estimate parcel buttons: are they needed?
// is there a better way to display this? should we sunset these?"
//
// The parcel estimator is gone. It asked for a weight, a box size and a
// packaging kind, then answered a question the board already answers from the
// items — and the two answers disagreed. The weight bar stayed and now reads
// the real item weights, so it needs no saved parcel at all.
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";

import HaulBoard from "../../components/HaulBoard.jsx";

afterEach(cleanup);

const noop = () => {};

function renderBoard(props = {}) {
  return render(
    <HaulBoard
      record={props.record ?? null}
      totalUsd={props.totalUsd ?? 0}
      items={props.items}
      onUpdate={props.onUpdate ?? noop}
      onArchive={props.onArchive ?? noop}
    />
  );
}

describe("haul board budget bar", () => {
  it("shows the spent percent on the bar for screen readers", () => {
    // budget 200, spent 150 → 75%.
    const { container } = renderBoard({
      record: { budget: 200 },
      totalUsd: 150,
      items: [],
    });
    const track = container.querySelector(".cz-haul-board-budget-track");
    expect(track, "the budget bar never rendered").not.toBeNull();
    expect(track.getAttribute("role")).toBe("img");
    expect(track.getAttribute("aria-label")).toMatch(/75%/);
  });

  it("prints the numbers without a press", () => {
    // The old control hid its own numbers behind a link. A person had to
    // press it to learn the spend.
    const { container } = renderBoard({
      record: { budget: 200 },
      totalUsd: 150,
      items: [],
    });
    const money = container.querySelector(".cz-haul-board-budget-money");
    expect(money.textContent).toContain("$150");
    expect(money.textContent).toContain("$200");
    expect(
      container.querySelector(".cz-haul-board-budget-pct").textContent
    ).toBe("75%");
  });

  it("fills the bar to the spent share", () => {
    const { container } = renderBoard({
      record: { budget: 200 },
      totalUsd: 150,
      items: [],
    });
    const fill = container.querySelector(".cz-haul-board-budget-fill");
    expect(fill.getAttribute("style")).toContain("75%");
  });

  it("never fills past a full bar when a haul goes over budget", () => {
    // The percent still reads over 100. Only the fill stops.
    const { container } = renderBoard({
      record: { budget: 100 },
      totalUsd: 250,
      items: [],
    });
    expect(
      container.querySelector(".cz-haul-board-budget-pct").textContent
    ).toBe("250%");
    expect(
      container.querySelector(".cz-haul-board-budget-fill").getAttribute("style")
    ).toContain("100%");
  });

  it("turns the bar to the error tone once the haul goes over", () => {
    const { container } = renderBoard({
      record: { budget: 100 },
      totalUsd: 120,
      items: [],
    });
    expect(container.querySelector(".cz-haul-board-budget--over")).not.toBeNull();
  });

  it("offers Set a budget when there is none", () => {
    const { container, getByText } = renderBoard({ record: {}, items: [] });
    expect(container.querySelector(".cz-haul-board-budget")).toBeNull();
    expect(getByText("Set a budget")).not.toBeNull();
  });
});

describe("haul board parcel weight bar", () => {
  it("draws one segment per item with a positive weight", () => {
    // No record.parcel. The bar reads the items themselves.
    const items = [
      { id: "a", weightGrams: 400 },
      { id: "b", weightGrams: 300 },
      { id: "c", weightGrams: 500 },
    ];
    const { container } = renderBoard({ record: {}, items });
    const bar = container.querySelector(".cz-haul-board-weight-bar");
    expect(bar, "the weight bar never rendered").not.toBeNull();
    expect(bar.getAttribute("role")).toBe("img");
    expect(bar.getAttribute("aria-label")).toMatch(/3 items/);
    const segs = container.querySelectorAll(".cz-haul-board-weight-seg");
    expect(segs.length).toBe(3);
  });

  it("names the total and how many items it came from", () => {
    const items = [
      { id: "a", weightGrams: 400 },
      { id: "b", weightGrams: 300 },
      { id: "c", weightGrams: 500 },
    ];
    const { container } = renderBoard({ record: {}, items });
    const text = container.querySelector(".cz-haul-board-weight-text").textContent;
    expect(text).toContain("1.2 kg");
    expect(text).toContain("3 items");
  });

  it("says item, not items, for a single weighed card", () => {
    const { container } = renderBoard({
      record: {},
      items: [{ id: "a", weightGrams: 400 }],
    });
    const text = container.querySelector(".cz-haul-board-weight-text").textContent;
    expect(text).toContain("1 item");
    expect(text).not.toContain("1 items");
  });
});

describe("the parcel estimator is gone", () => {
  it("offers no Estimate the parcel button", () => {
    // Kyle asked whether it was needed. It answered the same question twice,
    // with two different numbers.
    const { queryByText } = renderBoard({
      record: {
        parcel: { weightGrams: 1200, dims: null, packaging: "standard" },
      },
      items: [{ id: "a", weightGrams: 400 }],
    });
    expect(queryByText("Estimate the parcel")).toBeNull();
  });

  it("asks for no box size and no packaging kind", () => {
    const { container, queryByText } = renderBoard({
      record: {},
      items: [{ id: "a", weightGrams: 400 }],
    });
    expect(queryByText("Box size (cm)")).toBeNull();
    expect(queryByText("Packaging")).toBeNull();
    expect(container.querySelector(".cz-haul-board-dims")).toBeNull();
  });

  it("ignores a saved parcel record entirely", () => {
    // Old hauls still hold one. It must not change what a person reads.
    const { container } = renderBoard({
      record: {
        parcel: {
          weightGrams: 9000,
          dims: { l: 40, w: 30, h: 20 },
          packaging: "reinforced",
        },
      },
      items: [{ id: "a", weightGrams: 400 }],
    });
    const shown = container.querySelector(".cz-haul-board-weight-text").textContent;
    expect(shown).toContain("400 g");
    expect(shown).not.toContain("9");
  });
});

describe("haul board with no budget and no weighed items", () => {
  it("renders without the budget bar or the weight bar", () => {
    const { container } = renderBoard({ record: {}, totalUsd: 0, items: [] });
    expect(container.querySelector(".cz-haul-board")).not.toBeNull();
    expect(container.querySelector(".cz-haul-board-budget")).toBeNull();
    expect(container.querySelector(".cz-haul-board-weight-bar")).toBeNull();
  });

  it("still offers Archive", () => {
    const { getByText } = renderBoard({ record: {}, items: [] });
    expect(getByText("Archive")).not.toBeNull();
  });
});
