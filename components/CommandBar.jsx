import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import { CATEGORIES } from "../credenza-fashion.jsx";
import { normalizeFindStatus } from "../credenza-find-status.js";

// ═══ THE COMMAND BAR (item-detail handoff 2026-07-29) ════════════════════
//
// Rule 1 of the handoff: "the rail is dead". Status, haul, colorway, weight
// and category were five labelled 32px fields stacked in a 208px column.
// Five short fields can never fill the height of a photo, which is what made
// the panel read as bloated and empty at the same time. They are one row of
// chips now, directly under the title.
//
// Rule 2, set vs. decide: this bar holds everything the USER SETS. The body
// below holds the one thing the PRODUCT ADVISES — which size. Nothing crosses
// over. A picker that appears in the body belongs up here instead.
//
// Rule 4, no empty chrome: an unset value renders as a placeholder prompt
// inside the chip ("Add a colorway"), never as a blank field.
//
// Chip order is fixed: Status · Haul · Colorway · Weight · Category, then the
// seller link pushed right. Status leads because it is the only chip that
// changes what the footer means.
//
// ONE open popover at a time. This is a single `menu` state key, never a
// boolean per menu — two booleans is how two popovers end up open together.

// Kyle 2026-07-29: category moved out of the "..." overflow menu into the bar.
// It sits after Weight so the four handoff-spec chips keep their given order.
const BAR_ORDER = ["status", "haul", "color", "weight", "category"];

// Presentation only. Colorway is a free-text string in the data model and rep
// colourways are not enumerable, so the swatch list is a convenience layer over
// the text input — the hex is never persisted.
/* eslint-disable no-restricted-syntax --
   These five hexes are swatch paint, not theme colour (handoff §13, "literals
   that stay literals"). They must read the same in both colourways, because
   they show the garment's colour, not the app's. */
const SWATCHES = [
  { name: "Sky · white", hex: "#a8c8e8" },
  { name: "White", hex: "#E8E8E2" },
  { name: "Black", hex: "#1b1b1d" },
  { name: "Navy", hex: "#25314b" },
  { name: "Sand", hex: "#c9bda6" },
];
/* eslint-enable no-restricted-syntax */

// The two answers the shelf actually stores. A seven-stop pipeline was cut to
// these two (see StatusToggle in atoms.jsx); the plain-language meta is what
// makes the two words mean something without a legend.
const STATUS_STEPS = [
  { value: "want", label: "Want", meta: "saved, nothing sent" },
  { value: "bought", label: "Bought", meta: "handed to your agent" },
];

function Popover({ children, width, label, onDismiss, triggerRef }) {
  const ref = useRef(null);
  useEffect(() => {
    const onDown = (event) => {
      if (ref.current && ref.current.contains(event.target)) return;
      if (triggerRef.current && triggerRef.current.contains(event.target)) return;
      onDismiss();
    };
    const onKey = (event) => {
      if (event.key === "Escape") {
        // The modal also closes on Escape. An open popover owns the key first,
        // or dismissing a colour list would throw the whole panel away.
        event.stopPropagation();
        onDismiss();
        if (triggerRef.current) triggerRef.current.focus();
        return;
      }
      // Handoff §15: ↑ and ↓ walk the rows and wrap. Enter selects, which is
      // what a focused button already does. The arrows must not reach the
      // panel behind the popover — there they page the photos.
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      const box = ref.current;
      if (!box || !box.contains(event.target)) return;
      const rows = Array.from(box.querySelectorAll("button, input")).filter((el) => !el.disabled);
      if (!rows.length) return;
      event.preventDefault();
      event.stopPropagation();
      const at = rows.indexOf(event.target);
      const step = event.key === "ArrowDown" ? 1 : -1;
      const next = at < 0 ? 0 : (at + step + rows.length) % rows.length;
      rows[next].focus();
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [onDismiss, triggerRef]);
  // Focus lands on the first row when the popover opens, so ↑/↓ work without
  // a tab first. Without it the arrows reach the panel behind and page photos.
  useEffect(() => {
    const first = ref.current && ref.current.querySelector("button, input");
    if (first) first.focus();
  }, []);
  return (
    <div
      ref={ref}
      className="cz-cmdbar-pop"
      role="menu"
      aria-label={label}
      style={width ? { width, minWidth: width } : undefined}
    >
      {children}
    </div>
  );
}

function MenuItem({ selected, onClick, lead, children, meta }) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={selected}
      className={"cz-cmdbar-item" + (selected ? " is-on" : "")}
      onClick={onClick}
    >
      {lead}
      <span className="cz-cmdbar-item-label">{children}</span>
      {meta ? <span className="cz-cmdbar-item-meta">{meta}</span> : null}
    </button>
  );
}

