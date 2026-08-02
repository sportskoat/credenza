import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";

// Haul control as a transitions.dev accordion — expand to pick / create / remove.
// Used on the card-back details face and the edit form.
export function HaulAccordionField({
  label = "Haul",
  value = "",
  knownHauls = [],
  onChange,
  onCommit,
  className = "",
}) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef(null);
  const headRef = useRef(null);
  const bodyRef = useRef(null);
  const current = String(value || "").trim();

  // Arrow keys walk the rows (Part 5 a11y): focus moves through haul options,
  // the create row/input, and the clear row. Wraps at both ends.
  const focusRow = (delta) => {
    const rows = Array.from(
      bodyRef.current?.querySelectorAll("button, input") || []
    ).filter((el) => !el.disabled);
    if (rows.length === 0) return;
    const i = rows.indexOf(document.activeElement);
    const next =
      i < 0
        ? rows[delta > 0 ? 0 : rows.length - 1]
        : rows[(i + delta + rows.length) % rows.length];
    next.focus();
  };

  const onBodyKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      e.stopPropagation();
      focusRow(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      focusRow(-1);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      setCreating(false);
      headRef.current?.focus();
    }
  };

  useEffect(() => {
    if (open && creating && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select?.();
    }
  }, [open, creating]);

  const commit = (next) => {
    const cleaned = String(next || "").trim();
    onChange?.(cleaned);
    onCommit?.(cleaned);
    setCreating(false);
    setDraft("");
    setOpen(false);
  };

  const headLabel = current || "Add to a haul…";

  return (
    <div
      className={"t-acc cz-haul-acc" + (className ? " " + className : "")}
      data-open={open ? "true" : "false"}
    >
      <div className="cz-field-label">
        <span>{label}</span>
        <button
          type="button"
          ref={headRef}
          className="t-acc-head cz-haul-acc-head"
          aria-expanded={open}
          onClick={(e) => {
            e.stopPropagation();
            setOpen((v) => !v);
            if (open) setCreating(false);
          }}
          onKeyDown={(e) => {
            // ArrowDown from the head opens the list and lands on row one.
            if (e.key !== "ArrowDown") return;
            e.preventDefault();
            e.stopPropagation();
            if (!open) setOpen(true);
            requestAnimationFrame(() => focusRow(1));
          }}
        >
          <span className={"cz-haul-acc-value" + (current ? "" : " is-empty")}>{headLabel}</span>
          <span className="t-acc-chevron" aria-hidden="true">
            <svg viewBox="0 0 16 16" width="14" height="14">
              <path
                d="M4 6.5L8 10.5L12 6.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </button>
      </div>
      <div className="t-acc-panel">
        <div className="t-acc-panel-inner">
          <div
            className="cz-haul-acc-body"
            role="listbox"
            aria-label="Hauls"
            aria-orientation="vertical"
            ref={bodyRef}
            onKeyDown={onBodyKeyDown}
            // Focus moves row to row (roving DOM focus), so the listbox
            // itself stays out of the tab order but must be focusable.
            tabIndex={-1}
          >
            {knownHauls.length === 0 && !creating ? (
              <div className="cz-haul-acc-empty">No hauls yet. Create one below.</div>
            ) : (
              knownHauls.map((name) => (
                <button
                  key={name}
                  type="button"
                  role="option"
                  aria-selected={name === current}
                  className={"cz-haul-acc-option" + (name === current ? " is-current" : "")}
                  onClick={(e) => {
                    e.stopPropagation();
                    commit(name);
                  }}
                >
                  <span>{name}</span>
                  {name === current ? <Check size={14} strokeWidth={2.4} aria-hidden="true" /> : null}
                </button>
              ))
            )}

            {creating ? (
              <div className="cz-haul-acc-create">
                <input
                  ref={inputRef}
                  className="cz-field cz-haul-acc-input"
                  value={draft}
                  placeholder="Name the new haul…"
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (draft.trim()) commit(draft);
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      setCreating(false);
                      setDraft("");
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
                <button
                  type="button"
                  className="cz-haul-acc-create-btn"
                  disabled={!draft.trim()}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (draft.trim()) commit(draft);
                  }}
                >
                  Create
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="cz-haul-acc-option is-create"
                onClick={(e) => {
                  e.stopPropagation();
                  setCreating(true);
                  setDraft("");
                }}
              >
                + Add new haul
              </button>
            )}

            {current ? (
              <button
                type="button"
                className="cz-haul-acc-option is-clear"
                onClick={(e) => {
                  e.stopPropagation();
                  commit("");
                }}
              >
                Remove from haul
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
