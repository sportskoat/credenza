// Feature 2 · the upgrade route.
// Sign-in handoff README, screen 3. The two rules that must never break, plus
// the price wiring, plus the return trip through sign-in.
import { describe, it, expect, afterEach, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import UpgradePage from "../../components/UpgradePage.jsx";
import { PRICING } from "../../credenza-fashion.jsx";
import { PLAN_ROWS } from "../../components/plans.js";

afterEach(cleanup);

function open(props = {}) {
  const onStart = props.onStart || vi.fn().mockResolvedValue(undefined);
  const onClose = props.onClose || vi.fn();
  const utils = render(
    <UpgradePage onStart={onStart} onClose={onClose} {...props} />,
  );
  return { ...utils, onStart, onClose };
}

describe("upgrade route · the two hard rules", () => {
  it("never asks for a card number", () => {
    open();
    expect(screen.queryByLabelText(/card number/i)).toBeNull();
    expect(document.querySelectorAll("input")).toHaveLength(0);
  });

  it("tells a signed-out person that sign-in comes first", () => {
    open({ signedIn: false });
    expect(
      screen.getByText(/The button opens the sign-in window/),
    ).toBeInTheDocument();
  });

  it("drops that line once the person is signed in", () => {
    open({ signedIn: true });
    expect(screen.queryByText(/The button opens the sign-in window/)).toBeNull();
  });
});

describe("upgrade route · prices", () => {
  it("opens on weekly and shows the weekly price", () => {
    open();
    expect(screen.getByText(PRICING.weekly)).toBeInTheDocument();
    expect(screen.getByText("a week")).toBeInTheDocument();
  });

  it("swaps the figure when the billing period changes", async () => {
    const user = userEvent.setup();
    open();
    await user.click(screen.getByRole("radio", { name: "Yearly" }));
    await waitFor(() =>
      expect(screen.getByText(PRICING.yearly)).toBeInTheDocument(),
    );
    expect(screen.getByText("a year")).toBeInTheDocument();
    expect(screen.queryByText(PRICING.weekly)).toBeNull();
  });

  it("promises free days on the weekly plan only", async () => {
    const user = userEvent.setup();
    open();
    expect(screen.getAllByText(new RegExp(PRICING.weeklyTrial)).length).toBeGreaterThan(0);
    await user.click(screen.getByRole("radio", { name: "Monthly" }));
    await waitFor(() =>
      expect(screen.getByText(PRICING.monthly)).toBeInTheDocument(),
    );
    expect(screen.queryByText(new RegExp(PRICING.weeklyTrial))).toBeNull();
  });

  it("restores the period a sign-in round trip carried back", () => {
    open({ period: "yearly" });
    expect(screen.getByText(PRICING.yearly)).toBeInTheDocument();
  });

  it("names the billing period control for a screen reader", () => {
    open();
    expect(
      screen.getByRole("radiogroup", { name: "Billing period" }),
    ).toBeInTheDocument();
  });
});

describe("upgrade route · what changes", () => {
  it("prints every row from the shared plan table", () => {
    open();
    for (const row of PLAN_ROWS) {
      expect(screen.getByText(row.label)).toBeInTheDocument();
    }
  });

  it("never calls the free plan unlimited", () => {
    const { container } = open();
    expect(container.textContent).not.toMatch(/unlimited/i);
  });
});

describe("upgrade route · standing", () => {
  it("reads the plan off the props, so it can never disagree", () => {
    const { unmount } = open({ signedIn: false });
    expect(screen.getByText("Signed out · Free")).toBeInTheDocument();
    unmount();
    open({ signedIn: true, isPro: false });
    expect(screen.getByText("Signed in · Free")).toBeInTheDocument();
  });

  it("shows Pro standing to a subscriber", () => {
    open({ signedIn: true, isPro: true });
    expect(screen.getByText("Signed in · Pro")).toBeInTheDocument();
  });
});

describe("upgrade route · the button", () => {
  it("hands the chosen period to the caller", async () => {
    const user = userEvent.setup();
    const { onStart } = open();
    await user.click(screen.getByRole("radio", { name: "Monthly" }));
    await user.click(screen.getByRole("button", { name: /Upgrade to Pro/ }));
    await waitFor(() => expect(onStart).toHaveBeenCalledWith("monthly"));
  });

  it("leaves by the back link", async () => {
    const user = userEvent.setup();
    const { onClose } = open();
    await user.click(screen.getByRole("button", { name: "Back to the shelf" }));
    expect(onClose).toHaveBeenCalled();
  });
});
