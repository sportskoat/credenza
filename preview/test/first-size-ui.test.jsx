// A1–A4 · the first-size ask, the pick, and the honest skipped state.
// Onboarding handoff README, "Screens / views" and "Copy deck".
//
// The block opens straight on A1. The README ship path is A0 → A1 → A2 → A3
// and its Definition of Done says "Taps to first pick is exactly 2", so the
// old three-way chooser is gone. Measure stays reachable from the A1 link.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FirstSizeBlock, {
  FIRST_SIZE_COPY,
  firstSizeChipRun,
  firstSizeEaseValue,
} from "../../components/FirstSizeBlock.jsx";
import {
  FIRST_SIZE_USUAL_CHIPS,
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

describe("copy deck · verbatim", () => {
  it("carries the ask 1 title and body", () => {
    expect(FIRST_SIZE_COPY.ask1Title).toBe("What size do you usually buy?");
    expect(FIRST_SIZE_COPY.ask1Body).toBe(
      "This seller's chart is posted. Your usual size tells us where you sit on it."
    );
  });

  it("carries the tape link, the skip and the primary", () => {
    expect(FIRST_SIZE_COPY.tapeLink).toBe("I have a tape · enter chest");
    expect(FIRST_SIZE_COPY.skip).toBe("Skip for now");
    expect(FIRST_SIZE_COPY.showMySize).toBe("Show my size");
    expect(FIRST_SIZE_COPY.addMySize).toBe("Add my size");
  });

  it("carries the privacy line and the skipped headline", () => {
    expect(FIRST_SIZE_COPY.skippedTitle).toBe("No size pick yet.");
    expect(FIRST_SIZE_COPY.privacy).toBe(
      "Signed out · your answers stay on this phone. We won't ask again this visit."
    );
  });

  it("uses no emoji, no exclamation mark and no em dash", () => {
    const all = Object.values(FIRST_SIZE_COPY).join(" ");
    expect(all).not.toMatch(/!/);
    expect(all).not.toMatch(/\p{Extended_Pictographic}/u);
    // CONTEXT.md bans the em dash in rendered site content.
    expect(all).not.toMatch(/—/);
  });
});

describe("A1 · ask 1 of 2", () => {
  it("opens on the ask, not on a chooser, so first pick costs two taps", () => {
    mount();
    expect(screen.getByText(FIRST_SIZE_COPY.ask1Title)).toBeInTheDocument();
    expect(screen.getByText(FIRST_SIZE_COPY.step1)).toBeInTheDocument();
    expect(screen.queryByText(/How should we size you/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /Match with a shirt/i })).toBeNull();
  });

  it("shows the tape link and the skip in the footer", () => {
    mount({ onSkip: vi.fn() });
    expect(screen.getByRole("button", { name: FIRST_SIZE_COPY.tapeLink })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: FIRST_SIZE_COPY.skip })).toBeInTheDocument();
  });

  it("names the missing chart instead of the posted one when no chart parsed", () => {
    mount({ chart: null });
    expect(screen.getByText(FIRST_SIZE_COPY.ask1BodyNoChart)).toBeInTheDocument();
  });

  it("builds its chips from the listing's own size run", () => {
    mount({ sizeRun: ["46", "48", "50", "52"] });
    expect(screen.getByRole("radio", { name: "48" })).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "XXL" })).toBeNull();
  });

  it("falls back to the letter run when the listing names no sizes", () => {
    expect(firstSizeChipRun([])).toEqual(FIRST_SIZE_USUAL_CHIPS);
    expect(firstSizeChipRun(["M", "M", "L"])).toEqual(["M", "L"]);
  });

  it("groups the chips as a radio group, so arrow keys move across them", () => {
    mount();
    expect(screen.getByRole("radiogroup", { name: /Usual size/i })).toBeInTheDocument();
  });

  it("leads to the second ask on one tap", async () => {
    const user = userEvent.setup();
    mount();
    await user.click(screen.getByRole("radio", { name: "M" }));
    expect(screen.getByText(FIRST_SIZE_COPY.step2)).toBeInTheDocument();
  });
});

describe("A2 · ask 2 of 2", () => {
  const openAsk2 = async (user, props = {}) => {
    mount(props);
    await user.click(screen.getByRole("radio", { name: "M" }));
  };

  it("keeps the first answer visible in the header", async () => {
    const user = userEvent.setup();
    await openAsk2(user);
    expect(screen.getByText(/Your size · Usual M/i)).toBeInTheDocument();
  });

  it("quotes the real chart number for the size the visitor tapped", async () => {
    const user = userEvent.setup();
    await openAsk2(user);
    expect(screen.getByText(/Your usual M is 104cm on this chart/i)).toBeInTheDocument();
  });

  it("holds the primary shut until an ease chip is chosen", async () => {
    const user = userEvent.setup();
    await openAsk2(user);
    const primary = screen.getByRole("button", { name: FIRST_SIZE_COPY.showMySize });
    expect(primary).toBeDisabled();
    await user.click(screen.getByRole("radio", { name: /Regular/i }));
    expect(primary).toBeEnabled();
  });

  it("offers the skip here too, so either step can dismiss both asks", async () => {
    const user = userEvent.setup();
    await openAsk2(user, { onSkip: vi.fn() });
    expect(screen.getByRole("button", { name: FIRST_SIZE_COPY.skip })).toBeInTheDocument();
  });
});

