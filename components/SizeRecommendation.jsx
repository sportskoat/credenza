import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import {
  CATEGORIES,
  FIT_PREF_AXES,
  FIT_SUMMARY_ON,
  SIZE_PICK_SKIP_CATEGORIES,
  effectiveBodyProfile,
  fitPrefHasChoice,
  fitPrefLabel,
  fitSummarySentence,
  formatMeasure,
  formatSizeToken,
  measureFromStorage,
  measureToStorage,
  parseSizeChart,
  recommendSize,
  sizeChartTextFor,
} from "../credenza-fashion.jsx";
import SizeChartTable from "./SizeChartTable.jsx";

// Measure fields the progressive fit ask needs for this category (design 4f).
// Tops → chest. Pants → waist + trouser length. Shorts → waist + shorts length
// (must write shortsLength — never pantsLength; engine reads bodyLegKey by
// category). Shoes → foot length. Fallback → chest + waist. Exported for the
// live DetailBody ask (CH-08) — the hint is the "Not sure how to measure?" line.
export function fitMeasureFieldsFor(category) {
  if (category === "shorts") {
    return [
      { key: "waist", label: "Waist", kind: "length", phCm: "80", phIn: "31.5", hint: "Measure around where you wear the waistband." },
      { key: "shortsLength", label: "Shorts length", kind: "length", phCm: "46", phIn: "18", hint: "Lay shorts you like flat. Measure from the top of the waistband to the hem — the way sellers do." },
    ];
  }
  if (category === "pants") {
    return [
      { key: "waist", label: "Waist", kind: "length", phCm: "80", phIn: "31.5", hint: "Measure around where you wear the waistband." },
      { key: "pantsLength", label: "Trouser length", kind: "length", phCm: "104", phIn: "41", hint: "Lay trousers you like flat. Measure from the top of the waistband to the hem — the way sellers do." },
    ];
  }
  if (category === "shoes") {
    return [
      { key: "footLength", label: "Foot length", kind: "length", phCm: "26.5", phIn: "10.4", hint: "Stand on paper, mark heel and longest toe, measure between the marks." },
    ];
  }
  if (category === "outerwear" || category === "shirt") {
    return [
      { key: "chest", label: "Chest", kind: "length", phCm: "96", phIn: "38", hint: "Measure around the fullest part of your chest, tape level." },
    ];
  }
  return [
    { key: "chest", label: "Chest", kind: "length", phCm: "96", phIn: "38", hint: "Measure around the fullest part of your chest, tape level." },
    { key: "waist", label: "Waist", kind: "length", phCm: "80", phIn: "31.5", hint: "Measure around where you wear the waistband." },
  ];
}

function fitHasPreciseBody(bodyProfile, category) {
  if (!bodyProfile) return false;
  if (category === "pants" || category === "shorts") {
    return bodyProfile.waist != null || bodyProfile.hip != null;
  }
  if (category === "outerwear" || category === "shirt") {
    return bodyProfile.chest != null;
  }
  return bodyProfile.chest != null || bodyProfile.waist != null || bodyProfile.hip != null;
}

