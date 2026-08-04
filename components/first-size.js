// Phase 1 first-size chooser (F build program 2026-08-02).
// Pure helpers: Guess / Measure / skip. Match-with-shirt is Phase 2
// (components/brand-match.js + FirstSizeBlock match steps).
//
// EASE MAPPING (Close / Regular / Roomy → existing fit machinery, ONE domain):
// Design 2a labeled targets +2 / +6 / +12 cm. Those numbers were illustrative.
// We map the three taps onto FIT_PREF_AXES looseness values so recommendSize
// and chestEaseBand stay the single source of room math:
//
//   Close   → "slim"      → knitSlim band [0, 5]  (ideal ~+2.5 cm)
//   Regular → "regular"   → knit band     [5, 10] (ideal ~+7.5 cm)
//   Roomy   → "oversized" → knitOver      [15, 25] (ideal ~+20 cm)
//             (bottoms use "baggy" instead of "oversized")
//
// We do NOT invent a parallel +2/+6/+12 ease system. Roomy is intentionally
// the existing oversized band, not a new +12 mid-band.

import {
  chestEaseBand,
  compactSizeToken,
  fitPrefLabel,
  garmentType,
  recommendSize,
  measureToStorage,
} from "../credenza-fashion.jsx";

/**
 * Sit taps on Guess step 2. Hints are the TRUE knit band ranges that
 * chestEaseBand uses for slim / regular / oversized (knitSlim [0,5],
 * knit [5,10], knitOver [15,25]) — not the design 2a +2/+6/+12 sketches.
 * Literals here (not a live CHEST_EASE_BANDS read) avoid a circular import
 * with credenza-fashion.jsx; the first-size test pins them equal to the
 * live bands so a band change fails this flow's pin.
 */
export const FIRST_SIZE_SIT_OPTIONS = [
  { value: "close", label: "Close", hint: "+0–5 cm", band: "knitSlim" },
  { value: "regular", label: "Regular", hint: "+5–10 cm", band: "knit" },
  { value: "roomy", label: "Roomy", hint: "+15–25 cm", band: "knitOver" },
];

/** Usual-size chips on Guess step 1. */
export const FIRST_SIZE_USUAL_CHIPS = ["XS", "S", "M", "L", "XL", "XXL"];

/**
 * Map a sit tap onto the existing looseness preference value.
 * @param {"close"|"regular"|"roomy"} sit
 * @param {string} category
 * @returns {"slim"|"regular"|"oversized"|"baggy"|null}
 */
export function sitToLooseness(sit, category) {
  if (sit === "close") return "slim";
  if (sit === "regular") return "regular";
  if (sit === "roomy") {
    return category === "pants" || category === "shorts" ? "baggy" : "oversized";
  }
  return null;
}

/**
 * Human label for a sit tap (for copy).
 */
export function sitLabel(sit) {
  const opt = FIRST_SIZE_SIT_OPTIONS.find((o) => o.value === sit);
  return opt ? opt.label : sit || "";
}

/**
 * True when the profile has nothing the size engine can score with —
 * the first-size chooser may mount.
 */
export function profileNeedsFirstSize(profile) {
  if (!profile || typeof profile !== "object") return true;
  const hasMeasure =
    profile.chest != null ||
    profile.waist != null ||
    profile.hip != null ||
    profile.height != null ||
    profile.weight != null;
  const hasUsual = !!(
    (profile.usualSize && String(profile.usualSize).trim()) ||
    (profile.usualTops && String(profile.usualTops).trim()) ||
    (profile.usualBottoms && String(profile.usualBottoms).trim())
  );
  return !hasMeasure && !hasUsual;
}

/**
 * Provenance for a pick that came from usual size + sit preference.
 * NEW class — pin exact wording in tests.
 */
export const FIRST_SIZE_USUAL_FIT_PROV = {
  kicker: "AI size",
  rail: "Chart pick · usual size + fit",
  body: "Started from a size you told us, not a measurement.",
  upgrade: "Add your chest",
};

/**
 * Provenance when Guess runs on a card with NO seller chart.
 * Matches the existing usual-size fallback rail (YOUR USUAL) — not the
 * chart-anchored usual-fit class above. Pin exact wording in tests.
 */
