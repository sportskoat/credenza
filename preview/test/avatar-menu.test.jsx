import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, within } from "@testing-library/react";

import AvatarMenu from "../../components/AvatarMenu.jsx";
import { PRICING } from "../../credenza-fashion.jsx";
import { PLAN_COPY } from "../../components/plans.js";

// The avatar quick menu — sign-in handoff README, screen 5. Two account doors
// first, then the shelf switches. The upsell line is the trial note verbatim:
// it is a legal term, so it is never paraphrased.
//
// Kyle 2026-08-04: the menu portals to document.body. Query the menu there,
// not the React render root.

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

function menuRoot() {
  return document.body.querySelector(".cz-avatar-menu");
}

describe("AvatarMenu · who you are", () => {
  it("shows who you are", () => {
    renderMenu();
    const menu = menuRoot();
    expect(within(menu).getByText("KY")).toBeTruthy();
    expect(within(menu).getByText("kyle@example.com")).toBeTruthy();
    expect(within(menu).getByText("Free")).toBeTruthy();
  });

  it("names the device when nobody is signed in", () => {
    renderMenu({ accountSession: null, accountPlan: null });
    const menu = menuRoot();
    expect(within(menu).getByText("Saved on this device")).toBeTruthy();
    expect(within(menu).getByText("Signed out")).toBeTruthy();
  });

  // The counter is a projection of the live limit, never a stored copy. A
  // stored copy goes stale the moment a card resolves.
  it("counts the free cards off the live limit", () => {
    renderMenu({
      accountSession: null,
      accountPlan: null,
      limits: { left: 3, cap: 5 },
    });
    expect(within(menuRoot()).getByText("Signed out · 3 of 5 free cards")).toBeTruthy();
  });

  it("never calls the free plan unlimited", () => {
    renderMenu({ accountSession: null, accountPlan: null });
    expect(menuRoot().textContent).not.toMatch(/unlimited/i);
  });
});

describe("AvatarMenu · the two account doors", () => {
  it("offers sign-in, not sign-out, when signed out", () => {
    const onSignIn = vi.fn();
    renderMenu({
      accountSession: null,
      accountPlan: null,
      avatarInitials: null,
      onSignIn,
    });
    const menu = menuRoot();
    expect(within(menu).queryByText("Sign out")).toBeNull();
    expect(within(menu).getByText(PLAN_COPY.menuFreeSub)).toBeTruthy();
    fireEvent.click(within(menu).getByText("Sign in"));
    expect(onSignIn).toHaveBeenCalledTimes(1);
  });

  it("sends the Pro door to the upgrade route, with the trial note verbatim", () => {
    const onOpenUpgrade = vi.fn();
    renderMenu({ onOpenUpgrade });
    const menu = menuRoot();
    expect(within(menu).getByText(PRICING.weeklyTrialNote)).toBeTruthy();
    fireEvent.click(within(menu).getByText("See what Pro changes"));
    expect(onOpenUpgrade).toHaveBeenCalledTimes(1);
  });

  it("hides the Pro door for a Pro member", () => {
    renderMenu({ accountPlan: { state: "pro" } });
    const menu = menuRoot();
    expect(within(menu).queryByText("See what Pro changes")).toBeNull();
    expect(within(menu).getByText("Pro")).toBeTruthy();
  });

  it("names permanent owner access and hides the Pro door", () => {
    renderMenu({ accountPlan: { state: "owner" } });
    const menu = menuRoot();
    expect(within(menu).queryByText("See what Pro changes")).toBeNull();
    expect(within(menu).getByText("Owner")).toBeTruthy();
  });

  it("signs out from the first door", () => {
    const onSignOut = vi.fn();
    renderMenu({ onSignOut });
    fireEvent.click(within(menuRoot()).getByText("Sign out"));
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });
});

