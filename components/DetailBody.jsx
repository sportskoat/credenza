import { useEffect, useMemo, useRef, useState } from "react";
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
  computeRecommendedSize,
  effectiveBodyProfile,
  chartCacheForSeller,
  fetchChartFromPhotos,
  readChartFromPhotoFiles,
  serializeSizeChart,
  FIND_STATUS_SUBLABEL,
  fitDisplayPrefs,
  formatMeasure,
  formatSizeToken,
  itemPhotoList,
  linkButtons,
  parseSizeChart,
  prescriptionSentence,
  itemUsdAmount,
  priceLabelShort,
  pricePrimaryPref,
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
import { albumLinkTarget, AlbumLinksRow } from "./CardMetaLinks.jsx";
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

// One editor at a time.
//
// Handoff turn 9 §1: the six-cell grid is gone. It rendered a fixed grid in
// which three cells (colorway, weight, batch) were em-dashes on a typical
// item, so the flagship — sizing — read as one more piece of metadata, and
// the rail sat half empty. Cells become CHIPS instead:
//
//   - a SET field is a solid chip showing its value;
//   - an UNSET field is a dashed add-chip labelled "+ colorway";
//   - an em-dash is never rendered.
//
// Two fields leave the row entirely. PRICE moves to the footer beside Buy
// (§1). SIZE is promoted to its own block (§2). Both are still editable —
// the chip row is a display and edit surface for the SHORT facts only.
//
// Each chip opens the same inline editor the cell opened, so the editor
// switch below is unchanged.
function specChips(view) {
  return [
    { key: "colorway", label: "Colorway", add: "+ colorway", value: view.colorway || "" },
    {
      key: "weightGrams",
      label: "Weight",
      add: "+ weight",
      value: view.weightGrams ? view.weightGrams + " g" : "",
    },
    { key: "project", label: "Haul", add: "+ haul", value: view.project || "" },
  ];
}

// Silent chart hunt (Kyle 2026-07-25: "WHY CAN'T IT WORK WITH RECOMMENDED
// SIZES" — charts never arrived because the old hunt died with the desktop
// panel). With no chart, hunt once: Yupoo album text, then a vision read of
// the album/desc/gallery photos. A found chart writes into sizeNotes (+ its
// provenance into sizeChartSource) and the pick appears.
//
// This was a bare effect inside FitBlock. Turn 9 §2 makes the sizing block
// always visible, so the hunt has to start when the DETAIL opens, not when
// somebody taps a size cell. It is a hook so exactly one component owns it —
// two callers would fire two vision reads, and those cost money.
// `enabled` exists because a hook cannot be called conditionally. FitBlock
// still calls this, but passes enabled=false when its parent already owns the
// hunt — otherwise both would fire and pay for two vision reads.
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

