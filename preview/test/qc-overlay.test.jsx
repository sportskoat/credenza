// QC review overlay (design/handoffs/haul/README.md, screens 3 to 5).
//
// The screen that has to be fast. Someone reviewing twelve items should be
// done in ninety seconds, so these tests guard the things that make it fast:
// the window keyboard, the one-press verdict, the live return message, and
// "Next item →" walking the queue without a trip back to the board.
//
// haul-fulfillment.test.js already proves qcQueue, qcProgress, sellerRecord
// and returnMessage. These prove the wiring and the CSS the speed depends on.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import QcOverlay from "../../components/QcOverlay.jsx";
import { toHaulItem } from "../../haul-fulfillment.js";

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

function card(over = {}) {
  return {
    id: "a",
    title: "Balenciaga hoodie",
    size: "L",
    seller: "Wu Store",
    qcPhotos: ["data:image/png;base64,one", "data:image/png;base64,two"],
    haulStage: "warehouse",
    haulVerdict: null,
    haulReason: null,
    haulOrderNo: "SB-4417",
    ...over,
  };
}

function mount(over = {}) {
  const cards = over.cards || [card(), card({ id: "b", title: "Nike track pant" })];
  const items = cards.map((entry) => toHaulItem(entry, { estGrams: 500, priceUsd: 40 }));
  const props = {
    items,
    itemId: over.itemId || "a",
    cardFor: (id) => cards.find((entry) => entry.id === id) || null,
    allCards: cards,
    onClose: vi.fn(),
    onVerdict: vi.fn(),
    onAddToParcel: vi.fn(),
    onOpenItem: vi.fn(),
    onCopy: vi.fn(),
    ...over.props,
  };
  const view = render(<QcOverlay {...props} />);
  return { ...view, props, cards, items };
}

describe("QC overlay · the screen", () => {
  it("names the open item and counts the queue", () => {
    mount();
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Balenciaga hoodie");
    expect(document.querySelector(".cz-qcr-kicker").textContent).toContain("0 of 2 done");
    expect(document.querySelector(".cz-qcr-meta").textContent).toBe("L · SB-4417");
  });

  it("shows one thumbnail per photo and marks the open one", () => {
    mount();
    const thumbs = document.querySelectorAll(".cz-qcr-thumb");
    expect(thumbs).toHaveLength(2);
    expect(thumbs[0].getAttribute("data-current")).toBe("true");
    expect(thumbs[1].hasAttribute("data-current")).toBe(false);
  });

  it("says so plainly when the agent has sent no photos", () => {
    mount({ cards: [card({ qcPhotos: [] })], itemId: "a" });
    expect(document.querySelector(".cz-qcr-nophoto").textContent).toBe(
      "No QC photos yet. Ask your agent for them."
    );
    expect(document.querySelectorAll(".cz-qcr-arrow")[0].disabled).toBe(true);
  });
});

describe("QC overlay · the keyboard", () => {
  it("walks photos with the arrow keys, bound at the window", () => {
    mount();
    expect(screen.getByAltText("QC photo 1 of 2")).toBeTruthy();
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByAltText("QC photo 2 of 2")).toBeTruthy();
    // The last photo wraps back to the first, so a fast reviewer never stalls.
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByAltText("QC photo 1 of 2")).toBeTruthy();
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(screen.getByAltText("QC photo 2 of 2")).toBeTruthy();
  });

  it("rules green on G and red on R", () => {
    const { props } = mount();
    fireEvent.keyDown(window, { key: "g" });
    expect(props.onVerdict).toHaveBeenCalledWith("a", "green", null);
    fireEvent.keyDown(window, { key: "r" });
    expect(props.onVerdict).toHaveBeenCalledWith("a", "red", "stitching");
  });

  it("closes on Escape", () => {
    const { props } = mount();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(props.onClose).toHaveBeenCalled();
  });

  it("leaves a typed letter alone inside a field", () => {
    const { props } = mount();
    const field = document.createElement("input");
    document.body.appendChild(field);
    fireEvent.keyDown(field, { key: "g" });
    expect(props.onVerdict).not.toHaveBeenCalled();
    field.remove();
  });

  it("ignores a browser shortcut", () => {
    const { props } = mount();
    fireEvent.keyDown(window, { key: "r", metaKey: true });
    expect(props.onVerdict).not.toHaveBeenCalled();
  });
});

