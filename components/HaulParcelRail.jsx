import { Fragment, useMemo, useState } from "react";
import { X } from "lucide-react";
import {
  COST_FLOOR_USD,
  DIVISORS,
  SHIPPING_LINES,
  costOfLine,
  itemShipGrams,
  parcelMaths,
  parcelTips,
} from "../haul-fulfillment.js";
import InfoBubble from "./InfoBubble.jsx";

/* ═══════════════════════════════════════════════════════════════════════════
   HaulParcelRail — STEPS-HANDOFF § The parcel rail.

   The board prototype's Parcel A panel, restyled to the sticky 300px rail
   that rides beside the steps. Top to bottom: the contents and maths card,
   the lines card, the hand-off button, the tips card. The rail is the haul's
   scoreboard — it stays in view while the person works the steps, which is
   what "Add to parcel" pays off visually.

   Every number is computed on every render. None of it is stored.
   ═══════════════════════════════════════════════════════════════════════════ */

function gramsLabel(value) {
  return Math.round(value) + " g";
}

function money(value) {
  return "$" + Number(value || 0).toFixed(2);
}

export default function HaulParcelRail({
  // The haul's items, in shelf order, already shaped by toHaulItem.
  items = [],
  // The haul's saved shipping record: divisor, line, rates, packaging.
  ship = null,
  // (item) => { image, tint } — the cover picture and the platform's colour.
  tileFor,
  // (id) — takes an item back out of the parcel.
  onRemoveFromParcel,
  onSetDivisor,
  onSetLine,
  // (lineKey, rate)
  onSetRate,
  onHandOff,
}) {
  const divisor = ship && ship.divisor ? ship.divisor : 6000;
  const line = ship && ship.line ? ship.line : "EMS";

  // Kyle 2026-08-02: "not really sure what these are, can we get tool tips?"
  // One line at a time explains itself. Opening a note must not change which
  // line the person picked, so the button stops the row's click.
  const [openLine, setOpenLine] = useState(null);

  const rates = useMemo(() => {
    const map = {};
    for (const entry of SHIPPING_LINES) {
      const saved = ship && ship.rates ? Number(ship.rates[entry.key]) : NaN;
      map[entry.key] = Number.isFinite(saved) && saved > 0 ? saved : entry.rate;
    }
    return map;
  }, [ship]);

  const packagingGrams = ship && ship.packagingGrams != null ? ship.packagingGrams : undefined;
  const maths = useMemo(
    () => parcelMaths({ items, divisor, rates, packagingGrams }),
    [items, divisor, rates, packagingGrams]
  );
  const tips = useMemo(() => parcelTips(maths, items), [maths, items]);

  const tile = (item, className) => {
    const face = tileFor ? tileFor(item) : null;
    const style = {};
    if (face && face.tint) style["--cz-hb-tint"] = face.tint;
    if (face && face.image) style.backgroundImage = "url(" + face.image + ")";
    return { className, style };
  };

  return (
    <div className="cz-rail">
      {/* Contents + maths. The parcel's rule is ink, not hairline: it is the
          destination, and the heavier line says so. */}
      <div className="cz-rail-card">
        <div className="cz-rail-head">
          <span className="cz-rail-kicker">Parcel A</span>
          <span className="cz-rail-count">{maths.count}</span>
        </div>

        {maths.inParcel.map((item) => (
          <div className="cz-rail-row" key={item.id}>
            <span {...tile(item, "cz-rail-tile")} />
            <span className="cz-rail-row-text">
              <span className="cz-rail-row-title">{item.title}</span>
              <span className="cz-rail-row-weight">{gramsLabel(itemShipGrams(item))}</span>
            </span>
            <button
              type="button"
              className="cz-rail-remove"
              aria-label="Remove from parcel"
              onClick={() => onRemoveFromParcel && onRemoveFromParcel(item.id)}
            >
              <X aria-hidden="true" size={15} strokeWidth={2.2} />
            </button>
          </div>
        ))}

        {maths.count === 0 ? (
          <p className="cz-rail-empty">
            Nothing in the box. Green-lit items in step 4 get an{" "}
            <em className="cz-hb-em">Add to parcel</em> button.
          </p>
        ) : null}

        <div className="cz-hb-rule" />

        <div className="cz-hb-maths">
          <div className="cz-hb-sum">
            <span className="cz-hb-sum-label">actual + packaging</span>
            <span className="cz-hb-sum-value">{gramsLabel(maths.actualG)}</span>
          </div>
          <div className="cz-hb-sum">
            {/* STEPS-HANDOFF item 5: the estimate flag rides the label while
                any packed item's volume is a category default, so the person
                never reads a guess as a measurement. */}
            <span className="cz-hb-sum-label">
              volumetric ÷ {maths.divisor}
              {maths.inParcel.some((item) => item.volEstimated) ? " · est." : ""}
            </span>
            <span className="cz-hb-sum-value">{gramsLabel(maths.volG)}</span>
          </div>
          <div className="cz-hb-sum">
            <span className="cz-hb-sum-strong">chargeable</span>
            <span className="cz-hb-sum-big">{gramsLabel(maths.chargeableG)}</span>
          </div>
          <div className="cz-hb-sum">
            <span className="cz-hb-sum-label">billed at</span>
            <span className="cz-hb-sum-value">
              {maths.count ? maths.billedKg.toFixed(1) + " kg" : "not yet"}
            </span>
          </div>
        </div>

        {/* Agents do not agree on the divisor, and the difference is real
            money on a light box. So the person picks, and every number above
            moves with it. */}
        <div className="cz-hb-divisor">
          <span className="cz-hb-label">Divisor</span>
          {DIVISORS.map((value) => (
            <button
              type="button"
              key={value}
              className={"cz-hb-chip" + (value === maths.divisor ? " cz-hb-chip-on" : "")}
              aria-pressed={value === maths.divisor}
              onClick={() => onSetDivisor && onSetDivisor(value)}
            >
              {value}
            </button>
          ))}
          <span className="cz-hb-hint">check yours</span>
        </div>
      </div>

      {/* Lines. The rates are the person's own numbers — the defaults are a
          starting point, not a quote. */}
      <div className="cz-rail-card">
        <div className="cz-hb-lines-head">
          <span className="cz-hb-label">Lines</span>
          <span className="cz-hb-hint">your rates</span>
        </div>
        {SHIPPING_LINES.map((entry) => {
          const picked = entry.key === line;
          const noteOpen = openLine === entry.key;
          return (
            <Fragment key={entry.key}>
              <div
                className={"cz-hb-line" + (picked ? " cz-hb-line-on" : "")}
                role="button"
                tabIndex={0}
                aria-pressed={picked}
                onClick={() => onSetLine && onSetLine(entry.key)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== " ") return;
                  event.preventDefault();
                  if (onSetLine) onSetLine(entry.key);
                }}
              >
                <span className="cz-hb-row-text">
                  <span className="cz-hb-row-title">{entry.label}</span>
                  <span className="cz-hb-row-weight">{entry.transit}</span>
                </span>
                {/* The note must not pick the line. The rate box beside it
                    already stops the row's click; this does the same. */}
                <button
                  type="button"
                  className="cz-hb-why"
                  aria-label={"What is " + entry.label + "?"}
                  aria-expanded={noteOpen}
                  onClick={(event) => {
                    event.stopPropagation();
                    setOpenLine(noteOpen ? null : entry.key);
                  }}
                >
                  ?
                </button>
                <input
                  type="number"
                  step="0.10"
                  className="cz-hb-rate"
                  aria-label={"Rate per kg for " + entry.label}
                  value={rates[entry.key]}
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) =>
                    onSetRate && onSetRate(entry.key, Number(event.target.value))
                  }
                />
                <span className="cz-hb-cost">
                  {maths.count ? money(costOfLine(rates[entry.key], maths.billedKg)) : ""}
                </span>
              </div>
              {noteOpen ? (
                <InfoBubble title={entry.label} onClose={() => setOpenLine(null)}>
                  {entry.blurb} It takes {entry.transit.replace(" d", " days")}. The
                  number you type is US dollars for each kilogram.
                </InfoBubble>
              ) : null}
            </Fragment>
          );
        })}
        {/* The rate is never the whole price. Every agent charges a floor. */}
        <p className="cz-hb-tip cz-hb-floor">
          Every line has a floor of {money(COST_FLOOR_USD)}. A very light box
          still costs that much.
        </p>
      </div>

      {/* The hand-off button is the rail's payoff. An empty box has nothing
          to review, so the button says so and stays put. */}
      <button
        type="button"
        className="cz-hb-cta cz-rail-go"
        disabled={!maths.count && !(ship && ship.submitted)}
        onClick={() => onHandOff && onHandOff()}
      >
        {/* Once the parcel is with the agent there is nothing left to hand
            off. The only question is where it is (README, screen 12). */}
        {ship && ship.submitted
          ? "Track parcel A"
          : maths.count
            ? "Review & hand off · " + maths.count
            : "Nothing in the box yet"}
      </button>

      {tips.length > 0 ? (
        <div className="cz-rail-tips">
          {tips.map((tip) => (
            <p className="cz-rail-tip" key={tip}>
              {tip}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
