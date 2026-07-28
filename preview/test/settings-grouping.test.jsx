import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cleanup, render, within } from "@testing-library/react";

import ProfileSheet from "../../sheets/ProfileSheet.jsx";
import SettingsSheet from "../../sheets/SettingsSheet.jsx";
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

function renderProfile(extra = {}) {
  return render(
    <ProfileSheet
      mode="light"
      onTheme={noop}
      agentLabel="Sugargoo"
      onOpenAgent={noop}
      pricePrimary="USD"
      onCycleCurrency={noop}
      fitSummary={false}
      onToggleFitSummary={noop}
      fitDetail="concise"
      onCycleFitDetail={noop}
      onOpenSizes={noop}
      onOpenFitPrefs={noop}
      onOpenImport={noop}
      storageLabel="Plenty of room"
      storageColor="#22c55e"
      onEraseData={noop}
      accountEnabled={false}
      accountSession={null}
      accountPlan={null}
      onClose={noop}
      {...extra}
    />
  );
}

describe("Profile options sit in named groups (LB-70)", () => {
  it("shows a heading over every block of rows", () => {
    const { container } = renderProfile();
    const headings = [...container.querySelectorAll(".cz-profile-label")].map((n) =>
      n.textContent.trim()
    );
    // Four headings, not the two the flat list had. Without them the eleven
    // rows read as one undifferentiated column.
    expect(headings).toEqual(["Look & fit", "Your shelf", "Your data", "Learn"]);
  });

  it("puts each option row inside a group card, not loose in the sheet", () => {
    const { container } = renderProfile();
    const rows = [...container.querySelectorAll(".cz-profile-row")];
    expect(rows.length).toBeGreaterThan(5);
    for (const row of rows) {
      // Sign-in card rows are the one exception: they bleed to that card's
      // own edge on purpose and have their own surface already.
      if (row.closest(".cz-profile-signin")) continue;
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
    const { container } = renderProfile();
    const erase = within(container).getByText("Erase my data").closest(".cz-profile-row");
    const group = erase.closest(".cz-profile-group");
    // It used to hang alone at the bottom of the sheet, under the legal links.
    expect(within(group).getByText("Import & backup")).toBeTruthy();
    expect(within(group).getByText("Storage")).toBeTruthy();
  });
});

describe("Settings rows sit in named groups (LB-70)", () => {
  const renderSettings = () =>
    render(
      <SettingsSheet
        mode="light"
        onCycleTheme={noop}
        onOpenSizes={noop}
        onOpenFitPrefs={noop}
        fitSummary={false}
        onToggleFitSummary={noop}
        fitDetail="concise"
        onCycleFitDetail={noop}
        accountEnabled={false}
        accountSession={null}
        accountPlan={null}
        onOpenAccount={noop}
        onClose={noop}
      />
    );

  it("shows a heading over every block of rows", () => {
    const { container } = renderSettings();
    const headings = [...container.querySelectorAll(".cz-settings-label")].map((n) =>
      n.textContent.trim()
    );
    expect(headings).toEqual(["Account", "Look", "Fit"]);
  });

  it("puts every row inside a group card", () => {
    const { container } = renderSettings();
    const rows = [...container.querySelectorAll(".cz-settings-row")];
    expect(rows.length).toBeGreaterThan(3);
    for (const row of rows) {
      expect(
        row.closest(".cz-settings-group"),
        `row "${row.textContent.trim()}" is not inside a group card`
      ).not.toBeNull();
    }
  });

  it("the group card is a real surface", () => {
    const body = ruleBody(".cz-settings-group");
    expect(body).toMatch(/border:\s*1px solid var\(--cz-hair\)/);
    expect(body).toMatch(/border-radius:\s*18px/);
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
    // Every group states why Credenza wants it. A heading with no reason is
    // the flat form again with dividers drawn on it.
    const whys = [...container.querySelectorAll(".cz-measure-group-why")];
    expect(whys).toHaveLength(heads.length);
    for (const why of whys) expect(why.textContent.trim().length).toBeGreaterThan(20);
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

describe("The referral disclosure sits on the plan card (CH-15)", () => {
  it("is visible on the free plan card without expanding anything", () => {
    const { container } = renderProfile({
      accountEnabled: true,
      accountSession: { user: { email: "kyle@example.com" } },
      accountPlan: { state: "free" },
      onUpgrade: noop,
      onPortal: noop,
      onSignOut: noop,
      onDeleteAccount: noop,
    });
    expect(
      within(container).getByText(
        /Pro is a cap lift, not a key\. Some agent links carry a referral code that funds the app\. It never changes your price\./
      )
    ).toBeTruthy();
  });

  it("does not show upgrade copy to a Pro member", () => {
    const { container } = renderProfile({
      accountEnabled: true,
      accountSession: { user: { email: "kyle@example.com" } },
      accountPlan: { state: "pro" },
      onUpgrade: noop,
      onPortal: noop,
      onSignOut: noop,
      onDeleteAccount: noop,
    });
    expect(within(container).queryByText(/cap lift, not a key/)).toBeNull();
    expect(within(container).getByText("Manage billing")).toBeTruthy();
  });
});