describe("QC overlay · the verdict", () => {
  it("offers the parcel once an item is green-lit", () => {
    const { props } = mount({ cards: [card({ haulVerdict: "green" })], itemId: "a" });
    const panel = document.querySelector('.cz-qcr-panel[data-verdict="green"]');
    expect(panel.textContent).toContain("Green-lit.");
    fireEvent.click(screen.getByText("Add to parcel A"));
    expect(props.onAddToParcel).toHaveBeenCalledWith("a");
  });

  it("hides the parcel button once the item is already in the box", () => {
    mount({
      cards: [card({ haulVerdict: "green", haulStage: "parcel" })],
      itemId: "a",
    });
    expect(screen.queryByText("Add to parcel A")).toBeNull();
  });

  it("writes the return request, in English and Chinese", () => {
    mount({ cards: [card({ haulVerdict: "red", haulReason: "stain" })], itemId: "a" });
    const message = document.querySelector(".cz-qcr-message").textContent;
    expect(message).toContain("please return order SB-4417");
    expect(message).toContain("there is a stain on the fabric");
    expect(message).toContain("有污渍");
  });

  it("rewrites the request when the reason changes", () => {
    const { props } = mount({
      cards: [card({ haulVerdict: "red", haulReason: "stain" })],
      itemId: "a",
    });
    fireEvent.click(screen.getByText("damaged"));
    expect(props.onVerdict).toHaveBeenCalledWith("a", "red", "damaged");
  });

  it("names the photo the person is looking at", () => {
    mount({ cards: [card({ haulVerdict: "red", haulReason: "stain" })], itemId: "a" });
    expect(document.querySelector(".cz-qcr-message").textContent).toContain("QC photo 1");
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(document.querySelector(".cz-qcr-message").textContent).toContain("QC photo 2");
  });

  it("copies the request and never sends it", () => {
    const { props } = mount({
      cards: [card({ haulVerdict: "red", haulReason: "stain" })],
      itemId: "a",
    });
    fireEvent.click(screen.getByText("Copy for your agent · EN + 中文"));
    expect(props.onCopy).toHaveBeenCalled();
    expect(props.onCopy.mock.calls[0][1]).toBe("Return request copied.");
    // The posture line is the product's whole promise. It stays.
    const posture = document.querySelector(".cz-qcr-posture").textContent;
    expect(posture).toContain("You send it. Credenza only writes it.");
    expect(posture).not.toContain("—");
  });
});

describe("QC overlay · the queue", () => {
  it("walks to the next item without leaving the overlay", () => {
    const { props } = mount();
    fireEvent.click(screen.getByText("Next item →"));
    expect(props.onOpenItem).toHaveBeenCalledWith("b");
  });

  it("reads Done on the last item, and closes", () => {
    const { props } = mount({
      cards: [card(), card({ id: "b", haulStage: "parcel" })],
      itemId: "a",
    });
    fireEvent.click(screen.getByText("Done"));
    expect(props.onClose).toHaveBeenCalled();
  });

  it("keeps a running tally", () => {
    mount({
      cards: [
        card({ haulVerdict: "green" }),
        card({ id: "b", haulVerdict: "red", haulReason: "stain" }),
        card({ id: "c" }),
      ],
      itemId: "a",
    });
    expect(document.querySelector(".cz-qcr-tally").textContent).toBe("1 green · 1 red");
    expect(document.querySelector(".cz-qcr-kicker").textContent).toContain("2 of 3 done");
  });

  it("carries the seller's record across the whole shelf", () => {
    mount({
      cards: [
        card({ haulVerdict: "red", haulReason: "stain" }),
        card({ id: "b", haulVerdict: "green" }),
        card({ id: "c", seller: "Other Store", haulVerdict: "green" }),
      ],
      itemId: "a",
    });
    expect(document.querySelector(".cz-qcr-seller").textContent).toBe(
      "This seller: 1 green, 1 red across your shelf."
    );
  });

  it("says nothing about a seller with no history", () => {
    mount({ cards: [card({ seller: "" })], itemId: "a" });
    expect(document.querySelector(".cz-qcr-seller")).toBeNull();
  });
});

describe("QC overlay · the app wiring", () => {
  it("opens QC straight from the index CTA", () => {
    expect(APP).toContain("const openHaulCta = useCallback(");
    expect(APP).toContain("firstPendingQcItem(haul.haulItems || [])");
    expect(APP).toContain("openHaulCta(haul)");
  });

  it("writes the verdict and the stage together", () => {
    expect(APP).toContain("haulVerdict: verdict");
    expect(APP).toContain('haulStage: "qcd"');
    expect(APP).toContain('haulStage: "parcel", haulStageAt: Date.now()');
  });

  it("never lets a blocked clipboard throw", () => {
    const i = APP.indexOf("onCopy={async (text, message) => {");
    expect(i).toBeGreaterThan(-1);
    const body = APP.slice(i, i + 900);
    expect(body).toContain("try {");
    expect(body).toContain("} catch {");
    expect(body).toContain("Copy is blocked in this browser.");
  });
});

describe("QC overlay · the look", () => {
  it("keeps the rail and the photo stage at their handoff sizes", () => {
    expect(ruleBody(".cz-qcr-rail")).toContain("flex: 0 0 344px");
    expect(ruleBody(".cz-qcr-stage")).toContain("min-height: 280px");
    const thumb = ruleBody(".cz-qcr-thumb");
    expect(thumb).toContain("width: 34px");
    expect(thumb).toContain("height: 42px");
  });

  it("uses tokens, never a raw colour", () => {
    const i = DECLS.indexOf("\n.cz-qcr {");
    expect(i).toBeGreaterThan(-1);
    const block = DECLS.slice(i);
    // oklch is the established colour function here; a hex literal is not.
    expect(/#[0-9a-fA-F]{3,8}\b/.test(block)).toBe(false);
  });

  it("gives every control a 44px target on a touch screen", () => {
    const i = DECLS.indexOf("\n.cz-qcr {");
    const block = DECLS.slice(i);
    const coarse = block.indexOf("@media (pointer: coarse)");
    expect(coarse).toBeGreaterThan(-1);
    const body = block.slice(coarse, coarse + 900);
    expect(body).toContain("min-height: 44px");
    expect(body).toContain(".cz-qcr-arrow");
    expect(body).toContain(".cz-qcr-close");
  });

  it("moves on the one house curve", () => {
    const i = DECLS.indexOf("\n.cz-qcr {");
    const block = DECLS.slice(i);
    for (const match of block.matchAll(/transition:[^;]+;/g)) {
      expect(match[0]).toContain("var(--ease-out)");
    }
  });
});
