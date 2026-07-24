import { useState } from "react";
import { CATEGORIES, FIT_PREF_AXES, FitPrefAxis, ModalShell } from "../credenza-fashion.jsx";

// Design 5a — Settings → Fit preferences. One row per owned category.
export default function FitPrefsSheet({ value, ownedCategories, onSave, onClose }) {
  const [draft, setDraft] = useState(() => {
    const src = value && typeof value === "object" ? value : {};
    const out = {};
    for (const cat of ownedCategories) {
      const p = src[cat] || {};
      out[cat] = {
        length: p.length || null,
        looseness: p.looseness || null,
        dismissed: !!p.dismissed,
      };
    }
    return out;
  });
  const cats = ownedCategories.filter((c) => FIT_PREF_AXES[c]);
  return (
    <ModalShell title="Fit preferences" onClose={onClose} maxWidth={440}>
      <div className="cz-fit-prefs-sheet">
        <p className="cz-fit-prefs-lead">
          How you like things to sit. We factor this into every size we suggest.
        </p>
        {cats.length === 0 ? (
          <p className="cz-fit-prefs-empty">
            Stash a shirt, shorts, pants, or outerwear item first. Preferences appear per category you own.
          </p>
        ) : (
          cats.map((cat) => {
            const axes = FIT_PREF_AXES[cat];
            const pref = draft[cat] || {};
            return (
              <div className="cz-fit-prefs-cat" key={cat}>
                <div className="cz-fit-prefs-cat-title">
                  {CATEGORIES[cat] ? CATEGORIES[cat].label : cat}
                </div>
                <FitPrefAxis
                  label="Length"
                  options={axes.length}
                  value={pref.length || null}
                  onChange={(v) =>
                    setDraft((d) => ({
                      ...d,
                      [cat]: { ...d[cat], length: v, dismissed: false },
                    }))
                  }
                />
                <FitPrefAxis
                  label="Looseness"
                  options={axes.looseness}
                  value={pref.looseness || null}
                  onChange={(v) =>
                    setDraft((d) => ({
                      ...d,
                      [cat]: { ...d[cat], looseness: v, dismissed: false },
                    }))
                  }
                />
              </div>
            );
          })
        )}
        <button
          type="button"
          className="cz-fit-prefs-save"
          onClick={() => {
            onSave && onSave(draft);
            onClose && onClose();
          }}
        >
          Save preferences
        </button>
      </div>
    </ModalShell>
  );
}
