// Design review 2 · change 7.
// Kyle 2026-08-02: "archiving a haul should pull up a toast for undo, also the
// font looks like it doesn't match."
//
// Archiving used to close the board and say nothing. A person who pressed it
// by mistake had to find the Archived list to get the haul back. It now raises
// the same undo toast the stash uses.
//
// The "Archived (1)" button had no stylesheet rule at all, so it fell back to
// the browser's own button face beside a mono "1 NEEDS YOU". It now matches.
//
// These read the source, the way haul-index-card.test.jsx does. Rendering the
// whole app for one handler costs more than it proves.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const APP = readFileSync(join(ROOT, "credenza-fashion.jsx"), "utf8");
const CSS = readFileSync(join(ROOT, "credenza-fashion.css"), "utf8");
// Strip comments first, so a comment can never satisfy an assertion.
const DECLS = CSS.replace(/\/\*[\s\S]*?\*\//g, "");

function ruleBody(selector) {
  const i = DECLS.indexOf("\n" + selector + " {");
  if (i === -1) return null;
  const open = DECLS.indexOf("{", i);
  const close = DECLS.indexOf("}", open);
  if (open === -1 || close === -1) return null;
  return DECLS.slice(open + 1, close);
}

// The whole onArchive handler, from its name to the end of the toast call.
// The slice used to run to the steps-page mount. The haul sharing redesign
// (2026-08) put a second HaulTitleMenu beside the first — same handler shape,
// one per header layout — so that span now covers code the assertions never
// meant to read. The toast call is the handler's last act; ending there keeps
// every assertion on the code it was written for.
function archiveHandler() {
  const start = APP.indexOf("onArchive={() => {");
  if (start === -1) return "";
  const end = APP.indexOf("duration: 3000,", start);
  return end === -1 ? APP.slice(start) : APP.slice(start, end);
}

describe("archiving a haul offers an undo", () => {
  it("raises a toast with an Undo button", () => {
    const block = archiveHandler();
    expect(block, "the archive handler moved — re-point this test").not.toBe("");
    expect(block).toMatch(/notify\(/);
    expect(block).toMatch(/actionLabel:\s*"Undo"/);
    expect(block).toMatch(/onAction:/);
  });

  it("puts the haul back, rather than only closing the toast", () => {
    // The undo has to call updateHaul again with the opposite archived flag.
    // A toast that only disappears is worse than no toast.
    const block = archiveHandler();
    const action = block.slice(block.indexOf("onAction:"));
    expect(action).toMatch(/updateHaul\(/);
    expect(action).toMatch(/archived:\s*!next/);
  });

  it("holds the haul name before the board closes", () => {
    // closeHaul() empties openHaulName. Reading it inside onAction would undo
    // nothing, because the name is gone by the time a person presses Undo.
    const block = archiveHandler();
    expect(block).toMatch(/const name = openHaulName;/);
    const action = block.slice(block.indexOf("onAction:"));
    expect(action).not.toMatch(/openHaulName/);
  });

  it("uses the action tone, which the toast markup actually reads", () => {
    // The toast only branches on "error" and "action". A "warn" tone is a
    // silent no-op, so it must not appear here.
    const block = archiveHandler();
    expect(block).toMatch(/tone:\s*"action"/);
    expect(block).not.toMatch(/tone:\s*"warn"/);
  });

  it("writes no em dash in the words a person reads", () => {
    const block = archiveHandler();
    const spoken = block.match(/"[^"]*"/g) || [];
    for (const text of spoken) expect(text).not.toContain("—");
  });
});

describe("the Archived button matches the badge beside it", () => {
  it("has a rule at all", () => {
    expect(
      ruleBody(".cz-hauls-archived-toggle"),
      "no rule — the button falls back to the browser's own font",
    ).not.toBeNull();
  });

  it("uses the same type as .cz-hauls-needs-you", () => {
    const mine = ruleBody(".cz-hauls-archived-toggle");
    const badge = ruleBody(".cz-hauls-needs-you");
    for (const decl of [
      /font-family:\s*var\(--cz-mono\)/,
      /font-size:\s*10px/,
      /font-weight:\s*700/,
      /letter-spacing:\s*0\.1em/,
      /text-transform:\s*uppercase/,
    ]) {
      expect(badge, "the badge changed — bring the toggle with it").toMatch(decl);
      expect(mine).toMatch(decl);
    }
  });

  it("resets the browser's button chrome", () => {
    const mine = ruleBody(".cz-hauls-archived-toggle");
    expect(mine).toMatch(/border:\s*0/);
    expect(mine).toMatch(/background:\s*none/);
  });

  it("keeps a 44px tap area for a finger", () => {
    const i = DECLS.indexOf("@media (pointer: coarse) {\n  .cz-hauls-archived-toggle");
    expect(i, "the coarse-pointer floor is gone — the button is 10px on a phone").toBeGreaterThan(
      -1,
    );
    expect(DECLS.slice(i, i + 140)).toMatch(/min-height:\s*44px/);
  });

  it("moves colour on a motion token, not a bare millisecond value", () => {
    expect(ruleBody(".cz-hauls-archived-toggle")).toMatch(
      /transition:\s*color var\(--dur-micro\) var\(--ease-out\)/,
    );
  });
});
