import { useEffect, useId, useRef, useState } from "react";
import {
  ModalShell,
  Pill,
  SegmentedControl,
  measureFromStorage,
  measureToStorage,
} from "../credenza-fashion.jsx";

// Sizes and measurements v2 (design: Sizes and Measurements v2.dc.html).
// Hairline sections, mono field table, fixed photo measure lines, two modes
// that keep separate values on one saved record. Labels and numbers live in
// the field list only — never on the photo.

const TOPS = ["chest", "shoulder", "sleeve", "length"];
const BOT = ["waist", "hip", "pantsLength", "shortsLength"];
const ALL = TOPS.concat(BOT);

const BODY_KEYS = [
  "height",
  "weight",
  "chest",
  "shoulder",
  "sleeve",
  "length",
  "waist",
  "hip",
  "pantsLength",
  "shortsLength",
];

const LABELS = {
  body: {
    chest: "Chest",
    shoulder: "Shoulder",
    sleeve: "Arm length",
    length: "Shirt length",
    waist: "Waist",
    hip: "Hip",
    pantsLength: "Trouser length",
    shortsLength: "Shorts length",
  },
  garment: {
    chest: "Pit to pit",
    shoulder: "Shoulder seam",
    sleeve: "Sleeve",
    length: "Length, HPS",
    waist: "Waist, flat",
    hip: "Hip, flat",
    pantsLength: "Trouser length",
    shortsLength: "Shorts length",
  },
};

const HOW = {
  garment: {
    chest:
      "Lay the top flat and smooth the fabric. Measure straight across from one armpit seam to the other — don’t stretch it.",
    shoulder:
      "Top of one shoulder seam to the top of the other. On a drop-shoulder tee that seam sits down the arm — measure it there anyway, sellers do.",
    sleeve:
      "From the shoulder seam point, down the outside of the sleeve, to the cuff edge. A diagonal on a flat-lay, not a drop down the side seam.",
    length: "From the high point of the shoulder — right beside the collar — straight down to the hem.",
    waist: "Buttoned and flat. Across the top of the waistband, edge to edge. Sellers list this flat measure, not the loop.",
    hip: "Flat across the widest point, roughly 18cm below the waistband.",
    pantsLength: "From the top of the waistband straight down the outside to the hem.",
    shortsLength: "Top of the waistband to the hem, the same way as trousers.",
  },
  body: {
    chest: "Arms down, tape level under the armpits and across the fullest part. Breathe normally.",
    shoulder: "Across the back, from the bony point of one shoulder to the bony point of the other.",
    sleeve: "From the shoulder point, elbow slightly bent, down to the wrist bone.",
    length: "Bodies have no hem. Measure a shirt you already like, high shoulder point to hem.",
    waist: "Around the narrowest part, usually just above the navel. Don’t pull the tape tight.",
    hip: "Around the fullest part of the seat, feet together.",
    pantsLength: "Off a pair you own: top of the waistband down to the hem.",
    shortsLength: "Off a pair you own: top of the waistband down to the hem.",
  },
};

// Percent of the photo box. Tuned for a centered flat-lay / figure in 4:5.
const PTS = {
  shoulder: { x1: 18, y1: 22, x2: 82, y2: 22 },
  chest: { x1: 13, y1: 39, x2: 87, y2: 39 },
  sleeve: { x1: 74, y1: 28, x2: 91, y2: 45 },
  length: { x1: 43, y1: 15, x2: 43, y2: 89 },
  waist: { x1: 26, y1: 12, x2: 74, y2: 12 },
  hip: { x1: 20, y1: 28, x2: 80, y2: 28 },
  pantsLength: { x1: 33, y1: 10, x2: 33, y2: 92 },
  shortsLength: { x1: 67, y1: 10, x2: 67, y2: 48 },
};

function emptyDraft() {
  const d = {};
  for (const k of ALL) d[k] = "";
  return d;
}

function draftFromStorage(src, units) {
  const d = emptyDraft();
  if (!src || typeof src !== "object") return d;
  for (const k of ALL) d[k] = measureFromStorage(src[k], units, "length");
  return d;
}

function usualFromValue(value) {
  return {
    usualTops: (value && value.usualTops) || "",
    usualBottoms: (value && value.usualBottoms) || "",
    usualShoes: (value && value.usualShoes) || "",
  };
}

function formatNum(n) {
  if (!isFinite(n)) return "";
  return Math.abs(n - Math.round(n)) < 0.05 ? String(Math.round(n)) : n.toFixed(1);
}

