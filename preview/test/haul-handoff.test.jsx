// The hand-off screen (design/handoffs/haul/README.md, screen 9).
//
// The moment the app admits it cannot act for you. Two rules these tests exist
// to hold:
//
//   A green-lit item that stays behind keeps full opacity and a money-green
//   action. It costs a second parcel for nothing, so it must not read as a
//   dimmed leftover.
//
//   The declared-value warning never advises. It states what usually happens
//   and stops. This is a customs liability boundary.
//
// haul-fulfillment.test.js already proves handoffView and its parts. These
// prove the screen.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import HaulHandoff from "../../components/HaulHandoff.jsx";

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
    qc: null,
    reason: null,
    photos: 12,
    storage: 58,
    order: "SB-8827101",
    url: "https://weidian.com/item.html?itemID=1",
    ...over,
  };
}

function mount(over = {}) {
  const props = {
    items: over.items || [item()],
    maths: null,
    line: "EMS",
    declared: 40,
    domesticUsd: 18.4,
    tileFor: () => ({ image: null, tint: "#ff5a3c" }),
    onClose: vi.fn(),
    onCopy: vi.fn(),
    onAddToParcel: vi.fn(),
    onSetDeclared: vi.fn(),
    onSubmit: vi.fn(),
    ...over,
  };
  render(<HaulHandoff {...props} />);
  return props;
}

describe("what the screen says", () => {
  it("says the app cannot submit the parcel for you", () => {
    mount();
    expect(screen.getByRole("heading", { name: "Hand parcel A to your agent" })).toBeTruthy();
    expect(
      screen.getByText(/Credenza can’t submit this for you/)
    ).toBeTruthy();
  });

  it("lists what is in the box, with its weight and price", () => {
    mount();
    expect(screen.getByText("In the box · 1")).toBeTruthy();
    expect(screen.getByText("Cargo trousers")).toBeTruthy();
    expect(screen.getByText("Large · SB-8827101")).toBeTruthy();
    expect(screen.getByText("500 g")).toBeTruthy();
    // The goods total in the summary is the same number, so read the row.
    const price = document.querySelector(".cz-ho-row .cz-ho-price");
    expect(price.textContent).toBe("$42.00");
  });

  it("shows the instruction the agent needs, in both languages", () => {
    mount();
    const block = document.querySelector(".cz-ho-block");
    expect(block.textContent).toContain("Please pack this item into one parcel:");
    expect(block.textContent).toContain("请将以上");
    expect(screen.getByText("EN + 中文")).toBeTruthy();
  });

  it("totals the goods, the domestic leg and the line", () => {
    mount();
    expect(screen.getByText("Goods in this box")).toBeTruthy();
    expect(screen.getByText("$18.40")).toBeTruthy();
    expect(screen.getByText("Landed")).toBeTruthy();
    expect(document.querySelector(".cz-ho-landvalue").textContent).toMatch(/^\$\d/);
  });

  it("says Credenza does not press send", () => {
    mount();
    expect(
      screen.getByText(
        /Marks the parcel submitted here\. You still have to press send on your agent’s site\./
      )
    ).toBeTruthy();
  });
});

