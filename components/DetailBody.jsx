import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Camera, Check, ChevronDown, ChevronRight, Maximize2, Minimize2, Upload, X } from "lucide-react";
import { listAgents } from "../agents.js";
import PhotoCoverFlow from "./PhotoCoverFlow.jsx";
import CommandBar from "./CommandBar.jsx";
import {
  EditPhotosManager,
  buildEditDraft,
  buildEditPatch,
  CATEGORIES,
  computeRecommendedSize,
  effectiveBodyProfile,
  fetchChartFromPhotos,
  readChartFromPhotoFiles,
  serializeSizeChart,
  FIT_PREF_AXES,
  fitDisplayPrefs,
  fitPrefHasChoice,
  fitPrefLabel,
  fitReadRows,
  formatMeasure,
  compactSizeToken,
  formatSizeToken,
  itemPhotoList,
  DETAIL_PHOTO_CAP,
  linkButtons,
  measureFromStorage,
  measureToStorage,
  parseSizeChart,
  prescriptionSentence,
  lengthCostSentence,
  garmentTypeWord,
  shortsLengthNote,
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
// the album/desc/gallery photos. A found chart writes into its own item field
// and the pick appears.
//
// The sizing block is always visible, so the hunt starts when the detail opens.
// One component owns the hook because two callers would start two paid reads.
// `enabled` lets callers disable the hook without calling it conditionally.
//
function useChartHunt(item, chart, onSaveEdit, enabled = true) {
  const [hunting, setHunting] = useState(false);
  useEffect(() => {
    if (!enabled) return;
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
            sizeChartText: text,
            sizeChartNeedsClear: false,
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
  }, [enabled, chart, item, onSaveEdit]);
  return hunting;
}

// One source of truth keeps the sizing verdict consistent across each view.
function useSizeVerdict(
  item,
  bodyProfile,
  fitPref,
  units,
  detailOverride = null,
  summaryOverride = null,
  chosenSize = ""
) {
  const chart = useMemo(() => parseSizeChart(sizeChartTextFor(item)), [item]);
  // Height+weight estimates fill the tape-measure gaps — flagged estimated
  // so the badge never claims a precise fit it does not have.
  const profile = useMemo(() => effectiveBodyProfile(bodyProfile), [bodyProfile]);
  const rec = chart && profile ? recommendSize(chart, profile, item.category, fitPref, null, item.title) : null;
  const recSize = rec && rec.size ? rec.size : null;
  // `rec` is the advice; `shown` is what every printed number describes. They
  // are the same until the customer taps a different size, and then the panel
  // must print the tapped row (Fable's ruling 2026-07-29: the numbers follow
  // the tap, the advice line keeps the recommendation).
  const pickRead =
    chosenSize && chart && profile
      ? recommendSize(chart, profile, item.category, fitPref, chosenSize, item.title)
      : null;
  const overridden = !!(
    pickRead &&
    pickRead.size &&
    recSize &&
    String(pickRead.size).toUpperCase() !== String(recSize).toUpperCase()
  );
  const shown = pickRead && pickRead.size ? pickRead : rec;
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
      ? prescriptionSentence(chart, shown, {
          units,
          category: item.category,
          detail: fitDetail,
          recommended: overridden ? rec : null,
        })
      : "";
  return {
    chart,
    rec,
    shown,
    overridden,
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
  // Kyle 2026-07-30: "only show the type in the chart photo". One word, on the
  // header of the chart panel itself. It replaces the reason sentence that used
  // to sit under the pick — same fact, no new block, no new row.
  typeWord = "",
  onPick,
  // Kyle 2026-07-29: the fifth box rides at the right of the cell run, on the
  // same line as the sizes it overrides. Null when the caller has no box.
  customBox = null,
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
      ? "SELLER'S CHART"
      : recSize
        ? "BEST GUESS"
        : isManual
          ? ""
          : "YOUR USUAL";

  // "your usual is L too" — only worth saying when the AI pick and the
  // customer's usual size agree. Silent otherwise; a disagreement is the
  // prescription's job to explain, not a subtitle's. Round 5 point 5.1: a
  // hand pick names itself here and nowhere else.
  // A hand pick that disagrees with the recommendation says so, and names the
  // size we would take — handoff copy deck row "Qualifier, user overrode".
  // Without it the panel prints the tapped size's centimetres under a bare
  // "you picked this" and the customer never learns our advice.
  const overrodeName =
    isManual && recSize && String(chosenSize).toUpperCase() !== String(recSize).toUpperCase()
      ? formatSizeToken(recSize) || recSize
      : "";
  // A tap that lands on the recommendation earns the agreement line and the
  // room it buys — copy deck row "Qualifier, recommended". Negative ease is
  // not room, so that case keeps the plain notice.
  const agreedRoom =
    isManual && recSize && !overrodeName && rec && rec.diff != null && rec.diff >= 0
      ? formatMeasure(rec.diff, units)
      : "";
  const aside =
    !isManual && recSize && usualSize && String(recSize).toUpperCase() === String(usualSize).toUpperCase()
      ? "your usual too"
      : overrodeName
        ? "your pick · we'd take the " + overrodeName
        : agreedRoom
          ? "we recommend this · " + agreedRoom + " of room"
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
        {typeWord ? <span className="cz-sizing-type">{typeWord}</span> : null}
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
            // Kyle 2026-07-30: green keeps ONE meaning — the app's pick. A
            // hand pick that disagrees goes gray (is-pick-manual), and the
            // recommended cell claims the green: a pulse on open, then a
            // steady outline with an OUR PICK tag (F's ruling in #design).
            const isRec =
              !!recSize &&
              String(row.size).toUpperCase() === String(recSize).toUpperCase();
            const recOutlined = isRec && !picked;
            return (
              <button
                key={row.size}
                type="button"
                className={
                  "cz-sizing-cell" +
                  (picked ? " is-pick" : "") +
                  (picked && isManual && !isRec ? " is-pick-manual" : "") +
                  (recOutlined ? " is-rec" : "")
                }
                aria-pressed={isManual && picked}
                onClick={() =>
                  onPick && onPick(isManual && picked ? "" : String(row.size))
                }
              >
                <span className="cz-sizing-cell-k">{formatSizeToken(row.size) || row.size}</span>
                <span className="cz-sizing-cell-v">{formatMeasure(row[measureKey], units)}</span>
                {recOutlined ? <span className="cz-sizing-cell-tag">Our pick</span> : null}
                {/* Phone panes (mobile item sheet spec 6.3): the picked card
                    names itself YOUR PICK, and the recommended card keeps its
                    OUR PICK tag even when it is the pick. The tag is display:
                    none outside the phone sheet, so the desktop card back is
                    unchanged. */}
                {!recOutlined && (isRec || (picked && isManual)) ? (
                  <span className="cz-sizing-cell-tag cz-sizing-cell-tag-phone">
                    {isRec ? "Our pick" : "Your pick"}
                  </span>
                ) : null}
              </button>
            );
          })}
          {customBox}
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
// One empty preview, shared by every exit the read has. `typed` marks a chart
// the customer is typing by hand: there is no photo behind it, so the preview
// opens on the grid and commits from the grid.
const EMPTY_CHART_READ = {
  reading: false,
  chart: null,
  text: "",
  thumb: "",
  error: "",
  dirty: false,
  count: 0,
  typed: false,
};

