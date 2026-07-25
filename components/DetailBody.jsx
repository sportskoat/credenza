import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronRight } from "lucide-react";
import {
  EditPhotosManager,
  HaulAccordionField,
  StatusChips,
  buildEditDraft,
  buildEditPatch,
  computeRecommendedSize,
  effectiveBodyProfile,
  fitDisplayPrefs,
  fitSummarySentence,
  formatMeasure,
  formatSizeToken,
  itemPhotoList,
  linkButtons,
  parseSizeChart,
  priceLabelShort,
  recommendSize,
  resolveDisplaySize,
  sizeChartTextFor,
  useWriteThroughDraft,
  usePrefersReducedMotion,
} from "../credenza-fashion.jsx";

// The ONE detail body for an item (Kyle 2026-07-25: "all backs of cards need
// to be consistent — like the mobile back"). The phone DetailSheet and the
// desktop carousel card back both render this. Shells differ (dialog vs
// card face); the content never does.
//
// There is no edit mode and no Save button: every value is its own tap
// target, the tap opens exactly one editor, and the edit writes through the
// shared 600ms debounce. The "Saved" chip is the only save feedback.

const SAVED_HOLD_MS = 1400;

// The tap that opened the editor is the focus intent, so the input takes
// focus when it mounts. A callback ref does this without autoFocus, which
// eslint-plugin-jsx-a11y forbids.
const focusOnMount = (el) => {
  if (el) el.focus();
};

// One editor at a time. "size" is special: it opens the fit block, never a
// text field, because the size cell carries the recommendation.
function specCells(item, view, sizeText) {
  return [
    { key: "price", label: "Price", value: priceLabelShort(item) || "—" },
    { key: "size", label: "Size · fit", value: sizeText || "—" },
    { key: "colorway", label: "Colorway", value: view.colorway || "—" },
    {
      key: "weightGrams",
      label: "Weight",
      value: view.weightGrams ? view.weightGrams + " g" : "—",
    },
    { key: "batch", label: "Batch", value: view.batch || "—" },
    { key: "project", label: "Haul", value: view.project || "—" },
  ];
}

// The fit block. It reuses recommendSize / fitSummarySentence unchanged —
// this is presentation only. When there is no profile or no parsed chart it
// shows the chart's own size run instead of inventing a confidence.
function FitBlock({ item, bodyProfile, fitPref, units, onPickSize, onOpenSizes, onDone }) {
  const chart = useMemo(() => parseSizeChart(sizeChartTextFor(item)), [item]);
  // Height+weight estimates fill the tape-measure gaps — flagged estimated
  // so the badge never claims a precise fit it does not have.
  const profile = useMemo(() => effectiveBodyProfile(bodyProfile), [bodyProfile]);
  const rec = chart && profile ? recommendSize(chart, profile, item.category, fitPref) : null;
  const recSize = rec && rec.size ? rec.size : null;
  const precise = !!(recSize && rec.garment != null && rec.body != null) && !(profile && profile.estimated);
  const runValues = chart && Array.isArray(chart.rows) ? chart.rows.map((r) => r.size).filter(Boolean) : [];
  // The fit-summary pref gates the sentence; the detail pref picks its length.
  const { summary: fitSummaryOn, detail: fitDetailMode } = fitDisplayPrefs();
  const why = recSize && fitSummaryOn ? fitSummarySentence(rec, { runHint: chart && chart.runHint, units, detail: fitDetailMode }) : "";

  return (
    <div className="cz-detail-fit">
      <div className="cz-detail-fit-head">
        <span className="cz-detail-fit-kicker">
          {recSize ? "We recommend" : "Size run"}
        </span>
        <span className={"cz-detail-fit-badge" + (precise ? " is-precise" : "")}>
          <span className="cz-detail-fit-badge-dot" aria-hidden="true" />
          {precise ? "Precise fit" : recSize ? "Best guess" : "No recommendation"}
        </span>
      </div>

      {recSize ? (
        <div className="cz-detail-fit-size">{formatSizeToken(recSize) || recSize}</div>
      ) : (
        <p className="cz-detail-fit-empty">
          {bodyProfile
            ? bodyProfile.usualTops || bodyProfile.usualBottoms || bodyProfile.usualShoes || bodyProfile.usualSize
              ? "No size chart on this listing — the card shows your usual size as EST."
              : "No size chart on this listing. Add your usual sizes in My sizes for an estimate."
            : "Set my sizes to get a recommendation."}
        </p>
      )}

      {why ? <p className="cz-detail-fit-why">{why}</p> : null}

      {recSize && rec.garment != null && rec.body != null ? (
        <div className="cz-detail-fit-math" aria-label="Fit numbers">
          <div className="cz-detail-fit-cell">
            <span className="cz-detail-fit-k">You</span>
            <span className="cz-detail-fit-v">
              {profile && profile.estimated ? "~" : ""}
              {formatMeasure(rec.body, units)}
            </span>
          </div>
          <div className="cz-detail-fit-cell">
            <span className="cz-detail-fit-k">Garment</span>
            <span className="cz-detail-fit-v">{formatMeasure(rec.garment, units)}</span>
          </div>
          <div className="cz-detail-fit-cell">
            <span className="cz-detail-fit-k">Ease</span>
            <span className="cz-detail-fit-v is-money">{formatMeasure(rec.diff, units)}</span>
          </div>
        </div>
      ) : null}

      <div className="cz-detail-fit-label">Override</div>
      <div className="cz-detail-fit-chips">
        {runValues.map((size) => (
          <button
            key={size}
            type="button"
            className={
              "cz-detail-fit-chip" +
              (String(item.size || "").toUpperCase() === String(size).toUpperCase() ? " is-active" : "")
            }
            onClick={() => onPickSize(String(size))}
          >
            {formatSizeToken(size) || size}
          </button>
        ))}
        <button type="button" className="cz-detail-fit-chip is-alt" onClick={onOpenSizes}>
          Set my sizes
        </button>
      </div>

      <button type="button" className="cz-detail-editor-done" onClick={onDone}>
        Done
      </button>
    </div>
  );
}

