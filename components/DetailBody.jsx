import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronRight } from "lucide-react";
import PhotoCoverFlow from "./PhotoCoverFlow.jsx";
import {
  EditPhotosManager,
  HaulAccordionField,
  StatusChips,
  buildEditDraft,
  buildEditPatch,
  computeRecommendedSize,
  effectiveBodyProfile,
  fitDisplayPrefs,
  formatMeasure,
  formatSizeToken,
  itemPhotoList,
  linkButtons,
  parseSizeChart,
  prescriptionSentence,
  priceLabelShort,
  recommendSize,
  resolveDisplaySize,
  sizeChartTextFor,
  usualSizeForItem,
  useWriteThroughDraft,
  usePrefersReducedMotion,
  SIZE_PICK_SKIP_CATEGORIES,
} from "../credenza-fashion.jsx";
import { huntSizeChart } from "./size-chart-hunt.js";
import SizeChartTable from "./SizeChartTable.jsx";
import { albumLinkTarget } from "./CardMetaLinks.jsx";
import { CoverPlaceholder } from "./CardCover.jsx";
import { pickSizeRunFromVariants, pickSizeValuesFromVariants } from "../listing-facts.js";

// The ONE detail body for an item (Kyle 2026-07-25: "all backs of cards need
// to be consistent — like the mobile back"). The phone DetailSheet and the
// desktop carousel card back both render this. Shells differ (dialog vs
// card face); the content never does.
//
// There is no edit mode and no Save button: every value is its own tap
// target, the tap opens exactly one editor, and the edit writes through the
// shared 600ms debounce. The "Saved" chip is the only save feedback.

const SAVED_HOLD_MS = 1400;

// One chart hunt per item per session — the vision read costs money, and a
// "no chart found" answer is stable enough for a session (2026-07-25).
const chartHuntTried = new Set();

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

