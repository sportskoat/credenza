import { useId, useState } from "react";
import {
  BODY_MEASURE_GROUPS,
  BODY_PROFILE_FIELDS,
  Field,
  ModalShell,
  Pill,
  SegmentedControl,
  measureFromStorage,
  measureToStorage,
} from "../credenza-fashion.jsx";

// One measurement. Kyle 2026-07-27: "the measurements could use a little bit
// of a bigger, better thing."
//
// The shared Field was too small for this screen and it carried the unit in
// the label — "Chest (in)" — so the unit repeated eight times and the label
// you actually read got pushed sideways. Here the unit sits inside the box,
// against the right edge, where it reads as part of the number. The label is
// then just the body part.
//
// The input is 20px. That is large enough to check a typed number at arm's
// length with a tape measure in your other hand, and 16px or more is also the
// threshold that stops iOS zooming the page on focus.
function Measure({ label, unit, value, onChange, placeholder }) {
  const id = useId();
  return (
    <div className="cz-measure-field">
      <label className="cz-measure-label" htmlFor={id}>
        {label}
      </label>
      <div className="cz-measure-input">
        <input
          id={id}
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
        <span className="cz-measure-unit" aria-hidden="true">
          {unit}
        </span>
      </div>
    </div>
  );
}

// `embedded` renders the body alone, for the Profile modal's sub-page stack
// (Kyle 2026-07-26). The stack owns the shell, the title, and the back button.
export default function BodyProfileSheet({ value, units = "in", onSave, onChangeUnits, onClose, embedded = false }) {
  const [draft, setDraft] = useState(() => {
    const d = {};
    for (const [key, , kind] of BODY_PROFILE_FIELDS) d[key] = measureFromStorage(value && value[key], units, kind);
    return d;
  });
  // Part 5 task 11: usual sizes per slot — free text ("M", "32", "US 10"),
  // not measures. They drive the (EST) size line on cards with no chart.
  const [usual, setUsual] = useState(() => ({
    usualTops: (value && value.usualTops) || "",
    usualBottoms: (value && value.usualBottoms) || "",
    usualShoes: (value && value.usualShoes) || "",
  }));

  const set = (key) => (v) => setDraft((d) => ({ ...d, [key]: v.replace(/[^\d.]/g, "") }));
  const setUsualKey = (key) => (v) => setUsual((u) => ({ ...u, [key]: v }));

  // Convert every typed value when the toggle flips — 38 stays 38, just in
  // the other unit (96.5cm), never silently reinterpreted.
  const switchUnits = (next) => {
    if (next === units) return;
    setDraft((d) => {
      const out = {};
      for (const [key, , kind] of BODY_PROFILE_FIELDS) {
        const stored = measureToStorage(d[key], units, kind);
        out[key] = stored == null ? "" : measureFromStorage(stored, next, kind);
      }
      return out;
    });
    onChangeUnits(next);
  };

  const save = () => {
    const out = {};
    for (const [key, , kind] of BODY_PROFILE_FIELDS) {
      const n = measureToStorage(draft[key], units, kind);
      if (n != null) out[key] = n;
    }
    for (const key of ["usualTops", "usualBottoms", "usualShoes"]) {
      const s = String(usual[key] || "").trim();
      if (s) out[key] = s;
    }
    onSave(Object.keys(out).length ? out : null);
    onClose();
  };

  const unitLabel = (kind) => (units === "in" ? (kind === "weight" ? "lb" : "in") : kind === "weight" ? "kg" : "cm");

  // How many of the eight are filled in. A person who opens this sheet a
  // second time wants to know what is left, and counting eight boxes by eye
  // is exactly the small friction that makes a form feel like work.
  const filled = BODY_PROFILE_FIELDS.filter(([key]) => String(draft[key] || "").trim()).length;

  const body = (
    <div className="cz-measure">
      <div className="cz-measure-head">
        <p className="cz-measure-lead">
          Measure your body, not a garment you own. Credenza adds the ease when
          it reads a seller chart, and converts the metric numbers for you.
        </p>
        <div className="cz-measure-units">
          <SegmentedControl
            label="Units"
            value={units}
            onChange={switchUnits}
            options={[
              { value: "in", label: "in" },
              { value: "cm", label: "cm" },
            ]}
          />
        </div>
      </div>

      <p className="cz-measure-count">
        {filled} of {BODY_PROFILE_FIELDS.length} filled in. Every one you add
        sharpens the size Credenza picks.
      </p>

      {BODY_MEASURE_GROUPS.map(([group, heading, why]) => (
        <section className="cz-measure-group" key={group}>
          <h3 className="cz-measure-group-head">{heading}</h3>
          <p className="cz-measure-group-why">{why}</p>
          <div className="cz-measure-grid">
            {BODY_PROFILE_FIELDS.filter((f) => f[5] === group).map(([key, label, kind, phCm, phIn]) => (
              <Measure
                key={key}
                label={label}
                unit={unitLabel(kind)}
                value={draft[key] || ""}
                onChange={set(key)}
                placeholder={units === "in" ? phIn : phCm}
              />
            ))}
          </div>
        </section>
      ))}

      <section className="cz-measure-group">
        <h3 className="cz-measure-group-head">Usual sizes</h3>
        <p className="cz-measure-group-why">
          What you buy most often. Shown as EST on cards that carry no size chart.
        </p>
        <div className="cz-measure-grid cz-measure-grid-3">
          <Field label="Tops" value={usual.usualTops} onChange={setUsualKey("usualTops")} placeholder="M" />
          <Field label="Bottoms" value={usual.usualBottoms} onChange={setUsualKey("usualBottoms")} placeholder="32" />
          <Field label="Shoes" value={usual.usualShoes} onChange={setUsualKey("usualShoes")} placeholder="US 10" />
        </div>
      </section>

      <div className="cz-measure-actions">
        <Pill primary onClick={save} style={{ flex: 1, justifyContent: "center", minHeight: 46 }}>
          Save measurements
        </Pill>
        <Pill subtle onClick={onClose}>
          Cancel
        </Pill>
      </div>
    </div>
  );

  if (embedded) return body;
  return (
    <ModalShell title="Your measurements" onClose={onClose} maxWidth={560}>
      {body}
    </ModalShell>
  );
}
