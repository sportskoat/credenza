// Phase 1 first-size chooser UI (F 2026-08-02).
// Mounts when the profile is empty. Three ways: Guess / Match (coming soon) /
// Measure. Skip lands on the Fix-0 honest empty state for this visit.
import { useMemo, useState } from "react";
import {
  FIRST_SIZE_SIT_OPTIONS,
  FIRST_SIZE_USUAL_CHIPS,
  FIRST_SIZE_USUAL_FIT_PROV,
  guessSizeFromUsual,
  profilePatchFromGuess,
  profilePatchFromMeasure,
  sitLabel,
} from "./first-size.js";
import { formatSizeToken } from "../credenza-fashion.jsx";

/**
 * @param {object} props
 * @param {object} props.item
 * @param {object|null} props.chart - parsed size chart when available
 * @param {"cm"|"in"} props.units
 * @param {(patch: object) => void} props.onSaveBodyProfile
 * @param {(category: string, pref: object) => void} [props.onSaveFitPref]
 * @param {() => void} [props.onSkip]
 * @param {() => void} [props.onOpenMeasureHelp]
 */
export default function FirstSizeBlock({
  item,
  chart,
  units: unitsProp = "cm",
  onSaveBodyProfile,
  onSaveFitPref,
  onSkip,
  onOpenMeasureHelp,
  /** When true, open on the Fix-0 honest skipped state (already skipped this visit). */
  startSkipped = false,
}) {
  // choose | guess-size | guess-sit | measure | skipped | result
  const [step, setStep] = useState(startSkipped ? "skipped" : "choose");
  const [usual, setUsual] = useState("");
  const [sit, setSit] = useState("");
  const [units, setUnits] = useState(unitsProp === "in" ? "in" : "cm");
  const [measureDraft, setMeasureDraft] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const category = (item && item.category) || "shirt";
  const bottoms = category === "pants" || category === "shorts";
  const title = (item && item.title) || "";
  const hasChart = !!(chart && Array.isArray(chart.rows) && chart.rows.length >= 2);

  const garmentWord = bottoms ? "pair" : "tee";

  const saveGuess = (nextUsual, nextSit) => {
    const out = guessSizeFromUsual({
      chart,
      usualLetter: nextUsual,
      sit: nextSit,
      category,
      title,
    });
    if (out.error) {
      setError(
        out.error === "usual-not-on-chart"
          ? "That size is not on this seller’s chart. Try another letter, or measure instead."
          : out.error === "no-chart"
            ? "No size chart on this card yet. Measure instead, or wait for a chart read."
            : "Could not score a pick. Try Measure instead."
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

  if (step === "skipped") {
    return (
      <section className="cz-first-size cz-first-size-skipped" aria-label="Your size">
        <div className="cz-sizing-head">
          <span className="cz-sizing-dot" aria-hidden="true" />
          <span className="cz-sizing-kicker">Your size</span>
          <span className="cz-sizing-prov">No pick yet</span>
        </div>
        <p className="cz-first-size-honest">
          <strong>No size pick yet.</strong> Add your size to see which one fits.
        </p>
        <p className="cz-first-size-promise">We will not ask again this visit.</p>
        <button
          type="button"
          className="cz-first-size-primary"
          onClick={() => {
            setStep("choose");
            setError("");
          }}
        >
          Add my size
        </button>
      </section>
    );
  }

  if (step === "result" && result && !result.measured) {
    const sizeLabel = formatSizeToken(result.size) || result.size;
    return (
      <section className="cz-first-size cz-first-size-result" aria-label="Your size">
        <div className="cz-sizing-head">
          <span className="cz-sizing-dot" aria-hidden="true" />
          <span className="cz-sizing-kicker">{FIRST_SIZE_USUAL_FIT_PROV.kicker}</span>
          <span className="cz-sizing-prov is-usual-fit">{FIRST_SIZE_USUAL_FIT_PROV.rail}</span>
        </div>
        <div className="cz-first-size-hero">
          <span className="cz-first-size-letter">{sizeLabel}</span>
          <span className="cz-first-size-body">{FIRST_SIZE_USUAL_FIT_PROV.body}</span>
        </div>
        <p className="cz-first-size-meta">
          Usual {formatSizeToken(result.usual) || result.usual}
          {result.sit ? " · " + sitLabel(result.sit) + " fit" : ""}
        </p>
        <button
          type="button"
          className="cz-first-size-link"
          onClick={() => {
            setStep("measure");
            setError("");
          }}
        >
          {FIRST_SIZE_USUAL_FIT_PROV.upgrade} for an exact pick
        </button>
      </section>
    );
  }

  if (step === "result" && result && result.measured) {
    return (
      <section className="cz-first-size cz-first-size-result" aria-label="Your size">
        <div className="cz-sizing-head">
          <span className="cz-sizing-dot" aria-hidden="true" />
          <span className="cz-sizing-kicker">AI size</span>
          <span className="cz-sizing-prov is-chart">Chart pick · your measure</span>
        </div>
        <p className="cz-first-size-body">
          Saved. Every card on your shelf re-scores with this number.
        </p>
      </section>
    );
  }

  if (step === "guess-size") {
    return (
      <section className="cz-first-size" aria-label="Guess your size">
        <div className="cz-first-size-step">Step 1 of 2</div>
        <h3 className="cz-first-size-title">What size do you usually buy?</h3>
        <p className="cz-first-size-copy">
          This seller posted a chart. Your usual size tells us where you sit on it.
        </p>
        <div className="cz-first-size-chips" role="group" aria-label="Usual size">
          {FIRST_SIZE_USUAL_CHIPS.map((s) => (
            <button
              key={s}
              type="button"
              className={"cz-first-size-chip" + (usual === s ? " is-on" : "")}
              onClick={() => {
                setUsual(s);
                setError("");
                setStep("guess-sit");
              }}
            >
              {s}
            </button>
          ))}
        </div>
        {!hasChart ? (
          <p className="cz-first-size-warn">
            No chart on this card yet — Guess needs a chart. Measure still works.
          </p>
        ) : null}
        {error ? <p className="cz-first-size-error">{error}</p> : null}
        <button type="button" className="cz-first-size-back" onClick={() => setStep("choose")}>
          Back
        </button>
      </section>
    );
  }

  if (step === "guess-sit") {
    return (
      <section className="cz-first-size" aria-label="How it should sit">
        <div className="cz-first-size-step">Step 2 of 2</div>
        <h3 className="cz-first-size-title">
          How do you like a {garmentWord} to sit?
        </h3>
        <div className="cz-first-size-sits" role="group" aria-label="Fit preference">
          {FIRST_SIZE_SIT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={"cz-first-size-sit" + (sit === opt.value ? " is-on" : "")}
              onClick={() => {
                setSit(opt.value);
                saveGuess(usual, opt.value);
              }}
            >
              <span className="cz-first-size-sit-label">{opt.label}</span>
              <span className="cz-first-size-sit-hint">{opt.hint}</span>
            </button>
          ))}
        </div>
        {error ? <p className="cz-first-size-error">{error}</p> : null}
        <button type="button" className="cz-first-size-back" onClick={() => setStep("guess-size")}>
          Back
        </button>
      </section>
    );
  }

  if (step === "measure") {
    const fieldLabel = bottoms ? "Waist" : "Chest (pit to pit)";
    return (
      <form className="cz-first-size" aria-label="Measure once" onSubmit={saveMeasure}>
        <h3 className="cz-first-size-title">One number, one time.</h3>
        <p className="cz-first-size-copy">
          {bottoms
            ? "Type your waist. We save it for every bottoms card."
            : "Measure armpit to armpit on a shirt that fits, then we double it for full chest."}
        </p>
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
        {onOpenMeasureHelp || !bottoms ? (
          <button
            type="button"
            className="cz-first-size-link"
            onClick={() => {
              if (onOpenMeasureHelp) onOpenMeasureHelp();
            }}
          >
            Show me how
          </button>
        ) : null}
        {error ? <p className="cz-first-size-error">{error}</p> : null}
        <div className="cz-first-size-actions">
          <button type="submit" className="cz-first-size-primary">
            Save
          </button>
          <button type="button" className="cz-first-size-back" onClick={() => setStep("choose")}>
            Back
          </button>
        </div>
      </form>
    );
  }

  // Default: chooser
  return (
    <section className="cz-first-size cz-first-size-choose" aria-label="How should we size you">
      <h3 className="cz-first-size-title">How should we size you?</h3>
      <p className="cz-first-size-copy">Pick one. You can change it later.</p>
      <div className="cz-first-size-ways">
        <button
          type="button"
          className="cz-first-size-way"
          onClick={() => {
            setStep("guess-size");
            setError("");
          }}
        >
          <span className="cz-first-size-way-title">Guess</span>
          <span className="cz-first-size-way-copy">Your usual size, then how you like it to sit. Two taps.</span>
        </button>
        <button
          type="button"
          className="cz-first-size-way is-disabled"
          disabled
          title="Coming soon — brand list is being built"
          aria-disabled="true"
        >
          <span className="cz-first-size-way-title">
            Match with a shirt <span className="cz-first-size-soon">Soon</span>
          </span>
          <span className="cz-first-size-way-copy">
            Name a brand shirt that fits you, like a Uniqlo L.
          </span>
        </button>
        <button
          type="button"
          className="cz-first-size-way"
          onClick={() => {
            setStep("measure");
            setError("");
          }}
        >
          <span className="cz-first-size-way-title">Measure</span>
          <span className="cz-first-size-way-copy">
            {bottoms ? "One waist number." : "One chest number — pit to pit, we double it."}
          </span>
        </button>
      </div>
      {onSkip ? (
        <button
          type="button"
          className="cz-first-size-skip"
          onClick={() => {
            setStep("skipped");
            onSkip();
          }}
        >
          Skip for now
        </button>
      ) : null}
    </section>
  );
}
