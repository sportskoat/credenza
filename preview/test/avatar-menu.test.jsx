import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, within } from "@testing-library/react";

import AvatarMenu from "../../components/AvatarMenu.jsx";
import { PRICING } from "../../credenza-fashion.jsx";
import { PLAN_COPY } from "../../components/plans.js";

// The avatar quick menu — sign-in handoff README, screen 5. Two account doors
// first, then the shelf switches. The upsell line is the trial note verbatim:
// it is a legal term, so it is never paraphrased.

afterEach(cleanup);

const noop = () => {};

function renderMenu(extra = {}) {
  return render(
    <AvatarMenu
      accountSession={{ user: { email: "kyle@example.com" } }}
      accountPlan={{ state: "free" }}
      avatarInitials="KY"
      agentLabel="Sugargoo"
      onOpenAgent={noop}
      pricePrimary="USD"
      onOpenCurrency={noop}
      onOpenSettings={noop}
      onSignIn={noop}
      onOpenUpgrade={noop}
      onSignOut={noop}
      onClose={noop}
      {...extra}
    />
  );
}

describe("AvatarMenu · who you are", () => {
  it("shows who you are", () => {
    const { container } = renderMenu();
    expect(within(container).getByText("KY")).toBeTruthy();
    expect(within(container).getByText("kyle@example.com")).toBeTruthy();
    expect(within(container).getByText("Free")).toBeTruthy();
  });

  it("names the device when nobody is signed in", () => {
    const { container } = renderMenu({ accountSession: null, accountPlan: null });
    expect(within(container).getByText("Saved on this device")).toBeTruthy();
    expect(within(container).getByText("Signed out")).toBeTruthy();
  });

  // The counter is a projection of the live limit, never a stored copy. A
  // stored copy goes stale the moment a card resolves.
  it("counts the free cards off the live limit", () => {
    const { container } = renderMenu({
      accountSession: null,
      accountPlan: null,
      limits: { left: 3, cap: 5 },
    });
    expect(within(container).getByText("Signed out · 3 of 5 free cards")).toBeTruthy();
  });

  it("never calls the free plan unlimited", () => {
    const { container } = renderMenu({ accountSession: null, accountPlan: null });
    expect(container.textContent).not.toMatch(/unlimited/i);
  });
});

describe("AvatarMenu · the two account doors", () => {
  it("offers sign-in, not sign-out, when signed out", () => {
    const onSignIn = vi.fn();
    const { container } = renderMenu({
      accountSession: null,
      accountPlan: null,
      avatarInitials: null,
      onSignIn,
    });
    expect(within(container).queryByText("Sign out")).toBeNull();
    expect(within(container).getByText(PLAN_COPY.menuFreeSub)).toBeTruthy();
    fireEvent.click(within(container).getByText("Sign in"));
    expect(onSignIn).toHaveBeenCalledTimes(1);
  });

  it("sends the Pro door to the upgrade route, with the trial note verbatim", () => {
    const onOpenUpgrade = vi.fn();
    const { container } = renderMenu({ onOpenUpgrade });
    expect(within(container).getByText(PRICING.weeklyTrialNote)).toBeTruthy();
    fireEvent.click(within(container).getByText("See what Pro changes"));
    expect(onOpenUpgrade).toHaveBeenCalledTimes(1);
  });

  it("hides the Pro door for a Pro member", () => {
    const { container } = renderMenu({ accountPlan: { state: "pro" } });
    expect(within(container).queryByText("See what Pro changes")).toBeNull();
    expect(within(container).getByText("Pro")).toBeTruthy();
  });

  it("names permanent owner access and hides the Pro door", () => {
    const { container } = renderMenu({ accountPlan: { state: "owner" } });
    expect(within(container).queryByText("See what Pro changes")).toBeNull();
    expect(within(container).getByText("Owner")).toBeTruthy();
  });

  it("signs out from the first door", () => {
    const onSignOut = vi.fn();
    const { container } = renderMenu({ onSignOut });
    fireEvent.click(within(container).getByText("Sign out"));
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });
});

describe("AvatarMenu · the shelf switches", () => {
  // Kyle 2026-08-01: Gallery parked — colorway switch is gone; Blackout only.
  it("has no colorway switch", () => {
    const { container } = renderMenu();
    expect(within(container).queryByRole("radio", { name: "Gallery" })).toBeNull();
    expect(within(container).queryByRole("radio", { name: "Blackout" })).toBeNull();
    expect(within(container).queryByText("Colourway")).toBeNull();
    expect(within(container).queryByText("Colorway")).toBeNull();
  });

  it("carries the agent and currency rows", () => {
    const onOpenAgent = vi.fn();
    const onOpenCurrency = vi.fn();
    const { container } = renderMenu({ onOpenAgent, onOpenCurrency });
    expect(within(container).getByText("Sugargoo")).toBeTruthy();
    expect(within(container).getByText("USD")).toBeTruthy();
    fireEvent.click(within(container).getByText("Agent"));
    expect(onOpenAgent).toHaveBeenCalledTimes(1);
    fireEvent.click(within(container).getByText("Currency"));
    expect(onOpenCurrency).toHaveBeenCalledTimes(1);
  });

  it("opens the settings page from All settings", () => {
    const onOpenSettings = vi.fn();
    const { container } = renderMenu({ onOpenSettings });
    fireEvent.click(within(container).getByText("All settings"));
    expect(onOpenSettings).toHaveBeenCalledWith();
  });
});

describe("AvatarMenu · leaving", () => {
  it("closes before it acts", () => {
    const onClose = vi.fn();
    const onOpenSettings = vi.fn();
    const { container } = renderMenu({ onClose, onOpenSettings });
    fireEvent.click(within(container).getByText("All settings"));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape and on a click outside", () => {
    const onClose = vi.fn();
    renderMenu({ onClose });
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.mouseDown(document.body);
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
