// Indexing handoff, direction 1b: "the paste bar carries it."
// Kyle 2026-08-04, looking at the design file: "its a green loading bar that
// replaces the stash/search area." The strip below the bar was live; the
// green bar inside the field itself was not. These pin the field half.
//
// These read the source, the way haul-archive-undo.test.js does.
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

describe("the desktop field carries the lead job", () => {
  it("swaps to the indexing treatment while a job is live", () => {
    expect(APP).toContain('"cz-desk-search-shell" + (indexFieldJob ? " is-indexing" : "")');
    expect(APP).toContain('className="cz-desk-index"');
    expect(APP).toContain('className="cz-desk-index-url"');
  });

  it("reads the same progress the strip reads", () => {
    // The wash and the bar both come off indexFieldJob.progress, so the field
    // and the strip row can never disagree about how far along a link is.
    const wash = APP.indexOf('className="cz-desk-index-wash"');
    const bar = APP.indexOf('className="cz-desk-index-bar"');
    expect(wash).toBeGreaterThan(-1);
    expect(bar).toBeGreaterThan(wash);
    for (const at of [wash, bar]) {
      expect(APP.slice(at, at + 200)).toMatch(/indexFieldJob\.progress \* 100/);
    }
  });

  it("speaks the strip's stage words, INDEXED in money green", () => {
    // One source of truth for the words: components/indexing.js. A second
    // copy in the field would drift.
    expect(APP).toMatch(/rowStageLabel\(indexFieldJob,/);
    expect(APP).toContain('indexFieldJob.state === "indexed" ? " is-done" : ""');
  });

  it("hands the field back to search when only failures remain", () => {
    // Failure copy and Retry live in the strip. A failed link must not hold
    // the field hostage.
    const picker = APP.slice(APP.indexOf("const indexFieldJob"), APP.indexOf("}, [indexShownRows])"));
    expect(picker).toContain('indexShownRows.some((j) => j.state === "failed")');
    expect(picker).toMatch(/if \(live\) return live;/);
  });

  it("dims and disables Stash while a job runs", () => {
    // The handoff: opacity 0.56, inert, never removed — removing it would
    // move the bar's layout.
    expect(APP).toContain('"cz-desk-stash-btn" + (indexFieldJob ? " is-inert" : "")');
    expect(APP).toContain("disabled={interactionLocked || !!indexFieldJob}");
  });
});

describe("the driver keeps the bar honest (Kyle 2026-08-04)", () => {
  // Kyle: "the indexing still starts about 1/4 of the way in" and "the strip
  // shows SIZING while the counter still reads 3 OF 8 PHOTOS."
  it("does not ease progress before the row is on screen", () => {
    // The 400ms show gate let the bar fill to ~a quarter before the first
    // painted frame. Progress only advances once shown is true, so the wash
    // and the strip always mount at 0.
    const tick = APP.slice(APP.indexOf("const tick = window.setInterval"), APP.indexOf("}, 100);"));
    expect(tick).toMatch(/const progress = shown\s*\?\s*advanceProgress/);
    expect(tick).toContain(": job.progress || 0");
  });

  it("snaps the photo count to done once the link is past the photo stage", () => {
    // headerFor sums revealed/photoTotal. While the state machine sat in
    // sizing with reveals still dripping, the header read "3 OF 8 PHOTOS"
    // next to a SIZING row — the tail felt endless.
    const tick = APP.slice(APP.indexOf("const tick = window.setInterval"), APP.indexOf("}, 100);"));
    expect(tick).toContain('const pastPhotos = job.state === "sizing" || isSettled(job);');
    expect(tick).toMatch(/if \(pastPhotos && revealed < totalPhotos\) \{\s*revealed = totalPhotos;/);
  });
});


describe("the field treatment matches the handoff values", () => {
  it("lays the green wash at the handoff's strength", () => {
    expect(ruleBody(".cz-desk-index-wash")).toMatch(/background:\s*rgba\(74, 222, 128, 0\.07\)/);
  });

  it("pins a 2px money bar to the field's bottom edge", () => {
    const bar = ruleBody(".cz-desk-index-bar");
    expect(bar).toMatch(/bottom:\s*0/);
    expect(bar).toMatch(/height:\s*2px/);
    expect(bar).toMatch(/background:\s*var\(--cz-money\)/);
  });

  it("smooths every 100ms tick into one continuous glide", () => {
    // The driver writes a new width every 100ms. A 120ms linear tween spans
    // the gap between ticks; anything longer lags behind the driver and the
    // bar steps — the jump Kyle saw.
    for (const body of [ruleBody(".cz-desk-index-wash"), ruleBody(".cz-desk-index-bar")]) {
      expect(body).toMatch(/transition:\s*width var\(--dur-press\) linear/);
    }
  });

  it("holds the stage label in a fixed 104px slot", () => {
    const stage = ruleBody(".cz-desk-index-stage");
    for (const decl of [
      /width:\s*104px/,
      /text-align:\s*right/,
      /font-family:\s*var\(--cz-mono\)/,
      /font-size:\s*11px/,
      /font-weight:\s*800/,
      /letter-spacing:\s*0\.08em/,
      /text-transform:\s*uppercase/,
      /white-space:\s*nowrap/,
    ]) {
      expect(stage).toMatch(decl);
    }
  });

  it("turns INDEXED money green", () => {
    expect(ruleBody(".cz-desk-index-stage.is-done")).toMatch(/color:\s*var\(--cz-money\)/);
  });

  it("dims Stash to the handoff's 0.56", () => {
    expect(ruleBody(".cz-desk-stash-btn.is-inert")).toMatch(/opacity:\s*0\.56/);
  });

  it("clips the wash and the bar to the field's own shape", () => {
    const shell = ruleBody(".cz-desk-search-shell.is-indexing");
    expect(shell).toMatch(/position:\s*relative/);
    expect(shell).toMatch(/overflow:\s*hidden/);
  });

  it("still respects reduced motion", () => {
    const i = DECLS.indexOf("@media (prefers-reduced-motion: reduce) {\n  .cz-desk-index-wash");
    expect(i, "the reduced-motion guard is gone").toBeGreaterThan(-1);
    expect(DECLS.slice(i, i + 200)).toMatch(/transition:\s*none !important/);
  });
});
