import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, within } from "@testing-library/react";

import AvatarMenu from "../../components/AvatarMenu.jsx";
import { PRICING } from "../../credenza-fashion.jsx";

// The avatar quick menu (Profile Settings design 1c): who you are, the
// switches you actually flip, and a door into the settings page. The upsell
// line is the trial note verbatim — it is a legal term.

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
      onCycleCurrency={noop}
      onOpenSettings={noop}
      onSignOut={noop}
      onClose={noop}
      {...extra}
    />
  );
}

describe("AvatarMenu (design 1c)", () => {
  it("shows who you are", () => {
    const { container } = renderMenu();
    expect(within(container).getByText("KY")).toBeTruthy();
    expect(within(container).getByText("kyle@example.com")).toBeTruthy();
    expect(within(container).getByText("Free · saved on this device")).toBeTruthy();
  });

  it("sells Pro with the trial note verbatim, and See Pro opens the account section", () => {
    const onOpenSettings = vi.fn();
    const { container } = renderMenu({ onOpenSettings });
    expect(within(container).getByText("Pro lifts the daily limits")).toBeTruthy();
    expect(within(container).getByText(PRICING.weeklyTrialNote)).toBeTruthy();
    fireEvent.click(within(container).getByText("See Pro"));
    expect(onOpenSettings).toHaveBeenCalledWith("account");
  });

  it("hides the upsell for a Pro member", () => {
    const { container } = renderMenu({ accountPlan: { state: "pro" } });
    expect(within(container).queryByText("Pro lifts the daily limits")).toBeNull();
    expect(within(container).getByText("Pro · saved on this device")).toBeTruthy();
  });

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
    const onCycleCurrency = vi.fn();
    const { container } = renderMenu({ onOpenAgent, onCycleCurrency });
    expect(within(container).getByText("Sugargoo ›")).toBeTruthy();
    expect(within(container).getByText("USD ›")).toBeTruthy();
    fireEvent.click(within(container).getByText("Agent"));
    expect(onOpenAgent).toHaveBeenCalledTimes(1);
    fireEvent.click(within(container).getByText("Currency"));
    expect(onCycleCurrency).toHaveBeenCalledTimes(1);
  });

  it("opens the settings page from All settings", () => {
    const onOpenSettings = vi.fn();
    const { container } = renderMenu({ onOpenSettings });
    fireEvent.click(within(container).getByText("All settings"));
    expect(onOpenSettings).toHaveBeenCalledWith();
  });

  it("closes before it acts", () => {
    const onClose = vi.fn();
    const onOpenSettings = vi.fn();
    const { container } = renderMenu({ onClose, onOpenSettings });
    fireEvent.click(within(container).getByText("All settings"));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it("signs out from the last row", () => {
    const onSignOut = vi.fn();
    const { container } = renderMenu({ onSignOut });
    fireEvent.click(within(container).getByText("Sign out"));
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  it("offers sign-in, not sign-out, when signed out", () => {
    const onOpenSettings = vi.fn();
    const { container } = renderMenu({ accountSession: null, accountPlan: null, avatarInitials: null, onOpenSettings });
    expect(within(container).queryByText("Sign out")).toBeNull();
    fireEvent.click(within(container).getByText("Sign in"));
    expect(onOpenSettings).toHaveBeenCalledWith("account");
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
