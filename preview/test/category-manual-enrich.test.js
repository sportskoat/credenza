// F/C 2026-08-02 — shorts card structural fix, pin 1 (late enrichment race).
//
// Album enrich used to apply albumPatch.category from a STALE item snapshot
// unconditionally. A manual Shorts pick made while the album read was in
// flight got clobbered, often leaving categoryManual:true paired with "other".
// The resolve path already guarded on categoryManual; the album path must too.
//
// This race is not reachable from DetailBody RTL tests (enrich is async in the
// app root). A source lock is the cheap pin: drop the functional patch and this
// suite fails before anyone re-opens Kyle's stuck-category bug.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const fashionSrc = readFileSync(join(ROOT, "credenza-fashion.jsx"), "utf8");

describe("album enrich respects categoryManual (late-resolve race)", () => {
  it("applies album category through a functional updateEnrichedItem guard", () => {
    // Album-only symbols: albumGuessedCategory is computed for this path alone.
    // Resolve uses a different functional form and never mentions that name.
    expect(fashionSrc).toContain("albumGuessedCategory");
    // Functional patch applied through updateEnrichedItem (not a static object).
    expect(fashionSrc).toMatch(
      /updateEnrichedItem\(\s*item\.id,\s*token,\s*\(x\)\s*=>\s*\(\{[\s\S]{0,200}x\.categoryManual\s*&&\s*CATEGORIES\[x\.category\]/
    );

    // The static albumPatch must NOT set category itself — that was the
    // clobber. Category is only decided inside the functional patch.
    const albumBlockStart = fashionSrc.indexOf("const albumPatch = {");
    expect(albumBlockStart).toBeGreaterThan(-1);
    const albumBlockEnd = fashionSrc.indexOf(
      "updateEnrichedItem(item.id, token, (x) => ({",
      albumBlockStart
    );
    expect(albumBlockEnd).toBeGreaterThan(albumBlockStart);
    const albumObject = fashionSrc.slice(albumBlockStart, albumBlockEnd);
    expect(albumObject).not.toMatch(/^\s*category\s*:/m);
  });

  it("names the mid-flight race next to the categoryManual branch", () => {
    // Comment + branch together name the race for the next editor.
    expect(fashionSrc).toMatch(
      /Shorts pick made while this album read was in flight[\s\S]{0,300}x\.categoryManual\s*&&\s*CATEGORIES\[x\.category\]/
    );
  });
});
