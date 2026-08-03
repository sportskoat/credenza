// Kyle 2026-07-29: "no consistency of title... make it the same", then
// "match shelf". On Shelf the item name reads ON the picture. On Hauls the
// haul name sat in a box UNDER the picture. It now rides inside the collage,
// so the collage's own overflow clips the scrim to the rounded corners.
//
// Kyle 2026-08-02 replaced the fanning stack with a 2x2 collage. There is no
// front card any more, so the label sits on the block itself.
//
// jsdom has no layout, so the geometry lives in the probe. These guard the two
// conclusions a rename or a refactor would quietly undo: WHERE the label is in
// the tree, and that the CSS still paints a scrim behind it.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";

import HaulCoverMosaic from "../../components/HaulCoverMosaic.jsx";

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

  it("puts the label inside the collage, not beside it", () => {
    const { container } = render(
      <HaulCoverMosaic covers={covers} name="Summer Europe" count={3} label={label} />
    );
    const block = container.querySelector(".cz-haul-mosaic");
    expect(block, "the collage never rendered").not.toBeNull();
    const held = container.querySelector(".cz-haul-card-label");
    expect(held, "the label never rendered").not.toBeNull();
    // The collage clips the scrim to its rounded corners. A label placed
    // outside it would spill over the card's padding.
    expect(block.contains(held), "the label is not inside the collage").toBe(true);
    // Exactly one copy — a label per tile would print the name four times.
    expect(container.querySelectorAll(".cz-haul-card-label").length).toBe(1);
  });

  it("renders no label when the caller passes none", () => {
    const { container } = render(
      <HaulCoverMosaic covers={covers} name="Summer Europe" count={3} />
    );
    expect(container.querySelector(".cz-haul-card-label")).toBeNull();
  });

  it("keeps every tile square and level, so the name never tilts", () => {
    // The old stack rotated its cards, which tilted the name with them. The
    // collage is a plain grid: nothing rotates, nothing animates.
    const src = readFileSync(join(ROOT, "components/HaulCoverMosaic.jsx"), "utf8");
    expect(src, "the collage rotates again — the name tilts with it").not.toMatch(/rotate/);
    expect(src, "the collage animates again — Kyle asked for a still block").not.toMatch(
      /framer-motion/
    );
  });

  it("draws the cross with one hairline gap, not two borders", () => {
    // Two tile borders double up on the shared edge and the cross reads twice
    // as thick. One gap over the block's own background cannot.
    const body = ruleBody(".cz-haul-mosaic");
    expect(body, "the .cz-haul-mosaic rule is gone — re-point this test").not.toBeNull();
    expect(body).toMatch(/gap:\s*1px/);
    expect(body).toMatch(/background:\s*var\(--cz-hair\)/);
    expect(body).toMatch(/grid-template-columns:\s*1fr 1fr/);
    expect(body).toMatch(/overflow:\s*hidden/);
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