// Segmented axis control for Length / Looseness (design 5a/5b).
// Empty selection = no preference. Tap active again to clear.
export function FitPrefAxis({ label, options, value, onChange }) {
  return (
    <div className="cz-fit-pref-axis">
      <div className="cz-fit-pref-axis-label">{label}</div>
      <div className="cz-fit-pref-axis-row" role="radiogroup" aria-label={label}>
        {options.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              type="button"
              key={opt.value}
              role="radio"
              aria-checked={active}
              className={"cz-fit-pref-chip" + (active ? " is-active" : "")}
              onClick={() => onChange(active ? null : opt.value)}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Design 4d–4g fit flow + turn 5 taste. Honest confidence, never a dead end
// when a chart exists. 4d nothing · 4e rough usual · 4f measure ask · 4g precise
// · 5b in-context preference · 5c pref visible on rec.
export default function SizeRecommendation({
  item,
  bodyProfile,
  units = "cm",
  sizeActive = false,
  onSaveEdit,
  onSaveBodyProfile,
  fitPromptSkipped = false,
  onSkipFitPrompt,
  fitPref = null,
  onSaveFitPref,
}) {
  const [chartOpen, setChartOpen] = useState(false);
  const [askingMeasures, setAskingMeasures] = useState(false);
  const [askingPref, setAskingPref] = useState(false);
  const [prefDraft, setPrefDraft] = useState({ length: null, looseness: null });
  const measureFields = fitMeasureFieldsFor(item.category);
  const [fitDraft, setFitDraft] = useState(() => {
    const d = { usualSize: "" };
    for (const f of measureFields) d[f.key] = "";
    return d;
  });
  const skipped = SIZE_PICK_SKIP_CATEGORIES.has(item.category);
  const chart = skipped ? null : parseSizeChart(sizeChartTextFor(item));
  const catAxes = FIT_PREF_AXES[item.category] || null;
  const rec =
    chart && bodyProfile
      ? recommendSize(
          chart,
          effectiveBodyProfile(bodyProfile),
          item.category,
          fitPref,
          null,
          item.title,
          sizeChartTextFor(item)
        )
      : null;
  const recSize = rec && rec.size ? rec.size : null;
  // An estimated profile (height+weight stand-ins) shows a pick but never
  // persists it — a later measured chest/waist must be able to win.
  const recIsEstimated = !!(bodyProfile && effectiveBodyProfile(bodyProfile).estimated);
  const hasUsual = !!(bodyProfile && bodyProfile.usualSize);
  const hasPrecise = fitHasPreciseBody(bodyProfile, item.category);
  // Need a taste prompt once per category when axes exist and user has not
  // saved or dismissed a preference yet.
  const needsPrefAsk =
    !!catAxes &&
    !!onSaveFitPref &&
    sizeActive &&
    !!chart &&
    !fitPrefHasChoice(fitPref) &&
    !(fitPref && fitPref.dismissed);
  // Persist the pick so every surface agrees with this box — meta chips and
  // edit form read item.recommendedSize. Guarded: one write when it changes.
  useEffect(() => {
    if (recSize && !recIsEstimated && recSize !== item.recommendedSize) {
      onSaveEdit(item.id, { recommendedSize: recSize });
    }
  }, [recSize, recIsEstimated, item.id, item.recommendedSize, onSaveEdit]);

  // Prefill measure ask from the saved body profile when the sheet opens.
  useEffect(() => {
    if (!askingMeasures) return;
    setFitDraft((prev) => {
      const next = { ...prev };
      if (bodyProfile && bodyProfile.usualSize && !next.usualSize) {
        next.usualSize = String(bodyProfile.usualSize);
      }
      for (const f of measureFields) {
        if (!next[f.key] && bodyProfile && bodyProfile[f.key] != null) {
          next[f.key] = measureFromStorage(bodyProfile[f.key], units, f.kind);
        }
      }
      return next;
    });
  }, [askingMeasures]); // eslint-disable-line react-hooks/exhaustive-deps

  if (skipped) return null;

  const unitHint = units === "in" ? "in" : "cm";
  const catLabel =
    item.category && CATEGORIES[item.category]
      ? CATEGORIES[item.category].label.toLowerCase()
      : "this item";

  const openMeasureAsk = () => {
    const next = { usualSize: (bodyProfile && bodyProfile.usualSize) || "" };
    for (const f of measureFields) {
      next[f.key] =
        bodyProfile && bodyProfile[f.key] != null
          ? measureFromStorage(bodyProfile[f.key], units, f.kind)
          : "";
    }
    setFitDraft(next);
    setAskingMeasures(true);
  };

  const saveMeasureAsk = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!onSaveBodyProfile) return;
    const next = {};
    if ((fitDraft.usualSize || "").trim()) next.usualSize = fitDraft.usualSize.trim();
    for (const f of measureFields) {
      const stored = measureToStorage(fitDraft[f.key], units, f.kind);
      if (stored != null) next[f.key] = stored;
    }
    onSaveBodyProfile(next);
    setAskingMeasures(false);
  };

  // 4f — measure ask (category-dependent fields only).
  if (askingMeasures && onSaveBodyProfile) {
    const fieldNames = measureFields.map((f) => f.label.toLowerCase()).join(" and ");
    return (
      <form className="cz-fit-prompt cz-fit4-ask" onSubmit={saveMeasureAsk}>
        <div className="cz-fit-prompt-title">Your measurements</div>
        <p className="cz-fit-prompt-copy">
          For {catLabel} we need your {fieldNames}. Saved for every item.
        </p>
        <div
          className={
            "cz-fit-prompt-fields" +
            (measureFields.length === 1 ? " is-one" : "")
          }
        >
          {measureFields.map((f) => (
            <label className="cz-fit-prompt-field" key={f.key}>
              <span className="cz-fit-prompt-label">{f.label}</span>
              <span className="cz-fit-prompt-control">
                <input
                  inputMode="decimal"
                  placeholder={units === "in" ? f.phIn : f.phCm}
                  value={fitDraft[f.key] || ""}
                  onChange={(e) =>
                    setFitDraft((d) => ({
                      ...d,
                      [f.key]: e.target.value.replace(/[^\d.]/g, ""),
                    }))
                  }
                  aria-label={f.label + " in " + unitHint}
                />
                <span className="cz-fit-prompt-unit" aria-hidden="true">
                  {unitHint}
                </span>
              </span>
            </label>
          ))}
          <label className="cz-fit-prompt-field cz-fit-prompt-size">
            <span className="cz-fit-prompt-label">Usual size (backup)</span>
            <span className="cz-fit-prompt-control">
              <input
                placeholder="M"
                value={fitDraft.usualSize || ""}
                onChange={(e) =>
                  setFitDraft((d) => ({ ...d, usualSize: e.target.value }))
                }
                aria-label="Usual size"
              />
            </span>
          </label>
        </div>
        <div className="cz-fit-prompt-actions">
          <button type="submit" className="cz-fit-prompt-save">
            Save & recalculate
          </button>
          <button
            type="button"
            className="cz-fit-prompt-skip"
            onClick={() => {
              setAskingMeasures(false);
              if (!hasUsual && onSkipFitPrompt) onSkipFitPrompt();
            }}
          >
            {hasUsual ? "Skip — keep the rough size" : "Skip for now"}
          </button>
        </div>
      </form>
    );
  }

  // 5b — in-context taste ask. Auto after a precise body exists for this
  // category, or when the user taps Edit on the rec. Measures come first.
  const showPrefAsk =
    catAxes &&
    onSaveFitPref &&
    !askingMeasures &&
    sizeActive &&
    !!bodyProfile &&
    (askingPref || needsPrefAsk);
  if (showPrefAsk) {
    const catTitle = CATEGORIES[item.category]
      ? CATEGORIES[item.category].label.toLowerCase()
      : "this item";
    const prefBaseline = {
      length: (fitPref && fitPref.length) || null,
      looseness: (fitPref && fitPref.looseness) || null,
    };
    const prefDirty =
      prefDraft.length !== prefBaseline.length ||
      prefDraft.looseness !== prefBaseline.looseness;
    return (
      <div className="cz-fit-pref-ask">
        <div className="cz-fit-pref-ask-head">
          <div className="cz-fit-pref-ask-title">How do you wear {catTitle}?</div>
          {prefDirty ? (
            <button
              type="button"
              className="cz-fit-pref-ask-check"
              aria-label="Save preference"
              onClick={() => {
                onSaveFitPref(item.category, {
                  length: prefDraft.length,
                  looseness: prefDraft.looseness,
                  dismissed: false,
                });
                setAskingPref(false);
              }}
            >
              <Check size={16} strokeWidth={2.6} aria-hidden="true" />
            </button>
          ) : null}
        </div>
        <p className="cz-fit-pref-ask-copy">
          Sets your default for all {catTitle}. Change any time in Settings.
        </p>
        <FitPrefAxis
          label="Length"
          options={catAxes.length}
          value={prefDraft.length}
          onChange={(v) => setPrefDraft((d) => ({ ...d, length: v }))}
        />
        <FitPrefAxis
          label="Looseness"
          options={catAxes.looseness}
          value={prefDraft.looseness}
          onChange={(v) => setPrefDraft((d) => ({ ...d, looseness: v }))}
        />
        <button
          type="button"
          className="cz-fit-prompt-skip"
          onClick={() => {
            onSaveFitPref(item.category, {
              length: null,
              looseness: null,
              dismissed: true,
            });
            setAskingPref(false);
          }}
        >
          Not sure yet
        </button>
      </div>
    );
  }

  // Chart table shared by rec blocks.
  const chartBlock =
    chartOpen && chart ? (
      <div className="cz-size-chart-wrap">
        <SizeChartTable
          chart={chart}
          units={units}
          highlight={rec && rec.size}
          highlightAlt={rec && rec.alt && rec.alt.size}
        />
      </div>
    ) : null;

  // 4d — nothing yet: no usual size, no measures. Do not fabricate a size.
  if (!bodyProfile && chart && sizeActive && !fitPromptSkipped && onSaveBodyProfile) {
    return (
      <div className="cz-fit4-empty">
        <div className="cz-fit4-empty-title">Will it fit you?</div>
        <p className="cz-fit4-empty-copy">
          Add your usual size and we will size every item on your shelf. Takes 10 seconds.
        </p>
        <button type="button" className="cz-fit4-empty-btn" onClick={openMeasureAsk}>
          Add my size
        </button>
        {onSkipFitPrompt ? (
          <button
            type="button"
            className="cz-fit-prompt-skip"
            onClick={() => onSkipFitPrompt()}
          >
            Skip for now
          </button>
        ) : null}
      </div>
    );
  }

  // Soft / missing-measure path: show usual size as a rough estimate (4e).
  const usualWord =
    hasUsual
      ? formatSizeToken(bodyProfile.usualSize) || String(bodyProfile.usualSize)
      : null;
  const isRough =
    !!usualWord &&
    (!(rec && rec.size) || (rec && rec.missing) || !hasPrecise);

  if (isRough && usualWord) {
    const missingKey =
      (rec && rec.missing) ||
      (item.category === "pants" || item.category === "shorts"
        ? "waist"
        : "chest");
    const sharpenLabel =
      item.category === "pants" || item.category === "shorts"
        ? "Add waist & length"
        : item.category === "shirt" || item.category === "outerwear"
          ? "Add chest"
          : "Add chest & waist";
    return (
      <div className="cz-fit4">
        <div className="cz-fit4-head">
          <div className="cz-fit4-kicker t-shimmer" data-text="We recommend">We recommend</div>
          <span className="cz-fit4-badge is-rough">
            <span className="cz-fit4-badge-dot" aria-hidden="true" />
            Rough estimate
          </span>
        </div>
        <button
          type="button"
          className="cz-fit4-size"
          aria-expanded={chartOpen}
          title={chart ? "Show the seller’s size chart" : undefined}
          onClick={(e) => {
            e.stopPropagation();
            if (chart) setChartOpen((v) => !v);
          }}
        >
          {usualWord}
        </button>
        <p className="cz-fit4-prose">
          Based on your usual size alone
          {missingKey ? ". Add your " + missingKey + " for a chart-based fit." : "."}
        </p>
        {onSaveBodyProfile ? (
          <button type="button" className="cz-fit4-sharpen" onClick={openMeasureAsk}>
            <span>{sharpenLabel}</span>
            <span className="cz-fit4-sharpen-meta">+ sharper ›</span>
          </button>
        ) : null}
        {chartBlock}
      </div>
    );
  }

  // Need measures, no usual size either — honest empty after skip.
  if (rec && rec.missing && !usualWord) {
    return (
      <div className="cz-fit4-empty">
        <div className="cz-fit4-empty-title">Need your {rec.missing}</div>
        <p className="cz-fit4-empty-copy">
          The size chart is ready. Add your {rec.missing} to get a recommendation.
        </p>
        {onSaveBodyProfile ? (
          <button type="button" className="cz-fit4-empty-btn" onClick={openMeasureAsk}>
            Add my size
          </button>
        ) : null}
      </div>
    );
  }

  if (!rec || !rec.size) return null;

  // 4g — precise fit (+ 5c preference payoff when taste shifted the size).
  const sizeWord = formatSizeToken(rec.size) || rec.size;
  const baseWord =
    rec.baseSize && String(rec.baseSize).toUpperCase() !== String(rec.size).toUpperCase()
      ? formatSizeToken(rec.baseSize) || rec.baseSize
      : null;
  const measureWord =
    rec.primaryKey === "waist" ? "waist" : rec.primaryKey === "hip" ? "hip" : "chest";
  const fitSentence = FIT_SUMMARY_ON
    ? fitSummarySentence(rec, {
        runHint: chart && chart.runHint,
        units,
        detail: "detailed",
      })
    : "";
  let preciseProse =
    rec.prefReason ||
    fitSentence ||
    ("Your " +
      formatMeasure(rec.body, units) +
      " " +
      measureWord +
      " sits on the " +
      sizeWord +
      "; the garment " +
      measureWord +
      " is " +
      formatMeasure(rec.garment, units) +
      ".");
  const easeStr =
    (rec.diff >= 0 ? "+" : "−") + formatMeasure(Math.abs(rec.diff), units);
  const runValues =
    ((item.variants || []).find((g) => /size|尺码|尺寸/i.test(g.title)) || {})
      .values || [];
  const inRun = runValues.length
    ? runValues.some((v) => String(v).toUpperCase() === rec.size)
    : true;
  const activePref = rec.fitPref || (fitPrefHasChoice(fitPref) ? fitPref : null);
  const lengthTag =
    activePref && activePref.length
      ? fitPrefLabel(item.category, "length", activePref.length)
      : null;
  const looseTag =
    activePref && activePref.looseness
      ? fitPrefLabel(item.category, "looseness", activePref.looseness)
      : null;

  return (
    <div className="cz-fit4">
      <div className="cz-fit4-head">
        <div className="cz-fit4-kicker t-shimmer" data-text="We recommend">We recommend</div>
        <span className="cz-fit4-badge is-precise">
          <span className="cz-fit4-badge-dot" aria-hidden="true" />
          Precise fit
        </span>
      </div>
      <div className="cz-fit4-size-row">
        <button
          type="button"
          className="cz-fit4-size"
          aria-expanded={chartOpen}
          title={chart ? "Show the seller’s size chart" : undefined}
          onClick={(e) => {
            e.stopPropagation();
            if (chart) setChartOpen((v) => !v);
          }}
        >
          {sizeWord}
        </button>
        {baseWord ? (
          <>
            <span className="cz-fit4-size-base" aria-label={"Base size " + baseWord}>
              {baseWord}
            </span>
            <span className="cz-fit4-size-shift">
              {rec.prefShift === "down" ? "sized down" : "sized up"}
            </span>
          </>
        ) : null}
      </div>
      <p className="cz-fit4-prose">{preciseProse}</p>
      {/* Kyle 2026-07-23: the math row is the no-preference payoff (4g). When
          taste shifted the size (5c), the reason line + pref tags carry the
          why — showing both stacked read as clutter. */}
      {!baseWord && !lengthTag && !looseTag && (
      <div className="cz-fit4-math" aria-label="Fit numbers">
        <div className="cz-fit4-math-cell">
          <div className="cz-fit4-math-k">You</div>
          <div className="cz-fit4-math-v">{formatMeasure(rec.body, units)}</div>
        </div>
        <div className="cz-fit4-math-cell">
          <div className="cz-fit4-math-k">Garment</div>
          <div className="cz-fit4-math-v">{formatMeasure(rec.garment, units)}</div>
        </div>
        <div className="cz-fit4-math-cell">
          <div className="cz-fit4-math-k">Ease</div>
          <div className="cz-fit4-math-v is-money">{easeStr}</div>
        </div>
      </div>
      )}
      {/* Pref payoff row — only when a preference is actually set. With no
          tags the bar was a bare divider + Edit; Settings → Fit covers that
          path (Kyle 2026-07-23: cut the clutter). */}
      {(lengthTag || looseTag) && catAxes ? (
        <div className="cz-fit4-pref-bar">
          <div className="cz-fit4-pref-tags">
            {lengthTag ? <span className="cz-fit4-pref-tag">{lengthTag}</span> : null}
            {looseTag ? <span className="cz-fit4-pref-tag">{looseTag}</span> : null}
          </div>
          {onSaveFitPref ? (
            <button
              type="button"
              className="cz-fit4-pref-edit"
              onClick={() => {
                setPrefDraft({
                  length: (fitPref && fitPref.length) || null,
                  looseness: (fitPref && fitPref.looseness) || null,
                });
                setAskingPref(true);
              }}
            >
              Edit
            </button>
          ) : null}
        </div>
      ) : null}
      {!inRun && (
        <p className="cz-fit4-warn">
          {rec.size} is not in this seller’s listed run ({runValues.join(" · ")}).
        </p>
      )}
      {/* The detailed fit summary already names the runner-up — only fall
          back to the bare alt line when the summary is off. */}
      {rec.alt && !baseWord && !fitSentence && (
        <p className="cz-fit4-alt">
          {rec.alt.size} also works
          {rec.alt.fit && rec.alt.fit !== "same" ? " if you want it " + rec.alt.fit : ""}.
        </p>
      )}
      {chartBlock}
    </div>
  );
}