function asCm(text, units) {
  const n = parseFloat(text);
  if (!isFinite(n) || n <= 0) return null;
  return units === "in" ? n * 2.54 : n;
}

function filledCount(draft, keys) {
  return keys.filter((k) => parseFloat(draft[k]) > 0).length;
}

function FieldRow({ id, label, unit, value, active, onChange, onFocus, text = false, placeholder = "—" }) {
  // No onClick on the label — htmlFor already focuses the input, and the
  // input’s onFocus paints the active row. A click handler here trips a11y
  // lint (label is non-interactive for mouse/keyboard listeners).
  return (
    <label className={"cz-sizes-row" + (active ? " is-active" : "")} htmlFor={id}>
      <span className="cz-sizes-row-bar" aria-hidden="true" />
      <span className="cz-sizes-row-label">{label}</span>
      <input
        id={id}
        className={"cz-sizes-row-input" + (text ? " is-text" : "")}
        inputMode={text ? "text" : "decimal"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        placeholder={placeholder}
        autoComplete="off"
        aria-label={label}
      />
      {text ? null : (
        <span className="cz-sizes-row-unit" aria-hidden="true">
          {unit}
        </span>
      )}
    </label>
  );
}

function MeasureLines({ keys, activeKey, draft, onSelect, labels }) {
  const active = PTS[activeKey] || PTS[keys[0]];
  return (
    <div className="cz-sizes-lines">
      <svg className="cz-sizes-lines-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
        {keys.map((key) => {
          const p = PTS[key];
          const has = parseFloat(draft[key]) > 0;
          const live = key === activeKey;
          const state = live ? "live" : has ? "filled" : "empty";
          return (
            <g
              key={key}
              className={"cz-sizes-line-g is-" + state}
              role="button"
              tabIndex={0}
              aria-label={"Select " + labels[key]}
              onClick={() => onSelect(key)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(key);
                }
              }}
            >
              {/* Wide invisible stroke: 44px floor on a ~360px photo ≈ 12 viewBox units */}
              <line className="cz-sizes-line-hit" x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} />
              <line className="cz-sizes-line-stroke" x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} />
            </g>
          );
        })}
      </svg>
      <span className="cz-sizes-dot" style={{ left: active.x1 + "%", top: active.y1 + "%" }} />
      <span className="cz-sizes-dot" style={{ left: active.x2 + "%", top: active.y2 + "%" }} />
    </div>
  );
}

function PhotoPanel({ mode, group, activeKey, draft, onSelect, labels, how, valueText }) {
  const isTops = group === "tops";
  const keys = isTops ? TOPS : BOT;
  const placeholder =
    mode === "garment"
      ? isTops
        ? "Drop a top that fits, laid flat"
        : "Drop trousers that fit, laid flat"
      : isTops
        ? "Drop a front-on photo, shoulders to hip"
        : "Drop a front-on photo, waist to floor";

  return (
    <div className="cz-sizes-photo-col">
      <div className="cz-sizes-photo">
        <div className="cz-sizes-photo-slot" aria-hidden="true">
          <span className="cz-sizes-photo-ph">{placeholder}</span>
        </div>
        <MeasureLines keys={keys} activeKey={activeKey} draft={draft} onSelect={onSelect} labels={labels} />
      </div>
      <div className="cz-sizes-how">
        <div className="cz-sizes-how-head">
          <span className="cz-sizes-how-label">{labels[activeKey]}</span>
          <span className="cz-sizes-how-value">{valueText}</span>
        </div>
        <p className="cz-sizes-how-body">{how[activeKey]}</p>
      </div>
    </div>
  );
}

function buildVerdict(mode, draft, units, usualTops, height, weight) {
  const chest = asCm(draft.chest, units);
  const usual = String(usualTops || "").trim();
  const h = parseFloat(height);
  const w = parseFloat(weight);
  const rough = isFinite(h) && h > 0 && isFinite(w) && w > 0;

  if (!chest) {
    if (rough) {
      return {
        text: "~ Large, estimated from your height and weight. The chart is right there — one measurement turns this into a real answer.",
        basis: "Kit jersey · black · chart present · estimated from height and weight · marked ~",
      };
    }
    if (usual) {
      return {
        text: "No chart on this listing, so Credenza takes your usual " + usual + " — and the card says that out loud.",
        basis: "Kit jersey · black · no chart · falling back to your usual size",
      };
    }
    return {
      text: "Nothing to go on yet. Fill in your usual sizes and Credenza can at least stop guessing silently.",
      basis: "Kit jersey · black · no chart · no usual size yet",
    };
  }

  if (mode === "garment") {
    // Demo chart: Kit jersey Large at 54cm pit-to-pit (half chest).
    const ease = 54 - chest;
    const dir =
      ease >= 0
        ? "leaves " + formatNum(ease) + "cm over"
        : "sits " + formatNum(-ease) + "cm under";
    return {
      text:
        "Take the Large. Its 54cm pit-to-pit " +
        dir +
        " the " +
        formatNum(chest) +
        "cm you measured flat, which is where this jersey is meant to sit.",
      basis: "Kit jersey · black · chart present · flat to flat, no ease estimated",
    };
  }

  return {
    text:
      "Take the Large. Its 104cm chest gives you " +
      formatNum(104 - chest) +
      "cm of room over your " +
      formatNum(chest) +
      "cm.",
    basis: "Kit jersey · black · chart present · ease added by Credenza",
  };
}