// The columns a hand-typed chart offers, per category. Only labels sellers
// actually print (Kyle 2026-07-30: "we should only use what the charts are
// using"). Bottoms get waist, hip and 裤长; everything else gets the four top
// columns. A column left empty is simply dropped.
const TYPE_IN_COLUMNS = {
  pants: ["waist", "hip", "pantsLength"],
  shorts: ["waist", "hip", "pantsLength"],
};
const TYPE_IN_TOP_COLUMNS = ["chest", "length", "shoulder", "sleeve"];
const TYPE_IN_SIZES = ["S", "M", "L", "XL"];

function useCustomerChartRead(item, onSaveEdit) {
  // `count` is how many photos the open read was handed — the fit-read
  // footnote says "Reading four photos…" and a hard-coded four would lie
  // about a single upload.
  const [state, setState] = useState(EMPTY_CHART_READ);
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
    setState(EMPTY_CHART_READ);
  }, [item.id]);

  const read = async (sources, { thumb = "", referer = "" } = {}) => {
    const list = Array.isArray(sources) ? sources : [sources];
    setState({ ...EMPTY_CHART_READ, reading: true, thumb, count: list.length });
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
        ...EMPTY_CHART_READ,
        thumb,
        error: text
          ? "I read the photo but could not find sizes in it. Try a straighter shot of the table."
          : "I could not read that photo. Try again with the whole table in frame.",
      });
      return;
    }
    setState({ ...EMPTY_CHART_READ, chart, text, thumb });
  };

  // Kyle 2026-07-30: "let you type the chart numbers by hand in twenty
  // seconds". A blank chart is staged in the same preview a photo read uses,
  // so one grid, one confirm and one save path serve both. Nothing is stored
  // until the customer presses save.
  const startTyping = (category) => {
    const cols = TYPE_IN_COLUMNS[category] || TYPE_IN_TOP_COLUMNS;
    setState({
      ...EMPTY_CHART_READ,
      typed: true,
      dirty: true,
      chart: { rows: TYPE_IN_SIZES.map((size) => ({ size })), columns: cols },
    });
  };

  const commit = () => {
    // A typed chart has no read text behind it, so the grid IS the source.
    if (!state.text && !state.typed) return;
    // Corrections live on the staged chart, so the text comes from IT and not
    // from the raw read. Fall back to the read when nothing was corrected, or
    // when a correction emptied the chart past the point of serializing.
    const fixed = state.dirty ? serializeSizeChart(state.chart) : "";
    const text = fixed && parseSizeChart(fixed) ? fixed : state.text;
    if (!text) {
      setState((prev) => ({
        ...prev,
        error: "Type at least two sizes with one measurement each, then save.",
      }));
      return;
    }
    onSaveEdit(item.id, {
      sizeChartText: text,
      sizeChartNeedsClear: false,
      sizeChartSource: {
        via: state.typed ? "customer-typed" : "customer-photo",
        photos: state.typed ? 0 : 1,
        at: new Date().toISOString(),
        ...(item.seller ? { seller: String(item.seller).slice(0, 60) } : {}),
      },
    });
    setState(EMPTY_CHART_READ);
  };

  const dismiss = () => setState(EMPTY_CHART_READ);

  // A corrected cell rewrites the staged chart. It does NOT re-parse: a
  // half-typed "1" is under the parser's 20cm floor, so a round trip per
  // keystroke would blank the cell under the customer's fingers. The text is
  // regenerated once, at commit.
  const fix = (nextChart) => {
    setState((prev) => ({ ...prev, chart: nextChart, dirty: true, error: "" }));
  };

  return { ...state, read, commit, dismiss, fix, startTyping };
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

