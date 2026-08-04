// A1–A4 · the first-size ask, the pick, and the honest skipped state.
// Onboarding handoff README, "Screens / views". Copy is verbatim from the
// README copy deck, with one house-style change: CONTEXT.md bans the em dash
// in rendered site content, so each README em dash becomes a period or comma.
//
// SHIP PATH: A0 → A1 → A2 → A3. The README Definition of Done says "Taps to
// first pick is exactly 2", so this block opens straight on A1. The old
// three-way chooser ("How should we size you?") is gone; it cost a third tap
// and never appeared in the README. Measure stays reachable from the A1 tape
// link, so no path is lost.
//
// EASE HINTS: the README labels its +2 / +6 / +12 deltas "a designer's
// estimate — validate against real parsed charts before ship" (Open questions
// 1). The shipped hints are the live CHEST_EASE_BANDS ranges, pinned by
// test "F HOLD #81", so the chip text can never drift from the engine.
import { useRef, useState } from "react";
import {
  FIRST_SIZE_SIT_OPTIONS,
  FIRST_SIZE_USUAL_CHIPS,
  FIRST_SIZE_USUAL_FIT_PROV,
  FIRST_SIZE_USUAL_NO_CHART_PROV,
  chartRowForUsual,
  chartUsableForGuess,
  guessSizeFromUsual,
  primaryMeasureKey,
  profilePatchFromGuess,
  profilePatchFromMeasure,
  sitLabel,
} from "./first-size.js";
import { compactSizeToken, formatMeasure, formatSizeToken } from "../credenza-fashion.jsx";
import FitLadder from "./FitLadder.jsx";

/** README copy deck, verbatim. Exported so tests pin the strings. */
export const FIRST_SIZE_COPY = {
  eyebrow: "Your size",
  step1: "Step 1 of 2",
  step2: "Step 2 of 2",
  ask1Title: "What size do you usually buy?",
  ask1Body: "This seller's chart is posted. Your usual size tells us where you sit on it.",
  ask1BodyNoChart: "No seller chart on this listing. Your usual size becomes the pick.",
  tapeLink: "I have a tape · enter chest",
  // Bottoms cards ask for a waist, so the link must not promise a chest.
  tapeLinkWaist: "I have a tape · enter waist",
  skip: "Skip for now",
  ask2Tail: "This tells us which way to move off it.",
  showMySize: "Show my size",
  noPickFlag: "No pick yet",
  skippedTitle: "No size pick yet.",
  // README em dash rewritten as a period, per CONTEXT.md.
  skippedBody:
    "This seller's chart is read and ready. We just don't know anything about you yet. One tap is enough to start.",
  // Kyle 2026-08-04: the skipped state claimed "chart is read and ready" on
  // listings with NO chart at all. Same split as ask1: no chart, no claim.
  skippedBodyNoChart:
    "No seller chart on this listing yet. Your usual size still becomes the pick.",
  addMySize: "Add my size",
  privacy: "Signed out · your answers stay on this phone. We won't ask again this visit.",
  provTail: "to remove the guess.",
  ladderHeadline: "One number, one time.",
};

/** The three A3 tile labels, in README order. */
export const FIRST_SIZE_TILE_LABELS = ["Anchor", "Garment", "Ease"];

/**
 * One sentence of reasoning for A3. README example, with the em dash rewritten
 * as a comma: "The Large is 104cm here, 6cm over the 98cm this seller's
 * M-wearers sit at, which is the regular fit you picked."
 */
export function firstSizePickReasoning({ sizeLabel, usualLetter, garment, body, diff, sit, units }) {
  if (!sizeLabel || garment == null || body == null || diff == null) return "";
  const anchor = compactSizeToken(usualLetter) || String(usualLetter || "").toUpperCase();
  const room = formatMeasure(Math.abs(diff), units);
  const way = diff < 0 ? "under" : "over";
  const how = (sitLabel(sit) || "").toLowerCase();
  return (
    "The " +
    sizeLabel +
    " is " +
    formatMeasure(garment, units) +
    " here, " +
    room +
    " " +
    way +
    " the " +
    formatMeasure(body, units) +
    " this seller's " +
    anchor +
    "-wearers sit at" +
    (how ? ", which is the " + how + " fit you picked" : "") +
    "."
  );
}

/** Signed ease string for the A3 EASE tile. */
export function firstSizeEaseValue(diff, units) {
  if (diff == null || !isFinite(diff)) return "";
  return (diff < 0 ? "-" : "+") + formatMeasure(Math.abs(diff), units);
}