describe("A3 · the pick", () => {
  const pick = async (user, props = {}) => {
    const saved = { profile: vi.fn(), pref: vi.fn() };
    mount({ onSaveBodyProfile: saved.profile, onSaveFitPref: saved.pref, ...props });
    await user.click(screen.getByRole("radio", { name: "M" }));
    await user.click(screen.getByRole("radio", { name: /Regular/i }));
    await user.click(screen.getByRole("button", { name: FIRST_SIZE_COPY.showMySize }));
    return saved;
  };

  it("saves the usual-fit profile and the fit preference", async () => {
    const user = userEvent.setup();
    const saved = await pick(user);
    const patch = saved.profile.mock.calls[0][0];
    expect(patch.usualTops).toBe("M");
    expect(patch.firstSizeSource).toBe("usual-fit");
    expect(saved.pref).toHaveBeenCalledWith(
      "shirt",
      expect.objectContaining({ looseness: "regular" })
    );
  });

  it("flies the chart-anchored confidence flag", async () => {
    const user = userEvent.setup();
    await pick(user);
    expect(screen.getByText(FIRST_SIZE_USUAL_FIT_PROV.rail)).toBeInTheDocument();
  });

  it("shows the three data tiles, with the anchor the visitor tapped", async () => {
    const user = userEvent.setup();
    await pick(user);
    expect(screen.getByText("Anchor")).toBeInTheDocument();
    expect(screen.getByText("Garment")).toBeInTheDocument();
    expect(screen.getByText("Ease")).toBeInTheDocument();
    expect(screen.getByText("Usual M")).toBeInTheDocument();
  });

  it("writes the ease with its sign", () => {
    expect(firstSizeEaseValue(6, "cm")).toBe("+6cm");
    expect(firstSizeEaseValue(-2.5, "cm")).toBe("-2.5cm");
    expect(firstSizeEaseValue(null, "cm")).toBe("");
  });

  it("shows the provenance line and the link that removes the guess", async () => {
    const user = userEvent.setup();
    await pick(user);
    expect(screen.getByText(/Started from a size you told us/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: FIRST_SIZE_USUAL_FIT_PROV.upgrade })
    ).toBeInTheDocument();
  });

  it("makes no network request anywhere in the flow", async () => {
    const user = userEvent.setup();
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation(() => {
      throw new Error("no network in A0–A5");
    });
    await pick(user);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe("A3 · no chart", () => {
  it("completes the pick, flies the no-chart flag and shows no tiles", async () => {
    const user = userEvent.setup();
    const onSaveBodyProfile = vi.fn();
    const onSaveFitPref = vi.fn();
    mount({ chart: null, onSaveBodyProfile, onSaveFitPref });
    await user.click(screen.getByRole("radio", { name: "L" }));
    await user.click(screen.getByRole("radio", { name: /Regular/i }));
    await user.click(screen.getByRole("button", { name: FIRST_SIZE_COPY.showMySize }));

    const patch = onSaveBodyProfile.mock.calls[0][0];
    expect(patch.usualSize).toBe("L");
    expect(patch.firstSizeSource).toBe("usual-no-chart");
    expect(patch.chest).toBeUndefined();
    expect(screen.getByText(FIRST_SIZE_USUAL_NO_CHART_PROV.rail)).toBeInTheDocument();
    // The label must never outrun the source: no chart flag, no chart tiles.
    expect(screen.queryByText(FIRST_SIZE_USUAL_FIT_PROV.rail)).toBeNull();
    expect(screen.queryByText("Garment")).toBeNull();
  });
});

describe("A4 · skipped", () => {
  it("names the real gap and keeps a way back in", async () => {
    const user = userEvent.setup();
    mount({ onSkip: vi.fn() });
    await user.click(screen.getByRole("button", { name: FIRST_SIZE_COPY.skip }));
    expect(screen.getByText(FIRST_SIZE_COPY.skippedTitle)).toBeInTheDocument();
    expect(screen.getByText(FIRST_SIZE_COPY.skippedBody)).toBeInTheDocument();
    expect(screen.getByText(FIRST_SIZE_COPY.privacy)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: FIRST_SIZE_COPY.addMySize })).toBeInTheDocument();
  });

  it("never claims a chart is missing when the chart parsed fine", async () => {
    const user = userEvent.setup();
    mount({ onSkip: vi.fn() });
    await user.click(screen.getByRole("button", { name: FIRST_SIZE_COPY.skip }));
    expect(screen.queryByText(/no size available/i)).toBeNull();
    expect(screen.getByText(/chart is read and ready/i)).toBeInTheDocument();
  });

  // Kyle 2026-08-04: the skipped state said "chart is read and ready" on a
  // listing with NO chart. The copy must follow the same split as ask1.
  it("never claims a chart is ready when the listing has none", async () => {
    const user = userEvent.setup();
    mount({ chart: null, onSkip: vi.fn() });
    await user.click(screen.getByRole("button", { name: FIRST_SIZE_COPY.skip }));
    expect(screen.queryByText(/chart is read and ready/i)).toBeNull();
    expect(screen.getByText(FIRST_SIZE_COPY.skippedBodyNoChart)).toBeInTheDocument();
  });
});

describe("the tape path", () => {
  it("reaches the chest field from the A1 link and saves a doubled chest", async () => {
    const user = userEvent.setup();
    const onSaveBodyProfile = vi.fn();
    mount({ onSaveBodyProfile });
    await user.click(screen.getByRole("button", { name: FIRST_SIZE_COPY.tapeLink }));
    expect(screen.getByRole("button", { name: "cm" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "in" })).toBeInTheDocument();
    await user.type(screen.getByLabelText(/Chest/i), "54");
    await user.click(screen.getByRole("button", { name: /Save and re-score my cards/i }));
    expect(onSaveBodyProfile).toHaveBeenCalledWith(
      expect.objectContaining({ chest: 108, firstSizeSource: "measure" })
    );
  });
});
