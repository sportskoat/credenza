import { useState } from "react";
import {
  formatMoney,
  formatWeightGrams,
  itemWeightGrams,
} from "../credenza-fashion.jsx";

// The open haul's money + weight panel (Execution Plan Part 5, Tier A):
// a budget bar with a spent line, the parcel weight the real items add up to,
// and Archive. Everything writes through onUpdate with a history entry.
//
// Kyle 2026-08-02: "set budget and estimate parcel buttons: are they needed?
// should we sunset these?" The parcel estimator is gone. It asked a person for
// a weight and a box size, then answered a question the board already answers
// from the items themselves — and the two answers disagreed. The same goods
// read 4.8 kg in the estimator and 1.6 kg on the board. One answer is enough,
// and the item weights are the honest one.
export default function HaulBoard({
  record,
  totalUsd,
  onUpdate,
  onArchive,
  items,
}) {
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [budgetDraft, setBudgetDraft] = useState("");

  const budget = record && typeof record.budget === "number" ? record.budget : null;
  const currency = record && record.currency === "CNY" ? "CNY" : "USD";
  const archived = record && record.archived === true;
  const spent = Math.round((totalUsd || 0) * 100) / 100;

  // Same percent the Budget text shows. Cap the fill at a full bar only.
  const spentPct =
    budget != null && budget > 0
      ? Math.min(999, Math.round((spent / budget) * 100))
      : 0;
  const fillPct = Math.min(100, spentPct);
  // Breakpoints 0 / 70 / 100: accent → warn → error.
  const spendTone = spentPct >= 100 ? "over" : spentPct >= 70 ? "warn" : "ok";

  // Parcel weight: only items with a known positive weight. One bar segment
  // each. This needs no saved parcel record — it reads the items.
  const weighed = (() => {
    const list = Array.isArray(items) ? items : [];
    const grams = list
      .map((item) => itemWeightGrams(item))
      .filter((g) => Number.isFinite(g) && g > 0);
    const sum = grams.reduce((a, g) => a + g, 0);
    if (!(sum > 0)) return { segs: [], total: 0, count: 0 };
    return {
      segs: grams.map((g) => (g / sum) * 100),
      total: sum,
      count: grams.length,
    };
  })();

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

  return (
    <div className="cz-haul-board" aria-label="Haul board">
      {/* The budget is a bar now, not a hidden link. A person reads the spend
          without pressing anything. Pressing it still opens the editor. */}
      {budget != null ? (
        <button
          type="button"
          className={"cz-haul-board-budget cz-haul-board-budget--" + spendTone}
          onClick={openBudget}
        >
          <span className="cz-haul-board-budget-head">
            <span className="cz-haul-board-budget-label">Budget</span>
            <span className="cz-haul-board-budget-money">
              {formatMoney(spent, "USD")} of {formatMoney(budget, currency)}
            </span>
            {budget > 0 ? (
              <span className="cz-haul-board-budget-pct">{spentPct}%</span>
            ) : null}
          </span>
          <span
            className="cz-haul-board-budget-track"
            role="img"
            aria-label={spentPct + "% of budget spent"}
          >
            <span
              className="cz-haul-board-budget-fill"
              style={{ "--fill": fillPct + "%" }}
            />
          </span>
        </button>
      ) : (
        <div className="cz-haul-board-row">
          <button type="button" className="cz-haul-board-btn" onClick={openBudget}>
            Set a budget
          </button>
        </div>
      )}

      {/* The parcel weight, straight from the items. No estimator, no box
          size, no packaging guess. One segment for each weighed item. */}
      {weighed.count > 0 ? (
        <div className="cz-haul-board-weight">
          <span className="cz-haul-board-weight-text">
            Parcel {formatWeightGrams(weighed.total)} from {weighed.count}{" "}
            {weighed.count === 1 ? "item" : "items"}
          </span>
          <span
            className="cz-haul-board-weight-bar"
            role="img"
            aria-label={"Parcel weight breakdown, " + weighed.count + " items"}
          >
            {weighed.segs.map((pct, i) => (
              <span
                key={i}
                className="cz-haul-board-weight-seg"
                style={{ "--seg-w": pct + "%" }}
              />
            ))}
          </span>
        </div>
      ) : null}

      <div className="cz-haul-board-row">
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
    </div>
  );
}
