// Phase 2 Match UI — design B1/B2/B3 + F ruling bd106459.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FirstSizeBlock, { FIRST_SIZE_COPY } from "../../components/FirstSizeBlock.jsx";
import { parseSizeChart } from "../../credenza-fashion.jsx";

const CHART = parseSizeChart("S: chest 100\nM: chest 104\nL: chest 110\nXL: chest 116");
const item = {
  id: "bm-1",
  category: "shirt",
  title: "Heavyweight boxy tee",
};

afterEach(() => cleanup());

const mount = (props = {}) =>
  render(
    <FirstSizeBlock
      item={item}
      chart={CHART}
      units="cm"
      onSaveBodyProfile={vi.fn()}
      onSaveFitPref={vi.fn()}
      {...props}
    />
  );

describe("Match entry from ask1", () => {
  it("offers the brand-tee link on tops", () => {
    mount();
    expect(screen.getByRole("button", { name: FIRST_SIZE_COPY.matchLink })).toBeInTheDocument();
  });

  it("hides the brand-tee link on bottoms", () => {
    mount({ item: { ...item, category: "pants" } });
    expect(screen.queryByRole("button", { name: FIRST_SIZE_COPY.matchLink })).toBeNull();
  });
});

describe("Match flow · Nike S → confirm → save 99.6", () => {
  it("walks brand → size → confirm and saves the F-pin chest", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    mount({ onSaveBodyProfile: onSave });

    await user.click(screen.getByRole("button", { name: FIRST_SIZE_COPY.matchLink }));
    expect(screen.getByText(FIRST_SIZE_COPY.matchTitle)).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "Nike" }));
    expect(screen.getByText(FIRST_SIZE_COPY.matchSizeLabel)).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "S" }));
    // Confirm B2
    expect(
      screen.getByText(/A Nike S fits about a 100 cm chest tee/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Change it if yours runs different/i)
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: FIRST_SIZE_COPY.matchConfirmUse }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        chest: 99.6,
        firstSizeSource: "brand-match",
        brandMatchBrand: "Nike",
        brandMatchSize: "S",
      })
    );
    // B3 provenance
    expect(screen.getByText(/Chart pick · chest 100cm/i)).toBeInTheDocument();
    expect(screen.getByText(/From the Nike S you named, not a tape/i)).toBeInTheDocument();
  });

  it("Something else falls through to Guess", async () => {
    const user = userEvent.setup();
    mount();
    await user.click(screen.getByRole("button", { name: FIRST_SIZE_COPY.matchLink }));
    await user.click(screen.getByRole("radio", { name: "Something else" }));
    expect(screen.getByText(FIRST_SIZE_COPY.ask1Title)).toBeInTheDocument();
  });

  it("never lists H&M or Carhartt WIP", async () => {
    const user = userEvent.setup();
    mount();
    await user.click(screen.getByRole("button", { name: FIRST_SIZE_COPY.matchLink }));
    expect(screen.queryByRole("radio", { name: "H&M" })).toBeNull();
    expect(screen.queryByRole("radio", { name: /Carhartt WIP/i })).toBeNull();
    // Mainline Carhartt is covered and shown as "Carhartt".
    expect(screen.getByRole("radio", { name: "Carhartt" })).toBeInTheDocument();
  });
});
