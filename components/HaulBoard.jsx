import { useState } from "react";
import {
  PACKAGING_OPTIONS,
  chargeableWeightGrams,
  formatMoney,
  formatWeightGrams,
} from "../credenza-fashion.jsx";

// The open haul's money + parcel panel (Execution Plan Part 5, Tier A):
// budget with a spent line, parcel editor with chargeable weight, and
// Archive. Everything writes through onUpdate with a history entry.
export default function HaulBoard({ record, pipeline, totalUsd, onUpdate, onArchive }) {
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [budgetDraft, setBudgetDraft] = useState("");
  const [parcelOpen, setParcelOpen] = useState(false);
  const [parcelDraft, setParcelDraft] = useState(null);

  const budget = record && typeof record.budget === "number" ? record.budget : null;
  const currency = record && record.currency === "CNY" ? "CNY" : "USD";
  const parcel = record && record.parcel ? record.parcel : null;
  const archived = record && record.archived === true;
  const spent = Math.round((totalUsd || 0) * 100) / 100;

  const savedChargeable = parcel
    ? chargeableWeightGrams({
        actualGrams: parcel.weightGrams,
        dims: parcel.dims,
        packaging: parcel.packaging,
      })
    : null;
  const draftChargeable = parcelDraft
    ? chargeableWeightGrams({
        actualGrams: Number(parcelDraft.weight),
        dims: { l: Number(parcelDraft.l), w: Number(parcelDraft.w), h: Number(parcelDraft.h) },
        packaging: parcelDraft.packaging,
      })
    : null;

  const openBudget = () => {
    setBudgetDraft(budget != null ? String(budget) : "");
    setBudgetOpen(true);
  };
  const saveBudget = () => {
    const n = Math.round(Number(budgetDraft) * 100) / 100;
    const next = Number.isFinite(n) && n > 0 ? n : null;
    onUpdate(
      { budget: next },
      { type: "budget", detail: next != null ? formatMoney(next, currency) : "cleared" }
    );
    setBudgetOpen(false);
  };

  const openParcel = () => {
    setParcelDraft({
      weight:
        parcel && parcel.weightGrams
          ? String(parcel.weightGrams)
          : pipeline && pipeline.weightGrams
            ? String(pipeline.weightGrams)
            : "",
      l: parcel && parcel.dims && parcel.dims.l ? String(parcel.dims.l) : "",
      w: parcel && parcel.dims && parcel.dims.w ? String(parcel.dims.w) : "",
      h: parcel && parcel.dims && parcel.dims.h ? String(parcel.dims.h) : "",
      packaging: (parcel && parcel.packaging) || "standard",
    });
    setParcelOpen(true);
  };
  const saveParcel = () => {
    const w = Number(parcelDraft.weight);
    const dims = {
      l: Number(parcelDraft.l) || null,
      w: Number(parcelDraft.w) || null,
      h: Number(parcelDraft.h) || null,
    };
    const hasDims = dims.l && dims.w && dims.h;
    const next =
      (Number.isFinite(w) && w > 0) || hasDims
        ? {
            weightGrams: Number.isFinite(w) && w > 0 ? Math.round(w) : null,
            dims: hasDims ? dims : null,
            packaging: parcelDraft.packaging,
          }
        : null;
    onUpdate(
      { parcel: next },
      { type: "parcel", detail: next ? "estimate saved" : "cleared" }
    );
    setParcelOpen(false);
  };

  return (
    <div className="cz-haul-board" aria-label="Haul board">
      <div className="cz-haul-board-row">
        {budget != null ? (
          <button type="button" className="cz-haul-board-stat" onClick={openBudget}>
            Budget {formatMoney(budget, currency)} · spent {formatMoney(spent, "USD")}
            {budget > 0 ? " (" + Math.min(999, Math.round((spent / budget) * 100)) + "%)" : ""}
          </button>
        ) : (
          <button type="button" className="cz-haul-board-btn" onClick={openBudget}>
            Set a budget
          </button>
        )}
        {savedChargeable != null ? (
          <button type="button" className="cz-haul-board-stat" onClick={openParcel}>
            Parcel {formatWeightGrams(savedChargeable)} chargeable
          </button>
        ) : (
          <button type="button" className="cz-haul-board-btn" onClick={openParcel}>
            Estimate the parcel
          </button>
        )}
        <button
          type="button"
          className="cz-haul-board-btn cz-haul-board-archive"
          onClick={onArchive}
        >
          {archived ? "Unarchive" : "Archive"}
        </button>
      </div>

      {budgetOpen ? (
        <div className="cz-haul-board-editor" role="group" aria-label="Haul budget">
          <label className="cz-haul-board-label" htmlFor="cz-haul-budget-input">
            Budget ({currency})
          </label>
          <input
            id="cz-haul-budget-input"
            className="cz-haul-board-input"
            type="number"
            min="0"
            step="1"
            inputMode="decimal"
            value={budgetDraft}
            onChange={(e) => setBudgetDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveBudget();
              if (e.key === "Escape") setBudgetOpen(false);
            }}
          />
          <button type="button" className="cz-haul-board-save" onClick={saveBudget}>
            Save
          </button>
          <button type="button" className="cz-haul-board-btn" onClick={() => setBudgetOpen(false)}>
            Cancel
          </button>
        </div>
      ) : null}

      {parcelOpen && parcelDraft ? (
        <div className="cz-haul-board-editor cz-haul-board-parcel" role="group" aria-label="Parcel estimate">
          <label className="cz-haul-board-label" htmlFor="cz-haul-parcel-weight">
            Weight (g)
          </label>
          <input
            id="cz-haul-parcel-weight"
            className="cz-haul-board-input"
            type="number"
            min="0"
            step="10"
            inputMode="numeric"
            value={parcelDraft.weight}
            onChange={(e) => setParcelDraft({ ...parcelDraft, weight: e.target.value })}
          />
          <span className="cz-haul-board-label" id="cz-haul-parcel-dims-label">
            Box size (cm)
          </span>
          <div className="cz-haul-board-dims" role="group" aria-labelledby="cz-haul-parcel-dims-label">
            {/* Each box names itself — three bare number fields read as a bug
                (Kyle 2026-07-25: "three boxes. Not really sure what those are
                for"). The aria-label keeps the full name for screen readers. */}
            {["l", "w", "h"].map((axis) => (
              <label key={axis} className="cz-haul-board-dim">
                <span className="cz-haul-board-dim-label" aria-hidden="true">
                  {axis.toUpperCase()}
                </span>
                <input
                  className="cz-haul-board-input"
                  type="number"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  aria-label={axis === "l" ? "Length (cm)" : axis === "w" ? "Width (cm)" : "Height (cm)"}
                  value={parcelDraft[axis]}
                  onChange={(e) => setParcelDraft({ ...parcelDraft, [axis]: e.target.value })}
                />
              </label>
            ))}
          </div>
          <label className="cz-haul-board-label" htmlFor="cz-haul-parcel-pack">
            Packaging
          </label>
          <select
            id="cz-haul-parcel-pack"
            className="cz-haul-board-input"
            value={parcelDraft.packaging}
            onChange={(e) => setParcelDraft({ ...parcelDraft, packaging: e.target.value })}
          >
            {PACKAGING_OPTIONS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
          {draftChargeable != null ? (
            <span className="cz-haul-board-result">
              Chargeable {formatWeightGrams(draftChargeable)}
            </span>
          ) : null}
          <p className="cz-haul-board-note">
            Estimate only. The buying agent weighs and measures the final parcel.
          </p>
          <div className="cz-haul-board-actions">
            <button type="button" className="cz-haul-board-save" onClick={saveParcel}>
              Save
            </button>
            <button type="button" className="cz-haul-board-btn" onClick={() => setParcelOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
