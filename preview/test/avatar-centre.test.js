// Kyle 2026-07-29, with a screenshot: "profile circle on top right is not
// centered". Measured in WebKit with preview/scripts/probe-avatar-centre.mjs:
//
//   before   phone ring 36px, initials pill 30px, gap left 7px, gap right -1px
//   after    phone ring 36px, initials pill 30px, gap 3px on all four sides
//
// The cause was the button's inherited padding (2px 6px 3px). Inside the 36px
// compact-phone ring that left a 22px content box for a 30px pill, and a grid
// item wider than its area is pinned to its start edge rather than centred.
// So the pill sat hard against the right edge of the ring.
//
// This is a CSS-source rule, in the shape app-compositing.test.js uses. A
// render test cannot catch it: jsdom has no layout, so every box is zero-sized
// there and the overflow never happens. The measurement lives in the probe;
// this file guards the conclusion.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const CSS = readFileSync(join(ROOT, "credenza-fashion.css"), "utf8");
// The fix's own comment names the padding it removed, so a raw search would
// match the explanation. Strip comments before asking what is set.
const DECLS = CSS.replace(/\/\*[\s\S]*?\*\//g, "");

function ruleBody(selector) {
  const i = DECLS.indexOf(selector + " {");
  if (i === -1) return null;
  const open = DECLS.indexOf("{", i);
  const close = DECLS.indexOf("}", open);
  if (open === -1 || close === -1) return null;
  return DECLS.slice(open + 1, close);
}

describe("the masthead avatar centres its initials", () => {
  it("still has the avatar rule to check", () => {
    // Guard the guard: a renamed selector must fail here, not pass silently.
    expect(ruleBody(".cz-avatar"), "the .cz-avatar rule is gone — re-point this test").not.toBeNull();
  });

  it("takes no padding, so the initials pill fits the ring", () => {
    const body = ruleBody(".cz-avatar") || "";
    expect(body, "the avatar no longer zeroes its padding").toMatch(/padding:\s*0\s*;/);
  });

  it("still centres its one child both ways", () => {
    const body = ruleBody(".cz-avatar") || "";
    expect(body).toMatch(/place-items:\s*center/);
    expect(body).toMatch(/display:\s*grid/);
  });

  it("keeps the pill smaller than the compact phone ring", () => {
    // 30px pill inside a 36px ring with a 1px border leaves 2px of ring on
    // each side. If either number moves the wrong way the pill overflows
    // again, so both are pinned here.
    const pill = ruleBody(".cz-avatar-initials") || "";
    expect(pill, "the initials pill rule is gone — re-point this test").not.toBe("");
    const pillWidth = /width:\s*(\d+)px/.exec(pill);
    expect(pillWidth, "the initials pill no longer sets a width").not.toBeNull();

    const compact = ruleBody(".cz-masthead.is-compact .cz-avatar") || "";
    expect(compact, "the compact phone avatar rule is gone — re-point this test").not.toBe("");
    const ringWidth = /width:\s*(\d+)px/.exec(compact);
    expect(ringWidth, "the compact phone avatar no longer sets a width").not.toBeNull();

    expect(Number(pillWidth[1]) + 2, "the initials pill no longer fits inside the phone ring").toBeLessThanOrEqual(
      Number(ringWidth[1])
    );
  });
});
