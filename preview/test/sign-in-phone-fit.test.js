// Kyle 2026-08-02, with a screenshot: the sign-in sheet "gets cut off really
// hard on that first page" on a phone.
//
// The cause was spacing, not layout. The card kept its desktop 18px gap and
// 28/26/24 padding on a 390px screen. State A stacks eight rows; inside the
// shared 88dvh phone cap the last two fell past the bottom edge. The sheet
// scrolls, so nothing was lost, but a person reads a clipped card as broken.
//
// This is a CSS-source rule, in the shape avatar-centre.test.js uses. A render
// test cannot catch it: jsdom has no layout, so every box is zero-sized there
// and the overflow never happens.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const CSS = readFileSync(join(ROOT, "credenza-fashion.css"), "utf8");
// The fix's own comment names the numbers it replaced, so a raw search would
// match the explanation. Strip comments before asking what is set.
const DECLS = CSS.replace(/\/\*[\s\S]*?\*\//g, "");

// The last phone block that mentions the sign-in card. Reading to the closing
// brace of the @media is enough: the block holds only sign-in rules.
function phoneBlock() {
  const anchor = DECLS.lastIndexOf(".cz-modal-surface.cz-signin-modal");
  if (anchor === -1) return null;
  const start = DECLS.lastIndexOf("@media", anchor);
  if (start === -1) return null;
  let depth = 0;
  for (let i = DECLS.indexOf("{", start); i < DECLS.length; i += 1) {
    if (DECLS[i] === "{") depth += 1;
    else if (DECLS[i] === "}") {
      depth -= 1;
      if (depth === 0) return DECLS.slice(start, i + 1);
    }
  }
  return null;
}

function ruleIn(block, selector) {
  const i = block.indexOf(selector + " {");
  if (i === -1) return null;
  const open = block.indexOf("{", i);
  const close = block.indexOf("}", open);
  return block.slice(open + 1, close);
}

describe("the sign-in card fits a phone screen", () => {
  const block = phoneBlock();

  it("still has a phone block to check", () => {
    expect(block, "the phone sign-in block is gone — re-point this test").not.toBeNull();
    // Both gates matter. A width query alone caught a narrow desktop window
    // and turned the card into a bottom sheet there (Kyle 2026-07-24).
    expect(block).toMatch(/max-width:\s*767px/);
    expect(block).toMatch(/pointer:\s*coarse/);
  });

  it("shrinks the gap and the padding below the desktop card", () => {
    const phone = ruleIn(block || "", '.cz-app[data-fashion="true"] .cz-signin');
    expect(phone, "the phone .cz-signin rule is gone — the card clips again").not.toBeNull();

    const gap = /gap:\s*(\d+)px/.exec(phone);
    expect(gap, "the phone card no longer sets its own gap").not.toBeNull();
    expect(Number(gap[1]), "the phone gap is not smaller than the desktop 18px").toBeLessThan(18);

    expect(phone, "the phone card no longer sets its own padding").toMatch(/padding:\s*\d+px/);
  });

  it("keeps a wrapped heading clear of the close button", () => {
    const head = ruleIn(block || "", '.cz-app[data-fashion="true"] .cz-signin .cz-signin-head');
    expect(head, "the phone heading rule is gone — a long heading runs under the close button").not.toBeNull();
    expect(head).toMatch(/padding-right:\s*56px/);
  });

  it("keeps the 44px thumb target on every control", () => {
    const pill = ruleIn(block || "", '.cz-app[data-fashion="true"] .cz-signin .cz-pill');
    expect(pill).toMatch(/min-height:\s*44px/);
  });

  it("prefixes every rule, or the card loses its background", () => {
    // The compositing-audit block sets .cz-modal-surface at (0,0,3,0). A bare
    // .cz-modal-surface.cz-signin-modal is only (0,0,2,0) and silently loses
    // the background. The block comment at the rule says so; this enforces it.
    const selectors = (block || "")
      .split("}")
      .map((chunk) => chunk.slice(0, chunk.indexOf("{")).trim())
      .filter((s) => s && !s.startsWith("@"));
    for (const selector of selectors) {
      expect(selector, "this rule needs the .cz-app[data-fashion] prefix").toContain(
        '.cz-app[data-fashion="true"]'
      );
    }
  });
});
