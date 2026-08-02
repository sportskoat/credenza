import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import SettingsPage from "../../settings/SettingsPage.jsx";
import { SETTINGS_SECTIONS } from "../../settings/SettingsNav.jsx";

// Settings redesign 2026-08-01: one scrolling page, five sections (fit folds
// into sizes), scroll-spy rail on desktop, stacked column on phone.

afterEach(cleanup);

const noop = () => {};
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const CSS = readFileSync(join(ROOT, "credenza-fashion.css"), "utf8");

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
  bodyProfile: null,
  measureUnits: "in",
  onSaveBodyProfile: noop,
  onChangeUnits: noop,
  fitPrefs: {},
  onSaveFitPrefs: noop,
  agentLabel: "Direct",
  pricePrimary: "USD",
  fitSummary: true,
  fitDetail: "detailed",
  onOpenAgent: noop,
  onCycleCurrency: noop,
  onToggleFitSummary: noop,
  onCycleFitDetail: noop,
  items: [],
  onImport: noop,
  onExport: noop,
  onExportCsv: noop,
  isPro: false,
  onClearShelf: noop,
  onRestore: noop,
  storageLabel: "Plenty of room",
  storageColor: "#22c55e",
  onEraseData: noop,
  sharedLinks: null,
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

describe("SettingsPage (one-page redesign)", () => {
  it("uses almost the full desktop height and the shared frost surface", () => {
    const desktopStart = CSS.indexOf("@media (min-width: 768px) {\n  .cz-settings-page {");
    expect(desktopStart).toBeGreaterThan(-1);
    const desktop = CSS.slice(desktopStart, CSS.indexOf("\n}\n", desktopStart));
    expect(desktop).toMatch(/height:\s*calc\(100dvh - 24px\);/);
    expect(desktop).toMatch(/max-height:\s*calc\(100dvh - 24px\);/);
    expect(desktop).toMatch(/background:\s*var\(--cz-frost-fill\);/);
    expect(desktop).toMatch(/border:\s*1px solid var\(--cz-frost-border\);/);
    expect(desktop).not.toContain("backdrop-filter:");
  });

  it("lists the five sections in order (fit folded into sizes)", () => {
    const { container } = renderPage();
    const items = [...container.querySelectorAll(".cz-settings-nav-item")].map((n) =>
      n.querySelector(".cz-settings-nav-label")
        ? n.querySelector(".cz-settings-nav-label").textContent.trim()
        : n.textContent.trim()
    );
    expect(items).toEqual([
      "Account and plan",
      "Sizes and measurements",
      "Shelf defaults",
      "Your data",
      "About and support",
    ]);
    expect(SETTINGS_SECTIONS).toHaveLength(5);
  });

  it("marks the current section active and scrolls on rail click", () => {
    const onNavigate = vi.fn();
    const { container } = renderPage({ onNavigate });
    const active = container.querySelector(".cz-settings-nav-item.is-active");
    expect(active.textContent).toContain("Account and plan");
    expect(active.getAttribute("aria-current")).toBe("page");
    fireEvent.click(within(container).getByText("Sizes and measurements"));
    expect(onNavigate).toHaveBeenCalledWith("sizes");
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

  it("renders every section into one scroll column", () => {
    const { container } = renderPage();
    const heads = [...container.querySelectorAll(".cz-settings-section-head")].map((n) =>
      n.textContent.trim()
    );
    expect(heads).toEqual([
      "Free is the whole app. Pro is more of it.",
      "Sizes and measurements.",
      "Shelf defaults.",
      "Your data.",
      "About and support.",
    ]);
    expect(container.querySelectorAll("[data-settings-section]")).toHaveLength(5);
  });

  it("maps the old fit deep link onto sizes", () => {
    const { container } = renderPage({ section: "fit" });
    const active = container.querySelector(".cz-settings-nav-item.is-active");
    expect(active.textContent).toContain("Sizes and measurements");
  });

  it("scrolls the content column on first open for a non-account deep link", async () => {
    // active is seeded from the URL, so a naive "only scroll when active
    // changes" path never jumps — scrollTop stays 0 while the rail is right.
    const scrollTo = vi.fn();
    const prev = Element.prototype.scrollTo;
    Element.prototype.scrollTo = scrollTo;
    try {
      const { container } = renderPage({ section: "sizes" });
      const active = container.querySelector(".cz-settings-nav-item.is-active");
      expect(active.textContent).toContain("Sizes and measurements");
      await waitFor(() => {
        expect(scrollTo).toHaveBeenCalled();
      });
      const call = scrollTo.mock.calls.find((c) => c[0] && typeof c[0].top === "number");
      expect(call, "scrollTo was called with a top offset").toBeTruthy();
    } finally {
      Element.prototype.scrollTo = prev;
    }
  });

  it("does not force-scroll on first open for the default account section", async () => {
    // Account is already at the top. A forced jump used dialog-relative
    // offsetTop and clipped the green kicker into the title (smudge).
    const scrollTo = vi.fn();
    const prev = Element.prototype.scrollTo;
    Element.prototype.scrollTo = scrollTo;
    try {
      const { container } = renderPage({ section: "account" });
      const active = container.querySelector(".cz-settings-nav-item.is-active");
      expect(active.textContent).toContain("Account and plan");
      // One frame for the deep-link effect, plus a tick so a mistaken jump
      // would have fired scrollTo.
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      expect(scrollTo).not.toHaveBeenCalled();
    } finally {
      Element.prototype.scrollTo = prev;
    }
  });

  it("shelf defaults rows work — each flips or opens its switch", () => {
    const onOpenAgent = vi.fn();
    const onCycleCurrency = vi.fn();
    const onToggleFitSummary = vi.fn();
    const onCycleFitDetail = vi.fn();
    const { container } = renderPage({
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

  it("on a phone, the rail is gone and every section is in the column", () => {
    const { container } = renderPage({ section: null, isPhone: true });
    expect(container.querySelector(".cz-settings-nav")).toBeNull();
    expect(container.querySelectorAll("[data-settings-section]")).toHaveLength(5);
  });
});
