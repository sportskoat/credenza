// The tracking screen (haul handoff README, screens 10 and 11).
//
// README: "This is the state a haul sits in longest, so it has to say
// something useful." Every assertion below reads a value the README fixes, not
// a value the code happens to produce.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import HaulTracking from "../../components/HaulTracking.jsx";

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
    price: 42,
    est: 500,
    actual: 500,
    vol: 0,
    stage: "parcel",
    qc: "green",
    reason: null,
    photos: 12,
    storage: 58,
    order: "SB-8827101",
    url: "https://weidian.com/item.html?itemID=1",
    ...over,
  };
}

function draw(props = {}) {
  return render(<HaulTracking items={[item()]} line="EMS" domesticUsd={18.4} {...props} />);
}

describe("the tracking screen", () => {
  it("says out loud that nothing here polls the agent", () => {
    draw();
    expect(screen.getByText("Tap each step as it happens. Nothing here polls your agent.")).toBeTruthy();
  });

  it("names the parcel and reads it out in the mono meta line", () => {
    draw();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Parcel A");
    expect(document.querySelector(".cz-ht-meta").textContent).toMatch(/^1 ITEMS · [\d.]+ KG · EMS$/);
  });

  it("shows the four steps the README names, in order", () => {
    draw();
    const labels = [...document.querySelectorAll(".cz-ht-steplabel")].map((n) => n.textContent);
    expect(labels).toEqual([
      "Submitted to the agent",
      "Shipped",
      "Cleared customs",
      "Received",
    ]);
  });

  it("ticks every step up to the one the parcel has reached", () => {
    draw({ milestone: 1 });
    const marks = [...document.querySelectorAll(".cz-ht-mark")].map((n) => n.dataset.done);
    expect(marks).toEqual(["true", "true", "false", "false"]);
  });

  it("lets a step be taken back, because a step marked early is a lie", () => {
    const onPickStep = vi.fn();
    draw({ milestone: 3, onPickStep });
    fireEvent.click(document.querySelectorAll(".cz-ht-step")[1]);
    expect(onPickStep).toHaveBeenCalledWith(1);
  });

  it("saves the tracking number as the person types it", () => {
    const onSetTracking = vi.fn();
    draw({ onSetTracking });
    fireEvent.change(screen.getByLabelText("Tracking number"), { target: { value: "LX99" } });
    expect(onSetTracking).toHaveBeenCalledWith("LX99");
  });

  it("refuses to open a carrier search with no number in it", () => {
    draw({ tracking: "" });
    const link = document.querySelector(".cz-ht-track");
    expect(link.getAttribute("aria-disabled")).toBe("true");
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    link.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it("opens the carrier in a new tab once there is a number", () => {
    draw({ tracking: "LX99 001" });
    const link = document.querySelector(".cz-ht-track");
    expect(link.getAttribute("href")).toBe("https://parcelsapp.com/en/tracking/LX99%20001");
    expect(link.getAttribute("aria-disabled")).toBe("false");
    expect(link.getAttribute("rel")).toContain("noopener");
  });

  it("hides the fit questions until the box arrives", () => {
    draw({ milestone: 2 });
    expect(screen.queryByText("Did the size call hold?")).toBe(null);
  });

  it("asks how the size call held once the box arrives", () => {
    draw({ milestone: 3 });
    expect(screen.getByText("Did the size call hold?")).toBeTruthy();
    expect(
      screen.getByText(
        "One tap each. This is what makes the next size recommendation better than a guess."
      )
    ).toBeTruthy();
    expect([...document.querySelectorAll(".cz-ht-chip")].map((n) => n.textContent)).toEqual([
      "tight",
      "right",
      "roomy",
    ]);
  });

  it("hands the fit answer back with the item it belongs to", () => {
    const onSetFit = vi.fn();
    draw({ milestone: 3, onSetFit });
    fireEvent.click(document.querySelectorAll(".cz-ht-chip")[2]);
    expect(onSetFit).toHaveBeenCalledWith("a", "roomy");
  });

  it("marks the saved fit answer as the live one", () => {
    draw({ milestone: 3, fits: { a: "tight" } });
    const chips = [...document.querySelectorAll(".cz-ht-chip")];
    expect(chips.map((n) => n.dataset.active)).toEqual(["true", "false", "false"]);
    expect(chips[0].getAttribute("aria-pressed")).toBe("true");
  });

  it("keeps the landed number a projection until the box arrives", () => {
    draw({ milestone: 1 });
    expect(document.querySelector(".cz-ht-note").textContent).toBe(
      "Final once it clears customs. Duty is not in here."
    );
  });

  it("turns the landed number into the answer once the box arrives", () => {
    draw({ milestone: 3 });
    expect(document.querySelector(".cz-ht-note").textContent).toBe(
      "This is the number to quote when someone asks what the haul cost."
    );
  });

  it("adds the goods, the domestic leg and the line into one landed number", () => {
    draw();
    const values = [...document.querySelectorAll(".cz-ht-sumvalue")].map((n) => n.textContent);
    expect(values[0]).toBe("$42.00");
    expect(values[1]).toBe("$18.40");
    expect(document.querySelector(".cz-ht-landvalue").textContent).toMatch(/^\$\d+\.\d\d$/);
  });

  it("says what is still at the warehouse while the parcel flies", () => {
    draw({ items: [item(), item({ id: "b", stage: "warehouse", storage: 12 })] });
    expect(document.querySelector(".cz-ht-remain").textContent).toBe(
      "1 item stays behind, oldest has 12 days of free storage left. They can go in parcel B."
    );
  });

  it("gives two ways back to the board", () => {
    const onClose = vi.fn();
    draw({ onClose });
    fireEvent.click(document.querySelector(".cz-ht-back"));
    fireEvent.click(document.querySelector(".cz-ht-outline"));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("carries no emoji and no exclamation mark", () => {
    draw({ milestone: 3 });
    const text = document.body.textContent;
    expect(text).not.toMatch(/!/);
    expect(text).not.toMatch(/—/);
  });
});

describe("the tracking screen's styling", () => {
  it("holds the page at the width the README fixes", () => {
    expect(ruleBody(".cz-ht-page")).toMatch(/max-width:\s*900px/);
  });

  it("keeps the summary column at 300px", () => {
    expect(ruleBody(".cz-ht-right")).toMatch(/width:\s*300px/);
  });

  it("draws the step marker at the size and radius the README fixes", () => {
    const body = ruleBody(".cz-ht-mark");
    expect(body).toMatch(/width:\s*18px/);
    expect(body).toMatch(/height:\s*18px/);
    expect(body).toMatch(/border-radius:\s*6px/);
    expect(body).toMatch(/border:\s*1\.5px/);
  });

  it("fills a marked step with the action colour", () => {
    expect(ruleBody('.cz-ht-mark[data-done="true"]')).toMatch(/background:\s*var\(--cz-action-fill\)/);
  });

  it("sets the step label and its date at the README's sizes", () => {
    expect(ruleBody(".cz-ht-steplabel")).toMatch(/font-size:\s*13\.5px/);
    expect(ruleBody(".cz-ht-steplabel")).toMatch(/font-weight:\s*650/);
    expect(ruleBody(".cz-ht-when")).toMatch(/font-size:\s*10\.5px/);
  });

  it("tints the step the parcel has reached", () => {
    const i = DECLS.indexOf('.cz-ht-step[data-current="true"]');
    expect(i).toBeGreaterThan(-1);
    expect(DECLS.slice(i, DECLS.indexOf("}", i))).toMatch(/background:\s*var\(--cz-accent-bg\)/);
  });

  it("draws a hairline above the tracking input", () => {
    expect(ruleBody(".cz-ht-trackrow")).toMatch(/border-top:\s*1px solid var\(--cz-hair\)/);
  });

  it("draws the fit tile at 34 by 42", () => {
    const body = ruleBody(".cz-ht-tile");
    expect(body).toMatch(/width:\s*34px/);
    expect(body).toMatch(/height:\s*42px/);
  });

  it("uses tokens for every colour, never a raw hex", () => {
    const start = DECLS.indexOf(".cz-ht {");
    expect(start).toBeGreaterThan(-1);
    expect(DECLS.slice(start)).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it("uses the one motion curve and its named durations", () => {
    const start = DECLS.indexOf(".cz-ht {");
    const block = DECLS.slice(start);
    expect(block).toMatch(/var\(--ease-out\)/);
    expect(block).not.toMatch(/transition:[^;]*\b\d+ms/);
  });

  it("drops the glass when the person asks for less transparency", () => {
    const i = DECLS.indexOf("@media (prefers-reduced-transparency: reduce) {\n  .cz-ht-card,");
    expect(i).toBeGreaterThan(-1);
    expect(DECLS.slice(i, i + 400)).toMatch(/background:\s*var\(--cz-card-solid\)/);
  });

  it("gives a finger a 44px target on every control", () => {
    const i = DECLS.indexOf("@media (pointer: coarse) {\n  .cz-ht-back,");
    expect(i).toBeGreaterThan(-1);
    const block = DECLS.slice(i, i + 400);
    for (const name of [".cz-ht-step", ".cz-ht-track", ".cz-ht-chip", ".cz-ht-outline"]) {
      expect(block).toContain(name);
    }
    expect(block).toMatch(/min-height:\s*44px/);
  });

  it("stacks the columns and stops the phone zooming into the input", () => {
    const i = DECLS.indexOf("@media (max-width: 767px) {\n  .cz-ht-page");
    expect(i).toBeGreaterThan(-1);
    const block = DECLS.slice(i, i + 700);
    expect(block).toMatch(/flex-direction:\s*column/);
    expect(block).toMatch(/font-size:\s*16px/);
  });
});

// Design review 2 · change 9.
// Kyle 2026-08-02: "for tracking, can we animate when we get shipment? can it
// pull the API for updates?" It animates. It pulls nothing.
describe("the tracking rail", () => {
  it("draws one rail behind the four steps", () => {
    draw();
    expect(document.querySelectorAll(".cz-ht-rail").length).toBe(1);
    expect(document.querySelector(".cz-ht-fill")).toBeTruthy();
  });

  it("hides the rail from a screen reader, because the marks already say it", () => {
    draw();
    expect(document.querySelector(".cz-ht-rail").getAttribute("aria-hidden")).toBe("true");
  });

  it("leaves the rail empty while only the first step is ticked", () => {
    draw({ milestone: 0 });
    expect(document.querySelector(".cz-ht-fill").getAttribute("style")).toContain("0%");
  });

  it("grows the fill to the step the parcel has reached", () => {
    // Four steps, three gaps. Two ticked means one gap of three.
    draw({ milestone: 1 });
    expect(document.querySelector(".cz-ht-fill").getAttribute("style")).toContain("33%");
  });

  it("fills the whole rail once the box arrives", () => {
    draw({ milestone: 3 });
    expect(document.querySelector(".cz-ht-fill").getAttribute("style")).toContain("100%");
  });

  it("moves the fill with a named duration, never a bare number", () => {
    const body = ruleBody(".cz-ht-fill");
    expect(body).toMatch(/transition:\s*height var\(--dur-open\) var\(--ease-out\)/);
    expect(body).not.toMatch(/\b\d+ms/);
  });

  it("lets the fill jump for a person who asks for less motion", () => {
    // credenza.css:529-536 already kills every transition for that person.
    // The rail must add no rule of its own that outranks it.
    const body = ruleBody(".cz-ht-fill");
    expect(body).not.toMatch(/!important/);
  });

  it("still promises that nothing polls the agent", () => {
    draw({ milestone: 3 });
    expect(
      screen.getByText("Tap each step as it happens. Nothing here polls your agent.")
    ).toBeTruthy();
  });
});

describe("the tracking screen inside the app", () => {
  it("loads only when the parcel is on the way", () => {
    expect(APP).toMatch(/lazy\(\(\) => import\("\.\/components\/HaulTracking\.jsx"\)\)/);
    expect(APP).toContain("{trackingOpen && openHaulName && (");
  });

  it("closes with the haul it belongs to", () => {
    const i = APP.indexOf("const closeHaul = useCallback(");
    expect(APP.slice(i, i + 1400)).toContain("setTrackingOpen(false)");
  });

  it("saves the fit answer on the card, so a reload keeps it", () => {
    expect(APP).toMatch(/haulFit:\s*null/);
    expect(APP).toMatch(/haulFit:\s*FIT_OPTIONS\.includes\(old\.haulFit\)/);
  });

  it("keeps one date slot per step, so a step taken back keeps its date", () => {
    expect(APP).toContain("milestoneAt: MILESTONES.map(");
  });
});
