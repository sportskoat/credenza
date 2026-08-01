import { afterEach, describe, expect, it, vi } from "vitest";
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

describe("Sizes and measurements v2 (settings page)", () => {
  // embedded: true matches the settings page path and skips the modal shell.
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

  it("puts usual sizes first with a left gutter label, not under the form", () => {
    const { container } = renderMeasure();
    const gutters = [...container.querySelectorAll(".cz-sizes-gutter-label")].map((n) =>
      n.textContent.trim()
    );
    expect(gutters[0]).toBe("Usual sizes");
    expect(gutters).toContain("What we can say");
    // No bordered cards on this page (O's carry-over from the approved file).
    expect(container.querySelectorAll(".cz-measure-group")).toHaveLength(0);
  });

  it("splits tops and bottoms as photo + field groups", () => {
    const { container } = renderMeasure();
    const titles = [...container.querySelectorAll(".cz-sizes-fields-title")].map((n) =>
      n.textContent.trim()
    );
    expect(titles).toEqual(["Tops", "Bottoms"]);
    expect(container.querySelectorAll(".cz-sizes-photo")).toHaveLength(2);
  });

  it("defaults to garment mode labels (pit to pit, not chest)", () => {
    const { container } = renderMeasure();
    expect(measureInput(container, "Pit to pit")).toBeTruthy();
    expect(measureInput(container, "Which top")).toBeTruthy();
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

  it("saves garment under its own object and does not wipe body keys", async () => {
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
    await user.click(within(container).getByRole("button", { name: /Save measurements/i }));
    expect(onSave).toHaveBeenCalled();
    const saved = onSave.mock.calls[0][0];
    expect(saved.chest).toBe(100);
    expect(saved.garment).toEqual({ chest: 54 });
    expect(saved.measureMode).toBe("garment");
    expect(saved.usualTops).toBe("L");
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
    // Garment mode is default: only garment.chest is filled → 1 of 8.
    expect(within(container).getByText("1 of 8")).toBeTruthy();
  });

  it("active field row gets the ink bar class", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    const { container } = renderMeasure();
    const pit = measureInput(container, "Pit to pit");
    await user.click(pit);
    expect(pit.closest(".cz-sizes-row").classList.contains("is-active")).toBe(true);
  });

  it("field input uses mono 17px+ so numbers stay readable next to a tape", () => {
    const body = ruleBody(".cz-sizes-row-input");
    const size = body.match(/font-size:\s*([\d.]+)px/);
    expect(size, ".cz-sizes-row-input has no font-size").not.toBeNull();
    expect(Number(size[1])).toBeGreaterThanOrEqual(16);
  });

  // Kyle, 2026-08-01: he re-typed a number he thought was already saved.
  // Real cause: an old `inseam`/`shortsInseam` value (inside leg) is never
  // read into the new outside-leg fields, on purpose — but the app never
  // said so, which read as "the app ignored my input." This note fills that
  // gap without changing any sizing math.
  const botNoteText = (container) => {
    const titles = [...container.querySelectorAll(".cz-sizes-fields-title")];
    const bottomsTitle = titles.find((n) => n.textContent.trim() === "Bottoms");
    expect(bottomsTitle, "no Bottoms group title found").toBeTruthy();
    return bottomsTitle
      .closest(".cz-sizes-fields")
      .querySelector(".cz-sizes-fields-note")
      .textContent.trim();
  };

  it("explains the gap when an old inside-leg value sits unread", () => {
    const { container } = render(
      <BodyProfileSheet
        value={{ inseam: 76 }}
        units="in"
        onSave={noop}
        onChangeUnits={noop}
        onClose={noop}
        embedded
      />
    );
    expect(botNoteText(container)).toMatch(/does not carry over/);
  });

  it("stays plain when no old value exists", () => {
    const { container } = renderMeasure();
    expect(botNoteText(container)).not.toMatch(/does not carry over/);
  });

  it("stops explaining once the new field is filled in", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    const { container } = render(
      <BodyProfileSheet
        value={{ inseam: 76, garment: { pantsLength: 104 } }}
        units="in"
        onSave={noop}
        onChangeUnits={noop}
        onClose={noop}
        embedded
      />
    );
    // Garment mode is the default view, and garment.pantsLength is already
    // filled, so the gap this note exists for is already closed.
    expect(botNoteText(container)).not.toMatch(/does not carry over/);
    await user.click(within(container).getByRole("radio", { name: "Your body" }));
    // Body mode's own pantsLength is still empty, so the gap re-appears there.
    expect(botNoteText(container)).toMatch(/does not carry over/);
  });
});
