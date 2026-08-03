// The haul item drawer (design/handoffs/haul/README.md, screen 8).
//
// One item, opened from the stage board. The drawer answers three questions in
// order: where is it, what does it weigh, what can I do next.
//
// The rule these tests exist to hold: every stage row stays tappable, forwards
// and back. A stage is a claim about the real world, and the real world
// corrects itself. A one-way ratchet would force the person to lie to the app.
//
// haul-fulfillment.test.js already proves itemDrawer and resetToShelf. These
// prove the screen.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import HaulItemDrawer from "../../components/HaulItemDrawer.jsx";

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
    stage: "warehouse",
    qc: null,
    reason: null,
    photos: 12,
    storage: 58,
    order: "SB-8827101",
    when: null,
    url: "https://weidian.com/item.html?itemID=1",
    ...over,
  };
}

function mount(over = {}) {
  const props = {
    item: over.item || item(),
    face: over.face === undefined ? { image: null, tint: "#ff5a3c" } : over.face,
    onClose: vi.fn(),
    onPatch: vi.fn(),
    onReviewQc: vi.fn(),
    onAddToParcel: vi.fn(),
    onBackToShelf: vi.fn(),
    ...over,
  };
  render(<HaulItemDrawer {...props} />);
  return props;
}

describe("what the drawer shows", () => {
  it("names the item, its size line and its price", () => {
    mount();
    expect(screen.getByText("Cargo trousers")).toBeTruthy();
    expect(screen.getByText("Large · WEIDIAN")).toBeTruthy();
    expect(screen.getByText("$42.00")).toBeTruthy();
  });

  it("lists all five stages, whichever one the item is on", () => {
    mount();
    const labels = ["Not ordered", "Ordered", "At the warehouse", "QC done", "In parcel A"];
    labels.forEach((label) => expect(screen.getByText(label)).toBeTruthy());
  });

  it("marks the stage the item is on, and every stage behind it", () => {
    mount({ item: item({ stage: "warehouse" }) });
    const rows = document.querySelectorAll(".cz-hd-stage");
    expect([...rows].map((row) => row.dataset.state)).toEqual([
      "done",
      "done",
      "current",
      "ahead",
      "ahead",
    ]);
  });

  it("says the weight is a guess until the agent weighs it", () => {
    mount({ item: item({ est: 500, actual: null }) });
    expect(document.querySelector(".cz-hd-number").value).toBe("500");
    expect(
      screen.getByText("Your estimate. It gets overwritten the moment the agent weighs it.")
    ).toBeTruthy();
  });

  it("shows the storage clock in its own box", () => {
    mount({ item: item({ storage: 58 }) });
    expect(document.querySelector(".cz-hd-storage").textContent).toBe(
      "Free storage ends in 58 days."
    );
  });

  it("drops the storage box when nothing is on a clock", () => {
    mount({ item: item({ storage: null }) });
    expect(document.querySelector(".cz-hd-storage")).toBe(null);
  });

  it("never prints a bare dash for a number it does not have", () => {
    mount({ item: item({ actual: null, storage: null, order: "" }) });
    expect(document.body.textContent).not.toContain("—");
  });
});

describe("moving the item", () => {
  it("moves the item forward when a later stage is tapped", () => {
    const props = mount({ item: item({ stage: "warehouse" }) });
    fireEvent.click(screen.getByText("In parcel A"));
    expect(props.onPatch).toHaveBeenCalledTimes(1);
    expect(props.onPatch.mock.calls[0][0]).toBe("a");
    expect(props.onPatch.mock.calls[0][1].haulStage).toBe("parcel");
  });

  it("moves the item back when an earlier stage is tapped", () => {
    // The whole reason the rows stay live. An order gets cancelled; the person
    // must be able to say so.
    const props = mount({ item: item({ stage: "parcel" }) });
    fireEvent.click(screen.getByText("Not ordered"));
    expect(props.onPatch.mock.calls[0][1].haulStage).toBe("toOrder");
  });

  it("does nothing when the current stage is tapped", () => {
    const props = mount({ item: item({ stage: "warehouse" }) });
    fireEvent.click(screen.getByText("At the warehouse"));
    expect(props.onPatch).not.toHaveBeenCalled();
  });
});

