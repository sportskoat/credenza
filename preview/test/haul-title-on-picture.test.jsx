// Kyle 2026-07-29: "no consistency of title... make it the same", then
// "match shelf". On Shelf the item name reads ON the picture. On Hauls the
// haul name sat in a box UNDER the picture. It now rides inside the FRONT fan
// card, so the card's own overflow clips the scrim — a label placed outside
// the stack bled past the front card's slanted edge once the fan opened
// (measured in WebKit: preview/scripts/probe-haul-title.mjs).
//
// jsdom has no layout, so the geometry lives in the probe. These guard the two
// conclusions a rename or a refactor would quietly undo: WHERE the label is in
// the tree, and that the CSS still paints a scrim behind it.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";

import HaulCoverFan from "../../components/HaulCoverFan.jsx";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const CSS = readFileSync(join(ROOT, "credenza-fashion.css"), "utf8");
// The fix's own comments name the box the label came out of, so strip
// comments before asking what the stylesheet actually sets.
const DECLS = CSS.replace(/\/\*[\s\S]*?\*\//g, "");

// Anchored on a line start: ".cz-haul-card-label {" is also the tail of
// ".cz-haul-card--ghost .cz-haul-card-label {", and an unanchored search read
// the ghost override instead of the rule under test.
function ruleBody(selector) {
  const i = DECLS.indexOf("\n" + selector + " {");
  if (i === -1) return null;
  const open = DECLS.indexOf("{", i);
  const close = DECLS.indexOf("}", open);
  if (open === -1 || close === -1) return null;
  return DECLS.slice(open + 1, close);
}

afterEach(cleanup);

describe("the haul name reads on the picture", () => {
  const covers = ["a.jpg", "b.jpg", "c.jpg"];
  const label = (
    <div className="cz-haul-card-label">
      <div className="cz-haul-card-name">Summer Europe</div>
    </div>
  );

  it("puts the label inside the front card, not beside the stack", () => {
    const { container } = render(
      <HaulCoverFan covers={covers} name="Summer Europe" count={3} label={label} />
    );
    const cards = [...container.querySelectorAll(".cz-haul-fan-card")];
    expect(cards.length).toBe(3);
    const held = container.querySelector(".cz-haul-card-label");
    expect(held, "the label never rendered").not.toBeNull();
    // zIndex is total - i, so the first card is the front one.
    expect(cards[0].contains(held), "the label is not inside the FRONT card").toBe(true);
    // Exactly one copy — a label on every card would print the name three times.
    expect(container.querySelectorAll(".cz-haul-card-label").length).toBe(1);
  });

  it("renders no label when the caller passes none", () => {
    const { container } = render(
      <HaulCoverFan covers={covers} name="Summer Europe" count={3} />
    );
    expect(container.querySelector(".cz-haul-card-label")).toBeNull();
  });

  it("keeps the front card flat so the name is level", () => {
    // The fan used to start at -10deg, which tilted the name. Only the cards
    // BEHIND the front one lean now.
    const src = readFileSync(join(ROOT, "components/HaulCoverFan.jsx"), "utf8");
    expect(src, "the fan starts at an angle again — the name tilts with it").not.toMatch(
      /startAngle/
    );
  });

  it("still paints a scrim behind the words", () => {
    const body = ruleBody(".cz-haul-card-label");
    expect(body, "the .cz-haul-card-label rule is gone — re-point this test").not.toBeNull();
    expect(body).toMatch(/position:\s*absolute/);
    expect(body).toMatch(/color:\s*#fff/);
    const scrim = ruleBody(".cz-haul-card-label::before");
    expect(scrim, "the scrim rule is gone — the words sit on the bare photo").not.toBeNull();
    expect(scrim).toMatch(/--cz-photo-scrim/);
  });

  it("leaves the ghost tile's words under its tile", () => {
    // The ghost has no photo. A scrim over its empty placeholder read as a
    // grey smear and the white words lost contrast in the light theme.
    const body = ruleBody(".cz-haul-card--ghost .cz-haul-card-label");
    expect(body, "the ghost tile override is gone").not.toBeNull();
    expect(body).toMatch(/position:\s*static/);
  });
});
