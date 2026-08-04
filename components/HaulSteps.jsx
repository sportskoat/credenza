import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import {
  SHIPPING_LINES,
  itemCardMeta,
  normalizeStage,
  normalizeVerdict,
  parcelMaths,
  redReasonText,
  shipRange,
  storageLine,
} from "../haul-fulfillment.js";
import HaulParcelRail from "./HaulParcelRail.jsx";

// Same media query as the app's usePrefersReducedMotion, kept local so the
// component never imports the app that mounts it.
function useReducedMotion() {
  const [reduced, setReduced] = useState(
    () =>
      typeof window !== "undefined" &&
      !!window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else mq.addListener(onChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", onChange);
      else mq.removeListener(onChange);
    };
  }, []);
  return reduced;
}

/* ═══════════════════════════════════════════════════════════════════════════
   HaulSteps — STEPS-HANDOFF § The steps page.

   The haul as five vertical steps instead of four columns. Mixed progress is
   still the normal state of a haul: one item is still a link, one is at the
   warehouse, one is packed. The steps stack them top to bottom in the order
   they happen, and the parcel rail rides beside them as the scoreboard.

   A step never locks. Done steps and waiting steps collapse to their header;
   every body stays reachable, and going backwards is normal. The user's
   open/close choices live in `openSteps`, session-only — everything else is
   derived from `items` on every render. Store no step status.

   Weight appears in exactly three places on the page, each a different scope:
   the strip's Chargeable cell (the parcel), the rail maths (the derivation),
   and the item rows (one item). No fourth weight renders anywhere.
   ═══════════════════════════════════════════════════════════════════════════ */

const STEPS = [
  { n: 1, key: "toOrder", title: "Order it" },
  { n: 2, key: "ordered", title: "Wait for arrival" },
  { n: 3, key: "warehouse", title: "Check the photos" },
  { n: 4, key: "qcd", title: "Pack the box" },
  { n: 5, key: null, title: "Hand it off" },
];

// A stage's place in the flow. "Past a step" means a later index.
const STAGE_ORDER = { toOrder: 1, ordered: 2, warehouse: 3, qcd: 4, parcel: 5 };

// A step body shows at most this many rows, then a Show all pill. No inner
// scrollbars — the page scrolls.
const ROWS_SHOWN = 8;

function gramsLabel(value) {
  return Math.round(value) + " g";
}

function money(value) {
  return "$" + Number(value || 0).toFixed(2);
}

function plural(n, word) {
  return n + " " + word + (n === 1 ? "" : "s");
}