// One source of truth for the sizing verdict. FitBlock computed all of this
// inline; turn 9 §2 adds a second consumer (the always-visible sizing block),
// and two copies of this arithmetic would drift.
function useSizeVerdict(item, bodyProfile, fitPref, units) {
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
  // The fit-summary pref gates the sentence.
  const { summary: fitSummaryOn } = fitDisplayPrefs();
  const prescription =
    recSize && fitSummaryOn
      ? prescriptionSentence(chart, rec, { units, category: item.category })
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
// It does NOT own the hunt. FitBlock still runs that, because the hunt writes
// through onSaveEdit and must not fire twice; this block is fed the result.
function SizingBlock({
  chart,
  rec,
  recSize,
  usualSize,
  chosenSize,
  precise,
  hunting,
  units,
  runValues,
  onPickSize,
  onChooseSize,
  onOpenChart,
  onOpenSizes,
  reduced,
  // §3: names the seller whose cached chart sized this item. Null on every
  // other path, and the provenance falls back to SELLER'S CHART.
  cachedFrom = "",
}) {
  const isManual = !!chosenSize;
  const heroSize = chosenSize || recSize || usualSize || "";
  const heroLabel = formatSizeToken(heroSize) || heroSize;

  // Provenance, right-aligned in the header. Mono, uppercase, and short —
  // the phone gets the trimmed form via CSS, not a second string.
  const provenance = hunting
    ? "READING CHART"
    : isManual
      ? "SET BY YOU"
      : precise
        ? cachedFrom
          ? "FROM " + String(cachedFrom).toUpperCase() + "'S CHART (CACHED)"
          : "SELLER'S CHART"
        : recSize
          ? "BEST GUESS"
          : "YOUR USUAL";

  // "your usual is L too" — only worth saying when the AI pick and the
  // customer's usual size agree. Silent otherwise; a disagreement is the
  // prescription's job to explain, not a subtitle's.
  const aside =
    !isManual && recSize && usualSize && String(recSize).toUpperCase() === String(usualSize).toUpperCase()
      ? "your usual too"
      : isManual
        ? "you picked this"
        : "";

  // The chart row: one cell per size showing the deciding measurement, so the
  // pick is legible without opening the full table. rec.primaryKey names the
  // measure the recommendation was actually read from.
  const key = rec && rec.primaryKey ? rec.primaryKey : "chest";
  const cells =
    chart && Array.isArray(chart.rows)
      ? chart.rows.filter((r) => r.size && r[key] != null).slice(0, 6)
      : [];

  return (
    <section className={"cz-sizing" + (isManual ? " is-manual" : "")} aria-label="Sizing">
      <div className="cz-sizing-head">
        <span className="cz-sizing-dot" aria-hidden="true" />
        <span className="cz-sizing-kicker">{isManual ? "Your pick" : "AI size"}</span>
        <span className="cz-sizing-prov">{provenance}</span>
      </div>

      <div className="cz-sizing-value-row">
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

      {cells.length ? (
        <div className="cz-sizing-chart" aria-hidden="true">
          {cells.map((row) => (
            <span
              key={row.size}
              className={
                "cz-sizing-cell" +
                (String(row.size).toUpperCase() === String(heroSize).toUpperCase() ? " is-pick" : "")
              }
            >
              <span className="cz-sizing-cell-k">{formatSizeToken(row.size) || row.size}</span>
              <span className="cz-sizing-cell-v">{formatMeasure(row[key], units)}</span>
            </span>
          ))}
        </div>
      ) : null}

      <div className="cz-sizing-foot">
        {/* Override chips: the two sizes either side of the pick. The whole
            run belongs in the full chart, not in a footer strip. */}
        {chipSizes(runValues, heroSize)
          .filter((s) => String(s).toUpperCase() !== String(heroSize).toUpperCase())
          .slice(0, 2)
          .map((size) => (
            <button
              key={size}
              type="button"
              className="cz-sizing-override"
              onClick={() => onPickSize(String(size))}
            >
              Use {formatSizeToken(size) || size}
            </button>
          ))}
        {/* Clear a hand pick so the AI size returns (Kyle 2026-07-26). */}
        {isManual && recSize ? (
          <button type="button" className="cz-sizing-override" onClick={() => onPickSize("")}>
            Use AI size
          </button>
        ) : null}
        <span className="cz-sizing-foot-gap" />
        <button type="button" className="cz-sizing-full" onClick={onChooseSize}>
          Choose item size
        </button>
        <button type="button" className="cz-sizing-full" onClick={onOpenChart}>
          View size chart
          <ChevronRight size={13} strokeWidth={2.4} aria-hidden="true" />
        </button>
        <button type="button" className="cz-sizing-full" onClick={onOpenSizes}>
          Edit sizes and measurements
        </button>
      </div>
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
  const [state, setState] = useState({ reading: false, chart: null, text: "", thumb: "", error: "", dirty: false });
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
    setState({ reading: true, chart: null, text: "", thumb, error: "", dirty: false });
    const list = Array.isArray(sources) ? sources : [sources];
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

// ── No chart → snapshot into the parser (handoff turn 9 §3) ──
//
// The hunt looked at the album text, the chart tiles, the description feed and
// the gallery, and none of it parsed. The old block said "No size chart on this
// listing" and stopped, which leaves the customer holding the one thing the app
// cannot get on its own: a photo of the chart. So this state asks for it.
//
// Dashed border and a warn dot on purpose — every other sizing state states a
// fact it verified, and this one states a fallback. The value still renders,
// because a usual size is better than a dash, but it renders FLAT ink with
// "not verified" beside it so it never reads as a recommendation.
//
// The two actions differ only in `capture`: on a phone, `capture` opens the
// camera directly, and without it the picker offers the photo library. Both are
// labels wrapping a file input, because a label is the only element that opens
// a picker without JS clicking a hidden node.
function SizingBlockNoChart({
  usualSize,
  albumPhotos,
  albumCount,
  onReadPhotos,
  onOpenAlbum,
  onChooseSize,
  onOpenSizes,
  runValues,
  onPickSize,
}) {
  const heroLabel = formatSizeToken(usualSize) || usualSize || "";
  const thumbs = (albumPhotos || []).slice(0, 2);
  const runChips = chipSizes(runValues, usualSize);
  const hasRun = runChips.length > 0;
  const take = (e) => {
    const files = [...(e.target.files || [])];
    e.target.value = "";
    if (files.length) onReadPhotos(files);
  };

  return (
    <section className="cz-sizing cz-sizing-nochart" aria-label="Sizing">
      <div className="cz-sizing-head">
        <span className="cz-sizing-dot" aria-hidden="true" />
        <span className="cz-sizing-kicker">No chart</span>
        <span className="cz-sizing-prov">FELL BACK TO YOUR USUAL</span>
      </div>

      <div className="cz-sizing-value-row">
        {heroLabel ? (
          <>
            <span className="cz-sizing-value">{heroLabel}</span>
            <span className="cz-sizing-aside">your usual · not verified</span>
          </>
        ) : (
          <>
            <span className="cz-sizing-value is-empty">—</span>
            <span className="cz-sizing-aside">no usual size saved</span>
          </>
        )}
      </div>

      <p className="cz-sizing-nochart-body">
        The listing had no measurements and nothing in the album parsed as a
        chart. Send me the chart photo and I&rsquo;ll read the cm off it.
      </p>

      <div className="cz-sizing-actions">
        <label className="cz-sizing-action is-primary">
          <Camera size={16} strokeWidth={2} aria-hidden="true" />
          Snapshot chart
          {/* `capture` is a hint, not a guarantee: a desktop browser ignores it
              and shows the ordinary picker, which is the right fallback. */}
          <input type="file" accept="image/*" capture="environment" onChange={take} />
        </label>
        <label className="cz-sizing-action">
          <Upload size={16} strokeWidth={2} aria-hidden="true" />
          Upload photo
          <input type="file" accept="image/*" multiple onChange={take} />
        </label>
      </div>

      {albumCount ? (
        <button type="button" className="cz-sizing-albumrow" onClick={onOpenAlbum}>
          <span className="cz-sizing-albumthumbs" aria-hidden="true">
            {thumbs.map((src, i) => (
              <img key={src + i} className="cz-sizing-albumthumb" src={src} alt="" loading="lazy" />
            ))}
          </span>
          <span className="cz-sizing-albumtext">
            or pick from this item&rsquo;s {albumCount} album photo
            {albumCount === 1 ? "" : "s"}
          </span>
          <ChevronRight size={14} strokeWidth={2.4} aria-hidden="true" />
        </button>
      ) : null}

      {/* The full chart sheet is still the way in for a chart the customer
          would rather type, and the only route to My sizes from here. §3
          replaced the old static "no chart" copy, and that copy carried this
          link — losing it would strand anyone whose photo will not read.
          The label must not say "Full chart" here: with no chart parsed the
          sheet opens on the size-run override picker, and a button that
          promises a chart it cannot show reads as a bug (Kyle 2026-07-27).
          When the listing size run is already inline, the link only opens
          profile / manual chart entry — so it reads "My sizes". */}
      <div className="cz-sizing-foot">
        {hasRun
          ? runChips.map((size) => (
              <button
                key={size}
                type="button"
                className="cz-sizing-override"
                onClick={() => onPickSize && onPickSize(String(size))}
              >
                {formatSizeToken(size) || size}
              </button>
            ))
          : null}
        <span className="cz-sizing-foot-gap" />
        <button type="button" className="cz-sizing-full" onClick={onChooseSize}>
          Choose item size
          <ChevronRight size={13} strokeWidth={2.4} aria-hidden="true" />
        </button>
        <button type="button" className="cz-sizing-full" onClick={onOpenSizes}>
          Edit sizes and measurements
        </button>
      </div>
    </section>
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

// The size reasoning breakdown (handoff turn 3 §5). Reading order: verdict
// (kicker + Georgia size + confidence chip) → prescription (1-2 plain
// sentences naming the deciding measurement and the next size down) →
// evidence (You/Garment/Ease trio, the fetched chart table with the pick
// inverted, provenance footer + See album) → escape (override chips + Set my
// sizes). With no parsed chart it says so and shows the size run plainly —
// it never invents a pick.
function FitBlock({
  item,
  bodyProfile,
  fitPref,
  units,
  onPickSize,
  onOpenSizes,
  onDone,
  onSaveEdit,
  // The parent owns the hunt now (turn 9 §2: the sizing block is always
  // visible, so the hunt starts with the detail view). When the parent passes
  // its flag, use it; standalone callers still run their own.
  hunting: huntingProp,
}) {
  const {
    chart,
    rec,
    recSize,
    usualSize,
    decidingEstimated,
    precise,
    runValues,
    variantRun,
    prescription,
  } = useSizeVerdict(item, bodyProfile, fitPref, units);
  const parentOwnsHunt = huntingProp !== undefined;
  const ownHunting = useChartHunt(item, chart, onSaveEdit, !parentOwnsHunt);
  const hunting = parentOwnsHunt ? huntingProp : ownHunting;
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
  // Provenance footer (turn 3 §5): where the chart came from, when, and a
  // See album link. Items whose chart predates the hunt tag get the plain
  // line — the footer never invents a photo count.
  const albumTarget = albumLinkTarget(item);
  const source = item.sizeChartSource && typeof item.sizeChartSource === "object" ? item.sizeChartSource : null;
  const SOURCE_LINES = {
    "album-text": "Chart read from the seller's album page",
    "chart-photos": "Chart read from the album's size-chart photo",
    "album-photos": "Chart read from " + (source ? source.photos : 0) + " album photos",
    "desc-photos": "Chart read from " + (source ? source.photos : 0) + " listing photos",
    "gallery-photos": "Chart read from " + (source ? source.photos : 0) + " gallery photos",
    "customer-photo": "Chart read from your photo",
    // Turn 9 §3: "surface that as FROM <seller>'s CHART (CACHED)". The seller
    // is named because the value of a cache the customer cannot see is zero.
    "seller-cache":
      "From " + ((source && source.seller) || "this seller") + "'s chart (cached)",
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
          {/* t-shimmer-wrap: this sentence wraps to two lines on a phone, and the
              default two-layer shimmer prints a second copy that wraps
              differently. The wrap variant paints one layer only. */}
          <span className="t-shimmer t-shimmer-wrap" data-text={huntLine}>
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
        {/* Clear the hand pick so the green AI size returns (Kyle 2026-07-26). */}
        {recSize && String(item.size || "").trim() ? (
          <button
            type="button"
            className="cz-detail-fit-chip is-ai"
            onClick={() => onPickSize("")}
          >
            Use AI Recommendation
          </button>
        ) : null}
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

function ItemSizeEditor({ item, runValues, onPickSize, onOpenSizes, onDone }) {
  const [customSize, setCustomSize] = useState(String(item.size || ""));
  const choices = chipSizes(runValues, item.size);

  return (
    <div className="cz-detail-fit" aria-label="Choose item size">
      <div className="cz-detail-fit-head">
        <span className="cz-detail-fit-kicker">Choose item size</span>
      </div>
      {choices.length ? (
        <div className="cz-detail-fit-chips">
          {choices.map((size) => (
            <button
              key={size}
              type="button"
              className={
                "cz-detail-fit-chip" +
                (String(item.size || "").toUpperCase() === String(size).toUpperCase()
                  ? " is-active"
                  : "")
              }
              onClick={() => onPickSize(String(size))}
            >
              {formatSizeToken(size) || size}
            </button>
          ))}
          {item.size ? (
            <button type="button" className="cz-detail-fit-chip is-ai" onClick={() => onPickSize("")}>
              Clear item size
            </button>
          ) : null}
        </div>
      ) : null}
      <div className="cz-detail-editor">
        <span className="cz-detail-editor-label">Custom item size</span>
        <input
          ref={focusOnMount}
          className="cz-detail-editor-input"
          aria-label="Custom item size"
          value={customSize}
          onChange={(event) => setCustomSize(event.target.value)}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === "Enter") onPickSize(customSize);
          }}
        />
        <button type="button" className="cz-detail-editor-done" onClick={() => onPickSize(customSize)}>
          Use size
        </button>
      </div>
      <button type="button" className="cz-detail-fit-chip is-alt" onClick={onOpenSizes}>
        Edit sizes and measurements
      </button>
      <button type="button" className="cz-detail-editor-done" onClick={onDone}>
        Done
      </button>
    </div>
  );
}

function SellerChartView({ item, chart, units, highlight, onDone }) {
  return (
    <div className="cz-detail-fit" aria-label="Seller size chart">
      <div className="cz-detail-fit-head">
        <span className="cz-detail-fit-kicker">Seller size chart</span>
      </div>
      {chart ? (
        <>
          <SizeChartTable chart={chart} units={units} highlight={highlight || undefined} />
          <p className="cz-detail-fit-source">
            {item.sizeChartSource && item.sizeChartSource.via === "seller-cache"
              ? "Cached from " + (item.sizeChartSource.seller || item.seller || "this seller")
              : "Read from the seller's listing"}
          </p>
        </>
      ) : (
        <p className="cz-detail-fit-empty">A seller size chart is not available for this item.</p>
      )}
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
  // Desktop left-column CHART chip: bumping this opens the same size sheet
  // the sizing-block footer link opens. 0 / absent does nothing on mount.
  openChartSignal = 0,
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

  // Desktop CHART chip (and any other host) opens the size sheet by bumping
  // openChartSignal. Skip 0 so the first paint never auto-opens the sheet.
  useEffect(() => {
    if (!openChartSignal) return;
    setEditingCell("size");
  }, [openChartSignal]);

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

  // Turn 9 §2: the sizing block is always visible, so the parent owns both the
  // verdict and the hunt. FitBlock (the full chart sheet) is handed the same
  // hunting flag rather than starting a second vision read.
  const fitPref = fitPrefs && item.category ? fitPrefs[item.category] || null : null;
  const verdict = useSizeVerdict(item, bodyProfile, fitPref, measureUnits);
  const hunting = useChartHunt(item, verdict.chart, onSaveEdit, true, shelfItems);
  // §3: the customer's own chart read, and the album photos its third option
  // offers. Remote URLs only — a local data: URL cannot go down the images door.
  const chartRead = useCustomerChartRead(item, onSaveEdit);
  const sizingAlbumPhotos = useMemo(
    () => itemPhotoList(item, 12).filter((src) => /^https?:\/\//i.test(src)),
    [item]
  );

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
  const chips = specChips(view);
  // Chip-row editors mount under the chips; price/size keep the lower slot.
  const chipEditing = !!(editingCell && chips.some((c) => c.key === editingCell));
  const lowerEditing = !!(editingCell && !chipEditing);
  // Timeline (§6). sizeFrom names WHO decided the size, in the same vocabulary
  // the sizing block's provenance uses — "from the seller's chart" only when a
  // real chart was read, never for the profile fallback.
  const timeline = buildTimeline(
    item,
    sizeText,
    chosenSize
      ? "yourself"
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
  // The QC prompt is a question about the order's next step, so it only asks
  // while the order can answer: with the agent, and nothing arrived yet.
  const QC_PROMPT_STATUSES = ["bought", "shipped", "qc"];
  const showQcPrompt =
    typeof onAttachQcPhoto === "function" &&
    QC_PROMPT_STATUSES.includes(view.findStatus) &&
    !(Array.isArray(item.qcPhotos) && item.qcPhotos.filter(Boolean).length);
  const buyButtons = linkButtons(item, { buyLabel }).filter((b) => b.role === "buy");
  // ONE primary action: the first buy link only. Two filled twins read as a
  // bug (Kyle 2026-07-25, desktop card back included).
  const buyButton = buyButtons[0] || null;
  const savedDate = item.createdAt
    ? new Date(item.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })
    : "";
  const subLine = [item.seller, savedDate ? "saved " + savedDate : ""].filter(Boolean).join(" · ");
  const knownHauls = Array.from(
    new Set([...(haulNames || []), item.project || ""].map((n) => String(n || "").trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  // Editor labels. Price and Size no longer appear in the chip row (§1 moves
  // price to the footer, §2 promotes size to its own block), but both still
  // open the same editors — so the label map is not the chip list.
  const EDITOR_LABELS = { price: "Price", size: "Size · fit" };
  const editorLabel =
    EDITOR_LABELS[editingCell] ||
    (chips.find((c) => c.key === editingCell) || {}).label ||
    "";
  const priceUnit =
    String(view.currency || "CNY").toUpperCase() === "USD" ? "USD" : "CNY";
  // Price cell shows the prefs primary currency; the editor labels the unit of
  // the number in the draft (USD or CNY). Toggle sits next to Done.
  const editorLabelFull =
    editingCell === "price"
      ? editorLabel + " · " + (priceUnit === "USD" ? "$ USD" : "¥ CNY")
      : editingCell === "weightGrams"
        ? editorLabel + " · " + weightUnit
        : editorLabel;

  // Open price with the settings primary unit pre-selected (Kyle 2026-07-26:
  // "shouldn't default to CNY… default to USD if we have USD in the settings").
  const openPriceEditor = () => {
    const base = draft || buildEditDraft(item);
    const primary = pricePrimaryPref() === "CNY" ? "CNY" : "USD";
    if (primary === "USD") {
      const usd = itemUsdAmount(item);
      setDraft({
        ...base,
        currency: "USD",
        price: usd != null && isFinite(usd) ? String(usd) : "",
      });
    } else {
      const storedCur = String(item.currency || "CNY").toUpperCase();
      let cny = null;
      if ((storedCur === "CNY" || storedCur === "RMB" || storedCur === "¥") && item.price != null) {
        cny = Number(item.price);
      } else if (item.priceUsd != null && isFinite(Number(item.priceUsd))) {
        cny = Math.round(Number(item.priceUsd) / 0.14);
      } else if (item.price != null && storedCur === "USD") {
        cny = Math.round(Number(item.price) / 0.14);
      }
      setDraft({
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
    const base = draft || buildEditDraft(item);
    if (!isFinite(n) || String(view.price || "").trim() === "") {
      setDraft({ ...base, currency: want });
      return;
    }
    if (want === "USD") {
      setDraft({ ...base, currency: "USD", price: String(+(n * 0.14).toFixed(2)) });
    } else {
      setDraft({ ...base, currency: "CNY", price: String(Math.round(n / 0.14)) });
    }
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
            // Commit now so "Use AI Recommendation" (empty size) and chip
            // picks both land before the editor closes.
            const next = { ...(draft || buildEditDraft(item)), size: String(size || "") };
            setDraft(next);
            onSaveEdit(item.id, buildEditPatch(next, item));
            setEditingCell(null);
          }}
          onOpenSizes={() => {
            commitRef.current();
            onOpenSizes && onOpenSizes();
          }}
          onDone={() => setEditingCell(null)}
          onSaveEdit={onSaveEdit}
          // The parent already hunts (turn 9 §2). Pass the flag so this does
          // not start a second vision read for the same item.
          hunting={hunting}
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
    // price: numeric keypad + USD/CNY unit (defaults from prefs primary).
    if (editingCell === "price") {
      return (
        <div className="cz-detail-editor">
          <span className="cz-detail-editor-label">{editorLabelFull}</span>
          <input
            ref={focusOnMount}
            className="cz-detail-editor-input"
            aria-label={editorLabelFull}
            inputMode="decimal"
            value={view.price}
            onChange={(e) => edit("price", e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") setEditingCell(null);
            }}
          />
          <div className="cz-detail-unit" role="group" aria-label="Price currency">
            {["USD", "CNY"].map((u) => (
              <button
                key={u}
                type="button"
                className={"cz-detail-unit-btn" + (priceUnit === u ? " is-active" : "")}
                aria-pressed={priceUnit === u}
                onClick={() => switchPriceUnit(u)}
              >
                {u === "USD" ? "$" : "¥"}
              </button>
            ))}
          </div>
          <button type="button" className="cz-detail-editor-done" onClick={() => setEditingCell(null)}>
            Done
          </button>
        </div>
      );
    }
    // Fallback numeric keypad for any other single-field cell.
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

  const logNotesBlock = (
    <>
      {/* Timeline (§6). Generated from fields the item already carries, so
          it renders only when there is something true to say. */}
      {timeline.length ? (
        <>
          <div className="cz-detail-rule-head">
            <span className="cz-detail-label">Timeline</span>
            <span className="cz-detail-rule" aria-hidden="true" />
          </div>
          <Timeline rows={timeline} />
        </>
      ) : null}

      {/* Notes (§7). The header moves INSIDE the box, so the box reads as
          one object instead of a label with a field under it.
          §7: "Never a fixed 2-line box, never a truncation with no way
          out." Collapsed clamps to 3 lines; EXPAND grows it. The box stays
          the same box you type in — there is still no mode to enter and no
          "+" to hunt for, which is what turn 5 fixed and §7 keeps. */}
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

        {/* Chip row (§1). A set field is a solid chip carrying its value; an
            unset field is a dashed add-chip. No em-dash is ever rendered —
            that was the whole diagnosis: three of six cells were em-dashes on
            a typical item, so the grid looked broken and pushed the real
            content down. Price and size are NOT here (footer / own block). */}
        <div className="cz-detail-chips">
          {chips.map((chip) => {
            const isSet = !!chip.value;
            return (
              <button
                key={chip.key}
                type="button"
                className={
                  "cz-detail-chip" +
                  (isSet ? " is-set" : " is-add") +
                  (editingCell === chip.key ? " is-active" : "")
                }
                // The visible label of an add-chip is "+ colorway", which does
                // not say what tapping does. Name the action for a screen
                // reader; a set chip already reads its own value.
                aria-label={isSet ? chip.label + ": " + chip.value : "Add " + chip.label}
                onClick={() => {
                  if (editingCell === chip.key) {
                    setEditingCell(null);
                    return;
                  }
                  setEditingCell(chip.key);
                }}
              >
                {isSet ? chip.value : chip.add}
              </button>
            );
          })}
        </div>

        {/* Chip editors sit under the chip row so the input is next to the
            field that opened it. Price/size keep the lower slot. One slot
            only — the keyboard-reveal effect always finds editorSlotRef. */}
        {chipEditing ? <div ref={editorSlotRef}>{renderEditor()}</div> : null}

        {/* Sizing block (§2) — the flagship, always visible. It used to be one
            of six equal cells, so the only field carrying a REASON read as
            metadata and took a tap to reveal. The prescription sits outside
            the card so a long sentence never stretches the chart row. */}
        {editingCell !== "size" ? (
          <>
            {/* Three states, in the order they occur. A live read outranks
                everything: it is the only one the customer started by hand.
                §3's no-chart form comes next, and only once the automatic hunt
                has finished — while it is still hunting the ordinary block
                shimmers READING CHART, and asking for a photo underneath that
                would be asking for work the app may be about to do itself. */}
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
            ) : !verdict.chart && !hunting ? (
              <SizingBlockNoChart
                usualSize={chosenSize || verdict.usualSize}
                albumPhotos={sizingAlbumPhotos}
                albumCount={sizingAlbumPhotos.length}
                runValues={verdict.runValues}
                onPickSize={(size) => {
                  const next = { ...(draft || buildEditDraft(item)), size: String(size || "") };
                  setDraft(next);
                  onSaveEdit(item.id, buildEditPatch(next, item));
                }}
                onReadPhotos={(files) => {
                  const thumb = files[0] ? URL.createObjectURL(files[0]) : "";
                  chartRead.read(files, { thumb });
                }}
                onOpenAlbum={() => {
                  // The album photos are already on the card, so read them
                  // straight through the URL door instead of making the
                  // customer re-pick a photo the app is holding.
                  chartRead.read(sizingAlbumPhotos.slice(0, 3), {
                    thumb: sizingAlbumPhotos[0] || "",
                  });
                }}
                onOpenChart={() => setEditingCell("size")}
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
                runValues={verdict.runValues}
                reduced={reduced}
                cachedFrom={
                  item.sizeChartSource && item.sizeChartSource.via === "seller-cache"
                    ? item.sizeChartSource.seller || item.seller || ""
                    : ""
                }
                onPickSize={(size) => {
                  const next = { ...(draft || buildEditDraft(item)), size: String(size || "") };
                  setDraft(next);
                  onSaveEdit(item.id, buildEditPatch(next, item));
                }}
                onOpenChart={() => setEditingCell("size")}
              />
            )}
            {verdict.prescription && !chartRead.reading && !chartRead.chart ? (
              <p className="cz-sizing-why">{verdict.prescription}</p>
            ) : null}
          </>
        ) : null}

        {/* Price / size (and any non-chip) editor. Chip keys use the slot
            under the chip row instead. */}
        {lowerEditing ? <div ref={editorSlotRef}>{renderEditor()}</div> : null}

        {/* Status (§5). The header carries the rule and the sub-label; the
            track carries the progress and the next action. */}
        <div className="cz-detail-rule-head">
          <span className="cz-detail-label">Status</span>
          <span className="cz-detail-rule-note">
            {FIND_STATUS_SUBLABEL[view.findStatus || "want"] || ""}
          </span>
          <span className="cz-detail-rule" aria-hidden="true" />
        </div>
        {/* StatusChips owns the named next-step pill (§5). It is drawn there,
            not here, because only the track knows which stops are terminal
            and which need a real decision rather than a one-tap primary. */}
        <StatusChips mode="track" value={view.findStatus} onChange={pickStatus} label="Order status" />

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

      {buyButton ? (
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
              <BuyNotch
                item={item}
                label={buyButton.label}
                url={buyButton.url}
                preferredAgent={preferredAgent}
                onSelectAgent={onSelectAgent}
                onOpen={onOpen}
              />
            </div>
          ) : (
            <BuyNotch
              item={item}
              label={buyButton.label}
              url={buyButton.url}
              preferredAgent={preferredAgent}
              onSelectAgent={onSelectAgent}
              onOpen={onOpen}
            />
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
