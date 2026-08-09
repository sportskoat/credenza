import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Camera, Check, ChevronDown, ChevronRight, Maximize2, Minimize2, Upload, X } from "lucide-react";
import { getAgent, buildSignupUrl, listAgents } from "../agents.js";
import PhotoCoverFlow from "./PhotoCoverFlow.jsx";
import CommandBar from "./CommandBar.jsx";
import SizeChartTable from "./SizeChartTable.jsx";
import {
  EditPhotosManager,
  buildEditDraft,
  buildEditPatch,
  CATEGORIES,
  computeOutcomeMaps,
  computeRecommendedSize,
  effectiveBodyProfile,
  fetchChartFromPhotos,
  readChartFromPhotoFiles,
  isChartAuthRequired,
  isChartCapReached,
  isChartUnavailable,
  isChartOffline,
  CHART_AUTH_COPY,
  CHART_UNAVAILABLE_COPY,
  CHART_OFFLINE_COPY,
  CHART_HUNT_UNAVAILABLE_COPY,
  CHART_RATE_LIMITED_COPY,
  CHART_READER_OFF_COPY,
  chartCapCopy,
  chartCapWantsUpgrade,
  chartCapWantsSignIn,
  chartCardsCapCopy,
  chartNeedsCards,
  requestChartSignIn,
  requestChartLimits,
  serializeSizeChart,
  FIT_PREF_AXES,
  fitDisplayPrefs,
  fitPrefHasChoice,
  fitPrefLabel,
  fitReadRows,
  formatMeasure,
  compactSizeToken,
  formatSizeToken,
  parseShoeSizeToken,
  shoeSizeAlt,
  shoeChipLabel,
  shoeUsualLabel,
  extendShoeRun,
  sizeCellReads,
  fitRowWord,
  itemPhotoList,
  DETAIL_PHOTO_CAP,
  linkButtons,
  measureFromStorage,
  measureToStorage,
  outcomeShiftFor,
  parseSizeChart,
  prescriptionSentence,
  easeRoomClause,
  meantToSitClause,
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
  elasticEvidenceTextFor,
  usualSizeForItem,
  useWriteThroughDraft,
  usePrefersReducedMotion,
  SIZE_PICK_SKIP_CATEGORIES,
} from "../credenza-fashion.jsx";
import { normalizeFindStatus } from "../credenza-find-status.js";
import { fitMeasureFieldsFor, FitPrefAxis } from "./SizeRecommendation.jsx";
import { huntSizeChart, chartHuntFingerprint, CHART_HUNT_VERSION } from "./size-chart-hunt.js";
import { chartImageKey, isWeidianPolicyImg, rememberChartImage, validateChartResult } from "./chart-pipeline.js";
import { AlbumLinksRow, SellerLink } from "./CardMetaLinks.jsx";
import { CoverPlaceholder } from "./CardCover.jsx";
import SlidingTabsPill from "./SlidingTabsPill.jsx";
import {
  pickSizeRunFromVariants,
  pickSizeValuesFromVariants,
  whatsAppChatUrl,
} from "../listing-facts.js";
import FirstSizeBlock from "./FirstSizeBlock.jsx";
import {
  isUsualFitSource,
  isBrandMatchSource,
  isDerivedBodySource,
  profileNeedsFirstSize,
} from "./first-size.js";

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
// Across reloads the sizeChartHunt stamp on the item carries the same answer
// (Kyle 2026-08-04: a reload must never re-spend the reads).
const chartHuntTried = new Set();

// #31e (Kyle 2026-08-04): WHICH guard stopped the hunt, per item, for the
// session. chartHuntTried stops a second paid search when the card reopens,
// but the reason lived in component state — the reopen forgot it and printed
// "No chart for this one yet.", a claim the hunt never made. The map survives
// the remount, so the wall keeps its true reason. It stays memory on purpose:
// a page reload still retries the hunt, because a traffic guard may have
// lifted. The persistent sizeChartHunt stamp stays for true misses only.
//
// Each value is { reason, at } — `at` is when the wall went up.
const chartHuntBlocked = new Map();

// Kyle 2026-08-06: the busy wall felt permanent. Its own words say "wait one
// minute, then open this card again", but the tried-list refused the retry
// until a page reload. A wall that promises a minute must honour the minute.
// Only the two walls whose copy makes that promise expire: the traffic window
// (CHART_RATE_LIMITED_COPY) and the unreachable reader (CHART_HUNT_UNAVAILABLE_
// COPY). "off" says it comes back tomorrow, and "cap" and "auth" both wait on
// the person, so all three stay for the session. A reopen inside the minute
// still spends nothing — it shows the same wall.
const EXPIRING_BLOCKS = new Set(["rate", "out"]);
const BLOCK_RETRY_MS = 60 * 1000;

/** True when a wall promised a retry and the minute has passed. */
function blockExpired(id, now = Date.now()) {
  const entry = chartHuntBlocked.get(id);
  if (!entry || !EXPIRING_BLOCKS.has(entry.reason)) return false;
  return now - entry.at >= BLOCK_RETRY_MS;
}

// The reason a wall carries, or undefined. An expired wall reads as no wall,
// so the reopen shows the spinner and the fresh answer, not the old sentence.
function blockedReason(id) {
  if (blockExpired(id)) return undefined;
  const entry = chartHuntBlocked.get(id);
  return entry && entry.reason;
}

// The tap that opened the editor is the focus intent, so the input takes
// focus when it mounts. A callback ref does this without autoFocus, which
// eslint-plugin-jsx-a11y forbids.
const focusOnMount = (el) => {
  if (el) el.focus();
};

