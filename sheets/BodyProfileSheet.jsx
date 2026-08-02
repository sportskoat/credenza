import { useEffect, useId, useRef, useState } from "react";
import {
  ModalShell,
  Pill,
  SegmentedControl,
  measureFromStorage,
  measureToStorage,
  migrateSleeveMeasurements,
} from "../credenza-fashion.jsx";

// Sizes and measurements redesign (handoff 2026-08-01).
// Same dual body/garment data model as before. Layout + SVG tape diagrams
// are new. No demo "result" sentence. Auto-saves when embedded.

const TOPS = ["chest", "shoulder", "shortSleeve", "longSleeve", "length"];
const BOT = ["waist", "hip", "pantsLength", "shortsLength"];
const ALL = TOPS.concat(BOT);

const BODY_KEYS = [
  "height",
  "weight",
  "chest",
  "shoulder",
  "shortSleeve",
  "longSleeve",
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
    shortSleeve: "Short sleeve",
    longSleeve: "Long sleeve",
    length: "Length",
    waist: "Waist",
    hip: "Hip",
    pantsLength: "Trouser length",
    shortsLength: "Shorts length",
  },
  garment: {
    chest: "Pit to pit",
    shoulder: "Shoulder seam",
    shortSleeve: "Short sleeve",
    longSleeve: "Long sleeve",
    length: "Length, HPS",
    waist: "Waist, flat",
    hip: "Hip, flat",
    pantsLength: "Trouser length",
    shortsLength: "Shorts length",
  },
};

const HOW = {
  body: {
    chest: "Around the fullest part, tape level, arms down.",
    shoulder: "Bone to bone across your back, following the flat of the shoulders.",
    shortSleeve: "Shoulder point down the outside of the arm to where you want a short sleeve to end.",
    longSleeve: "Shoulder point down the outside of the arm to the wrist.",
    length: "Top of the shoulder straight down to where you want the hem to land.",
    waist: "Around where you actually wear the waistband, not your natural waist.",
    hip: "Around the fullest part of the seat, feet together.",
    pantsLength: "Waistband down the outside of the leg to the ankle.",
    shortsLength: "Waistband down to where you want the hem to land.",
  },
  garment: {
    chest:
      "Lay the top flat and smooth the fabric. Straight across from one armpit seam to the other — don't stretch it.",
    shoulder: "Seam to seam across the back, flat.",
    shortSleeve: "Shoulder seam down to the short-sleeve cuff edge.",
    longSleeve: "Shoulder seam down to the wrist cuff edge.",
    length: "High point of shoulder straight down to the hem.",
    waist: "Buttoned and flat. Across the top of the waistband, edge to edge. Sellers list this flat measure, not the loop.",
    hip: "Flat, about 7in below the waistband, edge to edge.",
    pantsLength: "Top of the waistband to the hem, the way sellers list it.",
    shortsLength: "Top of the waistband to the hem.",
  },
};

// Tape-line geometry: centre point + length + rotation (handoff §3c).
// Paths lifted from Settings Redesign.dc.html — do not redraw.
const TAPE = {
  chest: { x: 75, y: 61, len: 62, r: 0 },
  shoulder: { x: 75, y: 32, len: 46, r: 0 },
  shortSleeve: { x: 122, y: 48, len: 34, r: 55 },
  longSleeve: { x: 31, y: 76, len: 91, r: 114 },
  length: { x: 98, y: 82, len: 112, r: 90 },
  waist: { x: 75, y: 22, len: 74, r: 0 },
  hip: { x: 75, y: 52, len: 70, r: 0 },
  pantsLength: { x: 54, y: 103, len: 142, r: 90 },
  shortsLength: { x: 94, y: 64, len: 64, r: 90 },
};

function emptyDraft() {
  const d = {};
  for (const k of ALL) d[k] = "";
  return d;
}