describe("the numbers the person supplies", () => {
  it("saves a typed weight in grams, and the day it landed", () => {
    const props = mount();
    fireEvent.change(document.querySelector(".cz-hd-number"), { target: { value: "512" } });
    const patch = props.onPatch.mock.calls[0][1];
    expect(patch.haulActualGrams).toBe(512);
    expect(typeof patch.haulWeighedAt).toBe("number");
  });

  // A date left behind on an emptied field would claim the warehouse weighed
  // something the app no longer holds.
  it("treats a cleared weight as no weight, not as zero grams", () => {
    const props = mount();
    fireEvent.change(document.querySelector(".cz-hd-number"), { target: { value: "" } });
    expect(props.onPatch).toHaveBeenCalledWith("a", {
      haulActualGrams: null,
      haulWeighedAt: null,
    });
  });

  it("saves the agent's order number", () => {
    const props = mount();
    fireEvent.change(document.querySelector(".cz-hd-text"), { target: { value: "SB-9" } });
    expect(props.onPatch).toHaveBeenCalledWith("a", { haulOrderNo: "SB-9" });
  });
});

describe("the three actions", () => {
  it("opens QC review and counts the photos", () => {
    const props = mount({ item: item({ photos: 12, qc: null }) });
    fireEvent.click(screen.getByText("Review QC · 12 photos"));
    expect(props.onReviewQc).toHaveBeenCalledWith("a");
  });

  it("offers no QC button when no photos exist", () => {
    mount({ item: item({ photos: 0 }) });
    expect(document.querySelector(".cz-hd-cta")).toBe(null);
  });

  it("offers the parcel only to a green-lit item that is not packed", () => {
    const props = mount({ item: item({ qc: "green", stage: "qcd" }) });
    fireEvent.click(screen.getByText("Add to parcel A"));
    expect(props.onAddToParcel).toHaveBeenCalledWith("a");

    cleanup();
    mount({ item: item({ qc: "green", stage: "parcel" }) });
    expect(screen.queryByText("Add to parcel A")).toBe(null);
  });

  it("always offers the way back to the shelf", () => {
    const props = mount({ item: item({ stage: "toOrder", photos: 0 }) });
    fireEvent.click(screen.getByText("Move back to the shelf"));
    expect(props.onBackToShelf).toHaveBeenCalledWith("a");
  });

  it("closes on the close button", () => {
    const props = mount();
    fireEvent.click(screen.getByLabelText("Close"));
    expect(props.onClose).toHaveBeenCalled();
  });
});

// Kyle 2026-08-02: "there's no screen that tells you what the problem with the
// article of clothing is and what to send or what to copy to the agent". The
// reason was stored and never shown. These tests hold the screen that shows it.
describe("the red light names its problem", () => {
  it("prints the reason as a sentence", () => {
    mount({ item: item({ qc: "red", stage: "qcd", reason: "stitching" }) });
    expect(document.querySelector(".cz-hd-red-text").textContent).toBe(
      "The stitching is coming apart."
    );
  });

  it("leads to the return message in one press", () => {
    const props = mount({ item: item({ qc: "red", stage: "qcd", reason: "stain" }) });
    fireEvent.click(screen.getByText("Write the return message"));
    expect(props.onReviewQc).toHaveBeenCalledWith("a");
  });

  it("says the reason is missing rather than showing an empty box", () => {
    mount({ item: item({ qc: "red", stage: "qcd", reason: null }) });
    expect(document.querySelector(".cz-hd-red-text").textContent).toBe(
      "The reason is not set yet. Open QC to pick it."
    );
  });

  it("shows no red block on a green light or on no verdict", () => {
    mount({ item: item({ qc: "green", stage: "qcd" }) });
    expect(document.querySelector(".cz-hd-red")).toBe(null);

    cleanup();
    mount({ item: item({ qc: null, stage: "warehouse" }) });
    expect(document.querySelector(".cz-hd-red")).toBe(null);
  });

  it("carries the error tint, not a warning outline", () => {
    // A tinted panel reads as a state of the item. A red outline reads as a
    // form field filled in wrong, and the person did nothing wrong.
    expect(ruleBody(".cz-hd-red")).toContain("background: var(--cz-error-bg)");
    expect(ruleBody(".cz-hd-red-kicker")).toContain("color: var(--cz-error-text)");
  });
});

