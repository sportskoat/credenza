import { Fragment, useMemo, useState } from "react";
import { X } from "lucide-react";
import {
  COST_FLOOR_USD,
  DIVISORS,
  SHIPPING_LINES,
  boardColumns,
  costOfLine,
  itemShipGrams,
  parcelMaths,
  parcelTips,
  shipRange,
  storageLine,
} from "../haul-fulfillment.js";
import InfoBubble from "./InfoBubble.jsx";

/* ═══════════════════════════════════════════════════════════════════════════
   HaulFlowBoard — haul handoff README, screens 2, 6 and 7.

   Mixed progress is the normal state of a haul. One item is still a link, one
   is at the warehouse, one is already packed. A five-step wizard fights that.
   A board renders it.

   The parcel is the destination, not a fifth stage. It used to ride at the end
   of the track as a fixed 280px column, and the five columns together were
   wider than the page, so the box was cut off at the right edge (Kyle
   2026-08-02). It now sits below the track with the full width, and its three
   panels share that width.

   The four stage columns are 188px each with 10px gaps. Do not widen one
   without widening the container.

   Every number here is computed on every render. None of it is stored. Cache
   a count and the board and the haul index drift apart.

   This is not components/HaulBoard.jsx. That one is the budget and archive
   strip that sits above this.
   ═══════════════════════════════════════════════════════════════════════════ */

function gramsLabel(value) {
  return Math.round(value) + " g";
}

function money(value) {
  return "$" + Number(value || 0).toFixed(2);
}

export default function HaulFlowBoard({
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
  // (columnKey) — the dashed action under a column.
  onColumnFooter,
  // (id) — takes an item back out of the parcel.
  onRemoveFromParcel,
  onSetDivisor,
  onSetLine,
  // (lineKey, rate)
  onSetRate,
  onHandOff,
  // STEPS-HANDOFF item 7: the second parcel is gone. One box per haul is the
  // model; the data still keeps parcels an array, so a future shape can carry
  // more without a migration.
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
  const columns = useMemo(() => boardColumns(items), [items]);
  const tips = useMemo(() => parcelTips(maths, items), [maths, items]);
  const range = shipRange(maths);
  const goodsUsd = items.reduce((total, item) => total + Number(item.price || 0), 0);

  const tile = (item, className) => {
    const face = tileFor ? tileFor(item) : null;
    const style = {};
    if (face && face.tint) style["--cz-hb-tint"] = face.tint;
    if (face && face.image) style.backgroundImage = "url(" + face.image + ")";
    return { className, style };
  };

  return (
    <div className="cz-hb">
      <p className="cz-hb-sub">
        Every stage below is yours to mark. Credenza never touches your agent.
      </p>

      {/* The strip answers the four questions a person asks before they touch
          anything: who holds it, what it cost, what it weighs, what it costs
          to move. */}
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
          {/* An empty box has no weight to quote. A bare dash reads like a
              number we failed to work out, so the cell says so in words. */}
          <span className="cz-hb-value cz-hb-value-mono">
            {maths.count ? gramsLabel(maths.chargeableG) : "not yet"}
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

      <div className="cz-hb-track">
        {columns.map((column) => (
          <div className="cz-hb-col" key={column.key}>
            <div className="cz-hb-col-head">
              <span className="cz-hb-kicker">{column.label}</span>
              <span className="cz-hb-count">{column.count}</span>
            </div>

            {column.items.map(({ item, meta, tone, action }) => (
              <div
                className="cz-hb-card"
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
                <div className="cz-hb-card-top">
                  <span {...tile(item, "cz-hb-tile")}>
                    <span className="cz-hb-platform">{item.platform || "Link"}</span>
                  </span>
                  <span className="cz-hb-card-text">
                    <span className="cz-hb-title">{item.title}</span>
                    <span className={"cz-hb-meta cz-hb-meta-" + tone}>{meta}</span>
                    <span className="cz-hb-price">{money(item.price)}</span>
                  </span>
                </div>
                {action ? (
                  <button
                    type="button"
                    className="cz-hb-action"
                    onClick={(event) => {
                      // The card opens the drawer. The pill does one thing.
                      // Without this stop the pill would do both.
                      event.stopPropagation();
                      if (onItemAction) onItemAction(item);
                    }}
                  >
                    {action}
                  </button>
                ) : null}
              </div>
            ))}

            {column.footerLabel ? (
              <button
                type="button"
                className="cz-hb-foot"
                onClick={() => onColumnFooter && onColumnFooter(column.key)}
              >
                {column.footerLabel}
              </button>
            ) : null}
          </div>
        ))}
      </div>

      {/* The parcel sits below the four columns, across the whole page. It is
          the destination, not a fifth stage, and it is the one place a person
          checks a number against the agent's own. Nothing here may be cut off. */}
      <section className="cz-hb-parcel">
        {/* The parcel's rule is ink, not hairline. It is the destination,
            and the heavier line says so. */}
        <div className="cz-hb-col-head cz-hb-col-head-ink">
          <span className="cz-hb-kicker cz-hb-kicker-ink">Parcel A</span>
          <span className="cz-hb-count">{maths.count}</span>
        </div>

        <div className="cz-hb-parcel-grid">
          <div className="cz-hb-panel">
            {maths.inParcel.map((item) => (
              <div className="cz-hb-row" key={item.id}>
                <span {...tile(item, "cz-hb-row-tile")} />
                <span className="cz-hb-row-text">
                  <span className="cz-hb-row-title">{item.title}</span>
                  <span className="cz-hb-row-weight">{gramsLabel(itemShipGrams(item))}</span>
                </span>
                <button
                  type="button"
                  className="cz-hb-remove"
                  aria-label="Remove from parcel"
                  onClick={() => onRemoveFromParcel && onRemoveFromParcel(item.id)}
                >
                  <X aria-hidden="true" size={15} strokeWidth={2.2} />
                </button>
              </div>
            ))}

            {maths.count === 0 ? (
              <p className="cz-hb-empty">
                Nothing in the box. Green-lit items get an{" "}
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
                <span className="cz-hb-sum-label">volumetric ÷ {maths.divisor}</span>
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
                money on a light box. So the person picks, and every number
                above moves with it. */}
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

            {tips.map((tip) => (
              <p className="cz-hb-tip" key={tip}>
                {tip}
              </p>
            ))}
          </div>

          <div className="cz-hb-panel cz-hb-panel-lines">
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

          {/* The last cell is what the person does next. It is the only cell
              that is not a number, so it gets its own column rather than
              hanging off the bottom of the rates. */}
          <div className="cz-hb-parcel-go">
            <button
              type="button"
              className="cz-hb-cta"
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

            {/* STEPS-HANDOFF item 7: no "+ Parcel B" control here, and the
                new rail renders none either. One box per haul. */}
          </div>
        </div>
      </section>
    </div>
  );
}