// Shell chrome for the pager. The render prop gets the live pager state and
// returns { actions, overlay }: the buttons go in the top-right span, the
// overlay (the sheet's ⋯ menu) renders as its sibling because .cz-detail-menu
// positions absolutely off .cz-detail-hero, not off the span.
function HeroActionsSlot({ render, photos, photoIdx, resetPager }) {
  const result = render({ photos, photoIdx, resetPager }) || {};
  return (
    <>
      {result.actions ? <span className="cz-detail-hero-actions">{result.actions}</span> : null}
      {result.overlay || null}
    </>
  );
}

export default function DetailBody({
  item,
  haulNames = [],
  bodyProfile,
  fitPrefs,
  measureUnits = "cm",
  buyLabel = "Buy",
  onSaveEdit,
  onOpen,
  onAttachPhoto,
  onRemovePhoto,
  onOpenSizes,
  heroPager = false,
  renderHeroActions = null,
  flushRef = null,
}) {
  const titleInputRef = useRef(null);
  const reduced = usePrefersReducedMotion();

  // The photo pager is part of the shared body — the phone sheet and the
  // desktop card back show the same photos the same way. Shell chrome
  // (close, ⋯ menu) comes in through renderHeroActions; the desktop back
  // passes none because its card header already carries those.
  const [photoIdx, setPhotoIdx] = useState(0);
  const trackRef = useRef(null);
  const photos = heroPager ? itemPhotoList(item, 12) : [];

  // The draft stays null until the first edit. A null draft skips the
  // write-through effect, so opening the surface never fires a phantom save.
  const [draft, setDraft] = useState(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [editingCell, setEditingCell] = useState(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  // The weight editor converts on the fly; weightText is the raw kg string
  // while the kg unit is active so the caret never jumps mid-type.
  const [weightUnit, setWeightUnit] = useState("g");
  const [weightText, setWeightText] = useState("");
  const savedTimer = useRef(null);
  const editorSlotRef = useRef(null);

  const view = draft || buildEditDraft(item);

  const commitRef = useWriteThroughDraft(draft, (d) => {
    onSaveEdit(item.id, buildEditPatch(d, item));
    setSavedFlash(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSavedFlash(false), SAVED_HOLD_MS);
  });

  // The host shell flushes pending edits before it closes.
  useEffect(() => {
    if (flushRef) flushRef.current = () => commitRef.current();
  });

  useEffect(() => () => {
    if (savedTimer.current) clearTimeout(savedTimer.current);
  }, []);

  useEffect(() => {
    if (editingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [editingTitle]);

  // Keep the open editor above the iOS keyboard. The keyboard takes ~300ms
  // to finish opening, and iOS scrolls the input BEFORE it settles, so the
  // editor lands half-covered with the spec cells ghosting behind it (Kyle
  // 2026-07-25: "big overlay... lags over the screen"). Scroll after the
  // settle, and again whenever the visual viewport shrinks.
  useEffect(() => {
    if (!editingCell) {
      // A closed weight editor forgets the unit toggle with it.
      setWeightUnit("g");
      setWeightText("");
      return undefined;
    }
    const el = editorSlotRef.current;
    if (!el || !el.scrollIntoView) return undefined;
    const reveal = () => el.scrollIntoView({ block: "center", behavior: "smooth" });
    const t1 = setTimeout(reveal, 80);
    const t2 = setTimeout(reveal, 380);
    const vv = window.visualViewport;
    if (vv) vv.addEventListener("resize", reveal);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      if (vv) vv.removeEventListener("resize", reveal);
    };
  }, [editingCell]);

  const edit = (key, value) =>
    setDraft((d) => ({ ...(d || buildEditDraft(item)), [key]: value }));

  // Status commits on the tap, not on the debounce. Mirror it into an open
  // draft so a pending write-through cannot put the old status back.
  const pickStatus = (next) => {
    onSaveEdit(item.id, { findStatus: next });
    setDraft((d) => (d ? { ...d, findStatus: next } : d));
    setSavedFlash(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSavedFlash(false), SAVED_HOLD_MS);
  };

  const recSize = computeRecommendedSize(item, bodyProfile, fitPrefs);
  const chosenSize = String(view.size || "").trim();
  const sizeIsRec = !chosenSize && !!recSize;
  const sizeText = chosenSize
    ? formatSizeToken(chosenSize) || chosenSize
    : recSize
      ? formatSizeToken(recSize) || recSize
      : (() => {
          // No chart, no rec: the usual-size EST the card face already shows
          // (Kyle 2026-07-25: the sheet read "—" where the card read an EST).
          const d = resolveDisplaySize(item, bodyProfile, fitPrefs);
          return d.isEstimate && d.size ? (formatSizeToken(d.size) || d.size) + " (EST)" : "";
        })();
  const cells = specCells(item, view, sizeText);
  const buyButtons = linkButtons(item, { buyLabel }).filter((b) => b.role === "buy");
  // ONE primary action: the first buy link only. Two filled twins read as a
  // bug (Kyle 2026-07-25, desktop card back included).
  const buyButton = buyButtons[0] || null;
  const savedDate = item.createdAt
    ? new Date(item.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })
    : "";
  const subLine = [item.seller, savedDate ? "saved " + savedDate : ""].filter(Boolean).join(" · ");
  const fitPref = fitPrefs && item.category ? fitPrefs[item.category] || null : null;
  const knownHauls = Array.from(
    new Set([...(haulNames || []), item.project || ""].map((n) => String(n || "").trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  const editorLabel = (cells.find((c) => c.key === editingCell) || {}).label || "";
  // The price cell displays USD (priceLabelShort) but edits the stored CNY
  // number — name the unit or the customer types dollars into a yuan field
  // (Kyle 2026-07-25: "I change it to 60, it doesn't update").
  const editorLabelFull =
    editingCell === "price"
      ? editorLabel + " · " + (String(view.currency || "CNY").toUpperCase() === "USD" ? "$ USD" : "¥ CNY")
      : editingCell === "weightGrams"
        ? editorLabel + " · " + weightUnit
        : editorLabel;

  // g/kg toggle (Kyle 2026-07-25: "weight should have a g/kg toggle next to
  // Done"). Stored value stays grams; the toggle only changes the display.
  const switchWeightUnit = (next) => {
    if (next === weightUnit) return;
    if (next === "kg") {
      const grams = parseFloat(view.weightGrams);
      setWeightText(Number.isNaN(grams) ? "" : String(+(grams / 1000).toFixed(3)));
    }
    setWeightUnit(next);
  };

  const renderEditor = () => {
    if (!editingCell) return null;
    if (editingCell === "size") {
      return (
        <FitBlock
          item={item}
          bodyProfile={bodyProfile}
          fitPref={fitPref}
          units={measureUnits}
          onPickSize={(size) => {
            edit("size", size);
            setEditingCell(null);
          }}
          onOpenSizes={() => {
            commitRef.current();
            onOpenSizes && onOpenSizes();
          }}
          onDone={() => setEditingCell(null)}
        />
      );
    }
    if (editingCell === "project") {
      return (
        <div className="cz-detail-editor is-block">
          <HaulAccordionField
            label="Haul"
            value={view.project}
            knownHauls={knownHauls}
            onChange={(next) => edit("project", next)}
            onCommit={(next) => {
              edit("project", next);
              setEditingCell(null);
            }}
          />
          <button type="button" className="cz-detail-editor-done" onClick={() => setEditingCell(null)}>
            Done
          </button>
        </div>
      );
    }
    if (editingCell === "colorway" || editingCell === "batch") {
      // Free text with the shared combobox for colorway suggestions is
      // overkill here; a plain 16px input is the whole editor.
      return (
        <div className="cz-detail-editor">
          <span className="cz-detail-editor-label">{editorLabelFull}</span>
          <input
            ref={focusOnMount}
            className="cz-detail-editor-input"
            aria-label={editorLabelFull}
            value={view[editingCell]}
            onChange={(e) => edit(editingCell, e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") setEditingCell(null);
            }}
          />
          <button type="button" className="cz-detail-editor-done" onClick={() => setEditingCell(null)}>
            Done
          </button>
        </div>
      );
    }
    if (editingCell === "weightGrams") {
      return (
        <div className="cz-detail-editor">
          <span className="cz-detail-editor-label">{editorLabelFull}</span>
          <input
            ref={focusOnMount}
            className="cz-detail-editor-input"
            aria-label={editorLabelFull}
            inputMode="decimal"
            value={weightUnit === "kg" ? weightText : view.weightGrams}
            onChange={(e) => {
              const raw = e.target.value;
              if (weightUnit !== "kg") {
                edit("weightGrams", raw);
                return;
              }
              setWeightText(raw);
              const kg = parseFloat(raw);
              edit("weightGrams", raw.trim() === "" || Number.isNaN(kg) ? "" : String(Math.round(kg * 1000)));
            }}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") setEditingCell(null);
            }}
          />
          <div className="cz-detail-unit" role="group" aria-label="Weight unit">
            {["g", "kg"].map((u) => (
              <button
                key={u}
                type="button"
                className={"cz-detail-unit-btn" + (weightUnit === u ? " is-active" : "")}
                aria-pressed={weightUnit === u}
                onClick={() => switchWeightUnit(u)}
              >
                {u}
              </button>
            ))}
          </div>
          <button type="button" className="cz-detail-editor-done" onClick={() => setEditingCell(null)}>
            Done
          </button>
        </div>
      );
    }
    // price: numeric keypad, still 16px so iOS does not zoom.
    return (
      <div className="cz-detail-editor">
        <span className="cz-detail-editor-label">{editorLabelFull}</span>
        <input
          ref={focusOnMount}
          className="cz-detail-editor-input"
          aria-label={editorLabelFull}
          inputMode="decimal"
          value={view[editingCell]}
          onChange={(e) => edit(editingCell, e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") setEditingCell(null);
          }}
        />
        <button type="button" className="cz-detail-editor-done" onClick={() => setEditingCell(null)}>
          Done
        </button>
      </div>
    );
  };

  return (
    <>
      <div className={"cz-detail-scroll" + (editingCell ? " is-editing" : "")}>
        {heroPager ? (
          // Photo pager. The dots track the scroll position — one snap per
          // photo, so a swipe is the only gesture needed.
          <div className="cz-detail-hero">
            <div
              ref={trackRef}
              className="cz-detail-hero-track"
              onScroll={(e) => {
                const el = e.currentTarget;
                const next = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
                if (next !== photoIdx) setPhotoIdx(next);
              }}
            >
              {photos.length ? (
                photos.map((src, i) => (
                  <img key={src + "-" + i} src={src} alt="" loading="lazy" decoding="async" />
                ))
              ) : (
                <div className="cz-detail-hero-empty" />
              )}
            </div>
            {photos.length > 1 ? (
              <span className="cz-detail-dots" aria-hidden="true">
                {photos.map((src, i) => (
                  <span
                    key={"dot-" + src + "-" + i}
                    className={"cz-detail-dot" + (i === photoIdx ? " is-active" : "")}
                  />
                ))}
              </span>
            ) : null}
            {renderHeroActions ? (
              <HeroActionsSlot
                render={renderHeroActions}
                photos={photos}
                photoIdx={photoIdx}
                resetPager={() => {
                  setPhotoIdx(0);
                  if (trackRef.current) trackRef.current.scrollTo({ left: 0 });
                }}
              />
            ) : null}
          </div>
        ) : null}

        {/* Title. The text itself is the tap target — there is no Title
            field and no Save button. Blur commits through the debounce. */}
        <div className="cz-detail-title-row">
          <div className="cz-detail-title-col">
            {editingTitle ? (
              <input
                ref={titleInputRef}
                className="cz-detail-title-input"
                aria-label="Item title"
                value={view.title}
                onChange={(e) => edit("title", e.target.value)}
                onBlur={() => {
                  setEditingTitle(false);
                  commitRef.current();
                }}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Enter") e.currentTarget.blur();
                }}
              />
            ) : (
              <button type="button" className="cz-detail-title-btn" onClick={() => setEditingTitle(true)}>
                <span className="cz-detail-title">{view.title || "Untitled"}</span>
              </button>
            )}
            {subLine ? <div className="cz-detail-sub">{subLine}</div> : null}
          </div>
          {savedFlash ? (
            <span className="cz-detail-saved">
              <Check size={11} strokeWidth={3} aria-hidden="true" />
              Saved
            </span>
          ) : null}
        </div>

        <div className="cz-detail-cells">
          {cells.map((cell) => {
            const isSizeRec = cell.key === "size" && sizeIsRec;
            return (
              <button
                key={cell.key}
                type="button"
                className={
                  "cz-detail-cell" +
                  (editingCell === cell.key ? " is-active" : "") +
                  (isSizeRec ? " is-rec" : "")
                }
                onClick={() => setEditingCell((c) => (c === cell.key ? null : cell.key))}
              >
                <span className="cz-detail-cell-label">
                  {isSizeRec ? <span className="cz-detail-cell-dot" aria-hidden="true" /> : null}
                  {cell.label}
                </span>
                <span className="cz-detail-cell-value">
                  <span
                    className={isSizeRec && !reduced ? "cz-detail-cell-rec t-shimmer" : undefined}
                    data-text={isSizeRec && !reduced ? cell.value : undefined}
                  >
                    {cell.value}
                  </span>
                  {cell.key === "size" ? (
                    <ChevronRight size={13} strokeWidth={2.4} aria-hidden="true" />
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>

        {/* The slot ref lets the keyboard-settle effect find the open
            editor and scroll it clear of the keyboard. */}
        {editingCell ? <div ref={editorSlotRef}>{renderEditor()}</div> : null}

        <div className="cz-detail-label">Status · one tap</div>
        <StatusChips mode="track" value={view.findStatus} onChange={pickStatus} label="Order status" />

        <div className="cz-detail-label-row">
          <span className="cz-detail-label">Notes</span>
          <button type="button" className="cz-detail-more" onClick={() => setNotesOpen((v) => !v)}>
            {notesOpen ? "Less" : "More"}
          </button>
        </div>
        {/* The collapsed box is the same box you type in — no "+" expander
            and no separate read view. */}
        <textarea
          className={"cz-detail-notes" + (notesOpen ? " is-open" : "")}
          aria-label="Notes"
          value={view.note}
          placeholder="Batch, QC notes, what you're pairing it with…"
          onChange={(e) => edit("note", e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
          onFocus={() => setNotesOpen(true)}
        />

        {/* EditPhotosManager carries its own label and its own add tile.
            The wrapper turns its grid into the handoff's 84px strip. */}
        <div className="cz-detail-photos">
          <EditPhotosManager
            item={item}
            onAttachPhoto={onAttachPhoto}
            onRemovePhoto={onRemovePhoto}
          />
        </div>
      </div>

      {buyButton ? (
        <div className="cz-detail-foot">
          <button
            type="button"
            className="cz-detail-buy"
            onClick={() => onOpen(item, buyButton.url)}
          >
            {buyButton.label}
          </button>
          <p className="cz-detail-disclosure">
            Buy links may include a referral code. Credenza may earn a commission on agent
            shipping fees. It never changes your item price.
          </p>
        </div>
      ) : null}
    </>
  );
}