export const FIRST_SIZE_USUAL_NO_CHART_PROV = {
  kicker: "Your usual size",
  // Onboarding README, "The sizing algorithm": the confidence label ladder is
  // chart pick · usual size + fit  →  chart pick · chest 108cm  →
  // no chart · your usual size. The rail must name the missing chart, so the
  // label never outruns fit.*.source.
  rail: "No chart · your usual size",
  body: "This listing has no chart. The pick is your usual size.",
  upgrade: "Add your chest",
};

/**
 * Provenance when Match names a brand tee (Phase 2 design B3).
 * Rail is dynamic: "Chart pick · chest {n}cm". Body names the brand + size.
 */
export const FIRST_SIZE_BRAND_MATCH_PROV = {
  kicker: "AI size",
  upgrade: "Measure it properly",
  provTail: "to lock it in.",
};

/**
 * Build brand-match provenance strings for the result rail.
 * @param {{ brandLabel: string, size: string, chest: number }} opts
 */
export function brandMatchProvenance({ brandLabel, size, chest }) {
  const n = Math.round(Number(chest));
  const rail = isFinite(n) ? "Chart pick · chest " + n + "cm" : "Chart pick · brand tee";
  const named =
    brandLabel && size
      ? "From the " + brandLabel + " " + size + " you named, not a tape."
      : "From the brand tee you named, not a tape.";
  return {
    kicker: FIRST_SIZE_BRAND_MATCH_PROV.kicker,
    rail,
    body: named,
    upgrade: FIRST_SIZE_BRAND_MATCH_PROV.upgrade,
    provTail: FIRST_SIZE_BRAND_MATCH_PROV.provTail,
  };
}

/**
 * Find the chart row whose size token matches the usual letter.
 */
export function chartRowForUsual(chart, usualLetter) {
  if (!chart || !Array.isArray(chart.rows) || !usualLetter) return null;
  const want = compactSizeToken(usualLetter) || String(usualLetter).toUpperCase();
  return (
    chart.rows.find((r) => {
      const tok = compactSizeToken(r.size) || String(r.size || "").toUpperCase();
      return tok === want;
    }) || null
  );
}

/**
 * Primary garment measure key for a category on this chart.
 */
export function primaryMeasureKey(chart, category) {
  if (!chart || !Array.isArray(chart.rows)) return null;
  const has = (key) => chart.rows.filter((r) => r[key] != null).length >= 2;
  const bottoms = category === "pants" || category === "shorts";
  if (bottoms) {
    if (has("waist")) return "waist";
    if (has("hip")) return "hip";
    return null;
  }
  if (has("chest")) return "chest";
  if (has("waist")) return "waist";
  return null;
}

/**
 * Infer a body profile from the seller chart row for the usual size.
 * Treats that letter as a Regular-fit reference on this chart, then
 * recommendSize + fitPref apply the sit preference on top.
 *
 * body[key] = garment[key] − mid(regular band) so a Regular sit re-picks
 * that letter; Close/Roomy move the band and may move the letter.
 */
export function bodyFromUsualChartSize(chart, usualLetter, category, title = null) {
  const row = chartRowForUsual(chart, usualLetter);
  if (!row) return null;
  const key = primaryMeasureKey(chart, category);
  if (!key || row[key] == null) return null;
  const garment = Number(row[key]);
  if (!isFinite(garment)) return null;

  const bottoms = category === "pants" || category === "shorts";
  let idealEase;
  if (bottoms) {
    // Bottoms still use the pre-band ease of 2 cm around the waist/hip.
    idealEase = 2;
  } else {
    const kind = garmentType(title, chart, category);
    // Regular band mid — same domain as sit→regular→knit [5,10].
    const band = chestEaseBand(kind, null, "regular") || [5, 10];
    idealEase = (band[0] + band[1]) / 2;
  }

  const body = { [key]: Math.round((garment - idealEase) * 10) / 10 };
  // Flags for provenance + upgrade path (real measure clears these).
  body.firstSizeSource = "usual-fit";
  body.chestFromUsual = key === "chest";
  body.waistFromUsual = key === "waist" || key === "hip";
  return body;
}