function Chip({ id, open, onToggle, children, tone, chipRef }) {
  return (
    <button
      ref={chipRef}
      type="button"
      className={"cz-cmdbar-chip" + (tone ? " is-" + tone : "")}
      aria-expanded={open}
      aria-haspopup="menu"
      data-chip={id}
      onClick={onToggle}
    >
      {children}
      <ChevronDown className="cz-cmdbar-caret" size={10} strokeWidth={2.4} aria-hidden="true" />
    </button>
  );
}

export default function CommandBar({
  item,
  view,
  edit,
  commit,
  onSaveEdit,
  pickStatus,
  knownHauls = [],
  haulCounts = null,
  sellerHref = "",
  weightUnit,
  weightText,
  onWeightChange,
  onSwitchWeightUnit,
}) {
  const [menu, setMenu] = useState(null);
  const [newHaul, setNewHaul] = useState("");
  const refs = {
    status: useRef(null),
    haul: useRef(null),
    color: useRef(null),
    weight: useRef(null),
    category: useRef(null),
  };
  // A different item is a different set of answers; never carry an open
  // popover across the change.
  useEffect(() => {
    setMenu(null);
    setNewHaul("");
  }, [item.id]);

  const close = () => setMenu(null);
  const toggle = (key) => setMenu((open) => (open === key ? null : key));

  const bought = normalizeFindStatus(view.findStatus) === "bought";
  const statusLabel = bought ? "Bought" : "Want";
  const haul = String(view.project || "").trim();
  const colorway = String(view.colorway || "").trim();
  const grams = String(view.weightGrams || "").trim();
  const weightValue = weightUnit === "kg" ? weightText : grams;
  const categoryKey = String(view.category || "");
  const categoryLabel = (CATEGORIES[categoryKey] && CATEGORIES[categoryKey].label) || "";

  const commitHaul = (next) => {
    edit("project", next);
    commit();
    close();
  };

  const panels = {
    status: (
      <Popover label="Status" onDismiss={close} triggerRef={refs.status}>
        {STATUS_STEPS.map((step) => (
          <MenuItem
            key={step.value}
            selected={step.value === (bought ? "bought" : "want")}
            meta={step.meta}
            lead={
              <span
                className={
                  "cz-cmdbar-dot" +
                  (step.value === "bought" && bought ? " is-on" : "") +
                  (step.value === "want" && !bought ? " is-on" : "")
                }
                aria-hidden="true"
              />
            }
            onClick={() => {
              pickStatus(step.value);
              close();
            }}
          >
            {step.label}
          </MenuItem>
        ))}
      </Popover>
    ),
    haul: (
      <Popover label="Haul" onDismiss={close} triggerRef={refs.haul}>
        {knownHauls.map((name) => (
          <MenuItem
            key={name}
            selected={name === haul}
            meta={haulCounts && haulCounts[name] ? String(haulCounts[name]) : null}
            onClick={() => commitHaul(name)}
          >
            {name}
          </MenuItem>
        ))}
        {knownHauls.length ? <div className="cz-cmdbar-div" aria-hidden="true" /> : null}
        <div className="cz-cmdbar-newhaul">
          <Plus size={11} strokeWidth={2.4} aria-hidden="true" />
          <input
            className="cz-cmdbar-newhaul-input"
            aria-label="New haul"
            placeholder="New haul"
            value={newHaul}
            onChange={(event) => setNewHaul(event.target.value)}
            onKeyDown={(event) => {
              event.stopPropagation();
              if (event.key !== "Enter") return;
              const next = newHaul.trim();
              if (!next) return;
              setNewHaul("");
              commitHaul(next);
            }}
          />
        </div>
      </Popover>
    ),
    color: (
      <Popover label="Colorway" onDismiss={close} triggerRef={refs.color}>
        {SWATCHES.map((swatch) => (
          <MenuItem
            key={swatch.name}
            selected={swatch.name.toLowerCase() === colorway.toLowerCase()}
            lead={
              <span
                className="cz-cmdbar-swatch"
                style={{ background: swatch.hex }}
                aria-hidden="true"
              />
            }
            onClick={() => {
              edit("colorway", swatch.name);
              commit();
              close();
            }}
          >
            {swatch.name}
          </MenuItem>
        ))}
        <div className="cz-cmdbar-div" aria-hidden="true" />
        <input
          className="cz-cmdbar-text"
          aria-label="Colorway"
          placeholder="Type a colorway"
          value={view.colorway || ""}
          onChange={(event) => edit("colorway", event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === "Enter") {
              commit();
              close();
            }
          }}
        />
      </Popover>
    ),
    weight: (
      <Popover label="Weight" width={212} onDismiss={close} triggerRef={refs.weight}>
        <div className="cz-cmdbar-weight">
          <input
            className="cz-cmdbar-weight-input"
            aria-label={"Weight · " + weightUnit}
            inputMode="decimal"
            value={weightValue}
            onChange={(event) => onWeightChange(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => {
              event.stopPropagation();
              if (event.key === "Enter") {
                commit();
                close();
              }
            }}
          />
          <div className="cz-cmdbar-seg" role="group" aria-label="Weight unit">
            {["g", "kg"].map((unit) => (
              <button
                key={unit}
                type="button"
                className={"cz-cmdbar-seg-btn" + (weightUnit === unit ? " is-on" : "")}
                aria-pressed={weightUnit === unit}
                onClick={() => onSwitchWeightUnit(unit)}
              >
                {unit}
              </button>
            ))}
          </div>
        </div>
        <p className="cz-cmdbar-help">
          {haul
            ? "Feeds the parcel-weight estimate on the " + haul + " haul."
            : "Feeds the parcel-weight estimate for this haul."}
        </p>
      </Popover>
    ),
    category: (
      <Popover label="Category" onDismiss={close} triggerRef={refs.category}>
        {Object.entries(CATEGORIES).map(([key, cat]) => (
          <MenuItem
            key={key}
            selected={key === categoryKey}
            onClick={() => {
              // Category writes straight through, not via the debounced draft:
              // a hand-set category must also clear the auto flag, and that is
              // a two-field patch the single-key draft path cannot carry.
              if (onSaveEdit) onSaveEdit(item.id, { category: key, categoryManual: true });
              close();
            }}
          >
            {cat.label}
          </MenuItem>
        ))}
      </Popover>
    ),
  };

  const chips = {
    status: (
      <Chip
        id="status"
        chipRef={refs.status}
        open={menu === "status"}
        onToggle={() => toggle("status")}
        tone={bought ? "money" : null}
      >
        <span className={"cz-cmdbar-dot" + (bought ? " is-on" : "")} aria-hidden="true" />
        <span className="cz-cmdbar-status-word">{statusLabel}</span>
      </Chip>
    ),
    haul: (
      <Chip id="haul" chipRef={refs.haul} open={menu === "haul"} onToggle={() => toggle("haul")}>
        <span className="cz-cmdbar-label">Haul</span>
        <span className={"cz-cmdbar-value" + (haul ? "" : " is-unset")}>
          {haul || "Add to a haul"}
        </span>
      </Chip>
    ),
    color: (
      <Chip id="color" chipRef={refs.color} open={menu === "color"} onToggle={() => toggle("color")}>
        <span className="cz-cmdbar-label">Colorway</span>
        <span className={"cz-cmdbar-value" + (colorway ? "" : " is-unset")}>
          {colorway || "Add a colorway"}
        </span>
      </Chip>
    ),
    weight: (
      <Chip
        id="weight"
        chipRef={refs.weight}
        open={menu === "weight"}
        onToggle={() => toggle("weight")}
      >
        <span className="cz-cmdbar-label">Weight</span>
        <span className={"cz-cmdbar-value" + (grams ? "" : " is-unset")}>
          {grams ? grams + " g" : "Add a weight"}
        </span>
      </Chip>
    ),
    category: (
      <Chip
        id="category"
        chipRef={refs.category}
        open={menu === "category"}
        onToggle={() => toggle("category")}
      >
        <span className="cz-cmdbar-label">Category</span>
        <span className={"cz-cmdbar-value" + (categoryLabel ? "" : " is-unset")}>
          {categoryLabel || "Set a category"}
        </span>
      </Chip>
    ),
  };

  return (
    <div className="cz-cmdbar" role="group" aria-label="Item facts">
      {BAR_ORDER.map((key) => (
        <div className="cz-cmdbar-slot" key={key}>
          {chips[key]}
          {menu === key ? panels[key] : null}
        </div>
      ))}
      {item.seller && sellerHref ? (
        <a
          className="cz-cmdbar-seller"
          href={sellerHref}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(event) => event.stopPropagation()}
        >
          {item.seller}
          <ChevronRight size={11} strokeWidth={2.4} aria-hidden="true" />
        </a>
      ) : item.seller ? (
        <span className="cz-cmdbar-seller is-flat">{item.seller}</span>
      ) : null}
    </div>
  );
}
