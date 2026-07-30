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
  it("fills the 44px row with square corners", () => {
    const strip = rule(".cz-shelf-band .cz-filter-strip");
    const chip = rule(".cz-shelf-band .cz-filter-chip");

    expect(strip).toMatch(/min-height:\s*44px/);
    expect(strip).toMatch(/padding:\s*0 12px/);
    expect(chip).toMatch(/height:\s*44px/);
    expect(chip).toMatch(/min-height:\s*44px/);
    expect(chip).toMatch(/border-radius:\s*0/);
  });
});
