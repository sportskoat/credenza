import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, within } from "@testing-library/react";

import SettingsContext from "../../settings/SettingsContext.jsx";
import AccountPlanSection from "../../settings/AccountPlanSection.jsx";
import { PLAN_COPY } from "../../components/plans.js";
import { PLAN_CAPS } from "../src/usage.js";

// Account and plan — sign-in handoff README, screen 4.
//
// The rule this whole file guards: "Report where the user stands and provide
// the door. No form, no price table." The pane used to hold an email field,
// a Google button, a billing switch, two price cards and a caps table. Every
// one of those now belongs to another surface, so a test here asserts their
// absence as hard as it asserts what stayed.
//
// Numbers are bound, never typed: counters read PLAN_CAPS, and copy reads
// PLAN_COPY. A literal cap in the component fails here.

afterEach(cleanup);

const noop = () => {};

function renderSection(extra = {}) {
  const value = {
    accountEnabled: true,
    accountSession: { user: { email: "kyle@example.com" } },
    accountPlan: { state: "free" },
    limits: { kind: "free", left: 18, cap: 20 },
    onSignIn: noop,
    onOpenUpgrade: noop,
    onPortal: noop,
    onSignOut: noop,
    onDeleteAccount: noop,
    onRestorePurchase: noop,
    ...extra,
  };
  return render(
    <SettingsContext.Provider value={value}>
      <AccountPlanSection />
    </SettingsContext.Provider>
  );
}

const SIGNED_OUT = {
  accountSession: null,
  accountPlan: null,
  limits: { kind: "anon", left: 1, cap: 3 },
};

beforeEach(() => {
  window.localStorage.clear();
});

describe("Account and plan · no form, no price table", () => {
  it("holds no email field and no provider button", () => {
    const { container } = renderSection(SIGNED_OUT);
    expect(container.querySelector("input")).toBeNull();
    expect(within(container).queryByText("Continue with Google")).toBeNull();
    expect(within(container).queryByText("Email me a sign-in link")).toBeNull();
  });

  it("holds no billing switch and no price", () => {
    const { container } = renderSection();
    expect(within(container).queryByText("Weekly")).toBeNull();
    expect(within(container).queryByText("Monthly")).toBeNull();
    expect(within(container).queryByText("Yearly")).toBeNull();
    expect(container.textContent).not.toMatch(/\$2\.49|\$5\.99|\$44\.99/);
  });

  it("holds no caps table", () => {
    const { container } = renderSection();
    expect(within(container).queryByRole("table")).toBeNull();
    expect(within(container).queryByText("AI chart reads")).toBeNull();
    expect(within(container).queryByText("QC photos")).toBeNull();
  });

  it("never calls any tier unlimited", () => {
    const { container } = renderSection(SIGNED_OUT);
    expect(container.textContent).not.toMatch(/unlimited/i);
  });
});

describe("Account and plan · signed out", () => {
  it("says where you stand and links to both doors", () => {
    const { container } = renderSection(SIGNED_OUT);
    expect(within(container).getByText("You are signed out.")).toBeTruthy();
    expect(within(container).getByText(PLAN_COPY.settingsSignedOutBody)).toBeTruthy();
    expect(within(container).getByText("Signed out · this device only")).toBeTruthy();
    expect(within(container).getByText("Free · $0 · no card, no trial clock")).toBeTruthy();
  });

  it("opens the sign-in modal from the account row", () => {
    const onSignIn = vi.fn();
    const { container } = renderSection({ ...SIGNED_OUT, onSignIn });
    fireEvent.click(within(container).getByText("Sign in"));
    expect(onSignIn).toHaveBeenCalledTimes(1);
  });

  it("opens the upgrade route from the plan row", () => {
    const onOpenUpgrade = vi.fn();
    const { container } = renderSection({ ...SIGNED_OUT, onOpenUpgrade });
    fireEvent.click(within(container).getByText("See what Pro changes"));
    expect(onOpenUpgrade).toHaveBeenCalledTimes(1);
  });

  // The counter is a projection of the live limit, never a stored copy. A
  // stored copy goes stale the moment a card resolves.
  it("counts today off the live limit and flags it local", () => {
    const { container } = renderSection(SIGNED_OUT);
    expect(within(container).getByText("2 of 3 cards · resets at midnight")).toBeTruthy();
    expect(within(container).getByText("LOCAL")).toBeTruthy();
  });

  it("carries the closing note", () => {
    const { container } = renderSection(SIGNED_OUT);
    expect(within(container).getByText(/both moved to their own surface/)).toBeTruthy();
  });

  it("offers no sign-out and no delete when nobody is signed in", () => {
    const { container } = renderSection(SIGNED_OUT);
    expect(within(container).queryByText("Sign out")).toBeNull();
    expect(within(container).queryByText("Delete account")).toBeNull();
  });
});