/**
 * The A1 chip run. README: "Chips come from the listing's own size run, not a
 * fixed S–XL list. Numeric listings render numeric chips."
 */
export function firstSizeChipRun(sizeRun) {
  const seen = new Set();
  const out = [];
  (Array.isArray(sizeRun) ? sizeRun : []).forEach((raw) => {
    const value = String(raw == null ? "" : raw).trim();
    if (!value || seen.has(value)) return;
    seen.add(value);
    out.push(value);
  });
  return out.length ? out : FIRST_SIZE_USUAL_CHIPS;
}

/**
 * @param {object} props
 * @param {object} props.item
 * @param {object|null} props.chart - parsed size chart when available
 * @param {string[]} [props.sizeRun] - this listing's own size run, for the A1 chips
 * @param {object|null} [props.bodyProfile] - saved measures, for the A5 ladder
 * @param {object|null} [props.fitPref] - saved fit preference, for the A5 ladder
 * @param {"cm"|"in"} props.units
 * @param {(patch: object) => void} props.onSaveBodyProfile
 * @param {(category: string, pref: object) => void} [props.onSaveFitPref]
 * @param {() => void} [props.onSkip]
 * @param {() => void} [props.onOpenMeasureHelp]
 * @param {string} [props.blockReason] - when the chart is missing because of
 *   OUR limit (cap/auth/outage), the honest reason line that replaces the
 *   "No seller chart" sentence above the chips (Lane D, 2026-08-04).
 */
