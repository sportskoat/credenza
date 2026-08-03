// A5 · the fit ladder, top panel.
// Onboarding handoff README, "A5 · Upgrade path — the fit ladder".
//
// Purpose: collect the remaining data one field at a time, over weeks, never
// as a form. The panel shows what is saved, what comes next, and what waits.
// The bottom panel (one field) lives in FirstSizeBlock, so this file only
// renders the meter and the four rows.
//
// Every value here is a PROJECTION of the profile and the fit preference.
// Nothing on this panel is stored.
//
// DEVIATION, flagged for review: the README shows one filled example, so the
// four unsaved tails and the three other header labels are derived. Each one
// reuses a phrase from the README copy deck in the same register.
import { formatMeasure } from "../credenza-fashion.jsx";

/** Row keys, in README order. Exported so tests pin them. */
export const FIT_LADDER_KEYS = ["Usual size", "How you like it", "Chest", "Waist"];

/** The tail shown when a row is not saved yet. README supplies rows 3 and 4. */
export const FIT_LADDER_PENDING_TAILS = {
  "Usual size": "where you sit on the chart",
  "How you like it": "which way to move off it",
  Chest: "removes the guess",
  Waist: "for bottoms",
};

export const FIT_LADDER_STATUS = { saved: "SAVED", next: "NEXT", later: "LATER" };

/** Header right label. Names what Credenza can score right now. */
export const FIT_LADDER_COVERAGE = {
  none: "NOTHING SAVED YET",
  tops: "TOPS ARE COVERED",
  bottoms: "BOTTOMS ARE COVERED",
  both: "TOPS AND BOTTOMS COVERED",
};

const num = (raw) => {
  const value = Number(raw);
  return isFinite(value) && value > 0 ? value : null;
};

const text = (raw) => {
  const value = String(raw == null ? "" : raw).trim();
  return value || "";
};

/**
 * Project the four ladder rows from the profile and the fit preference.
 *
 * The card's own category decides which measure is asked for next: a bottoms
 * card puts Waist ahead of Chest. Only one row is ever NEXT.
 *
 * @param {object} opts
 * @param {object|null} opts.profile - the saved body profile
 * @param {object|null} opts.fitPref - the saved fit preference for this category
 * @param {string} opts.category
 * @param {"cm"|"in"} opts.units
 * @returns {{rows: Array<{key: string, tail: string, status: string}>, saved: number, total: number, coverage: string}}
 */
export function fitLadderRows({ profile, fitPref, category, units = "cm" } = {}) {
  const p = profile && typeof profile === "object" ? profile : {};
  const bottoms = category === "pants" || category === "shorts";

  const usual = text(p.usualSize) || text(p.usualTops) || text(p.usualBottoms);
  const looseness = text(fitPref && fitPref.looseness);
  const chest = num(p.chest);
  const waist = num(p.waist);

  const saved = {
    "Usual size": usual ? usual.toUpperCase() : "",
    "How you like it": looseness ? looseness.toLowerCase() : "",
    Chest: chest == null ? "" : formatMeasure(chest, units),
    Waist: waist == null ? "" : formatMeasure(waist, units),
  };

  // A bottoms card asks for the waist before the chest.
  const order = bottoms
    ? ["Usual size", "How you like it", "Waist", "Chest"]
    : FIT_LADDER_KEYS;

  let nextTaken = false;
  const byKey = {};
  order.forEach((key) => {
    const value = saved[key];
    if (value) {
      byKey[key] = { key, tail: value, status: FIT_LADDER_STATUS.saved };
      return;
    }
    byKey[key] = {
      key,
      tail: FIT_LADDER_PENDING_TAILS[key],
      status: nextTaken ? FIT_LADDER_STATUS.later : FIT_LADDER_STATUS.next,
    };
    nextTaken = true;
  });

  // Display order stays the README order, whatever the ask order was.
  const rows = FIT_LADDER_KEYS.map((key) => byKey[key]);
  const savedCount = rows.filter((r) => r.status === FIT_LADDER_STATUS.saved).length;

  const topsOk = chest != null || !!usual;
  const bottomsOk = waist != null || !!text(p.usualBottoms);
  let coverage = FIT_LADDER_COVERAGE.none;
  if (topsOk && bottomsOk) coverage = FIT_LADDER_COVERAGE.both;
  else if (topsOk) coverage = FIT_LADDER_COVERAGE.tops;
  else if (bottomsOk) coverage = FIT_LADDER_COVERAGE.bottoms;

  return { rows, saved: savedCount, total: FIT_LADDER_KEYS.length, coverage };
}

/**
 * @param {object} props
 * @param {object|null} props.profile
 * @param {object|null} [props.fitPref]
 * @param {string} [props.category]
 * @param {"cm"|"in"} [props.units]
 */
export default function FitLadder({ profile, fitPref, category = "shirt", units = "cm" }) {
  const { rows, saved, total, coverage } = fitLadderRows({ profile, fitPref, category, units });
  const meter = [];
  for (let i = 0; i < total; i += 1) meter.push(i < saved);

  return (
    <section className="cz-fit-ladder" aria-label="Your fit">
      <div className="cz-fit-ladder-head">
        <span className="cz-fit-ladder-eyebrow">
          Your fit · {saved} of {total}
        </span>
        <span className="cz-fit-ladder-coverage">{coverage}</span>
      </div>
      <div
        className="cz-fit-ladder-meter"
        role="img"
        aria-label={saved + " of " + total + " answers saved"}
      >
        {meter.map((on, i) => (
          <span
            key={i}
            className={"cz-fit-ladder-seg" + (on ? " is-on" : "")}
            aria-hidden="true"
          />
        ))}
      </div>
      <ul className="cz-fit-ladder-rows">
        {rows.map((row) => (
          <li key={row.key} className="cz-fit-ladder-row">
            <span className="cz-fit-ladder-row-k">
              {row.key} · {row.tail}
            </span>
            <span
              className={
                "cz-fit-ladder-row-s" +
                (row.status === FIT_LADDER_STATUS.saved ? " is-saved" : "")
              }
            >
              {row.status}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
