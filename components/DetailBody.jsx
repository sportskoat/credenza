import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Camera, Check, ChevronDown, ChevronRight, Maximize2, Minimize2, Upload, X } from "lucide-react";
import { listAgents } from "../agents.js";
import PhotoCoverFlow from "./PhotoCoverFlow.jsx";
import {
  EditPhotosManager,
  HaulAccordionField,
  StatusChips,
  buildEditDraft,
  buildEditPatch,
  CATEGORIES,
  computeRecommendedSize,
  effectiveBodyProfile,
  chartCacheForSeller,
  fetchChartFromPhotos,
  readChartFromPhotoFiles,
  serializeSizeChart,
  FIT_PREF_AXES,
  fitDisplayPrefs,
  fitPrefHasChoice,
  fitPrefLabel,
  fitReadRows,
  formatMeasure,
  formatSizeToken,
  itemPhotoList,
  DETAIL_PHOTO_CAP,
  linkButtons,
  measureFromStorage,
  measureToStorage,
  parseSizeChart,
  prescriptionSentence,
  itemUsdAmount,
  itemCnyAmount,
  priceLabelShort,
  pricePrimaryPref,
  recommendSize,
  resolveDisplaySize,
  sellerStoreUrl,
  sizeChartTextFor,
  usualSizeForItem,
  useWriteThroughDraft,
  usePrefersReducedMotion,
  SIZE_PICK_SKIP_CATEGORIES,
} from "../credenza-fashion.jsx";
import { normalizeFindStatus } from "../credenza-find-status.js";
import { fitMeasureFieldsFor, FitPrefAxis } from "./SizeRecommendation.jsx";
import { huntSizeChart } from "./size-chart-hunt.js";
import { AlbumLinksRow } from "./CardMetaLinks.jsx";
import { CoverPlaceholder } from "./CardCover.jsx";
import { pickSizeRunFromVariants, pickSizeValuesFromVariants } from "../listing-facts.js";

// The ONE detail body for an item (Kyle 2026-07-25: "all backs of cards need
// to be consistent — like the mobile back"). The phone DetailSheet and the
// desktop carousel card back both render this. Shells differ (dialog vs
// card face); the content never does.
//
// There is no edit mode or Save button. Tabs expose the editable facts.
// Draft edits use the shared 600ms write-through path.

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

// Silent chart hunt (Kyle 2026-07-25: "WHY CAN'T IT WORK WITH RECOMMENDED
// SIZES" — charts never arrived because the old hunt died with the desktop
// panel). With no chart, hunt once: Yupoo album text, then a vision read of
// the album/desc/gallery photos. A found chart writes into sizeNotes (+ its
// provenance into sizeChartSource) and the pick appears.
//
// The sizing block is always visible, so the hunt starts when the detail opens.
// One component owns the hook because two callers would start two paid reads.
// `enabled` lets callers disable the hook without calling it conditionally.
//
// Turn 9 §3 adds one step BEFORE the network: the seller cache. A chart read
// once for a seller sizes every later item from that seller with no call at
// all, which is the whole point of "the next item from that seller sizes
// instantly". It costs a walk of the shelf against a network round trip.
function useChartHunt(item, chart, onSaveEdit, enabled = true, shelfItems = null) {
  const [hunting, setHunting] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    if (chart || SIZE_PICK_SKIP_CATEGORIES.has(item.category)) return;
    if (chartHuntTried.has(item.id)) return;
    // Seller cache first. It is free, and a chart the customer already accepted
    // for this seller beats anything a fresh vision read would guess.
    if (shelfItems && shelfItems.length) {
      const cached = chartCacheForSeller(shelfItems, item);
      if (cached) {
        chartHuntTried.add(item.id);
        onSaveEdit(item.id, {
          sizeNotes: (item.sizeNotes ? item.sizeNotes.trim() + "\n" : "") + cached.text,
          sizeChartSource: {
            via: "seller-cache",
            photos: 0,
            at: new Date().toISOString(),
            seller: cached.seller || item.seller || "",
          },
        });
        return;
      }
    }
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
  }, [enabled, chart, item, onSaveEdit, shelfItems]);
  return hunting;
}

// One source of truth keeps the sizing verdict consistent across each view.
function useSizeVerdict(item, bodyProfile, fitPref, units, detailOverride = null, summaryOverride = null) {
  const chart = useMemo(() => parseSizeChart(sizeChartTextFor(item)), [item]);
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
  const chartRunValues =
    chart && Array.isArray(chart.rows) ? chart.rows.map((r) => r.size).filter(Boolean) : [];
  // Listing Size axis (Weidian variants) when no chart text yet — show run chips.
  const variantValues = pickSizeValuesFromVariants(item.variants);
  const variantRun = pickSizeRunFromVariants(item.variants);
  const runValues = chartRunValues.length ? chartRunValues : variantValues;
  // The fit-summary pref gates the sentence; the detail pref sets its length
  // (CH-14 — FIT_DETAIL had no effect on this path before). The props win
  // over the mirror: the App syncs the mirror in an effect, so on the render
  // right after a toggle only the props are fresh.
  const { summary: mirrorSummary, detail: mirrorDetail } = fitDisplayPrefs();
  const fitSummaryOn = summaryOverride !== null ? summaryOverride : mirrorSummary;
  const fitDetail = detailOverride || mirrorDetail;
  const prescription =
    recSize && fitSummaryOn
      ? prescriptionSentence(chart, rec, { units, category: item.category, detail: fitDetail })
      : "";
  return {
    chart,
    rec,
    recSize,
    usualSize,
    decidingEstimated,
    precise,
    runValues,
    variantRun,
    prescription,
  };
}

// ── Timeline (handoff turn 9 §6) ──
//
// "It is generated from existing events — no new user input." Nothing here
// asks the customer for anything; every row is read off fields the item
// already carries. That is the point: the space the six-cell grid wasted now
// answers "what has happened to this item", which the app already knows.
//
// Rows, oldest first: clipped (+ price), sized (+ where the size came from),
// added to a haul. The next ACTION is not a row — §5's pill owns that, and
// duplicating it would give one action two controls.
//
// Dates are absolute and short (JUL 18). Relative dates ("2 days ago") go
// stale in a stored item and would need a re-render to stay true.
function buildTimeline(item, sizeText, sizeFrom) {
  const rows = [];
  const stamp = (ms) => {
    const d = new Date(ms);
    if (isNaN(d.getTime())) return "";
    return d
      .toLocaleDateString(undefined, { month: "short", day: "numeric" })
      .toUpperCase();
  };

  if (item.createdAt) {
    const price = priceLabelShort(item);
    rows.push({
      key: "clipped",
      date: stamp(item.createdAt),
      // The seller name is the useful half of "clipped from" — a bare host
      // ("photo.yupoo.com") tells the customer nothing they did not see.
      text: "Clipped" + (item.seller ? " from " + item.seller : "") + (price ? " · " + price : ""),
    });
  }

  // The size row only earns its place once a size exists. "Sized —" is the
  // em-dash problem §1 just removed from the chip row.
  if (sizeText) {
    rows.push({
      key: "sized",
      date: stamp(item.updatedAt || item.createdAt),
      text: "Sized",
      strong: sizeText,
      tail: sizeFrom ? " " + sizeFrom : "",
    });
  }

  if (item.project) {
    rows.push({
      key: "hauled",
      date: stamp(item.updatedAt || item.createdAt),
      text: "Added to",
      strong: item.project,
      tail: " haul",
    });
  }

  return rows;
}

function Timeline({ rows }) {
  if (!rows.length) return null;
  return (
    <ol className="cz-timeline">
      {rows.map((row) => (
        <li key={row.key} className="cz-timeline-row">
          <span className="cz-timeline-date">{row.date}</span>
          <span className="cz-timeline-text">
            {row.text}
            {row.strong ? <strong> {row.strong}</strong> : null}
            {row.tail || ""}
          </span>
        </li>
      ))}
    </ol>
  );
}

