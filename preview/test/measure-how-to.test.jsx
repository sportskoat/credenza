import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cleanup, fireEvent, render, within } from "@testing-library/react";

import BodyProfileSheet from "../../sheets/BodyProfileSheet.jsx";
import { BODY_PROFILE_FIELDS, MEASURE_HOW_TO } from "../../credenza-fashion.jsx";
import { fitMeasureFieldsFor } from "../../components/SizeRecommendation.jsx";

// Kyle 2026-07-30: "can we get a tool tip next to each of these to inform the
// customer how best to measure this?"
//
// A tape held in the wrong place is the one input error the app cannot see. A
// chest taken under the arms grades exactly as confidently as a chest taken
// right, and the customer only learns which they did when the parcel arrives.
// So the instruction has to be one tap from the box.
//
// Every case below asserts on what a person sees or does. Deleting the fix
// makes the case fail with the reason.

afterEach(cleanup);

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CSS = fs.readFileSync(path.resolve(HERE, "../../credenza-fashion.css"), "utf8");

// Comments are stripped first: this codebase quotes its own code in its
// comments, so a whole-file search matches the explanation and keeps passing
// after the rule is deleted.
function ruleBody(selector) {
  const clean = CSS.replace(/\/\*[\s\S]*?\*\//g, "");
  const at = clean.indexOf(selector + " {");
  if (at < 0) return "";
  return clean.slice(at, clean.indexOf("}", at));
}

const noop = () => {};

const renderMeasure = () =>
  render(<BodyProfileSheet value={null} units="cm" onSave={noop} onChangeUnits={noop} onClose={noop} />);

describe("Every measurement says how to take it (Kyle 2026-07-30)", () => {
  it("gives each box its own way to ask", () => {
    const { container } = renderMeasure();
    const buttons = container.querySelectorAll(".cz-measure-how-btn");
    // Derived, not a literal: a new measurement must arrive with its own
    // instruction, and a field with no instruction should fail here.
    expect(buttons).toHaveLength(BODY_PROFILE_FIELDS.length);
  });

  it("has a written instruction for every box in the form", () => {
    const missing = BODY_PROFILE_FIELDS.filter(([key]) => !MEASURE_HOW_TO[key]);
    expect(missing.map(([, label]) => label)).toEqual([]);
  });

  it("shows the instruction when asked, and hides it again", () => {
    const { container } = renderMeasure();
    const ask = within(container).getByLabelText("How to measure chest");
    expect(within(container).queryByText(MEASURE_HOW_TO.chest)).toBeNull();

    fireEvent.click(ask);
    expect(within(container).getByText(MEASURE_HOW_TO.chest)).toBeTruthy();
    expect(ask.getAttribute("aria-expanded")).toBe("true");

    fireEvent.click(ask);
    expect(within(container).queryByText(MEASURE_HOW_TO.chest)).toBeNull();
  });

  it("opens one instruction at a time, not all of them", () => {
    const { container } = renderMeasure();
    fireEvent.click(within(container).getByLabelText("How to measure waist"));
    const open = container.querySelectorAll(".cz-measure-how");
    expect(open).toHaveLength(1);
    expect(open[0].textContent.trim()).toBe(MEASURE_HOW_TO.waist);
  });

  it("names the instruction to the input, so a screen reader reads them together", () => {
    const { container } = renderMeasure();
    fireEvent.click(within(container).getByLabelText("How to measure hip"));
    const input = within(container).getByLabelText("Hip");
    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(container.querySelector("#" + CSS_ESCAPE(describedBy)).textContent.trim()).toBe(
      MEASURE_HOW_TO.hip
    );
  });

  // useId produces colons, which are not valid on their own in a CSS selector.
  function CSS_ESCAPE(id) {
    return id.replace(/[:.]/g, "\\$&");
  }

  it("tells the two length boxes apart, because sellers measure the outside leg", () => {
    // The old form carried one standing paragraph for the whole lower-body
    // group. Both length boxes now answer for themselves, and a person who
    // opens only the shorts box still learns it is not an inside leg.
    expect(MEASURE_HOW_TO.pantsLength).toMatch(/waistband to the hem/);
    expect(MEASURE_HOW_TO.shortsLength).toMatch(/waistband to the hem/);
    expect(MEASURE_HOW_TO.pantsLength).toMatch(/trousers/i);
    expect(MEASURE_HOW_TO.shortsLength).toMatch(/shorts/i);
  });

  it("stops the standing lower-body paragraph from coming back beside the tips", () => {
    const { container } = renderMeasure();
    // Two places saying the same thing is the text Kyle asked to cut.
    expect(container.querySelectorAll(".cz-measure-note")).toHaveLength(0);
  });

  it("describes one measurement one way, on the card and in the form", () => {
    // The card's fit ask and the measurements form must not word the same
    // measurement two ways — that reads as two different measurements.
    for (const category of ["pants", "shorts", "shoes", "shirt", "outerwear", "other"]) {
      for (const field of fitMeasureFieldsFor(category)) {
        expect(field.hint).toBe(MEASURE_HOW_TO[field.key]);
      }
    }
  });

  it("opens the instruction under the box, never over the number being typed", () => {
    // A floating tooltip covers the input on a narrow phone, and this form is
    // filled in with a tape measure in the other hand.
    const body = ruleBody(".cz-measure-how");
    expect(body).not.toMatch(/position:\s*(absolute|fixed)/);
  });

  it("pads the ask out to a size a thumb can hit", () => {
    const body = ruleBody(".cz-measure-how-btn");
    expect(body).toMatch(/padding:\s*4px/);
    expect(body).toMatch(/box-sizing:\s*content-box/);
  });
});
