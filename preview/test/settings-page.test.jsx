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
  onOpenCurrency: noop,
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
  it("uses almost the full desktop height and a solid card surface", () => {
    const desktopStart = CSS.indexOf("@media (min-width: 768px) {\n  .cz-settings-page {");
    expect(desktopStart).toBeGreaterThan(-1);
    const desktop = CSS.slice(desktopStart, CSS.indexOf("\n}\n", desktopStart));
    expect(desktop).toMatch(/height:\s*calc\(100dvh - 24px\);/);
    expect(desktop).toMatch(/max-height:\s*calc\(100dvh - 24px\);/);
    // Kyle 2026-08-02: solid, not frost/translucent — frost was distracting.
    expect(desktop).toMatch(/background:\s*var\(--cz-card-solid\);/);
    expect(desktop).toMatch(/border:\s*1px solid var\(--cz-card-border, var\(--cz-hair\)\);/);
    expect(desktop).not.toContain("--cz-frost-fill");
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

  it("closes when you click the dimmed area outside the card", () => {
    const onClose = vi.fn();
    const { container } = renderPage({ onClose });
    const dialog = container.querySelector("dialog.cz-settings-page");
    expect(dialog).toBeTruthy();
    // Click on the dialog element itself = native backdrop (house pattern).
    fireEvent.click(dialog);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not close when you click inside the settings card", () => {
    const onClose = vi.fn();
    const { container } = renderPage({ onClose });
    const title = container.querySelector(".cz-settings-page-title");
    expect(title).toBeTruthy();
    fireEvent.click(title);
    expect(onClose).not.toHaveBeenCalled();
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
    const onOpenCurrency = vi.fn();
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
        onOpenCurrency,
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
    expect(onOpenCurrency).toHaveBeenCalledTimes(1);
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

  // Mobile item C / backlog item 6 (2026-08-02): sticky jump chips on phone.
  // Labels match the approved mock: Account / Sizes / Agent / Data / About.
  it("renders phone jump chips with the approved short labels", () => {
    const { container } = renderPage({ section: null, isPhone: true });
    const chips = [...container.querySelectorAll(".cz-settings-chip")].map((n) =>
      n.textContent.trim()
    );
    expect(chips).toEqual(["Account", "Sizes", "Agent", "Data", "About"]);
    const nav = container.querySelector(".cz-settings-chips");
    expect(nav).not.toBeNull();
    expect(nav.getAttribute("aria-label")).toBe("Jump to section");
    // Active chip tracks the current section (account by default).
    const active = container.querySelector(".cz-settings-chip.is-active");
    expect(active).not.toBeNull();
    expect(active.textContent.trim()).toBe("Account");
    expect(active.getAttribute("aria-current")).toBe("true");
  });

  it("does not show jump chips on desktop (rail stays)", () => {
    const { container } = renderPage({ isPhone: false });
    expect(container.querySelector(".cz-settings-chips")).toBeNull();
    expect(container.querySelector(".cz-settings-nav")).not.toBeNull();
  });

  it("chip click scrolls to the matching section", () => {
    const onNavigate = vi.fn();
    const { container } = renderPage({ isPhone: true, onNavigate });
    fireEvent.click(within(container).getByText("Sizes"));
    expect(onNavigate).toHaveBeenCalledWith("sizes");
    fireEvent.click(within(container).getByText("Agent"));
    expect(onNavigate).toHaveBeenCalledWith("shelf");
    fireEvent.click(within(container).getByText("Data"));
    expect(onNavigate).toHaveBeenCalledWith("data");
    fireEvent.click(within(container).getByText("About"));
    expect(onNavigate).toHaveBeenCalledWith("about");
  });

  it("pins chip strip styles: flex row, solid surface, pill chips", () => {
    const start = CSS.indexOf(".cz-settings-chips {");
    expect(start).toBeGreaterThan(-1);
    const block = CSS.slice(start, CSS.indexOf(".cz-settings-page-layout {", start));
    expect(block).toMatch(/display:\s*none/); // desktop default; phone media flips on
    expect(block).toMatch(/background:\s*var\(--cz-card-solid\)/);
    expect(block).toMatch(/\.cz-settings-chip\.is-active/);
    // Phone media turns chips on.
    expect(CSS).toMatch(
      /@media \(max-width:\s*767px\)[\s\S]{0,400}?\.cz-settings-chips\s*\{\s*display:\s*flex;/
    );
  });

  // Mobile item 1 free win (2026-08-02): keep page-behind still when settings
  // overscrolls. Body lock masks this today; contain makes it honest.
  it("pins overscroll-behavior contain on .cz-settings-content", () => {
    expect(CSS).toMatch(
      /\.cz-settings-content\s*\{[^}]*overscroll-behavior:\s*contain;/s
    );
  });

  // Mobile item 5 (2026-08-02): "Back to the shelf" was clipped under the
  // status bar and too small to tap. Masthead grows with safe-area; back is 44px.
  it("grows the settings masthead with safe-area so the back control is fully visible", () => {
    const start = CSS.indexOf(".cz-settings-page-masthead {");
    expect(start).toBeGreaterThan(-1);
    const block = CSS.slice(start, CSS.indexOf(".cz-settings-back {", start));
    expect(block).toMatch(
      /min-height:\s*calc\(52px \+ env\(safe-area-inset-top,\s*0px\)\)/
    );
    expect(block).toMatch(/safe-area-inset-top/);
    // Fixed height:52 was the clip: padding-top ate into it on notched phones.
    expect(block).not.toMatch(/^\s*height:\s*52px;/m);
  });

  it("pins a 44px min hit area on Back to the shelf", () => {
    const start = CSS.indexOf(".cz-settings-back {");
    expect(start).toBeGreaterThan(-1);
    const block = CSS.slice(start, CSS.indexOf(".cz-settings-back:hover", start));
    expect(block).toMatch(/min-height:\s*44px/);
  });

  it("keeps the back control reachable on a phone layout", () => {
    const onClose = vi.fn();
    const { container } = renderPage({ onClose, isPhone: true });
    const back = within(container).getByRole("button", {
      name: /Back to the shelf/i,
    });
    expect(back).toBeTruthy();
    expect(back.classList.contains("cz-settings-back")).toBe(true);
    fireEvent.click(back);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