describe("Account and plan · signed in on Free", () => {
  it("shows the address and the upgrade door", () => {
    const { container } = renderSection();
    expect(within(container).getByText("Signed in. You are on Free.")).toBeTruthy();
    expect(within(container).getByText("kyle@example.com")).toBeTruthy();
    expect(within(container).getByText("Free · $0")).toBeTruthy();
    expect(within(container).getByText("See what Pro changes")).toBeTruthy();
  });

  it("counts today against the free caps", () => {
    const { container } = renderSection();
    expect(
      within(container).getByText(
        "0 of " + PLAN_CAPS.free.chartVisionPerDay + " chart reads · 0 of " +
          PLAN_CAPS.free.resolvePerDay + " cards"
      )
    ).toBeTruthy();
    expect(within(container).getByText("FREE CAPS")).toBeTruthy();
  });

  it("signs out", () => {
    const onSignOut = vi.fn();
    const { container } = renderSection({ onSignOut });
    fireEvent.click(within(container).getByText("Sign out"));
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  it("restores a purchase made on another device", () => {
    const onRestorePurchase = vi.fn();
    const { container } = renderSection({ onRestorePurchase });
    fireEvent.click(within(container).getByText("Restore purchase"));
    expect(onRestorePurchase).toHaveBeenCalledTimes(1);
  });

  it("arms delete account on the first tap and deletes on the second", () => {
    const onDeleteAccount = vi.fn();
    const { container } = renderSection({ onDeleteAccount });
    fireEvent.click(within(container).getByText("Delete account"));
    expect(onDeleteAccount).not.toHaveBeenCalled();
    expect(within(container).getByText("No undo. Your shelf stays on this device.")).toBeTruthy();
    fireEvent.click(within(container).getByText("Tap again to delete your account"));
    expect(onDeleteAccount).toHaveBeenCalledTimes(1);
  });
});

describe("Account and plan · signed in on Pro", () => {
  const PRO = { accountPlan: { state: "pro" }, limits: null };

  it("says Pro is on and drops the upgrade door", () => {
    const { container } = renderSection(PRO);
    expect(within(container).getByText("Signed in. Pro is on.")).toBeTruthy();
    expect(within(container).getByText("PRO")).toBeTruthy();
    expect(within(container).queryByText("See what Pro changes")).toBeNull();
  });

  // limitStatus() returns null for a Pro member, so the Pro counter cannot
  // read `limits`. It reads the live usage against PLAN_CAPS.pro instead.
  it("counts today against the pro caps with no limits object", () => {
    const { container } = renderSection(PRO);
    expect(
      within(container).getByText(
        "0 of " + PLAN_CAPS.pro.chartVisionPerDay + " chart reads · 0 of " +
          PLAN_CAPS.pro.resolvePerDay + " cards"
      )
    ).toBeTruthy();
    expect(within(container).getByText("PRO CAPS")).toBeTruthy();
  });

  it("opens the Stripe portal and says who holds the card number", () => {
    const onPortal = vi.fn();
    const { container } = renderSection({ ...PRO, onPortal });
    fireEvent.click(within(container).getByText("Manage billing"));
    expect(onPortal).toHaveBeenCalledTimes(1);
    expect(within(container).getByText(/Credenza never sees your card number/)).toBeTruthy();
  });

  // No renewal date and no device count reach this device. The signed
  // entitlement carries { sub, plan, state, lim, exp, graceUntil } and
  // nothing else, so neither row can be drawn without inventing a number.
  it("invents no renewal date and no device count", () => {
    const { container } = renderSection(PRO);
    expect(container.textContent).not.toMatch(/renews/i);
    expect(within(container).queryByText("Devices")).toBeNull();
  });

  it("says when a payment did not go through", () => {
    const { container } = renderSection({ accountPlan: { state: "grace" }, limits: null });
    expect(within(container).getByText("Pro · a payment did not go through")).toBeTruthy();
  });
});

describe("Account and plan · accounts off", () => {
  it("says when accounts are off in this build", () => {
    const { container } = renderSection({
      accountEnabled: false,
      accountSession: null,
      accountPlan: null,
      limits: null,
    });
    expect(within(container).getByText("Accounts are off in this build")).toBeTruthy();
    expect(within(container).queryByText("Sign in")).toBeNull();
    expect(within(container).queryByText("See what Pro changes")).toBeNull();
  });
});
