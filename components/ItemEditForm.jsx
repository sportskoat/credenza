import { useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  CATEGORIES,
  CATEGORY_WEIGHT_GRAMS,
  EditPhotosManager,
  Field,
  HaulAccordionField,
  StatusChips,
  formatSizeToken,
  sizeSuggestionsFor,
} from "../credenza-fashion.jsx";

function CategorySelect({ value, onChange, label = "Category", auto = true }) {
  const [open, setOpen] = useState(false);
  const current = value || "";
  const currentLabel =
    current && CATEGORIES[current] ? CATEGORIES[current].label : "Not set";
  return (
    <div
      className={"cz-cat-select t-acc" + (open ? " is-open" : "")}
      data-open={open}
    >
      <div className="cz-cat-select-label">{label}</div>
      <button
        type="button"
        className="cz-cat-select-row"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="cz-cat-select-value">
          <span className="cz-cat-select-name">{currentLabel}</span>
          {auto && current ? (
            <span className="cz-cat-select-auto">auto</span>
          ) : null}
        </span>
        <span className="t-acc-chevron">
          <ChevronDown size={14} strokeWidth={2.2} aria-hidden="true" />
        </span>
      </button>
      {/* Same t-acc + t-panel-slide composite as the status picker. The panel
          stays mounted so the close animation can play; inert keeps the hidden
          chips out of tab order and the a11y tree. */}
      <div
        className="t-acc-panel"
        aria-hidden={!open}
        inert={!open ? "" : undefined}
      >
        <div className="t-acc-panel-inner">
          <div
            className="cz-cat-select-menu t-panel-slide"
            data-open={open}
            role="listbox"
            aria-label={label}
          >
            <div className="cz-cat-select-chips">
              {Object.entries(CATEGORIES).map(([key, c]) => {
                const active = current === key;
                return (
                  <button
                    type="button"
                    key={key}
                    role="option"
                    aria-selected={active}
                    className={
                      "cz-cat-select-chip" + (active ? " is-active" : "")
                    }
                    onClick={() => {
                      onChange && onChange(key);
                      setOpen(false);
                    }}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ItemEditForm({ item, ed, setEd, knownHauls, onAttachPhoto, onRemovePhoto }) {
  const recSize = item.recommendedSize || null;
  // A6: the placeholder shows the auto estimate for the draft's category, so
  // an empty field reads as "uses the default", not "no weight".
  const autoWeight = CATEGORY_WEIGHT_GRAMS[ed.category || item.category || ""] || null;
  return (
    <div className="cz-carousel-edit">
      <Field label="Title" value={ed.title} onChange={(v) => setEd({ ...ed, title: v })} placeholder="Name this card" />
      {/* Currency is not an edit field (Kyle 2026-07-23): the listed amount
          keeps its source currency; on-screen money order follows Profile →
          Primary currency. No boxed Currency control. */}
      <div className="cz-carousel-field-grid">
        <div>
          <Field label="Price" value={ed.price} onChange={(v) => setEd({ ...ed, price: v })} placeholder="0" />
        </div>
        <div>
          <Field
            label="Weight (g)"
            value={ed.weightGrams}
            onChange={(v) => setEd({ ...ed, weightGrams: v })}
            placeholder={autoWeight ? "Auto: " + autoWeight + " g" : "Grams"}
          />
        </div>
      </div>
      <div className="cz-carousel-field-grid">
        <div>
          <Field
            label="Size"
            value={ed.size}
            onChange={(v) => setEd({ ...ed, size: v })}
            placeholder="EU 42"
            suggestions={sizeSuggestionsFor(item)}
            emptyHint="Type a size"
            listLabel="Sizes"
            allowCreate
          />
        </div>
        <div>
          <Field label="Colorway" value={ed.colorway} onChange={(v) => setEd({ ...ed, colorway: v })} placeholder="Black/white" />
        </div>
      </div>
      <div className="cz-status-edit-label">Status</div>
      <StatusChips
        mode="display"
        value={ed.findStatus || "want"}
        onChange={(s) => setEd({ ...ed, findStatus: s })}
      />
      {recSize && (
        <div className="cz-fit-auto" aria-label="Fit auto">
          <div className="cz-fit-auto-kicker">Fit · auto</div>
          <div className="cz-fit-auto-size">Recommended: {formatSizeToken(recSize) || recSize}</div>
          <div className="cz-fit-auto-note">
            Regenerates when size or measurements change.
          </div>
        </div>
      )}
      <EditPhotosManager
        item={item}
        onAttachPhoto={onAttachPhoto}
        onRemovePhoto={onRemovePhoto}
      />
      <HaulAccordionField
        label="Haul"
        value={ed.project}
        knownHauls={knownHauls}
        onChange={(v) => setEd({ ...ed, project: v })}
        onCommit={(v) => setEd((prev) => (prev ? { ...prev, project: v } : prev))}
      />
      <Field
        label="Notes / links"
        value={ed.note || ""}
        onChange={(v) => setEd({ ...ed, note: v })}
        placeholder="Fit notes, QC reminders, sizing, seller tips, extra links…"
        rows={3}
      />
      <div className="cz-carousel-field-grid">
        <div>
          <Field label="Seller" value={ed.seller} onChange={(v) => setEd({ ...ed, seller: v })} placeholder="Store name" />
        </div>
        <div>
          <Field label="Batch" value={ed.batch} onChange={(v) => setEd({ ...ed, batch: v })} placeholder="e.g., M Batch" />
        </div>
      </div>
      <CategorySelect
        value={ed.category}
        onChange={(v) => setEd({ ...ed, category: v })}
      />
    </div>
  );
}
