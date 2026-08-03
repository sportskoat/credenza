// The haul stage board (design/handoffs/haul/README.md, screens 2, 6 and 7).
//
// Mixed progress is the normal state of a haul. The board renders that: four
// stage columns and the parcel as the destination. These tests guard the
// wiring and the widths, because a column that grows silently breaks the
// 1072px track the README fixes.
//
// haul-fulfillment.test.js already proves boardColumns, itemCardMeta,
// parcelMaths, shipRange and storageLine. These prove the screen.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import HaulFlowBoard from "../../components/HaulFlowBoard.jsx";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const CSS = readFileSync(join(ROOT, "credenza-fashion.css"), "utf8");
const DECLS = CSS.replace(/\/\*[\s\S]*?\*\//g, "");
const APP = readFileSync(join(ROOT, "credenza-fashion.jsx"), "utf8");

function ruleBody(selector) {
  const i = DECLS.indexOf("\n" + selector + " {");
  if (i === -1) return null;
  const open = DECLS.indexOf("{", i);
  const close = DECLS.indexOf("}", open);
  if (open === -1 || close === -1) return null;
  return DECLS.slice(open + 1, close);
}

afterEach(cleanup);

function item(over = {}) {
  return {
    id: "a",
    title: "Cargo trousers",
    size: "Large",
    platform: "Weidian",
    price: 42,
    est: 500,
    actual: null,
    vol: 3000,
    stage: "toOrder",
    qc: null,
    reason: null,
    photos: 0,
    storage: null,
    order: "",
    when: null,
    url: "https://weidian.com/item.html?itemID=1",
    ...over,
  };
}

function mount(over = {}) {
  const props = {
    items: over.items || [item()],
    ship: over.ship === undefined ? null : over.ship,
    tileFor: over.tileFor || (() => ({ image: null, tint: "#ff5a3c" })),
    agentName: over.agentName || "Superbuy",
    onOpenItem: vi.fn(),
    onItemAction: vi.fn(),
    onColumnFooter: vi.fn(),
    onRemoveFromParcel: vi.fn(),
    onSetDivisor: vi.fn(),
    onSetLine: vi.fn(),
    onSetRate: vi.fn(),
    onHandOff: vi.fn(),
    ...over,
  };
  render(<HaulFlowBoard {...props} />);
  return props;
}

describe("the board's shape", () => {
  it("names all four stages and the parcel", () => {
    mount();
    for (const label of ["To order", "Ordered", "At warehouse", "QC done", "Parcel A"]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });

  it("says who owns the work, before anything else", () => {
    mount();
    expect(
      screen.getByText("Every stage below is yours to mark. Credenza never touches your agent.")
    ).toBeTruthy();
  });

  it("names the agent the person buys through", () => {
    mount({ agentName: "Superbuy" });
    expect(screen.getByText("Superbuy")).toBeTruthy();
  });

  it("says the parcel is empty in words, never with a bare dash", () => {
    mount();
    expect(screen.getByText("Nothing in the box.", { exact: false })).toBeTruthy();
    expect(screen.getAllByText("not yet").length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toContain("—");
  });

  it("puts a card in the column its stage names", () => {
    mount({ items: [item({ id: "a", stage: "toOrder" }), item({ id: "b", stage: "parcel" })] });
    const columns = document.querySelectorAll(".cz-hb-track > .cz-hb-col");
    expect(columns.length).toBe(4);
    expect(columns[0].querySelectorAll(".cz-hb-card").length).toBe(1);
    expect(document.querySelectorAll(".cz-hb-parcel .cz-hb-row").length).toBe(1);
  });

  // Kyle 2026-08-02: "we can't have the parcel page being cut off." It was the
  // fifth column of a track wider than the page. It now sits below the track.
  it("keeps the parcel out of the side-scrolling track", () => {
    mount();
    expect(document.querySelector(".cz-hb-track .cz-hb-parcel")).toBe(null);
    expect(document.querySelector(".cz-hb > .cz-hb-parcel")).toBeTruthy();
  });
});

describe("what a card offers", () => {
  it("gives one action, not two", () => {
    mount();
    const card = document.querySelector(".cz-hb-card");
    expect(card.querySelectorAll(".cz-hb-action").length).toBe(1);
  });

  it("opens the card when the person taps it", () => {
    const props = mount();
    fireEvent.click(document.querySelector(".cz-hb-card"));
    expect(props.onOpenItem).toHaveBeenCalledWith("a");
  });

  it("runs the action without also opening the card", () => {
    const props = mount();
    fireEvent.click(screen.getByText("Copy link"));
    expect(props.onItemAction).toHaveBeenCalled();
    expect(props.onOpenItem).not.toHaveBeenCalled();
  });

  it("offers the column action once the column holds something", () => {
    const props = mount();
    fireEvent.click(screen.getByText("Copy all links"));
    expect(props.onColumnFooter).toHaveBeenCalledWith("toOrder");
  });
});

describe("the parcel panel", () => {
  const packed = [
    item({ id: "a", stage: "parcel", qc: "green", actual: 900, vol: 4000 }),
    item({ id: "b", stage: "parcel", qc: "green", actual: 600, vol: 2000 }),
  ];

  it("shows the four sums the person checks against the agent", () => {
    mount({ items: packed });
    for (const label of ["actual + packaging", "chargeable", "billed at"]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    expect(screen.getByText("volumetric ÷ 6000")).toBeTruthy();
  });

  it("lets the person take an item back out", () => {
    const props = mount({ items: packed });
    fireEvent.click(screen.getAllByLabelText("Remove from parcel")[0]);
    expect(props.onRemoveFromParcel).toHaveBeenCalledWith("a");
  });

  it("moves every number when the divisor changes", () => {
    const props = mount({ items: packed });
    fireEvent.click(screen.getByText("5000"));
    expect(props.onSetDivisor).toHaveBeenCalledWith(5000);
  });

  it("prices all three lines and marks the chosen one", () => {
    mount({ items: packed, ship: { line: "DHL" } });
    const chosen = document.querySelectorAll(".cz-hb-line-on");
    expect(chosen.length).toBe(1);
    expect(chosen[0].textContent).toContain("DHL");
  });

  it("saves a rate the person edits", () => {
    const props = mount({ items: packed });
    fireEvent.change(screen.getByLabelText("Rate per kg for EMS"), { target: { value: "14.5" } });
    expect(props.onSetRate).toHaveBeenCalledWith("EMS", 14.5);
  });

  it("refuses the hand-off while the box is empty", () => {
    mount();
    const cta = document.querySelector(".cz-hb-cta");
    expect(cta.disabled).toBe(true);
    expect(cta.textContent).toBe("Nothing in the box yet");
  });

  it("counts the parcel on the hand-off button", () => {
    const props = mount({ items: packed });
    const cta = document.querySelector(".cz-hb-cta");
    expect(cta.textContent).toBe("Review & hand off · 2");
    fireEvent.click(cta);
    expect(props.onHandOff).toHaveBeenCalled();
  });

  it("hides the second parcel until the caller can carry one", () => {
    mount({ items: packed });
    expect(screen.queryByText("+ Parcel B")).toBe(null);
    cleanup();
    mount({ items: packed, onAddParcel: vi.fn() });
    expect(screen.getByText("+ Parcel B")).toBeTruthy();
  });
});

describe("the widths the README fixes", () => {
  it("keeps four stage columns at 188px", () => {
    expect(ruleBody(".cz-hb-col")).toContain("188px");
    expect(ruleBody(".cz-hb-track")).toContain("gap: 10px");
  });

  // Kyle 2026-08-02: "we can't have the parcel page being cut off." A fixed
  // width is what cut it off. It takes the page's width and shares it.
  it("gives the parcel the full width, and lets its panels stack on a phone", () => {
    expect(ruleBody(".cz-hb-parcel")).toContain("width: 100%");
    expect(ruleBody(".cz-hb-parcel")).not.toContain("280px");
    expect(ruleBody(".cz-hb-parcel-grid")).toContain("repeat(auto-fit, minmax(240px, 1fr))");
  });

  it("leaves room for the rate the person types and the cost beside it", () => {
    expect(ruleBody(".cz-hb-rate")).toContain("width: 72px");
    expect(ruleBody(".cz-hb-cost")).toContain("min-width: 56px");
  });

  it("rules the parcel's head in ink, not hairline", () => {
    expect(ruleBody(".cz-hb-col-head")).toContain("var(--cz-hair)");
    expect(ruleBody(".cz-hb-col-head-ink")).toContain("var(--cz-ink)");
  });

  it("gives a finger a 44px target", () => {
    const i = DECLS.indexOf("@media (pointer: coarse) {\n  .cz-hb-action,");
    expect(i).toBeGreaterThan(-1);
    expect(DECLS.slice(i, i + 260)).toContain("min-height: 44px");
  });

  it("uses tokens for colour, never a raw hex", () => {
    const start = DECLS.indexOf(".cz-hb {");
    const board = DECLS.slice(start);
    expect(board.match(/#[0-9a-fA-F]{3,8}\b/)).toBe(null);
  });

  it("uses the one motion curve, never a bare duration", () => {
    const start = DECLS.indexOf(".cz-hb {");
    const board = DECLS.slice(start);
    expect(board).toContain("var(--dur-micro) var(--ease-out)");
    expect(board.match(/transition:[^;]*\b\d+ms/)).toBe(null);
  });
});

// Design review 2 · change 5.
// Kyle 2026-08-02: "please update the font of the numbers to be consistent,
// the numbers on the left look all wonky."
describe("every number on the board reads as one set of numbers", () => {
  // A proportional face gives 1 a narrower box than 0. A column of sums then
  // shifts sideways as the figures change, which is the wobble Kyle saw.
  const NUMBERS = [
    ".cz-hb-sum-label",
    ".cz-hb-sum-value",
    ".cz-hb-sum-big",
    ".cz-hb-chip",
    ".cz-hb-rate",
    ".cz-hb-cost",
    ".cz-hb-value-mono",
    ".cz-hb-row-weight",
    ".cz-hb-price",
    ".cz-hb-count",
  ];

  it.each(NUMBERS)("%s holds every digit in the same width", (selector) => {
    expect(ruleBody(selector)).toContain("font-variant-numeric: tabular-nums");
  });

  it.each(NUMBERS)("%s uses the number face", (selector) => {
    expect(ruleBody(selector)).toContain("font-family: var(--cz-mono)");
  });

  // A label and its own value sat in two different typefaces. Now they match.
  it("gives the maths labels the same face as the values beside them", () => {
    expect(ruleBody(".cz-hb-sum-label")).toContain("font-family: var(--cz-mono)");
    expect(ruleBody(".cz-hb-sum-strong")).toContain("font-family: var(--cz-mono)");
  });

  // The panel ran 9.5, 10.5, 11, 11.5, 12.5 and 14 at once. Three steps now:
  // a chip or rate, a row, and the one chargeable total.
  it("runs three number sizes, not six", () => {
    const sizes = new Set();
    for (const selector of [...NUMBERS, ".cz-hb-sum-strong"]) {
      const body = ruleBody(selector) || "";
      const found = body.match(/font-size:\s*([\d.]+)px/);
      if (found) sizes.add(found[1]);
    }
    expect([...sizes].sort()).toEqual(["10.5", "11.5", "14"]);
  });

  // The kicker prints words, not numbers, so it keeps its own smaller size.
  it("leaves the uppercase kicker alone", () => {
    expect(ruleBody(".cz-hb-label")).toContain("font-size: 9px");
  });
});

describe("the app renders the board", () => {
  it("mounts it inside the open haul", () => {
    expect(APP).toContain("<HaulFlowBoard");
    expect(APP).toContain('import HaulFlowBoard from "./components/HaulFlowBoard.jsx"');
  });

  it("builds the board's items from the whole haul, not the search results", () => {
    expect(APP).toContain("const haulFlowItems = useMemo");
    expect(APP).toContain("shelfAll");
  });

  // README line 144, and Kyle 2026-08-02: a red-lit item's button opens QC. It
  // used to copy the return message with no screen in between, which hid the
  // one question the person had: what is wrong with it.
  it("opens QC on a red light instead of copying in silence", () => {
    expect(APP).not.toContain("returnMessage({ item, reason: item.reason })");
    expect(APP).not.toContain("Return message copied.");
  });
});
