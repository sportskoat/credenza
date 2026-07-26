import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

// Shared combobox — type free text or pick from suggestions with a
// transitions.dev-style scale/fade menu (not the native OS datalist).
export default function ComboboxField({
  label,
  value,
  onChange,
  placeholder,
  suggestions = [],
  onCommit,
  emptyHint = "Type a value",
  listLabel = "Suggestions",
  allowCreate = true,
  // Sticky footer action: always-visible "Add new…" that focuses the input.
  addNewLabel = "",
  // Explicit clear / remove row when a value is set (e.g. "Remove from haul").
  clearLabel = "",
  onClear,
  chevronLabel = "Show options",
  createVerb = "Use",
  className = "",
}) {
  const id = useId();
  const rootRef = useRef(null);
  const controlRef = useRef(null);
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [menuBox, setMenuBox] = useState(null); // fixed coords so overflow parents don't clip
  const [creating, setCreating] = useState(false);
  const closeTimer = useRef(null);
  // Keyboard-active option index (Part 5 a11y): ArrowUp/Down move it, Enter
  // picks it. -1 = no active option; typing resets it.
  const [activeIdx, setActiveIdx] = useState(-1);

  const closeMenu = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    if (!open && !closing) return;
    setClosing(true);
    setOpen(false);
    setCreating(false);
    // Match --dropdown-close-dur so reopen does not jump from the close scale.
    let closeMs = 150;
    if (typeof window !== "undefined" && window.getComputedStyle) {
      const raw = getComputedStyle(document.documentElement).getPropertyValue(
        "--dropdown-close-dur"
      );
      const n = parseFloat(raw);
      if (Number.isFinite(n)) closeMs = n;
    }
    closeTimer.current = setTimeout(() => {
      setClosing(false);
      closeTimer.current = null;
    }, closeMs);
  }, [open, closing]);

  const placeMenu = useCallback(() => {
    const el = controlRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const gap = 6;
    const maxH = 260;
    const spaceBelow = window.innerHeight - rect.bottom - gap;
    const openUp = spaceBelow < 140 && rect.top > spaceBelow;
    setMenuBox({
      left: Math.max(8, rect.left),
      width: rect.width,
      top: openUp ? undefined : rect.bottom + gap,
      bottom: openUp ? window.innerHeight - rect.top + gap : undefined,
      maxHeight: Math.min(maxH, openUp ? rect.top - gap - 8 : spaceBelow - 8),
      origin: openUp ? "bottom-left" : "top-left",
    });
  }, []);

  const openMenu = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setClosing(false);
    setOpen(true);
    setActiveIdx(-1);
    // Measure after paint so the menu escapes overflow:auto card backs.
    requestAnimationFrame(placeMenu);
  }, [placeMenu]);

  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    []
  );

  useEffect(() => {
    if (!open) return;
    placeMenu();
    const onDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        // Fixed menu is portaled-by-position; also ignore clicks inside the menu node.
        const menu = document.getElementById(id + "-list");
        if (menu && menu.contains(event.target)) return;
        closeMenu();
      }
    };
    const onKey = (event) => {
      if (event.key === "Escape") {
        // An open menu eats Escape (2026-07-25): without stopPropagation the
        // same keypress also peeled the carousel overlay behind the menu.
        event.stopPropagation();
        closeMenu();
      }
    };
    const onReposition = () => placeMenu();
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", onReposition);
    // Reposition on any scroll (card back is overflow:auto).
    window.addEventListener("scroll", onReposition, true);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open, closeMenu, placeMenu, id]);

  // Keep the keyboard-active option visible while arrows move through a
  // long list.
  useEffect(() => {
    if (!open || activeIdx < 0) return;
    const el = document.getElementById(id + "-opt-" + activeIdx);
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [open, activeIdx, id]);

  const q = String(value || "").trim().toLowerCase();// While "Add new" is active, show the full list unfiltered so people can still
  // pick an existing haul; filtered list only applies to normal typing.
  const filtered = creating
    ? suggestions
    : suggestions.filter((name) => !q || String(name).toLowerCase().includes(q));
  const exact = suggestions.some((name) => String(name).toLowerCase() === q);
  const showCreate = allowCreate && q && !exact;
  const showClear = Boolean(clearLabel && String(value || "").trim());
  const menuVisible = open || closing;

  const pick = (name) => {
    const next = String(name || "").trim();
    onChange(next);
    onCommit?.(next);
    setCreating(false);
    closeMenu();
  };

  const startCreate = () => {
    setCreating(true);
    onChange("");
    openMenu();
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select?.();
    });
  };

  const clearValue = () => {
    onChange("");
    onClear?.();
    onCommit?.("");
    setCreating(false);
    closeMenu();
  };

  return (
    <div className={"cz-combobox" + (className ? " " + className : "")} ref={rootRef}>
      <label className="cz-field-label" htmlFor={id}>
        <span>{label}</span>
        <div
          className={"cz-combobox-control" + (open ? " is-open" : "")}
          ref={controlRef}
        >
          <input
            ref={inputRef}
            id={id}
            className="cz-field cz-combobox-input"
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
              setActiveIdx(-1);
              if (!open) openMenu();
            }}
            onFocus={openMenu}
            onBlur={() => {
              // Don't commit-close while the fixed menu is being used — picks
              // fire mousedown preventDefault; blur still commits typed text.
              const next = String(value || "").trim();
              if (next !== String(value || "")) onChange(next);
              onCommit?.(next);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                // Keep Enter inside the combobox — do NOT bubble to the
                // card-edit "Enter to save" handler (that closed the form
                // before the size list could be used).
                e.preventDefault();
                e.stopPropagation();
                if (open && activeIdx >= 0 && filtered[activeIdx] != null) {
                  pick(filtered[activeIdx]);
                } else {
                  pick(value);
                }
              } else if (e.key === "ArrowDown") {
                e.preventDefault();
                e.stopPropagation();
                if (!open) {
                  openMenu();
                } else if (filtered.length > 0) {
                  setActiveIdx((i) => Math.min(i + 1, filtered.length - 1));
                }
              } else if (e.key === "ArrowUp") {
                if (!open) return;
                e.preventDefault();
                e.stopPropagation();
                if (filtered.length > 0) {
                  setActiveIdx((i) => (i <= 0 ? filtered.length - 1 : i - 1));
                }
              } else if (e.key === "Escape" && open) {
                e.preventDefault();
                e.stopPropagation();
                closeMenu();
              }
            }}
            placeholder={creating ? "Name the new haul…" : placeholder}
            autoComplete="off"
            role="combobox"
            aria-expanded={open}
            aria-controls={id + "-list"}
            aria-autocomplete="list"
            aria-activedescendant={
              open && activeIdx >= 0 && filtered[activeIdx] != null
                ? id + "-opt-" + activeIdx
                : undefined
            }
          />
          {showClear ? (
            <button
              type="button"
              className="cz-combobox-clear"
              tabIndex={-1}
              aria-label={clearLabel}
              title={clearLabel}
              onMouseDown={(e) => e.preventDefault()}
              onClick={clearValue}
            >
              <X size={14} strokeWidth={2.4} aria-hidden="true" />
            </button>
          ) : null}
          <button
            type="button"
            className="cz-combobox-chevron"
            tabIndex={-1}
            aria-label={chevronLabel}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => (open ? closeMenu() : openMenu())}
          >
            <ChevronDown size={15} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </div>
      </label>
      {menuVisible && menuBox && (
        <div
          id={id + "-list"}
          className={
            "t-dropdown cz-combobox-menu is-fixed" +
            (open && !closing ? " is-open" : "") +
            (closing ? " is-closing" : "")
          }
          data-origin={menuBox.origin || "top-left"}
          role="listbox"
          aria-label={listLabel}
          style={{
            position: "fixed",
            left: menuBox.left,
            width: menuBox.width,
            top: menuBox.top,
            bottom: menuBox.bottom,
            maxHeight: menuBox.maxHeight,
            zIndex: 240,
          }}
        >
          {filtered.length === 0 && !showCreate && !addNewLabel && !showClear ? (
            <div className="cz-combobox-option is-empty">{emptyHint}</div>
          ) : (
            filtered.map((name, optionIdx) => (
              <button
                key={name}
                id={id + "-opt-" + optionIdx}
                type="button"
                role="option"
                aria-selected={name === value}
                className={
                  "cz-combobox-option" +
                  (name === value ? " is-current" : "") +
                  (optionIdx === activeIdx ? " is-active" : "")
                }
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActiveIdx(optionIdx)}
                onClick={() => pick(name)}
              >
                <span>{name}</span>
                {name === value ? <Check size={14} strokeWidth={2.4} aria-hidden="true" /> : null}
              </button>
            ))
          )}
          {showCreate ? (
            <button
              type="button"
              role="option"
              aria-selected={false}
              className="cz-combobox-option is-create"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(value)}
            >
              {createVerb} “{String(value).trim()}”
            </button>
          ) : null}
          {addNewLabel && !showCreate ? (
            <button
              type="button"
              role="option"
              aria-selected={false}
              className="cz-combobox-option is-create is-add-new"
              onMouseDown={(e) => e.preventDefault()}
              onClick={startCreate}
            >
              {addNewLabel}
            </button>
          ) : null}
          {showClear ? (
            <button
              type="button"
              role="option"
              aria-selected={false}
              className="cz-combobox-option is-clear"
              onMouseDown={(e) => e.preventDefault()}
              onClick={clearValue}
            >
              {clearLabel}
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
