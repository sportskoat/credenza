import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, within } from "@testing-library/react";

import SettingsPage from "../../settings/SettingsPage.jsx";
import { SETTINGS_SECTIONS } from "../../settings/SettingsNav.jsx";

// The routed settings page (Profile Settings design). The design rule:
// anything with a back button, a form, or a destructive action gets a URL.
// These tests assert the page's structure: six sections in the rail, one
// active at a time, a way back to the shelf, and Escape parity with the
// sheets it replaces.

afterEach(cleanup);

const noop = () => {};

const VALUE = {
  accountEnabled: false,
  accountSession: null,
  accountPlan: null,
  onMagicLink: noop,
  onGoogle: noop,
  onUpgrade: noop,
  onPortal: noop,
  onSignOut: noop,
  onDeleteAccount: noop,
  onRestorePurchase: noop,
};

function renderPage(extra = {}) {
  return render(
    <SettingsPage
      section="account"
      onNavigate={noop}
      onClose={noop}
      value={VALUE}
      isPhone={false}
      {...extra}
    />
  );
}

describe("SettingsPage (routed settings)", () => {
  it("lists the design's six sections in order", () => {
    const { container } = renderPage();
    const items = [...container.querySelectorAll(".cz-settings-nav-item")].map((n) =>
      n.textContent.trim()
    );
    expect(items).toEqual([
      "Account and plan",
      "Sizes and measurements",
      "Fit preferences",
      "Shelf defaults",
      "Your data",
      "About and support",
    ]);
    expect(SETTINGS_SECTIONS).toHaveLength(6);
  });

  it("marks the current section active and navigates on click", () => {
    const onNavigate = vi.fn();
    const { container } = renderPage({ onNavigate });
    const active = container.querySelector(".cz-settings-nav-item.is-active");
    expect(active.textContent).toContain("Account and plan");
    expect(active.getAttribute("aria-current")).toBe("page");
    fireEvent.click(within(container).getByText("Fit preferences"));
    expect(onNavigate).toHaveBeenCalledWith("fit");
  });

  it("offers the way back to the shelf", () => {
    const onClose = vi.fn();
    const { container } = renderPage({ onClose });
    fireEvent.click(within(container).getByText("Back to the shelf"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape, like the sheets it replaces", () => {
    const onClose = vi.fn();
    renderPage({ onClose });
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders the Account and plan section for the account route", () => {
    const { container } = renderPage();
    expect(within(container).getByText("Free is the whole app. Pro is more of it.")).toBeTruthy();
  });

  it("renders a real section for every route (Phase 4 — the stubs are gone)", () => {
    // Section head, not the rail label — both carry the same words.
    const heads = {
      account: "Free is the whole app. Pro is more of it.",
      sizes: "Sizes and measurements",
      fit: "Fit preferences",
      shelf: "Shelf defaults",
      data: "Your data",
      about: "About and support",
    };
    for (const [section, head] of Object.entries(heads)) {
      const { container, unmount } = renderPage({ section });
      const found = container.querySelector(".cz-settings-content .cz-settings-section-head");
      expect(found && found.textContent, `no section body for ${section}`).toBe(head);
      expect(container.textContent).not.toContain("on its way");
      unmount();
    }
  });

  it("shelf defaults rows work — each flips or opens its switch (Kyle 2026-07-28)", () => {
    // Design 1e made this section read-only; Kyle overrode it ("you can't
    // toggle any of those on or off"). Every row must call its handler.
    const onOpenAgent = vi.fn();
    const onCycleCurrency = vi.fn();
    const onToggleFitSummary = vi.fn();
    const onCycleFitDetail = vi.fn();
    const { container } = renderPage({
      section: "shelf",
      value: {
        ...VALUE,
        agentLabel: "Superbuy",
        pricePrimary: "USD",
        fitSummary: true,
        fitDetail: "concise",
        onOpenAgent,
        onCycleCurrency,
        onToggleFitSummary,
        onCycleFitDetail,
      },
    });
    const content = container.querySelector(".cz-settings-content");
    expect(within(content).getByText("Default agent")).toBeTruthy();
    expect(within(content).getByText("Superbuy")).toBeTruthy();
    const row = (label) => within(content).getByText(label).closest("button");
    fireEvent.click(row("Default agent"));
    expect(onOpenAgent).toHaveBeenCalledTimes(1);
    fireEvent.click(row("Primary currency"));
    expect(onCycleCurrency).toHaveBeenCalledTimes(1);
    fireEvent.click(row("Fit summary"));
    expect(onToggleFitSummary).toHaveBeenCalledTimes(1);
    fireEvent.click(row("Fit detail"));
    expect(onCycleFitDetail).toHaveBeenCalledTimes(1);
  });

  it("on a phone with no section picked, the list IS the page", () => {
    const onNavigate = vi.fn();
    const { container } = renderPage({ section: null, isPhone: true, onNavigate });
    expect(container.querySelector(".cz-settings-content .cz-settings-nav")).not.toBeNull();
    fireEvent.click(within(container).getByText("Account and plan"));
    expect(onNavigate).toHaveBeenCalledWith("account");
  });

  it("on a phone inside a section, a back row returns to the list", () => {
    const onNavigate = vi.fn();
    const { container } = renderPage({ section: "account", isPhone: true, onNavigate });
    fireEvent.click(within(container).getByText("Settings", { selector: ".cz-settings-back-section" }));
    expect(onNavigate).toHaveBeenCalledWith(null);
  });
});
