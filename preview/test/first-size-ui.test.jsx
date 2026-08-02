// Phase 1 first-size chooser UI mount pins.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FirstSizeBlock from "../../components/FirstSizeBlock.jsx";
import {
  FIRST_SIZE_USUAL_FIT_PROV,
  FIRST_SIZE_USUAL_NO_CHART_PROV,
} from "../../components/first-size.js";
import { parseSizeChart } from "../../credenza-fashion.jsx";

const CHART = parseSizeChart("S: chest 100\nM: chest 104\nL: chest 110\nXL: chest 116");
const item = {
  id: "fs-1",
  category: "shirt",
  title: "Heavyweight boxy tee",
};

afterEach(() => cleanup());

describe("FirstSizeBlock chooser", () => {
  it("renders Guess / Match (disabled) / Measure only with empty profile path", async () => {
    const user = userEvent.setup();
    render(
      <FirstSizeBlock
        item={item}
        chart={CHART}
        units="cm"
        onSaveBodyProfile={vi.fn()}
        onSaveFitPref={vi.fn()}
        onSkip={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: /Guess/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Match with a shirt/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Measure/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Skip for now/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Skip for now/i }));
    expect(screen.getByText(/No size pick yet/i)).toBeInTheDocument();
    expect(screen.getByText(/will not ask again this visit/i)).toBeInTheDocument();
  });

  it("guess path: two taps save usual-fit profile + fit pref with new provenance", async () => {
    const user = userEvent.setup();
    const onSaveBodyProfile = vi.fn();
    const onSaveFitPref = vi.fn();
    render(
      <FirstSizeBlock
        item={item}
        chart={CHART}
        units="cm"
        onSaveBodyProfile={onSaveBodyProfile}
        onSaveFitPref={onSaveFitPref}
      />
    );
    await user.click(screen.getByRole("button", { name: /Guess/i }));
    await user.click(screen.getByRole("button", { name: "M" }));
    await user.click(screen.getByRole("button", { name: /Regular/i }));

    expect(onSaveBodyProfile).toHaveBeenCalled();
    const patch = onSaveBodyProfile.mock.calls[0][0];
    expect(patch.usualTops).toBe("M");
    expect(patch.firstSizeSource).toBe("usual-fit");
    expect(onSaveFitPref).toHaveBeenCalledWith(
      "shirt",
      expect.objectContaining({ looseness: "regular" })
    );
    expect(screen.getByText(FIRST_SIZE_USUAL_FIT_PROV.rail)).toBeInTheDocument();
    expect(screen.getByText(FIRST_SIZE_USUAL_FIT_PROV.body)).toBeInTheDocument();
  });

  it("measure path: cm/in toggle and save doubled chest", async () => {
    const user = userEvent.setup();
    const onSaveBodyProfile = vi.fn();
    render(
      <FirstSizeBlock
        item={item}
        chart={CHART}
        units="cm"
        onSaveBodyProfile={onSaveBodyProfile}
      />
    );
    await user.click(screen.getByRole("button", { name: /Measure/i }));
    expect(screen.getByRole("button", { name: "cm" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "in" })).toBeInTheDocument();
    await user.type(screen.getByLabelText(/Chest/i), "54");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(onSaveBodyProfile).toHaveBeenCalledWith(
      expect.objectContaining({ chest: 108, firstSizeSource: "measure" })
    );
  });

  // F Fix 1 (Kyle live 2026-08-02): no-chart Guess must complete, not error.
  it("no-chart guess: two taps save usual + sit, show YOUR USUAL provenance, no error", async () => {
    const user = userEvent.setup();
    const onSaveBodyProfile = vi.fn();
    const onSaveFitPref = vi.fn();
    render(
      <FirstSizeBlock
        item={item}
        chart={null}
        units="cm"
        onSaveBodyProfile={onSaveBodyProfile}
        onSaveFitPref={onSaveFitPref}
      />
    );
    await user.click(screen.getByRole("button", { name: /Guess/i }));
    expect(
      screen.getByText(/No seller chart on this listing/i)
    ).toBeInTheDocument();
    // Dead-end copy must never appear.
    expect(screen.queryByText(/Guess needs a chart/i)).toBeNull();
    expect(screen.queryByText(/Measure instead, or wait for a chart read/i)).toBeNull();

    await user.click(screen.getByRole("button", { name: "L" }));
    await user.click(screen.getByRole("button", { name: /Regular/i }));

    expect(onSaveBodyProfile).toHaveBeenCalled();
    const patch = onSaveBodyProfile.mock.calls[0][0];
    expect(patch.usualTops).toBe("L");
    expect(patch.usualSize).toBe("L");
    expect(patch.firstSizeSource).toBe("usual-no-chart");
    expect(patch.chest).toBeUndefined();
    expect(onSaveFitPref).toHaveBeenCalledWith(
      "shirt",
      expect.objectContaining({ looseness: "regular" })
    );
    expect(screen.getByText(FIRST_SIZE_USUAL_NO_CHART_PROV.body)).toBeInTheDocument();
    expect(screen.getAllByText(FIRST_SIZE_USUAL_NO_CHART_PROV.kicker).length).toBeGreaterThan(0);
    // Must not show the chart-anchored usual-fit rail.
    expect(screen.queryByText(FIRST_SIZE_USUAL_FIT_PROV.rail)).toBeNull();
    expect(screen.queryByText(/No size chart on this card yet/i)).toBeNull();
  });
});