describe("AvatarMenu · the shelf switches", () => {
  // Kyle 2026-08-01: Gallery parked — colorway switch is gone; Blackout only.
  it("has no colorway switch", () => {
    renderMenu();
    const menu = menuRoot();
    expect(within(menu).queryByRole("radio", { name: "Gallery" })).toBeNull();
    expect(within(menu).queryByRole("radio", { name: "Blackout" })).toBeNull();
    expect(within(menu).queryByText("Colourway")).toBeNull();
    expect(within(menu).queryByText("Colorway")).toBeNull();
  });

  it("carries the agent and currency rows", () => {
    const onOpenAgent = vi.fn();
    const onOpenCurrency = vi.fn();
    renderMenu({ onOpenAgent, onOpenCurrency });
    const menu = menuRoot();
    expect(within(menu).getByText("Sugargoo")).toBeTruthy();
    expect(within(menu).getByText("USD")).toBeTruthy();
    fireEvent.click(within(menu).getByText("Agent"));
    expect(onOpenAgent).toHaveBeenCalledTimes(1);
    fireEvent.click(within(menu).getByText("Currency"));
    expect(onOpenCurrency).toHaveBeenCalledTimes(1);
  });

  it("opens the settings page from All settings", () => {
    const onOpenSettings = vi.fn();
    renderMenu({ onOpenSettings });
    fireEvent.click(within(menuRoot()).getByText("All settings"));
    expect(onOpenSettings).toHaveBeenCalledWith();
  });
});

describe("AvatarMenu · leaving", () => {
  it("closes before it acts", () => {
    const onClose = vi.fn();
    const onOpenSettings = vi.fn();
    renderMenu({ onClose, onOpenSettings });
    fireEvent.click(within(menuRoot()).getByText("All settings"));
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

  // The profile button toggles the menu. Outside mousedown must not race that
  // click, or one tap closes then re-opens.
  it("does not close on mousedown of the profile toggle", () => {
    const onClose = vi.fn();
    renderMenu({ onClose });
    const toggle = document.createElement("button");
    toggle.setAttribute("data-cz-avatar-toggle", "");
    document.body.appendChild(toggle);
    fireEvent.mouseDown(toggle);
    expect(onClose).not.toHaveBeenCalled();
    toggle.remove();
  });

  // Kyle 2026-08-04: phone was clipping the left side of the sign-in menu.
  // Fixed placement under the avatar must keep the left edge on screen.
  // The menu portals to document.body so look there, not in the render root.
  it("keeps the menu fully on a narrow phone screen", () => {
    const toggle = document.createElement("button");
    toggle.setAttribute("data-cz-avatar-toggle", "");
    Object.defineProperty(toggle, "getBoundingClientRect", {
      value: () => ({
        top: 48,
        bottom: 84,
        left: 320,
        right: 360,
        width: 40,
        height: 36,
      }),
    });
    document.body.appendChild(toggle);
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 375 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 812 });

    renderMenu({ accountSession: null, accountPlan: null });
    const menu = menuRoot();
    expect(menu).toBeTruthy();
    const left = parseFloat(menu.style.left || "0");
    const width = parseFloat(menu.style.width || "0");
    expect(left).toBeGreaterThanOrEqual(12);
    expect(left + width).toBeLessThanOrEqual(375 - 12);
    expect(menu.style.position).toBe("fixed");
    // Portaled out of the React tree so header overflow cannot clip it.
    expect(menu.parentElement).toBe(document.body);
    toggle.remove();
  });

  // Desktop avatar sits at the right of a wide window. The menu's right edge
  // must line up under the avatar, not hang off the right of the screen.
  it("keeps the menu fully on a wide desktop screen", () => {
    const toggle = document.createElement("button");
    toggle.setAttribute("data-cz-avatar-toggle", "");
    Object.defineProperty(toggle, "getBoundingClientRect", {
      value: () => ({
        top: 24,
        bottom: 68,
        left: 1180,
        right: 1224,
        width: 44,
        height: 44,
      }),
    });
    document.body.appendChild(toggle);
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1280 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });

    renderMenu();
    const menu = menuRoot();
    expect(menu).toBeTruthy();
    const left = parseFloat(menu.style.left || "0");
    const width = parseFloat(menu.style.width || "0");
    expect(width).toBe(300);
    expect(left).toBeGreaterThanOrEqual(12);
    expect(left + width).toBeLessThanOrEqual(1280 - 12);
    // Right-aligned under the avatar (avatar right 1224 − 300 = 924).
    expect(left).toBe(924);
    toggle.remove();
  });
});
