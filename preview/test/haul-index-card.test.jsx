// The Hauls tab index card (design/handoffs/haul/README.md, "Index card").
//
// The card answers one question from across the room: does this haul need me?
// Four parts carry the answer — the flag badge, the stage bar, the note line
// and the CTA. All four are projections of the items. Nothing is stored, so a
// stale card can only come from a broken projection, never from bad data.
//
// haul-fulfillment.test.js already proves the projections. These prove the
// wiring: the parts reach the screen, they carry the right tone, and the CTA
// inside the card does not fire the card as well.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";

import HaulCoverFan from "../../components/HaulCoverFan.jsx";
import { haulIndexCard, needsYouCount, stageBar } from "../../haul-fulfillment.js";

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
    id: "i" + Math.round(over.est || 500),
    stage: "toOrder",
    price: 20,
    est: 500,
    vol: 0,
    actual: null,
    qc: null,
    photos: 0,
    storage: 90,
    ...over,
  };
}

describe("the flag badge rides the front cover", () => {
  it("sits inside the front card, where the label sits", () => {
    const badge = <span className="cz-haul-flag">2 at QC</span>;
    const { container } = render(
      <HaulCoverFan covers={["a.jpg", "b.jpg"]} name="Gym" count={2} badge={badge} />
    );
    const cards = [...container.querySelectorAll(".cz-haul-fan-card")];
    const held = container.querySelector(".cz-haul-flag");
    expect(held, "the badge never rendered").not.toBeNull();
    // zIndex is total - i, so the first card is the front one.
    expect(cards[0].contains(held), "the badge is not inside the FRONT card").toBe(true);
    // One copy only. A badge on every card would print the flag twice.
    expect(container.querySelectorAll(".cz-haul-flag").length).toBe(1);
  });

  it("renders nothing when the haul has nothing to say", () => {
    // An always-present badge is noise, so a quiet haul passes no badge.
    const { container } = render(<HaulCoverFan covers={["a.jpg"]} name="Summer" count={1} />);
    expect(container.querySelector(".cz-haul-flag")).toBeNull();
  });
});