/**
 * True when a chart has enough rows to anchor a Guess pick.
 */
export function chartUsableForGuess(chart) {
  return !!(chart && Array.isArray(chart.rows) && chart.rows.length >= 2);
}

/**
 * Run the Guess path: usual letter + sit preference → scored rec.
 * With a chart: chart-anchored recommendSize (usual-fit provenance).
 * Without a chart: still saves usual + sit; pick is the usual letter itself
 * (existing YOUR USUAL fallback — no error, no dead end).
 * @returns {{ rec, fitPref, body, usualLetter, sit, noChart? } | { error: string }}
 */
export function guessSizeFromUsual({ chart, usualLetter, sit, category, title = null }) {
  if (!usualLetter) return { error: "no-usual" };
  const looseness = sitToLooseness(sit, category);
  if (!looseness) return { error: "no-sit" };

  const fitPref = { length: null, looseness, dismissed: false };

  // No seller chart → durable usual + sit, pick = the letter they named.
  // Never an error: the card shell already promises usual-size fallback.
  if (!chartUsableForGuess(chart)) {
    const letter = String(usualLetter).trim();
    return {
      rec: { size: letter, missing: false },
      fitPref,
      body: {
        // Not "usual-fit" — that class claims a chart-anchored measure.
        firstSizeSource: "usual-no-chart",
        chestFromUsual: false,
        waistFromUsual: false,
      },
      usualLetter: letter,
      sit,
      looseness,
      noChart: true,
    };
  }

  const body = bodyFromUsualChartSize(chart, usualLetter, category, title);
  if (!body) return { error: "usual-not-on-chart" };

  const rec = recommendSize(chart, body, category, fitPref, null, title, null);
  if (!rec || rec.missing || !rec.size) return { error: "no-rec", body, fitPref };

  return { rec, fitPref, body, usualLetter, sit, looseness, noChart: false };
}

/**
 * Build the profile patch to save after a successful Guess.
 */
export function profilePatchFromGuess({ usualLetter, body, category }) {
  const patch = { ...(body || {}) };
  const letter = String(usualLetter || "").trim();
  if (letter) {
    patch.usualSize = letter;
    if (category === "pants" || category === "shorts") patch.usualBottoms = letter;
    else patch.usualTops = letter;
  }
  return patch;
}

/**
 * Pit-to-pit (half chest across) → full circumference in storage cm.
 * Input is the number the customer typed; units is the toggle (cm|in).
 * Result is always full chest in cm for the body profile.
 */
export function circumferenceFromPitToPit(displayValue, units) {
  const half = measureToStorage(displayValue, units, "length");
  if (half == null) return null;
  return Math.round(half * 2 * 10) / 10;
}

/**
 * Measure-path body patch. Tops → chest (doubled from pit-to-pit).
 * Bottoms → waist as a flat circumference (not doubled).
 */
export function profilePatchFromMeasure({ category, displayValue, units }) {
  const bottoms = category === "pants" || category === "shorts";
  if (bottoms) {
    const waist = measureToStorage(displayValue, units, "length");
    if (waist == null) return null;
    return {
      waist,
      firstSizeSource: "measure",
      chestFromUsual: false,
      waistFromUsual: false,
    };
  }
  const chest = circumferenceFromPitToPit(displayValue, units);
  if (chest == null) return null;
  return {
    chest,
    firstSizeSource: "measure",
    chestFromUsual: false,
    waistFromUsual: false,
  };
}

/**
 * Whether resolveDisplaySize / sizing UI should show the usual-fit provenance.
 */
export function isUsualFitSource(profile) {
  return !!(profile && profile.firstSizeSource === "usual-fit");
}

/**
 * Whether the profile chest came from a named brand tee (Phase 2 Match).
 */
export function isBrandMatchSource(profile) {
  return !!(profile && profile.firstSizeSource === "brand-match");
}

/**
 * Map sit value → label used in fit pref UI (Slim / Regular / Oversized).
 */
export function loosenessLabelForSit(sit, category) {
  const looseness = sitToLooseness(sit, category);
  if (!looseness) return "";
  return fitPrefLabel(category === "pants" || category === "shorts" ? category : "shirt", "looseness", looseness);
}
