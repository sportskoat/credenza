// Budget ring + parcel weight bar on the haul board toolbar.
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";

import HaulBoard from "../../components/HaulBoard.jsx";

afterEach(cleanup);

const noop = () => {};

function renderBoard(props = {}) {
  return render(
    <HaulBoard
      record={props.record ?? null}
      pipeline={props.pipeline ?? null}
      totalUsd={props.totalUsd ?? 0}
      items={props.items}
      onUpdate={props.onUpdate ?? noop}
      onArchive={props.onArchive ?? noop}
    />
  );
}

describe("haul board budget ring", () => {
  it("shows the spent percent on the ring for screen readers", () => {
    // budget 200, spent 150 → 75%.
    const { container } = renderBoard({
      record: { budget: 200 },
      totalUsd: 150,
      items: [],
    });
    const ring = container.querySelector(".cz-haul-board-ring");
    expect(ring, "the budget ring never rendered").not.toBeNull();
    expect(ring.getAttribute("role")).toBe("img");
    expect(ring.getAttribute("aria-label")).toMatch(/75%/);
  });
});

describe("haul board parcel weight bar", () => {
  it("draws one segment per item with a positive weight", () => {
    // Parcel needs a real chargeable weight so the Parcel text branch shows.
    const record = {
      parcel: {
        weightGrams: 1200,
        dims: null,
        packaging: "standard",
      },
    };
    // weightGrams on the item is a manual override — itemWeightGrams returns it.
    const items = [
      { id: "a", weightGrams: 400 },
      { id: "b", weightGrams: 300 },
      { id: "c", weightGrams: 500 },
    ];
    const { container } = renderBoard({ record, items });
    const bar = container.querySelector(".cz-haul-board-weight-bar");
    expect(bar, "the weight bar never rendered").not.toBeNull();
    expect(bar.getAttribute("role")).toBe("img");
    expect(bar.getAttribute("aria-label")).toMatch(/3 items/);
    const segs = container.querySelectorAll(".cz-haul-board-weight-seg");
    expect(segs.length).toBe(3);
  });
});

describe("haul board with no budget and no parcel", () => {
  it("renders without the ring or the weight bar", () => {
    const { container } = renderBoard({
      record: {},
      totalUsd: 0,
      items: [{ id: "x", weightGrams: 100 }],
    });
    expect(container.querySelector(".cz-haul-board")).not.toBeNull();
    expect(container.querySelector(".cz-haul-board-ring")).toBeNull();
    expect(container.querySelector(".cz-haul-board-weight-bar")).toBeNull();
  });
});
