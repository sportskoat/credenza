// Enrichment worker pool (2026-07-25 live defect): one throwing enhance used
// to kill its worker, so a 20-link import stalled with 3 cards spinning on
// "Enhancing…" forever and the other 17 never enhanced. runPool isolates the
// failure to the one item.
import { describe, expect, it } from "vitest";
import { runPool } from "../../credenza-fashion.jsx";

describe("runPool", () => {
  it("processes every item even when some workers throw", async () => {
    const seen = [];
    const list = Array.from({ length: 20 }, (_, i) => i + 1);
    await runPool(
      list,
      async (n) => {
        seen.push(n);
        if (n <= 3) throw new Error("enhance failed");
      },
      3
    );
    expect(seen.sort((a, b) => a - b)).toEqual(list);
  });

  it("keeps draining after a mid-queue throw", async () => {
    const seen = [];
    await runPool(
      [1, 2, 3, 4, 5, 6],
      async (n) => {
        if (n === 2) throw new Error("boom");
        seen.push(n);
      },
      2
    );
    expect(seen.sort((a, b) => a - b)).toEqual([1, 3, 4, 5, 6]);
  });

  it("handles a list shorter than the worker count", async () => {
    const seen = [];
    await runPool([1], async (n) => seen.push(n), 3);
    expect(seen).toEqual([1]);
  });

  it("handles an empty list", async () => {
    await expect(runPool([], async () => {}, 3)).resolves.toBeUndefined();
  });
});
