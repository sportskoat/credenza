import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cleanup, render, within } from "@testing-library/react";

import SettingsContext from "../../settings/SettingsContext.jsx";
import YourDataSection from "../../settings/YourDataSection.jsx";
import BodyProfileSheet from "../../sheets/BodyProfileSheet.jsx";

// LB-70 (Kyle 2026-07-27): "make the navigation and profile setting experience
// much better, make it cleaner, profile sign in cleaner, different options
// cleaner … It's too clunky the way it is right now with how everything is set
// up. I think the measurements could use a little bit of a bigger, better
// thing. Maybe the card that pops up with all the settings is just a little
// bit too bland."
//
// The three fixes were: group the option rows under named headings, put each
// group on its own card, and make the measurement inputs large with the unit
// inside the box.
//
// This test asserts on the rendered consequence, never on a class name alone
// and never on a comment (LB-65). Each case names a specific thing a person
// would see, and deleting the fix makes the case fail with the reason.

// This repo does not clear the document between renders, so every query below
// is scoped to the container it just rendered.
afterEach(cleanup);

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CSS = fs.readFileSync(path.resolve(HERE, "../../credenza-fashion.css"), "utf8");

// Pull one rule's body out of the stylesheet so a value can be read. Comments
// are stripped first: this codebase quotes its own code in its comments, so a
// whole-file search matches the explanation and keeps passing after the rule
// is deleted.
function ruleBody(selector) {
  const clean = CSS.replace(/\/\*[\s\S]*?\*\//g, "");
  const at = clean.indexOf(selector + " {");
  if (at < 0) return "";
  return clean.slice(at, clean.indexOf("}", at));
}

const noop = () => {};

// The Profile and Settings sheets were deleted in Phase 4 of the Profile
// Settings design. The grouping rules they carried now live in the routed
// settings sections; Your data is the section with the most rows, so it
// stands in for the rule.
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

describe("Settings sections keep the named groups (LB-70)", () => {
  it("shows a heading over every block of rows", () => {
    const { container } = renderData();
    const headings = [...container.querySelectorAll(".cz-profile-label")].map((n) =>
      n.textContent.trim()
    );
    expect(headings).toEqual(["Import & backup", "On this device"]);
  });

  it("puts each option row inside a group card, not loose in the section", () => {
    const { container } = renderData();
    const rows = [...container.querySelectorAll(".cz-profile-row")];
    expect(rows.length).toBeGreaterThan(1);
    for (const row of rows) {
      expect(
        row.closest(".cz-profile-group"),
        `row "${row.textContent.trim()}" is not inside a group card`
      ).not.toBeNull();
    }
  });

  it("the group card is a real surface, not a transparent run of hairlines", () => {
    const body = ruleBody(".cz-profile-group");
    expect(body).toMatch(/background:\s*var\(--cz-card-solid\)/);
    expect(body).toMatch(/border:\s*1px solid var\(--cz-hair\)/);
    expect(body).toMatch(/border-radius:\s*18px/);
  });

  it("keeps the danger row with the data it erases", () => {
    const { container } = renderData();
    const erase = within(container).getByText("Erase my data").closest(".cz-profile-row");
    const group = erase.closest(".cz-profile-group");
    // It used to hang alone at the bottom of the sheet, under the legal links.
    expect(within(group).getByText("Storage")).toBeTruthy();
  });
});

describe("Measurements are big and grouped (LB-70)", () => {
  const renderMeasure = () =>
    render(
      <BodyProfileSheet value={null} units="in" onSave={noop} onChangeUnits={noop} onClose={noop} />
    );

  it("groups the eight measurements by part of the body", () => {
    const { container } = renderMeasure();
    const heads = [...container.querySelectorAll(".cz-measure-group-head")].map((n) =>
      n.textContent.trim()
    );
    expect(heads).toEqual(["You", "Upper body", "Lower body", "Usual sizes"]);
    // Kyle 2026-07-28: "reduce just the overall text… consolidate it so it's
    // on one screen." The per-group reason lines are gone — the headings
    // carry the grouping alone. If they come back, the section stops fitting
    // on one screen.
    expect(container.querySelectorAll(".cz-measure-group-why")).toHaveLength(0);
  });

  it("labels each box with the body part alone and shows the unit inside it", () => {
    const { container } = renderMeasure();
    // The label used to read "Chest (in)" — the unit repeated eight times.
    expect(within(container).getByLabelText("Chest")).toBeTruthy();
    const units = [...container.querySelectorAll(".cz-measure-unit")].map((n) =>
      n.textContent.trim()
    );
    expect(units).toEqual(["in", "lb", "in", "in", "in", "in", "in", "in"]);
  });

  it("switches every unit label together when the toggle flips", () => {
    const { container } = render(
      <BodyProfileSheet value={null} units="cm" onSave={noop} onChangeUnits={noop} onClose={noop} />
    );
    const units = [...container.querySelectorAll(".cz-measure-unit")].map((n) =>
      n.textContent.trim()
    );
    expect(units).toEqual(["cm", "kg", "cm", "cm", "cm", "cm", "cm", "cm"]);
  });

  it("counts how many of the eight are filled in", () => {
    const { container } = render(
      <BodyProfileSheet
        value={{ height: 178, chest: 96 }}
        units="cm"
        onSave={noop}
        onChangeUnits={noop}
        onClose={noop}
      />
    );
    expect(within(container).getByText(/2 of 8 filled in/)).toBeTruthy();
  });

  it("the input is large enough to read, and large enough that iOS will not zoom", () => {
    const body = ruleBody(".cz-measure-input input");
    const size = body.match(/font-size:\s*(\d+)px/);
    expect(size, ".cz-measure-input input has no font-size").not.toBeNull();
    // It was 14px on the shared Field. 16px is the iOS focus-zoom threshold;
    // this box is the one Kyle asked to be bigger, so it clears it outright.
    expect(Number(size[1])).toBeGreaterThanOrEqual(20);
    const height = body.match(/min-height:\s*(\d+)px/);
    expect(height, ".cz-measure-input input has no min-height").not.toBeNull();
    expect(Number(height[1])).toBeGreaterThanOrEqual(48);
  });
});