export default function HaulSteps({
  // The haul's items, in shelf order, already shaped by toHaulItem.
  items = [],
  // The haul's saved shipping record: divisor, line, rates, packaging.
  ship = null,
  // (item) => { image, tint } — the cover picture and the platform's colour.
  tileFor,
  // The agent the person buys through, for the summary strip.
  agentName = "",
  onOpenItem,
  // (item) — the one action that item's stage offers.
  onItemAction,
  // (columnKey) — the dashed action under a step ("toOrder" | "warehouse").
  onColumnFooter,
  onRemoveFromParcel,
  onSetDivisor,
  onSetLine,
  onSetRate,
  onHandOff,
}) {
  const reducedMotion = useReducedMotion();
  const divisor = ship && ship.divisor ? ship.divisor : 6000;
  // The rates the strip's Ship est. reads: the person's saved numbers where
  // they exist, the line's default everywhere else. Same rule as the rail.
  const rates = useMemo(() => {
    const map = {};
    for (const entry of SHIPPING_LINES) {
      const saved = ship && ship.rates ? Number(ship.rates[entry.key]) : NaN;
      map[entry.key] = Number.isFinite(saved) && saved > 0 ? saved : entry.rate;
    }
    return map;
  }, [ship]);
  const maths = useMemo(
    () =>
      parcelMaths({
        items,
        divisor,
        rates,
        packagingGrams: ship && ship.packagingGrams != null ? ship.packagingGrams : undefined,
      }),
    [items, divisor, rates, ship]
  );
  const range = shipRange(maths);
  const goodsUsd = items.reduce((total, item) => total + Number(item.price || 0), 0);

  // The five buckets, filled. Steps are projections of items — never stored.
  const lists = useMemo(() => {
    const map = { toOrder: [], ordered: [], warehouse: [], qcdGreen: [], qcdRed: [] };
    for (const item of items) {
      const stage = normalizeStage(item && item.stage);
      if (stage === "qcd") {
        map[normalizeVerdict(item.qc) === "green" ? "qcdGreen" : "qcdRed"].push(item);
      } else if (map[stage]) {
        map[stage].push(item);
      }
    }
    return map;
  }, [items]);

  const pastCounts = useMemo(() => {
    // How many items moved PAST each step. A done step is an empty step with
    // something past it; an untouched step has nothing past it either way.
    const map = {};
    for (const step of STEPS) {
      if (!step.key) continue;
      const order = STAGE_ORDER[step.key];
      map[step.n] = items.filter(
        (item) => (STAGE_ORDER[normalizeStage(item && item.stage)] || 0) > order
      ).length;
    }
    return map;
  }, [items]);

  // What each step is asking for. "Work" is what makes a chip the current
  // step and what opens a body by default.
  const work = useMemo(
    () => ({
      1: lists.toOrder.length,
      2: 0, // a pure-waiting step — it never asks, it only holds
      3: lists.warehouse.length,
      4: lists.qcdGreen.length,
      5: maths.count > 0 && !(ship && ship.submitted) ? maths.count : 0,
    }),
    [lists, maths, ship]
  );
  const currentStep = [1, 2, 3, 4, 5].find((n) => work[n] > 0) || null;

  const doneStep = (n) => {
    if (n === 5) return !!(ship && ship.submitted);
    const step = STEPS[n - 1];
    const count =
      n === 4 ? lists.qcdGreen.length + lists.qcdRed.length : lists[step.key].length;
    return count === 0 && (pastCounts[n] || 0) > 0;
  };

  // Section states (handoff § Section states): steps that need the user open;
  // done steps and pure-waiting steps collapse to their header. The user's
  // manual override is session-only and resets on navigation.
  const [openSteps, setOpenSteps] = useState({});
  const defaultOpen = (n) => work[n] > 0;

  // The 600ms hold: when a step's last item moves on, the body stays open a
  // beat so the person sees it empty before it folds. Reduced motion drops
  // the hold.
  const [holdOpen, setHoldOpen] = useState({});
  const prevWorkRef = useRef(work);
  useEffect(() => {
    const prev = prevWorkRef.current;
    prevWorkRef.current = work;
    if (reducedMotion) return;
    const justDone = [1, 3, 4].filter((n) => prev[n] > 0 && work[n] === 0 && doneStepNow(n));
    if (!justDone.length) return;
    function doneStepNow(n) {
      const step = STEPS[n - 1];
      const count =
        n === 4 ? lists.qcdGreen.length + lists.qcdRed.length : lists[step.key].length;
      return count === 0 && (pastCounts[n] || 0) > 0;
    }
    setHoldOpen((hold) => {
      const next = { ...hold };
      for (const n of justDone) next[n] = true;
      return next;
    });
    const timer = setTimeout(() => {
      setHoldOpen((hold) => {
        const next = { ...hold };
        for (const n of justDone) delete next[n];
        return next;
      });
    }, 600);
    return () => clearTimeout(timer);
  }, [work, lists, pastCounts, reducedMotion]);

  const isOpen = (n) =>
    n in openSteps ? openSteps[n] : holdOpen[n] || defaultOpen(n);
  const toggle = (n) => setOpenSteps((open) => ({ ...open, [n]: !isOpen(n) }));

  // Long steps: the body caps at ROWS_SHOWN rows, then a dashed pill expands
  // it. Session-only, like openSteps.
  const [expandedSteps, setExpandedSteps] = useState({});

  const tile = (item, className) => {
    const face = tileFor ? tileFor(item) : null;
    const style = {};
    if (face && face.tint) style["--cz-hb-tint"] = face.tint;
    if (face && face.image) style.backgroundImage = "url(" + face.image + ")";
    return { className, style };
  };

  const statusLine = (n) => {
    if (doneStep(n)) {
      const receipts = {
        1: "All " + pastCounts[1] + " ordered",
        2: "All " + pastCounts[2] + " arrived",
        3: "All " + pastCounts[3] + " checked",
        4: "All " + pastCounts[4] + " packed",
        5: "With your agent",
      };
      return receipts[n];
    }
    if (n === 1) return plural(lists.toOrder.length, "item") + " left to order";
    if (n === 2)
      return lists.ordered.length
        ? plural(lists.ordered.length, "item") + " on the way · mark them when they land"
        : "Nothing on the way yet";
    if (n === 3)
      return lists.warehouse.length
        ? plural(lists.warehouse.length, "item") + " waiting on your green light"
        : "No photos to check yet";
    if (n === 4) {
      const parts = [];
      if (lists.qcdGreen.length) parts.push(plural(lists.qcdGreen.length, "item") + " ready to pack");
      if (lists.qcdRed.length) parts.push(plural(lists.qcdRed.length, "item") + " can't ship");
      return parts.length ? parts.join(" · ") : "Nothing checked yet";
    }
    // Step 5 is an action, not a bucket.
    return maths.count
      ? "Ready — " + plural(maths.count, "item") + " in the box"
      : "Opens when the box has something in it";
  };

  const statusTone = (n) => {
    if (doneStep(n)) return "done";
    if (work[n] > 0) return "needs";
    return "quiet";
  };

  const rowMeta = (item) => {
    const card = itemCardMeta(item);
    const red =
      normalizeStage(item.stage) === "qcd" && normalizeVerdict(item.qc) !== "green";
    if (red) {
      // The reason is stored as a key ("stain"); the row reads the sentence,
      // the same sentence the return message sends (haul-fulfillment.js).
      const reason = redReasonText(item.reason);
      return {
        text: "RED · " + (reason || "reason not set") + " · CAN'T SHIP",
        tone: "error",
        red: true,
        action: card ? card.action : null,
      };
    }
    return {
      text: (card ? card.meta : "").toUpperCase() + " · " + money(item.price),
      tone: card ? card.tone : "faint",
      red: false,
      action: card ? card.action : null,
    };
  };

  const stepRows = (n) => {
    if (n === 1) return lists.toOrder;
    if (n === 2) return lists.ordered;
    if (n === 3) return lists.warehouse;
    if (n === 4) return [...lists.qcdGreen, ...lists.qcdRed];
    return [];
  };

  const renderRow = (item, n) => {
    const meta = rowMeta(item);
    return (
      <div
        className={"cz-steps-row" + (meta.red ? " cz-steps-row-red" : "")}
        key={item.id}
        role="button"
        tabIndex={0}
        onClick={() => onOpenItem && onOpenItem(item.id)}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          if (onOpenItem) onOpenItem(item.id);
        }}
      >
        <span {...tile(item, "cz-steps-tile")}>
          <span className="cz-hb-platform">{item.platform || "Link"}</span>
        </span>
        <span className="cz-steps-row-text">
          <span className="cz-steps-row-title">{item.title}</span>
          <span className={"cz-steps-row-meta cz-hb-meta-" + meta.tone}>{meta.text}</span>
        </span>
        {meta.action ? (
          <button
            type="button"
            // The QC pill is the loud exception — Review QC is the page's
            // real call to action whenever it exists. Every other pill stays
            // quiet. Never more than one loud pill style per row.
            className={"cz-steps-pill" + (n === 3 ? " cz-steps-pill-loud" : "")}
            onClick={(event) => {
              // The row opens the drawer. The pill does one thing. Without
              // this stop the pill would do both.
              event.stopPropagation();
              if (onItemAction) onItemAction(item);
            }}
          >
            {meta.action}
          </button>
        ) : null}
      </div>
    );
  };

  const renderStep = (step) => {
    const n = step.n;
    const rows = stepRows(n);
    const done = doneStep(n);
    const current = currentStep === n;
    // Resting: nothing has reached this step yet, so it sits quiet at .62 —
    // present, but not asking for anything.
    const resting =
      items.length === 0 ||
      (n !== 5 && !done && rows.length === 0 && (pastCounts[n] || 0) === 0) ||
      (n === 5 && maths.count === 0 && !(ship && ship.submitted));
    const open = n === 5 ? true : isOpen(n);

    const chip = done ? (
      <span className="cz-steps-num cz-steps-num-done" aria-label="Done">
        <Check aria-hidden="true" size={13} strokeWidth={2.6} />
      </span>
    ) : (
      <span className={"cz-steps-num" + (current ? " cz-steps-num-now" : "")}>{n}</span>
    );

    return (
      <section
        className={"cz-steps-step" + (resting && !done ? " cz-steps-step-dim" : "")}
        key={n}
        aria-label={step.title}
      >
        {n === 5 ? (
          <div className="cz-steps-head">
            {chip}
            <span className="cz-steps-title">{step.title}</span>
            <span className={"cz-steps-status cz-steps-status-" + statusTone(n)}>
              {statusLine(n)}
            </span>
          </div>
        ) : (
          <button
            type="button"
            className="cz-steps-head"
            aria-expanded={open}
            onClick={() => toggle(n)}
          >
            {chip}
            <span className="cz-steps-title">{step.title}</span>
            <span className={"cz-steps-status cz-steps-status-" + statusTone(n)}>
              {statusLine(n)}
            </span>
            <ChevronDown
              aria-hidden="true"
              size={14}
              strokeWidth={2.2}
              className={"cz-steps-chev" + (open ? " cz-steps-chev-open" : "")}
            />
          </button>
        )}

        {n === 5 ? (
          // Step 5 is an action, not a bucket. An empty box gets the posture
          // line; a filled box gets the same hand-off the rail offers.
          maths.count === 0 && !(ship && ship.submitted) ? (
            <p className="cz-steps-hint">
              Credenza writes the parcel instruction. You send it — Credenza never
              touches your agent.
            </p>
          ) : (
            <div className="cz-steps-handoff">
              <button type="button" className="cz-hb-cta" onClick={() => onHandOff && onHandOff()}>
                {ship && ship.submitted
                  ? "Track parcel A"
                  : "Review & hand off · " + maths.count}
              </button>
            </div>
          )
        ) : resting && rows.length === 0 ? null : (
          <div className="cz-steps-bodywrap" data-open={open ? "true" : "false"}>
            <div className="cz-steps-body">
              {items.length === 0 && n === 1 ? (
                <p className="cz-steps-empty">
                  Nothing in this haul yet. Add items from any card's ··· menu.
                </p>
              ) : (
                <>
                  {(expandedSteps[n] ? rows : rows.slice(0, ROWS_SHOWN)).map((item) =>
                    renderRow(item, n)
                  )}
                  {!expandedSteps[n] && rows.length > ROWS_SHOWN ? (
                    <button
                      type="button"
                      className="cz-hb-foot"
                      onClick={() => setExpandedSteps((x) => ({ ...x, [n]: true }))}
                    >
                      Show all {rows.length}
                    </button>
                  ) : null}
                  {n === 1 && rows.length > 0 ? (
                    <button
                      type="button"
                      className="cz-hb-foot"
                      onClick={() => onColumnFooter && onColumnFooter("toOrder")}
                    >
                      Copy all links for your agent
                    </button>
                  ) : null}
                  {n === 3 && rows.length > 0 ? (
                    <button
                      type="button"
                      className="cz-hb-foot"
                      onClick={() => onColumnFooter && onColumnFooter("warehouse")}
                    >
                      Review all QC
                    </button>
                  ) : null}
                </>
              )}
            </div>
          </div>
        )}
      </section>
    );
  };

  return (
    <div className="cz-steps">
      <p className="cz-steps-sub">
        Five steps, top to bottom. A step never locks — go back any time.
      </p>

      {/* The strip answers the four questions a person asks before they touch
          anything: who holds it, what it cost, what it weighs, what it costs
          to move. This is the only place aggregate weight appears. */}
      <div className="cz-hb-summary">
        <div className="cz-hb-cell">
          <span className="cz-hb-label">Agent</span>
          <span className="cz-hb-value">{agentName || "Your agent"}</span>
        </div>
        <div className="cz-hb-cell">
          <span className="cz-hb-label">Goods</span>
          <span className="cz-hb-value cz-hb-value-mono cz-hb-money">{money(goodsUsd)}</span>
        </div>
        <div className="cz-hb-cell">
          <span className="cz-hb-label">Chargeable</span>
          {/* An empty box has no weight to quote. The label stays; the cell
              reads a bare dash, per the handoff's one-weight-story table. */}
          <span className="cz-hb-value cz-hb-value-mono">
            {maths.count ? gramsLabel(maths.chargeableG) : "—"}
          </span>
        </div>
        <div className="cz-hb-cell">
          <span className="cz-hb-label">Ship est.</span>
          <span className="cz-hb-value cz-hb-value-mono cz-hb-money">{range || "not yet"}</span>
        </div>
        <div className="cz-hb-cell cz-hb-cell-flex">
          <span className="cz-hb-storage">{storageLine(items)}</span>
        </div>
      </div>

      <div className="cz-steps-cols">
        <div className="cz-steps-stack">{STEPS.map(renderStep)}</div>
        <HaulParcelRail
          items={items}
          ship={ship}
          tileFor={tileFor}
          onRemoveFromParcel={onRemoveFromParcel}
          onSetDivisor={onSetDivisor}
          onSetLine={onSetLine}
          onSetRate={onSetRate}
          onHandOff={onHandOff}
        />
      </div>
    </div>
  );
}
