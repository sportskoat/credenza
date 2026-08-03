// A0 · Arrival — the intro strip under the paste bar.
// Onboarding handoff README, "A0 · Arrival". Copy is verbatim. Dismissal is
// permanent (localStorage), unlike the fit skip, which is session-only.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import IntroStrip, {
  INTRO_STRIP_FOOTER,
  INTRO_STRIP_KICKER,
  INTRO_STRIP_STEPS,
} from "../../components/IntroStrip.jsx";
import {
  INTRO_DISMISSED_KEY,
  readIntroDismissed,
  writeIntroDismissed,
} from "../../credenza-fashion.jsx";

beforeEach(() => {
  window.localStorage.clear();
});
afterEach(() => cleanup());

describe("intro strip · copy deck", () => {
  it("carries the kicker verbatim", () => {
    expect(INTRO_STRIP_KICKER).toBe("FROM REDDIT · HERE IS THE TRICK");
  });

  it("carries the three steps verbatim, in order", () => {
    expect(INTRO_STRIP_STEPS).toEqual([
      "Paste one seller link.",
      "We read that seller's size chart.",
      "You get the size that fits you.",
    ]);
  });

  it("carries the footer verbatim", () => {
    expect(INTRO_STRIP_FOOTER).toBe(
      "Two taps on the first card is all we ask for. No tape, no account."
    );
  });

  it("uses no emoji and no exclamation mark", () => {
    const all = [INTRO_STRIP_KICKER, INTRO_STRIP_FOOTER, ...INTRO_STRIP_STEPS].join(" ");
    expect(all).not.toMatch(/!/);
    expect(all).not.toMatch(/\p{Extended_Pictographic}/u);
    // Middle dot is the only separator Credenza uses. No em dash, no pipe.
    expect(all).not.toMatch(/[—|]/);
  });
});

describe("intro strip · render", () => {
  it("shows the kicker, three numbered rows and the footer", () => {
    render(<IntroStrip onDismiss={vi.fn()} />);
    expect(screen.getByText(INTRO_STRIP_KICKER)).toBeInTheDocument();
    INTRO_STRIP_STEPS.forEach((step) => {
      expect(screen.getByText(step)).toBeInTheDocument();
    });
    expect(screen.getByText(INTRO_STRIP_FOOTER)).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("asks for no size and holds no input, because the ask belongs to the card", () => {
    const { container } = render(<IntroStrip onDismiss={vi.fn()} />);
    expect(container.querySelectorAll("input")).toHaveLength(0);
    expect(screen.queryByText(/usual size/i)).toBeNull();
  });

  it("calls back when the visitor taps the dismiss control", async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(<IntroStrip onDismiss={onDismiss} />);
    await user.click(screen.getByRole("button", { name: /Dismiss/i }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

describe("intro strip · dismissal is permanent", () => {
  it("reads false before any dismiss", () => {
    expect(readIntroDismissed()).toBe(false);
  });

  it("stays dismissed on a later read", () => {
    writeIntroDismissed();
    expect(readIntroDismissed()).toBe(true);
  });

  it("lives in localStorage, so a new session keeps it dismissed", () => {
    writeIntroDismissed();
    expect(window.localStorage.getItem(INTRO_DISMISSED_KEY)).toBe("1");
    expect(window.sessionStorage.getItem(INTRO_DISMISSED_KEY)).toBeNull();
  });

  it("survives a blocked store instead of throwing", () => {
    const spy = vi.spyOn(window.localStorage.__proto__, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => writeIntroDismissed()).not.toThrow();
    spy.mockRestore();
  });
});