function draftFromStorage(src, units, source = "body") {
  const d = emptyDraft();
  if (!src || typeof src !== "object") return d;
  const migrated =
    source === "garment" ? migrateSleeveMeasurements({ garment: src }).garment : migrateSleeveMeasurements(src);
  for (const k of ALL) d[k] = measureFromStorage(migrated[k], units, "length");
  return d;
}

function usualFromValue(value) {
  return {
    usualTops: (value && value.usualTops) || "",
    usualBottoms: (value && value.usualBottoms) || "",
    usualShoes: (value && value.usualShoes) || "",
  };
}

function filledCount(draft, keys) {
  return keys.filter((k) => parseFloat(draft[k]) > 0).length;
}

function formatHint(n) {
  if (!isFinite(n) || n <= 0) return "";
  return Math.abs(n - Math.round(n)) < 0.05 ? String(Math.round(n)) : n.toFixed(1);
}

function TopsDiagram() {
  return (
    <svg
      viewBox="0 0 150 148"
      width="150"
      height="148"
      role="img"
      aria-label="Diagram of a top with one short sleeve and one long sleeve, with the tape positions marked"
    >
      <path
        d="M57,29 L43,41 L10,120 L30,127 L47,65 L47,143 L109,143 L109,65 L119,75 L135,59 L99,29 Q78,43 57,29 Z"
        fill="rgba(255,255,255,.06)"
      />
      <path
        d="M54,25 L40,37 L7,116 L27,123 L44,61 L44,139 L106,139 L106,61 L116,71 L132,55 L96,25 Q75,39 54,25 Z"
        fill="var(--cz-card-solid)"
        stroke="var(--cz-hair-strong)"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M54,25 Q75,39 96,25"
        fill="none"
        stroke="var(--cz-hair-strong)"
        strokeWidth="1.4"
      />
      <path
        d="M52,44 L52,133 M98,44 L98,133 M40,37 L27,123"
        fill="none"
        stroke="rgba(255,255,255,.10)"
        strokeWidth="1.2"
      />
    </svg>
  );
}

function BottomsDiagram() {
  return (
    <svg
      viewBox="0 0 150 186"
      width="150"
      height="186"
      role="img"
      aria-label="Diagram of a pair of trousers laid flat, with the tape positions marked"
    >
      <path
        d="M41,20 L115,20 L115,36 L111,178 L83,178 L78,88 L73,178 L45,178 L41,36 Z"
        fill="rgba(255,255,255,.06)"
      />
      <path
        d="M38,16 L112,16 L112,32 L108,174 L80,174 L75,84 L70,174 L42,174 L38,32 Z"
        fill="var(--cz-card-solid)"
        stroke="var(--cz-hair-strong)"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M38,32 L112,32" fill="none" stroke="var(--cz-hair-strong)" strokeWidth="1.4" />
      <path d="M75,34 L75,62" fill="none" stroke="rgba(255,255,255,.14)" strokeWidth="1.2" />
      <path
        d="M56,42 L56,168 M94,42 L94,168"
        fill="none"
        stroke="rgba(255,255,255,.08)"
        strokeWidth="1.2"
      />
    </svg>
  );
}

function TapeLines({ keys, activeKey, labels, onSelect }) {
  return (
    <div className="cz-sizes-tape-layer">
      {keys.map((key) => {
        const t = TAPE[key];
        if (!t) return null;
        const live = key === activeKey;
        return (
          <button
            key={key}
            type="button"
            className={"cz-sizes-tape" + (live ? " is-live" : "")}
            style={{
              left: t.x + "px",
              top: t.y + "px",
              width: t.len + "px",
              transform: "translate(-50%,-50%) rotate(" + t.r + "deg)",
            }}
            title={labels[key]}
            aria-label={"Jump to " + labels[key]}
            onClick={() => onSelect(key)}
          >
            <span className="cz-sizes-tape-bar" aria-hidden="true" />
          </button>
        );
      })}
      <span className="cz-sizes-guide-chip" aria-hidden="true">
        GUIDE ONLY
      </span>
    </div>
  );
}

