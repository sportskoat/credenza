import { useState } from "react";
import {
  BODY_PROFILE_FIELDS,
  FONT,
  Field,
  ModalShell,
  Pill,
  SUB,
  SegmentedControl,
  measureFromStorage,
  measureToStorage,
} from "../credenza-fashion.jsx";

export default function BodyProfileSheet({ value, units = "in", onSave, onChangeUnits, onClose }) {
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

  return (
    <ModalShell title="Your measurements" onClose={onClose} maxWidth={560}>
      <div style={{ padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <p style={{ margin: 0, flex: 1, fontFamily: FONT, fontSize: 13, color: SUB, lineHeight: 1.5 }}>
            Measured on your body — Credenza adds the ease. Seller charts are
            metric; we convert for you.
          </p>
          <div style={{ flexShrink: 0, minWidth: 120 }}>
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
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {BODY_PROFILE_FIELDS.map(([key, label, kind, phCm, phIn]) => (
            <Field
              key={key}
              label={label + " (" + unitLabel(kind) + ")"}
              value={draft[key] || ""}
              onChange={set(key)}
              placeholder={units === "in" ? phIn : phCm}
            />
          ))}
        </div>
        <p style={{ margin: "16px 0 8px", fontFamily: FONT, fontSize: 13, color: SUB, lineHeight: 1.5 }}>
          Usual sizes — what you buy most often. Shown as EST on cards with no size chart.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <Field label="Tops" value={usual.usualTops} onChange={setUsualKey("usualTops")} placeholder="M" />
          <Field label="Bottoms" value={usual.usualBottoms} onChange={setUsualKey("usualBottoms")} placeholder="32" />
          <Field label="Shoes" value={usual.usualShoes} onChange={setUsualKey("usualShoes")} placeholder="US 10" />
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <Pill primary onClick={save} style={{ flex: 1, justifyContent: "center", minHeight: 44 }}>Save</Pill>
          <Pill subtle onClick={onClose}>Cancel</Pill>
        </div>
      </div>
    </ModalShell>
  );
}
