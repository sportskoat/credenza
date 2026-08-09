import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cleanup, render, waitFor, within } from "@testing-library/react";

import SettingsContext from "../../settings/SettingsContext.jsx";
import YourDataSection from "../../settings/YourDataSection.jsx";
import BodyProfileSheet from "../../sheets/BodyProfileSheet.jsx";

// Settings redesign 2026-08-01. Groups live in hairline cards. Sizes uses
// body/garment dual storage with SVG tape diagrams.

afterEach(cleanup);

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CSS = fs.readFileSync(path.resolve(HERE, "../../credenza-fashion.css"), "utf8");

function ruleBody(selector) {
  const clean = CSS.replace(/\/\*[\s\S]*?\*\//g, "");
  const at = clean.indexOf(selector + " {");
  if (at < 0) return "";
  return clean.slice(at, clean.indexOf("}", at));
}

const noop = () => {};

const DATA_VALUE = {
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
  accountEnabled: false,
  accountSession: null,
};

function renderData() {
  return render(
    <SettingsContext.Provider value={DATA_VALUE}>
      <YourDataSection />
    </SettingsContext.Provider>
  );
}

describe("Settings sections keep the named groups", () => {
  it("shows IMPORT and OUT labels over the data blocks", () => {
    const { container } = renderData();
    const labels = [...container.querySelectorAll(".cz-settings-card-label")].map((n) =>
      n.textContent.trim()
    );
    expect(labels).toContain("IMPORT");
    expect(labels).toContain("OUT");
  });

  it("puts option rows inside hairline cards", () => {
    const { container } = renderData();
    const rows = [...container.querySelectorAll(".cz-settings-row-btn")];
    expect(rows.length).toBeGreaterThan(1);
    for (const row of rows) {
      expect(
        row.closest(".cz-settings-card"),
        `row "${row.textContent.trim()}" is not inside a card`
      ).not.toBeNull();
    }
  });

  it("the card is a hairline surface (redesign recipe)", () => {
    const body = ruleBody(".cz-settings-card");
    expect(body).toMatch(/border:\s*1px solid var\(--cz-hair\)/);
    expect(body).toMatch(/border-radius:\s*14px/);
  });

  it("stacks sizes groups on the settings content width, not the window", () => {
    // Floating settings card is ~682px on a wide monitor — a viewport
    // max-width: 900px rule never fires, so Bottoms fields overflow.
    expect(CSS).toMatch(/container-name:\s*cz-settings/);
    expect(CSS).toMatch(/@container\s+cz-settings\s*\(\s*max-width:\s*900px\s*\)/);
  });

  it("keeps the danger row with the data it erases", () => {
    const { container } = renderData();
    const erase = within(container).getByText("Erase my data").closest(".cz-settings-row-btn");
    const card = erase.closest(".cz-settings-card");
    expect(within(card).getByText("Storage")).toBeTruthy();
  });
});

describe("Sizes and measurements redesign (settings page)", () => {
  const renderMeasure = (props = {}) =>
    render(
      <BodyProfileSheet
        value={null}
        units="in"
        onSave={noop}
        onChangeUnits={noop}
        onClose={noop}
        embedded
        {...props}
      />
    );

  const measureInput = (container, name) => {
    const label = [...container.querySelectorAll(".cz-sizes-row-label")].find(
      (n) => n.textContent.trim().toLowerCase() === name.toLowerCase()
    );
    expect(label, "no row label for " + name).toBeTruthy();
    return label.closest(".cz-sizes-row").querySelector("input");
  };

  it("puts usual sizes in a strip at the top", () => {
    const { container } = renderMeasure();
    expect(within(container).getByText("USUAL SIZES")).toBeTruthy();
    expect(container.querySelector(".cz-sizes-usual-strip")).toBeTruthy();
  });

  it("splits tops and bottoms as diagram + field groups", () => {
    const { container } = renderMeasure();
    const labels = [...container.querySelectorAll(".cz-sizes-group-label")].map((n) =>
      n.textContent.trim()
    );
    // Loved Jacket (debate 2026-08-08, stage 5): a third card, no diagram.
    expect(labels).toEqual(["TOPS", "BOTTOMS", "LOVED JACKET"]);
    expect(container.querySelectorAll(".cz-sizes-diagram")).toHaveLength(2);
    expect(container.querySelectorAll(".cz-sizes-tape")).toHaveLength(9);
  });

  it("tapes the loved jacket and saves it with the profile", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    const onSave = vi.fn();
    const { container } = render(
      <BodyProfileSheet
        value={{ chest: 100 }}
        units="cm"
        onSave={onSave}
        onChangeUnits={noop}
        onClose={noop}
        embedded
      />
    );
    await user.type(within(container).getByLabelText("Which jacket"), "Carhartt Detroit · M");
    await user.type(within(container).getByLabelText("Loved jacket chest, flat"), "56.5");
    await waitFor(
      () => {
        expect(onSave).toHaveBeenCalled();
        const saved = onSave.mock.calls[onSave.mock.calls.length - 1][0];
        expect(saved.lovedJacket).toEqual({ name: "Carhartt Detroit · M", chest: 56.5 });
        expect(saved.chest).toBe(100);
      },
      { timeout: 1500 }
    );
  });

  it("drops the loved jacket when every box is cleared", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    const onSave = vi.fn();
    const { container } = render(
      <BodyProfileSheet
        value={{ chest: 100, lovedJacket: { chest: 56.5 } }}
        units="cm"
        onSave={onSave}
        onChangeUnits={noop}
        onClose={noop}
        embedded
      />
    );
    // The saved number pre-fills its box.
    expect(within(container).getByLabelText("Loved jacket chest, flat")).toHaveValue("56.5");
    await user.clear(within(container).getByLabelText("Loved jacket chest, flat"));
    await waitFor(
      () => {
        expect(onSave).toHaveBeenCalled();
        const saved = onSave.mock.calls[onSave.mock.calls.length - 1][0];
        expect(saved.lovedJacket).toBeUndefined();
        expect(saved.chest).toBe(100);
      },
      { timeout: 1500 }
    );
  });

  // Kyle 2026-08-04: garment mode is parked. Body labels are the only set.
  it("defaults to body mode labels (chest, not pit to pit)", () => {
    const { container } = renderMeasure();
    expect(measureInput(container, "Chest")).toBeTruthy();
    expect(within(container).queryByText("WHICH TOP")).toBeNull();
    expect(within(container).queryByRole("radio", { name: "Your body" })).toBeNull();
    expect(within(container).queryByRole("radio", { name: "A garment that fits" })).toBeNull();
  });

  // Kyle 2026-08-04 parked the garment switch "for now" — the numbers people
  // already saved must survive every later save, or the switch can never
  // come back without data loss.
  it("keeps saved garment numbers in the payload with the switch gone", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    const onSave = vi.fn();
    const { container } = render(
      <BodyProfileSheet
        value={{ chest: 100, garment: { chest: 54 }, garmentTop: "Uniqlo U tee · L" }}
        units="cm"
        onSave={onSave}
        onChangeUnits={noop}
        onClose={noop}
        embedded
      />
    );
    const chest = measureInput(container, "Chest");
    await user.clear(chest);
    await user.type(chest, "104");
    await waitFor(
      () => {
        expect(onSave).toHaveBeenCalled();
        const saved = onSave.mock.calls[onSave.mock.calls.length - 1][0];
        expect(saved.chest).toBe(104);
        expect(saved.garment).toEqual({ chest: 54 });
        expect(saved.garmentTop).toBe("Uniqlo U tee · L");
      },
      { timeout: 1500 }
    );
  });

  it("auto-saves body measures and keeps usual sizes", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    const onSave = vi.fn();
    const { container } = render(
      <BodyProfileSheet
        value={{ chest: 100, usualTops: "L" }}
        units="cm"
        onSave={onSave}
        onChangeUnits={noop}
        onClose={noop}
        embedded
      />
    );
    const chest = measureInput(container, "Chest");
    await user.clear(chest);
    await user.type(chest, "104");
    await waitFor(
      () => {
        expect(onSave).toHaveBeenCalled();
        const saved = onSave.mock.calls[onSave.mock.calls.length - 1][0];
        expect(saved.chest).toBe(104);
        expect(saved.measureMode).toBe("body");
        expect(saved.usualTops).toBe("L");
      },
      { timeout: 1500 }
    );
  });

  it("counts filled measure fields without height and weight", () => {
    const { container } = render(
      <BodyProfileSheet
        value={{ height: 178, weight: 70, chest: 96, garment: { chest: 54 } }}
        units="cm"
        onSave={noop}
        onChangeUnits={noop}
        onClose={noop}
        embedded
      />
    );
    // Body mode only: height/weight sit in the usual strip, chest is the one
    // filled measure field → 1 OF 9.
    expect(within(container).getByText("1 OF 9")).toBeTruthy();
  });

  it("active field row gets the is-active class", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    const { container } = renderMeasure();
    const chest = measureInput(container, "Chest");
    await user.click(chest);
    expect(chest.closest(".cz-sizes-row").classList.contains("is-active")).toBe(true);
  });

  // Mobile item D (2026-08-02): focus may change paint only — never height,
  // border width, padding, or scroll of the list. Pin active === inactive
  // offsetHeight, and keep active styles free of layout-affecting deltas.
  it("active and inactive measurement rows share the same offsetHeight", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    const { container } = renderMeasure();
    const chest = measureInput(container, "Chest");
    const shoulder = measureInput(container, "Shoulder");
    const chestRow = chest.closest(".cz-sizes-row");
    const shoulderRow = shoulder.closest(".cz-sizes-row");
    // Idle heights equal before any focus.
    expect(chestRow.offsetHeight).toBe(shoulderRow.offsetHeight);
    await user.click(chest);
    expect(chestRow.classList.contains("is-active")).toBe(true);
    expect(shoulderRow.classList.contains("is-active")).toBe(false);
    expect(chestRow.offsetHeight).toBe(shoulderRow.offsetHeight);
    await user.click(shoulder);
    expect(shoulderRow.classList.contains("is-active")).toBe(true);
    expect(chestRow.classList.contains("is-active")).toBe(false);
    expect(chestRow.offsetHeight).toBe(shoulderRow.offsetHeight);
  });

  it("pins paint-only active styles for .cz-sizes-row (no layout delta)", () => {
    // Base active: background only — no border width, no padding delta.
    const activeStart = CSS.indexOf(".cz-sizes-row.is-active {");
    expect(activeStart).toBeGreaterThan(-1);
    const activeBlock = CSS.slice(activeStart, CSS.indexOf("}", activeStart) + 1);
    expect(activeBlock).toMatch(/background:\s*var\(--cz-accent-bg\)/);
    expect(activeBlock).not.toMatch(/border:\s*[1-9]/);
    expect(activeBlock).not.toMatch(/padding:\s*[1-9]/);
    // Phone override: inset box-shadow only (paint). Fixed height shared.
    expect(CSS).toMatch(
      /\.cz-sizes-row\.is-active\s*\{[^}]*box-shadow:\s*inset 2px 0 0 var\(--cz-accent\)/s
    );
    // Global focus ring must not reappear on the number field.
    expect(CSS).toMatch(
      /\.cz-app\[data-fashion="true"\] \.cz-sizes-row-input:focus-visible\s*\{[^}]*box-shadow:\s*none/s
    );
    // How-line reserves height so tip text cannot shove the list.
    const howStart = CSS.indexOf(".cz-sizes-how-line {");
    expect(howStart).toBeGreaterThan(-1);
    const howBlock = CSS.slice(howStart, CSS.indexOf("}", howStart) + 1);
    expect(howBlock).toMatch(/min-height:/);
  });

  // Bug A (Kyle 2026-08-02): on a stacked (column) group body, the base
  // align-items: flex-start sizes the fields column to the how-line's
  // one-line text width — every row narrowed whenever focus swapped the tip.
  // Column stacking must stretch children to the card width. Browser geometry
  // proof: preview/scripts/probe-settings-width-jump.mjs (330px constant).
  it("stacked group bodies stretch the fields column to full width", () => {
    const columnBlocks = CSS.match(
      /\.cz-sizes-group-body\s*\{[^}]*flex-direction:\s*column[^}]*\}/gs
    );
    expect(columnBlocks, "no column-stacking rule for .cz-sizes-group-body").toBeTruthy();
    for (const block of columnBlocks) {
      expect(block).toMatch(/align-items:\s*stretch/);
    }
  });

  it("focusKey uses preventScroll so the list does not jump between boxes", () => {
    const src = fs.readFileSync(
      path.resolve(HERE, "../../sheets/BodyProfileSheet.jsx"),
      "utf8"
    );
    expect(src).toMatch(/preventScroll:\s*true/);
    expect(src).toMatch(/holdListScroll/);
  });

  // Garment mode is parked. Cross-source hints stay off so the body sheet
  // does not show a half-built second set of numbers.
  it("does not show a garment cross-source hint while garment mode is parked", () => {
    const { container } = render(
      <BodyProfileSheet
        value={{ chest: 40.5, garment: { chest: 21 } }}
        units="in"
        onSave={noop}
        onChangeUnits={noop}
        onClose={noop}
        embedded
      />
    );
    const also = [...container.querySelectorAll(".cz-sizes-row-also")].find(
      (el) => el.textContent.trim().length > 0
    );
    expect(also).toBeUndefined();
  });

  it("moves a legacy body sleeve value into the long-sleeve row", () => {
    const { container } = renderMeasure({
      units: "cm",
      value: {
        sleeve: 62,
        garment: { sleeve: 24 },
        measureMode: "body",
      },
    });
    expect(measureInput(container, "Short sleeve").value).toBe("");
    expect(measureInput(container, "Long sleeve").value).toBe("62");
  });
});
