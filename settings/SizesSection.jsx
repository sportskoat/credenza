import { Suspense, lazy, useMemo, useState } from "react";
import { CATEGORIES, FIT_PREF_AXES } from "../credenza-fashion.jsx";
import { FitPrefAxis } from "../components/SizeRecommendation.jsx";
import { useSettings } from "./SettingsContext.jsx";
import SettingsSection from "./SettingsSection.jsx";

const BodyProfileSheet = lazy(() => import("../sheets/BodyProfileSheet.jsx"));

// All four fit categories — Settings is where you plan (Kyle 2026-07-28).
const FIT_CATS = Object.keys(FIT_PREF_AXES);

// Sizes and measurements + How you like it to sit (fit prefs folded in).
export default function SizesSection() {
  const {
    bodyProfile,
    measureUnits,
    onSaveBodyProfile,
    onChangeUnits,
    fitPrefs,
    onSaveFitPrefs,
  } = useSettings();

  const [fitDraft, setFitDraft] = useState(() => {
    const src = fitPrefs && typeof fitPrefs === "object" ? fitPrefs : {};
    const out = {};
    for (const cat of FIT_CATS) {
      const p = src[cat] || {};
      out[cat] = {
        length: p.length || null,
        looseness: p.looseness || null,
        dismissed: !!p.dismissed,
      };
    }
    return out;
  });

  const setAxis = (cat, axis, v) => {
    setFitDraft((d) => {
      const next = {
        ...d,
        [cat]: { ...d[cat], [axis]: v, dismissed: false },
      };
      if (onSaveFitPrefs) onSaveFitPrefs(next);
      return next;
    });
  };

  const fitBlock = useMemo(
    () => (
      <div className="cz-sizes-fit">
        <div className="cz-sizes-fit-head">
          <h3 className="cz-sizes-fit-title">How you like it to sit</h3>
          <span className="cz-sizes-fit-flag">SAVED AS YOU CHANGE THEM</span>
        </div>
        <p className="cz-sizes-fit-lead">
          The numbers say what will fit. These say how you want it to sit — read together when
          Credenza picks a size.
        </p>
        <div className="cz-sizes-fit-table" role="table" aria-label="How you like it to sit">
          <div className="cz-sizes-fit-table-head" role="row">
            <span role="columnheader" className="cz-sizes-fit-cat-h" />
            <span role="columnheader">LENGTH</span>
            <span role="columnheader">LOOSENESS</span>
          </div>
          {FIT_CATS.map((cat) => {
            const axes = FIT_PREF_AXES[cat];
            const pref = fitDraft[cat] || {};
            const label = CATEGORIES[cat] ? CATEGORIES[cat].label : cat;
            return (
              <div className="cz-sizes-fit-row" role="row" key={cat}>
                <span className="cz-sizes-fit-cat" role="cell">
                  {label}
                </span>
                <div className="cz-sizes-fit-axis" role="cell">
                  <FitPrefAxis
                    label="Length"
                    options={axes.length}
                    value={pref.length || null}
                    onChange={(v) => setAxis(cat, "length", v)}
                  />
                </div>
                <div className="cz-sizes-fit-axis" role="cell">
                  <FitPrefAxis
                    label="Looseness"
                    options={axes.looseness}
                    value={pref.looseness || null}
                    onChange={(v) => setAxis(cat, "looseness", v)}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setAxis closes over onSaveFitPrefs
    [fitDraft]
  );

  return (
    <SettingsSection
      kicker="SIZES"
      title="Sizes and measurements."
      lead="Every size Credenza suggests starts here — your numbers, and how you like things to sit. None of it is required, and the card always says which part it leaned on."
      wide
      sectionId="sizes"
    >
      <Suspense fallback={null}>
        <BodyProfileSheet
          value={bodyProfile}
          units={measureUnits}
          onSave={onSaveBodyProfile}
          onChangeUnits={onChangeUnits}
          onClose={() => {}}
          embedded
        />
      </Suspense>
      {fitBlock}
    </SettingsSection>
  );
}