// ── Sizing block (handoff turn 9 §2) — "the flagship" ──
//
// Sizing used to be one of six equal spec cells, so the single field with a
// REASON attached read like metadata, and you had to tap it to learn anything.
// It is now its own always-visible card, directly under the chip row.
//
// Rows, in the handoff's order:
//   1. header      — dot + AI SIZE + right-aligned provenance
//   2. value       — Georgia, shimmered while it is the AI pick
//   3. prescription— names the real numbers (pit-to-pit, ease)
//   4. chart row   — one cell per size, the pick inverted
//   5. footer      — override chips + Full chart
//
// States: `ai` (shimmer on), `manual` (header YOUR PICK, flat ink, no
// shimmer), and no-chart (§3, rendered by SizingBlockNoChart below).
//
// The parent owns the chart hunt and passes its current result into this block.
function SizingBlock({
  chart,
  rec,
  recSize,
  usualSize,
  chosenSize,
  precise,
  hunting,
  units,
  reduced,
  // Round 5 point 5.1 (2026-07-29): the measurement cells ARE the size
  // picker now — one row, not a chart row plus a second plain chip row
  // below it. A caller that already computed the rows may hand them in;
  // otherwise the block derives them from the chart itself (see below).
  cells: cellsProp,
  measureKey: measureKeyProp,
  onPick,
  // §3: names the seller whose cached chart sized this item. Null on every
  // other path, and the provenance falls back to SELLER'S CHART.
  cachedFrom = "",
}) {
  const isManual = !!chosenSize;
  const heroSize = chosenSize || recSize || usualSize || "";
  const heroLabel = formatSizeToken(heroSize) || heroSize;

  // Split-rail: the sheen marks a pick that came off a real chart. A manual
  // pick, a best guess, and a read in flight all render still.
  const sheen = precise && !isManual && !hunting;

  // Provenance, right-aligned in the header. Mono, uppercase, and short —
  // the phone gets the trimmed form via CSS, not a second string. Round 5
  // point 5.1: "SET BY YOU" is gone — the aside beside the size word is the
  // one place a hand pick names itself.
  const provenance = hunting
    ? "READING CHART"
    : precise
      ? cachedFrom
        ? "FROM " + String(cachedFrom).toUpperCase() + "'S CHART (CACHED)"
        : "SELLER'S CHART"
      : recSize
        ? "BEST GUESS"
        : isManual
          ? ""
          : "YOUR USUAL";

  // "your usual is L too" — only worth saying when the AI pick and the
  // customer's usual size agree. Silent otherwise; a disagreement is the
  // prescription's job to explain, not a subtitle's. Round 5 point 5.1: a
  // hand pick names itself here and nowhere else.
  const aside =
    !isManual && recSize && usualSize && String(recSize).toUpperCase() === String(usualSize).toUpperCase()
      ? "your usual too"
      : isManual
        ? "you picked this"
        : "";

  // 2026-07-29: the size row derives from the chart when the caller hands in
  // nothing. Without this fallback the row renders empty on every current
  // caller, because none of them pass `cells` yet. `rec.primaryKey` names the
  // measure the recommendation was actually read from.
  const measureKey = measureKeyProp || (rec && rec.primaryKey ? rec.primaryKey : "chest");
  const cells =
    cellsProp ||
    (chart && Array.isArray(chart.rows)
      ? chart.rows.filter((r) => r.size && r[measureKey] != null).slice(0, 6)
      : []);

  return (
    <section className={"cz-sizing" + (isManual ? " is-manual" : "")} aria-label="Sizing">
      <div className="cz-sizing-head">
        <span className="cz-sizing-dot" aria-hidden="true" />
        <span className="cz-sizing-kicker">{isManual ? "Your pick" : "AI size"}</span>
        {provenance ? <span className="cz-sizing-prov">{provenance}</span> : null}
      </div>

      <div className={"cz-sizing-value-row" + (sheen ? " has-sheen" : "")}>
        {sheen ? <span className="cz-sizing-sheen" aria-hidden="true" /> : null}
        {heroLabel ? (
          <span
            className={
              "cz-sizing-value" + (!isManual && !reduced && recSize ? " t-shimmer" : "")
            }
            data-text={!isManual && !reduced && recSize ? heroLabel : undefined}
          >
            {heroLabel}
          </span>
        ) : (
          <span className="cz-sizing-value is-empty">—</span>
        )}
        {aside ? <span className="cz-sizing-aside">{aside}</span> : null}
      </div>

      {/* Round 5 point 5.1: the measurement cells double as the size picker.
          One row does both jobs — before, a second plain chip row under it
          offered the same sizes again. Tap the picked cell to clear the
          pick. */}
      {cells.length ? (
        <div className="cz-sizing-chart" role="group" aria-label="Item size choices">
          {cells.map((row) => {
            const picked =
              String(row.size).toUpperCase() === String(heroSize).toUpperCase();
            return (
              <button
                key={row.size}
                type="button"
                className={"cz-sizing-cell" + (picked ? " is-pick" : "")}
                aria-pressed={isManual && picked}
                onClick={() =>
                  onPick && onPick(isManual && picked ? "" : String(row.size))
                }
              >
                <span className="cz-sizing-cell-k">{formatSizeToken(row.size) || row.size}</span>
                <span className="cz-sizing-cell-v">{formatMeasure(row[measureKey], units)}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

// The customer's own chart read (handoff turn 9 §3). Separate from useChartHunt
// because the hunt is automatic and silent, and this one is a deliberate act
// with a result the customer confirms before it lands.
//
// The read STAGES its chart; it does not commit. A vision read of a photo the
// customer aimed themselves is the most likely of all the reads to be right,
// and also the only one they can check against the thing in their hand. So the
// preview exists, and `commit` is a separate call.
function useCustomerChartRead(item, onSaveEdit) {
  // `count` is how many photos the open read was handed — the fit-read
  // footnote says "Reading four photos…" and a hard-coded four would lie
  // about a single upload.
  const [state, setState] = useState({ reading: false, chart: null, text: "", thumb: "", error: "", dirty: false, count: 0 });
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  // A different item means a stale preview. Drop it rather than offer someone
  // else's chart on this card.
  useEffect(() => {
    setState({ reading: false, chart: null, text: "", thumb: "", error: "", dirty: false });
  }, [item.id]);

  const read = async (sources, { thumb = "", referer = "" } = {}) => {
    const list = Array.isArray(sources) ? sources : [sources];
    setState({ reading: true, chart: null, text: "", thumb, error: "", dirty: false, count: list.length });
    // Remote album photos go down the images door (the server fetches them
    // through its allowlist); files and data: URLs go inline. Never both.
    const remote = list.filter((s) => typeof s === "string" && /^https?:\/\//i.test(s));
    const text = remote.length
      ? await fetchChartFromPhotos(remote, { referer: referer || item.url || undefined })
      : await readChartFromPhotoFiles(list, { referer: referer || item.url || undefined });
    if (!alive.current) return;
    const chart = text ? parseSizeChart(text) : null;
    if (!chart) {
      setState({
        reading: false,
        chart: null,
        text: "",
        thumb,
        dirty: false,
        error: text
          ? "I read the photo but could not find sizes in it. Try a straighter shot of the table."
          : "I could not read that photo. Try again with the whole table in frame.",
      });
      return;
    }
    setState({ reading: false, chart, text, thumb, error: "", dirty: false });
  };

  const commit = () => {
    if (!state.text) return;
    // Corrections live on the staged chart, so the text comes from IT and not
    // from the raw read. Fall back to the read when nothing was corrected, or
    // when a correction emptied the chart past the point of serializing.
    const fixed = state.dirty ? serializeSizeChart(state.chart) : "";
    const text = fixed && parseSizeChart(fixed) ? fixed : state.text;
    onSaveEdit(item.id, {
      sizeNotes: (item.sizeNotes ? item.sizeNotes.trim() + "\n" : "") + text,
      sizeChartSource: {
        via: "customer-photo",
        photos: 1,
        at: new Date().toISOString(),
        ...(item.seller ? { seller: String(item.seller).slice(0, 60) } : {}),
      },
    });
    setState({ reading: false, chart: null, text: "", thumb: "", error: "", dirty: false });
  };

  const dismiss = () => setState({ reading: false, chart: null, text: "", thumb: "", error: "", dirty: false });

  // A corrected cell rewrites the staged chart. It does NOT re-parse: a
  // half-typed "1" is under the parser's 20cm floor, so a round trip per
  // keystroke would blank the cell under the customer's fingers. The text is
  // regenerated once, at commit.
  const fix = (nextChart) => {
    setState((prev) => ({ ...prev, chart: nextChart, dirty: true, error: "" }));
  };

  return { ...state, read, commit, dismiss, fix };
}

// The no-chart state keeps the usual size visible but unverified.
// The Size panel owns the single chart upload action.
// Round 4 point 7: a failed album thumb draws a plain dark tile, never the
// browser's broken-image mark. Per photo URL, so one bad photo does not hide
// the good ones.
function AlbumThumb({ src }) {
  const [bad, setBad] = useState(false);
  return bad ? (
    <span className="cz-sizing-albumthumb cz-photo-tile-missing" aria-hidden="true" />
  ) : (
    <img
      className="cz-sizing-albumthumb"
      src={src}
      alt=""
      loading="lazy"
      onError={() => setBad(true)}
    />
  );
}

function SizingBlockNoChart({ usualSize, isManual = false, albumPhotos, albumCount, onOpenAlbum }) {
  const heroLabel = formatSizeToken(usualSize) || usualSize || "";
  const thumbs = (albumPhotos || []).slice(0, 2);

  return (
    <section className="cz-sizing cz-sizing-nochart" aria-label="Sizing recommendation">
      <div className="cz-sizing-head">
        <span className="cz-sizing-dot" aria-hidden="true" />
        <span className="cz-sizing-kicker">No chart</span>
        {/* Round 5 point 5.1: one notice for a hand pick — "you picked this"
            beside the size word. The "SET BY YOU" label here was a second
            copy, so a hand pick now leaves the provenance slot empty. */}
        {isManual ? null : <span className="cz-sizing-prov">FELL BACK TO YOUR USUAL</span>}
      </div>

      <div className="cz-sizing-value-row">
        {heroLabel ? (
          <>
            <span className="cz-sizing-value">{heroLabel}</span>
            <span className="cz-sizing-aside">
              {isManual ? "you picked this · not verified" : "your usual · not verified"}
            </span>
          </>
        ) : (
          <>
            <span className="cz-sizing-value is-empty">—</span>
            <span className="cz-sizing-aside">no usual size saved</span>
          </>
        )}
      </div>

      <p className="cz-sizing-nochart-body">
        The listing had no measurements. Upload the seller chart to read its measurements.
      </p>

      {albumCount ? (
        <button type="button" className="cz-sizing-albumrow" onClick={onOpenAlbum}>
          <span className="cz-sizing-albumthumbs" aria-hidden="true">
            {thumbs.map((src, i) => (
              <AlbumThumb key={src + i} src={src} />
            ))}
          </span>
          <span className="cz-sizing-albumtext">
            {/* Command-bar handoff §7.5 / §14 (2026-07-29): the final copy is
                "Read the N album photos". Round 5.2 had briefly renamed this to
                "seller photos", which no longer matches the spec's copy deck. */}
            Read the {albumCount} album photo{albumCount === 1 ? "" : "s"}
          </span>
          <ChevronRight size={14} strokeWidth={2.4} aria-hidden="true" />
        </button>
      ) : null}
    </section>
  );
}

// ── Fit read table (split-rail handoff 2026-07-28) ──
//
// Per-measurement fit bars under the pick: how far each garment measure sits
// from the body on a tight↔loose track, with a fixed 36–66% tolerance band.
// With no chart the table ghosts — names in placeholder, YOURS kept, no
// tracks' band or marks — so the customer sees what a chart would unlock.
// Row math lives in fitReadRows (pure, tested on its own).
function FitReadTable({ rows, hasChart, units, reading, readingCount, onEditMeasures, onForgetChart }) {
  if (!rows.length) return null;
  const insideCount = rows.filter((r) => r.mark != null && !r.warn).length;
  const scoredCount = rows.filter((r) => r.mark != null).length;
  // Copy deck: "All four inside tolerance." — the count is spelled out.
  const COUNT_WORDS = ["", "one", "two", "three", "four", "five", "six", "seven"];
  const word = (n) => COUNT_WORDS[n] || String(n);
  const footnote = reading
    ? "Reading " +
      (readingCount === 1 ? "one photo" : word(readingCount || 0) + " photos") +
      "…"
    : !hasChart
    ? "Your measurements, waiting on theirs."
    : scoredCount === 0
      ? "Waiting on your measurements."
      : scoredCount === 1
        ? insideCount === 1
          ? "Inside tolerance."
          : "Outside tolerance."
        : insideCount === scoredCount
          ? "All " + word(scoredCount) + " inside tolerance."
          : word(insideCount).replace(/^./, (c) => c.toUpperCase()) +
            " of " +
            word(scoredCount) +
            " inside tolerance.";
  return (
    <div
      className={
        "cz-fitread" + (hasChart ? "" : " is-ghost") + (reading ? " is-reading" : "")
      }
    >
      <div className="cz-fitread-row cz-fitread-heads" aria-hidden="true">
        <span className="cz-fitread-kicker">FIT READ</span>
        {hasChart ? (
          <span className="cz-fitread-scale">
            <span>TIGHT</span>
            <span>TRUE</span>
            <span>LOOSE</span>
          </span>
        ) : (
          <span />
        )}
        {/* Phone heads shorten to THRS / YOU (spec) — a CSS toggle, so the
            grid never has to fit six letters over a 30px column. */}
        <span className="cz-fitread-head">
          <span className="cz-fitread-head-long">THEIRS</span>
          <span className="cz-fitread-head-short">THRS</span>
        </span>
        <span className="cz-fitread-head">
          <span className="cz-fitread-head-long">YOURS</span>
          <span className="cz-fitread-head-short">YOU</span>
        </span>
        <span className="cz-fitread-head">EASE</span>
      </div>
      {rows.map((r) => (
        <div key={r.key} className="cz-fitread-row">
          <span className="cz-fitread-name">{r.name}</span>
          <span className="cz-fitread-track">
            {hasChart ? <span className="cz-fitread-band" /> : null}
            {r.mark != null ? (
              <span
                className={"cz-fitread-mark" + (r.warn ? " is-warn" : "")}
                style={{ left: r.mark + "%" }}
              />
            ) : null}
          </span>
          <span className={"cz-fitread-theirs" + (r.theirs == null ? " is-unknown" : "")}>
            {r.theirs != null ? formatMeasure(r.theirs, units) : "—"}
          </span>
          <span className="cz-fitread-yours">
            {r.yours != null ? formatMeasure(r.yours, units) : "—"}
          </span>
          <span className={"cz-fitread-ease" + (r.warn ? " is-warn" : "")}>
            {r.ease != null ? (r.ease >= 0 ? "+" : "") + formatMeasure(r.ease, units) : ""}
          </span>
        </div>
      ))}
      <div className="cz-fitread-foot">
        <span className="cz-fitread-footnote">{footnote}</span>
        <span className="cz-fitread-footlinks">
          {onEditMeasures ? (
            <button type="button" className="cz-fitread-footlink" onClick={onEditMeasures}>
              Edit my measurements
            </button>
          ) : null}
          {hasChart && onForgetChart ? (
            <button type="button" className="cz-fitread-footlink" onClick={onForgetChart}>
              Forget this chart
            </button>
          ) : null}
        </span>
      </div>
    </div>
  );
}

// ── Reading / read-back state (handoff turn 9 §3, "Parsing state") ──
//
// Shown while the customer's photo is in the vision read, and again with the
// result before it lands. The provenance slot counts what came back —
// `4 ROWS · 3 COLUMNS` — because a count is the fastest way to see the read
// went wrong: one row means it caught a caption, not a table.
//
// The scan line rides the source thumb while the read is open. It is decoration
// with a job: it says the photo is the thing being worked on, not an attachment.
function SizingBlockReading({ reading, chart, thumb, error, units, onUse, onRetry, onFix }) {
  // "Fix a number" (spec §3): the vision read gets a digit wrong often enough
  // that a chart with one bad cell must be salvageable. Without this the only
  // options are accept a wrong chart or throw the whole read away.
  const [fixing, setFixing] = useState(false);
  const rows = chart && Array.isArray(chart.rows) ? chart.rows : [];
  // The measurement keys the parser actually filled, in the order the table had
  // them. `size` is the row label, not a measurement.
  const columns = rows.length
    ? Object.keys(rows[0]).filter((k) => k !== "size" && rows[0][k] != null)
    : [];
  const provenance = reading
    ? "READING…"
    : chart
      ? rows.length + " ROW" + (rows.length === 1 ? "" : "S") + " · " +
        columns.length + " COLUMN" + (columns.length === 1 ? "" : "S")
      : "COULD NOT READ";
  const preview = rows.slice(0, 6);
  const key = columns[0] || "chest";
  // A new read replaces the cells, so the editor must close. Watch `reading`,
  // not `chart`: `chart` changes on every corrected keystroke, and closing on
  // that would eject the customer after one digit.
  useEffect(() => {
    if (reading) setFixing(false);
  }, [reading]);

  return (
    <section
      className={"cz-sizing cz-sizing-reading" + (error ? " is-error" : "")}
      aria-label="Sizing"
      aria-busy={reading || undefined}
    >
      <div className="cz-sizing-head">
        <span className="cz-sizing-dot" aria-hidden="true" />
        <span className="cz-sizing-kicker">{error ? "No chart" : "Reading chart"}</span>
        <span className="cz-sizing-prov">{provenance}</span>
      </div>

      <div className="cz-sizing-read-row">
        {thumb ? (
          <span className={"cz-sizing-read-thumb" + (reading ? " is-scanning" : "")}>
            <img src={thumb} alt="" />
          </span>
        ) : null}
        <p className="cz-sizing-read-text">
          {reading
            ? "Reading the numbers off your photo…"
            : error
              ? error
              : columns.length
                ? "I found " + listPhrase(columns.map(measureWord)) + " for " +
                  rows.length + " size" + (rows.length === 1 ? "" : "s") + "."
                : "I read the table but could not name its columns."}
        </p>
      </div>

      {fixing && chart ? (
        <ChartFixGrid rows={rows} columns={columns} units={units} onFix={onFix} />
      ) : preview.length ? (
        <div className="cz-sizing-chart" aria-hidden="true">
          {preview.map((row) => (
            <span key={row.size} className="cz-sizing-cell">
              <span className="cz-sizing-cell-k">{formatSizeToken(row.size) || row.size}</span>
              <span className="cz-sizing-cell-v">{formatMeasure(row[key], units)}</span>
            </span>
          ))}
        </div>
      ) : null}

      {!reading ? (
        <div className="cz-sizing-actions">
          {chart ? (
            <button type="button" className="cz-sizing-action is-primary" onClick={onUse}>
              Use this chart
            </button>
          ) : null}
          <button
            type="button"
            className="cz-sizing-read-retry"
            onClick={chart ? () => setFixing((v) => !v) : onRetry}
          >
            {chart ? (fixing ? "Done fixing" : "Fix a number") : "Try another photo"}
          </button>
          {/* Rejecting the whole read still needs a way out, and it must not be
              the same button as the per-cell fix. */}
          {chart ? (
            <button type="button" className="cz-sizing-read-retry is-wide" onClick={onRetry}>
              Not this one
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

// Per-cell numeric editor for a read chart (handoff turn 9 §3, "Fix a number").
//
// One input per cell, in the table's own layout, so a wrong digit is corrected
// where it is seen. Every cell shows CM regardless of the display unit: the
// numbers on the tag are cm, and asking someone to convert their correction
// back to cm is how a second error gets in.
//
// The edit lifts to the parent as a whole replacement chart, because the chart
// is derived from text and only the text is stored. A blank cell drops the
// measurement rather than storing zero.
function ChartFixGrid({ rows, columns, units, onFix }) {
  const cols = columns.length ? columns : ["chest"];
  const setCell = (rowIndex, key, raw) => {
    const digits = String(raw).replace(/[^0-9]/g, "").slice(0, 3);
    const next = rows.map((row, i) => {
      if (i !== rowIndex) return row;
      // Rebuild in the TABLE's column order, not the row's current key order.
      // Clearing a cell drops its key, so rebuilding from the row would append
      // the column on the next keystroke — and the serialized text, and with it
      // the chart's column order, would follow.
      const copy = { size: row.size };
      for (const k of cols) {
        const value = k === key ? (digits ? parseInt(digits, 10) : null) : row[k];
        if (value != null && isFinite(value)) copy[k] = value;
      }
      // Keep any measurement the table header does not show.
      for (const k of Object.keys(row)) {
        if (k !== "size" && !cols.includes(k) && copy[k] == null) copy[k] = row[k];
      }
      return copy;
    });
    onFix({ rows: next });
  };

  return (
    <div className="cz-sizing-fix">
      <div className="cz-sizing-fix-head">
        <span className="cz-sizing-fix-size" />
        {cols.map((key) => (
          <span key={key} className="cz-sizing-fix-col">
            {measureWord(key)}
            {units === "in" ? " (cm)" : ""}
          </span>
        ))}
      </div>
      {rows.map((row, i) => (
        <div key={String(row.size) + i} className="cz-sizing-fix-row">
          <span className="cz-sizing-fix-size">{formatSizeToken(row.size) || row.size}</span>
          {cols.map((key) => (
            <input
              key={key}
              className="cz-sizing-fix-cell"
              type="text"
              inputMode="numeric"
              maxLength={3}
              aria-label={(formatSizeToken(row.size) || row.size) + " " + measureWord(key) + " in cm"}
              value={row[key] == null ? "" : String(Math.round(row[key]))}
              onChange={(e) => setCell(i, key, e.target.value)}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// Name a parsed column the way a person would say it out loud. The parser's
// keys are terse on purpose; this is the only place they are read aloud.
const MEASURE_WORDS = {
  chest: "chest",
  bust: "bust",
  waist: "waist",
  hip: "hips",
  hips: "hips",
  length: "length",
  shoulder: "shoulders",
  sleeve: "sleeve",
  inseam: "inseam",
  thigh: "thigh",
  height: "height",
  weight: "weight",
};
function measureWord(key) {
  return MEASURE_WORDS[key] || String(key);
}

// "chest, length and shoulders" — an Oxford-free list, because it is read as a
// sentence and not as a spec.
function listPhrase(words) {
  if (words.length <= 1) return words[0] || "";
  if (words.length === 2) return words[0] + " and " + words[1];
  return words.slice(0, -1).join(", ") + " and " + words[words.length - 1];
}

function SizeChoiceEditor({ chosenSize, recommendedSize, runValues, choicesHidden = false, customSize, onCustomChange, onCommit, onPick }) {
  const choices = chipSizes(runValues, chosenSize || recommendedSize);

  return (
    <div className="cz-detail-size-editor">
      {/* 2026-07-28 — one place for size. The heading said "Item size" and
          repeated the recommendation in words; the ringed chip already says
          it. The custom field was a second full-width bar holding the same
          value as the filled chip. Both are gone: the row below is the only
          place the size is set. Round 5 point 5.1: when the chart cells
          above already offer the same sizes as buttons, this chip row is a
          repeat and hides (choicesHidden). */}
      {choices.length && !choicesHidden ? (
        <div className="cz-detail-size-choices" aria-label="Item size choices">
          {choices.map((size) => {
            const active = String(chosenSize).toUpperCase() === String(size).toUpperCase();
            const recommended =
              !active && String(recommendedSize || "").toUpperCase() === String(size).toUpperCase();
            return (
              <button
                key={size}
                type="button"
                className={
                  "cz-detail-size-choice" +
                  (active ? " is-active" : "") +
                  (recommended ? " is-recommended" : "")
                }
                aria-pressed={active}
                onClick={() => onPick(String(size))}
              >
                {formatSizeToken(size) || size}
              </button>
            );
          })}
          {chosenSize ? (
            <button type="button" className="cz-detail-size-choice is-clear" onClick={() => onPick("")}>
              Clear size
            </button>
          ) : null}
        </div>
      ) : null}
      {/* The odd sizes sellers really use — 170/92A, EU 44, One size — cannot
          be chips. This stays, but as a quiet inline field beside the run, not
          a second bar under it. */}
      <label className="cz-detail-custom-size">
        <span>Other</span>
        <input
          className="cz-detail-editor-input"
          aria-label="Custom item size"
          placeholder="170/92A"
          value={customSize}
          onChange={(event) => onCustomChange(event.target.value)}
          onBlur={onCommit}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === "Enter") {
              event.preventDefault();
              onCommit();
              event.currentTarget.blur();
            }
          }}
        />
      </label>
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

// The Buy button gets a notch (handoff turn 9 §8). One container, one radius,
// split by a hairline: the label opens the agent, the chevron segment opens
// the agent LIST. Before this the only way to change agent was Profile →
// Buying agent, three taps away from the moment the choice matters.
//
// The list is the item's own price against every agent, repeated. That
// repetition IS the message: "Item price is the same everywhere — agents
// differ on shipping and service fee." A picker that showed four different
// numbers would be lying about what an agent changes.
function BuyNotch({ item, label, url, preferredAgent, onSelectAgent, onOpen }) {
  const [open, setOpen] = useState(false);
  // The price comes from the item, not from the footer layout: the phone sheet
  // draws no footer price at all, and the picker still has to show a number.
  const price = priceLabelShort(item);
  const wrapRef = useRef(null);
  const listRef = useRef(null);
  // No picker without a way to save the choice — the notch would open a list
  // that cannot do anything. Standalone callers get the plain button.
  const canPick = typeof onSelectAgent === "function";

  // The list scrolls, so opening it on row 1 can hide the saved agent. Put the
  // current choice on screen before the user reads anything.
  useEffect(() => {
    if (!open || !listRef.current) return;
    const row = listRef.current.querySelector(".is-active");
    if (row && row.scrollIntoView) row.scrollIntoView({ block: "nearest" });
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onDocDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        // The sheet closes on Escape too. Stop here so one press closes one
        // layer, innermost first.
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onDocDown, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onDocDown, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  const buy = (
    <button type="button" className="cz-detail-buy" onClick={() => onOpen(item, url)}>
      {label}
    </button>
  );
  if (!canPick) return buy;

  return (
    <div className="cz-buy-notch-wrap" ref={wrapRef}>
      <div className="cz-buy-notch">
        {buy}
        <button
          type="button"
          className="cz-buy-notch-toggle"
          aria-label="Choose buying agent"
          aria-expanded={open}
          aria-haspopup="true"
          onClick={() => setOpen((v) => !v)}
        >
          <ChevronDown size={17} strokeWidth={2.4} aria-hidden="true" />
        </button>
      </div>
      {open ? (
        <div className="cz-agent-pop">
          <div
            className="cz-agent-pop-list"
            role="radiogroup"
            aria-label="Buying agent"
            ref={listRef}
          >
            {listAgents().map((agent) => {
              const active = agent.id === preferredAgent;
              return (
                <button
                  type="button"
                  role="radio"
                  aria-checked={active}
                  key={agent.id}
                  className={"cz-agent-pop-row" + (active ? " is-active" : "")}
                  onClick={() => {
                    onSelectAgent(agent.id);
                    setOpen(false);
                  }}
                >
                  <span className="cz-agent-pop-dot" aria-hidden="true" />
                  <span className="cz-agent-pop-name">{agent.name}</span>
                  {/* Same number on every row, on purpose. */}
                  {price ? <span className="cz-agent-pop-price">{price}</span> : null}
                </button>
              );
            })}
          </div>
          <p className="cz-agent-pop-note">
            Item price is the same everywhere — agents differ on shipping and service fee.
            Your pick sticks as the default.
          </p>
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CH-08 (designs 4d–4g): the no-measurements flow on the live Size tab.
// Confidence derives from data completeness — never fabricated. With an empty
// profile the sizing slot shows no size string at all: only the ask (4d).

// 4d — dashed empty prompt. Copy is canonical from Card Mockups design 4d.
function FitEmptyPrompt({ onAdd, onSkip }) {
  return (
    <div className="cz-fit4-empty">
      <div className="cz-fit4-empty-title">Will it fit you?</div>
      <p className="cz-fit4-empty-copy">
        Add your usual size and we’ll size every item on your shelf. Takes 10 seconds.
      </p>
      <button type="button" className="cz-fit4-empty-btn" onClick={onAdd}>
        Add my size
      </button>
      {onSkip ? (
        <button type="button" className="cz-fit-prompt-skip" onClick={onSkip}>
          Skip for now
        </button>
      ) : null}
    </div>
  );
}

// 4f — the ask. Only what the category needs (fitMeasureFieldsFor), prefilled
// from the profile in display units, saved back in storage units.
function FitMeasureAsk({ item, bodyProfile, units, hasUsual, onSave, onClose, onSkipFitPrompt }) {
  const fields = fitMeasureFieldsFor(item.category);
  const [draft, setDraft] = useState(() => {
    const next = { usualSize: (bodyProfile && bodyProfile.usualSize) || "" };
    for (const f of fields) {
      next[f.key] =
        bodyProfile && bodyProfile[f.key] != null
          ? measureFromStorage(bodyProfile[f.key], units, f.kind)
          : "";
    }
    return next;
  });
  const [showHints, setShowHints] = useState(false);
  const unitHint = units === "in" ? "in" : "cm";
  const catLabel =
    item.category && CATEGORIES[item.category]
      ? CATEGORIES[item.category].label.toLowerCase()
      : "this item";
  const fieldNames = fields.map((f) => f.label.toLowerCase()).join(" and ");

  const save = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const next = {};
    if ((draft.usualSize || "").trim()) next.usualSize = draft.usualSize.trim();
    for (const f of fields) {
      const stored = measureToStorage(draft[f.key], units, f.kind);
      if (stored != null) next[f.key] = stored;
    }
    onSave(next);
    onClose();
  };

  return (
    <form className="cz-fit-prompt cz-fit4-ask" onSubmit={save}>
      <div className="cz-fit-prompt-title">Your measurements</div>
      <p className="cz-fit-prompt-copy">
        For {catLabel} we need your {fieldNames}. Saved for every item.
      </p>
      <div className={"cz-fit-prompt-fields" + (fields.length === 1 ? " is-one" : "")}>
        {fields.map((f) => (
          <label className="cz-fit-prompt-field" key={f.key}>
            <span className="cz-fit-prompt-label">{f.label}</span>
            <span className="cz-fit-prompt-control">
              <input
                inputMode="decimal"
                placeholder={units === "in" ? f.phIn : f.phCm}
                value={draft[f.key] || ""}
                onChange={(e2) =>
                  setDraft((d) => ({ ...d, [f.key]: e2.target.value.replace(/[^\d.]/g, "") }))
                }
                aria-label={f.label + " in " + unitHint}
              />
              <span className="cz-fit-prompt-unit" aria-hidden="true">
                {unitHint}
              </span>
            </span>
          </label>
        ))}
        <label className="cz-fit-prompt-field cz-fit-prompt-size">
          <span className="cz-fit-prompt-label">Usual size (backup)</span>
          <span className="cz-fit-prompt-control">
            <input
              placeholder="M"
              value={draft.usualSize || ""}
              onChange={(e2) => setDraft((d) => ({ ...d, usualSize: e2.target.value }))}
              aria-label="Usual size"
            />
          </span>
        </label>
      </div>
      {showHints ? (
        fields.map((f) =>
          f.hint ? (
            <p key={f.key} className="cz-fit4-alt">
              {f.label}: {f.hint}
            </p>
          ) : null
        )
      ) : (
        <button type="button" className="cz-fit-prompt-skip" onClick={() => setShowHints(true)}>
          Not sure how to measure?
        </button>
      )}
      <div className="cz-fit-prompt-actions">
        <button type="submit" className="cz-fit-prompt-save">
          Save & recalculate
        </button>
        <button
          type="button"
          className="cz-fit-prompt-skip"
          onClick={() => {
            onClose();
            if (!hasUsual && onSkipFitPrompt) onSkipFitPrompt();
          }}
        >
          {hasUsual ? "Skip — keep the rough size" : "Skip for now"}
        </button>
      </div>
    </form>
  );
}

// 4e / 4g — the confidence strip under the sizing block. Amber when the read
// rests on the usual size alone (the category's own measures are absent);
// green with the You/Garment/Ease math when a real measure met a real chart.
// Provenance strings inside SizingBlock stay untouched — this strip only adds.
// 5b — in-context taste ask, same copy as the orphan SizeRecommendation flow.
// Owns its draft; mounts fresh each time, so it prefills from the live pref.
function FitPrefAsk({ item, fitPref, onSaveFitPref, onDone }) {
  const catAxes = FIT_PREF_AXES[item.category];
  const [draft, setDraft] = useState({
    length: (fitPref && fitPref.length) || null,
    looseness: (fitPref && fitPref.looseness) || null,
  });
  const catTitle = CATEGORIES[item.category]
    ? CATEGORIES[item.category].label.toLowerCase()
    : "this item";
  if (!catAxes) return null;
  return (
    <div className="cz-fit-pref-ask">
      <div className="cz-fit-pref-ask-title">How do you wear {catTitle}?</div>
      <p className="cz-fit-pref-ask-copy">
        Sets your default for all {catTitle}. Change any time in Settings.
      </p>
      <FitPrefAxis
        label="Length"
        options={catAxes.length}
        value={draft.length}
        onChange={(v) => setDraft((d) => ({ ...d, length: v }))}
      />
      <FitPrefAxis
        label="Looseness"
        options={catAxes.looseness}
        value={draft.looseness}
        onChange={(v) => setDraft((d) => ({ ...d, looseness: v }))}
      />
      <button
        type="button"
        className="cz-fit-pref-ask-save"
        onClick={() => {
          onSaveFitPref(item.category, {
            length: draft.length,
            looseness: draft.looseness,
            dismissed: false,
          });
          onDone();
        }}
      >
        Save preference
      </button>
      <button
        type="button"
        className="cz-fit-prompt-skip"
        onClick={() => {
          onSaveFitPref(item.category, {
            length: null,
            looseness: null,
            dismissed: true,
          });
          onDone();
        }}
      >
        Not sure yet
      </button>
    </div>
  );
}

function FitConfidenceStrip({ item, verdict, bodyProfile, fitPref, units, onSharpen, onEditPref }) {
  const rec = verdict.rec;
  if (verdict.precise && rec && rec.body != null && rec.garment != null) {
    const diff = rec.diff != null ? rec.diff : rec.garment - rec.body;
    const easeStr = (diff >= 0 ? "+" : "−") + formatMeasure(Math.abs(diff), units);
    // 5c — the preference payoff. baseWord only exists when taste actually
    // shifted the letter size; tags surface any saved axis, shift or not.
    const sizeWord = formatSizeToken(rec.size) || rec.size;
    const baseWord =
      rec.baseSize && String(rec.baseSize).toUpperCase() !== String(rec.size).toUpperCase()
        ? formatSizeToken(rec.baseSize) || rec.baseSize
        : null;
    const activePref = rec.fitPref || (fitPrefHasChoice(fitPref) ? fitPref : null);
    const lengthTag =
      activePref && activePref.length
        ? fitPrefLabel(item.category, "length", activePref.length)
        : null;
    const looseTag =
      activePref && activePref.looseness
        ? fitPrefLabel(item.category, "looseness", activePref.looseness)
        : null;
    return (
      <div className="cz-fit4">
        <div className="cz-fit4-head">
          <span className="cz-fit4-kicker">Fit confidence</span>
          <span className="cz-fit4-badge is-precise">
            <span className="cz-fit4-badge-dot" aria-hidden="true" />
            Precise fit
          </span>
        </div>
        {baseWord ? (
          <div className="cz-fit4-size-row">
            <span className="cz-fit4-size">{sizeWord}</span>
            <span className="cz-fit4-size-base" aria-label={"Base size " + baseWord}>
              {baseWord}
            </span>
            <span className="cz-fit4-size-shift">
              {rec.prefShift === "down" ? "sized down" : "sized up"}
            </span>
          </div>
        ) : null}
        {rec.prefReason ? <p className="cz-fit4-prose">{rec.prefReason}</p> : null}
        {/* Kyle 2026-07-23: the math row is the no-preference payoff (4g).
            When taste shifted the size (5c), the reason line + pref tags
            carry the why — showing both stacked read as clutter. */}
        {!baseWord && !lengthTag && !looseTag ? (
          <div className="cz-fit4-math" aria-label="Fit numbers">
            <div className="cz-fit4-math-cell">
              <div className="cz-fit4-math-k">You</div>
              <div className="cz-fit4-math-v">{formatMeasure(rec.body, units)}</div>
            </div>
            <div className="cz-fit4-math-cell">
              <div className="cz-fit4-math-k">Garment</div>
              <div className="cz-fit4-math-v">{formatMeasure(rec.garment, units)}</div>
            </div>
            <div className="cz-fit4-math-cell">
              <div className="cz-fit4-math-k">Ease</div>
              <div className="cz-fit4-math-v is-money">{easeStr}</div>
            </div>
          </div>
        ) : null}
        {lengthTag || looseTag ? (
          <div className="cz-fit4-pref-bar">
            <div className="cz-fit4-pref-tags">
              {lengthTag ? <span className="cz-fit4-pref-tag">{lengthTag}</span> : null}
              {looseTag ? <span className="cz-fit4-pref-tag">{looseTag}</span> : null}
            </div>
            {onEditPref ? (
              <button type="button" className="cz-fit4-pref-edit" onClick={onEditPref}>
                Edit
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }
  const fieldsMissing = fitMeasureFieldsFor(item.category).some(
    (f) => !(bodyProfile && bodyProfile[f.key] != null)
  );
  if (!verdict.usualSize || !fieldsMissing) return null;
  const missingKey =
    (rec && rec.missing) ||
    (item.category === "pants" || item.category === "shorts" ? "waist" : "chest");
  const sharpenLabel =
    item.category === "pants" || item.category === "shorts"
      ? "Add waist & inseam"
      : item.category === "shirt" || item.category === "outerwear"
        ? "Add chest"
        : "Add chest & waist";
  return (
    <div className="cz-fit4">
      <div className="cz-fit4-head">
        <span className="cz-fit4-kicker">Fit confidence</span>
        <span className="cz-fit4-badge is-rough">
          <span className="cz-fit4-badge-dot" aria-hidden="true" />
          Rough estimate
        </span>
      </div>
      <p className="cz-fit4-alt">
        Based on your usual size alone. Add your {missingKey} for a chart-based fit.
      </p>
      {onSharpen ? (
        <button type="button" className="cz-fit4-sharpen" onClick={onSharpen}>
          <span>{sharpenLabel}</span>
          <span className="cz-fit4-sharpen-meta">+ sharper ›</span>
        </button>
      ) : null}
    </div>
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
  snapshotRef = null,
  // Fix B (handoff turn 4): the desktop two-column panel puts the price in
  // the pinned footer next to Buy. §9 gives the phone sheet the same row, in
  // its own boxed treatment. Null on the flip-card back, which keeps the
  // full-width Buy.
  footerPrice = null,
  // §8: the notch picks the agent. Without onSelectAgent the notch does not
  // render at all — a chevron that opens a list that saves nothing is worse
  // than no chevron.
  preferredAgent = null,
  onSelectAgent = null,
  // §9: the phone sheet's own close action, so the sticky bar can carry it.
  // Absent on the desktop back, which never scrolls its photo out of a
  // viewport and already has a card header.
  onRequestClose = null,
  // §9 QC prompt. QC photos are the agent's, not the seller's, so they take
  // their own writer — never onAttachPhoto, which fills the product gallery.
  onAttachQcPhoto = null,
  // §3 seller cache: the whole shelf, so a chart already read for this seller
  // sizes this item with no network call. Optional — callers that do not pass
  // it simply fall back to the network hunt.
  shelfItems = null,
  // The two-column panel can place Timeline + Notes under its photo without
  // taking ownership of the notes draft. Undefined keeps them inline for
  // every existing caller; null suppresses the pre-mount desktop frame.
  logNotesTarget = undefined,
  // CH-08 (4d–4g): the fit-prompt trio. All three optional — a caller that
  // does not pass onSaveBodyProfile gets no prompt and no ask, only the
  // existing sizing presentation.
  onSaveBodyProfile = null,
  fitPromptSkipped = false,
  onSkipFitPrompt = null,
  onSaveFitPref = null,
  // CH-14: flips the Concise/Detailed pref from the sentence itself. Optional
  // — without it the sentence renders with no toggle, as before. The value
  // rides along as a prop because the module mirror only syncs in an effect,
  // one render behind the toggle.
  onCycleFitDetail = null,
  fitDetail = null,
  // Profile Settings design (1e): the summary on/off moved out of settings
  // onto the paragraph it gates. Same optional-prop contract as the detail
  // pair — without them the block renders exactly as before.
  onToggleFitSummary = null,
  fitSummary = null,
}) {
  const titleInputRef = useRef(null);
  const chartInputRef = useRef(null);
  const chartPhotoUrlRef = useRef("");
  const fieldBaseId = "cz-detail-" + useId().replace(/:/g, "");
  const reduced = usePrefersReducedMotion();

  // The photo pager is part of the shared body — the phone sheet and the
  // desktop card back show the same photos the same way. Shell chrome
  // (close, ⋯ menu) comes in through renderHeroActions; the desktop back
  // passes none because its card header already carries those.
  const [photoIdx, setPhotoIdx] = useState(0);
  // Round 4 point 7 (2026-07-29): a failed photo draws the brand tile, never
  // the browser's broken-image mark. Tracked per photo URL — one bad photo
  // must not hide the good ones.
  const [badPhotos, setBadPhotos] = useState(() => new Set());
  const trackRef = useRef(null);
  const photos = heroPager ? itemPhotoList(item, DETAIL_PHOTO_CAP) : [];

  // §9 sticky bar. The photo block used to leave a stranded sliver of image
  // above the title as you scrolled. The bar replaces that sliver: thumb,
  // title, size · price, close. It only exists where the shell gives us a
  // close action, which is the phone sheet.
  const heroRef = useRef(null);
  const scrollRef = useRef(null);
  const [heroGone, setHeroGone] = useState(false);
  const wantsStickyBar = heroPager && typeof onRequestClose === "function";
  useEffect(() => {
    if (!wantsStickyBar) return undefined;
    const hero = heroRef.current;
    const root = scrollRef.current;
    // jsdom has no IntersectionObserver, and neither does an old iOS. No
    // observer means no bar — the sheet reads exactly as it did before §9.
    if (!hero || !root || typeof IntersectionObserver === "undefined") return undefined;
    const io = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        if (e) setHeroGone(!e.isIntersecting);
      },
      // The bar arrives as the LAST of the photo leaves, not the first: a
      // threshold of 0 flips the moment one pixel is gone.
      { root, threshold: 0 }
    );
    io.observe(hero);
    return () => io.disconnect();
  }, [wantsStickyBar, item.id]);

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
  const draftOwnerRef = useRef(null);
  const draftItemRef = useRef(null);
  const immediateDraftRef = useRef(null);
  const renderedItemIdRef = useRef(item.id);
  const [savedFlash, setSavedFlash] = useState(false);
  const [editingCell, setEditingCell] = useState(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [customSize, setCustomSize] = useState(String(item.size || ""));
  const customSizeCommittedRef = useRef(String(item.size || ""));
  const [notesOpen, setNotesOpen] = useState(false);
  // Round 4 point 5: an empty note box became a small "Add a note" button.
  // The writer opens on demand; a note with text always shows.
  const [noteWriterOpen, setNoteWriterOpen] = useState(false);
  // The weight editor converts on the fly; weightText is the raw kg string
  // while the kg unit is active so the caret never jumps mid-type.
  const [weightUnit, setWeightUnit] = useState("g");
  const [weightText, setWeightText] = useState("");
  const savedTimer = useRef(null);
  const editorSlotRef = useRef(null);

  const draftIsCurrent = draftOwnerRef.current === item.id;
  const view = draftIsCurrent && draft ? draft : buildEditDraft(item);

  useEffect(() => {
    if (!snapshotRef) return undefined;
    snapshotRef.current = { ...item, ...buildEditPatch(view, item), id: item.id };
    return () => {
      if (snapshotRef.current && snapshotRef.current.id === item.id) snapshotRef.current = null;
    };
  }, [snapshotRef, item, view]);

  const commitRef = useWriteThroughDraft(draft, (d) => {
    if (immediateDraftRef.current === d) return;
    const ownerId = draftOwnerRef.current;
    const ownerItem = draftItemRef.current;
    if (!ownerId || !ownerItem) return;
    onSaveEdit(ownerId, buildEditPatch(d, ownerItem));
    setSavedFlash(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSavedFlash(false), SAVED_HOLD_MS);
  });

  // A pending draft belongs to the item that created it. Flush that draft to
  // its owner before this shared body starts showing a different item.
  useEffect(() => {
    if (renderedItemIdRef.current === item.id) return;
    commitRef.current();
    renderedItemIdRef.current = item.id;
    draftOwnerRef.current = null;
    draftItemRef.current = null;
    setDraft(null);
    setEditingCell(null);
    setEditingTitle(false);
    setCustomSize(String(item.size || ""));
    customSizeCommittedRef.current = String(item.size || "");
  }, [item.id, item.size, commitRef]);

  // The host shell flushes pending edits before it closes.
  useEffect(() => {
    if (!flushRef) return undefined;
    const flush = () => commitRef.current();
    flushRef.current = flush;
    return () => {
      if (flushRef.current === flush) flushRef.current = null;
    };
  }, [flushRef, commitRef]);

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

  const setOwnedDraft = (next) => {
    draftOwnerRef.current = item.id;
    draftItemRef.current = item;
    setDraft(next);
  };

  const edit = (key, value) => {
    const sameOwner = draftOwnerRef.current === item.id;
    if (!sameOwner) {
      draftOwnerRef.current = item.id;
      draftItemRef.current = item;
    }
    setDraft((d) => ({ ...((sameOwner && d) || buildEditDraft(item)), [key]: value }));
  };

  // Status commits on the tap, not on the debounce. Mirror it into an open
  // draft so a pending write-through cannot put the old status back.
  const pickStatus = (next) => {
    onSaveEdit(item.id, { findStatus: next });
    setDraft((d) =>
      draftOwnerRef.current === item.id && d ? { ...d, findStatus: next } : d
    );
    setSavedFlash(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSavedFlash(false), SAVED_HOLD_MS);
  };

  // The parent owns the sizing verdict and the chart hunt.
  const fitPref = fitPrefs && item.category ? fitPrefs[item.category] || null : null;
  const verdict = useSizeVerdict(item, bodyProfile, fitPref, measureUnits, fitDetail, fitSummary);
  // Round 5 point 5.1 (2026-07-29): the chart cells ARE the size picker.
  // Computed here so SizingBlock draws them and SizeChoiceEditor knows its
  // own plain chip row would say the same sizes a second time.
  const sizeMeasureKey = verdict.rec && verdict.rec.primaryKey ? verdict.rec.primaryKey : "chest";
  const sizeCells =
    verdict.chart && Array.isArray(verdict.chart.rows)
      ? verdict.chart.rows.filter((r) => r.size && r[sizeMeasureKey] != null).slice(0, 6)
      : [];
  // Split rail: the per-measurement fit bars. YOURS uses the same effective
  // profile the pick math used, so the table's ease always agrees with
  // rec.diff — a raw-profile table would show a different chest than the one
  // the recommendation was scored against.
  const fitRows = useMemo(
    () =>
      SIZE_PICK_SKIP_CATEGORIES.has(item.category)
        ? []
        : fitReadRows(
            verdict.chart,
            verdict.rec,
            effectiveBodyProfile(bodyProfile),
            item.category
          ),
    [verdict.chart, verdict.rec, bodyProfile, item.category]
  );
  // "Forget this chart" (split rail): the parse was wrong, so the stored
  // measurements go. Only offered when dropping sizeNotes actually kills the
  // chart — one parsed from the listing's own text would survive the clear,
  // and a link that does nothing teaches the customer not to trust links.
  const chartIsForgettable = useMemo(
    () => !!verdict.chart && !parseSizeChart(sizeChartTextFor({ ...item, sizeNotes: "" })),
    [verdict.chart, item]
  );
  const forgetChart = () => {
    onSaveEdit(item.id, { sizeNotes: "", sizeChartSource: null });
  };
  // CH-14: the toggle's label follows the same value the sentence length does.
  const fitDetailPref = fitDetail || fitDisplayPrefs().detail;
  // Design 1e: same for the summary on/off — prop fresh, mirror one behind.
  const fitSummaryOn = fitSummary !== null ? fitSummary : fitDisplayPrefs().summary;
  // CH-08: the 4f ask, local to this card. Reset when the card changes.
  const [askingMeasures, setAskingMeasures] = useState(false);
  // CH-09 (5b): the taste ask. Auto once per category when a chart-based rec
  // exists and the customer never answered; Edit on the pref bar reopens it.
  const [askingPref, setAskingPref] = useState(false);
  useEffect(() => {
    setAskingMeasures(false);
    setAskingPref(false);
  }, [item.id]);
  const needsPrefAsk =
    !!FIT_PREF_AXES[item.category] &&
    !!onSaveFitPref &&
    !!verdict.chart &&
    !!bodyProfile &&
    !fitPrefHasChoice(fitPref) &&
    !(fitPref && fitPref.dismissed);
  const hunting = useChartHunt(item, verdict.chart, onSaveEdit, true, shelfItems);
  // §3: the customer's own chart read, and the album photos its third option
  // offers. Remote URLs only — a local data: URL cannot go down the images door.
  const chartRead = useCustomerChartRead(item, onSaveEdit);
  useEffect(() => {
    const url = chartPhotoUrlRef.current;
    if (url && chartRead.thumb !== url) {
      if (typeof URL.revokeObjectURL === "function") URL.revokeObjectURL(url);
      chartPhotoUrlRef.current = "";
    }
  }, [chartRead.thumb]);
  useEffect(() => () => {
    const url = chartPhotoUrlRef.current;
    if (url && typeof URL.revokeObjectURL === "function") URL.revokeObjectURL(url);
    chartPhotoUrlRef.current = "";
  }, []);
  const sizingAlbumPhotos = useMemo(
    // Round 5 point 5.2: one shared cap for every detail photo list. The
    // filter stays — this list is only the photos the server can fetch.
    () => itemPhotoList(item, DETAIL_PHOTO_CAP).filter((src) => /^https?:\/\//i.test(src)),
    [item]
  );

  const recSize = computeRecommendedSize(item, bodyProfile, fitPrefs);
  const chosenSize = String(view.size || "").trim();
  useEffect(() => {
    setCustomSize(chosenSize);
    customSizeCommittedRef.current = chosenSize;
  }, [item.id, chosenSize]);
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
  const lowerEditing = editingCell === "price";
  // Timeline (§6). sizeFrom names WHO decided the size, in the same vocabulary
  // the sizing block's provenance uses — "from the seller's chart" only when a
  // real chart was read, never for the profile fallback. Round 5 point 5.1: a
  // hand pick carries no tail — "Sized Large yourself" was a second copy of
  // the "you picked this" notice beside the size word.
  const timeline = buildTimeline(
    item,
    sizeText,
    chosenSize
      ? ""
      : verdict.precise
        ? "from the seller's chart"
        : recSize
          ? "from your measurements"
          : ""
  );
  // §9 sticky bar meta: "AI SIZE L · $34.61". The size half names WHO decided
  // it, in the sizing block's own vocabulary — the bar must not upgrade a
  // profile guess into an AI read. Either half may be missing; the separator
  // only appears between two real values.
  const stickyMeta = [
    sizeText ? (sizeIsRec ? "AI SIZE " : "SIZE ") + sizeText : "",
    priceLabelShort(item),
  ]
    .filter(Boolean)
    .join(" · ");
  // The QC prompt is a question about the order, so it only asks after the
  // customer buys the item and before any photo arrives.
  const showQcPrompt =
    typeof onAttachQcPhoto === "function" &&
    normalizeFindStatus(view.findStatus) === "bought" &&
    !(Array.isArray(item.qcPhotos) && item.qcPhotos.filter(Boolean).length);
  const buyButtons = linkButtons(item, { buyLabel }).filter((b) => b.role === "buy");
  // ONE primary action: the first buy link only. Two filled twins read as a
  // bug (Kyle 2026-07-25, desktop card back included).
  const buyButton = buyButtons[0] || null;
  const savedDate = item.createdAt
    ? new Date(item.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })
    : "";
  const subLine = [item.seller, savedDate ? "saved " + savedDate : ""].filter(Boolean).join(" · ");
  // The SELLER row in the Details list opens the seller's other listings. Not
  // every seller has a store page Credenza can build, so this can be null and
  // the row falls back to plain text (shelf handoff 2026-07-28).
  const sellerHref = sellerStoreUrl(item);
  const knownHauls = Array.from(
    new Set([...(haulNames || []), item.project || ""].map((n) => String(n || "").trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  const priceUnit =
    String(view.currency || "CNY").toUpperCase() === "USD" ? "USD" : "CNY";
  const priceEditorLabel = "Price · " + (priceUnit === "USD" ? "$ USD" : "¥ CNY");

  // Open price with the settings primary unit pre-selected (Kyle 2026-07-26:
  // "shouldn't default to CNY… default to USD if we have USD in the settings").
  const openPriceEditor = () => {
    const base = view;
    const primary = pricePrimaryPref() === "CNY" ? "CNY" : "USD";
    if (primary === "USD") {
      const usd = itemUsdAmount(item);
      setOwnedDraft({
        ...base,
        currency: "USD",
        price: usd != null && isFinite(usd) ? String(usd) : "",
      });
    } else {
      // Same conversion the card labels use (itemCnyAmount, Kyle 2026-07-28)
      // — the editor opens with the amount the customer just saw.
      const cny = itemCnyAmount(item);
      setOwnedDraft({
        ...base,
        currency: "CNY",
        price: cny != null && isFinite(cny) ? String(cny) : "",
      });
    }
    setEditingCell("price");
  };

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

  // USD ↔ CNY on the open price draft. Converts the typed number so the field
  // does not silently change currency under the same digits.
  const switchPriceUnit = (next) => {
    const want = next === "USD" ? "USD" : "CNY";
    if (want === priceUnit) return;
    const n = parseFloat(view.price);
    const base = view;
    if (!isFinite(n) || String(view.price || "").trim() === "") {
      setOwnedDraft({ ...base, currency: want });
      return;
    }
    if (want === "USD") {
      setOwnedDraft({ ...base, currency: "USD", price: String(+(n * 0.14).toFixed(2)) });
    } else {
      setOwnedDraft({ ...base, currency: "CNY", price: String(Math.round(n / 0.14)) });
    }
  };

  const pickItemSize = (size) => {
    const cleaned = String(size || "").trim();
    const next = { ...view, size: cleaned };
    customSizeCommittedRef.current = cleaned;
    immediateDraftRef.current = next;
    setCustomSize(cleaned);
    setOwnedDraft(next);
    onSaveEdit(item.id, buildEditPatch(next, item));
  };

  const commitCustomSize = () => {
    const cleaned = customSize.trim();
    if (cleaned === customSizeCommittedRef.current) return;
    pickItemSize(cleaned);
  };

  const readUploadedChart = (event) => {
    const files = [...(event.target.files || [])];
    event.target.value = "";
    if (!files.length) return;
    const previous = chartPhotoUrlRef.current;
    if (previous && typeof URL.revokeObjectURL === "function") URL.revokeObjectURL(previous);
    const thumb = typeof URL.createObjectURL === "function" ? URL.createObjectURL(files[0]) : "";
    chartPhotoUrlRef.current = thumb;
    chartRead.read(files, { thumb });
  };

  const openProfileSizes = () => {
    commitRef.current();
    setEditingCell(null);
    if (onOpenSizes) onOpenSizes();
  };

  const renderPriceEditor = () => {
    if (editingCell !== "price") return null;
    return (
      <div className="cz-detail-editor">
        <span className="cz-detail-editor-label">{priceEditorLabel}</span>
        <input
          ref={focusOnMount}
          className="cz-detail-editor-input"
          aria-label={priceEditorLabel}
          inputMode="decimal"
          value={view.price}
          onChange={(event) => edit("price", event.target.value)}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === "Enter") setEditingCell(null);
          }}
        />
        <div className="cz-detail-unit" role="group" aria-label="Price currency">
          {["USD", "CNY"].map((unit) => (
            <button
              key={unit}
              type="button"
              className={"cz-detail-unit-btn" + (priceUnit === unit ? " is-active" : "")}
              aria-pressed={priceUnit === unit}
              onClick={() => switchPriceUnit(unit)}
            >
              {unit === "USD" ? "$" : "¥"}
            </button>
          ))}
        </div>
        <button type="button" className="cz-detail-editor-done" onClick={() => setEditingCell(null)}>
          Done
        </button>
      </div>
    );
  };

  const logNotesBlock = (
    <>
      {/* Timeline (§6). Generated from fields the item already carries, so
          it renders only when there is something true to say. Round 4 point
          5 removed the TIMELINE heading — the rows speak for themselves. */}
      {timeline.length ? <Timeline rows={timeline} /> : null}

      {/* Notes (§7). The header moves INSIDE the box, so the box reads as
          one object instead of a label with a field under it.
          §7: "Never a fixed 2-line box, never a truncation with no way
          out." Collapsed clamps to 3 lines; EXPAND grows it. The box stays
          the same box you type in — there is still no mode to enter and no
          "+" to hunt for, which is what turn 5 fixed and §7 keeps.
          Round 4 point 5: an empty note is a small "Add a note" button, not
          a large empty box. */}
      {view.note || noteWriterOpen ? (
        <div className={"cz-detail-notes-box" + (notesOpen ? " is-open" : "")}>
          <div className="cz-detail-notes-head">
            <span className="cz-detail-notes-kicker">Notes</span>
            <span className="cz-detail-notes-gap" />
            <button
              type="button"
              className="cz-detail-notes-toggle"
              onClick={() => setNotesOpen((v) => !v)}
            >
              {notesOpen ? (
                <Minimize2 size={11} strokeWidth={2.2} aria-hidden="true" />
              ) : (
                <Maximize2 size={11} strokeWidth={2.2} aria-hidden="true" />
              )}
              {notesOpen ? "Collapse" : "Expand"}
            </button>
          </div>
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
      ) : (
        <button
          type="button"
          className="cz-detail-notes-add"
          onClick={() => setNoteWriterOpen(true)}
        >
          Add a note
        </button>
      )}
    </>
  );

  return (
    <>
      {/* Sticky bar (§9). It pins under the drag handle once the photo block
          has scrolled away, so the sheet always says which item you are in.
          aria-hidden while it is up: every control on it repeats one that is
          already in the sheet, so a screen reader gains nothing and a
          duplicate title is worse than no bar. */}
      {wantsStickyBar ? (
        <div className={"cz-detail-stickybar" + (heroGone ? " is-up" : "")} aria-hidden={!heroGone}>
          {photos.length ? (
            <img className="cz-detail-stickybar-thumb" src={photos[0]} alt="" decoding="async" />
          ) : null}
          <span className="cz-detail-stickybar-text">
            <span className="cz-detail-stickybar-title">{view.title || "Saved item"}</span>
            {stickyMeta ? <span className="cz-detail-stickybar-meta">{stickyMeta}</span> : null}
          </span>
          <button
            type="button"
            className="cz-detail-stickybar-close"
            aria-label="Close"
            tabIndex={heroGone ? 0 : -1}
            onClick={onRequestClose}
          >
            <X size={16} strokeWidth={2.4} aria-hidden="true" />
          </button>
        </div>
      ) : null}

      <div
        ref={scrollRef}
        className={"cz-detail-scroll" + (editingCell ? " is-editing" : "")}
      >
        {heroPager ? (
          // Photo pager. The dots track the scroll position — one snap per
          // photo, so a swipe is the only gesture needed.
          <div className="cz-detail-hero" ref={heroRef}>
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
                    {badPhotos.has(src) ? (
                      <CoverPlaceholder
                        item={item}
                        aspectRatio="auto"
                        style={{ width: "100%", height: "100%" }}
                      />
                    ) : (
                      <img
                        src={src}
                        alt=""
                        draggable={false}
                        loading="lazy"
                        decoding="async"
                        onError={() =>
                          setBadPhotos((prev) => (prev.has(src) ? prev : new Set(prev).add(src)))
                        }
                      />
                    )}
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

        {/* Photo panel tail (§4). The thumb strip and the two album links are
            "its own row below" the photo, not chrome over it — so they move
            here, directly under the hero, instead of sitting at the bottom of
            the rail. The desktop panel has no hero of its own here: it draws
            its stage and strip in the left column and mounts the same row
            there, so this block stays tied to the hero that owns it. */}
        {heroPager ? (
          <div className="cz-detail-photo-tail">
            <div className="cz-detail-photos">
              <EditPhotosManager
                item={item}
                onAttachPhoto={onAttachPhoto}
                onRemovePhoto={onRemovePhoto}
              />
            </div>
            <AlbumLinksRow item={item} />
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

        {/* Split rail: the four detail tabs are gone. Size, colorway, weight
            and haul are always-visible facts — three of them hidden behind a
            tab bar made the card a guessing game. */}
        <div className="cz-detail-facts">
          <section className="cz-detail-facts-section" aria-label="Size and fit">
            {askingMeasures && onSaveBodyProfile ? (
              // 4f — the ask replaces the sizing block until saved or skipped.
              <FitMeasureAsk
                item={item}
                bodyProfile={bodyProfile}
                units={measureUnits}
                hasUsual={!!verdict.usualSize}
                onSave={onSaveBodyProfile}
                onClose={() => setAskingMeasures(false)}
                onSkipFitPrompt={onSkipFitPrompt}
              />
            ) : !bodyProfile &&
              !fitPromptSkipped &&
              onSaveBodyProfile &&
              !SIZE_PICK_SKIP_CATEGORIES.has(item.category) ? (
              // 4d — empty profile: no size string, only the ask. The size
              // chips above stay (a hand-set size is the customer's own data).
              <FitEmptyPrompt
                onAdd={() => setAskingMeasures(true)}
                onSkip={onSkipFitPrompt}
              />
            ) : !verdict.chart && !hunting ? (
              <SizingBlockNoChart
                usualSize={chosenSize || verdict.usualSize}
                /* 2026-07-28 — the caption used to read "your usual" for a size
                   the customer had just chosen by hand. The word is the same;
                   where it came from is not. */
                isManual={!!chosenSize}
                albumPhotos={sizingAlbumPhotos}
                albumCount={sizingAlbumPhotos.length}
                onOpenAlbum={() => {
                  chartRead.read(sizingAlbumPhotos.slice(0, 3), {
                    thumb: sizingAlbumPhotos[0] || "",
                  });
                }}
              />
            ) : (
              <SizingBlock
                chart={verdict.chart}
                rec={verdict.rec}
                recSize={verdict.recSize}
                usualSize={verdict.usualSize}
                chosenSize={chosenSize}
                precise={verdict.precise}
                hunting={hunting}
                units={measureUnits}
                reduced={reduced}
                cells={sizeCells}
                measureKey={sizeMeasureKey}
                onPick={pickItemSize}
                cachedFrom={
                  item.sizeChartSource && item.sizeChartSource.via === "seller-cache"
                    ? item.sizeChartSource.seller || item.seller || ""
                    : ""
                }
              />
            )}

            {/* Round 4 point 1 (2026-07-29): one place for size. The override
                chips moved out of the right rail to sit with the big size
                word — visible with no tap, in the chart and no-chart states
                alike. Hidden only while the measure ask owns the section.
                Round 5 point 5.1: when the chart cells above already pick,
                the plain chip row here would repeat them — so it hides and
                only the odd-size field stays. */}
            {!askingMeasures ? (
              <SizeChoiceEditor
                chosenSize={chosenSize}
                recommendedSize={verdict.recSize || verdict.usualSize}
                runValues={verdict.runValues}
                choicesHidden={sizeCells.length > 0}
                customSize={customSize}
                onCustomChange={setCustomSize}
                onCommit={commitCustomSize}
                onPick={pickItemSize}
              />
            ) : null}

            {!askingMeasures && (askingPref || needsPrefAsk) && onSaveFitPref ? (
              // 5b — the taste ask sits in the confidence-strip slot. The
              // sizing block above stays, so the card is never blocked.
              <FitPrefAsk
                item={item}
                fitPref={fitPref}
                onSaveFitPref={onSaveFitPref}
                onDone={() => setAskingPref(false)}
              />
            ) : !askingMeasures &&
              bodyProfile &&
              onSaveBodyProfile &&
              !SIZE_PICK_SKIP_CATEGORIES.has(item.category) ? (
              // 4e / 4g — the confidence strip, only when a profile exists and
              // a caller can receive the sharpened measures.
              <FitConfidenceStrip
                item={item}
                verdict={verdict}
                bodyProfile={bodyProfile}
                fitPref={fitPref}
                units={measureUnits}
                onSharpen={() => setAskingMeasures(true)}
                onEditPref={onSaveFitPref ? () => setAskingPref(true) : null}
              />
            ) : null}

            {verdict.prescription ? (
              <p className="cz-sizing-why">
                {verdict.prescription}
                {/* CH-14: the fit-detail pref is changeable on the sentence it
                    governs, not only in Profile. Chip shows the current
                    length; a tap flips it app-wide. */}
                {typeof onCycleFitDetail === "function" ? (
                  <button
                    type="button"
                    className="cz-sizing-detail-toggle"
                    aria-label={
                      fitDetailPref === "detailed"
                        ? "Switch to the concise fit summary"
                        : "Switch to the detailed fit summary"
                    }
                    onClick={onCycleFitDetail}
                  >
                    {fitDetailPref === "detailed" ? "Detailed" : "Concise"}
                    <ChevronDown aria-hidden="true" size={11} strokeWidth={2.4} />
                  </button>
                ) : null}
                {/* Design 1e: the summary on/off lived two rows deep in
                    settings to control this one paragraph. It sits on the
                    paragraph now. */}
                {typeof onToggleFitSummary === "function" ? (
                  <button
                    type="button"
                    className="cz-sizing-detail-toggle"
                    aria-label="Turn the fit summary off"
                    onClick={onToggleFitSummary}
                  >
                    Hide
                  </button>
                ) : null}
              </p>
            ) : typeof onToggleFitSummary === "function" && !fitSummaryOn && verdict.recSize ? (
              // Summary off but a pick exists: the way back on stays where the
              // sentence would be, not back in a settings sheet.
              <p className="cz-sizing-why">
                <button
                  type="button"
                  className="cz-sizing-detail-toggle"
                  aria-label="Turn the fit summary on"
                  onClick={onToggleFitSummary}
                >
                  Show fit summary
                </button>
              </p>
            ) : null}

            {!askingMeasures ? (
              <FitReadTable
                rows={fitRows}
                hasChart={!!verdict.chart}
                units={measureUnits}
                reading={chartRead.reading}
                readingCount={chartRead.count}
                onEditMeasures={onOpenSizes ? openProfileSizes : null}
                onForgetChart={chartIsForgettable ? forgetChart : null}
              />
            ) : null}

            <div className="cz-detail-chart-actions">
              <button
                type="button"
                className="cz-detail-chart-upload"
                onClick={() => chartInputRef.current?.click()}
              >
                <Upload size={16} strokeWidth={2} aria-hidden="true" />
                Upload chart photo
              </button>
              <input
                ref={chartInputRef}
                className="cz-detail-chart-file"
                type="file"
                accept="image/*"
                hidden
                onChange={readUploadedChart}
              />
            </div>

            {chartRead.reading || chartRead.chart || chartRead.error ? (
              <SizingBlockReading
                reading={chartRead.reading}
                chart={chartRead.chart}
                thumb={chartRead.thumb}
                error={chartRead.error}
                units={measureUnits}
                onUse={chartRead.commit}
                onRetry={chartRead.dismiss}
                onFix={chartRead.fix}
              />
            ) : null}
          </section>

          {/* Details kicker (shelf handoff 2026-07-28, README :105). Everything
              above it answers "does it fit?". Everything below it answers "what
              is it, and did you buy it?". The kicker is the seam between the two
              questions, so the hairline rides it instead of the next section. */}
          <div className="cz-detail-facts-kicker" aria-hidden="true">
            Details
          </div>

          {/* ORDERED leads the Details list on both the desktop and the phone
              (shelf handoff 2026-07-28, README :105). One row, one question: did
              you buy it? Round 4 point 4 (2026-07-29) quieted the control to
              one small switch at the right end of the row — off is "want",
              on is "bought"; see StatusToggle in components/atoms.jsx. */}
          <section className="cz-detail-facts-section cz-detail-facts-status" aria-label="Bought">
            <div className="cz-detail-panel-field">
              <span>Bought</span>
              <StatusChips value={view.findStatus} onChange={pickStatus} label="Bought" />
            </div>
          </section>

          <section className="cz-detail-facts-section" aria-label="Haul">
            <HaulAccordionField
              label="Haul"
              value={view.project}
              knownHauls={knownHauls}
              onChange={(next) => edit("project", next)}
              onCommit={(next) => edit("project", next)}
            />
          </section>

          <section className="cz-detail-facts-section" aria-label="Colorway">
            <label className="cz-detail-panel-field">
              <span>Colorway</span>
              <input
                className="cz-detail-editor-input"
                aria-label="Colorway"
                value={view.colorway}
                placeholder="Add a colorway"
                onChange={(event) => edit("colorway", event.target.value)}
                onBlur={() => commitRef.current()}
                onKeyDown={(event) => {
                  event.stopPropagation();
                  if (event.key === "Enter") event.currentTarget.blur();
                }}
              />
            </label>
          </section>

          <section className="cz-detail-facts-section" aria-label="Weight">
            <div className="cz-detail-panel-field">
              <label htmlFor={fieldBaseId + "-weight"}>Weight</label>
              <div className="cz-detail-weight-row">
                <input
                  id={fieldBaseId + "-weight"}
                  className="cz-detail-editor-input"
                  aria-label={"Weight · " + weightUnit}
                  inputMode="decimal"
                  value={weightUnit === "kg" ? weightText : view.weightGrams}
                  onChange={(event) => {
                    const raw = event.target.value;
                    if (weightUnit !== "kg") {
                      edit("weightGrams", raw);
                      return;
                    }
                    setWeightText(raw);
                    const kg = parseFloat(raw);
                    edit(
                      "weightGrams",
                      raw.trim() === "" || Number.isNaN(kg) ? "" : String(Math.round(kg * 1000))
                    );
                  }}
                  onBlur={() => commitRef.current()}
                  onKeyDown={(event) => {
                    event.stopPropagation();
                    if (event.key === "Enter") event.currentTarget.blur();
                  }}
                />
                <div className="cz-detail-unit" role="group" aria-label="Weight unit">
                  {["g", "kg"].map((unit) => (
                    <button
                      key={unit}
                      type="button"
                      className={"cz-detail-unit-btn" + (weightUnit === unit ? " is-active" : "")}
                      aria-pressed={weightUnit === unit}
                      onClick={() => switchWeightUnit(unit)}
                    >
                      {unit}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* SELLER closes the Details list (shelf handoff 2026-07-28,
              README :105). It is a read-only row: tapping it opens the seller's
              other listings in a new tab. The row hides when the item has no
              seller, or when no store page can be built for that seller — a
              dead row is worse than no row. */}
          {item.seller ? (
            <section className="cz-detail-facts-section" aria-label="Seller">
              <div className="cz-detail-panel-field">
                <span>Seller</span>
                {sellerHref ? (
                  <a
                    className="cz-detail-seller-row"
                    href={sellerHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={"Open " + item.seller + " listings"}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <span className="cz-detail-seller-name">{item.seller}</span>
                    <ChevronRight size={14} strokeWidth={2} aria-hidden="true" />
                  </a>
                ) : (
                  <span className="cz-detail-seller-row is-flat">
                    <span className="cz-detail-seller-name">{item.seller}</span>
                  </span>
                )}
              </div>
            </section>
          ) : null}
        </div>

        {lowerEditing ? <div ref={editorSlotRef}>{renderPriceEditor()}</div> : null}

        {logNotesTarget === undefined
          ? logNotesBlock
          : logNotesTarget === null
            ? null
            : createPortal(logNotesBlock, logNotesTarget)}

        {/* QC prompt (§9). It is the LAST block, after the notes, because it
            asks about a moment that has not happened yet. It appears only
            while the order is actually with the agent and no QC photo has
            arrived — a standing "add QC photos" box on a WANT item is asking
            for something that cannot exist. */}
        {showQcPrompt ? (
          <div className="cz-detail-qc-prompt">
            <Camera size={17} strokeWidth={1.9} aria-hidden="true" />
            <span className="cz-detail-qc-prompt-text">
              Add QC photos when your order arrives at the agent
            </span>
            <label className="cz-detail-qc-prompt-btn">
              Add
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  onAttachQcPhoto(item.id, e.target.files && e.target.files[0]);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        ) : null}

      </div>

      {footerPrice || buyButton ? (
        <div className={"cz-detail-foot" + (footerPrice ? " has-price" : "")}>
          {footerPrice ? (
            <div className="cz-detail-foot-row">
              {/* §1 moved price out of the chip row into the footer. The chip
                  was the only way to open the price editor, so the footer has
                  to carry that job now, or price becomes uneditable. */}
              <button
                type="button"
                className={
                  "cz-detail-foot-price" + (editingCell === "price" ? " is-active" : "")
                }
                aria-label={"Edit price: " + footerPrice}
                onClick={() => {
                  if (editingCell === "price") {
                    setEditingCell(null);
                    return;
                  }
                  openPriceEditor();
                }}
              >
                {footerPrice}
              </button>
              {buyButton ? (
                <BuyNotch
                  item={item}
                  label={buyButton.label}
                  url={buyButton.url}
                  preferredAgent={preferredAgent}
                  onSelectAgent={onSelectAgent}
                  onOpen={onOpen}
                />
              ) : null}
            </div>
          ) : buyButton ? (
            <BuyNotch
              item={item}
              label={buyButton.label}
              url={buyButton.url}
              preferredAgent={preferredAgent}
              onSelectAgent={onSelectAgent}
              onOpen={onOpen}
            />
          ) : null}
          {buyButton ? (
            <p className="cz-detail-disclosure">
              Buy links may include a referral code. Credenza may earn a commission on agent
              shipping fees. It never changes your item price.
            </p>
          ) : null}
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
          onRemovePhoto={
            onRemovePhoto
              ? (id, src) => {
                  onRemovePhoto(id, src);
                  resetPager();
                }
              : null
          }
          onLoadPhotos={onLoadPhotos}
        />
      ) : null}
    </>
  );
}