// Kyle 2026-08-02: "you're making sure that it's not just an estimate. It is
// just what comes from the warehouse." The line beside the weight says which of
// the two the number is.
describe("the weight says where it came from", () => {
  it("calls an unweighed number an estimate", () => {
    mount({ item: item({ est: 500, actual: null }) });
    const source = document.querySelector(".cz-hd-source");
    expect(source.textContent).toBe("Estimate. Not weighed yet.");
    expect(source.dataset.weighed).toBe("no");
  });

  it("names the warehouse scale once the agent weighs it", () => {
    mount({ item: item({ est: 500, actual: 512, weighedAt: "2026-08-02T10:00:00Z" }) });
    const source = document.querySelector(".cz-hd-source");
    expect(source.textContent).toMatch(/^Warehouse scale · /);
    expect(source.dataset.weighed).toBe("yes");
  });

  it("keeps the person's own estimate on screen underneath", () => {
    // The label answers "where did this come from". The note answers "how far
    // off was I". Kyle asked for the first without losing the second.
    mount({ item: item({ est: 1100, actual: 1140, weighedAt: "2026-08-02T10:00:00Z" }) });
    expect(document.querySelector(".cz-hd-note").textContent).toContain("Your estimate was 1.10 kg");
  });

  it("colours a warehouse number as money and a guess as grey", () => {
    expect(ruleBody(".cz-hd-source")).toContain("color: var(--cz-faint)");
    expect(ruleBody('.cz-hd-source[data-weighed="yes"]')).toContain("color: var(--cz-money)");
  });

  it("holds the tick's place so the line does not jump when a weight lands", () => {
    const body = ruleBody(".cz-hd-source-mark");
    expect(body).toContain("width: 13px");
    expect(body).toContain("flex: 0 0 13px");
  });
});

describe("the shape the README fixes", () => {
  it("holds the drawer at 352px on the right edge", () => {
    const body = ruleBody(".cz-hd");
    expect(body).toContain("width: 352px");
    expect(body).toContain("margin: 0 0 0 auto");
    expect(ruleBody(".cz-hd-panel")).toContain("border-left: 1px solid var(--cz-hair)");
  });

  it("dims the board behind it and blurs it by 6px", () => {
    const body = ruleBody(".cz-hd::backdrop");
    expect(body).toContain("oklch(0 0 0 / 0.5)");
    expect(body).toContain("blur(6px)");
  });

  it("keeps the header tile at 62 by 78", () => {
    const body = ruleBody(".cz-hd-tile");
    expect(body).toContain("width: 62px");
    expect(body).toContain("height: 78px");
  });

  it("fills the marker on a stage the item has reached", () => {
    const i = DECLS.indexOf('.cz-hd-stage[data-state="done"] .cz-hd-mark');
    expect(i).toBeGreaterThan(-1);
    const body = DECLS.slice(DECLS.indexOf("{", i), DECLS.indexOf("}", i));
    expect(body).toContain("background: var(--cz-action-fill)");
    expect(ruleBody('.cz-hd-stage[data-state="current"]')).toContain(
      "background: var(--cz-accent-bg)"
    );
  });

  it("gives every tapped control 44px on a touch screen", () => {
    const i = DECLS.indexOf("@media (pointer: coarse) {\n  .cz-hd-stage,");
    expect(i).toBeGreaterThan(-1);
    expect(DECLS.slice(i, i + 400)).toContain("min-height: 44px");
  });

  it("stops iOS zooming into the number fields", () => {
    const i = DECLS.indexOf("@media (max-width: 767px) {\n  .cz-hd {");
    expect(i).toBeGreaterThan(-1);
    expect(DECLS.slice(i, i + 300)).toContain("font-size: 16px");
  });

  it("uses tokens, never a raw hex colour", () => {
    const start = DECLS.indexOf("\n.cz-hd {");
    expect(start).toBeGreaterThan(-1);
    expect(DECLS.slice(start)).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it("moves on the one curve, never on a bare duration", () => {
    const start = DECLS.indexOf("\n.cz-hd {");
    const block = DECLS.slice(start);
    expect(block).toContain("var(--dur-micro) var(--ease-out)");
    expect(block).not.toMatch(/transition:[^;]*\d+ms/);
  });
});

describe("the app opens the drawer", () => {
  it("renders the drawer from the board's item tap", () => {
    expect(APP).toContain("<HaulItemDrawer");
    expect(APP).toContain('import("./components/HaulItemDrawer.jsx")');
    expect(APP).toContain("onOpenItem={(id) => setHaulDrawerId(id)}");
  });

  it("clears every fulfillment number when the item goes back to the shelf", () => {
    expect(APP).toContain("...resetToShelf()");
  });
});
