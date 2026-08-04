// Phase 2 Match-with-shirt (F ruling bd106459, 2026-08-02).
// Brand body charts → one profile chest number the Measure path also uses.
//
// Mapping (ONE domain with #81 ease, no new constant):
//   1. body_chest_cm range → midpoint (Nike S "88.9-95.3" → 92.1)
//   2. profile chest = body_mid + mid(CHEST_EASE_BANDS.knit [5,10]) = +7.5
//      (Nike S → 99.6). App chest is a fitting-garment circumference
//      (pit-to-pit doubled), not a raw body chart number.
//
// Import filters rows without a numeric body_chest_cm (H&M / Carhartt WIP
// NOT-COVERED markers never appear in the Match UI).

import brandTable from "../data/brand-measurements.json";

/**
 * Regular knit band mid — same domain as #81 sit→regular.
 * Literals here (not a live CHEST_EASE_BANDS read) avoid a circular import
 * with credenza-fashion.jsx; brand-match.test.js pins them equal to the
 * live knit band so a band change fails this flow's pin.
 */
export const BRAND_MATCH_EASE_BAND = [5, 10];
export const BRAND_MATCH_EASE_MID =
  (BRAND_MATCH_EASE_BAND[0] + BRAND_MATCH_EASE_BAND[1]) / 2; // 7.5

/**
 * Covered brands only (F list). H&M and Carhartt WIP stay off the list.
 * Key = JSON brand string. label = chip text.
 * Levi's is partial (only sizes present in the table).
 */
export const MATCH_BRANDS = [
  { key: "Nike", label: "Nike" },
  { key: "Adidas", label: "Adidas" },
  { key: "Uniqlo", label: "Uniqlo" },
  { key: "Zara", label: "Zara" },
  { key: "Champion", label: "Champion" },
  { key: "Carhartt (mainline)", label: "Carhartt" },
  { key: "The North Face", label: "The North Face" },
  { key: "New Balance", label: "New Balance" },
  { key: "Patagonia", label: "Patagonia" },
  { key: "Levi's", label: "Levi's" },
];

export const MATCH_OTHER = { key: "__other__", label: "Something else" };

/**
 * Parse body_chest_cm: single number or "low-high" range → midpoint.
 * Returns null when the cell is empty or non-numeric (filter rule).
 * @param {string|number|null|undefined} raw
 * @returns {number|null}
 */
export function bodyChestMidpoint(raw) {
  if (raw == null) return null;
  if (typeof raw === "number") {
    return isFinite(raw) ? raw : null;
  }
  const s = String(raw).trim();
  if (!s) return null;
  // "88.9-95.3" or "88.9 – 95.3" or a lone "101.6"
  const range = s.match(/^(\d+(?:\.\d+)?)\s*[-–—]\s*(\d+(?:\.\d+)?)$/);
  if (range) {
    const lo = Number(range[1]);
    const hi = Number(range[2]);
    if (!isFinite(lo) || !isFinite(hi)) return null;
    return Math.round(((lo + hi) / 2) * 10) / 10;
  }
  const n = Number(s);
  return isFinite(n) ? n : null;
}

/**
 * Body chart midpoint → profile chest (fitting-garment circumference).
 * Nike S: 92.1 + 7.5 = 99.6
 */
export function profileChestFromBodyMid(bodyMid) {
  if (bodyMid == null || !isFinite(bodyMid)) return null;
  return Math.round((bodyMid + BRAND_MATCH_EASE_MID) * 10) / 10;
}

/**
 * Rows with a usable numeric body_chest_cm only.
 * @returns {Array<object>}
 */
export function loadCoveredBrandRows(table = brandTable) {
  const rows = table && Array.isArray(table.rows) ? table.rows : [];
  return rows.filter((r) => bodyChestMidpoint(r && r.body_chest_cm) != null);
}

const COVERED_ROWS = loadCoveredBrandRows();

/**
 * Brand keys that have at least one numbered size.
 */
export function coveredBrandKeys(rows = COVERED_ROWS) {
  const set = new Set(rows.map((r) => r.brand));
  return MATCH_BRANDS.filter((b) => set.has(b.key)).map((b) => b.key);
}

/**
 * Brand chips for the Match UI (covered only + Something else).
 * Levi's appears only when it has at least one numbered size.
 */
export function matchBrandChips(rows = COVERED_ROWS) {
  const keys = new Set(coveredBrandKeys(rows));
  const chips = MATCH_BRANDS.filter((b) => keys.has(b.key));
  return [...chips, MATCH_OTHER];
}

/**
 * Size labels available for a brand, in table order.
 */
