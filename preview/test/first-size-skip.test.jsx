// Onboarding README, "State machine": `skipped` is session-sticky. One skip
// suppresses both asks on every card for the rest of the session. A reload must
// not re-ask. These pins cover the storage helpers and the rendered result.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FirstSizeBlock from "../../components/FirstSizeBlock.jsx";
import {
  FIT_SKIP_KEY,
  parseSizeChart,
  readFitSkippedAt,
  writeFitSkippedAt,
} from "../../credenza-fashion.jsx";

const CHART = parseSizeChart("S: chest 96\nM: chest 100\nL: chest 104\nXL: chest 112");
const item = { id: "fs-skip-1", category: "shirt", title: "Cotton tee" };

beforeEach(() => {
  window.sessionStorage.clear();
});
afterEach(() => cleanup());

describe("session-sticky skip · storage", () => {
  it("reads empty before any skip", () => {
    expect(readFitSkippedAt()).toBe("");
  });

  it("keeps the stamp a later read sees, so a reload does not re-ask", () => {
    writeFitSkippedAt("2026-08-02T00:00:00.000Z");
    expect(readFitSkippedAt()).toBe("2026-08-02T00:00:00.000Z");
  });

  it("stamps itself when the caller passes nothing", () => {
    writeFitSkippedAt();
    expect(readFitSkippedAt()).not.toBe("");
  });

  it("lives in sessionStorage, so a new session clears it", () => {
    writeFitSkippedAt("2026-08-02T00:00:00.000Z");
    expect(window.sessionStorage.getItem(FIT_SKIP_KEY)).toBe("2026-08-02T00:00:00.000Z");
    expect(window.localStorage.getItem(FIT_SKIP_KEY)).toBeNull();
  });

  it("survives a blocked store instead of throwing", () => {
    const spy = vi.spyOn(window.sessionStorage.__proto__, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => writeFitSkippedAt("x")).not.toThrow();
    spy.mockRestore();
  });
});

describe("session-sticky skip · both asks stay down", () => {
  it("suppresses the ask on a fresh card once the session carries a skip", () => {
    render(
      <FirstSizeBlock
        item={item}
        chart={CHART}
        units="cm"
        onSaveBodyProfile={vi.fn()}
        onSaveFitPref={vi.fn()}
        onSkip={null}
        startSkipped
      />
    );
    expect(screen.getByText(/No size pick yet/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Guess/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /Measure/i })).toBeNull();
  });

  it("still offers a way back in, so the skip is never a dead end", async () => {
    const user = userEvent.setup();
    render(
      <FirstSizeBlock
        item={item}
        chart={CHART}
        units="cm"
        onSaveBodyProfile={vi.fn()}
        onSaveFitPref={vi.fn()}
        onSkip={null}
        startSkipped
      />
    );
    const back = screen.getByRole("button", { name: /Add my size/i });
    await user.click(back);
    expect(screen.queryByText(/No size pick yet/i)).toBeNull();
  });
});