// Silent chart hunt (Kyle 2026-07-25: "WHY CAN'T IT WORK WITH RECOMMENDED
// SIZES" — charts never arrived because the old hunt died with the desktop
// panel). With no chart, hunt once: free album text, then ranked single-photo
// vision reads. A found chart writes into its own item field and the pick
// appears. shelfItems is only for exact image-key reuse — never seller borrow.
//
// The sizing block is always visible, so the hunt starts when the detail opens.
// One component owns the hook because two callers would start two paid reads.
// `enabled` lets callers disable the hook without calling it conditionally.
//
function useChartHunt(item, chart, onSaveEdit, enabled = true, shelfItems = null) {
  const [hunting, setHunting] = useState(false);
  // FIX 0: hunt hit a 401/403 — show signed-out copy, not "No chart for this one yet."
  // Each flag opens from the session map, so a remount restores the wall the
  // last finished hunt met (#31e) instead of forgetting it.
  const [authBlocked, setAuthBlocked] = useState(() => blockedReason(item.id) === "auth");
  // FIX 2b: hunt hit daily cap — show cap copy, not "No chart for this one yet."
  const [capBlocked, setCapBlocked] = useState(() => blockedReason(item.id) === "cap");
  // FIX 2c: hunt could not reach the reader — show "not answering", not
  // "No chart for this one yet." A server that is down proves nothing about the item.
  const [outBlocked, setOutBlocked] = useState(() => blockedReason(item.id) === "out");
  // #31 (Kyle 2026-08-04): the per-minute traffic window and the site-wide
  // daily cost guard are their own walls. Neither is the plan cap, and
  // neither may print the plan-cap sentence.
  const [rateBlocked, setRateBlocked] = useState(() => blockedReason(item.id) === "rate");
  const [offBlocked, setOffBlocked] = useState(() => blockedReason(item.id) === "off");
  // #41 (Kyle 2026-08-07): the hunt effect must re-run when the ITEM changes,
  // and at no other time. Three of its inputs are rebuilt on every parent
  // render — `onSaveEdit` is a plain arrow in the App, `item` comes from a
  // fresh `items.find(...)`, and `shelfItems` is the whole items array. The
  // indexing bar re-renders the App about ten times a second, so the effect
  // tore down and restarted roughly once a second. Each restart aborted the
  // read in flight, and the claim that stops a second search was only taken
  // by a FINISHED read, so nothing ever claimed the item. A live Yupoo album
  // measured 21 read attempts in 30 seconds against a limit of 3, and finished
  // none: the album branch is the slowest hunt, so it lost every race.
  //
  // Holding these three in refs keeps the effect reading the newest values
  // without listing them as dependencies. The hunt itself needs one snapshot,
  // taken when it starts; a later render of the same item has nothing new to
  // give it. So the dependency list carries only what genuinely restarts a
  // hunt: a different item, a chart arriving, and the enabled switch.
  const saveEditRef = useRef(onSaveEdit);
  const shelfItemsRef = useRef(shelfItems);
  const itemRef = useRef(item);
  saveEditRef.current = onSaveEdit;
  shelfItemsRef.current = shelfItems;
  itemRef.current = item;
  // The stamp and the photo list are the only parts of `item` that decide
  // whether a hunt runs. Both are strings, so the effect compares them by
  // value and a rebuilt-but-identical item no longer counts as a change.
  const itemId = item.id;
  // The effect only asks WHETHER a chart exists. The parsed chart itself is a
  // new object on every render, so depending on it would restart the hunt as
  // often as `item` does. A boolean changes once: when the chart arrives.
  const hasChart = !!chart;
  const huntFp = chartHuntFingerprint(item);
  const huntStamp =
    item.sizeChartHunt && item.sizeChartHunt.v === CHART_HUNT_VERSION
      ? String(item.sizeChartHunt.fp || "")
      : "";
  useEffect(() => {
    // #31e: restore (not blank) the reason on a remount — the map holds what
    // the last finished hunt met, so the wall stays honest on a reopen.
    const reason = blockedReason(item.id);
    setAuthBlocked(reason === "auth");
    setCapBlocked(reason === "cap");
    setOutBlocked(reason === "out");
    setRateBlocked(reason === "rate");
    setOffBlocked(reason === "off");
  }, [item.id]);
  useEffect(() => {
    if (!enabled) return;
    if (hasChart || SIZE_PICK_SKIP_CATEGORIES.has(itemRef.current.category)) return;
    // A wall that promised a retry, whose minute has passed, earns one fresh
    // hunt without a page reload (Kyle 2026-08-06). Clearing both entries here
    // means the guard below reads the same state a first visit would.
    if (blockExpired(itemId)) {
      chartHuntTried.delete(itemId);
      chartHuntBlocked.delete(itemId);
    }
    if (chartHuntTried.has(itemId)) return;
    // Kyle 2026-08-04: a finished hunt that found nothing stamps the item.
    // While the stamp matches the photos the hunt would read, skip — a page
    // reload must never re-spend the reads. New photos change the print and
    // earn one fresh hunt. The stamp rides the item into cloud sync.
    // The version moves when the pipeline gets smarter on the SAME photos:
    // a stamp from before the folded-strip read would hide a real chart
    // forever, so a stale version earns one fresh hunt too.
    const fp = huntFp;
    if (huntStamp && huntStamp === fp) return;
    let cancelled = false;
    const controller = new AbortController();
    setHunting(true);
    (async () => {
      try {
        const found = await huntSizeChart(itemRef.current, {
          signal: controller.signal,
          shelfItems: shelfItemsRef.current,
        });
        if (cancelled) return;
        // Claim AFTER the answer arrives, never before (2026-07-25). An
        // aborted hunt must not stick the card on "Looking for the seller's
        // size chart…" forever, so only a finished hunt spends the one try.
        chartHuntTried.add(itemId);
        // FIX 0: auth wall mid-hunt — distinct state, stop claiming no chart.
        // Each blocked outcome also writes the session map, so a remount
        // restores this wall (#31e) instead of the generic no-chart sentence.
        if (found && found.authRequired) {
          chartHuntBlocked.set(itemId, { reason: "auth", at: Date.now() });
          setAuthBlocked(true);
          return;
        }
        // FIX 2b: daily cap mid-hunt — distinct state, stop claiming no chart.
        if (found && found.capReached) {
          chartHuntBlocked.set(itemId, { reason: "cap", at: Date.now() });
          setCapBlocked(true);
          return;
        }
        // #31: the traffic guards mid-hunt — their own states, same rule.
        if (found && found.rateLimited) {
          chartHuntBlocked.set(itemId, { reason: "rate", at: Date.now() });
          setRateBlocked(true);
          return;
        }
        if (found && found.readerOff) {
          chartHuntBlocked.set(itemId, { reason: "off", at: Date.now() });
          setOffBlocked(true);
          return;
        }
        // FIX 2c: reader unreachable mid-hunt — say so, and stop. The item
        // stays on the tried list, so leaving the card and coming back does
        // not start a second paid search (Kyle 2026-08-03: "if you wait around
        // long enough, switch on and off, go to different tabs, and come
        // back"). A page reload still gives a fresh try; the list is memory.
        if (found && found.unavailable) {
          chartHuntBlocked.set(itemId, { reason: "out", at: Date.now() });
          setOutBlocked(true);
          return;
        }
        // Older hunts returned bare text; the source tag ships with the text now.
        const text = typeof found === "string" ? found : found && found.text;
        // A completed hunt clears any older blocked reason for this item.
        chartHuntBlocked.delete(itemId);
        if (text) {
          saveEditRef.current(itemId, {
            sizeChartText: text,
            sizeChartNeedsClear: false,
            // A find clears any old no-find stamp. If the chart is later
            // cleared by hand, nothing blocks a fresh hunt.
            sizeChartHunt: null,
            ...(found && found.source
              ? { sizeChartSource: { ...found.source, at: new Date().toISOString() } }
              : {}),
          });
        } else {
          // Kyle 2026-08-04: "we can't charge for repopulating the chart!"
          // Stamp the miss on the item itself, so a page reload reads the
          // stamp and skips the hunt instead of spending up to three more
          // paid reads. The stamp syncs to the cloud with the item. The
          // blocked outcomes above never stamp — a retry there is wanted.
          saveEditRef.current(itemId, {
            sizeChartHunt: { at: new Date().toISOString(), fp, v: CHART_HUNT_VERSION },
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
    // #41: `item`, `onSaveEdit` and `shelfItems` are read from refs on purpose
    // — see the note above the refs. Listing them here restarts the hunt on
    // every parent render and cancels the read in flight every time.
  }, [enabled, hasChart, itemId, huntFp, huntStamp]);
  return { hunting, authBlocked, capBlocked, outBlocked, rateBlocked, offBlocked };
}

// One source of truth keeps the sizing verdict consistent across each view.
function useSizeVerdict(
  item,
  bodyProfile,
  fitPref,
  units,
  detailOverride = null,
  summaryOverride = null,
  chosenSize = "",
  outcomeShift = 0
) {
  const chart = useMemo(() => parseSizeChart(sizeChartTextFor(item)), [item]);
  // Height+weight estimates fill the tape-measure gaps — flagged estimated
  // so the badge never claims a precise fit it does not have.
  const profile = useMemo(() => effectiveBodyProfile(bodyProfile), [bodyProfile]);
  const rec =
    chart && profile
      ? recommendSize(chart, profile, item.category, fitPref, null, item.title, elasticEvidenceTextFor(item), outcomeShift)
      : null;
  const recSize = rec && rec.size ? rec.size : null;
  // `rec` is the advice; `shown` is what every printed number describes. They
  // are the same until the customer taps a different size, and then the panel
  // must print the tapped row (Fable's ruling 2026-07-29: the numbers follow
  // the tap, the advice line keeps the recommendation).
  const pickRead =
    chosenSize && chart && profile
      ? recommendSize(chart, profile, item.category, fitPref, chosenSize, item.title, elasticEvidenceTextFor(item))
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
    });
  }

  return rows;
}

function Timeline({ rows }) {
  if (!rows.length) return null;
  return (
    <div className="cz-timeline-block">
      <h3 className="cz-timeline-kicker">History</h3>
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
    </div>
  );
}

// Mock Settings (Turn 3): fixed read-only body rows + height.
// Sleeve uses long when present, else short. Empty values show a hyphen.
function formatBodyHeightLabel(cm, units) {
  if (cm == null || !Number.isFinite(Number(cm)) || Number(cm) <= 0) return "-";
  const n = Number(cm);
  if (units === "cm") return Math.round(n) + " cm";
  const totalIn = n / 2.54;
  const ft = Math.floor(totalIn / 12);
  let inch = Math.round(totalIn - ft * 12);
  if (inch === 12) return ft + 1 + "'0\"";
  return ft + "'" + inch + '"';
}

function bodyMeasureRows(bodyProfile, units) {
  const p = bodyProfile && typeof bodyProfile === "object" ? bodyProfile : {};
  const sleeve =
    p.longSleeve != null && Number(p.longSleeve) > 0
      ? p.longSleeve
      : p.shortSleeve != null && Number(p.shortSleeve) > 0
        ? p.shortSleeve
        : p.sleeve != null
          ? p.sleeve
          : null;
  const show = (cm) =>
    cm != null && Number.isFinite(Number(cm)) && Number(cm) > 0
      ? formatMeasure(Number(cm), units)
      : "-";
  return [
    { key: "chest", label: "Chest", value: show(p.chest) },
    { key: "sleeve", label: "Sleeve", value: show(sleeve) },
    { key: "shoulder", label: "Shoulder", value: show(p.shoulder) },
    { key: "torso", label: "Torso length", value: show(p.length) },
    { key: "height", label: "Height", value: formatBodyHeightLabel(p.height, units) },
  ];
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
  // Simpler fit card (Kyle's mockup, 2026-08-09): per-size reads from
  // sizeCellReads — word + two ease lines per chip. Empty when no body number
  // exists; the plain garment-measure cells below are the fallback.
  cellReads = null,
  // Kyle 2026-07-29: the fifth box rides at the right of the cell run, on the
  // same line as the sizes it overrides. Null when the caller has no box.
  customBox = null,
  // Card-back v2 Fit tab: quieter result line + size cards (layout only).
  editorial = false,
  // Desktop Fit fold (2026-08-02): one analysis paragraph under the size
  // headline, before the size cards. Empty string when nothing to say.
  analysis = "",
  // Desktop: short fit-pref control left of the Verified fit mark. Opens
  // FitPrefAsk. Null when the caller cannot save a preference.
  item = null,
  fitPref = null,
  onAskPref = null,
  // Phase 1 Guess path: pick came from usual size + sit, not a real measure.
  usualFitSource = false,
  // Phase 2 Match: chest from a named brand tee range + ease — not a tape.
  brandMatchSource = false,
  // Derived body (usual-fit or brand-match or future inferred sources).
  derivedBodySource = false,
  // Honest header (four-lane debate 2026-08-08): a red chest or shoulder bar
  // (waist/hip on bottoms) blocks every green fit claim. The pick stays; the
  // words change to "Closest available" in amber.
  headerBlocked = false,
}) {
  const isManual = !!chosenSize;
  const heroSize = chosenSize || recSize || usualSize || "";
  const heroLabel = formatSizeToken(heroSize) || heroSize;

  // Split-rail: the sheen marks a pick that came off a real chart. A manual
  // pick, a best guess, and a derived (not measured) body all render still.
  const sheen =
    precise && !isManual && !hunting && !derivedBodySource && !usualFitSource && !brandMatchSource;

  // Provenance, right-aligned in the header. Mono, uppercase, and short —
  // the phone gets the trimmed form via CSS, not a second string. Round 5
  // point 5.1: "SET BY YOU" is gone — the aside beside the size word is the
  // one place a hand pick names itself.
  // Phase 1 usual-fit: exact rail wording from FIRST_SIZE_USUAL_FIT_PROV.
  // Phase 2 brand-match: "CHART PICK · BRAND TEE" (F 2026-08-04) — provenance
  // not value. TEE is tops-only while Match is !bottoms; revisit if bottoms open.
  const provenance = hunting
    ? "READING CHART"
    : brandMatchSource && recSize && !isManual
      ? "CHART PICK · BRAND TEE"
      : usualFitSource && recSize && !isManual
        ? "CHART PICK · USUAL SIZE + FIT"
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

  // Card-back v2 copy: "Coat · your pick, we'd take the Medium"
  // Tap equals rec → green "recommended pick" (Kyle / F 2026-08-02). Green
  // means the app's pick only — see credenza-fashion.css green rule.
  const agreedWithRec = Boolean(isManual && recSize && !overrodeName);
  // Derived body numbers must not claim "Verified fit" (F ticket 2026-08-04).
  // A red blocker bar must not claim it either (debate 2026-08-08): the pick
  // is the closest the seller offers, not a verified fit.
  const confidenceLabel =
    precise || (recSize && chart)
      ? headerBlocked
        ? "Closest available"
        : derivedBodySource || usualFitSource || brandMatchSource
          ? "Estimated fit"
          : "Verified fit"
      : "Your usual size";
  // Phase 1 usual-fit keeps the AI size kicker with the new provenance rail
  // (F: "AI SIZE / CHART PICK · USUAL SIZE + FIT") — not a bare "your usual".
  const kickerLabel = !isManual
    ? recSize
      ? "AI size"
      : "Your usual size"
    : agreedWithRec
      ? "Recommended pick"
      : "Your pick";

  // 2026-08-09 (Kyle's simpler-card mockup): the editorial header is one
  // sentence now — "Take the Medium." under a WE RECOMMEND kicker, with the
  // confidence pill on the same line. The headline always names the
  // recommendation, even after a hand pick; the pick gets its own small line
  // below (Fable ruling 2026-07-29: the advice never hides). Without a
  // chart pick the old bare-letter headline stands in.
  const headlineWord = recSize ? formatSizeToken(recSize) || recSize : "";
  const editorialKicker = recSize
    ? "We recommend"
    : usualSize
      ? "Your usual size"
      : "The seller's chart";
  const editorialHeadline = headlineWord
    ? "Take the " + headlineWord + "."
    : usualSize
      ? "We'd keep your usual " + (formatSizeToken(usualSize) || usualSize) + "."
      : "No confident size yet.";
  // The pick never hides the advice, and it never steals the green. A tap that
  // disagrees names itself in plain ink; a tap that lands on the
  // recommendation earns the green agreement.
  const editorialPickLine = overrodeName
    ? "Your pick: the " + (formatSizeToken(chosenSize) || chosenSize) + "."
    : agreedWithRec
      ? "Your pick agrees."
      : "";

  return (
    <section className={"cz-sizing" + (isManual ? " is-manual" : "") + (editorial ? " is-editorial" : "")} aria-label="Sizing">
      {editorial ? (
        /* 2026-08-09 (Kyle's simpler-card mockup): one kicker, one sentence,
           one pill. The old bare letter plus "Coat · your pick, we'd take the
           Medium" aside is retired — the sentence carries the advice and the
           pick line below carries the tap. */
        <div className="cz-fit-result">
          <div className="cz-fit-result-head">
            <span className="cz-fit-result-kicker">{editorialKicker}</span>
            <span className="cz-fit-result-trail">
              {/* Kyle 2026-08-03: "set your fit preferences does not take you
                  anywhere". Credenza only knows fit questions for four
                  categories. On a category with none, FitPrefAsk renders
                  nothing, so the button led to a blank. Show the button only
                  where a question exists. */}
              {onAskPref && item && FIT_PREF_AXES[item.category] ? (
                <button
                  type="button"
                  className="cz-fit-result-pref"
                  onClick={onAskPref}
                >
                  {fitPrefToggleLabel(item, fitPref)}
                </button>
              ) : null}
              <span className={"cz-fit-result-badge" + (headerBlocked ? " is-blocked" : "")}>
                <span className="cz-fit-result-dot" aria-hidden="true" />
                {confidenceLabel}
              </span>
            </span>
          </div>
          <h3 className="cz-fit-result-headline">{editorialHeadline}</h3>
          {editorialPickLine ? (
            <p className={"cz-fit-result-pick" + (agreedWithRec ? " is-rec" : "")}>
              {editorialPickLine}
            </p>
          ) : null}
        </div>
      ) : (
        <>
          <div className="cz-sizing-head">
            <span className="cz-sizing-dot" aria-hidden="true" />
            <span
              className={
                "cz-sizing-kicker" + (agreedWithRec ? " is-rec" : "")
              }
            >
              {kickerLabel}
            </span>
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
              <span className="cz-sizing-value is-empty">-</span>
            )}
            {aside ? <span className="cz-sizing-aside">{aside}</span> : null}
          </div>
        </>
      )}

      {/* Desktop Fit fold: analysis sits under the size headline, before the cards. */}
      {editorial && analysis ? (
        <p className="cz-fit-analysis">{analysis}</p>
      ) : null}

      {/* Round 5 point 5.1: the measurement cells double as the size picker.
          One row does both jobs — before, a second plain chip row under it
          offered the same sizes again. Tap the picked cell to clear the
          pick. 2026-08-09 (Kyle's simpler-card mockup): with body numbers
          present, each chip grades itself — size, verdict word, and the two
          ease lines. Without them the plain garment-measure cells stand in. */}
      {cellReads && cellReads.length ? (
        <div className="cz-sizing-chart" role="group" aria-label="Item size choices">
          {cellReads.map((read) => {
            const picked =
              String(read.size).toUpperCase() === String(heroSize).toUpperCase();
            const manualOffPick = picked && isManual && !read.isPick;
            // The word slot: the recommendation says YOUR FIT, any other
            // in-band size says ALSO FITS, and a hand pick that disagrees
            // names itself YOUR PICK (the advice stays on its own chip).
            const word = manualOffPick
              ? "YOUR PICK"
              : read.word === "FITS"
                ? read.isPick
                  ? "YOUR FIT"
                  : "ALSO FITS"
                : read.word;
            const tone =
              word === "YOUR FIT"
                ? " is-fit"
                : word === "TIGHT" || word === "BIG"
                  ? " is-warn"
                  : word === "TOO SMALL" || word === "TOO BIG"
                    ? " is-bad"
                    : "";
            const signed = (v) => (v >= 0 ? "+" : "") + formatMeasure(v, units);
            return (
              <button
                key={read.size}
                type="button"
                className={
                  "cz-sizing-cell has-reads" +
                  (picked ? " is-pick" : "") +
                  (manualOffPick ? " is-pick-manual" : "") +
                  (read.isPick ? " is-rec" : "")
                }
                aria-pressed={isManual && picked}
                // A tap always picks; clearing keeps its own doors (the Other
                // box). See the legacy cells below for the ruling's history.
                onClick={() => onPick && onPick(String(read.size))}
              >
                <span className="cz-sizing-cell-k">{formatSizeToken(read.size) || read.size}</span>
                <span className={"cz-sizing-cell-word" + tone}>{word}</span>
                <span className="cz-sizing-cell-ease">
                  {read.label} {signed(read.ease)}
                </span>
                {/* Always mounted, empty when the partner number is missing —
                    the row keeps one height, same ruling as the old tag lane. */}
                <span className="cz-sizing-cell-ease" aria-hidden={read.extra ? undefined : true}>
                  {read.extra ? read.extra.label + " " + signed(read.extra.ease) : ""}
                </span>
              </button>
            );
          })}
          {customBox}
        </div>
      ) : cells.length ? (
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
            const showRecTag = editorial ? isRec : recOutlined;
            return (
              <button
                key={row.size}
                type="button"
                className={
                  "cz-sizing-cell" +
                  (picked ? " is-pick" : "") +
                  (picked && isManual && !isRec ? " is-pick-manual" : "") +
                  (recOutlined || (editorial && isRec) ? " is-rec" : "")
                }
                aria-pressed={isManual && picked}
                // Kyle 2026-07-31: a second tap on the picked cell must NOT
                // clear the pick ("it toggles off, it is redundant"). A tap
                // always picks. Clearing still has its own doors: the Clear
                // size button on the no-chart chip run, and an empty commit
                // in the Other box.
                onClick={() => onPick && onPick(String(row.size))}
              >
                <span className="cz-sizing-cell-k">{formatSizeToken(row.size) || row.size}</span>
                <span className="cz-sizing-cell-v">{formatMeasure(row[measureKey], units)}</span>
                {/* Kyle 2026-07-31: the OUR PICK tag used to mount only on the
                    recommended cell, so a size tap grew that cell — and the
                    whole flex row stretched with it. The lane is always here
                    now, invisible when empty, and the row keeps one height. */}
                <span
                  className="cz-sizing-cell-tag"
                  aria-hidden={showRecTag ? undefined : true}
                >
                  {showRecTag ? (editorial ? "Recommended" : "Our pick") : " "}
                </span>
                {/* Phone panes (mobile item sheet spec 6.3): the picked card
                    names itself YOUR PICK, and the recommended card keeps its
                    OUR PICK tag even when it is the pick. The tag is display:
                    none outside the phone sheet, so the desktop card back is
                    unchanged. 2026-07-31: the phone lane is always rendered too
                    (invisible when empty) — it owns the tag on the phone, where
                    the desktop lane hides, so a size tap never stretches the
                    row there either. */}
                <span
                  className="cz-sizing-cell-tag cz-sizing-cell-tag-phone"
                  aria-hidden={isRec || (picked && isManual) ? undefined : true}
                >
                  {isRec ? "Our pick" : picked && isManual ? "Your pick" : " "}
                </span>
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
  imageHash: "",
  // FIX 0: true when chart-vision returned 401/403 — distinct from a bad photo.
  authRequired: false,
  // FIX 2b: true when daily cap blocked the read — distinct from a bad photo.
  capReached: false,
  // FIX 2c: true when the reader could not be reached at all — a slow server,
  // a timeout, or no internet. Distinct from a bad photo, because the photo
  // was never looked at.
  unavailable: false,
  // Kyle 2026-08-03: true when the read already wrote itself to the card, so
  // "Not this one" knows it must take the chart back off again.
  autoSaved: false,
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
  // Bug B (2026-08-02): typed cells are customer work product. Keep a live
  // ref so an async photo read can restore them after a failed attempt —
  // setState alone cannot snapshot mid-flight for the failure branch.
  const stateRef = useRef(state);
  stateRef.current = state;
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

  // Snapshot a hand-typed grid so a failed photo read can put it back.
  // Photo success may replace it; Cancel (dismiss) is the only explicit clear.
  // Deep-clone rows so a later fix/read cannot mutate the restored copy.
  function snapshotTypedWork(prev) {
    if (!prev || !prev.typed || !prev.chart) return null;
    const rows = Array.isArray(prev.chart.rows)
      ? prev.chart.rows.map((row) => ({ ...row }))
      : [];
    const columns = Array.isArray(prev.chart.columns) ? prev.chart.columns.slice() : [];
    return {
      typed: true,
      dirty: prev.dirty === true,
      chart: { rows, columns },
      text: prev.text || "",
      imageHash: prev.imageHash || "",
    };
  }

  // FIX 2c: a read that failed because the reader was unreachable deserves a
  // plain "Try again" on the SAME photos. Opening the file picker is the wrong
  // answer there — the customer picked nothing wrong.
  const lastRead = useRef(null);

  const read = async (sources, { thumb = "", referer = "" } = {}) => {
    const list = Array.isArray(sources) ? sources : [sources];
    lastRead.current = { list, thumb, referer };
    // Capture BEFORE wiping into "reading" — typed numbers must survive a miss.
    const typedPrior = snapshotTypedWork(stateRef.current);
    setState({ ...EMPTY_CHART_READ, reading: true, thumb, count: list.length });
    // Remote album photos go down the images door (the server fetches them
    // through its allowlist); files and data: URLs go inline. Never both.
    // Low-cost rule: one candidate for a paid read when the customer hands
    // us a list — rank is not needed for a deliberate single upload, but a
    // multi-photo album pick still pays once for the first successful read.
    const remote = list.filter((s) => typeof s === "string" && /^https?:\/\//i.test(s));
    let text = null;
    let imageHash = "";
    // true when the model returned text that failed local validation
    let sawUnparseable = false;
    // FIX 0: any 401/403 from chart-vision — stop and show signed-out state.
    let sawAuth = false;
    // FIX 2b: daily cap — stop and show cap state (never "could not read").
    let sawCap = false;
    // FIX 2c: the reader was not reachable — a server fault, a timeout, or no
    // internet. Not a photo fault, so it must not read "could not read".
    let sawUnavailable = false;
    let sawOffline = false;
    if (remote.length) {
      // One photo per paid read (low-cost rule 3). Stop on first valid chart.
      for (const url of remote.slice(0, 3)) {
        const raw = await fetchChartFromPhotos([url], {
          referer: referer || item.url || undefined,
        });
        if (!alive.current) return;
        if (isChartAuthRequired(raw)) {
          sawAuth = true;
          break;
        }
        if (isChartCapReached(raw)) {
          sawCap = true;
          break;
        }
        // FIX 2c: the reader was not reachable for THIS photo. Try the next
        // one — a second photo may still get through — but remember it, so a
        // total failure never blames a photo nobody looked at.
        if (isChartUnavailable(raw)) {
          sawUnavailable = true;
          if (isChartOffline(raw)) {
            sawOffline = true;
            break;
          }
          continue;
        }
        if (!raw) continue;
        if (validateChartResult(raw, parseSizeChart).ok) {
          text = raw;
          imageHash = chartImageKey(url);
          rememberChartImage(imageHash, text, parseSizeChart);
          break;
        }
        sawUnparseable = true;
      }
    } else {
      const raw = await readChartFromPhotoFiles(list, {
        referer: referer || item.url || undefined,
      });
      if (!alive.current) return;
      if (isChartAuthRequired(raw)) {
        sawAuth = true;
      } else if (isChartCapReached(raw)) {
        sawCap = true;
      } else if (isChartUnavailable(raw)) {
        sawUnavailable = true;
        sawOffline = isChartOffline(raw);
      } else if (raw && validateChartResult(raw, parseSizeChart).ok) {
        text = raw;
        if (typeof list[0] === "string" && /^data:image\//i.test(list[0])) {
          imageHash = chartImageKey(list[0]);
          rememberChartImage(imageHash, text, parseSizeChart);
        }
      } else if (raw) {
        sawUnparseable = true;
      }
    }
    if (!alive.current) return;
    if (sawAuth) {
      // Bug B + Fix 0: auth wall must not wipe hand-typed numbers (the case
      // Kyle hit tonight — signed-out photo path after typing a chart).
      if (typedPrior) {
        setState({
          ...EMPTY_CHART_READ,
          ...typedPrior,
          thumb: thumb || "",
          error: CHART_AUTH_COPY + " Your typed numbers are still here.",
          authRequired: true,
        });
        return;
      }
      setState({
        ...EMPTY_CHART_READ,
        thumb,
        error: CHART_AUTH_COPY,
        authRequired: true,
      });
      return;
    }
    if (sawCap) {
      // FIX 2b: same typed-preserve rule as auth — cap is not a wipe.
      const capMsg = chartCapCopy();
      if (typedPrior) {
        setState({
          ...EMPTY_CHART_READ,
          ...typedPrior,
          thumb: thumb || "",
          error: capMsg + " Your typed numbers are still here.",
          capReached: true,
        });
        return;
      }
      setState({
        ...EMPTY_CHART_READ,
        thumb,
        error: capMsg,
        capReached: true,
      });
      return;
    }
    // FIX 2c: the reader never answered. Say that. A photo the reader never
    // looked at cannot be a bad photo. If ANY photo did come back and simply
    // held no sizes, that is the more useful thing to say, so it wins.
    if (sawUnavailable && !text && !sawUnparseable) {
      const outMsg = sawOffline ? CHART_OFFLINE_COPY : CHART_UNAVAILABLE_COPY;
      if (typedPrior) {
        setState({
          ...EMPTY_CHART_READ,
          ...typedPrior,
          thumb: thumb || "",
          error: outMsg + " Your typed numbers are still here.",
          unavailable: true,
        });
        return;
      }
      setState({
        ...EMPTY_CHART_READ,
        thumb,
        error: outMsg,
        unavailable: true,
      });
      return;
    }
    const check = text ? validateChartResult(text, parseSizeChart) : { ok: false };
    if (!check.ok) {
      const photoError = sawUnparseable
        ? "I read the photo but could not find sizes in it. Try a straighter shot of the table."
        : "I could not read that photo. Try again with the whole table in frame.";
      // Bug B: restore typed work. Never leave the customer with an empty grid
      // after a failed photo path wiped their numbers.
      if (typedPrior) {
        setState({
          ...EMPTY_CHART_READ,
          ...typedPrior,
          thumb: thumb || "",
          error: photoError + " Your typed numbers are still here.",
        });
        return;
      }
      setState({
        ...EMPTY_CHART_READ,
        thumb,
        error: photoError,
      });
      return;
    }
    // Kyle 2026-08-03: "it shouldn't have to REREAD." A read costs a daily
    // credit, so throwing the answer away when the card closes charges the
    // customer twice for one chart. The silent hunt has always saved itself
    // (see useChartHunt). Now the customer-run read saves itself too, the
    // moment it succeeds. The preview below still shows, and "Use this chart"
    // still commits any correction the customer types over the top.
    onSaveEdit(item.id, {
      sizeChartText: text,
      sizeChartNeedsClear: false,
      sizeChartSource: {
        via: "customer-photo",
        photos: list.length,
        at: new Date().toISOString(),
        ...(imageHash ? { imageHash } : {}),
        ...(item.seller ? { seller: String(item.seller).slice(0, 60) } : {}),
      },
    });
    setState({ ...EMPTY_CHART_READ, chart: check.chart, text, thumb, imageHash, autoSaved: true });
  };

  // Kyle 2026-07-30: "let you type the chart numbers by hand in twenty
  // seconds". A blank chart is staged in the same preview a photo read uses,
  // so one grid, one confirm and one save path serve both. Nothing is stored
  // until the customer presses save.
  const startTyping = (category) => {
    // Bug B: a second tap must not wipe numbers already entered. Only Cancel
    // (dismiss) or a successful save clears the grid.
    if (stateRef.current.typed && stateRef.current.chart) {
      setState((prev) => ({ ...prev, error: "" }));
      return;
    }
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
    const check = validateChartResult(text, parseSizeChart);
    if (!check.ok) {
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
        ...(state.imageHash ? { imageHash: state.imageHash } : {}),
        ...(item.seller ? { seller: String(item.seller).slice(0, 60) } : {}),
      },
    });
    setState(EMPTY_CHART_READ);
  };

  // "Not this one" rejects the read. A read that saved itself must therefore
  // un-save itself, or a rejected chart would stay on the card.
  const dismiss = () => {
    if (stateRef.current.autoSaved) {
      onSaveEdit(item.id, {
        sizeChartText: "",
        sizeChartSource: null,
        sizeChartNeedsClear: false,
      });
    }
    setState(EMPTY_CHART_READ);
  };

  // A corrected cell rewrites the staged chart. It does NOT re-parse: a
  // half-typed "1" is under the parser's 20cm floor, so a round trip per
  // keystroke would blank the cell under the customer's fingers. The text is
  // regenerated once, at commit.
  const fix = (nextChart) => {
    setState((prev) => ({ ...prev, chart: nextChart, dirty: true, error: "" }));
  };

  // FIX 2c: repeat the last read with the same photos. Used only by the
  // "Try again" button on the not-answering state.
  const retryLast = () => {
    const last = lastRead.current;
    if (!last) return;
    read(last.list, { thumb: last.thumb, referer: last.referer });
  };

  return { ...state, read, commit, dismiss, fix, startTyping, retryLast };
}

// The no-chart state keeps the usual size visible but unverified.
// The Size panel owns the single chart upload action.
// 2026-08-04 link-failure copy: the resolve/yupoo 422 `code`, stored on the
// item as failCode, names WHICH paste mistake happened. One line per code;
// anything unknown falls through to the old generic line below.
const LINK_FAIL_COPY = {
  "shop-front":
    "That's a shop's front page, not one item. Open the shop and copy a single item's link.",
  "agent-short": "Agent short links can't be opened here. Paste the seller's own link instead.",
  "yupoo-category":
    "That's a Yupoo shop page, not one album. Open the album for the item you want.",
  "yupoo-shop-root":
    "That's a Yupoo shop page, not one album. Open the album for the item you want.",
  "link-cut-off": "That link looks cut off. Copy it again from the post.",
  "short-link-dead": "That short link no longer opens. Ask the poster for the seller's link.",
};

// Tier 2/3 partial-info signal (F, measured on the 52-link corpus 2026-08-04):
// the shared 购前说明 legal-notice image rides descImages on every Weidian
// listing since fcc03fb, so it is filtered out before counting real photos.
//   real photos 0 + a size axis  -> "no-measurements": sizes listed, no chart.
//   real photos 0 + no size axis -> "bare": a name and a price only (Taobao
//     by construction — the copy names Taobao, so the signal requires one).
// The constant lives in chart-pipeline.js: the hunt filters the same photo
// out of the paid pool (#39), so both layers share the one string.
export function listingInfoOf(item) {
  if (!item) return "";
  const realDesc = (Array.isArray(item.descImages) ? item.descImages : []).filter(
    (u) => !isWeidianPolicyImg(String(u))
  );
  if (realDesc.length > 0) return "";
  const hasSizeAxis = (Array.isArray(item.variants) ? item.variants : []).some((g) =>
    /尺码|尺寸|size/i.test((g && g.title) || "")
  );
  if (hasSizeAxis) return "no-measurements";
  const urls = [item.url, ...(Array.isArray(item.links) ? item.links : []).map((l) => l && l.url)]
    .filter(Boolean)
    .join(" ");
  if (/taobao|tmall/i.test(urls)) return "bare";
  return "";
}

function SizingBlockNoChart({
  usualSize,
  isManual = false,
  needsClear = false,
  onClearChart,
  needsSignIn = false,
  // Spec step 3 (2026-08-08): the caller computes the plain no-chart case
  // (no blocked reason, no WhatsApp, no fail code) once, and this block then
  // renders the locked pick screen instead of the old fallback wall.
  pickScreen = false,
  // Spec step 3b (2026-08-08): non-sized categories (accessory, bag). No
  // chips, no helper, no chart-entry actions here — those stay in Settings.
  // One calm line; Kyle picked the words.
  oneLiner = false,
  category = "",
  runValues = [],
  chosenSize = "",
  // The profile usual, passed separately because usualSize above carries the
  // hand pick once one exists. Drives the gap note (Kyle 2026-08-08: "shoe
  // size in measurements say 10, fit detail clocks me as a 9").
  savedUsual = "",
  customSize = "",
  onCustomChange = null,
  onCommit = null,
  onPick = null,
  onUpload = null,
  onEnterManual = null,
  // FIX 0: hunt (or prior read) hit chart-vision 401/403. Distinct from the
  // free-card-gate needsSignIn path, which keeps its own finish-card copy.
  chartAuthBlocked = false,
  // FIX 2b: hunt hit daily chart-read cap. Distinct from auth and from a miss.
  chartCapBlocked = false,
  // Kyle 2026-08-03: the chart is in the seller's product details, and the
  // day's cards are spent, so Credenza cannot fetch it. Name the real reason.
  chartCardsBlocked = false,
  // FIX 2c: the hunt could not reach the reader. The item may well have a
  // chart; nobody got to look. "No chart for this one yet." would be a claim we
  // cannot make.
  chartOutBlocked = false,
  // #31 (Kyle 2026-08-04): the per-minute traffic window stopped the read.
  // Not the plan, not the item — wait a minute.
  chartRateBlocked = false,
  // #31: the site-wide daily cost guard stopped the read. Back tomorrow.
  chartOffBlocked = false,
  // WhatsApp when no validated chart rec (even if variants list S–XL).
  whatsapp = "",
  variantRun = "",
  // 2026-08-04: WHY the link failed (LINK_FAIL_COPY key from item.failCode),
  // and what a successful-but-thin listing actually carries (listingInfoOf).
  failCode = "",
  listingInfo = "",
}) {
  const heroLabel = formatSizeToken(usualSize) || usualSize || "";
  const waUrl = whatsAppChatUrl(whatsapp);
  const signedOut = needsSignIn || chartAuthBlocked;
  // Cap blocks photo reads; still show the album row so the person can see
  // photos, but the primary path is the honest limit message.
  // Show WhatsApp when the seller listed a contact and we have no chart
  // recommendation (this block only mounts with no validated chart).
  // FIX 2c: a reader we could not reach proves nothing about this item, so the
  // "ask the seller" path is premature. Offer the retry first.
  const showWhatsApp =
    !!waUrl &&
    !signedOut &&
    !chartCapBlocked &&
    !chartCardsBlocked &&
    !chartOutBlocked &&
    !chartRateBlocked &&
    !chartOffBlocked &&
    !needsClear;

  // Spec step 3, sized categories (LOCKED by Kyle 2026-08-08, after panel
  // consult). The plain no-chart Fit tab: the missing-chart line, the saved
  // usual size converted into the listing's scale, one row of chips in the
  // listing's scale (shoe chips show BOTH systems — "EU 43 · US 10"), the
  // truthful helper (the size stays on this card; it never goes to the
  // agent), and the same two chart-entry actions Settings carries. No green
  // anywhere: no chart means no recommendation. Nothing else on the screen.
  if (oneLiner) {
    return (
      <section className="cz-sizing cz-sizing-nochart" aria-label="Sizing recommendation">
        <div className="cz-sizing-head">
          <span className="cz-sizing-dot" aria-hidden="true" />
          <span className="cz-sizing-kicker">No sizes</span>
        </div>
        <p className="cz-sizing-nochart-body">
          One size only. The photos show how big it is.
        </p>
      </section>
    );
  }

  if (pickScreen) {
    const pickHero = formatSizeToken(usualSize) || usualSize || "";
    const shoeUsual = category === "shoes" ? shoeUsualLabel(usualSize) : "";
    const pickRun =
      category === "shoes" ? extendShoeRun(runValues, savedUsual || usualSize) : runValues;
    // Gap note (Kyle 2026-08-08): a hand pick that is NOT the saved usual
    // names the usual in one plain line, so the card never reads as if it
    // re-measured the buyer. Same size in another scale (EU 43 vs US 10) is
    // not a gap.
    const sameAsUsual = (() => {
      if (!isManual || !savedUsual) return true;
      if (category === "shoes") {
        const a = parseShoeSizeToken(chosenSize);
        const b = parseShoeSizeToken(savedUsual);
        if (!a || !b) return false;
        const an = a.system === "eu" ? a.n : shoeSizeAlt(a.system, a.n).n;
        const bn = b.system === "eu" ? b.n : shoeSizeAlt(b.system, b.n).n;
        return an === bn;
      }
      return String(chosenSize).trim().toUpperCase() === String(savedUsual).trim().toUpperCase();
    })();
    const usualNote =
      category === "shoes"
        ? shoeUsualLabel(savedUsual)
        : formatSizeToken(savedUsual) || savedUsual;
    return (
      <section className="cz-sizing cz-sizing-nochart" aria-label="Sizing recommendation">
        <div className="cz-sizing-head">
          <span className="cz-sizing-dot" aria-hidden="true" />
          <span className="cz-sizing-kicker">No chart</span>
        </div>
        <p className="cz-sizing-nochart-body">
          {listingInfo === "no-measurements"
            ? "This seller posted no measurements. Pick a size yourself. I cannot recommend one."
            : "No size chart for this one yet."}
        </p>
        {pickHero ? (
          <p className="cz-sizing-picked">
            {isManual
              ? `You picked ${pickHero}.`
              : `Your usual size is ${shoeUsual || pickHero}.`}
          </p>
        ) : null}
        {!sameAsUsual && usualNote ? (
          <p className="cz-sizing-picked cz-sizing-usual-note">
            Your saved usual is {usualNote}.
          </p>
        ) : null}
        <SizeChoiceEditor
          chosenSize={chosenSize}
          recommendedSize=""
          runValues={pickRun}
          customSize={customSize}
          onCustomChange={onCustomChange}
          onCommit={onCommit}
          onPick={onPick}
          dualShoe={category === "shoes"}
          fullRun
        />
        <p className="cz-sizing-helper">
          Pick a size. It's saved on this card for when you order.
        </p>
        <div className="cz-sizing-nochart-actions">
          <button type="button" className="cz-sizing-action" onClick={onUpload}>
            Upload chart photo
          </button>
          <button type="button" className="cz-sizing-action" onClick={onEnterManual}>
            Enter chart by hand
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="cz-sizing cz-sizing-nochart" aria-label="Sizing recommendation">
      <div className="cz-sizing-head">
        <span className="cz-sizing-dot" aria-hidden="true" />
        {/* The server refused to read this link because nobody is signed in.
            The card says so here, where the chart belongs, so an empty card
            never reads as a broken site (Kyle 2026-07-30). */}
        <span className="cz-sizing-kicker">
          {chartCapBlocked || chartCardsBlocked
            ? "Daily limit"
            : signedOut
              ? "Needs sign-in"
              : chartOutBlocked
                ? "Not answering"
                : chartRateBlocked
                  ? "Busy"
                  : chartOffBlocked
                    ? "Back tomorrow"
                    : showWhatsApp
                      ? "No size in link"
                      : /* 2026-08-04: the kicker stays "No chart" for every cause —
                           the sentence below now names the cause (link-failure
                           code, tier 2/3 thin listing). Four pinned tests read
                           this exact label. */
                        "No chart"}
        </span>
        {/* Round 5 point 5.1: one notice for a hand pick — "you picked this"
            beside the size word. The "SET BY YOU" label here was a second
            copy, so a hand pick now leaves the provenance slot empty.
            2026-07-29 (Oom review): the fallback line shows only when a
            usual size EXISTS to fall back to — "FELL BACK TO YOUR USUAL"
            beside "no usual size saved" contradicts itself. */}
        {isManual || !heroLabel || showWhatsApp ? null : (
          <span className="cz-sizing-prov">FELL BACK TO YOUR USUAL</span>
        )}
      </div>

      {showWhatsApp ? (
        <>
          {/* Kyle exact copy — do not reword. */}
          <p className="cz-sizing-nochart-body cz-sizing-whatsapp-copy">
            No size available in link, message seller on WhatsApp
          </p>
          {variantRun ? (
            <p className="cz-sizing-nochart-body cz-sizing-variant-run">Sizes listed: {variantRun}</p>
          ) : null}
          <a
            className="cz-sizing-whatsapp-btn"
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            WhatsApp
          </a>
        </>
      ) : (
        <>
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
                <span className="cz-sizing-value is-empty">-</span>
                <span className="cz-sizing-aside">no usual size saved</span>
              </>
            )}
          </div>

          <p className="cz-sizing-nochart-body">
            {chartCapBlocked
              ? chartCapCopy()
              : chartCardsBlocked
              ? chartCardsCapCopy()
              : chartAuthBlocked
              ? CHART_AUTH_COPY
              : chartRateBlocked
              ? CHART_RATE_LIMITED_COPY
              : chartOffBlocked
              ? CHART_READER_OFF_COPY
              : needsSignIn
              ? "Sign in to finish this card. Credenza then reads the product, the photos, and the size chart."
              : needsClear
              ? "This saved chart came from another item. It is hidden. Clear it before reading this item's photos."
              : chartOutBlocked
              ? /* FIX 2c: nobody read anything, so claim nothing about the item.
                   The hunt runs on its own, with no photo the customer picked,
                   so this wording keeps the customer out of it. */
                CHART_HUNT_UNAVAILABLE_COPY
              : failCode && LINK_FAIL_COPY[failCode]
                ? /* 2026-08-04: name the paste mistake — the link itself can
                     never become a card, so say what to paste instead. */
                  LINK_FAIL_COPY[failCode]
                : listingInfo === "no-measurements"
                  ? /* Tier 2 (F, 2026-08-04): the app KNOWS the size run but the
                       seller posted no chart — say so instead of sitting blank
                       and reading as broken. Exact wording per F/O. No seller-
                       contact promise here: the WhatsApp branch above only
                       renders when a number actually exists. */
                    "This seller posted no measurements. Pick a size yourself. I cannot recommend one."
                  : listingInfo === "bare"
                    ? "Taobao links carry a name and price only. Find this item on Weidian for sizes."
                    : /* Kyle 2026-07-30: keep this state short. Two lines, then the
                         buttons. The old copy explained the upload button that sits
                         directly below it.
                         Kyle 2026-08-03: "there needs to be something here, or else
                         it's just a blank screen." The sentence now says the chart is
                         missing for now, not that the item has none. */
                      "No chart for this one yet."}
          </p>
          {/* Kyle 2026-08-03: the pane read as empty. This line says, in words,
              which size the card is holding. The big letter above is the same
              fact, but a letter on its own answers nothing. */}
          {heroLabel ? (
            <p className="cz-sizing-picked">
              {isManual ? `You picked ${heroLabel}.` : `Your usual size is ${heroLabel}.`}
            </p>
          ) : null}
          {/* Kyle 2026-08-03: "it should pull up a modal." The cards wall only
              ever reaches a signed-in customer on the free plan — chartNeedsCards
              reads the free daily count, and a signed-out person has none. So
              that wall always offers the plans sheet. The chart-read wall still
              asks a signed-out person to sign in.
              #31 (2026-08-04): the button does what its label says. "Sign in"
              opens the sign-in window (requestChartSignIn), never the plans
              sheet. A paying customer at the monthly cap gets no button — the
              copy already says the reads renew. */}
          {chartCardsBlocked ? (
            <button
              type="button"
              className="cz-sizing-action is-primary"
              onClick={() => requestChartLimits()}
            >
              See plans
            </button>
          ) : chartCapBlocked ? (
            chartCapWantsUpgrade() ? (
              <button
                type="button"
                className="cz-sizing-action is-primary"
                onClick={() => requestChartLimits()}
              >
                See plans
              </button>
            ) : chartCapWantsSignIn() ? (
              <button
                type="button"
                className="cz-sizing-action is-primary"
                onClick={() => requestChartSignIn()}
              >
                Sign in
              </button>
            ) : null
          ) : chartAuthBlocked ? (
            <button
              type="button"
              className="cz-sizing-action is-primary"
              onClick={() => requestChartSignIn()}
            >
              Sign in
            </button>
          ) : null}
        </>
      )}

      {/* Kyle 2026-08-03: "if it doesnt catch it the first time it never does,
          take it out." The row that offered to read the album photos is gone.
          Each press spent a paid call and a daily card for an answer that was
          never there. The automatic read still runs once, on its own.
          "Clear this chart" stays. It costs nothing and it is the only way out
          of a chart that belongs to another item. */}
      {signedOut || chartCardsBlocked ? null : needsClear && onClearChart ? (
        <button type="button" className="cz-sizing-albumrow" onClick={onClearChart}>
          <span className="cz-sizing-albumtext">Clear this chart</span>
          <ChevronRight size={14} strokeWidth={2.4} aria-hidden="true" />
        </button>
      ) : null}
    </section>
  );
}

// ── Seller chart fold (card-back v2 Fit fold, 2026-08-02) ──
//
// The Chart tab is gone. Its per-size table now folds shut under the Fit
// pane ("THE SELLER'S CHART"). Same grid markup as the old DesktopChartTab —
// no bars (Fit already has them), no big action buttons (text links only).
// Math still comes from recommendSize + fitReadRows.
const CHART_MEASURE_COLS = [
  ["chest", "Chest"],
  ["shoulder", "Shoulder"],
  ["sleeve", "Sleeve"],
  ["waist", "Waist"],
  ["hip", "Hip"],
  ["pantsLength", "Pants length"],
  ["length", "Length"],
];

function listingHostLabel(item) {
  try {
    return new URL(item.url).hostname.replace(/^www\./i, "");
  } catch {
    return "";
  }
}

function chartOriginLabel({ reading, hunting, hasChart, sourceVia }) {
  if (reading) return "READING YOUR PHOTO";
  if (hunting) return "READING YOUR PHOTO";
  if (!hasChart) return "NO CHART YET";
  if (sourceVia === "album-text" || sourceVia === "listing-text" || sourceVia === "summary") {
    return "PULLED FROM THE LISTING";
  }
  return "SELLER'S CHART";
}

function SellerChartFold({
  item,
  chart,
  bodyProfile,
  fitPref,
  units,
  recSize,
  chosenSize,
  chartIsForgettable,
  onPick,
  onUpload,
  onEnterManual,
  onForgetChart,
}) {
  // Kyle 2026-08-02 item 4: seller chart shown by default (photo 7 SHOW
  // control was the complaint that it started closed). Hide toggle remains.
  const [open, setOpen] = useState(true);
  const profile = useMemo(() => effectiveBodyProfile(bodyProfile), [bodyProfile]);
  const hasChart = !!(chart && Array.isArray(chart.rows) && chart.rows.length);
  const host = listingHostLabel(item);
  const sizeCount = hasChart ? chart.rows.length : 0;
  const sourceVia = item && item.sizeChartSource && item.sizeChartSource.via;
  const origin = chartOriginLabel({
    reading: false,
    hunting: false,
    hasChart: true,
    sourceVia,
  });

  const cols = useMemo(() => {
    if (!hasChart) return [];
    return CHART_MEASURE_COLS.filter(([key]) => chart.rows.some((r) => r[key] != null));
  }, [hasChart, chart]);

  const easeBySize = useMemo(() => {
    if (!hasChart || !profile) return {};
    const out = {};
    for (const row of chart.rows) {
      if (!row.size) continue;
      const sizeRec = recommendSize(
        chart,
        profile,
        item.category,
        fitPref,
        row.size,
        item.title,
        elasticEvidenceTextFor(item)
      );
      const readRows = fitReadRows(chart, sizeRec, profile, item.category, item.title);
      const map = {};
      for (const r of readRows) map[r.key] = r;
      out[String(row.size).toUpperCase()] = map;
    }
    return out;
  }, [chart, profile, fitPref, item.category, item.title]);

  const yoursByKey = useMemo(() => {
    const map = {};
    if (!profile) return map;
    for (const [key] of cols) {
      const bodyKey =
        key === "pantsLength"
          ? item.category === "shorts"
            ? "shortsLength"
            : "pantsLength"
          : key;
      let yours = bodyKey != null && profile[bodyKey] != null ? Number(profile[bodyKey]) : null;
      let estimated =
        bodyKey != null &&
        Array.isArray(profile.estimatedFields) &&
        profile.estimatedFields.includes(bodyKey);
      if ((yours == null || !isFinite(yours)) && key === "length") {
        const h = Number(profile.height);
        if (isFinite(h) && h >= 120 && h <= 230) {
          yours = Math.round(0.3 * h * 2) / 2;
          estimated = true;
        }
      }
      if (yours != null && isFinite(yours)) {
        map[key] = { value: yours, estimated: !!estimated };
      }
    }
    return map;
  }, [cols, profile, item.category]);

  if (!hasChart) return null;

  const headLabel =
    "THE SELLER'S CHART · " +
    sizeCount +
    " SIZE" +
    (sizeCount === 1 ? "" : "S") +
    (host ? " · " + host.toUpperCase() : "");

  const gridStyle = {
    gridTemplateColumns: "76px repeat(" + cols.length + ", minmax(0, 1fr))",
  };

  return (
    <div className={"cz-seller-chart-fold" + (open ? " is-open" : "")}>
      <button
        type="button"
        className="cz-fit-read-toggle cz-seller-chart-toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{headLabel}</span>
        <span>{open ? "Hide" : "Show"}</span>
      </button>
      {open ? (
        <div className="cz-seller-chart-body">
          <div className="cz-chart-head">
            <span className="cz-chart-origin">{origin}</span>
            <span className="cz-chart-source-links">
              {onUpload ? (
                <button type="button" className="cz-detail-chart-link" onClick={onUpload}>
                  Replace
                </button>
              ) : null}
              {onEnterManual ? (
                <button type="button" className="cz-detail-chart-link" onClick={onEnterManual}>
                  Enter by hand
                </button>
              ) : null}
              {chartIsForgettable && onForgetChart ? (
                <button type="button" className="cz-detail-chart-link" onClick={onForgetChart}>
                  Forget
                </button>
              ) : null}
              {/* Kyle 2026-08-03: the listing pull is gone. It re-read photos
                  the automatic read had already looked at, for a paid call. */}
            </span>
          </div>

          <div className="cz-chart-table" role="table" aria-label="Size chart with ease">
            <div className="cz-chart-row is-cols" role="row" style={gridStyle}>
              <span className="cz-chart-cell is-head" role="columnheader">
                Size
              </span>
              {cols.map(([key, label]) => (
                <span key={key} className="cz-chart-cell is-head" role="columnheader">
                  {label}
                </span>
              ))}
            </div>

            <div className="cz-chart-row is-yours" role="row" style={gridStyle}>
              <span className="cz-chart-cell is-size" role="rowheader">
                Yours
              </span>
              {cols.map(([key]) => {
                const y = yoursByKey[key];
                return (
                  <span key={key} className="cz-chart-cell is-yours-val" role="cell">
                    {y
                      ? (y.estimated ? "~" : "") + formatMeasure(y.value, units)
                      : "-"}
                  </span>
                );
              })}
            </div>

            {chart.rows.map((row) => {
              if (!row.size) return null;
              const keyU = String(row.size).toUpperCase();
              const isPick = !!chosenSize && keyU === String(chosenSize).toUpperCase();
              const isRec = !!recSize && keyU === String(recSize).toUpperCase();
              const easeMap = easeBySize[keyU] || {};
              return (
                <button
                  key={row.size}
                  type="button"
                  className={
                    "cz-chart-row is-size" +
                    (isPick ? " is-pick" : "") +
                    (isRec ? " is-rec" : "")
                  }
                  style={gridStyle}
                  onClick={() => onPick && onPick(String(row.size))}
                  aria-pressed={isPick}
                  aria-label={
                    "Size " +
                    (formatSizeToken(row.size) || row.size) +
                    (isRec ? ", recommended" : "") +
                    (isPick ? ", your pick" : "")
                  }
                >
                  <span className="cz-chart-cell is-size">
                    <span className="cz-chart-size-name">
                      {formatSizeToken(row.size) || row.size}
                    </span>
                    {isRec ? (
                      <span className="cz-chart-flag is-rec">Recommended</span>
                    ) : isPick ? (
                      <span className="cz-chart-flag is-pick">Your pick</span>
                    ) : null}
                  </span>
                  {cols.map(([key]) => {
                    const theirs = row[key];
                    const read = easeMap[key];
                    const ease = read && read.ease != null ? read.ease : null;
                    const warn = !!(read && read.warn);
                    const soft = !!(read && read.soft);
                    return (
                      <span key={key} className="cz-chart-cell is-measure">
                        <span className="cz-chart-theirs">
                          {theirs != null ? formatMeasure(theirs, units) : "-"}
                        </span>
                        <span
                          className={
                            "cz-chart-ease" +
                            (ease == null
                              ? " is-miss"
                              : warn
                                ? " is-out"
                                : soft
                                  ? " is-soft"
                                  : " is-in")
                          }
                        >
                          {ease != null
                            ? (ease >= 0 ? "+" : "") + formatMeasure(ease, units)
                            : "-"}
                        </span>
                      </span>
                    );
                  })}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ── Fit-read track + measure rows (shared by Fit tab + Chart tab) ──
//
// Four-lane debate 2026-08-08 (stage 2): a graded row pins the customer's
// BODY number at the center of the bar with "YOU · n" tagged below; the
// green band is the GARMENT range that fits that body; amber zones flank
// it; the garment number is the moving mark with its value tagged above.
// A row with no verdict (missing or estimated number) keeps the garment at
// the center and draws the band dashed. Row math lives in fitReadRows
// (pure, tested alone). The old tight↔loose ease ruler is gone.
function FitReadTrack({
  theirs,
  yours,
  estimated = false,
  mark,
  warn,
  soft = false,
  dashed = false,
  showBand = true,
  bandLeft = null,
  bandWidth = null,
  softLeft = null,
  softLeftWidth = null,
  softRight = null,
  softRightWidth = null,
  units,
}) {
  const bandStyle =
    bandLeft != null && bandWidth != null
      ? { left: bandLeft + "%", width: bandWidth + "%" }
      : undefined;
  return (
    <span className="cz-fitread-track">
      <span className="cz-fitread-rail" />
      {showBand && softLeft != null && softLeftWidth > 0 ? (
        <span
          className="cz-fitread-soft"
          style={{ left: softLeft + "%", width: softLeftWidth + "%" }}
        />
      ) : null}
      {showBand && softRight != null && softRightWidth > 0 ? (
        <span
          className="cz-fitread-soft"
          style={{ left: softRight + "%", width: softRightWidth + "%" }}
        />
      ) : null}
      {showBand && bandStyle ? (
        <span
          className={"cz-fitread-band" + (dashed ? " is-dashed" : "")}
          style={bandStyle}
        />
      ) : null}
      {theirs != null ? (
        <span
          className="cz-fitread-garment"
          style={{ left: (mark != null && yours != null ? mark : 50) + "%" }}
        >
          <span className="cz-fitread-garment-tick" />
          <span className="cz-fitread-garment-tag">{formatMeasure(theirs, units)}</span>
        </span>
      ) : null}
      {mark != null && yours != null ? (
        <span
          className={
            "cz-fitread-you" +
            (warn ? " is-warn" : soft ? " is-soft" : "") +
            (estimated ? " is-est" : "")
          }
          style={{ left: "50%" }}
        >
          <span className="cz-fitread-you-tag">
            {"YOU · " + (estimated ? "~" : "") + formatMeasure(yours, units)}
          </span>
        </span>
      ) : null}
    </span>
  );
}

function FitReadHeads({ kicker = null }) {
  if (!kicker) return null;
  return (
    <div className="cz-fitread-row cz-fitread-heads" aria-hidden="true">
      <span className="cz-fitread-kicker">{kicker}</span>
    </div>
  );
}

function FitReadMeasureRows({ rows, hasChart, units, rec = null }) {
  return rows.map((r) => {
    // Simpler fit card (Kyle's mockup, 2026-08-09): every graded row ends in
    // one plain word — "oversized", "a touch tight", "fine". The numbers stay;
    // the word is what a customer reads first.
    const word = fitRowWord(r, rec);
    return (
    <div key={r.key} className="cz-fitread-row">
      <div className="cz-fitread-rowhead">
        <span className="cz-fitread-name">{r.name}</span>
        <span className="cz-fitread-nums">
          {r.theirs != null ? (
            <>
              {"garment "}
              <b>{formatMeasure(r.theirs, units)}</b>
              {" · you "}
              {r.yours != null
                ? (r.estimated ? "~" : "") + formatMeasure(r.yours, units)
                : "–"}
              {r.ease != null ? (
                <>
                  {" · "}
                  <span
                    className={
                      "cz-fitread-diff" +
                      (r.warn ? " is-warn" : r.soft ? " is-soft" : "")
                    }
                  >
                    {(r.ease >= 0 ? "+" : "") + formatMeasure(r.ease, units) + " room"}
                  </span>
                </>
              ) : null}
              {word ? (
                <>
                  {" · "}
                  <span
                    className={
                      "cz-fitread-word" +
                      (r.warn ? " is-warn" : r.soft ? " is-soft" : "")
                    }
                  >
                    {word}
                  </span>
                </>
              ) : null}
            </>
          ) : r.notOnChart ? (
            <span className="cz-fitread-unknown">not on the seller's chart</span>
          ) : r.yours != null ? (
            <>{"you " + (r.estimated ? "~" : "") + formatMeasure(r.yours, units)}</>
          ) : (
            <span className="cz-fitread-unknown">–</span>
          )}
        </span>
      </div>
      <FitReadTrack
        theirs={r.theirs}
        yours={r.yours}
        estimated={r.estimated}
        mark={r.mark}
        warn={r.warn}
        soft={r.soft}
        dashed={r.dashed}
        showBand={hasChart}
        bandLeft={r.bandLeft}
        bandWidth={r.bandWidth}
        softLeft={r.softLeft}
        softLeftWidth={r.softLeftWidth}
        softRight={r.softRight}
        softRightWidth={r.softRightWidth}
        units={units}
      />
      {r.note ? <div className="cz-fitread-note">{r.note}</div> : null}
    </div>
    );
  });
}

// ── Fit read table (split-rail handoff 2026-07-28) ──
//
// Per-measurement fit bars under the pick: how far each garment measure sits
// from the body on a tight↔loose track, with a data-driven tolerance band.
// With no chart the table used to ghost — names in placeholder, YOURS kept, no
// band and no marks — so the customer saw what a chart would unlock. Round 5
// point 5.4 tried to hide it; Fable ruled against that on 2026-07-29 and the
// rule was "not without Kyle's word".
// KYLE'S WORD, 2026-07-30: "if we can't find the chart, we don't want this to
// take up the entire right side of the page." The caller now hides the table in
// the no-chart state (see `noChart` in DetailBody). `hasChart={false}` still
// ghosts, because a read in flight has no chart yet and keeps the table.
// Row math lives in fitReadRows (pure, tested on its own).
// Kyle 2026-07-31: tap FIT READ to open the full seller chart (SizeChartTable)
// so ease (room in the garment) is readable next to every size, not just the pick.
function FitReadTable({
  rows,
  hasChart,
  units,
  reading,
  readingCount,
  onEditMeasures,
  onForgetChart,
  outsidePhrasing = false,
  chart = null,
  highlight = null,
  highlightAlt = null,
  noteText = null,
  // Simpler fit card (Kyle's mockup, 2026-08-09): the pick drives the heading
  // ("HOW THE MEDIUM SITS ON YOU") and gives every row its plain word. Null
  // keeps the old FIT READ kicker and the numbers with no words.
  rec = null,
  // Same mockup: the source line under the bars. The host is the seller's
  // site ("weidian.com"); "typed" means the customer entered it by hand.
  sourceHost = "",
  sourceVia = "",
}) {
  const [chartOpen, setChartOpen] = useState(false);
  if (!rows.length) return null;
  // The heading names the size the bars actually describe — the tapped one
  // whenever the customer tapped (the caller passes verdict.shown).
  const shownWord = rec && rec.size ? formatSizeToken(rec.size) || rec.size : "";
  const kicker = shownWord ? "How the " + shownWord + " sits on you" : "FIT READ";
  // Where the numbers came from, in one line. The host is the seller's own
  // site when we know it; a hand-typed chart says so instead of naming a site
  // it never came from.
  const chartSource = (() => {
    if (!hasChart || !chart || !Array.isArray(chart.rows) || !chart.rows.length) return "";
    const count = chart.rows.length;
    const parts = [
      sourceVia === "typed" ? "You typed this chart" : "The seller's chart",
      count + " size" + (count === 1 ? "" : "s"),
    ];
    if (sourceHost) parts.push(sourceHost);
    return parts.join(" · ");
  })();
  // "Inside tolerance" counts hard failures only: an ORANGE (soft) row is
  // close enough to wear, so it still counts as inside here — same verdict
  // the old +4cm slack gave, now shown honestly by the color (K 2026-08-02).
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
  const canOpenChart = hasChart && chart && Array.isArray(chart.rows) && chart.rows.length > 0;
  return (
    <div
      className={
        "cz-fitread" +
        (hasChart ? "" : " is-ghost") +
        (reading ? " is-reading" : "") +
        (chartOpen ? " is-open" : "")
      }
    >
      {canOpenChart ? (
        <button
          type="button"
          className="cz-fitread-toggle"
          aria-expanded={chartOpen}
          onClick={() => setChartOpen((v) => !v)}
        >
          <span className="cz-fitread-kicker">{kicker}</span>
          <span className="cz-fitread-toggle-hint">
            {chartOpen ? "Hide full chart" : "Full chart"}
          </span>
        </button>
      ) : null}
      <FitReadHeads kicker={canOpenChart ? null : kicker} />
      <FitReadMeasureRows rows={rows} hasChart={hasChart} units={units} rec={rec} />
      {hasChart ? (
        /* 2026-08-09 (Kyle's simpler-card mockup): the legend is two short
           sentences. The old four-sentence version explained the dashed band
           and the amber zone before the customer had met either. */
        <p className="cz-fitread-legend">
          The line is your body. The bar is the room.
        </p>
      ) : null}
      {canOpenChart && chartOpen ? (
        <div className="cz-fitread-detail">
          <p className="cz-fitread-detail-help">
            <strong>Ease</strong> is the room in the garment: seller size minus
            your body. Length ease is how much longer the piece is than your body
            length. The highlighted row is the size this card picked.
          </p>
          <div className="cz-size-chart-wrap">
            <SizeChartTable
              chart={chart}
              units={units}
              highlight={highlight}
              highlightAlt={highlightAlt}
            />
          </div>
        </div>
      ) : null}
      {/* 2026-08-09 (Kyle's simpler-card mockup): one source line says where
          the numbers came from — "The seller's chart · 5 sizes · weidian.com".
          It answers "can I trust this" without a word of explanation. */}
      {chartSource ? <p className="cz-fitread-source">{chartSource}</p> : null}
      <div className="cz-fitread-foot">
        <span className="cz-fitread-footnote">{noteText || footnote}</span>
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
// onRetry: "Try another photo" / Cancel / Not this one. When there is no
// chart (failed read), the label is "Try another photo" and the parent should
// open the file picker (Kyle 2026-08-02: the old path only dismissed).
function SizingBlockReading({
  reading,
  chart,
  thumb,
  error,
  units,
  typed = false,
  authRequired = false,
  // FIX 2b: daily cap is not a bad photo — distinct kicker + CTA, no "could not read".
  capReached = false,
  // FIX 2c: the reader was never reached — a slow server, a timeout, or no
  // internet. The photo was never looked at, so "No chart" would be a lie.
  unavailable = false,
  onUse,
  onRetry,
  // FIX 2c: repeat the SAME read. Only the not-answering state offers it.
  onRetrySame,
  onFix,
}) {
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
      : authRequired
        ? "SIGNED OUT"
        : capReached
          ? "DAILY LIMIT"
          : unavailable
            ? "NOT ANSWERING"
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
          {typed
            ? "Type the chart"
            : authRequired
              ? "Needs sign-in"
              : capReached
                ? "Daily limit"
                : unavailable
                  ? "Not answering"
                  : error
                    ? "No chart"
                    : "Reading chart"}
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
          {authRequired ? (
            <button
              type="button"
              className="cz-sizing-action is-primary"
              onClick={() => requestChartSignIn()}
            >
              Sign in
            </button>
          ) : null}
          {capReached && !authRequired ? (
            <button
              type="button"
              className="cz-sizing-action is-primary"
              onClick={() =>
                chartCapWantsUpgrade() ? requestChartLimits() : requestChartSignIn()
              }
            >
              {chartCapWantsUpgrade() ? "See plans" : "Sign in"}
            </button>
          ) : null}
          {/* FIX 2c: the reader was not reachable. The photos are fine, so the
              offer is the same read again — never the file picker. */}
          {unavailable && !authRequired && !capReached ? (
            <button
              type="button"
              className="cz-sizing-action is-primary"
              onClick={onRetrySame || onRetry}
            >
              Try again
            </button>
          ) : null}
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
          ) : authRequired || capReached ? null : unavailable ? (
            /* FIX 2c: "Try again" above is the answer that fits. A different
               photo is still offered, but it is the second choice now, not the
               first — the first photo was never the problem. */
            <button type="button" className="cz-sizing-read-retry" onClick={onRetry}>
              Try another photo
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
// Kyle 2026-07-31: `shownValue` is the resting look — blank ("Other") when
// the size it holds already sits on a chart cell or chip, so the box keeps
// ONE look instead of echoing every tap. The raw value only appears while
// the field is being edited, and a focus that finds an echo starts the edit
// from the resting look, not from the echo.
function CustomSizeBox({ className, value, shownValue, onChange, onCommit, placeholder = "Other" }) {
  const [editing, setEditing] = useState(false);
  const shown = shownValue !== undefined ? shownValue : value;
  return (
    <input
      className={className}
      aria-label="Custom item size"
      placeholder={placeholder}
      value={editing ? value : shown}
      onChange={(event) => onChange(event.target.value)}
      onFocus={() => {
        if (shown !== value) onChange(shown);
        setEditing(true);
      }}
      onBlur={() => {
        setEditing(false);
        onCommit();
      }}
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

function SizeChoiceEditor({ chosenSize, recommendedSize, runValues, choicesHidden = false, customSize, onCustomChange, onCommit, onPick, dualShoe = false, fullRun = false }) {
  // Kyle 2026-08-08: "buttons shift around in weird locations." The ±2 window
  // re-centres on every tap, so the chip under the customer's finger moves.
  // The pick screen (fullRun) shows the whole run in one stable order. The
  // chart state keeps the window — there it frames the recommendation's
  // neighbours, which is the point (handoff turn 3 §5).
  const choices = fullRun
    ? runValues || []
    : chipSizes(runValues, chosenSize || recommendedSize);
  // The chart cells host the box themselves when they are on screen, so this
  // editor draws nothing at all rather than a second, lonely box below them.
  if (choicesHidden) return null;
  // Kyle 2026-07-31: same one-look rule as the chart cells — the box reads
  // "Other" while the pick already sits on a chip, and shows a size only
  // when no chip carries it.
  const customInChoices = choices.some(
    (size) => String(size).toUpperCase() === String(customSize).toUpperCase()
  );
  const customBox = (
    <CustomSizeBox
      className="cz-detail-size-choice is-custom"
      value={customSize}
      shownValue={customInChoices ? "" : customSize}
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
                aria-label={
                  dualShoe
                    ? shoeChipLabel(size) || formatSizeToken(size) || size
                    : formatSizeToken(size) || size
                }
                onClick={() => onPick(String(size))}
              >
                {/* Compact mark on the face ("XL"), full word for the screen
                    reader ("X-Large") — SIZE_CHIP_COMPACT_PLAN 2026-07-29.
                    Spec step 3 (2026-08-08): a shoe token shows BOTH systems
                    on the face ("EU 43 · US 10") — a bare 43 means nothing
                    to a US buyer. */}
                {dualShoe
                  ? shoeChipLabel(size) || compactSizeToken(size) || size
                  : compactSizeToken(size) || size}
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
// returns { actions, overlay }: the buttons go in a top-right span, the
// overlay (the sheet's ⋯ menu) renders as its sibling so absolute positioning
// can anchor to a relative parent (hero or phone header).
function HeroActionsSlot({ render, photos, photoIdx, resetPager, className = "cz-detail-hero-actions" }) {
  const result = render({ photos, photoIdx, resetPager }) || {};
  return (
    <>
      {result.actions ? <span className={className}>{result.actions}</span> : null}
      {result.overlay || null}
    </>
  );
}

// Kyle 2026-08-02 item 9: Settings buying-agent is a t-acc fold. Collapsed head
// shows ONLY the current agent; expand reveals the full list. Selection logic
// is unchanged — presentation + motion only.
function SettingsAgentAccordion({ preferredAgent, onSelectAgent }) {
  const [open, setOpen] = useState(false);
  const current = getAgent(preferredAgent);
  const currentName = (current && current.name) || "Choose an agent";

  return (
    <div
      className="t-acc cz-agent-acc"
      data-open={open ? "true" : "false"}
    >
      <button
        type="button"
        className="t-acc-head cz-agent-acc-head"
        aria-expanded={open}
        aria-controls="cz-settings-agent-panel"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="cz-agent-acc-head-label">Agent</span>
        <span className="cz-agent-acc-head-value">{currentName}</span>
        <ChevronDown
          className="t-acc-chevron"
          size={16}
          strokeWidth={2.2}
          aria-hidden="true"
        />
      </button>
      <div
        id="cz-settings-agent-panel"
        className="t-acc-panel"
        aria-hidden={!open}
        inert={!open ? "" : undefined}
      >
        <div className="t-acc-panel-inner">
          <div
            className="cz-agent-acc-list"
            role="radiogroup"
            aria-label="Buying agent"
          >
            {listAgents().map((agent) => {
              const active = agent.id === preferredAgent;
              return (
                <button
                  type="button"
                  role="radio"
                  aria-checked={active}
                  key={agent.id}
                  className={"cz-agent-acc-row" + (active ? " is-active" : "")}
                  onClick={() => {
                    onSelectAgent(agent.id);
                    setOpen(false);
                  }}
                >
                  <span className="cz-agent-acc-row-name">{agent.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// The Buy button gets a notch (handoff turn 9 §8). One container, one radius,
// split by a hairline: the label opens the agent, the chevron segment opens
// the agent LIST. Before this the only way to change agent was Profile →
// Buying agent, three taps away from the moment the choice matters.
//
// Agent rows list names only. The item price is the same for every agent, so
// repeating it on each row added nothing (Kyle 2026-08-02). The note under the
// list still says agents differ on shipping and service fee, not item price.
function BuyNotch({ item, label, url, preferredAgent, onSelectAgent, onOpen }) {
  const [open, setOpen] = useState(false);
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
                </button>
              );
            })}
          </div>
          <p className="cz-agent-pop-note">
            Item price is the same everywhere. Agents differ on shipping and service fee.
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


// Card-back v2 Fit fold (2026-08-02): one analysis paragraph under the size
// headline. Facts only — primary measure from the same logic as
// prescriptionSentence, secondaries from fitRows. No process talk.
// Kyle 2026-08-02: always aim for two clear sentences (primary + one more
// from fitRows or the next size up). Prefer real ease numbers over vague
// "inside tolerance" when the data is there.
// Kyle 2026-08-02: when a fit preference is saved, end with
// "We recommend the X because your preference is regular shirts."
function sizeAnalysisParagraph(verdict, fitRows, units, category, fitPref) {
  const shown = verdict && (verdict.shown || verdict.rec);
  if (!shown || !shown.size) return "";
  if (shown.garment == null || shown.body == null || shown.diff == null) return "";
  if (!isFinite(shown.garment) || !isFinite(shown.body) || !isFinite(shown.diff)) return "";

  const measure =
    shown.primaryKey === "waist"
      ? "waist"
      : shown.primaryKey === "hip"
        ? "hip"
        : "chest";
  const noun =
    category === "outerwear"
      ? "jacket"
      : category === "pants"
        ? "pants"
        : category === "shorts"
          ? "shorts"
          : category === "shirt"
            ? "shirt"
            : "piece";
  const garment = formatMeasure(shown.garment, units);
  const body = formatMeasure(shown.body, units);
  const room = formatMeasure(Math.abs(shown.diff), units);
  const band = Array.isArray(shown.easeBand) ? shown.easeBand : null;
  const target = band
    ? (band[0] + band[1]) / 2
    : measure === "chest"
      ? category === "outerwear"
        ? 16
        : 12
      : 2;
  const sitsRight = band
    ? shown.diff >= band[0] - 4 && shown.diff <= band[1] + 4
    : Math.abs(shown.diff - target) <= 4;

  // Sign of ease drives the verb: negative is never "room" (Kyle 2026-08-02).
  let primary =
    "Its " +
    garment +
    " " +
    measure +
    " " +
    easeRoomClause(shown.diff, body, room);
  primary += meantToSitClause(noun, sitsRight, shown.diff);
  primary += ".";

  // One concrete second sentence from another measure — prefer rows with a
  // real ease number so the line names a number Kyle can check.
  let secondary = "";
  for (const r of fitRows || []) {
    if (!r || r.key === measure || r.key === shown.primaryKey) continue;
    if (r.ease == null && r.mark == null) continue;
    if (r.estimated) continue;
    const name = (r.name || r.key || "measure").toLowerCase();
    const isLengthKey =
      r.key === "sleeve" || r.key === "length" || r.key === "pantsLength";
    if (r.warn || (r.mark != null && r.warn)) {
      if (r.ease == null || Math.abs(r.ease) < 0.05) {
        secondary = "The " + name + " is outside tolerance.";
      } else {
        const amt = formatMeasure(Math.abs(r.ease), units);
        secondary = isLengthKey
          ? "The " + name + " runs about " + amt + (r.ease > 0 ? " long." : " short.")
          : "The " +
            name +
            " is about " +
            amt +
            (r.ease > 0 ? " bigger than yours." : " smaller than yours.");
      }
      break;
    }
    // Kyle 2026-08-02: an orange row gets soft wording, not the hard warn —
    // "ehhh you can get away with it".
    if (r.soft) {
      if (r.ease != null && Math.abs(r.ease) >= 0.05) {
        const amt = formatMeasure(Math.abs(r.ease), units);
        secondary = isLengthKey
          ? "The " +
            name +
            " runs about " +
            amt +
            (r.ease > 0 ? " long. Close enough to wear." : " short. Close enough to wear.")
          : "The " +
            name +
            " is about " +
            amt +
            (r.ease > 0
              ? " bigger than yours. Close enough to wear."
              : " smaller than yours. Close enough to wear.");
      } else {
        secondary = "The " + name + " is just outside the range. Close enough to wear.";
      }
      break;
    }
    if (r.ease != null && Math.abs(r.ease) < 0.5) {
      secondary = "The " + name + " lands on yours exactly.";
      break;
    }
    if (r.ease != null) {
      const amt = formatMeasure(Math.abs(r.ease), units);
      secondary = isLengthKey
        ? "The " + name + " runs about " + amt + (r.ease > 0 ? " long." : " short.")
        : "The " +
          name +
          " is about " +
          amt +
          (r.ease > 0 ? " bigger than yours." : " smaller than yours.");
      break;
    }
    if (r.mark != null) {
      secondary = "The " + name + " is inside tolerance.";
      break;
    }
  }

  // Next size up — same plain facts the old "The next size" stanza used.
  let nextUp = "";
  const chart = verdict.chart;
  if (chart && Array.isArray(chart.rows) && shown.garment != null && shown.primaryKey) {
    const up = chart.rows
      .filter((r) => r && r.size && r[shown.primaryKey] != null && r[shown.primaryKey] > shown.garment)
      .sort((a, b) => a[shown.primaryKey] - b[shown.primaryKey])[0];
    if (up) {
      const upName = formatSizeToken(up.size) || up.size;
      const delta = up[shown.primaryKey] - shown.garment;
      nextUp =
        "The " +
        upName +
        " is " +
        formatMeasure(delta, units) +
        " bigger around the " +
        measure +
        ".";
      if (up.sleeve != null && shown.row && shown.row.sleeve != null) {
        nextUp +=
          " Its sleeves are " +
          formatMeasure(up.sleeve - shown.row.sleeve, units) +
          " longer too.";
      } else if (!secondary) {
        // No sleeve delta and no secondary yet — pull one more fact from
        // fitRows so the "next size" thought still has two sentences.
        for (const r of fitRows || []) {
          if (!r || r.key === measure || r.key === shown.primaryKey) continue;
          if (r.ease == null || r.estimated) continue;
          const name = (r.name || r.key || "measure").toLowerCase();
          const amt = formatMeasure(Math.abs(r.ease), units);
          const isLengthKey =
            r.key === "sleeve" || r.key === "length" || r.key === "pantsLength";
          nextUp += isLengthKey
            ? " The " + name + " on this size runs about " + amt + (r.ease > 0 ? " long." : " short.")
            : " The " +
              name +
              " on this size is about " +
              amt +
              (r.ease > 0 ? " bigger than yours." : " smaller than yours.");
          break;
        }
      }
    }
  }

  // Final sentence names the saved taste and the size we pick for it
  // (Kyle 2026-08-02: "because your preference is regular shirts / long pants").
  let prefLine = "";
  const rec = verdict.rec;
  if (rec && rec.size && fitPref && fitPrefHasChoice(fitPref)) {
    let prefWord = "";
    // Same priority as the chip left of Verified fit: looseness first, then length.
    if (fitPref.looseness) {
      prefWord = (fitPrefLabel(category, "looseness", fitPref.looseness) || "").toLowerCase();
    } else if (fitPref.length) {
      prefWord = (fitPrefLabel(category, "length", fitPref.length) || "").toLowerCase();
    }
    const catWord =
      category === "pants"
        ? "pants"
        : category === "shorts"
          ? "shorts"
          : category === "outerwear"
            ? "jackets"
            : category === "shirt"
              ? "shirts"
              : "pieces";
    if (prefWord) {
      const recName = formatSizeToken(rec.size) || rec.size;
      prefLine =
        "We recommend the " +
        recName +
        " because your preference is " +
        prefWord +
        " " +
        catWord +
        ".";
    }
  }

  let text = primary;
  if (secondary) text += " " + secondary;
  if (nextUp) text += " " + nextUp;
  if (prefLine) text += " " + prefLine;
  return text;
}

// Desktop result row only: one short word left of Verified fit. Prefer
// looseness (e.g. "Regular"); fall back to length; empty pref invites a set.
function fitPrefToggleLabel(item, fitPref) {
  // Kyle 2026-08-03: pressing "Not sure yet" put the first-time wording back,
  // as if nothing happened. Say the app heard the answer instead.
  if (fitPref && fitPref.dismissed && !fitPrefHasChoice(fitPref)) {
    return "Fit preference: not set";
  }
  if (!fitPref || !fitPrefHasChoice(fitPref)) return "Set your fit preference";
  if (fitPref.looseness) {
    const word = fitPrefLabel(item.category, "looseness", fitPref.looseness);
    if (word) return word;
  }
  if (fitPref.length) {
    const word = fitPrefLabel(item.category, "length", fitPref.length);
    if (word) return word;
  }
  return "Set your fit preference";
}

// 4f — the ask. Only what the category needs (fitMeasureFieldsFor), prefilled
// from the profile in display units, saved back in storage units.
// (4d FitEmptyPrompt deleted 2026-08-02 — superseded by FirstSizeBlock.)
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
          {hasUsual ? "Skip, keep the rough size" : "Skip for now"}
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
// showSkip: first-ask flow on Fit keeps "Not sure yet". Settings placement
// (mock Turn 3) is chips only — nothing to skip on a Settings tab.
// Kyle 2026-08-03: "when you click on Regular, there is no sign here that lets
// you save … You can't get out of it". The panel now always shows a full-width
// Save button and a Close X. The X closes and saves nothing.
function FitPrefAsk({ item, fitPref, onSaveFitPref, onDone, showSkip = true, revealOnOpen = false }) {
  const catAxes = FIT_PREF_AXES[item.category];
  const baseline = {
    length: (fitPref && fitPref.length) || null,
    looseness: (fitPref && fitPref.looseness) || null,
  };
  const [draft, setDraft] = useState(baseline);
  // Kyle 2026-08-03: the button "does not take you anywhere". It does open
  // this panel, but the panel sits below the size cells, so on a tall card
  // it opens off screen and the press looks dead. Bring it into view.
  const askRef = useRef(null);
  useEffect(() => {
    if (!revealOnOpen) return;
    const el = askRef.current;
    if (!el || !el.scrollIntoView) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [revealOnOpen]);
  const catTitle = CATEGORIES[item.category]
    ? CATEGORIES[item.category].label.toLowerCase()
    : "this item";
  if (!catAxes) return null;
  const commit = () => {
    onSaveFitPref(item.category, {
      length: draft.length,
      looseness: draft.looseness,
      dismissed: false,
    });
    onDone();
  };
  return (
    <div className="cz-fit-pref-ask" ref={askRef}>
      <div className="cz-fit-pref-ask-head">
        <div className="cz-fit-pref-ask-title">How do you wear {catTitle}?</div>
        <button
          type="button"
          className="cz-fit-pref-ask-close"
          aria-label="Close"
          onClick={onDone}
        >
          <X size={18} strokeWidth={2.2} aria-hidden="true" />
        </button>
      </div>
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
      <button type="button" className="cz-fit-pref-ask-save" onClick={commit}>
        Save
      </button>
      {showSkip ? (
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
      ) : null}
    </div>
  );
}

function FitConfidenceStrip({
  item,
  verdict,
  bodyProfile,
  fitPref,
  units,
  onSharpen,
  onEditPref,
  headerBlocked = false,
  // Simpler fit card (Kyle's mockup, 2026-08-09): the headline pill is the one
  // badge on the desktop panel and on the phone sheet, so this strip drops its
  // copy there. The desktop card back has no headline pill, so the badge
  // survives as the only confidence claim on that surface — a derived body
  // must never lose its "Estimated fit" honesty (F retraction 2026-08-04).
  showBadge = true,
}) {
  // The numbers describe the size on screen, which is the tapped one whenever
  // the customer tapped. `verdict.shown` falls back to the recommendation.
  const rec = verdict.shown || verdict.rec;
  if (verdict.precise && rec && rec.body != null && rec.garment != null) {
    const diff = rec.diff != null ? rec.diff : rec.garment - rec.body;
    const easeStr = (diff >= 0 ? "+" : "−") + formatMeasure(Math.abs(diff), units);
    // Derived body (usual-fit / brand-match) must not claim "Precise fit"
    // (F retraction 2026-08-04 — fifth surface; same wording as confidenceLabel).
    // A red blocker bar must not claim it either (debate 2026-08-08).
    const derivedBody = isDerivedBodySource(bodyProfile);
    const precisionBadge = headerBlocked
      ? "Closest available"
      : derivedBody
        ? "Estimated fit"
        : "Precise fit";
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
          {showBadge ? (
            <span className={"cz-fit4-badge " + (derivedBody || headerBlocked ? "is-rough" : "is-precise")}>
              <span className="cz-fit4-badge-dot" aria-hidden="true" />
              {precisionBadge}
            </span>
          ) : null}
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
    item.category === "shorts"
      ? "Add waist & shorts length"
      : item.category === "pants"
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
  onChangeUnits = null,
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
  // Handoff §3: the desktop panel hands the command bar a full-width slot
  // above both columns. Undefined keeps the bar inline (phone sheet, tablet
  // band), null suppresses it before mount. (logNotesTarget retired 2026-08-02:
  // HISTORY lives in the Details tab, not under the photo column.)
  commandBarTarget = undefined,
  // Handoff section 3 region order: title, then bar, then body. Same contract
  // as commandBarTarget — undefined keeps the title inline.
  titleTarget = undefined,
  // Card-back v2: desktop modal footer spans both columns.
  footerTarget = undefined,
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
  // Settings tab: remove this card. Optional — phone sheet and hosts that
  // own delete elsewhere (⋯ menu) may omit it; the Settings tab hides Remove.
  onDelete = null,
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
  // Desktop card-back tabs: Fit · Details · Settings (Photos live on the left strip).
  const [desktopTab, setDesktopTab] = useState("fit");
  // Kyle 2026-08-02: measurement-by-measurement bars open by default.
  const [openRead, setOpenRead] = useState(true);
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
    setDesktopTab("fit");
    // Re-open bars on each item so the chart is not left hidden.
    setOpenRead(true);
    setPhotoIdx(0);
  }, [item.id]);

  // Phone sheet header (Kyle 2026-08-02 layout reset). Always pinned: big
  // title left + heart / more / close top-right, tabs under, content below.
  // Exists only where the shell gives us a close action (the phone sheet).
  const heroRef = useRef(null);
  const titleRowRef = useRef(null);
  const scrollRef = useRef(null);
  const wantsStickyBar = heroPager && typeof onRequestClose === "function";
  // Desktop two-column panel hands titleTarget a mount node.
  const isDesktopPanel = titleTarget !== undefined;

  // Fit/Details/Settings share one scroll container. Without a reset, Fit →
  // Details → Fit keeps the shorter tab's scrollTop and lands past the
  // re-mounted measurement block (Kyle 2026-08-02: "hidden and glitched").
  // Phone panes share the same container. Reset to top on every tab change.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [desktopTab, pane, item.id]);

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
  // Kyle 2026-08-02: notes are always a visible text box (photo 5). The old
  // "Add a note" button is gone — no extra tap to start writing.
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

  // Category same rule as status (F/C 2026-08-02): direct write + pin, and
  // mirror into any open draft so buildEditPatch cannot restore the old
  // category on the next debounced commit or close-flush.
  const pickCategory = (next) => {
    onSaveEdit(item.id, { category: next, categoryManual: true });
    setDraft((d) =>
      draftOwnerRef.current === item.id && d ? { ...d, category: next } : d
    );
    setSavedFlash(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSavedFlash(false), SAVED_HOLD_MS);
  };

  // The parent owns the sizing verdict and the chart hunt.
  const fitPref = fitPrefs && item.category ? fitPrefs[item.category] || null : null;
  // Stage 6 (debate 2026-08-08): the shelf's own "How did it run?" answers
  // rebuild the kind and seller shift maps on every render. No new props —
  // shelfItems already carries the whole list to both parents.
  const outcomeMaps = useMemo(() => computeOutcomeMaps(shelfItems), [shelfItems]);
  const outcomeShift = outcomeShiftFor(item, outcomeMaps);
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
    chosenSize,
    outcomeShift
  );
  // Round 5 point 5.1 (2026-07-29): the chart cells ARE the size picker.
  // Computed here so SizingBlock draws them and SizeChoiceEditor knows its
  // own plain chip row would say the same sizes a second time.
  const sizeMeasureKey = verdict.rec && verdict.rec.primaryKey ? verdict.rec.primaryKey : "chest";
  const sizeCells =
    verdict.chart && Array.isArray(verdict.chart.rows)
      ? verdict.chart.rows.filter((r) => r.size && r[sizeMeasureKey] != null).slice(0, 6)
      : [];
  // Simpler fit card (Kyle's mockup, 2026-08-09): each chip grades itself
  // against the pick's band — the word and the two ease lines ride on the
  // cell. Empty without a body number; SizingBlock falls back to the plain
  // garment-measure cells then.
  const cellReads = useMemo(
    () => sizeCellReads(verdict.chart, verdict.rec, effectiveBodyProfile(bodyProfile)).slice(0, 6),
    [verdict.chart, verdict.rec, bodyProfile]
  );
  // Spec step 1 item 4 (2026-08-08) retired 2026-08-09: the pinned
  // "Your size · M" line named the size a third time, above a headline and a
  // chip run that both name it too. Kyle's simpler-card mockup drops it.
  // Kyle 2026-07-31: "when you click on this button two times you get
  // different views — standardize it." The fifth box used to echo EVERY pick,
  // so a tap on the Small cell turned the box from "Other" into "S". One look
  // now: the box shows a size only when that size is NOT on the chart — the
  // odd sizes ("170/92A", "EU 44") it exists for. A chart size lives on its
  // own cell, and the box keeps reading "Other".
  const customSizeInChart = sizeCells.some(
    (row) => String(row.size).toUpperCase() === String(customSize).toUpperCase()
  );
  const customSizeShown = customSizeInChart ? "" : customSize;
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
  // Honest header (four-lane debate 2026-08-08): a red chest or shoulder bar
  // (waist/hip on bottoms) blocks every green fit claim on the screen — the
  // desktop badge, the fit-confidence strip, and the phone header all read
  // this one flag. Length and sleeve never block. The pick stays; the words
  // change to "Closest available".
  const HEADER_BLOCKER_KEYS =
    item.category === "pants" || item.category === "shorts"
      ? ["waist", "hip"]
      : ["chest", "shoulder"];
  const headerBlocked = fitRows.some(
    (row) => HEADER_BLOCKER_KEYS.includes(row.key) && row.warn
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
    chartHuntBlocked.delete(item.id);
    onSaveEdit(
      item.id,
      item.sizeChartText
        ? { sizeChartText: "", sizeChartSource: null, sizeChartNeedsClear: false }
        : { sizeNotes: "", sizeChartSource: null, sizeChartNeedsClear: false }
    );
  };
  const clearBlockedChart = () => {
    chartHuntTried.delete(item.id);
    chartHuntBlocked.delete(item.id);
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
  // Kyle 2026-08-03: "You can't get out of it." The X has to beat the automatic
  // ask too, or the panel opens again the moment it closes. This lasts for the
  // card. Leaving the card and coming back asks once more.
  const [prefAskClosed, setPrefAskClosed] = useState(false);
  const closePrefAsk = () => {
    setAskingPref(false);
    setPrefAskClosed(true);
  };
  useEffect(() => {
    setAskingMeasures(false);
    setAskingPref(false);
    setPrefAskClosed(false);
  }, [item.id]);
  const needsPrefAsk =
    !!FIT_PREF_AXES[item.category] &&
    !!onSaveFitPref &&
    !!verdict.chart &&
    !!bodyProfile &&
    !fitPrefHasChoice(fitPref) &&
    !(fitPref && fitPref.dismissed);
  const {
    hunting,
    authBlocked: huntAuthBlocked,
    capBlocked: huntCapBlocked,
    // FIX 2c: the hunt could not reach the reader at all.
    outBlocked: huntOutBlocked,
    // #31: the traffic guards are their own walls.
    rateBlocked: huntRateBlocked,
    offBlocked: huntOffBlocked,
  } = useChartHunt(
    item,
    verdict.chart,
    onSaveEdit,
    !item.sizeChartNeedsClear,
    shelfItems
  );
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
  // Spec step 2 (2026-08-08): while a chart is on the way, the size section
  // stays hidden behind ONE honest status line. A deliberate photo read
  // outranks the background hunt. The line names the real step; the old wall
  // (a bare "-" under a READING CHART rail) is gone.
  const sizeBusy = !verdict.chart && (hunting || chartRead.reading);
  const sizeStatusLine = !sizeBusy
    ? ""
    : chartRead.reading
      ? "Reading the size chart…"
      : "Looking for the size chart photo…";
  // Spec step 3 (2026-08-08): the plain no-chart case earns the locked pick
  // screen. Every special state keeps its own honest wall instead: signed
  // out, any blocked reason, a borrowed chart to clear, a WhatsApp seller, a
  // link-failure code, or a bare Taobao listing.
  const noChartPlain =
    noChart &&
    item.needsSignIn !== true &&
    huntAuthBlocked !== true &&
    huntCapBlocked !== true &&
    !chartNeedsCards(item) &&
    huntOutBlocked !== true &&
    huntRateBlocked !== true &&
    huntOffBlocked !== true &&
    !item.sizeChartNeedsClear &&
    !whatsAppChatUrl(item.whatsapp || "") &&
    !(item.failCode && LINK_FAIL_COPY[item.failCode]) &&
    listingInfoOf(item) !== "bare";
  // Sized categories get the pick screen. Non-sized (keychains, wallets,
  // bags) get one calm line — Kyle picked the words 2026-08-08: "One size
  // only. The photos show how big it is."
  const nonSizedCategory = item.category === "accessory" || item.category === "bag";
  const noChartPickScreen = noChartPlain && !nonSizedCategory;
  const noChartOneLiner = noChartPlain && nonSizedCategory;
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

  const recSize = computeRecommendedSize(item, bodyProfile, fitPrefs, outcomeMaps);
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
          const d = resolveDisplaySize(item, bodyProfile, fitPrefs, outcomeMaps);
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
  // Signup link: only agents with a signupTemplate and a saved code give a URL.
  const signupAgent = getAgent(preferredAgent);
  const signupUrl = signupAgent && signupAgent.signupTemplate ? buildSignupUrl(preferredAgent) : null;
  const savedDate = item.createdAt
    ? new Date(item.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })
    : "";
  // Title subline: seller as a hyperlink (store or listing) + saved date.
  // Phase 1 hid this under the desktop header; Kyle 2026-08-02 asked it back.
  const hasSubLine = Boolean(item.seller || savedDate);
  // Command-bar "See other listings" only when we have a real store page.
  // Not every seller has one Credenza can build (shelf handoff 2026-07-28).
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
    // Kyle 2026-07-31: an empty commit only clears a size the box was truly
    // showing. When the pick sits on a chart cell the box reads "Other", so
    // a tap in and back out must not wipe that pick.
    if (!cleaned) {
      const committed = customSizeCommittedRef.current;
      const committedIsListed =
        sizeCells.some((row) => String(row.size).toUpperCase() === committed.toUpperCase()) ||
        chipSizes(verdict.runValues, committed).some(
          (size) => String(size).toUpperCase() === committed.toUpperCase()
        );
      if (committedIsListed) {
        setCustomSize(committed);
        return;
      }
    }
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
        <div className="cz-detail-unit t-tabs" role="group" aria-label="Price currency">
          <SlidingTabsPill value={priceUnit} />
          {["USD", "CNY"].map((unit) => (
            <button
              key={unit}
              type="button"
              className={"cz-detail-unit-btn t-tab" + (priceUnit === unit ? " is-active" : "")}
              data-t-tab-value={unit}
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
  // the desktop panel photo column, but the notes writer
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
      {/* Notes (§7). Always a visible text box (Kyle 2026-08-02 photo 5) —
          not an "Add a note" button. Header lives INSIDE the box. Collapsed
          clamps to 3 lines; EXPAND grows it. Same box you type in. */}
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
        {hasSubLine ? (
          <div className="cz-detail-sub">
            {item.seller ? <SellerLink item={item} className="cz-detail-seller-link" /> : null}
            {item.seller && savedDate ? <span className="cz-detail-sub-sep"> · </span> : null}
            {savedDate ? <span className="cz-detail-sub-date">saved {savedDate}</span> : null}
          </div>
        ) : null}
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
      pickCategory={pickCategory}
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
  // Debate 2026-08-08: only blocker rows flip the phone header. A red length
  // or sleeve warns on its own bar but never downgrades the verdict.
  const mobileOutsideCount = fitRows.filter(
    (row) => HEADER_BLOCKER_KEYS.includes(row.key) && row.warn
  ).length;
  const mobileFitKicker = verdict.chart ? "We recommend" : "No seller chart";
  // Derived body must not claim "Precise fit" on the phone line either
  // (F retraction 2026-08-04 — frame 4 / mobileConfidence; was chart-only).
  // One shared flag for text + is-rough class so they cannot drift (F 2026-08-04).
  const mobileDerivedBody = isDerivedBodySource(bodyProfile);
  const mobileEstimated =
    verdict.chart && !mobileOutsideCount && mobileDerivedBody;
  const mobileConfidence = verdict.chart
    ? mobileOutsideCount
      ? "Roomy for this cut"
      : mobileEstimated
        ? "Estimated fit"
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

  // No Photos tab: the left photo strip already shows the album (O 2026-08-02).
  // Phone sticky bar still has Photos — only the desktop rail drops it.
  const DESKTOP_TABS = [
    ["fit", "Fit"],
    ["details", "Details"],
    ["settings", "Settings"],
  ];
  const desktopAnalysis =
    isDesktopPanel && fitSummaryOn && !noChart
      ? sizeAnalysisParagraph(verdict, fitRows, measureUnits, item.category, fitPref)
      : "";
  const onDesktopTabKey = (event) => {
    if (!isDesktopPanel) return;
    const keys = DESKTOP_TABS.map((t) => t[0]);
    const idx = keys.indexOf(desktopTab);
    if (idx < 0) return;
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      const next =
        event.key === "ArrowRight"
          ? keys[(idx + 1) % keys.length]
          : keys[(idx - 1 + keys.length) % keys.length];
      setDesktopTab(next);
      const el = event.currentTarget.parentElement &&
        event.currentTarget.parentElement.querySelector('[data-tab="' + next + '"]');
      if (el && el.focus) el.focus();
    } else if (event.key === "Home") {
      event.preventDefault();
      setDesktopTab(keys[0]);
    } else if (event.key === "End") {
      event.preventDefault();
      setDesktopTab(keys[keys.length - 1]);
    }
  };

  // Phone confidence colour matches Fit4 honesty tone (Kyle 2026-08-04).
  // is-rough / is-precise both read mobileEstimated — same binding as the text.
  // Parent is-warn still wins for "Roomy for this cut" (see CSS).
  const mobileConfidenceClass =
    !verdict.chart || mobileOutsideCount
      ? "cz-mobile-fit-confidence"
      : mobileEstimated
        ? "cz-mobile-fit-confidence is-rough"
        : "cz-mobile-fit-confidence is-precise";
  const mobileFitIntro = (
    <div className={"cz-mobile-fit-intro" + (mobileOutsideCount ? " is-warn" : "")}>
      <div className="cz-mobile-fit-kicker-row">
        <span className="cz-mobile-fit-kicker">{mobileFitKicker}</span>
        <span className={mobileConfidenceClass}>
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
      {/* Phone sheet header — always pinned (Kyle 2026-08-02 layout reset).
          Row 1: big title left + heart / more / close at the far top right.
          Row 2: Fit / Photos / Details. Content scrolls under this chrome.
          Exactly one close, always in the header corner — never on the photo. */}
      {wantsStickyBar ? (
        <header className="cz-detail-phone-header">
          <div className="cz-detail-phone-header-top">
            <div className="cz-detail-phone-header-titlecol">
              {editingTitle ? (
                <input
                  ref={titleInputRef}
                  className="cz-detail-title-input cz-detail-phone-header-title-input"
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
                <button
                  type="button"
                  className="cz-detail-phone-header-title-btn"
                  onClick={() => setEditingTitle(true)}
                >
                  <span className="cz-detail-phone-header-title">
                    {view.title || "Untitled"}
                  </span>
                  {stickyMeta ? (
                    <span className="cz-detail-phone-header-meta">{stickyMeta}</span>
                  ) : null}
                </button>
              )}
              {savedFlash ? (
                <span className="cz-detail-saved cz-detail-phone-header-saved">
                  <Check size={11} strokeWidth={3} aria-hidden="true" />
                  Saved
                </span>
              ) : null}
            </div>
            {renderHeroActions ? (
              <HeroActionsSlot
                className="cz-detail-header-actions"
                render={renderHeroActions}
                photos={photos}
                photoIdx={photoIdx}
                resetPager={resetPager}
              />
            ) : (
              <button
                type="button"
                className="cz-detail-header-btn"
                aria-label="Close"
                onClick={onRequestClose}
              >
                <X size={16} strokeWidth={2.4} aria-hidden="true" />
              </button>
            )}
          </div>
          <div className="cz-detail-pane-picker t-tabs" role="tablist" aria-label="Item section">
            <SlidingTabsPill value={pane} />
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
                className={"t-tab" + (pane === key ? " is-active" : "")}
                data-t-tab-value={key}
                onClick={() => setPane(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </header>
      ) : null}

      <div className={isDesktopPanel ? "cz-fit-shell" : "cz-sheet-shell"}>
      {isDesktopPanel ? (
          <div className="cz-fit-controls">
            <div
              className="cz-fit-tabs t-tabs"
              role="tablist"
              aria-label="Item section"
            >
              <SlidingTabsPill value={desktopTab} />
              {DESKTOP_TABS.map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  data-tab={key}
                  id={"cz-fit-tab-" + key}
                  aria-selected={desktopTab === key}
                  aria-controls={"cz-fit-panel-" + key}
                  tabIndex={desktopTab === key ? 0 : -1}
                  className={"cz-fit-tab t-tab" + (desktopTab === key ? " is-active" : "")}
                  data-t-tab-value={key}
                  onClick={() => setDesktopTab(key)}
                  onKeyDown={onDesktopTabKey}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="cz-fit-units t-tabs" role="group" aria-label="Measurement units">
              <SlidingTabsPill value={measureUnits} />
              {["in", "cm"].map((u) => (
                <button
                  key={u}
                  type="button"
                  className="cz-fit-unit t-tab"
                  data-t-tab-value={u}
                  aria-pressed={measureUnits === u}
                  onClick={() => onChangeUnits && onChangeUnits(u)}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>
      ) : null}
      <div
        ref={scrollRef}
        className={
          "cz-detail-scroll" +
          (editingCell ? " is-editing" : "") +
          (wantsStickyBar ? " has-panes" : "") +
          (isDesktopPanel ? " cz-fit-pane" : "")
        }
        data-pane={wantsStickyBar ? pane : isDesktopPanel ? desktopTab : undefined}
        role={isDesktopPanel ? "tabpanel" : undefined}
        id={isDesktopPanel ? "cz-fit-panel-" + desktopTab : undefined}
        aria-labelledby={isDesktopPanel ? "cz-fit-tab-" + desktopTab : undefined}
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
            {/* Phone sheet: heart/more/close live in the pinned header, not on
                the photo (Kyle 2026-08-02 layout reset). Non-pane layouts still
                mount chrome on the hero. */}
            {!wantsStickyBar && renderHeroActions ? (
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

        {/* Title for non-pane layouts (desktop/tablet). Phone sticky-bar sheets
            mount the title under the hero above — do not double-mount. */}
        {!wantsStickyBar ? (
          <div className="cz-detail-pane-title">
            {titleTarget === undefined
              ? titleBlock
              : titleTarget === null
                ? null
                : createPortal(titleBlock, titleTarget)}
          </div>
        ) : null}

        {/* The bar is inline on the phone sheet and the tablet band. On the
            desktop panel it portals to a full-width slot above both columns
            (handoff §3). Hide the chip bar when Details owns the mock list
            (phone Details pane or desktop Details/Settings) so the fact rows
            are not shown twice. */}
        {(() => {
          const detailsOwnsList =
            (wantsStickyBar && pane === "details") ||
            (isDesktopPanel && (desktopTab === "details" || desktopTab === "settings"));
          if (detailsOwnsList) return null;
          return (
            <div className="cz-detail-pane cz-detail-pane-details cz-detail-pane-command">
              {commandBarTarget === undefined
                ? commandBarBlock
                : commandBarTarget === null
                  ? null
                  : createPortal(commandBarBlock, commandBarTarget)}
            </div>
          );
        })()}

        {/* Split rail: Fit · Details · Settings on desktop. Phone keeps Fit
            and a separate Details pane lower down. */}
        <div className="cz-detail-facts cz-detail-pane cz-detail-pane-fit">
          {isDesktopPanel && desktopTab === "details" ? (
            <section className="cz-desk-tab cz-desk-tab-details" aria-label="Details">
              {/* Mock Details: Status · Haul · Colorway · Weight · Category rows
                  (always shown, empty → "Add a …"), then HISTORY, Add a note,
                  then links + album (mock omitted those for a Photos tab we
                  no longer keep). Seller stays under the title. */}
              <CommandBar
                item={item}
                view={view}
                edit={edit}
                commit={() => commitRef.current()}
                onSaveEdit={onSaveEdit}
                pickStatus={pickStatus}
                pickCategory={pickCategory}
                knownHauls={knownHauls}
                haulCounts={haulCounts}
                sellerHref={sellerHref}
                weightUnit={weightUnit}
                weightText={weightText}
                onWeightChange={writeWeight}
                onSwitchWeightUnit={switchWeightUnit}
                layout="list"
                hideSeller
              />
              {timelineBlock}
              {notesBlock}
              {/* Round 2 (2026-08-02): no LINK "Buy via …" row — redundant with
                  the pinned footer Buy. Album/gallery row stays. */}
              <AlbumLinksRow item={item} className="cz-desk-album-links" />
            </section>
          ) : null}

          {isDesktopPanel && desktopTab === "settings" ? (
            <section className="cz-desk-tab cz-desk-tab-settings" aria-label="Settings">
              {/* Mock Settings top: How do you wear [category]? + measurements. */}
              {onSaveFitPref && FIT_PREF_AXES[item.category] ? (
                <div className="cz-desk-wear-block">
                  <FitPrefAsk
                    item={item}
                    fitPref={fitPref}
                    onSaveFitPref={onSaveFitPref}
                    onDone={() => setAskingPref(false)}
                    showSkip={false}
                  />
                </div>
              ) : null}

              <div className="cz-desk-measures-block">
                <h3 className="cz-desk-setting-kicker">Your measurements</h3>
                <div className="cz-desk-measure-list" role="list">
                  {bodyMeasureRows(bodyProfile, measureUnits).map((row) => (
                    <div className="cz-desk-measure-row" role="listitem" key={row.key}>
                      <span className="cz-desk-measure-k">{row.label}</span>
                      <span className="cz-desk-measure-v">{row.value}</span>
                    </div>
                  ))}
                </div>
                {onOpenSizes ? (
                  <button
                    type="button"
                    className="cz-desk-measure-edit"
                    onClick={openProfileSizes}
                  >
                    Edit my measurements in Settings
                  </button>
                ) : null}
              </div>

              {typeof onSelectAgent === "function" ? (
                <div className="cz-desk-setting-block">
                  <h3 className="cz-desk-setting-kicker">Buying agent</h3>
                  <SettingsAgentAccordion
                    preferredAgent={preferredAgent}
                    onSelectAgent={onSelectAgent}
                  />
                  <p className="cz-desk-setting-note">
                    Item price is the same everywhere. Agents differ on shipping and service fee.
                    Your pick sticks as the default.
                  </p>
                </div>
              ) : null}

              <div className="cz-desk-setting-block">
                <h3 className="cz-desk-setting-kicker">Size chart</h3>
                <div className="cz-desk-setting-actions">
                  <button
                    type="button"
                    className="cz-desk-setting-btn"
                    onClick={() => chartInputRef.current?.click()}
                  >
                    Upload chart photo
                  </button>
                  <button
                    type="button"
                    className="cz-desk-setting-btn"
                    onClick={() => chartRead.startTyping(item.category)}
                  >
                    Enter chart by hand
                  </button>
                  {/* Kyle 2026-08-03: the album re-read button is gone. It spent
                      a paid call on photos the first read already looked at. */}
                  {chartIsForgettable ? (
                    <button
                      type="button"
                      className="cz-desk-setting-btn is-quiet"
                      onClick={forgetChart}
                    >
                      Forget this chart
                    </button>
                  ) : null}
                </div>
                {chartRead.reading || chartRead.chart || chartRead.error ? (
                  <SizingBlockReading
                    reading={chartRead.reading}
                    chart={chartRead.chart}
                    thumb={chartRead.thumb}
                    error={chartRead.error}
                    units={measureUnits}
                    typed={chartRead.typed}
                    authRequired={chartRead.authRequired === true}
                    capReached={chartRead.capReached === true}
                    unavailable={chartRead.unavailable === true}
                    onUse={chartRead.commit}
                    onRetrySame={chartRead.retryLast}
                    onRetry={() => {
                      // Failed read → open picker WITHOUT dismiss (Kyle
                      // 2026-08-02 item 8). dismiss() unmounted the prompt
                      // before the picker returned; cancel then left no way
                      // back. Typed cancel / "Not this one" still dismiss.
                      const hadChart = !!chartRead.chart || chartRead.typed;
                      if (hadChart) {
                        chartRead.dismiss();
                        return;
                      }
                      chartInputRef.current?.click();
                    }}
                    onFix={chartRead.fix}
                  />
                ) : null}
              </div>

              {typeof onDelete === "function" ? (
                <div className="cz-desk-setting-block">
                  <h3 className="cz-desk-setting-kicker">Card</h3>
                  <button
                    type="button"
                    className="cz-desk-setting-btn is-danger"
                    onClick={() => onDelete(item.id)}
                  >
                    Remove this card
                  </button>
                </div>
              ) : null}
            </section>
          ) : null}

          {(!isDesktopPanel || desktopTab === "fit") ? (
          <section className="cz-detail-facts-section" aria-label="Size and fit">
            {wantsStickyBar ? mobileFitIntro : null}
            {/* 2026-08-09 (Kyle's simpler-card mockup): the pinned
                "Your size · M" line is retired. The headline names the size
                once, and the chips name it again — three size signals on one
                screen was the clutter the mockup removes. */}
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
            ) : profileNeedsFirstSize(bodyProfile) &&
              onSaveBodyProfile &&
              !SIZE_PICK_SKIP_CATEGORIES.has(item.category) ? (
              // A1–A5 (onboarding handoff): the two-tap ask replaces the old
              // dashed empty prompt when the profile has no measures and no
              // usual size. The chips come from this listing's own size run.
              // The A5 ladder projects its rows from the profile below.
              <FirstSizeBlock
                item={item}
                chart={verdict.chart}
                sizeRun={verdict.runValues}
                bodyProfile={bodyProfile}
                fitPref={fitPref}
                units={measureUnits}
                onSaveBodyProfile={onSaveBodyProfile}
                onSaveFitPref={onSaveFitPref}
                /* Lane D (2026-08-04): this block REPLACES the sizing block,
                   so its "No seller chart on this listing" line was the only
                   copy a capped visitor ever saw — blaming the seller for our
                   limit while the header pill named the real reason. When a
                   block flag is set, the reason line rides above the chips
                   instead. Same precedence as SizingBlockNoChart. */
                blockReason={
                  verdict.chart || hunting
                    ? ""
                    : huntCapBlocked === true
                      ? chartCapCopy()
                      : chartNeedsCards(item)
                        ? chartCardsCapCopy()
                        : huntAuthBlocked === true
                          ? CHART_AUTH_COPY
                          : item.needsSignIn === true
                            ? "Sign in to finish this card. Credenza then reads the product, the photos, and the size chart."
                            : huntOutBlocked === true
                              ? CHART_HUNT_UNAVAILABLE_COPY
                              : item.failCode && LINK_FAIL_COPY[item.failCode]
                                ? LINK_FAIL_COPY[item.failCode]
                                : ""
                }
                startSkipped={!!fitPromptSkipped}
                onSkip={
                  fitPromptSkipped
                    ? null
                    : () => {
                        if (onSkipFitPrompt) onSkipFitPrompt();
                      }
                }
                onOpenMeasureHelp={onOpenSizes || null}
              />
            ) : sizeBusy ? (
              // Spec step 2 (2026-08-08): one honest status line while a chart
              // is on the way. The section hides behind it — no bare "-", no
              // READING CHART rail, no ghost rows stacking under a wait.
              <p className="cz-size-status" role="status">
                <span className="cz-size-status-dot" aria-hidden="true" />
                {sizeStatusLine}
              </p>
            ) : !verdict.chart && !hunting ? (
              <SizingBlockNoChart
                usualSize={chosenSize || verdict.usualSize}
                /* 2026-07-28 — the caption used to read "your usual" for a size
                   the customer had just chosen by hand. The word is the same;
                   where it came from is not. */
                isManual={!!chosenSize}
                needsClear={item.sizeChartNeedsClear}
                needsSignIn={item.needsSignIn === true}
                chartAuthBlocked={huntAuthBlocked === true}
                chartCapBlocked={huntCapBlocked === true}
                chartCardsBlocked={chartNeedsCards(item)}
                chartOutBlocked={huntOutBlocked === true}
                chartRateBlocked={huntRateBlocked === true}
                chartOffBlocked={huntOffBlocked === true}
                whatsapp={item.whatsapp || ""}
                variantRun={verdict.variantRun || ""}
                /* 2026-08-04: why the link failed (six codes), or what a
                   thin-but-successful listing really carries (tier 2/3). */
                failCode={item.failCode || ""}
                listingInfo={listingInfoOf(item)}
                onClearChart={clearBlockedChart}
                pickScreen={noChartPickScreen}
                oneLiner={noChartOneLiner}
                category={item.category}
                runValues={verdict.runValues}
                chosenSize={chosenSize}
                savedUsual={verdict.usualSize}
                customSize={customSize}
                onCustomChange={setCustomSize}
                onCommit={commitCustomSize}
                onPick={pickItemSize}
                onUpload={() => chartInputRef.current?.click()}
                onEnterManual={() => chartRead.startTyping(item.category)}
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
                cellReads={cellReads}
                measureKey={sizeMeasureKey}
                typeWord={garmentTypeWord(verdict.rec)}
                onPick={pickItemSize}
                editorial={isDesktopPanel}
                analysis={desktopAnalysis}
                item={item}
                fitPref={fitPref}
                onAskPref={onSaveFitPref ? () => setAskingPref(true) : null}
                usualFitSource={isUsualFitSource(bodyProfile)}
                brandMatchSource={isBrandMatchSource(bodyProfile)}
                derivedBodySource={isDerivedBodySource(bodyProfile)}
                headerBlocked={headerBlocked}
                customBox={
                  <CustomSizeBox
                    className="cz-sizing-cell is-custom"
                    value={customSize}
                    shownValue={customSizeShown}
                    onChange={setCustomSize}
                    onCommit={commitCustomSize}
                    placeholder={isDesktopPanel ? "Other / Type it" : "Other"}
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
            {!askingMeasures && !sizeBusy && !noChartPickScreen && !noChartOneLiner ? (
              <SizeChoiceEditor
                chosenSize={chosenSize}
                /* Spec step 3 (2026-08-08): no green before a chart. Green only
                   means money or a recommendation, and a chartless usual size
                   is neither. */
                recommendedSize={noChart ? "" : verdict.recSize || verdict.usualSize}
                runValues={verdict.runValues}
                choicesHidden={sizeCells.length > 0}
                customSize={customSize}
                onCustomChange={setCustomSize}
                onCommit={commitCustomSize}
                onPick={pickItemSize}
              />
            ) : null}

            {!askingMeasures &&
            (askingPref || (needsPrefAsk && !prefAskClosed)) &&
            onSaveFitPref ? (
              // 5b — the taste ask sits in the confidence-strip slot. The
              // sizing block above stays, so the card is never blocked.
              <FitPrefAsk
                item={item}
                fitPref={fitPref}
                onSaveFitPref={onSaveFitPref}
                onDone={closePrefAsk}
                revealOnOpen={askingPref}
              />
            ) : !askingMeasures &&
              !noChart &&
              !sizeBusy &&
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
                headerBlocked={headerBlocked}
                /* One badge per screen (2026-08-09). The desktop panel shows
                   the headline pill and the phone sheet shows its own
                   confidence line, so the strip drops its copy on both. The
                   card back has neither, so it keeps the badge. */
                showBadge={!isDesktopPanel && !wantsStickyBar}
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
            {!isDesktopPanel && verdict.prescription && !noChart && !sizeBusy ? (
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
            ) : !isDesktopPanel &&
              typeof onToggleFitSummary === "function" &&
              !fitSummaryOn &&
              !noChart &&
              !sizeBusy &&
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

            {!askingMeasures && !noChart && !sizeBusy ? (
              isDesktopPanel ? (
                <div className="cz-fit-read-block">
                  <button
                    type="button"
                    className="cz-fit-read-toggle"
                    aria-expanded={openRead}
                    onClick={() => setOpenRead((v) => !v)}
                  >
                    <span>Measurement by measurement</span>
                    <span>{openRead ? "Hide" : "Show"}</span>
                  </button>
                  {openRead ? (
                    <FitReadTable
                      rows={fitRows}
                      hasChart={!!verdict.chart}
                      units={measureUnits}
                      reading={chartRead.reading}
                      readingCount={chartRead.count}
                      outsidePhrasing={false}
                      chart={verdict.chart}
                      highlight={verdict.shown && verdict.shown.size}
                      highlightAlt={
                        verdict.shown && verdict.shown.alt ? verdict.shown.alt.size : null
                      }
                      /* The bars describe the size on screen, so the heading
                         and the row words follow the tap (2026-08-09). */
                      rec={verdict.shown || verdict.rec}
                      sourceHost={listingHostLabel(item)}
                      sourceVia={
                        item.sizeChartSource ? item.sizeChartSource.via || "" : ""
                      }
                      onEditMeasures={onOpenSizes ? openProfileSizes : null}
                      onForgetChart={chartIsForgettable ? forgetChart : null}
                    />
                  ) : null}
                </div>
              ) : (
              <FitReadTable
                rows={fitRows}
                hasChart={!!verdict.chart}
                units={measureUnits}
                reading={chartRead.reading}
                readingCount={chartRead.count}
                outsidePhrasing={wantsStickyBar}
                chart={verdict.chart}
                highlight={verdict.shown && verdict.shown.size}
                highlightAlt={
                  verdict.shown && verdict.shown.alt ? verdict.shown.alt.size : null
                }
                rec={verdict.shown || verdict.rec}
                sourceHost={listingHostLabel(item)}
                sourceVia={item.sizeChartSource ? item.sizeChartSource.via || "" : ""}
                onEditMeasures={wantsStickyBar ? null : onOpenSizes ? openProfileSizes : null}
                onForgetChart={
                  wantsStickyBar ? null : chartIsForgettable ? forgetChart : null
                }
              />
              )
            ) : null}

            {isDesktopPanel && !noChart && !sizeBusy && !askingMeasures ? (
              <SellerChartFold
                item={item}
                chart={verdict.chart}
                bodyProfile={bodyProfile}
                fitPref={fitPref}
                units={measureUnits}
                recSize={verdict.recSize}
                chosenSize={chosenSize}
                chartIsForgettable={chartIsForgettable}
                onPick={pickItemSize}
                onUpload={() => chartInputRef.current?.click()}
                onEnterManual={() => chartRead.startTyping(item.category)}
                onForgetChart={forgetChart}
              />
            ) : null}

            {/* Spec step 3 (2026-08-08): the pick screen carries its own two
                chart-entry actions, so this bottom row would say the same
                thing twice there. Spec step 3b: non-sized categories keep
                chart entry in Settings only. Every other state keeps it. */}
            {!noChartPickScreen && !noChartOneLiner ? (
            <div className="cz-detail-chart-actions">
              {/* Kyle 2026-07-30: a chart photo is not always readable, and a
                  seller sometimes prints the numbers in the listing text. Four
                  sizes by four columns is about twenty seconds of typing.
                  Kyle 2026-08-03 put typing first. Typing always works. A photo
                  read can still come back with nothing. */}
              <button
                type="button"
                className="cz-detail-chart-upload"
                onClick={() => chartRead.startTyping(item.category)}
              >
                Type the chart
              </button>
              <button
                type="button"
                className="cz-detail-chart-upload"
                onClick={() => chartInputRef.current?.click()}
              >
                <Upload size={16} strokeWidth={2} aria-hidden="true" />
                Add a chart photo
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
            </div>
            ) : null}

            {chartRead.reading || chartRead.chart || chartRead.error ? (
              <SizingBlockReading
                reading={chartRead.reading}
                chart={chartRead.chart}
                thumb={chartRead.thumb}
                error={chartRead.error}
                units={measureUnits}
                typed={chartRead.typed}
                authRequired={chartRead.authRequired === true}
                capReached={chartRead.capReached === true}
                unavailable={chartRead.unavailable === true}
                onUse={chartRead.commit}
                onRetrySame={chartRead.retryLast}
                onRetry={() => {
                  // Kyle 2026-08-02: "Try another photo" must open the picker.
                  // Item 8: do NOT dismiss first — cancel of the OS picker
                  // fires no change event, so a prior dismiss left the user
                  // with no prompt. Keep error state until a new read starts
                  // (onChange) or they leave another way. "Not this one" /
                  // typed Cancel still dismiss when a chart is staged.
                  const hadChart = !!chartRead.chart || chartRead.typed;
                  if (hadChart) {
                    chartRead.dismiss();
                    return;
                  }
                  chartInputRef.current?.click();
                }}
                onFix={chartRead.fix}
              />
            ) : null}
          </section>
          ) : null}

          {/* Shared chart file input — Fit and Chart tabs both trigger it. */}
          <input
            ref={chartInputRef}
            className="cz-detail-chart-file"
            type="file"
            accept="image/*"
            hidden
            onChange={readUploadedChart}
          />

          {/* The Details kicker and the five rows under it are gone (item-detail
              handoff 2026-07-29). Status, haul, colorway, weight, category and
              seller all moved into the command bar under the title. Nothing
              answers "what is it" down here any more, so the seam the kicker
              marked no longer exists. */}

        </div>

        {/* Phone / flip-card: Details pane — mock row list + history + notes. */}
        {!isDesktopPanel ? (
        <section
          className="cz-detail-pane cz-detail-pane-details cz-detail-pane-history"
          aria-label={wantsStickyBar ? "Details" : undefined}
        >
        {lowerEditing ? <div ref={editorSlotRef}>{renderPriceEditor()}</div> : null}

        {/* Same mock fact rows as desktop Details. The chip bar under the title
            stays for quick edits; this list is the full Details surface. */}
        {wantsStickyBar ? (
          <CommandBar
            item={item}
            view={view}
            edit={edit}
            commit={() => commitRef.current()}
            onSaveEdit={onSaveEdit}
            pickStatus={pickStatus}
            pickCategory={pickCategory}
            knownHauls={knownHauls}
            haulCounts={haulCounts}
            sellerHref={sellerHref}
            weightUnit={weightUnit}
            weightText={weightText}
            onWeightChange={writeWeight}
            onSwitchWeightUnit={switchWeightUnit}
            layout="list"
            hideSeller
          />
        ) : null}

        {timelineBlock}
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
        ) : null}
      </div>
      </div>

      {footerPrice || buyButton ? (
        (() => {
          const foot = (
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
              Referral code funds the app. It never changes your price.
            </p>
          ) : null}
          {buyButton && signupUrl ? (
            <a
              className="cz-detail-signup-link"
              href={signupUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {"New to " + signupAgent.name + "? Sign up"}
            </a>
          ) : null}
        </div>
          );
          if (footerTarget === undefined) return foot;
          if (footerTarget === null) return null;
          return createPortal(foot, footerTarget);
        })()
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
