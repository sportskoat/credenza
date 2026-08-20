// The shirt prompt stays away because the saved choice loads, not because
// the ask is later hidden. SizeRecommendation.needsPrefAsk reads fitPref.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import SizeRecommendation from "../../components/SizeRecommendation.jsx";

afterEach(() => cleanup());

const SHIRT = {
  id: "shirt-pref",
  title: "Stussy hoodie",
  category: "shirt",
  sizeNotes: "M: chest 116, length 70\nL: chest 120, length 72\nXL: chest 124, length 74",
};

function rec(fitPref) {
  return (
    <SizeRecommendation
      item={SHIRT}
      bodyProfile={{ chest: 96 }}
      units="cm"
      sizeActive
      onSaveEdit={vi.fn()}
      onSaveBodyProfile={vi.fn()}
      onSaveFitPref={vi.fn()}
      fitPref={fitPref}
    />
  );
}

describe("SizeRecommendation shirt-wear prompt", () => {
  it("asks how you wear shirts when no choice is saved", () => {
    render(rec(null));
    expect(screen.getByText("How do you wear shirts?")).toBeInTheDocument();
  });

  it("does not ask when shirts already have a saved choice", () => {
    render(
      rec({ length: "regular", looseness: "oversized", dismissed: false })
    );
    expect(screen.queryByText("How do you wear shirts?")).toBe(null);
  });

  it("does not ask when shirts were dismissed", () => {
    render(rec({ length: null, looseness: null, dismissed: true }));
    expect(screen.queryByText("How do you wear shirts?")).toBe(null);
  });
});