export default function BodyProfileSheet({
  value,
  units = "in",
  onSave,
  onChangeUnits,
  onClose,
  embedded = false,
}) {
  const baseId = useId();
  const inputRefs = useRef({});

  const [mode, setMode] = useState(() =>
    value && (value.measureMode === "body" || value.measureMode === "garment")
      ? value.measureMode
      : "garment"
  );
  const [bodyDraft, setBodyDraft] = useState(() => {
    const d = draftFromStorage(value, units);
    // height / weight live with usual sizes, not on the photo groups
    d.height = measureFromStorage(value && value.height, units, "length");
    d.weight = measureFromStorage(value && value.weight, units, "weight");
    return d;
  });
  const [garmentDraft, setGarmentDraft] = useState(() =>
    draftFromStorage(value && value.garment, units)
  );
  const [usual, setUsual] = useState(() => usualFromValue(value));
  const [garmentTop, setGarmentTop] = useState(() => (value && value.garmentTop) || "");
  const [garmentBottom, setGarmentBottom] = useState(() => (value && value.garmentBottom) || "");
  const [active, setActive] = useState({ tops: "chest", bot: "waist" });
  const [saved, setSaved] = useState(false);

  // Keep display drafts in the selected unit when the parent flips units.
  useEffect(() => {
    // units prop is the source of truth from settings; drafts already convert
    // on local switchUnits. No sync needed unless the parent remounts.
  }, [units]);

  const draft = mode === "garment" ? garmentDraft : bodyDraft;
  const labels = LABELS[mode];
  const how = HOW[mode];
  const unitShort = units === "in" ? "in" : "cm";
  const weightUnit = units === "in" ? "lb" : "kg";

  const nTops = filledCount(draft, TOPS);
  const nBot = filledCount(draft, BOT);
  const n = nTops + nBot;

  const setMeasure = (key, raw) => {
    const v = String(raw).replace(/[^0-9.]/g, "");
    setSaved(false);
    if (mode === "garment") setGarmentDraft((d) => ({ ...d, [key]: v }));
    else setBodyDraft((d) => ({ ...d, [key]: v }));
  };

  const setBodyMeta = (key, raw) => {
    const v = String(raw).replace(/[^0-9.]/g, "");
    setSaved(false);
    setBodyDraft((d) => ({ ...d, [key]: v }));
  };

  const focusKey = (key) => {
    const group = TOPS.indexOf(key) >= 0 ? "tops" : "bot";
    setActive((a) => (a[group] === key ? a : { ...a, [group]: key }));
    const el = inputRefs.current[key];
    if (el && typeof el.focus === "function") {
      // Defer so the active class paints before the caret lands.
      requestAnimationFrame(() => el.focus());
    }
  };

  const switchUnits = (next) => {
    if (next === units) return;
    const convert = (d, kindFor) => {
      const out = { ...d };
      for (const key of Object.keys(out)) {
        const kind = kindFor(key);
        const stored = measureToStorage(out[key], units, kind);
        out[key] = stored == null ? "" : measureFromStorage(stored, next, kind);
      }
      return out;
    };
    setBodyDraft((d) =>
      convert(d, (k) => (k === "weight" ? "weight" : "length"))
    );
    setGarmentDraft((d) => convert(d, () => "length"));
    onChangeUnits(next);
  };

  const save = () => {
    const out = {};
    // Body measures always write from the body draft so garment mode never
    // overwrites the body record (F’s condition).
    for (const key of BODY_KEYS) {
      const kind = key === "weight" ? "weight" : "length";
      const nVal = measureToStorage(bodyDraft[key], units, kind);
      if (nVal != null) out[key] = nVal;
    }
    for (const key of ["usualTops", "usualBottoms", "usualShoes"]) {
      const s = String(usual[key] || "").trim();
      if (s) out[key] = s;
    }
    const gOut = {};
    for (const key of ALL) {
      const nVal = measureToStorage(garmentDraft[key], units, "length");
      if (nVal != null) gOut[key] = nVal;
    }
    if (Object.keys(gOut).length) out.garment = gOut;
    const gt = String(garmentTop || "").trim();
    const gb = String(garmentBottom || "").trim();
    if (gt) out.garmentTop = gt;
    if (gb) out.garmentBottom = gb;
    out.measureMode = mode;

    const hasAnything =
      Object.keys(out).some((k) => k !== "measureMode") || Object.keys(gOut).length > 0;
    onSave(hasAnything ? out : null);
    setSaved(true);
    if (!embedded) onClose();
  };

  const modeHelp =
    mode === "garment"
      ? "Sellers publish these four numbers, so yours compare directly — nothing is estimated in the middle. The lines on the photo show where each one is taken."
      : "Measure your body over a t-shirt, tape level. Credenza adds the ease the garment is meant to have.";

  const topsNote =
    mode === "garment"
      ? garmentTop
        ? "Every tops verdict will cite this as “from your " + garmentTop + ".”"
        : "Name the top and every verdict can cite where the number came from."
      : "Shirt length is the one exception — bodies have no hem, so measure a shirt you already like.";

  const botNote =
    "Trouser and shorts length run from the top of the waistband to the hem, the way sellers list them.";

  const valueText = (key) => {
    const v = draft[key];
    return parseFloat(v) > 0 ? v + " " + unitShort : "not measured";
  };

  const verdict = buildVerdict(
    mode,
    draft,
    units,
    usual.usualTops,
    bodyDraft.height,
    bodyDraft.weight
  );

  const bindRef = (key) => (el) => {
    inputRefs.current[key] = el;
  };

  const row = (key) => (
    <label
      key={key}
      className={"cz-sizes-row" + (active[TOPS.indexOf(key) >= 0 ? "tops" : "bot"] === key ? " is-active" : "")}
      htmlFor={baseId + "-" + key}
    >
      <span className="cz-sizes-row-bar" aria-hidden="true" />
      <span className="cz-sizes-row-label">{labels[key]}</span>
      <input
        ref={bindRef(key)}
        id={baseId + "-" + key}
        className="cz-sizes-row-input"
        inputMode="decimal"
        value={draft[key] || ""}
        onChange={(e) => setMeasure(key, e.target.value)}
        onFocus={() => focusKey(key)}
        placeholder="—"
        autoComplete="off"
        aria-label={labels[key]}
      />
      <span className="cz-sizes-row-unit" aria-hidden="true">
        {unitShort}
      </span>
    </label>
  );

  const body = (
    <div className={"cz-sizes" + (embedded ? " is-embedded" : "")}>
      {/* Usual sizes — top, not buried under the form */}
      <section className="cz-sizes-block">
        <div className="cz-sizes-gutter">
          <div className="cz-sizes-gutter-label">Usual sizes</div>
          <p className="cz-sizes-gutter-help">Enough on its own. The fallback when a listing has no chart.</p>
        </div>
        <div className="cz-sizes-usual">
          <FieldRow
            id={baseId + "-tops"}
            label="Tops"
            unit=""
            text
            value={usual.usualTops}
            active={false}
            onChange={(v) => {
              setSaved(false);
              setUsual((u) => ({ ...u, usualTops: v }));
            }}
            onFocus={() => {}}
            placeholder="—"
          />
          <FieldRow
            id={baseId + "-bottoms"}
            label="Bottoms"
            unit=""
            text
            value={usual.usualBottoms}
            active={false}
            onChange={(v) => {
              setSaved(false);
              setUsual((u) => ({ ...u, usualBottoms: v }));
            }}
            onFocus={() => {}}
            placeholder="—"
          />
          <FieldRow
            id={baseId + "-shoes"}
            label="Shoes"
            unit=""
            text
            value={usual.usualShoes}
            active={false}
            onChange={(v) => {
              setSaved(false);
              setUsual((u) => ({ ...u, usualShoes: v }));
            }}
            onFocus={() => {}}
            placeholder="—"
          />
          <FieldRow
            id={baseId + "-height"}
            label="Height"
            unit={unitShort}
            value={bodyDraft.height || ""}
            active={false}
            onChange={(v) => setBodyMeta("height", v)}
            onFocus={() => {}}
          />
          <FieldRow
            id={baseId + "-weight"}
            label="Weight"
            unit={weightUnit}
            value={bodyDraft.weight || ""}
            active={false}
            onChange={(v) => setBodyMeta("weight", v)}
            onFocus={() => {}}
          />
          <div className="cz-sizes-usual-note">
            <p>
              Height and weight only feed the <span className="cz-sizes-tilde">~</span> estimate when a
              chart exists and your measurements don’t.
            </p>
          </div>
        </div>
      </section>

      {/* Measurements header */}
      <div className="cz-sizes-meas-head">
        <div className="cz-sizes-meas-title-row">
          <h2 className="cz-sizes-meas-title">Measurements.</h2>
          <span className="cz-sizes-meas-progress">
            {n} of {ALL.length}
          </span>
        </div>
        <div className="cz-sizes-meas-controls">
          <SegmentedControl
            label="Where the numbers come from"
            value={mode}
            onChange={(v) => setMode(v)}
            options={[
              { value: "body", label: "Your body" },
              { value: "garment", label: "A garment that fits" },
            ]}
          />
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
      <p className="cz-sizes-mode-help">{modeHelp}</p>

      {/* Tops */}
      <section className="cz-sizes-group">
        <PhotoPanel
          mode={mode}
          group="tops"
          activeKey={active.tops}
          draft={draft}
          onSelect={focusKey}
          labels={labels}
          how={how}
          valueText={valueText(active.tops)}
        />
        <div className="cz-sizes-fields">
          <div className="cz-sizes-fields-head">
            <span className="cz-sizes-fields-title">Tops</span>
            <span className="cz-sizes-fields-count">
              {nTops} of {TOPS.length}
            </span>
          </div>
          {mode === "garment" ? (
            <FieldRow
              id={baseId + "-which-top"}
              label="Which top"
              unit=""
              text
              value={garmentTop}
              active={false}
              onChange={(v) => {
                setSaved(false);
                setGarmentTop(v);
              }}
              onFocus={() => {}}
              placeholder="Uniqlo U tee · L"
            />
          ) : null}
          <div className="cz-sizes-field-list">{TOPS.map(row)}</div>
          <p className="cz-sizes-fields-note">{topsNote}</p>
        </div>
      </section>

      {/* Bottoms */}
      <section className="cz-sizes-group">
        <PhotoPanel
          mode={mode}
          group="bot"
          activeKey={active.bot}
          draft={draft}
          onSelect={focusKey}
          labels={labels}
          how={how}
          valueText={valueText(active.bot)}
        />
        <div className="cz-sizes-fields">
          <div className="cz-sizes-fields-head">
            <span className="cz-sizes-fields-title">Bottoms</span>
            <span className="cz-sizes-fields-count">
              {nBot} of {BOT.length}
            </span>
          </div>
          {mode === "garment" ? (
            <FieldRow
              id={baseId + "-which-pair"}
              label="Which pair"
              unit=""
              text
              value={garmentBottom}
              active={false}
              onChange={(v) => {
                setSaved(false);
                setGarmentBottom(v);
              }}
              onFocus={() => {}}
              placeholder="Dickies 874 · 33"
            />
          ) : null}
          <div className="cz-sizes-field-list">{BOT.map(row)}</div>
          <p className="cz-sizes-fields-note">{botNote}</p>
        </div>
      </section>

      {/* What we can say */}
      <section className="cz-sizes-block cz-sizes-verdict-block">
        <div className="cz-sizes-gutter">
          <div className="cz-sizes-gutter-label">What we can say</div>
        </div>
        <div className="cz-sizes-verdict">
          <p className="cz-sizes-verdict-text">{verdict.text}</p>
          <p className="cz-sizes-verdict-basis">{verdict.basis}</p>
        </div>
      </section>

      {/* Save bar */}
      <div className="cz-sizes-save">
        <span className="cz-sizes-save-hint">
          {saved ? "Saved" : n ? "Unsaved changes" : "Nothing measured yet"}
        </span>
        <div className="cz-sizes-save-actions">
          {embedded ? null : (
            <Pill subtle onClick={onClose}>
              Cancel
            </Pill>
          )}
          <Pill primary onClick={save} style={{ minHeight: 46, justifyContent: "center" }}>
            {saved ? "Saved" : "Save measurements"}
          </Pill>
        </div>
      </div>
    </div>
  );

  if (embedded) return body;
  return (
    <ModalShell title="Your measurements" onClose={onClose} maxWidth={980}>
      {body}
    </ModalShell>
  );
}