describe("the card's four parts carry the tone", () => {
  // A stand-in for the directory card's markup. The app builds this from
  // haulIndexCard and stageBar; this repeats the same shape so a render test
  // does not need the whole app.
  function Card({ items, submitted = false, milestone = 0, onOpen = () => {} }) {
    const card = haulIndexCard({ items, submitted, milestone });
    const bar = stageBar(items);
    return (
      <div className="cz-haul-card" data-tone={card.tone} role="button" onClick={onOpen}>
        {card.flag ? (
          <span className="cz-haul-flag" data-tone={card.tone}>
            {card.flag}
          </span>
        ) : null}
        <div className="cz-haul-bar">
          {bar.map((seg) => (
            <span key={seg.stage} className="cz-haul-bar-seg" data-stage={seg.stage} />
          ))}
        </div>
        <div className="cz-haul-note" data-tone={card.tone}>
          <span className="cz-haul-note-dot" />
          <span>{card.note}</span>
        </div>
        <button
          type="button"
          className="cz-pill"
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
        >
          {card.label}
        </button>
      </div>
    );
  }

  it("shouts the QC queue above everything else", () => {
    const items = [item({ stage: "warehouse", photos: 3 }), item({ stage: "warehouse", photos: 2 })];
    const { container, getByText } = render(<Card items={items} />);
    expect(container.querySelector(".cz-haul-flag").textContent).toBe("2 at QC");
    getByText("2 items are waiting on your green light.");
    getByText("Review QC · 2");
    expect(container.querySelector(".cz-haul-card").dataset.tone).toBe("attention");
  });

  it("turns the card red when the free storage is nearly out", () => {
    const items = [item({ stage: "ordered", storage: 6 })];
    const { container, getByText } = render(<Card items={items} />);
    expect(container.querySelector(".cz-haul-card").dataset.tone).toBe("urgent");
    expect(container.querySelector(".cz-haul-flag").textContent).toBe("6 d left");
    getByText("Free storage ends in 6 days on 1 item.");
  });

  it("stays quiet when nothing is ordered", () => {
    const { container, getByText } = render(<Card items={[item()]} />);
    expect(container.querySelector(".cz-haul-card").dataset.tone).toBe("idle");
    expect(container.querySelector(".cz-haul-flag")).toBeNull();
    getByText("1 item still to order.");
    getByText("Start ordering");
  });

  it("draws one bar segment per occupied stage", () => {
    const items = [item(), item({ stage: "ordered" }), item({ stage: "ordered" })];
    const { container } = render(<Card items={items} />);
    const segs = [...container.querySelectorAll(".cz-haul-bar-seg")];
    expect(segs.map((s) => s.dataset.stage)).toEqual(["toOrder", "ordered"]);
  });

  it("opens the haul once when the button inside the card is pressed", () => {
    // The button sits inside the card, and the card opens the haul too. Without
    // stopPropagation the press counts twice and the haul opens, closes, opens.
    const onOpen = vi.fn();
    const { getByText } = render(<Card items={[item()]} onOpen={onOpen} />);
    fireEvent.click(getByText("Start ordering"));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});

describe("the section head counts the hauls that need you", () => {
  it("counts only the hauls asking for something", () => {
    const cards = [{ tone: "urgent" }, { tone: "attention" }, { tone: "idle" }, { tone: "done" }];
    expect(needsYouCount(cards)).toBe(2);
  });
});

// jsdom has no layout, so the stylesheet is read directly. These guard the
// values the handoff names, which a tidy-up would otherwise round away.
describe("the stylesheet still paints the card", () => {
  it("keeps the badge at the collage corner in mono caps", () => {
    const body = ruleBody(".cz-haul-flag");
    expect(body, "the .cz-haul-flag rule is gone — re-point this test").not.toBeNull();
    expect(body).toMatch(/position:\s*absolute/);
    expect(body).toMatch(/top:\s*10px/);
    expect(body).toMatch(/left:\s*10px/);
    expect(body).toMatch(/border-radius:\s*999px/);
    expect(body).toMatch(/padding:\s*4px 10px/);
    expect(body).toMatch(/font-size:\s*9px/);
    expect(body).toMatch(/letter-spacing:\s*0\.08em/);
    expect(body).toMatch(/white-space:\s*nowrap/);
  });

  it("colours the badge from the money and error tokens, not from hex", () => {
    expect(ruleBody('.cz-haul-flag[data-tone="urgent"]')).toMatch(/--cz-error-text/);
    expect(ruleBody('.cz-haul-flag[data-tone="done"]')).toMatch(/--cz-money/);
  });

  it("ramps the stage bar from hair to money", () => {
    const seg = ruleBody(".cz-haul-bar-seg");
    expect(seg, "the stage bar rule is gone").not.toBeNull();
    expect(seg).toMatch(/--cz-hair/);
    expect(ruleBody('.cz-haul-bar-seg[data-stage="ordered"]')).toMatch(/--cz-faint/);
    expect(ruleBody('.cz-haul-bar-seg[data-stage="warehouse"]')).toMatch(/--cz-sub/);
    expect(ruleBody('.cz-haul-bar-seg[data-stage="qcd"]')).toMatch(/--cz-ink/);
    expect(ruleBody('.cz-haul-bar-seg[data-stage="parcel"]')).toMatch(/--cz-money/);
    const bar = ruleBody(".cz-haul-bar");
    expect(bar).toMatch(/height:\s*4px/);
    expect(bar).toMatch(/gap:\s*2px/);
  });

  it("holds the note line at one height so the cards stay in line", () => {
    const body = ruleBody(".cz-haul-note");
    expect(body, "the note rule is gone").not.toBeNull();
    expect(body).toMatch(/min-height:\s*34px/);
    expect(body).toMatch(/font-size:\s*12px/);
    expect(ruleBody('.cz-haul-note[data-tone="urgent"]')).toMatch(/--cz-error-text/);
    expect(ruleBody('.cz-haul-note[data-tone="attention"] .cz-haul-note-dot')).toMatch(/--cz-warn/);
  });

  it("puts a red border on an urgent card", () => {
    expect(ruleBody('.cz-haul-card[data-tone="urgent"]')).toMatch(/--cz-error-text/);
  });

  it("grows the button to 44px for a finger", () => {
    const body = ruleBody(".cz-haul-cta");
    expect(body, "the CTA rule is gone").not.toBeNull();
    expect(body).toMatch(/min-height:\s*40px/);
    // The global coarse-pointer block only covers the command bar, so this
    // surface carries its own floor.
    const coarse = DECLS.indexOf("@media (pointer: coarse) {\n  .cz-haul-cta");
    expect(coarse, "the coarse-pointer floor is gone — the button is 40px on a phone")
      .toBeGreaterThan(-1);
    expect(DECLS.slice(coarse, coarse + 120)).toMatch(/min-height:\s*44px/);
  });
});

describe("the card takes the keyboard, because a button cannot nest", () => {
  it("gives the directory card a role and a key handler instead of being a button", () => {
    // The CTA is a real button inside the card. HTML forbids a button inside a
    // button, so the card carries role, tabIndex and its own Enter/Space.
    const start = APP.indexOf('className="cz-haul-card"');
    expect(start, "the directory card markup moved — re-point this test").toBeGreaterThan(-1);
    // The card ends where the "Start a haul" ghost tile begins.
    const end = APP.indexOf("cz-haul-card--ghost", start);
    expect(end, "the ghost tile moved — re-point this test").toBeGreaterThan(start);
    const block = APP.slice(start - 400, end);
    expect(block).toMatch(/role="button"/);
    expect(block).toMatch(/tabIndex=\{0\}/);
    expect(block).toMatch(/onKeyDown/);
    expect(block).toMatch(/stopPropagation/);
  });
});