function buildPayload(bodyDraft, garmentDraft, usual, garmentTop, garmentBottom, mode, units) {
  const out = {};
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
  return out;
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
  const dirty = useRef(false);
  const saveTimer = useRef(null);

  const [mode, setMode] = useState(() =>
    value && (value.measureMode === "body" || value.measureMode === "garment")
      ? value.measureMode
      : "garment"
  );
  const [bodyDraft, setBodyDraft] = useState(() => {
    const d = draftFromStorage(value, units);
    d.height = measureFromStorage(value && value.height, units, "length");
    d.weight = measureFromStorage(value && value.weight, units, "weight");
    return d;
  });
  const [garmentDraft, setGarmentDraft] = useState(() =>
    draftFromStorage(value && value.garment, units, "garment")
  );
  const [usual, setUsual] = useState(() => usualFromValue(value));
  const [garmentTop, setGarmentTop] = useState(() => (value && value.garmentTop) || "");
  const [garmentBottom, setGarmentBottom] = useState(() => (value && value.garmentBottom) || "");
  const [active, setActive] = useState({ tops: "chest", bot: "waist" });
  const [saved, setSaved] = useState(false);

  const draft = mode === "garment" ? garmentDraft : bodyDraft;
  const otherDraft = mode === "garment" ? bodyDraft : garmentDraft;
  const labels = LABELS[mode];
  const how = HOW[mode];
  const unitShort = units === "in" ? "IN" : "CM";
  const weightUnit = units === "in" ? "LB" : "KG";

  const nTops = filledCount(draft, TOPS);
  const nBot = filledCount(draft, BOT);
  const n = nTops + nBot;

  const persist = (next) => {
    if (!onSave) return;
    const payload = buildPayload(
      next.bodyDraft,
      next.garmentDraft,
      next.usual,
      next.garmentTop,
      next.garmentBottom,
      next.mode,
      next.units
    );
    const hasAnything =
      Object.keys(payload).some((k) => k !== "measureMode") ||
      (payload.garment && Object.keys(payload.garment).length > 0);
    onSave(hasAnything ? payload : null);
    setSaved(true);
  };

  const scheduleSave = (patch) => {
    dirty.current = true;
    setSaved(false);
    if (!embedded) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      persist({
        bodyDraft: patch.bodyDraft ?? bodyDraft,
        garmentDraft: patch.garmentDraft ?? garmentDraft,
        usual: patch.usual ?? usual,
        garmentTop: patch.garmentTop ?? garmentTop,
        garmentBottom: patch.garmentBottom ?? garmentBottom,
        mode: patch.mode ?? mode,
        units: patch.units ?? units,
      });
    }, 280);
  };

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  const setMeasure = (key, raw) => {
    const v = String(raw).replace(/[^0-9.]/g, "");
    if (mode === "garment") {
      setGarmentDraft((d) => {
        const next = { ...d, [key]: v };
        scheduleSave({ garmentDraft: next });
        return next;
      });
    } else {
      setBodyDraft((d) => {
        const next = { ...d, [key]: v };
        scheduleSave({ bodyDraft: next });
        return next;
      });
    }
  };

  const setBodyMeta = (key, raw) => {
    const v = String(raw).replace(/[^0-9.]/g, "");
    setBodyDraft((d) => {
      const next = { ...d, [key]: v };
      scheduleSave({ bodyDraft: next });
      return next;
    });
  };

  const focusKey = (key) => {
    const group = TOPS.indexOf(key) >= 0 ? "tops" : "bot";
    setActive((a) => (a[group] === key ? a : { ...a, [group]: key }));
    const el = inputRefs.current[key];
    if (el && typeof el.focus === "function") {
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
    const nextBody = convert(bodyDraft, (k) => (k === "weight" ? "weight" : "length"));
    const nextGarment = convert(garmentDraft, () => "length");
    setBodyDraft(nextBody);
    setGarmentDraft(nextGarment);
    onChangeUnits(next);
    scheduleSave({ bodyDraft: nextBody, garmentDraft: nextGarment, units: next });
  };

  const switchMode = (next) => {
    if (next === mode) return;
    setMode(next);
    scheduleSave({ mode: next });
  };

  const saveManual = () => {
    persist({ bodyDraft, garmentDraft, usual, garmentTop, garmentBottom, mode, units });
    if (!embedded) onClose();
  };

  const otherHint = (key) => {
    const raw = otherDraft[key];
    const nVal = parseFloat(raw);
    if (!isFinite(nVal) || nVal <= 0) return "";
    const tag = mode === "body" ? "garment" : "body";
    return tag + " " + formatHint(nVal);
  };

  const bindRef = (key) => (el) => {
    inputRefs.current[key] = el;
  };

  const fieldRow = (key) => {
    const group = TOPS.indexOf(key) >= 0 ? "tops" : "bot";
    const isActive = active[group] === key;
    const hint = otherHint(key);
    return (
      <label
        key={key}
        className={"cz-sizes-row" + (isActive ? " is-active" : "")}
        htmlFor={baseId + "-" + key}
      >
        <span className="cz-sizes-row-label">{labels[key]}</span>
        {/* Always render so the fixed 4-column grid stays aligned when a row has no cross-mode hint. */}
        <span className="cz-sizes-row-also">{hint || ""}</span>
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
  };

  const groupCard = (group) => {
    const isTops = group === "tops";
    const keys = isTops ? TOPS : BOT;
    const count = isTops ? nTops : nBot;
    const focus = active[isTops ? "tops" : "bot"];
    const howText = how[focus] || how[keys[0]];
    return (
      <div className="cz-sizes-group-card" key={group}>
        <div className="cz-sizes-group-head">
          <span className="cz-sizes-group-label">{isTops ? "TOPS" : "BOTTOMS"}</span>
          <span className="cz-sizes-group-count">
            {count} OF {keys.length}
          </span>
        </div>
        <div className="cz-sizes-group-body">
          <div className="cz-sizes-diagram-col">
            <div
              className={"cz-sizes-diagram" + (isTops ? " is-tops" : " is-bot")}
            >
              {isTops ? <TopsDiagram /> : <BottomsDiagram />}
              <TapeLines
                keys={keys}
                activeKey={focus}
                labels={labels}
                onSelect={focusKey}
              />
            </div>
            {isTops ? (
              <p className="cz-sizes-diagram-hint">
                Tap a line to jump to its box. Credenza never reads the photo.
              </p>
            ) : null}
          </div>
          <div className="cz-sizes-fields">
            {mode === "garment" ? (
              <label className="cz-sizes-which">
                <span className="cz-sizes-which-label">{isTops ? "WHICH TOP" : "WHICH PAIR"}</span>
                <input
                  className="cz-sizes-which-input"
                  type="text"
                  value={isTops ? garmentTop : garmentBottom}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (isTops) {
                      setGarmentTop(v);
                      scheduleSave({ garmentTop: v });
                    } else {
                      setGarmentBottom(v);
                      scheduleSave({ garmentBottom: v });
                    }
                  }}
                  placeholder={isTops ? "Uniqlo U tee · L" : "Dickies 874 · 33"}
                  autoComplete="off"
                />
              </label>
            ) : null}
            <div className="cz-sizes-field-list">{keys.map(fieldRow)}</div>
            <p className="cz-sizes-how-line">{howText}</p>
          </div>
        </div>
      </div>
    );
  };

  const modeBlurb =
    (mode === "garment"
      ? "A piece you already own that fits the way you want, measured flat."
      : "You, with a tape measure.") +
    " Both sets stay saved — the switch never erases the other one.";

  const body = (
    <div className={"cz-sizes" + (embedded ? " is-embedded" : "")}>
      {/* Usual sizes strip */}
      <div className="cz-sizes-usual-strip">
        <span className="cz-sizes-usual-kicker">USUAL SIZES</span>
        <label className="cz-sizes-usual-pill">
          <span>Tops</span>
          <input
            className="cz-sizes-usual-input is-text"
            value={usual.usualTops}
            onChange={(e) => {
              const v = e.target.value;
              setUsual((u) => {
                const next = { ...u, usualTops: v };
                scheduleSave({ usual: next });
                return next;
              });
            }}
            placeholder="—"
            aria-label="Usual tops size"
          />
        </label>
        <label className="cz-sizes-usual-pill">
          <span>Bottoms</span>
          <input
            className="cz-sizes-usual-input is-text"
            value={usual.usualBottoms}
            onChange={(e) => {
              const v = e.target.value;
              setUsual((u) => {
                const next = { ...u, usualBottoms: v };
                scheduleSave({ usual: next });
                return next;
              });
            }}
            placeholder="—"
            aria-label="Usual bottoms size"
          />
        </label>
        <label className="cz-sizes-usual-pill">
          <span>Shoes</span>
          <input
            className="cz-sizes-usual-input is-text"
            value={usual.usualShoes}
            onChange={(e) => {
              const v = e.target.value;
              setUsual((u) => {
                const next = { ...u, usualShoes: v };
                scheduleSave({ usual: next });
                return next;
              });
            }}
            placeholder="—"
            aria-label="Usual shoes size"
          />
        </label>
        <label className="cz-sizes-usual-pill">
          <span>Height</span>
          <input
            className="cz-sizes-usual-input"
            inputMode="decimal"
            value={bodyDraft.height || ""}
            onChange={(e) => setBodyMeta("height", e.target.value)}
            placeholder="—"
            aria-label="Height"
          />
          <em>{unitShort}</em>
        </label>
        <label className="cz-sizes-usual-pill">
          <span>Weight</span>
          <input
            className="cz-sizes-usual-input is-weight"
            inputMode="decimal"
            value={bodyDraft.weight || ""}
            onChange={(e) => setBodyMeta("weight", e.target.value)}
            placeholder="—"
            aria-label="Weight"
          />
          <em>{weightUnit}</em>
        </label>
        <p className="cz-sizes-usual-note">
          Height and weight only feed the ~ estimate when a chart exists and your measurements
          don&apos;t.
        </p>
      </div>

      {/* Measurements header */}
      <div className="cz-sizes-meas-head">
        <div className="cz-sizes-meas-title-row">
          <h3 className="cz-sizes-meas-title">Measurements</h3>
          <span className="cz-sizes-meas-progress">
            {n} OF {ALL.length}
          </span>
        </div>
        <div className="cz-sizes-meas-controls">
          <SegmentedControl
            label="Measurement source"
            value={mode}
            onChange={switchMode}
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
      <p className="cz-sizes-mode-help">{modeBlurb}</p>

      <div className="cz-sizes-groups">{groupCard("tops")}
        {groupCard("bot")}
      </div>

      {/* Modal-only save bar. Embedded settings auto-saves. */}
      {embedded ? null : (
        <div className="cz-sizes-save">
          <span className="cz-sizes-save-hint">
            {saved ? "Saved" : n ? "Unsaved changes" : "Nothing measured yet"}
          </span>
          <div className="cz-sizes-save-actions">
            <Pill subtle onClick={onClose}>
              Cancel
            </Pill>
            <Pill primary onClick={saveManual} style={{ minHeight: 46, placeContent: "center" }}>
              {saved ? "Saved" : "Save measurements"}
            </Pill>
          </div>
        </div>
      )}
    </div>
  );

  if (embedded) return body;
  return (
    <ModalShell title="Your measurements" onClose={onClose} maxWidth={980}>
      {body}
    </ModalShell>
  );
}
