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
    expect(labels).toEqual(["TOPS", "BOTTOMS"]);
    expect(container.querySelectorAll(".cz-sizes-diagram")).toHaveLength(2);
    expect(container.querySelectorAll(".cz-sizes-tape")).toHaveLength(8);
  });

  it("defaults to garment mode labels (pit to pit, not chest)", () => {
    const { container } = renderMeasure();
    expect(measureInput(container, "Pit to pit")).toBeTruthy();
    expect(within(container).getByText("WHICH TOP")).toBeTruthy();
    expect(within(container).getByRole("radio", { name: "Your body" })).toBeTruthy();
  });

  it("keeps body and garment values on separate drafts when the mode switches", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    const { container } = renderMeasure({ units: "cm" });
    const pit = measureInput(container, "Pit to pit");
    await user.clear(pit);
    await user.type(pit, "54");
    await user.click(within(container).getByRole("radio", { name: "Your body" }));
    expect(measureInput(container, "Chest").value).toBe("");
    await user.click(within(container).getByRole("radio", { name: "A garment that fits" }));
    expect(measureInput(container, "Pit to pit").value).toBe("54");
  });

  it("auto-saves garment under its own object and does not wipe body keys", async () => {
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
    const pit = measureInput(container, "Pit to pit");
    await user.clear(pit);
    await user.type(pit, "54");
    await waitFor(
      () => {
        expect(onSave).toHaveBeenCalled();
        const saved = onSave.mock.calls[onSave.mock.calls.length - 1][0];
        expect(saved.chest).toBe(100);
        expect(saved.garment).toEqual({ chest: 54 });
        expect(saved.measureMode).toBe("garment");
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
    // Garment mode is default: only garment.chest is filled → 1 OF 8.
    expect(within(container).getByText("1 OF 8")).toBeTruthy();
  });

  it("active field row gets the is-active class", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    const { container } = renderMeasure();
    const pit = measureInput(container, "Pit to pit");
    await user.click(pit);
    expect(pit.closest(".cz-sizes-row").classList.contains("is-active")).toBe(true);
  });

  it("shows the other source as a mono hint when both sets have a value", () => {
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
    // Default garment mode: body value shows as a mono "body …" hint.
    // Every row always mounts .cz-sizes-row-also (empty when no hint) so the
    // fixed grid columns stay aligned — find the one with content.
    const also = [...container.querySelectorAll(".cz-sizes-row-also")].find(
      (el) => el.textContent.trim().length > 0
    );
    expect(also).toBeTruthy();
    expect(also.textContent).toMatch(/^body\s+\d/);
  });
});
