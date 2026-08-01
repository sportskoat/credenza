import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "../..");
const CSS = readFileSync(join(ROOT, "credenza-fashion.css"), "utf8");

function rule(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return CSS.match(new RegExp(`${escaped}\\s*\\{([^}]+)\\}`))?.[1] || "";
}

describe("the phone shelf filter highlight", () => {
  // Design 7a (2026-07-31): glyph segmented control — pill track, 52px
  // segments. Kyle 2026-08-01 Kimi-feel: active segment is solid
  // --cz-seg-on (white on dark / ink on light), not card-solid.
  it("is a glyph segmented control with 52px pill segments", () => {
    const strip = rule(".cz-filter-strip.is-glyph");
    const chip = rule(".cz-filter-strip.is-glyph .cz-filter-chip");
    const active = rule(".cz-filter-strip.is-glyph .cz-filter-chip.is-active");

    expect(strip).toMatch(/grid-template-columns:\s*repeat\(4/);
    expect(strip).toMatch(/border-radius:\s*999px/);
    expect(strip).toMatch(/background:\s*var\(--cz-seg\)/);
    expect(chip).toMatch(/height:\s*52px/);
    expect(chip).toMatch(/min-height:\s*52px/);
    expect(chip).toMatch(/border-radius:\s*999px/);
    expect(active).toMatch(/background:\s*var\(--cz-seg-on/);
  });
});
