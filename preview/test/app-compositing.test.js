// LB-54. Kyle 2026-07-27, with two screenshots: "the screens are glitchy, half
// of them don't work in terms of scrolling anymore, or the animations to move
// from one to the other are very choppy. fix all".
//
// Two separate defects sat behind that one sentence, and this file pins both so
// they cannot come back quietly.
//
// 1. The blur. One rule set backdrop-filter: blur(18px) on both `article > div`
//    and .cz-modal-surface. A backdrop-filter forces its own compositing layer
//    AND re-reads every pixel behind it on every frame the backdrop moves, so
//    the cost scaled with the shelf. Neither half rendered anything:
//    --cz-card is 86% opaque over an ambient div already at filter: blur(48px),
//    and QW9 (2026-07-22) had already set .cz-modal-surface to --cz-card-solid,
//    which is fully opaque in every theme. Measured with
//    preview/scripts/probe-composite-cost.mjs at 390x844 with 24 items:
//      before   3.82x viewport re-read per frame at rest, 4.70x mid-slide
//      after    0.00x, both
//    and probe-card-blur-diff.mjs / probe-surface-blur-diff.mjs put the visible
//    difference at 0.69% and 0.00% of pixels.
//
// 2. The scroll. .cz-modal-page carried overscroll-behavior: contain but is
//    never itself scrollable — ModalShell measures the page and sets that exact
//    height on .cz-modal-stack, so scrollHeight always equals clientHeight.
//    `contain` on a full element still absorbs the wheel, so the gesture never
//    reached .cz-modal-surface-stacked, the one box that IS over-full.
//
// These are CSS-source rules, in the shape app-site-nav.test.js uses. A render
// test cannot catch either one: jsdom has no compositor and no layout, so the
// blur costs nothing there and the scroll container is always zero-height. The
// evidence lives in the probe scripts; this file guards the conclusions.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const CSS = readFileSync(join(ROOT, "credenza-fashion.css"), "utf8");
const JSX = readFileSync(join(ROOT, "credenza-fashion.jsx"), "utf8");

// Every rule below is about declarations, and both rules carry long comments
// that quote the exact property they removed — the first draft of this file
// failed because it matched its own explanation. Strip comments for anything
// that asks "is this property set", and use raw CSS only where the point is
// that the prose survived.
const DECLS = CSS.replace(/\/\*[\s\S]*?\*\//g, "");

// Pull one rule body out by its exact selector list. Returns null if the
// selector is gone, which every caller below treats as a failure rather than a
// pass — a renamed selector must not silently skip the rule.
function ruleBody(selector) {
  const i = DECLS.indexOf(selector);
  if (i === -1) return null;
  const open = DECLS.indexOf("{", i);
  const close = DECLS.indexOf("}", open);
  if (open === -1 || close === -1) return null;
  return DECLS.slice(open + 1, close);
}

describe("opaque surfaces do not pay for blur", () => {
  const SHARED = '.cz-app[data-fashion="true"] article > div,\n.cz-app[data-fashion="true"] .cz-modal-surface';

  it("still has the shared card/surface rule to check", () => {
    // Guard the guard. If this selector list is refactored, every assertion
    // below would pass against null and prove nothing.
    expect(ruleBody(SHARED), "the shared card/surface rule is gone — re-point this test").not.toBeNull();
  });

  it("does not blur behind the shelf cards or the sheet", () => {
    const body = ruleBody(SHARED) || "";
    expect(body, "backdrop-filter is back on the card/surface rule").not.toMatch(/backdrop-filter/);
  });

  it("keeps the card background token that made the blur pointless", () => {
    // The argument for removing the blur rests on this being translucent-over-
    // already-blurred, not on taste. If a future change makes --cz-card mostly
    // transparent, the blur question is open again and this test should fail so
    // somebody re-measures rather than assuming.
    const body = ruleBody(SHARED) || "";
    expect(body, "the card rule no longer uses --cz-card").toContain("var(--cz-card)");
    // --cz-card-solid is the sheet's background (QW9). Both themes define it as
    // a bare hex, which is fully opaque. A blur behind it can never render.
    const solids = [...JSX.matchAll(/"--cz-card-solid":\s*"([^"]+)"/g)].map((m) => m[1]);
    expect(solids.length, "--cz-card-solid is no longer defined in the app tokens").toBeGreaterThanOrEqual(2);
    for (const v of solids) {
      expect(v, `--cz-card-solid is "${v}" — no longer opaque, so re-measure the sheet blur`).toMatch(
        /^#[0-9a-fA-F]{6}$/
      );
    }
  });

  it("keeps the blur on glass that actually reads through to moving content", () => {
    // This is not a ban on backdrop-filter. The sticky chrome sits over the
    // scrolling shelf and earns it. Losing these would be a different
    // regression, so pin that they survive.
    expect(DECLS.match(/backdrop-filter:\s*blur\(/g)?.length ?? 0).toBeGreaterThanOrEqual(8);
  });

  it("records where the measurement came from", () => {
    // A bare deletion invites a well-meaning revert. The numbers have to travel
    // with the rule.
    expect(CSS, "the compositing audit comment is gone from credenza-fashion.css").toContain(
      "probe-composite-cost.mjs"
    );
    expect(CSS, "the measured viewport multiples are no longer recorded").toContain("3.82x viewport");
  });
});

describe("the modal page does not eat its own scroll", () => {
  it("keeps overscroll containment off the page that is never scrollable", () => {
    // ModalShell sets the stack height to the measured page height, so
    // .cz-modal-page is always exactly full. overscroll-behavior: contain on a
    // full element still swallows the wheel event, and the gesture never
    // reaches the surface underneath that does scroll.
    const body = ruleBody(".cz-modal-page {");
    expect(body, ".cz-modal-page rule is gone — re-point this test").not.toBeNull();
    expect(body, "overscroll-behavior: contain is back on .cz-modal-page").not.toMatch(
      /overscroll-behavior:\s*contain/
    );
    // Assert the positive too. A rule with no overscroll-behavior at all would
    // pass the line above and inherit whatever a future refactor sets.
    expect(body, ".cz-modal-page no longer sets overscroll-behavior at all").toMatch(
      /overscroll-behavior:\s*auto/
    );
  });

  it("leaves the scrollable surface able to scroll", () => {
    expect(DECLS, ".cz-modal-surface-stacked no longer has a rule").toContain(
      ".cz-modal-surface-stacked"
    );
  });
});