export default function FirstSizeBlock({
  item,
  chart,
  sizeRun,
  bodyProfile,
  fitPref,
  units: unitsProp = "cm",
  onSaveBodyProfile,
  onSaveFitPref,
  onSkip,
  onOpenMeasureHelp,
  blockReason = "",
  /** When true, open on the honest skipped state (already skipped this visit). */
  startSkipped = false,
}) {
  // ask1 | ask2 | measure | skipped | result
  const [step, setStep] = useState(startSkipped ? "skipped" : "ask1");
  const [usual, setUsual] = useState("");
  const [sit, setSit] = useState("");
  const [units, setUnits] = useState(unitsProp === "in" ? "in" : "cm");
  const [measureDraft, setMeasureDraft] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const chipRefs = useRef([]);

  const category = (item && item.category) || "shirt";
  const bottoms = category === "pants" || category === "shorts";
  const title = (item && item.title) || "";
  const hasChart = chartUsableForGuess(chart);
  const chips = firstSizeChipRun(sizeRun);
  const garmentWord = bottoms ? "pair" : "tee";
  const describeId = "cz-fs-" + ((item && item.id) || "card");

  const saveGuess = (nextUsual, nextSit) => {
    const out = guessSizeFromUsual({
      chart,
      usualLetter: nextUsual,
      sit: nextSit,
      category,
      title,
    });
    if (out.error) {
      // no-chart is never an error — only letter-not-on-chart / score miss.
      //
      // Kyle 2026-08-03 audit, finding 6: both sentences send a person to the
      // tape field, and this step held only "Back" and "Skip". The field is on
      // another step, so the message named a place with no way to reach it.
      // The button below the message opens it. The second sentence also said
      // "chest" on a card that asks for a waist; it now names the real field.
      setError(
        out.error === "usual-not-on-chart"
          ? "That size is not on this seller’s chart. Try another one, or use a tape."
          : "Could not score a pick. Enter your " + (bottoms ? "waist" : "chest") + " instead."
      );
      return;
    }
    const patch = profilePatchFromGuess({
      usualLetter: nextUsual,
      body: out.body,
      category,
    });
    if (onSaveBodyProfile) onSaveBodyProfile(patch);
    if (onSaveFitPref && out.fitPref) onSaveFitPref(category, out.fitPref);
    setResult({
      size: out.rec.size,
      sit: nextSit,
      usual: nextUsual,
      noChart: !!out.noChart,
      garment: out.rec.garment == null ? null : out.rec.garment,
      body: out.rec.body == null ? null : out.rec.body,
      diff: out.rec.diff == null ? null : out.rec.diff,
    });
    setStep("result");
    setError("");
  };

  const saveMeasure = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const patch = profilePatchFromMeasure({
      category,
      displayValue: measureDraft,
      units,
    });
    if (!patch) {
      setError("Enter a number greater than zero.");
      return;
    }
    if (onSaveBodyProfile) onSaveBodyProfile(patch);
    setResult({
      size: null, // parent re-scores from profile
      measured: true,
      key: bottoms ? "waist" : "chest",
    });
    setStep("result");
    setError("");
  };

  /** Arrow keys move focus across a chip row, per the README accessibility note. */
  const onChipKeyDown = (e, index, total) => {
    const forward = e.key === "ArrowRight" || e.key === "ArrowDown";
    const back = e.key === "ArrowLeft" || e.key === "ArrowUp";
    if (!forward && !back) return;
    e.preventDefault();
    const next = forward ? (index + 1) % total : (index - 1 + total) % total;
    const el = chipRefs.current[next];
    if (el && el.focus) el.focus();
  };

  const skipButton = onSkip ? (
    <button
      type="button"
      className="cz-first-size-skip"
      onClick={() => {
        setStep("skipped");
        onSkip();
      }}
    >
      {FIRST_SIZE_COPY.skip}
    </button>
  ) : null;

  // ── A4 · skipped, the honest state ──
  if (step === "skipped") {
    return (
      <section className="cz-first-size cz-first-size-skipped" aria-label="Your size">
        <div className="cz-first-size-head">
          <span className="cz-first-size-eyebrow">{FIRST_SIZE_COPY.eyebrow}</span>
          <span className="cz-first-size-flag is-none">{FIRST_SIZE_COPY.noPickFlag}</span>
        </div>
        <h3 className="cz-first-size-title">{FIRST_SIZE_COPY.skippedTitle}</h3>
        <p className="cz-first-size-copy">
          {hasChart
            ? FIRST_SIZE_COPY.skippedBody
            : blockReason || FIRST_SIZE_COPY.skippedBodyNoChart}
        </p>
        <button
          type="button"
          className="cz-first-size-primary"
          onClick={() => {
            setStep("ask1");
            setError("");
          }}
        >
          {FIRST_SIZE_COPY.addMySize}
        </button>
        <p className="cz-first-size-promise">{FIRST_SIZE_COPY.privacy}</p>
      </section>
    );
  }

  // ── A3 · the pick ──
  if (step === "result" && result && !result.measured) {
    const sizeLabel = formatSizeToken(result.size) || result.size;
    // No-chart Guess → existing YOUR USUAL rail, not chart-anchored usual-fit.
    const prov = result.noChart ? FIRST_SIZE_USUAL_NO_CHART_PROV : FIRST_SIZE_USUAL_FIT_PROV;
    const anchorValue = "Usual " + (compactSizeToken(result.usual) || result.usual);
    const showTiles = !result.noChart && result.garment != null && result.diff != null;
    const reasoning = showTiles
      ? firstSizePickReasoning({
          sizeLabel,
          usualLetter: result.usual,
          garment: result.garment,
          body: result.body,
          diff: result.diff,
          sit: result.sit,
          units,
        })
      : prov.body;
    return (
      <section
        className={"cz-first-size cz-first-size-result" + (showTiles ? " is-resolved" : "")}
        aria-label="Your size"
      >
        <div className="cz-first-size-head">
          <span className="cz-first-size-eyebrow">{FIRST_SIZE_COPY.eyebrow}</span>
          <span
            className={"cz-first-size-flag" + (result.noChart ? " is-usual" : " is-money")}
            id={describeId + "-flag"}
          >
            {prov.rail}
          </span>
        </div>
        <div className="cz-first-size-hero">
          <span
            className="cz-first-size-letter"
            aria-describedby={describeId + "-flag " + describeId + "-prov"}
          >
            {sizeLabel}
          </span>
          <span className="cz-first-size-reason">{reasoning}</span>
        </div>
        {showTiles ? (
          <div className="cz-first-size-tiles" aria-label="Fit numbers">
            <div className="cz-first-size-tile">
              <span className="cz-first-size-tile-k">{FIRST_SIZE_TILE_LABELS[0]}</span>
              <span className="cz-first-size-tile-v">{anchorValue}</span>
            </div>
            <div className="cz-first-size-tile">
              <span className="cz-first-size-tile-k">{FIRST_SIZE_TILE_LABELS[1]}</span>
              <span className="cz-first-size-tile-v">{formatMeasure(result.garment, units)}</span>
            </div>
            <div className="cz-first-size-tile">
              <span className="cz-first-size-tile-k">{FIRST_SIZE_TILE_LABELS[2]}</span>
              <span className="cz-first-size-tile-v is-money">
                {firstSizeEaseValue(result.diff, units)}
              </span>
            </div>
          </div>
        ) : null}
        <p className="cz-first-size-prov" id={describeId + "-prov"}>
          {prov.body}{" "}
          <button
            type="button"
            className="cz-first-size-link"
            onClick={() => {
              setStep("measure");
              setError("");
            }}
          >
            {prov.upgrade}
          </button>{" "}
          {FIRST_SIZE_COPY.provTail}
        </p>
      </section>
    );
  }

  if (step === "result" && result && result.measured) {
    return (
      <section className="cz-first-size cz-first-size-result" aria-label="Your size">
        <div className="cz-first-size-head">
          <span className="cz-first-size-eyebrow">{FIRST_SIZE_COPY.eyebrow}</span>
          <span className="cz-first-size-flag is-money">Chart pick · your measure</span>
        </div>
        <p className="cz-first-size-copy">
          Saved. Every card on your shelf re-scores with this number.
        </p>
      </section>
    );
  }

  // ── A1 · ask 1 of 2, usual size ──
  if (step === "ask1") {
    return (
      <section className="cz-first-size cz-first-size-ask" aria-label="Your size">
        <div className="cz-first-size-head">
          <span className="cz-first-size-eyebrow">{FIRST_SIZE_COPY.eyebrow}</span>
          <span className="cz-first-size-flag is-warn">{FIRST_SIZE_COPY.step1}</span>
        </div>
        <h3 className="cz-first-size-title">{FIRST_SIZE_COPY.ask1Title}</h3>
        {/* The reason line replaces the "No seller chart" sentence when the
            chart is missing because of our own limit — the chips stay the
            primary action either way. */}
        <p className="cz-first-size-copy">
          {hasChart ? FIRST_SIZE_COPY.ask1Body : blockReason || FIRST_SIZE_COPY.ask1BodyNoChart}
        </p>
        <div className="cz-first-size-chips" role="radiogroup" aria-label="Usual size">
          {chips.map((s, i) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={usual === s}
              tabIndex={usual === s || (!usual && i === 0) ? 0 : -1}
              ref={(el) => {
                chipRefs.current[i] = el;
              }}
              className={"cz-first-size-chip" + (usual === s ? " is-on" : "")}
              onKeyDown={(e) => onChipKeyDown(e, i, chips.length)}
              onClick={() => {
                setUsual(s);
                setSit("");
                setError("");
                setStep("ask2");
              }}
            >
              {s}
            </button>
          ))}
        </div>
        {error ? <p className="cz-first-size-error">{error}</p> : null}
        <div className="cz-first-size-foot">
          <button
            type="button"
            className="cz-first-size-link"
            onClick={() => {
              setStep("measure");
              setError("");
            }}
          >
            {bottoms ? FIRST_SIZE_COPY.tapeLinkWaist : FIRST_SIZE_COPY.tapeLink}
          </button>
          {skipButton}
        </div>
      </section>
    );
  }

  // ── A2 · ask 2 of 2, preferred ease ──
  if (step === "ask2") {
    const anchorLabel = "Usual " + (compactSizeToken(usual) || usual);
    // The chart number is real: it comes from the row the visitor just tapped.
    const anchorRow = chartRowForUsual(chart, usual);
    const anchorKey = primaryMeasureKey(chart, category);
    const anchorNumber = anchorRow && anchorKey ? anchorRow[anchorKey] : null;
    const ask2Body =
      anchorNumber == null
        ? FIRST_SIZE_COPY.ask2Tail
        : "Your " +
          anchorLabel.toLowerCase() +
          " is " +
          formatMeasure(Number(anchorNumber), units) +
          " on this chart. " +
          FIRST_SIZE_COPY.ask2Tail;
    return (
      <section className="cz-first-size cz-first-size-ask" aria-label="Your size">
        <div className="cz-first-size-head">
          <span className="cz-first-size-eyebrow">
            {FIRST_SIZE_COPY.eyebrow} · {anchorLabel}
          </span>
          <span className="cz-first-size-flag is-warn">{FIRST_SIZE_COPY.step2}</span>
        </div>
        <h3 className="cz-first-size-title">How do you like a {garmentWord} to sit?</h3>
        <p className="cz-first-size-copy">{ask2Body}</p>
        <div className="cz-first-size-sits" role="radiogroup" aria-label="Fit preference">
          {FIRST_SIZE_SIT_OPTIONS.map((opt, i) => (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={sit === opt.value}
              tabIndex={sit === opt.value || (!sit && i === 0) ? 0 : -1}
              ref={(el) => {
                chipRefs.current[i] = el;
              }}
              className={"cz-first-size-sit" + (sit === opt.value ? " is-on" : "")}
              onKeyDown={(e) => onChipKeyDown(e, i, FIRST_SIZE_SIT_OPTIONS.length)}
              onClick={() => {
                setSit(opt.value);
                setError("");
              }}
            >
              <span className="cz-first-size-sit-label">{opt.label}</span>
              <span className="cz-first-size-sit-hint">{opt.hint}</span>
            </button>
          ))}
        </div>
        {error ? (
          <>
            <p className="cz-first-size-error">{error}</p>
            {/* Finding 6: the message above names the tape field. This opens
                it. It appears only with the message, because with no failure
                the step-1 link is the right place to offer a tape. */}
            <button
              type="button"
              className="cz-first-size-link cz-first-size-error-link"
              onClick={() => {
                setStep("measure");
                setError("");
              }}
            >
              {bottoms ? FIRST_SIZE_COPY.tapeLinkWaist : FIRST_SIZE_COPY.tapeLink}
            </button>
          </>
        ) : null}
        <button
          type="button"
          className="cz-first-size-primary"
          disabled={!sit}
          onClick={() => saveGuess(usual, sit)}
        >
          {FIRST_SIZE_COPY.showMySize}
        </button>
        <div className="cz-first-size-foot is-centred">
          <button
            type="button"
            className="cz-first-size-back"
            onClick={() => {
              setStep("ask1");
              setError("");
            }}
          >
            Back
          </button>
          {skipButton}
        </div>
      </section>
    );
  }

  // ── A5 entry · the tape field, reached from the A1 link or the A3 provenance ──
  const fieldLabel = bottoms ? "Waist, at your natural waist" : "Chest, pit to pit, doubled";
  return (
    <>
      <FitLadder
        profile={bodyProfile}
        fitPref={fitPref}
        category={category}
        units={units}
      />
      <form
        className="cz-first-size cz-first-size-ladder"
        aria-label="Your size"
        onSubmit={saveMeasure}
      >
        <h3 className="cz-first-size-title">{FIRST_SIZE_COPY.ladderHeadline}</h3>
        <p className="cz-first-size-copy">
          {bottoms
            ? "Type your waist. We save it for every bottoms card."
            : "Lay a tee that fits you flat. Measure armpit to armpit, double it. That is chest."}
        </p>
        <label className="cz-first-size-field">
          <span className="cz-first-size-field-label">{fieldLabel}</span>
          <span className="cz-first-size-field-control">
            <input
              inputMode="decimal"
              value={measureDraft}
              onChange={(e) => {
                setMeasureDraft(e.target.value.replace(/[^\d.]/g, ""));
                setError("");
              }}
              placeholder={units === "in" ? (bottoms ? "32" : "21") : bottoms ? "84" : "54"}
              aria-label={fieldLabel + " in " + units}
            />
            <span aria-hidden="true">{units}</span>
          </span>
        </label>
        <div className="cz-first-size-unit-row">
          <div className="cz-first-size-unit" role="group" aria-label="Units">
            <button
              type="button"
              className={"cz-first-size-unit-btn" + (units === "cm" ? " is-on" : "")}
              onClick={() => setUnits("cm")}
            >
              cm
            </button>
            <button
              type="button"
              className={"cz-first-size-unit-btn" + (units === "in" ? " is-on" : "")}
              onClick={() => setUnits("in")}
            >
              in
            </button>
          </div>
          <button
            type="button"
            className="cz-first-size-link"
            onClick={() => {
              if (onOpenMeasureHelp) onOpenMeasureHelp();
            }}
          >
            Show me how
          </button>
        </div>
        {error ? <p className="cz-first-size-error">{error}</p> : null}
        <div className="cz-first-size-actions">
          <button type="submit" className="cz-first-size-primary">
            Save and re-score my cards
          </button>
          <button
            type="button"
            className="cz-first-size-back"
            onClick={() => {
              setStep("ask1");
              setError("");
            }}
          >
            Back
          </button>
        </div>
        <p className="cz-first-size-promise">
          Updates every card on your shelf, not just this one. The full tape list still lives in
          Settings.
        </p>
      </form>
    </>
  );
}