// The size reasoning breakdown (handoff turn 3 §5). Reading order: verdict
// (kicker + Georgia size + confidence chip) → prescription (1-2 plain
// sentences naming the deciding measurement and the next size down) →
// evidence (You/Garment/Ease trio, the fetched chart table with the pick
// inverted, provenance footer + See album) → escape (override chips + Set my
// sizes). With no parsed chart it says so and shows the size run plainly —
// it never invents a pick.
function FitBlock({ item, bodyProfile, fitPref, units, onPickSize, onOpenSizes, onDone, onSaveEdit }) {
  const chart = useMemo(() => parseSizeChart(sizeChartTextFor(item)), [item]);
  // Silent chart hunt (Kyle 2026-07-25: "WHY CAN'T IT WORK WITH RECOMMENDED
  // SIZES" — charts never arrived because the old hunt died with the desktop
  // panel). Opening the fit block with no chart hunts once: Yupoo album
  // text, then a vision read of the album/desc/gallery photos. A found chart
  // writes into sizeNotes (+ its provenance into sizeChartSource), this
  // block recomputes, and the pick appears.
  const [hunting, setHunting] = useState(false);
  useEffect(() => {
    if (chart || SIZE_PICK_SKIP_CATEGORIES.has(item.category)) return;
    if (chartHuntTried.has(item.id)) return;
    let cancelled = false;
    const controller = new AbortController();
    setHunting(true);
    (async () => {
      try {
        const found = await huntSizeChart(item, { signal: controller.signal });
        if (cancelled) return;
        // Mark tried only after a completed (non-aborted) hunt so React
        // Strict Mode / panel remounts can retry instead of sticking on
        // "Looking for the seller's size chart…" forever
        // (Kyle 2026-07-25, chart visible in gallery while fit block spun).
        chartHuntTried.add(item.id);
        // Older hunts returned bare text; the source tag ships with the text now.
        const text = typeof found === "string" ? found : found && found.text;
        if (text) {
          onSaveEdit(item.id, {
            sizeNotes: (item.sizeNotes ? item.sizeNotes.trim() + "\n" : "") + text,
            ...(found && found.source
              ? { sizeChartSource: { ...found.source, at: new Date().toISOString() } }
              : {}),
          });
        }
      } finally {
        if (!cancelled) setHunting(false);
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
      // Clear the spinner on unmount / effect re-run. Do not leave hunting=true
      // after an abort; the next mount will start a fresh hunt if not tried.
      setHunting(false);
    };
  }, [chart, item, onSaveEdit]);

  // Height+weight estimates fill the tape-measure gaps — flagged estimated
  // so the badge never claims a precise fit it does not have.
  const profile = useMemo(() => effectiveBodyProfile(bodyProfile), [bodyProfile]);
  const rec = chart && profile ? recommendSize(chart, profile, item.category, fitPref) : null;
  const recSize = rec && rec.size ? rec.size : null;
  // Body prefs alone never invent a chart pick. When the listing has no
  // parseable chart, surface the customer's usual size for this slot
  // (Kyle 2026-07-25: saving measurements still showed "No recommendation"
  // and promoted the raw S–2XL run as the hero).
  const usualSize = !recSize ? usualSizeForItem(item, bodyProfile) : "";
  // Only an ESTIMATED deciding measurement hedges the pick. A real chest with
  // an estimated waist still earns the money chip on a shirt — the "~" and
  // the badge follow the measurement the pick was read from (rec.primaryKey).
  const decidingEstimated = !!(
    profile &&
    profile.estimated &&
    rec &&
    rec.primaryKey &&
    (!bodyProfile || bodyProfile[rec.primaryKey] == null)
  );
  const precise = !!(recSize && rec.garment != null && rec.body != null) && !decidingEstimated;
  const chartRunValues = chart && Array.isArray(chart.rows) ? chart.rows.map((r) => r.size).filter(Boolean) : [];
  // Listing Size axis (Weidian variants) when no chart text yet — show run chips.
  const variantValues = pickSizeValuesFromVariants(item.variants);
  const variantRun = pickSizeRunFromVariants(item.variants);
  const runValues = chartRunValues.length ? chartRunValues : variantValues;
  const heroSize = recSize || usualSize || null;
  const huntLine = "Looking for the seller's size chart…";
  const badgeLabel = hunting
    ? "Looking for chart"
    : precise
      ? "Read from the seller's chart"
      : recSize
        ? "Best guess"
        : usualSize
          ? "Your usual size"
          : "No recommendation";
  const kickerLabel = recSize ? "We recommend" : usualSize ? "Your usual" : "Size run";
  // The fit-summary pref gates the sentence.
  const { summary: fitSummaryOn } = fitDisplayPrefs();
  const prescription = recSize && fitSummaryOn
    ? prescriptionSentence(chart, rec, { units, category: item.category })
    : "";
  // Provenance footer (turn 3 §5): where the chart came from, when, and a
  // See album link. Items whose chart predates the hunt tag get the plain
  // line — the footer never invents a photo count.
  const albumTarget = albumLinkTarget(item);
  const source = item.sizeChartSource && typeof item.sizeChartSource === "object" ? item.sizeChartSource : null;
  const SOURCE_LINES = {
    "album-text": "Chart read from the seller's album page",
    "album-photos": "Chart read from " + (source ? source.photos : 0) + " album photos",
    "desc-photos": "Chart read from " + (source ? source.photos : 0) + " listing photos",
    "gallery-photos": "Chart read from " + (source ? source.photos : 0) + " gallery photos",
  };
  const sourceLine = source && SOURCE_LINES[source.via]
    ? SOURCE_LINES[source.via] +
      (source.at
        ? " · " + new Date(source.at).toLocaleDateString(undefined, { month: "short", day: "numeric" })
        : "")
    : "Chart from the seller's listing";

  return (
    <div className="cz-detail-fit">
      <div className="cz-detail-fit-head">
        <span className="cz-detail-fit-kicker">{kickerLabel}</span>
        <span
          className={
            "cz-detail-fit-badge" +
            (precise ? " is-precise" : "") +
            (hunting ? " is-hunting" : "")
          }
        >
          <span className="cz-detail-fit-badge-dot" aria-hidden="true" />
          {hunting ? (
            <span className="t-shimmer" data-text={badgeLabel}>
              {badgeLabel}
            </span>
          ) : (
            badgeLabel
          )}
        </span>
      </div>

      {heroSize && !hunting ? (
        <div className="cz-detail-fit-size">{formatSizeToken(heroSize) || heroSize}</div>
      ) : hunting ? (
        <p className="cz-detail-fit-empty is-hunting" aria-live="polite">
          <span className="t-shimmer" data-text={huntLine}>
            {huntLine}
          </span>
        </p>
      ) : (
        <p className="cz-detail-fit-empty">
          {!bodyProfile
            ? "Set my sizes to get a recommendation."
            : "No size chart on this listing. Add your usual tops, bottoms, or shoes in My sizes."}
        </p>
      )}

      {!recSize && !hunting && usualSize && variantRun ? (
        <p className="cz-detail-fit-why">
          Seller run {variantRun}. AI sizing needs the chart photo on this listing.
        </p>
      ) : null}

      {prescription ? <p className="cz-detail-fit-why">{prescription}</p> : null}

      {recSize && rec.garment != null && rec.body != null ? (
        <div className="cz-detail-fit-math" aria-label="Fit numbers">
          <div className="cz-detail-fit-cell">
            <span className="cz-detail-fit-k">You</span>
            <span className="cz-detail-fit-v">
              {decidingEstimated ? "~" : ""}
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

      {chart && recSize ? (
        <div className="cz-detail-fit-chart">
          <SizeChartTable
            chart={chart}
            units={units}
            highlight={recSize}
            highlightAlt={rec && rec.alt ? rec.alt.size : undefined}
          />
          <div className="cz-detail-fit-source">
            {sourceLine}
            {albumTarget ? (
              <>
                {" · "}
                <a
                  href={albumTarget.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="cz-detail-fit-album"
                >
                  See album
                </a>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="cz-detail-fit-label">Override</div>
      <div className="cz-detail-fit-chips">
        {chipSizes(runValues, heroSize || item.size).map((size) => (
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

// The OVERRIDE row shows the sizes adjacent to the pick (handoff turn 3 §5).
// A run of six or fewer fits as-is; a longer run windows ±2 around the
// recommended (or chosen) size so the chips stay one scannable row.
function chipSizes(runValues, anchor) {
  const MAX = 6;
  if (!Array.isArray(runValues) || runValues.length <= MAX) return runValues || [];
  const idx = runValues.findIndex(
    (s) => String(s).toUpperCase() === String(anchor || "").toUpperCase()
  );
  const start = Math.min(Math.max(0, (idx < 0 ? 0 : idx) - 2), runValues.length - MAX);
  return runValues.slice(start, start + MAX);
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
  onSetPrimaryImage = null,
  onLoadPhotos = null,
  heroPager = false,
  renderHeroActions = null,
  flushRef = null,
  // Fix B (handoff turn 4): the desktop two-column panel puts the price in
  // the pinned footer next to Buy. Null everywhere else — the phone sheet
  // and the flip-card back keep the full-width Buy.
  footerPrice = null,
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

  // Full-screen album (restored 2026-07-25, Kyle: "the old photos where you
  // could swipe through each photo... it was so good"). A tap on the hero
  // photo opens it at that photo; its "Use as cover" is the same explicit
  // cover path as the hero action. photoView = { startIndex } | null.
  const [photoView, setPhotoView] = useState(null);

  const resetPager = () => {
    setPhotoIdx(0);
    if (trackRef.current) trackRef.current.scrollTo({ left: 0 });
  };

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
          // No chart, no rec: the usual-size fallback the card face shows as
          // YOUR USUAL (handoff turn 3 §4 — "(EST)" is retired; the label
          // says who decided, and the breakdown one tap away explains it).
          const d = resolveDisplaySize(item, bodyProfile, fitPrefs);
          if (d.isEstimate && d.size) return d.value || formatSizeToken(d.size) || d.size;
          // Listing Size axis when nothing else — show S–XL, never invent a pick.
          return pickSizeRunFromVariants(item.variants) || "";
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
          onSaveEdit={onSaveEdit}
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
                  // The photo itself is the gallery trigger (Kyle 2026-07-25:
                  // "click on the photo to have that old scroll through
                  // carousel"). A swipe still pages — a moved touch cancels
                  // the click, a still tap opens the album.
                  <button
                    key={src + "-" + i}
                    type="button"
                    className="cz-detail-hero-slide"
                    aria-label={"Open photo " + (i + 1) + " full screen"}
                    onClick={() => setPhotoView({ startIndex: i })}
                  >
                    <img src={src} alt="" draggable={false} loading="lazy" decoding="async" />
                  </button>
                ))
              ) : (
                // Photo-less items get the grid's brand tile — a blank box
                // reads as a broken image (Kyle 2026-07-25).
                <div className="cz-detail-hero-empty">
                  <CoverPlaceholder
                    item={item}
                    aspectRatio="auto"
                    style={{ width: "100%", height: "100%" }}
                  />
                </div>
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
                resetPager={resetPager}
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
            and no separate read view. The wrapper animates the open height
            (grid rows, not a height transition on the textarea). */}
        <div className={"cz-detail-notes-wrap" + (notesOpen ? " is-open" : "")}>
          <textarea
            className="cz-detail-notes"
            aria-label="Notes"
            value={view.note}
            placeholder="Batch, QC notes, what you're pairing it with…"
            onChange={(e) => edit("note", e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            onFocus={() => setNotesOpen(true)}
          />
        </div>

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
        <div className={"cz-detail-foot" + (footerPrice ? " has-price" : "")}>
          {footerPrice ? (
            <div className="cz-detail-foot-row">
              <span className="cz-detail-foot-price">{footerPrice}</span>
              <button
                type="button"
                className="cz-detail-buy"
                onClick={() => onOpen(item, buyButton.url)}
              >
                {buyButton.label}
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="cz-detail-buy"
              onClick={() => onOpen(item, buyButton.url)}
            >
              {buyButton.label}
            </button>
          )}
          <p className="cz-detail-disclosure">
            Buy links may include a referral code. Credenza may earn a commission on agent
            shipping fees. It never changes your item price.
          </p>
        </div>
      ) : null}
      {photoView ? (
        <PhotoCoverFlow
          item={item}
          images={photos}
          startIndex={photoView.startIndex}
          onClose={() => setPhotoView(null)}
          onSetPrimaryImage={(id, src) => {
            if (onSetPrimaryImage) onSetPrimaryImage(id, src);
            resetPager();
          }}
          onLoadPhotos={onLoadPhotos}
        />
      ) : null}
    </>
  );
}
