import { useEffect, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { formatMoney } from "../credenza-fashion.jsx";

/* ═══════════════════════════════════════════════════════════════════════════
   HaulTitleMenu — STEPS-HANDOFF item 4.

   The legacy haul header is gone: the counts line, the weight bar, the
   budget bar and the visible Archive button. The steps page and the summary
   strip replaced everything they said. What remains is three actions, and
   three actions are a menu, not a strip: Set a budget · Share · Archive.

   The trigger sits at the end of the title row. Set a budget opens a small
   editor under the button — the same field the strip had, with the same
   save path through onUpdate. Share and Archive close the menu and call the
   handlers the app passes in; the archive undo toast lives in the app's
   onArchive, unchanged.
   ═══════════════════════════════════════════════════════════════════════════ */

export default function HaulTitleMenu({
  // The haul's saved record, or null when the haul is only a project name.
  record,
  // Share is offered only on a haul that has cards — a link to nothing is
  // not worth offering (was LB-8 on the title row).
  canShare = false,
  onShare,
  onArchive,
  // (patch, historyEntry) — the same write path HaulBoard used.
  onUpdate,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [budgetDraft, setBudgetDraft] = useState("");
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const budgetInputRef = useRef(null);

  const budget = record && typeof record.budget === "number" ? record.budget : null;
  const currency = record && record.currency === "CNY" ? "CNY" : "USD";
  const archived = record && record.archived === true;

  // The editor opens from a menu choice, so the field takes the focus — but
  // through a ref, never the autoFocus prop (jsx-a11y/no-autofocus).
  useEffect(() => {
    if (budgetOpen && budgetInputRef.current) budgetInputRef.current.focus();
  }, [budgetOpen]);

  // Click outside or Escape closes whichever surface is open, and Escape
  // puts the focus back on the trigger so the keyboard person is never
  // stranded in a closed menu.
  useEffect(() => {
    if (!menuOpen && !budgetOpen) return undefined;
    const onDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setMenuOpen(false);
        setBudgetOpen(false);
      }
    };
    const onKey = (event) => {
      if (event.key !== "Escape") return;
      setMenuOpen(false);
      setBudgetOpen(false);
      if (triggerRef.current) triggerRef.current.focus();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen, budgetOpen]);

  const openBudget = () => {
    setBudgetDraft(budget != null ? String(budget) : "");
    setMenuOpen(false);
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
    <div className="cz-haul-menu" ref={rootRef}>
      <button
        type="button"
        className="cz-haul-menu-trigger"
        ref={triggerRef}
        aria-label="Haul actions"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => {
          setBudgetOpen(false);
          setMenuOpen((open) => !open);
        }}
      >
        <MoreHorizontal aria-hidden="true" size={18} strokeWidth={2.2} />
      </button>

      {menuOpen ? (
        <div className="cz-haul-menu-list" role="menu" aria-label="Haul actions">
          <button
            type="button"
            role="menuitem"
            className="cz-haul-menu-item"
            onClick={openBudget}
          >
            <span>{budget != null ? "Change the budget" : "Set a budget"}</span>
            {budget != null ? (
              <span className="cz-haul-menu-meta">{formatMoney(budget, currency)}</span>
            ) : null}
          </button>
          {canShare ? (
            <button
              type="button"
              role="menuitem"
              className="cz-haul-menu-item"
              onClick={() => {
                setMenuOpen(false);
                if (onShare) onShare();
              }}
            >
              Share
            </button>
          ) : null}
          <button
            type="button"
            role="menuitem"
            className="cz-haul-menu-item"
            onClick={() => {
              setMenuOpen(false);
              if (onArchive) onArchive();
            }}
          >
            {archived ? "Unarchive" : "Archive"}
          </button>
        </div>
      ) : null}

      {budgetOpen ? (
        <div className="cz-haul-menu-editor" role="group" aria-label="Haul budget">
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
            ref={budgetInputRef}
            value={budgetDraft}
            onChange={(event) => setBudgetDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") saveBudget();
            }}
          />
          <button type="button" className="cz-haul-board-save" onClick={saveBudget}>
            Save
          </button>
          <button
            type="button"
            className="cz-haul-menu-cancel"
            onClick={() => setBudgetOpen(false)}
          >
            Cancel
          </button>
        </div>
      ) : null}
    </div>
  );
}
