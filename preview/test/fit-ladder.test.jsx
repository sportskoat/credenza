// A5 · the fit ladder, top panel.
// Onboarding handoff README, "A5 · Upgrade path — the fit ladder".
// Every row is a projection of the profile. Nothing on this panel is stored.
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import FitLadder, {
  FIT_LADDER_COVERAGE,
  FIT_LADDER_KEYS,
  FIT_LADDER_STATUS,
  fitLadderRows,
} from "../../components/FitLadder.jsx";

afterEach(() => cleanup());

const rowsFor = (profile, extra = {}) =>
  fitLadderRows({ profile, category: "shirt", units: "cm", ...extra });

describe("fit ladder · projection", () => {
  it("names the four rows in README order", () => {
    expect(FIT_LADDER_KEYS).toEqual(["Usual size", "How you like it", "Chest", "Waist"]);
  });

  it("counts nothing saved on a cold profile", () => {
    const out = rowsFor(null);
    expect(out.saved).toBe(0);
    expect(out.total).toBe(4);
    expect(out.coverage).toBe(FIT_LADDER_COVERAGE.none);
  });

  it("marks exactly one row NEXT and the rest LATER", () => {
    const out = rowsFor(null);
    const next = out.rows.filter((r) => r.status === FIT_LADDER_STATUS.next);
    expect(next).toHaveLength(1);
    expect(next[0].key).toBe("Usual size");
  });

  it("reaches the README example: 2 of 4, tops are covered", () => {
    const out = rowsFor({ usualSize: "M" }, { fitPref: { looseness: "regular" } });
    expect(out.saved).toBe(2);
    expect(out.coverage).toBe(FIT_LADDER_COVERAGE.tops);
    expect(out.rows[0]).toMatchObject({ tail: "M", status: FIT_LADDER_STATUS.saved });
    expect(out.rows[1]).toMatchObject({ tail: "regular", status: FIT_LADDER_STATUS.saved });
    expect(out.rows[2]).toMatchObject({ tail: "removes the guess", status: FIT_LADDER_STATUS.next });
    expect(out.rows[3]).toMatchObject({ tail: "for bottoms", status: FIT_LADDER_STATUS.later });
  });

  it("shows a saved measure in the visitor's units", () => {
    expect(rowsFor({ chest: 108 }).rows[2].tail).toBe("108cm");
    expect(rowsFor({ chest: 108 }, { units: "in" }).rows[2].tail).toBe("42.5″");
  });

  it("asks a bottoms card for the waist before the chest", () => {
    const out = rowsFor({ usualSize: "M" }, {
      category: "shorts",
      fitPref: { looseness: "regular" },
    });
    // Display order never changes, but NEXT moves to the waist.
    expect(out.rows[2].status).toBe(FIT_LADDER_STATUS.later);
    expect(out.rows[3].status).toBe(FIT_LADDER_STATUS.next);
  });

  it("reads a full profile as covered on both classes", () => {
    const out = rowsFor(
      { usualSize: "M", chest: 108, waist: 84 },
      { fitPref: { looseness: "regular" } }
    );
    expect(out.saved).toBe(4);
    expect(out.coverage).toBe(FIT_LADDER_COVERAGE.both);
    expect(out.rows.every((r) => r.status === FIT_LADDER_STATUS.saved)).toBe(true);
  });

  it("ignores a zero or a junk measure instead of calling it saved", () => {
    expect(rowsFor({ chest: 0 }).rows[2].status).not.toBe(FIT_LADDER_STATUS.saved);
    expect(rowsFor({ chest: "abc" }).rows[2].status).not.toBe(FIT_LADDER_STATUS.saved);
    expect(rowsFor({ chest: 0 }).saved).toBe(0);
  });
});

describe("fit ladder · render", () => {
  it("shows the header count and the coverage label", () => {
    render(
      <FitLadder profile={{ usualSize: "M" }} fitPref={{ looseness: "regular" }} units="cm" />
    );
    expect(screen.getByText("Your fit · 2 of 4")).toBeInTheDocument();
    expect(screen.getByText(FIT_LADDER_COVERAGE.tops)).toBeInTheDocument();
  });

  it("fills one meter segment per saved answer", () => {
    const { container } = render(
      <FitLadder profile={{ usualSize: "M" }} fitPref={{ looseness: "regular" }} units="cm" />
    );
    expect(container.querySelectorAll(".cz-fit-ladder-seg")).toHaveLength(4);
    expect(container.querySelectorAll(".cz-fit-ladder-seg.is-on")).toHaveLength(2);
  });

  it("reads the meter out to a screen reader as a count, not as decoration", () => {
    render(<FitLadder profile={{ usualSize: "M" }} units="cm" />);
    expect(screen.getByRole("img", { name: "1 of 4 answers saved" })).toBeInTheDocument();
  });

  it("writes each row as key, middle dot, tail", () => {
    render(
      <FitLadder profile={{ usualSize: "M" }} fitPref={{ looseness: "regular" }} units="cm" />
    );
    expect(screen.getByText("Usual size · M")).toBeInTheDocument();
    expect(screen.getByText("How you like it · regular")).toBeInTheDocument();
    expect(screen.getByText("Chest · removes the guess")).toBeInTheDocument();
    expect(screen.getByText("Waist · for bottoms")).toBeInTheDocument();
  });

  it("uses no emoji, no exclamation mark and no em dash", () => {
    const { container } = render(
      <FitLadder profile={{ usualSize: "M" }} fitPref={{ looseness: "regular" }} units="cm" />
    );
    const all = container.textContent;
    expect(all).not.toMatch(/!/);
    expect(all).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(all).not.toMatch(/—/);
  });
});