function SizingBlockNoChart({
  usualSize,
  isManual = false,
  albumPhotos,
  albumCount,
  onOpenAlbum,
  needsClear = false,
  onClearChart,
  needsSignIn = false,
}) {
  const heroLabel = formatSizeToken(usualSize) || usualSize || "";
  const thumbs = (albumPhotos || []).slice(0, 2);

  return (
    <section className="cz-sizing cz-sizing-nochart" aria-label="Sizing recommendation">
      <div className="cz-sizing-head">
        <span className="cz-sizing-dot" aria-hidden="true" />
        {/* The server refused to read this link because nobody is signed in.
            The card says so here, where the chart belongs, so an empty card
            never reads as a broken site (Kyle 2026-07-30). */}
        <span className="cz-sizing-kicker">{needsSignIn ? "Needs sign-in" : "No chart"}</span>
        {/* Round 5 point 5.1: one notice for a hand pick — "you picked this"
            beside the size word. The "SET BY YOU" label here was a second
            copy, so a hand pick now leaves the provenance slot empty.
            2026-07-29 (Oom review): the fallback line shows only when a
            usual size EXISTS to fall back to — "FELL BACK TO YOUR USUAL"
            beside "no usual size saved" contradicts itself. */}
        {isManual || !heroLabel ? null : <span className="cz-sizing-prov">FELL BACK TO YOUR USUAL</span>}
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
        {needsSignIn
          ? "Sign in to finish this card. Credenza then reads the product, the photos, and the size chart."
          : needsClear
          ? "This saved chart came from another item. It is hidden. Clear it before reading this item's photos."
          : /* Kyle 2026-07-30: keep this state short. Two lines, then the
               buttons. The old copy explained the upload button that sits
               directly below it. */
            "No size chart found."}
      </p>

      {/* A photo read costs the same refused call, so hide the album row until
          the visitor signs in. */}
      {needsSignIn ? null : needsClear && onClearChart ? (
        <button type="button" className="cz-sizing-albumrow" onClick={onClearChart}>
          <span className="cz-sizing-albumtext">Clear this chart</span>
          <ChevronRight size={14} strokeWidth={2.4} aria-hidden="true" />
        </button>
      ) : albumCount ? (
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
// With no chart the table used to ghost — names in placeholder, YOURS kept, no
// band and no marks — so the customer saw what a chart would unlock. Round 5
// point 5.4 tried to hide it; Fable ruled against that on 2026-07-29 and the
// rule was "not without Kyle's word".
// KYLE'S WORD, 2026-07-30: "if we can't find the chart, we don't want this to
// take up the entire right side of the page." The caller now hides the table in
// the no-chart state (see `noChart` in DetailBody). `hasChart={false}` still
// ghosts, because a read in flight has no chart yet and keeps the table.
// Row math lives in fitReadRows (pure, tested on its own).
function FitReadTable({ rows, hasChart, units, reading, readingCount, onEditMeasures, onForgetChart, outsidePhrasing = false }) {
  if (!rows.length) return null;
  const insideCount = rows.filter((r) => r.mark != null && !r.warn).length;
  const scoredCount = rows.filter((r) => r.mark != null).length;
  // Copy deck: "All four inside tolerance." — the count is spelled out.
  const COUNT_WORDS = ["", "one", "two", "three", "four", "five", "six", "seven"];
  const word = (n) => COUNT_WORDS[n] || String(n);
  // A torso estimate (Body length, from height) is labelled twice: a "~" on
  // the number itself and a plain sentence in the footnote (Kyle 2026-07-30).
  const estNote = rows.some((r) => r.estimated)
    ? " Body length is estimated from your height."
    : "";
  // Kyle 2026-07-30: "show a clear warning when it is not measured". A blank
  // THEIRS cell on a chart we hold means the seller printed no such column.
  // The footnote says so in words, and the cell reads "not on chart" instead
  // of a dash that could mean anything.
  const missing = hasChart ? rows.filter((r) => r.notOnChart).map((r) => r.name.toLowerCase()) : [];
  const missNote = missing.length
    ? " The seller does not print the " + listPhrase(missing) + ". Type it in or read the chart photo."
    : "";
  const footnote = reading
    ? "Reading " +
      (readingCount === 1 ? "one photo" : word(readingCount || 0) + " photos") +
      "…"
    : // Phone fit pane (mobile item sheet spec 6.3): the tolerance line
      // counts what is OUT, not what is in — "1 of two outside tolerance."
      // The desktop card back keeps the inside-count copy below.
      outsidePhrasing && hasChart && scoredCount > 0
      ? scoredCount - insideCount + " of " + word(scoredCount) + " outside tolerance." + estNote + missNote
      : (!hasChart
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
              " inside tolerance.") + estNote + missNote;
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
          <span
            className={"cz-fitread-theirs" + (r.theirs == null ? " is-unknown" : "")}
            title={r.notOnChart ? "The seller's chart has no " + r.name.toLowerCase() : undefined}
          >
            {r.theirs != null ? formatMeasure(r.theirs, units) : r.notOnChart ? "n/a" : "—"}
          </span>
          <span className="cz-fitread-yours">
            {r.yours != null
              ? (r.estimated ? "~" : "") + formatMeasure(r.yours, units)
              : "—"}
          </span>
          <span className={"cz-fitread-ease" + (r.warn ? " is-warn" : "")}>
            {r.ease != null ? (r.ease >= 0 ? "+" : "") + formatMeasure(r.ease, units) : "—"}
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
function SizingBlockReading({ reading, chart, thumb, error, units, typed = false, onUse, onRetry, onFix }) {
  // "Fix a number" (spec §3): the vision read gets a digit wrong often enough
  // that a chart with one bad cell must be salvageable. Without this the only
  // options are accept a wrong chart or throw the whole read away.
  const [fixing, setFixing] = useState(false);
  const rows = chart && Array.isArray(chart.rows) ? chart.rows : [];
  // The measurement keys the parser actually filled, in the order the table had
  // them. `size` is the row label, not a measurement.
  // A hand-typed chart names its own columns: every cell starts empty, so
  // reading the keys off the first row would give an empty grid.
  const columns =
    chart && Array.isArray(chart.columns) && chart.columns.length
      ? chart.columns
      : rows.length
        ? Object.keys(rows[0]).filter((k) => k !== "size" && rows[0][k] != null)
        : [];
  const filledColumns = columns.filter((k) => rows.some((r) => r[k] != null));
  const provenance = typed
    ? "YOUR NUMBERS"
    : reading
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
        <span className="cz-sizing-kicker">
          {typed ? "Type the chart" : error ? "No chart" : "Reading chart"}
        </span>
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
              : typed
                ? "Type the seller's numbers in centimetres. Leave a box empty when the chart does not show it."
                : filledColumns.length
                  ? "I found " + listPhrase(filledColumns.map(measureWord)) + " for " +
                    rows.length + " size" + (rows.length === 1 ? "" : "s") + "."
                  : "I read the table but could not name its columns."}
        </p>
      </div>

      {(fixing || typed) && chart ? (
        <ChartFixGrid
          rows={rows}
          columns={columns}
          units={units}
          onFix={onFix}
          /* Typing by hand also names the sizes: a shorts chart runs 36/38/40,
             not S/M/L, and the buttons must read the seller's own words. */
          renameSizes={typed}
        />
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
              {typed ? "Save this chart" : "Use this chart"}
            </button>
          ) : null}
          {/* A typed chart is already in the grid, so "Fix a number" would open
              the thing that is open. It gets one way out instead. */}
          {typed ? (
            <button type="button" className="cz-sizing-read-retry" onClick={onRetry}>
              Cancel
            </button>
          ) : (
            <>
              <button
                type="button"
                className="cz-sizing-read-retry"
                onClick={chart ? () => setFixing((v) => !v) : onRetry}
              >
                {chart ? (fixing ? "Done fixing" : "Fix a number") : "Try another photo"}
              </button>
              {/* Rejecting the whole read still needs a way out, and it must not
                  be the same button as the per-cell fix. */}
              {chart ? (
                <button type="button" className="cz-sizing-read-retry is-wide" onClick={onRetry}>
                  Not this one
                </button>
              ) : null}
            </>
          )}
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
function ChartFixGrid({ rows, columns, units, onFix, renameSizes = false }) {
  const cols = columns.length ? columns : ["chest"];
  // The column list is the grid's own shape, not something to re-derive from
  // the cells. A hand-typed chart starts with every cell empty, and dropping
  // the list here would collapse the grid on the first keystroke.
  const lift = (nextRows) => onFix({ rows: nextRows, columns: cols });
  const setSize = (rowIndex, raw) => {
    const name = String(raw).replace(/[^0-9a-zA-Z/. -]/g, "").slice(0, 10);
    lift(rows.map((row, i) => (i === rowIndex ? { ...row, size: name } : row)));
  };
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
    lift(next);
  };

  return (
    <div className={"cz-sizing-fix" + (renameSizes ? " is-typed" : "")}>
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
        /* Keyed by position: the size name is editable here, and keying on it
           would rebuild the input on every keystroke and drop the caret. */
        <div key={i} className="cz-sizing-fix-row">
          {renameSizes ? (
            <input
              className="cz-sizing-fix-size cz-sizing-fix-cell"
              type="text"
              maxLength={10}
              aria-label={"Size name, row " + (i + 1)}
              value={row.size == null ? "" : String(row.size)}
              onChange={(e) => setSize(i, e.target.value)}
            />
          ) : (
            <span className="cz-sizing-fix-size">{formatSizeToken(row.size) || row.size}</span>
          )}
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
  pantsLength: "length",
  shortsLength: "length",
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

// Kyle 2026-07-29, BUILD_PLAN step 5.2: "that fifth box to the right as a
// custom size". The box is the only field that takes sizes like "170/92A",
// "EU 44" and "One size", so it is always visible and it wears the shape of
// the boxes beside it. This replaces round 5.7, which hid it behind a "Type a
// different size" link — Fable blocked that on 2026-07-29.
// Two hosts, one box: the chart cells when the seller has a chart, the plain
// chip run when it does not. `className` names the host.
function CustomSizeBox({ className, value, onChange, onCommit }) {
  return (
    <input
      className={className}
      aria-label="Custom item size"
      placeholder="Other"
      value={value}
      onChange={(event) => onChange(event.target.value)}
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
  );
}

function SizeChoiceEditor({ chosenSize, recommendedSize, runValues, choicesHidden = false, customSize, onCustomChange, onCommit, onPick }) {
  const choices = chipSizes(runValues, chosenSize || recommendedSize);
  // The chart cells host the box themselves when they are on screen, so this
  // editor draws nothing at all rather than a second, lonely box below them.
  if (choicesHidden) return null;
  const customBox = (
    <CustomSizeBox
      className="cz-detail-size-choice is-custom"
      value={customSize}
      onChange={onCustomChange}
      onCommit={onCommit}
    />
  );

  return (
    <div className="cz-detail-size-editor">
      {/* 2026-07-28 — one place for size. The heading said "Item size" and
          repeated the recommendation in words; the ringed chip already says
          it. The custom field was a second full-width bar holding the same
          value as the filled chip. Both are gone: the row below is the only
          place the size is set. */}
      {choices.length ? (
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
                aria-label={formatSizeToken(size) || size}
                onClick={() => onPick(String(size))}
              >
                {/* Compact mark on the face ("XL"), full word for the screen
                    reader ("X-Large") — SIZE_CHIP_COMPACT_PLAN 2026-07-29. */}
                {compactSizeToken(size) || size}
              </button>
            );
          })}
          {/* The fifth box sits at the right of the size run, not on a row of
              its own — Kyle asked for one row of boxes. */}
          {customBox}
          {chosenSize ? (
            <button type="button" className="cz-detail-size-choice is-clear" onClick={() => onPick("")}>
              Clear size
            </button>
          ) : null}
        </div>
      ) : (
        // No size run to show. The box still stands, because it is the only
        // way to record a size the seller never listed.
        <div className="cz-detail-size-choices" aria-label="Item size choices">
          {customBox}
        </div>
      )}
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
  // The numbers describe the size on screen, which is the tapped one whenever
  // the customer tapped. `verdict.shown` falls back to the recommendation.
  const rec = verdict.shown || verdict.rec;
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
    // Empty unless the saved shirt length moved the pick (Kyle 2026-07-30).
    const lengthCost = lengthCostSentence(rec, { units });
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
        {/* Kyle 2026-07-30: the saved shirt length may move the pick off the
            size the chest chose. When it does, the app must say so and name
            what the chest paid — never a silent size change. */}
        {lengthCost ? <p className="cz-fit4-prose">{lengthCost}</p> : null}
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
      ? "Add waist & length"
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
  // The two-column panel can place the Timeline under its photo without
  // taking ownership of the notes draft. Undefined keeps it inline for
  // every existing caller; null suppresses the pre-mount desktop frame.
  // (Notes no longer ride this slot — Kyle 2026-07-30: the notes writer
  // lives at the bottom of the decision column.)
  logNotesTarget = undefined,
  // Handoff §3: the desktop panel hands the command bar a full-width slot
  // above both columns. Same contract as logNotesTarget — undefined keeps the
  // bar inline (phone sheet, tablet band), null suppresses it before mount.
  commandBarTarget = undefined,
  // Handoff section 3 region order: title, then bar, then body. Same contract
  // as commandBarTarget — undefined keeps the title inline.
  titleTarget = undefined,
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
  const reduced = usePrefersReducedMotion();

  // The photo pager is part of the shared body — the phone sheet and the
  // desktop card back show the same photos the same way. Shell chrome
  // (close, ⋯ menu) comes in through renderHeroActions; the desktop back
  // passes none because its card header already carries those.
  const [photoIdx, setPhotoIdx] = useState(0);
  const [pane, setPane] = useState("fit");
  // Phone sheet (mobile item sheet spec §7): a size tap confirms itself with
  // a one-line toast, "Sized Medium", cleared after 1900ms. The app-wide
  // toast region lives under the native dialog's top layer, so the sheet
  // carries its own.
  const [sizeToast, setSizeToast] = useState("");
  const sizeToastTimer = useRef(null);
  useEffect(() => () => clearTimeout(sizeToastTimer.current), []);
  // Round 4 point 7 (2026-07-29): a failed photo draws the brand tile, never
  // the browser's broken-image mark. Tracked per photo URL — one bad photo
  // must not hide the good ones.
  const [badPhotos, setBadPhotos] = useState(() => new Set());
  const trackRef = useRef(null);
  const photos = heroPager ? itemPhotoList(item, DETAIL_PHOTO_CAP) : [];

  useEffect(() => {
    setPane("fit");
    setPhotoIdx(0);
  }, [item.id]);

  // §9 sticky bar. The photo block used to leave a stranded sliver of image
  // above the title as you scrolled. The bar replaces that sliver: thumb,
  // title, size · price, close. It only exists where the shell gives us a
  // close action, which is the phone sheet.
  const heroRef = useRef(null);
  const titleRowRef = useRef(null);
  const scrollRef = useRef(null);
  const [heroGone, setHeroGone] = useState(false);
  const wantsStickyBar = heroPager && typeof onRequestClose === "function";
  useEffect(() => {
    if (!wantsStickyBar) return undefined;
    // Kyle 2026-07-29: the bar used to watch the PHOTO, so between "photo
    // gone" and "title gone" the sheet printed the item name twice — once in
    // the bar and once in the big title right under it. Watch the TITLE ROW
    // instead: the bar only takes the name over once the big one has left.
    // The hero stays the fallback for a caller with no inline title row.
    const watched = titleRowRef.current || heroRef.current;
    const root = scrollRef.current;
    // jsdom has no IntersectionObserver, and neither does an old iOS. No
    // observer means no bar — the sheet reads exactly as it did before §9.
    if (!watched || !root || typeof IntersectionObserver === "undefined") return undefined;
    const io = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        if (e) setHeroGone(!e.isIntersecting);
      },
      // The bar arrives as the LAST of the watched block leaves, not the
      // first: a threshold of 0 flips the moment one pixel is gone.
      { root, threshold: 0 }
    );
    io.observe(watched);
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
  // Read the tapped size before the verdict: the verdict prints that row's
  // measurements, so it has to know the tap. `view` is settled well above.
  const chosenSize = String(view.size || "").trim();
  const verdict = useSizeVerdict(
    item,
    bodyProfile,
    fitPref,
    measureUnits,
    fitDetail,
    fitSummary,
    chosenSize
  );
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
  // shown.diff — a raw-profile table would show a different chest than the one
  // the read was scored against. `shown`, not `rec`: the rows describe the
  // size the customer tapped.
  const fitRows = useMemo(
    () =>
      SIZE_PICK_SKIP_CATEGORIES.has(item.category)
        ? []
        : fitReadRows(
            verdict.chart,
            verdict.shown,
            effectiveBodyProfile(bodyProfile),
            item.category,
            item.title
          ),
    [verdict.chart, verdict.shown, bodyProfile, item.category, item.title]
  );
  // "Forget this chart" (split rail): the parse was wrong, so the stored
  // measurements go. Only offered when dropping sizeNotes actually kills the
  // chart — one parsed from the listing's own text would survive the clear,
  // and a link that does nothing teaches the customer not to trust links.
  const chartIsForgettable = useMemo(
    () =>
      !!verdict.chart &&
      (!!item.sizeChartText || !parseSizeChart(sizeChartTextFor({ ...item, sizeNotes: "" }))),
    [verdict.chart, item]
  );
  const forgetChart = () => {
    chartHuntTried.delete(item.id);
    onSaveEdit(
      item.id,
      item.sizeChartText
        ? { sizeChartText: "", sizeChartSource: null, sizeChartNeedsClear: false }
        : { sizeNotes: "", sizeChartSource: null, sizeChartNeedsClear: false }
    );
  };
  const clearBlockedChart = () => {
    chartHuntTried.delete(item.id);
    onSaveEdit(item.id, {
      sizeChartText: "",
      sizeChartSource: null,
      sizeChartNeedsClear: false,
      sizeChartIgnoreNotes: true,
    });
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
  const hunting = useChartHunt(item, verdict.chart, onSaveEdit, !item.sizeChartNeedsClear);
  // §3: the customer's own chart read, and the album photos its third option
  // offers. Remote URLs only — a local data: URL cannot go down the images door.
  const chartRead = useCustomerChartRead(item, onSaveEdit);
  // No chart, and none on the way. Kyle 2026-07-30: "if we can't find the
  // chart, we don't want this to take up the entire right side of the page."
  // Everything downstream of a chart — the fit table, the confidence strip, the
  // type word and the fit sentence — has nothing to say without one, so the
  // section collapses to the size, the buttons and the two ways to get a chart.
  // A read in flight is NOT this state: the ghost table carries the reading
  // sweep and footnote, and pulling it mid-read would blank the section.
  const noChart = !verdict.chart && !hunting && !chartRead.reading;
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
  useEffect(() => {
    setCustomSize(chosenSize);
    customSizeCommittedRef.current = chosenSize;
  }, [item.id, chosenSize]);
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
  const stickyMeta = [sizeText ? String(sizeText).toUpperCase() : "", priceLabelShort(item)]
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
  // Item counts for the haul popover (item-detail handoff 2026-07-29, §5.3).
  // Only the callers that hand us the shelf can have them; without the shelf
  // the chip shows the haul names with no count rather than a wrong one.
  const haulCounts = useMemo(() => {
    if (!Array.isArray(shelfItems)) return null;
    const counts = {};
    for (const entry of shelfItems) {
      const name = String((entry && entry.project) || "").trim();
      if (name) counts[name] = (counts[name] || 0) + 1;
    }
    return counts;
  }, [shelfItems]);

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

  // The weight write, lifted out of the old rail row so the command-bar chip
  // and any later caller share one path (item-detail handoff 2026-07-29).
  // Storage is always grams; the g/kg switch only changes what is displayed.
  // The field takes digits and at most one decimal point — a stray letter in a
  // weight silently becomes NaN and clears the parcel estimate.
  const writeWeight = (raw) => {
    const clean = String(raw).replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");
    if (weightUnit !== "kg") {
      edit("weightGrams", clean);
      return;
    }
    setWeightText(clean);
    const kg = parseFloat(clean);
    edit(
      "weightGrams",
      clean.trim() === "" || Number.isNaN(kg) ? "" : String(Math.round(kg * 1000))
    );
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
    // Spec §7: "Tap a size card — the pick, the verdict, the reasoning, the
    // ease values, and the markers update. Toast: Sized Medium." Clearing a
    // pick (empty size) stays silent; the desktop card back never toasts.
    if (wantsStickyBar && cleaned) {
      clearTimeout(sizeToastTimer.current);
      setSizeToast("Sized " + (formatSizeToken(cleaned) || cleaned));
      sizeToastTimer.current = setTimeout(() => setSizeToast(""), 1900);
    }
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

  // Kyle 2026-07-30: one block became two. The timeline still portals into
  // the desktop panel's photo column (logNotesTarget), but the notes writer
  // stays inline at the END of the decision column — "move the notes sheet
  // to the bottom of the right side, it's crunched on the left". On the
  // phone sheet both render right here, in the same order as before.
  const timelineBlock = (
    <>
      {/* Timeline (§6). Generated from fields the item already carries, so
          it renders only when there is something true to say. Round 4 point
          5 removed the TIMELINE heading — the rows speak for themselves. */}
      {timeline.length ? <Timeline rows={timeline} /> : null}
    </>
  );

  const notesBlock = (
    <>
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

  /* THE COMMAND BAR (item-detail handoff 2026-07-29, rule 1: "the rail is
     dead"). Status, haul, colorway, weight and category were five labelled
     fields stacked under the sizing block. Five short fields can never fill
     the height of a photo, so the panel read as bloated and empty at once.
     They are one chip row now. Everything the USER SETS lives here;
     everything the PRODUCT ADVISES stays in the sizing block below.
     See commandBarBlock below. */
  /* Title. The text itself is the tap target — there is no Title field and
     no Save button. Blur commits through the debounce. On the desktop panel
     the title portals into the full-width header above the command bar
     (handoff section 3); everywhere else it stays inline. */
  const titleBlock = (
    <div className="cz-detail-title-row" ref={titleRowRef}>
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
  );

  const commandBarBlock = (
    <CommandBar
      item={item}
      view={view}
      edit={edit}
      commit={() => commitRef.current()}
      onSaveEdit={onSaveEdit}
      pickStatus={pickStatus}
      knownHauls={knownHauls}
      haulCounts={haulCounts}
      sellerHref={sellerHref}
      weightUnit={weightUnit}
      weightText={weightText}
      onWeightChange={writeWeight}
      onSwitchWeightUnit={switchWeightUnit}
    />
  );

  const mobileRecommended = verdict.recSize || verdict.usualSize || chosenSize;
  const mobileRecommendedWord =
    formatSizeToken(mobileRecommended) || String(mobileRecommended || "").trim();
  const mobileChosenWord = formatSizeToken(chosenSize) || chosenSize;
  const mobileOutsideCount = fitRows.filter((row) => row.warn).length;
  const mobileFitKicker = verdict.chart ? "We recommend" : "No seller chart";
  const mobileConfidence = verdict.chart
    ? mobileOutsideCount
      ? "Roomy for this cut"
      : "Precise fit"
    : "Says when it doesn't know";
  const mobileVerdict = verdict.chart
    ? !mobileRecommendedWord
      ? "No confident size yet."
      : chosenSize &&
          verdict.recSize &&
          String(chosenSize).toUpperCase() === String(verdict.recSize).toUpperCase()
        ? "The " + mobileChosenWord + " is the one."
        : "Take the " + mobileRecommendedWord + "."
    : "We'd keep your usual " + (mobileRecommendedWord || "size") + ".";
  const mobileReason =
    verdict.prescription ||
    (verdict.chart
      ? "This pick uses the seller's chart and your saved measurements."
      : "This listing has no seller chart, so this is your saved usual size.");

  const mobileFitIntro = (
    <div className={"cz-mobile-fit-intro" + (mobileOutsideCount ? " is-warn" : "")}>
      <div className="cz-mobile-fit-kicker-row">
        <span className="cz-mobile-fit-kicker">{mobileFitKicker}</span>
        <span className="cz-mobile-fit-confidence">
          <span className="cz-mobile-fit-confidence-dot" aria-hidden="true" />
          {mobileConfidence}
        </span>
      </div>
      <h2 className="cz-mobile-fit-verdict">{mobileVerdict}</h2>
      <p className="cz-mobile-fit-reason">{mobileReason}</p>
    </div>
  );

  return (
    <>
      {/* Sticky bar (§9). It pins under the drag handle once the photo block
          has scrolled away, so the sheet always says which item you are in.
          aria-hidden while it is up: every control on it repeats one that is
          already in the sheet, so a screen reader gains nothing and a
          duplicate title is worse than no bar. */}
      {wantsStickyBar ? (
        <div
          className={"cz-detail-stickybar cz-detail-pane-header" + (heroGone ? " is-up" : "")}
          aria-hidden={false}
        >
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
            onClick={onRequestClose}
          >
            <X size={16} strokeWidth={2.4} aria-hidden="true" />
          </button>
        </div>
      ) : null}

      {wantsStickyBar ? (
        <div className="cz-detail-pane-picker" role="tablist" aria-label="Item section">
          {[
            ["fit", "Fit"],
            ["photos", "Photos · " + photos.length],
            ["details", "Details"],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={pane === key}
              className={pane === key ? "is-active" : ""}
              onClick={() => setPane(key)}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      <div
        ref={scrollRef}
        className={
          "cz-detail-scroll" +
          (editingCell ? " is-editing" : "") +
          (wantsStickyBar ? " has-panes" : "")
        }
        data-pane={wantsStickyBar ? pane : undefined}
      >
        <section
          className="cz-detail-pane cz-detail-pane-photos"
          role={wantsStickyBar ? "tabpanel" : undefined}
          aria-label={wantsStickyBar ? "Photos" : undefined}
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
            <div className="cz-detail-photo-strip-head">
              <span>Photos</span>
              <span aria-hidden="true" />
              <span>
                {photos.length} · cover {photoIdx + 1}
              </span>
            </div>
            <div className="cz-detail-photos">
              <EditPhotosManager
                item={item}
                onAttachPhoto={onAttachPhoto}
                onOpenPhoto={(i) => setPhotoView({ startIndex: i })}
              />
            </div>
            <AlbumLinksRow item={item} />
            <p className="cz-detail-photo-footnote">
              Cover is the photo the shelf card shows. QC photos appear here after your agent sends them.
            </p>
          </div>
        ) : null}
        </section>

        {/* Title. The text itself is the tap target — there is no Title
            field and no Save button. Blur commits through the debounce. */}
        <div className="cz-detail-pane-title">
        {titleTarget === undefined
          ? titleBlock
          : titleTarget === null
            ? null
            : createPortal(titleBlock, titleTarget)}
        </div>

        {/* The bar is inline on the phone sheet and the tablet band. On the
            desktop panel it portals to a full-width slot above both columns
            (handoff §3) — five chips do not fit one row inside the decision
            column. See commandBarBlock above. */}
        <div className="cz-detail-pane cz-detail-pane-details cz-detail-pane-command">
        {commandBarTarget === undefined
          ? commandBarBlock
          : commandBarTarget === null
            ? null
            : createPortal(commandBarBlock, commandBarTarget)}
        </div>

        {/* Split rail: the four detail tabs are gone. Size, colorway, weight
            and haul are always-visible facts — three of them hidden behind a
            tab bar made the card a guessing game. */}
        <div className="cz-detail-facts cz-detail-pane cz-detail-pane-fit">
          <section className="cz-detail-facts-section" aria-label="Size and fit">
            {wantsStickyBar ? mobileFitIntro : null}
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
                needsClear={item.sizeChartNeedsClear}
                needsSignIn={item.needsSignIn === true}
                onClearChart={clearBlockedChart}
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
                typeWord={garmentTypeWord(verdict.rec)}
                onPick={pickItemSize}
                customBox={
                  <CustomSizeBox
                    className="cz-sizing-cell is-custom"
                    value={customSize}
                    onChange={setCustomSize}
                    onCommit={commitCustomSize}
                  />
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
              !noChart &&
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

            {/* Fit engine v2 named the garment in a full sentence here. Kyle
                cut it on 2026-07-30: "only show the type in the chart photo".
                The word now rides the chart panel's header (SizingBlock
                typeWord) and this row is gone. */}
            {/* Shorts only, and only when a shorts length is saved. Both
                numbers are waistband to hem — the seller's own measurement —
                so the line states the difference instead of estimating one. */}
            {shortsLengthNote(verdict.rec, bodyProfile, item.category, { units: measureUnits }) ? (
              <p className="cz-sizing-garment">
                {shortsLengthNote(verdict.rec, bodyProfile, item.category, { units: measureUnits })}
              </p>
            ) : null}
            {verdict.prescription && !noChart ? (
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
            ) : typeof onToggleFitSummary === "function" &&
              !fitSummaryOn &&
              !noChart &&
              verdict.recSize ? (
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

            {!askingMeasures && !noChart ? (
              <FitReadTable
                rows={fitRows}
                hasChart={!!verdict.chart}
                units={measureUnits}
                reading={chartRead.reading}
                readingCount={chartRead.count}
                outsidePhrasing={wantsStickyBar}
                onEditMeasures={wantsStickyBar ? null : onOpenSizes ? openProfileSizes : null}
                onForgetChart={
                  wantsStickyBar ? null : chartIsForgettable ? forgetChart : null
                }
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
              {/* Kyle 2026-07-30: a chart photo is not always readable, and a
                  seller sometimes prints the numbers in the listing text. Four
                  sizes by four columns is about twenty seconds of typing. */}
              <button
                type="button"
                className="cz-detail-chart-upload"
                onClick={() => chartRead.startTyping(item.category)}
              >
                Input sizing chart manually
              </button>
              {wantsStickyBar && onOpenSizes ? (
                <button
                  type="button"
                  className="cz-detail-chart-link"
                  onClick={openProfileSizes}
                >
                  Edit my measurements
                </button>
              ) : null}
              {wantsStickyBar && chartIsForgettable ? (
                <button
                  type="button"
                  className="cz-detail-chart-link"
                  onClick={forgetChart}
                >
                  Forget this chart
                </button>
              ) : null}
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
                typed={chartRead.typed}
                onUse={chartRead.commit}
                onRetry={chartRead.dismiss}
                onFix={chartRead.fix}
              />
            ) : null}
          </section>

          {/* The Details kicker and the five rows under it are gone (item-detail
              handoff 2026-07-29). Status, haul, colorway, weight, category and
              seller all moved into the command bar under the title. Nothing
              answers "what is it" down here any more, so the seam the kicker
              marked no longer exists. */}

        </div>

        <section
          className="cz-detail-pane cz-detail-pane-details cz-detail-pane-history"
          aria-label={wantsStickyBar ? "Details" : undefined}
        >
        {lowerEditing ? <div ref={editorSlotRef}>{renderPriceEditor()}</div> : null}

        {logNotesTarget === undefined
          ? timelineBlock
          : logNotesTarget === null
            ? null
            : createPortal(timelineBlock, logNotesTarget)}
        {/* Notes stay inline even on the desktop panel — the bottom of the
            right side, above the footer (Kyle 2026-07-30). */}
        {notesBlock}

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

        {wantsStickyBar ? (
          <p className="cz-detail-device-note">
            Everything here is yours and stays on this device. Nothing you saved is deleted.
          </p>
        ) : null}
        </section>
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
            // Kimi RULED 2026-07-29: the panel footer carries the spec copy,
            // inline, with no "i" control. The line is short enough to read
            // whole, and it answers the question the "i" was hiding. Round
            // 5.3's quiet-legal treatment still holds everywhere else.
            <p className="cz-detail-disclosure">
              Referral code funds the app. Never changes your price.
            </p>
          ) : null}
        </div>
      ) : null}
      {/* Phone sheet toast (spec §7): one mono line, 78px off the bottom,
          pointer-events none so it never blocks a tap. Only pickItemSize
          sets it, and only when wantsStickyBar — the desktop back stays
          quiet. */}
      {sizeToast ? (
        <div className="cz-detail-toast" role="status">
          {sizeToast}
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
