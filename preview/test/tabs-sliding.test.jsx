import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { useState } from "react";

import { SegmentedControl } from "../../components/atoms.jsx";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const CSS = readFileSync(join(ROOT, "credenza-fashion.css"), "utf8");
const APP = readFileSync(join(ROOT, "credenza-fashion.jsx"), "utf8");
const DETAIL = readFileSync(join(ROOT, "components/DetailBody.jsx"), "utf8");

let pillReflows;

beforeEach(() => {
  pillReflows = [];
  Object.defineProperty(HTMLElement.prototype, "offsetLeft", {
    configurable: true,
    get() {
      return this.dataset.tTabValue === "cm" ? 52 : 3;
    },
  });
  Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
    configurable: true,
    get() {
      if (this.classList.contains("t-tabs-pill")) {
        pillReflows.push(this.style.transition);
        return 0;
      }
      return this.dataset.tTabValue === "cm" ? 48 : 45;
    },
  });
});

afterEach(() => {
  cleanup();
  delete HTMLElement.prototype.offsetLeft;
  delete HTMLElement.prototype.offsetWidth;
});

function UnitControl() {
  const [unit, setUnit] = useState("in");
  return (
    <SegmentedControl
      label="Units"
      value={unit}
      onChange={setUnit}
      options={[
        { value: "in", label: "in" },
        { value: "cm", label: "cm" },
      ]}
    />
  );
}

function OptionalControl() {
  const [unit, setUnit] = useState("in");
  return (
    <SegmentedControl
      label="Optional units"
      value={unit}
      onChange={setUnit}
      allowUnset
      options={[{ value: "in", label: "in" }]}
    />
  );
}

describe("the shared sliding tab indicator", () => {
  it("snaps before first paint, slides on selection, and snaps on resize", () => {
    const { container } = render(<UnitControl />);
    const pill = container.querySelector(".t-tabs-pill");
    expect(pill.style.transform).toBe("translateX(3px)");
    expect(pill.style.width).toBe("45px");
    expect(pillReflows).toEqual(["none"]);

    pillReflows = [];
    fireEvent.click(screen.getByRole("radio", { name: "cm" }));
    expect(pill.style.transform).toBe("translateX(52px)");
    expect(pill.style.width).toBe("48px");
    expect(pillReflows).toEqual([]);

    fireEvent(window, new Event("resize"));
    expect(pillReflows).toEqual(["none"]);
  });

  it("keeps the tuned motion and the reduced-motion guard", () => {
    expect(CSS).toMatch(/--tabs-dur:\s*250ms;/);
    expect(CSS).toMatch(/--tabs-ease:\s*cubic-bezier\(0\.22, 1, 0\.36, 1\);/);
    const pillBlock = CSS.slice(CSS.indexOf(".t-tabs-pill {"), CSS.indexOf("\n}\n", CSS.indexOf(".t-tabs-pill {")));
    expect(pillBlock).toContain("transform var(--tabs-dur) var(--tabs-ease)");
    expect(pillBlock).toContain("width     var(--tabs-dur) var(--tabs-ease)");
    expect(pillBlock).toContain("will-change: transform, width");
    expect(CSS).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*{\s*\.t-tabs-pill, \.t-tab { transition: none !important; }/);
  });

  it("hides the indicator when an optional selection is cleared", () => {
    const { container } = render(<OptionalControl />);
    const pill = container.querySelector(".t-tabs-pill");
    fireEvent.click(screen.getByRole("radio", { name: "in" }));
    expect(pill.style.width).toBe("0px");
  });

  it("covers the requested shelf, filter, and card controls", () => {
    expect(APP).toContain('className="cz-view-tabs t-tabs"');
    expect(APP).toContain('className="cz-filter-strip is-glyph is-tabs-peer t-tabs"');
    expect(APP).toContain('className="cz-filter-strip is-glyph t-tabs"');
    expect(APP).toContain('className="cz-dock-pill t-tabs"');
    expect(DETAIL).toContain('className="cz-fit-units t-tabs"');
    expect(DETAIL).toContain('className="cz-fit-tabs t-tabs"');
    expect(DETAIL).toContain('className="cz-detail-pane-picker t-tabs"');
    expect(DETAIL).toContain('className="cz-detail-unit t-tabs"');
  });
});