export function matchSizesForBrand(brandKey, rows = COVERED_ROWS) {
  if (!brandKey || brandKey === MATCH_OTHER.key) return [];
  const seen = new Set();
  const out = [];
  rows.forEach((r) => {
    if (r.brand !== brandKey) return;
    const size = String(r.size || "").trim();
    if (!size || size === "ALL" || seen.has(size)) return;
    if (bodyChestMidpoint(r.body_chest_cm) == null) return;
    seen.add(size);
    out.push(size);
  });
  return out;
}

/**
 * One brand × size row, or null.
 */
export function brandSizeRow(brandKey, size, rows = COVERED_ROWS) {
  if (!brandKey || !size) return null;
  const want = String(size).trim().toUpperCase();
  return (
    rows.find(
      (r) =>
        r.brand === brandKey &&
        String(r.size || "")
          .trim()
          .toUpperCase() === want &&
        bodyChestMidpoint(r.body_chest_cm) != null
    ) || null
  );
}

/**
 * Resolve a brand × size to the confirm payload.
 * @returns {{
 *   brandKey: string,
 *   brandLabel: string,
 *   size: string,
 *   bodyMid: number,
 *   profileChest: number,
 *   fitNote: string|null,
 *   sourceUrl: string|null,
 * } | { error: string }}
 */
export function resolveBrandMatch(brandKey, size, rows = COVERED_ROWS) {
  if (brandKey === MATCH_OTHER.key) return { error: "other" };
  if (!brandKey) return { error: "no-brand" };
  if (!size) return { error: "no-size" };
  const row = brandSizeRow(brandKey, size, rows);
  if (!row) return { error: "not-covered" };
  const bodyMid = bodyChestMidpoint(row.body_chest_cm);
  if (bodyMid == null) return { error: "not-covered" };
  const profileChest = profileChestFromBodyMid(bodyMid);
  if (profileChest == null) return { error: "not-covered" };
  const brandMeta = MATCH_BRANDS.find((b) => b.key === brandKey);
  return {
    brandKey,
    brandLabel: (brandMeta && brandMeta.label) || brandKey,
    size: String(row.size).trim(),
    bodyMid,
    profileChest,
    fitNote: row.fit_note ? String(row.fit_note) : null,
    sourceUrl: row.source_url || null,
  };
}

/**
 * Profile patch after the visitor confirms (or edits) the number.
 * @param {object} resolved - from resolveBrandMatch
 * @param {number} [chestOverride] - edited confirm value (cm)
 */
export function profilePatchFromBrandMatch(resolved, chestOverride = null) {
  if (!resolved || resolved.error) return null;
  const chest =
    chestOverride != null && isFinite(Number(chestOverride))
      ? Math.round(Number(chestOverride) * 10) / 10
      : resolved.profileChest;
  if (chest == null || !isFinite(chest) || chest <= 0) return null;
  return {
    chest,
    firstSizeSource: "brand-match",
    brandMatchBrand: resolved.brandKey,
    brandMatchSize: resolved.size,
    brandMatchLabel: resolved.brandLabel,
    chestFromUsual: false,
    waistFromUsual: false,
  };
}

/**
 * Confirm-screen headline. Rounded cm for a clean read.
 * F example: "A Nike M fits about a 100 cm chest tee, from Nike's own size guide."
 */
export function brandMatchConfirmHeadline(resolved, chestCm) {
  if (!resolved) return "";
  const n = Math.round(Number(chestCm != null ? chestCm : resolved.profileChest));
  if (!isFinite(n)) return "";
  return (
    "A " +
    resolved.brandLabel +
    " " +
    resolved.size +
    " fits about a " +
    n +
    " cm chest tee, from " +
    resolved.brandLabel +
    "'s own size guide."
  );
}

export function brandMatchConfirmBody() {
  return "That is the number we'll score this seller's chart with. Change it if yours runs different.";
}

export function brandMatchConfirmFoot(resolved) {
  if (!resolved) return "";
  return (
    "From published " +
    resolved.brandLabel +
    " measurements, stored in the app. Nothing was sent anywhere."
  );
}

/**
 * One-line cut caveat when the table names a cut difference.
 * Skip generic "true to size" notes — only surface when useful.
 */
export function brandMatchFitCaveat(resolved) {
  if (!resolved || !resolved.fitNote) return "";
  const note = resolved.fitNote;
  // Prefer the clause that names a cut difference (SB, Originals, boxy…).
  const usefulRe =
    /run[s]?\s+(large|small|loose|snug|boxy|oversized)|Originals|SB\b|Dri-FIT|size\s+up|size\s+down|inconsistent/i;
  if (!usefulRe.test(note)) return "";
  const clauses = note.split(/[.;]/).map((c) => c.trim()).filter(Boolean);
  const hit = clauses.find((c) => usefulRe.test(c)) || clauses[0] || note;
  return hit.length > 120 ? hit.slice(0, 117) + "…" : hit;
}