describe("what stays behind", () => {
  it("gives a green-lit leftover full opacity and an action", () => {
    mount({
      items: [item(), item({ id: "b", stage: "qcd", qc: "green", actual: 268, title: "Hoodie" })],
    });
    const row = document.querySelectorAll(".cz-ho-row-left")[0];
    expect(row.dataset.dim).toBe("false");
    expect(screen.getByRole("button", { name: "Add to the box" })).toBeTruthy();
  });

  it("dims a red-lit leftover and offers no action", () => {
    mount({
      items: [item(), item({ id: "b", stage: "qcd", qc: "red", reason: "stitching" })],
    });
    const row = document.querySelectorAll(".cz-ho-row-left")[0];
    expect(row.dataset.dim).toBe("true");
    expect(screen.getByText("can't ship")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Add to the box" })).toBe(null);
  });

  it("dims an unreviewed leftover and says it stays behind", () => {
    mount({ items: [item(), item({ id: "b", stage: "warehouse", qc: null, photos: 12 })] });
    expect(document.querySelectorAll(".cz-ho-row-left")[0].dataset.dim).toBe("true");
    expect(screen.getByText("stays behind")).toBeTruthy();
    expect(screen.getByText("not reviewed yet · 12 photos")).toBeTruthy();
  });

  it("hides the whole section when nothing stays behind", () => {
    mount();
    expect(screen.queryByText("What stays behind")).toBe(null);
  });

  it("puts a green-lit leftover into the box on one press", () => {
    const props = mount({
      items: [item(), item({ id: "b", stage: "qcd", qc: "green", actual: 268 })],
    });
    fireEvent.click(screen.getByRole("button", { name: "Add to the box" }));
    expect(props.onAddToParcel).toHaveBeenCalledWith("b");
  });
});

describe("the three things the person can do", () => {
  it("copies the exact instruction that is on screen", () => {
    const props = mount();
    fireEvent.click(screen.getByRole("button", { name: "Copy instruction" }));
    expect(props.onCopy).toHaveBeenCalledTimes(1);
    expect(props.onCopy.mock.calls[0][0]).toBe(document.querySelector(".cz-ho-block").textContent);
  });

  it("saves the declared value the person types", () => {
    const props = mount();
    fireEvent.change(screen.getByLabelText("Declared value"), { target: { value: "60" } });
    expect(props.onSetDeclared).toHaveBeenCalledWith(60);
  });

  it("reads an empty declared value as zero, never as nothing", () => {
    const props = mount();
    fireEvent.change(screen.getByLabelText("Declared value"), { target: { value: "" } });
    expect(props.onSetDeclared).toHaveBeenCalledWith(0);
  });

  it("marks the parcel submitted", () => {
    const props = mount();
    fireEvent.click(screen.getByRole("button", { name: "Mark submitted to agent" }));
    expect(props.onSubmit).toHaveBeenCalledTimes(1);
  });

  it("goes back to the board", () => {
    const props = mount();
    fireEvent.click(screen.getByRole("button", { name: /Back to the board/ }));
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });
});

describe("the declared-value warning", () => {
  it("states the threshold and refuses to advise, above it", () => {
    mount({ declared: 60 });
    expect(
      screen.getByText(
        "Over $45.00 your country usually charges duty on arrival. Your call, your risk. Credenza does not advise on this."
      )
    ).toBeTruthy();
  });

  it("states the threshold and refuses to advise, under it", () => {
    mount({ declared: 30 });
    expect(
      screen.getByText(
        "Under the $45.00 threshold your country usually charges duty at. Your call, your risk. Credenza does not advise on this."
      )
    ).toBeTruthy();
  });
});

describe("the shape the README fixes", () => {
  it("caps the page at 1000px and centres it", () => {
    const page = ruleBody(".cz-ho-page");
    expect(page).toContain("max-width: 1000px");
    expect(page).toContain("margin: 0 auto");
  });

  it("flexes the left column and pins the right one at 320px", () => {
    expect(ruleBody(".cz-ho-cols")).toContain("gap: 20px");
    expect(ruleBody(".cz-ho-left")).toContain("flex: 1 1 auto");
    const right = ruleBody(".cz-ho-right");
    expect(right).toContain("flex: 0 0 320px");
    expect(right).toContain("width: 320px");
  });

  it("dims only the rows the person cannot act on", () => {
    expect(ruleBody('.cz-ho-row-left[data-dim="true"]')).toContain("opacity: 0.62");
    expect(ruleBody(".cz-ho-row-left")).not.toContain("opacity");
  });

  it("draws the add-to-the-box action in money green", () => {
    const add = ruleBody(".cz-ho-add");
    expect(add).toContain("border: 1px solid var(--cz-money)");
    expect(add).toContain("background: var(--cz-money-bg)");
    expect(add).toContain("color: var(--cz-money)");
    expect(add).toContain("border-radius: 999px");
  });

  it("sizes the row tile at 40 by 50", () => {
    const tile = ruleBody(".cz-ho-tile");
    expect(tile).toContain("width: 40px");
    expect(tile).toContain("height: 50px");
    expect(tile).toContain("border-radius: 8px");
  });

  it("wraps the instruction instead of clipping it", () => {
    const block = ruleBody(".cz-ho-block");
    expect(block).toContain("white-space: pre-wrap");
    expect(block).toContain("font-family: var(--cz-mono)");
    expect(block).toContain("font-size: 11.5px");
    expect(block).toContain("background: var(--cz-inset-bg)");
  });

  it("prints the landed total large and in money green", () => {
    const land = ruleBody(".cz-ho-landvalue");
    expect(land).toContain("font-size: 16px");
    expect(land).toContain("font-weight: 700");
    expect(land).toContain("color: var(--cz-money)");
  });

  it("gives every tapped control a 44px floor on a touch screen", () => {
    const i = DECLS.indexOf("@media (pointer: coarse) {\n  .cz-ho-back,");
    expect(i).toBeGreaterThan(-1);
    expect(DECLS.slice(i, i + 260)).toContain("min-height: 44px");
  });

  it("stacks the columns and stops the phone zooming into the field", () => {
    const i = DECLS.indexOf("@media (max-width: 767px) {\n  .cz-ho-page {");
    expect(i).toBeGreaterThan(-1);
    const block = DECLS.slice(i, i + 420);
    expect(block).toContain("flex-direction: column");
    expect(block).toContain("font-size: 16px");
  });

  it("uses tokens, never a raw colour", () => {
    const start = DECLS.indexOf("\n.cz-ho {");
    expect(start).toBeGreaterThan(-1);
    expect(DECLS.slice(start)).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it("moves on the one motion curve, never a bare duration", () => {
    const start = DECLS.indexOf("\n.cz-ho {");
    const block = DECLS.slice(start);
    expect(block).toContain("var(--dur-micro) var(--ease-out)");
    expect(block).not.toMatch(/transition:[^;]*\b\d+ms\b/);
  });
});

describe("the app opens the screen", () => {
  it("loads it only when a haul is open", () => {
    expect(APP).toContain('import("./components/HaulHandoff.jsx")');
    expect(APP).toContain("{handoffOpen && openHaulName && (");
    expect(APP).toContain("openHandoff();");
  });

  it("marks the parcel submitted here only", () => {
    const i = APP.indexOf("submitted: true,");
    expect(i).toBeGreaterThan(-1);
    // Marking it sets the parcel to step one and stamps that step's date.
    expect(APP.slice(i, i + 200)).toContain("milestone: 0,");
    expect(APP).toContain("You still have to press send on your agent's site.");
  });

  it("closes it when the haul closes", () => {
    const i = APP.indexOf("const closeHaul = useCallback");
    expect(APP.slice(i, i + 1400)).toContain("setHandoffOpen(false)");
  });
});
