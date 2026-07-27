import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// LB-71 (Kyle 2026-07-27): "I think the cards are a little bland. The top is a
// little bland."
//
// Two fixes. The shelf card's resting shadow was a single flat blur, which
// reads as a sticker printed on the page; it is now the same two-layer contact
// + ambient pair the card wrapper already used, with its own Blackout values.
// The masthead had no bottom edge at all and a wordmark smaller than the
// section headings below it; it now carries a hairline rule and a larger lock.
//
// Every case below reads the declared value out of the source with comments
// stripped first. This codebase quotes its own code in its comments, so a
// whole-file search matches the explanation and keeps passing after the rule
// is deleted (LB-65).

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CSS = fs.readFileSync(path.resolve(HERE, "../../credenza-fashion.css"), "utf8");
const JSX = fs.readFileSync(path.resolve(HERE, "../../credenza-fashion.jsx"), "utf8");

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "");
}

// Pull one rule's body out of a stylesheet so its values can be read.
function ruleBody(source, selector) {
  const clean = stripComments(source);
  const at = clean.indexOf(selector + " {");
  if (at < 0) return "";
  return clean.slice(at + selector.length + 1, clean.indexOf("}", at));
}

// The masthead lives in a JS template literal (KEYFRAMES), not a .css file, so
// its rules are read out of the component source the same way.
function keyframesBody(selector) {
  const at = JSX.indexOf("const KEYFRAMES = `");
  const end = JSX.indexOf("\n`;", at);
  return ruleBody(JSX.slice(at, end), selector);
}

// How many shadow layers a box-shadow declares. Layers are comma separated,
// but every layer also contains commas inside its own colour function, so the
// colours are removed before the split.
function shadowLayers(body) {
  const at = body.indexOf("box-shadow:");
  if (at < 0) return 0;
  const value = body.slice(at + "box-shadow:".length, body.indexOf(";", at));
  return value.replace(/[a-z-]+\([^)]*\)/g, "C").split(",").length;
}

describe("The shelf card sits on the page instead of on top of it (LB-71)", () => {
  it("the resting card casts two shadow layers, not one", () => {
    const body = ruleBody(CSS, ".cz-card-editorial.cz-card-twoline:not(.is-selected)");
    expect(body, "the resting shelf-card shadow rule is gone").toContain("box-shadow");
    // One blur is a sticker. Two is a contact shadow plus an ambient one.
    expect(shadowLayers(body)).toBeGreaterThanOrEqual(2);
  });

  it("the tight layer is the contact shadow, close and small", () => {
    const body = ruleBody(CSS, ".cz-card-editorial.cz-card-twoline:not(.is-selected)");
    // The first layer must sit within 2px of the card and blur no more than
    // 4px, or it is a second ambient layer rather than a contact point.
    const first = body.match(/box-shadow:\s*0\s+(\d+)px\s+(\d+)px/);
    expect(first, "no first shadow layer to read").not.toBeNull();
    expect(Number(first[1])).toBeLessThanOrEqual(2);
    expect(Number(first[2])).toBeLessThanOrEqual(4);
  });

  it("Blackout gets its own pair, because those alphas vanish on black", () => {
    const body = ruleBody(
      CSS,
      '.cz-app[data-theme="dark"] .cz-card-editorial.cz-card-twoline:not(.is-selected)',
    );
    expect(body, "Blackout has no shelf-card shadow of its own").toContain("box-shadow");
    expect(shadowLayers(body)).toBeGreaterThanOrEqual(2);
    // A shadow under 0.3 alpha over a #000 field is invisible. The light
    // theme's values would be a silent no-op here.
    const alphas = [...body.matchAll(/\/\s*(0?\.\d+)\s*\)/g)].map((m) => Number(m[1]));
    expect(alphas.length, "no readable alpha values in the Blackout shadow").toBeGreaterThan(0);
    for (const alpha of alphas) expect(alpha).toBeGreaterThanOrEqual(0.3);
  });
});

describe("The masthead has an edge (LB-71)", () => {
  it("the masthead closes with a hairline rule", () => {
    const body = keyframesBody(".cz-masthead");
    expect(body, ".cz-masthead has no bottom border").toMatch(
      /border-bottom:\s*1px solid var\(--cz-hair\)/,
    );
  });

  it("the rule reads as the header's own edge, not a stray divider", () => {
    const body = keyframesBody(".cz-masthead");
    // Room above the rule, and more room below it than above, or the header
    // and the content under it read as one block split by a line.
    const pad = body.match(/padding-bottom:\s*(\d+)px/);
    const gap = body.match(/margin-bottom:\s*(\d+)px/);
    expect(pad, ".cz-masthead has no padding above its rule").not.toBeNull();
    expect(gap, ".cz-masthead has no margin below its rule").not.toBeNull();
    expect(Number(pad[1])).toBeGreaterThanOrEqual(10);
    expect(Number(gap[1])).toBeGreaterThan(Number(pad[1]));
  });

  it("the wordmark is not smaller than the section headings under it", () => {
    const brand = keyframesBody(".cz-brand-word").match(/font-size:\s*([\d.]+)px/);
    expect(brand, ".cz-brand-word has no font-size").not.toBeNull();
    // The old 16px sat under the shelf's own headings, so the page named its
    // sections louder than it named itself.
    expect(Number(brand[1])).toBeGreaterThanOrEqual(18);
  });

  it("the kicker still reads as a kicker under the larger wordmark", () => {
    const word = Number(keyframesBody(".cz-brand-word").match(/font-size:\s*([\d.]+)px/)[1]);
    const sub = Number(keyframesBody(".cz-brand-sub").match(/font-size:\s*([\d.]+)px/)[1]);
    // Subordinate, but not so small it turns to grit next to a 19px word.
    expect(sub).toBeLessThan(word);
    expect(sub / word).toBeGreaterThan(0.45);
  });
});
