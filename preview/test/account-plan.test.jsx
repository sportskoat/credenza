import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor, within } from "@testing-library/react";

import SettingsContext from "../../settings/SettingsContext.jsx";
import AccountPlanSection from "../../settings/AccountPlanSection.jsx";
import { PRICING } from "../../credenza-fashion.jsx";
import { PLAN_CAPS } from "../src/usage.js";

// Account and plan (Profile Settings design 1f). The screen sells Pro with
// real numbers, so the tests bind every number to its source: prices to the
// PRICING export, caps to PLAN_CAPS (which plan-limits.test.js binds to the
// server). A literal price or cap in the component fails here.

afterEach(cleanup);

const noop = () => {};

function renderSection(extra = {}) {
  const value = {
    accountEnabled: true,
    accountSession: { user: { email: "kyle@example.com" } },
    accountPlan: { state: "free" },
    onMagicLink: noop,
    onGoogle: noop,
    onUpgrade: noop,
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

describe("Account and plan screen (design 1f)", () => {
  it("states the pitch and the signed-in identity", () => {
    const { container } = renderSection();
    expect(within(container).getByText("Free is the whole app. Pro is more of it.")).toBeTruthy();
    expect(within(container).getByText(/You are on Free as kyle@example\.com/)).toBeTruthy();
    expect(within(container).getByText(/Nothing on your shelf is locked/)).toBeTruthy();
  });

  it("marks Free as the current plan on a free account", () => {
    const { container } = renderSection();
    const freeCard = within(container).getByText("Free", { selector: ".cz-account-plan-name" })
      .closest(".cz-account-plan-card");
    expect(within(freeCard).getByText("Your plan")).toBeTruthy();
    expect(within(freeCard).getByText("$0")).toBeTruthy();
    expect(within(freeCard).getByText(/No card, no trial clock/)).toBeTruthy();
  });

  it("defaults to weekly and shows the trial terms next to the start button", () => {
    const { container } = renderSection();
    // FTC negative-option: free days + after-trial price + cadence, adjacent
    // to the button that starts the trial.
    expect(within(container).getByText("Start " + PRICING.weeklyTrial)).toBeTruthy();
    expect(within(container).getByText(PRICING.weeklyTrialNote + ".")).toBeTruthy();
    expect(within(container).getByText(PRICING.weekly)).toBeTruthy();
    expect(within(container).getByText(PRICING.weeklyTrial)).toBeTruthy(); // the badge
  });

  it("updates the price, badge and equivalent when billing switches", () => {
    const { container } = renderSection();
    fireEvent.click(within(container).getByText("Yearly"));
    expect(within(container).getByText(PRICING.yearly)).toBeTruthy();
    expect(within(container).getByText(PRICING.yearlySaving)).toBeTruthy();
    expect(within(container).getByText(PRICING.yearlyPerMonth + ", billed yearly.")).toBeTruthy();

    fireEvent.click(within(container).getByText("Monthly"));
    expect(within(container).getByText(PRICING.monthly)).toBeTruthy();
    expect(within(container).getByText("Billed monthly. Cancel any time.")).toBeTruthy();
  });

  it("prints the caps table from PLAN_CAPS, not from the design's mock numbers", () => {
    const { container } = renderSection();
    const table = within(container).getByRole("table", { name: "What changes with Pro" });
    // Handoff 2026-08-01: no "Ask questions" row on purpose.
    expect(within(table).queryByText(/Ask questions/i)).toBeNull();
    expect(within(table).getByText(PLAN_CAPS.free.chartVisionPerDay + " a day")).toBeTruthy();
    expect(within(table).getByText(PLAN_CAPS.pro.chartVisionPerDay + " a day")).toBeTruthy();
    expect(within(table).getByText(PLAN_CAPS.free.resolvePerDay + " a day")).toBeTruthy();
    expect(within(table).getByText(PLAN_CAPS.pro.resolvePerDay + " a day")).toBeTruthy();
    expect(within(table).getByText(PLAN_CAPS.free.qcPhotosPerItem + " an item")).toBeTruthy();
    expect(within(table).getByText(PLAN_CAPS.pro.qcPhotosPerItem + " an item")).toBeTruthy();
    expect(within(table).getByText(PLAN_CAPS.free.haulsMax + " at once")).toBeTruthy();
    expect(within(table).getByText(PLAN_CAPS.pro.haulsMax + " at once")).toBeTruthy();
    expect(within(table).getByText(PLAN_CAPS.free.sharedLinksMax + " live")).toBeTruthy();
    expect(within(table).getByText(PLAN_CAPS.pro.sharedLinksMax + " live")).toBeTruthy();
    // The design doc's illustrative numbers were wrong. None of them belong
    // on this screen.
    expect(within(table).queryByText(/200/)).toBeNull();
  });

  it("keeps the facts that are not caps", () => {
    const { container } = renderSection();
    expect(within(container).getByText("Export a .csv")).toBeTruthy();
    expect(within(container).getByText("Cards on the shelf")).toBeTruthy();
    expect(within(container).getByText(".json backup and restore")).toBeTruthy();
  });

  it("discloses the referral money inline", () => {
    const { container } = renderSection();
    expect(within(container).getByText("What Pro does not change")).toBeTruthy();
    expect(
      within(container).getByText(
        /Some agent links carry a referral code that funds the app\. It never changes your price\./
      )
    ).toBeTruthy();
  });

  it("states the cancel and refund terms", () => {
    const { container } = renderSection();
    expect(
      within(container).getByText(/Cancel any time from this page\. Refund within 14 days/)
    ).toBeTruthy();
    expect(within(container).getByText("Restore purchase")).toBeTruthy();
    expect(within(container).getByText("Billing history")).toBeTruthy();
  });

  it("calls restore purchase and billing history handlers", async () => {
    const onRestorePurchase = vi.fn();
    const onPortal = vi.fn();
    const { container } = renderSection({ onRestorePurchase, onPortal });
    fireEvent.click(within(container).getByText("Restore purchase"));
    expect(onRestorePurchase).toHaveBeenCalledTimes(1);
    // run() holds the busy flag until the handler settles; the next button
    // stays disabled until then.
    await waitFor(() =>
      expect(within(container).getByText("Billing history").closest("button").disabled).toBe(false)
    );
    fireEvent.click(within(container).getByText("Billing history"));
    expect(onPortal).toHaveBeenCalledTimes(1);
  });

  it("upgrades with the selected billing period", () => {
    const onUpgrade = vi.fn();
    const { container } = renderSection({ onUpgrade });
    fireEvent.click(within(container).getByText("Start " + PRICING.weeklyTrial));
    expect(onUpgrade).toHaveBeenCalledWith("weekly");
  });

  it("shows Manage billing, not upgrade copy, to a Pro member", () => {
    const { container } = renderSection({ accountPlan: { state: "pro" } });
    expect(within(container).getByText("Manage billing")).toBeTruthy();
    expect(within(container).queryByText(/Start 3 days free/)).toBeNull();
    expect(within(container).getByText(/You are on Pro as kyle@example\.com/)).toBeTruthy();
  });

  it("arms delete account on the first tap and deletes on the second", () => {
    const onDeleteAccount = vi.fn();
    const { container } = renderSection({ onDeleteAccount });
    fireEvent.click(within(container).getByText("Delete account"));
    expect(onDeleteAccount).not.toHaveBeenCalled();
    fireEvent.click(within(container).getByText("Tap again to delete your account"));
    expect(onDeleteAccount).toHaveBeenCalledTimes(1);
  });

  it("shuts the upgrade button when signed out and shows sign-in instead", () => {
    const onUpgrade = vi.fn();
    const { container } = renderSection({ accountSession: null, onUpgrade });
    expect(within(container).getByText("Sign in to Credenza")).toBeTruthy();
    expect(within(container).getByText("Sign in above to upgrade.")).toBeTruthy();
    const start = within(container).getByText("Start " + PRICING.weeklyTrial).closest("button");
    expect(start.disabled).toBe(true);
    fireEvent.click(start);
    expect(onUpgrade).not.toHaveBeenCalled();
  });

  it("says when accounts are off in this build", () => {
    const { container } = renderSection({ accountEnabled: false, accountSession: null });
    expect(within(container).getByText("Accounts are off in this build")).toBeTruthy();
  });
});
