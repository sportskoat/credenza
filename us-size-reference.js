/**
 * us-size-reference.js — standard US sizes, in centimetres.
 *
 * The shared haul page translates a seller's size into a US size
 * ("Their XL fits like a US M."). It compares the garment measurement from
 * the seller's size chart against this table and picks the nearest size.
 * Tops match on chest, bottoms match on waist. Footwear, outerwear and
 * one-size items get no translation (AGENT-NOTES answer 3).
 *
 * Data only. Ranges are standard US menswear. Half-centimetre boundaries
 * are deliberate: adjacent ranges meet, they do not overlap.
 */

/**
 * One row per US size.
 * chestCm: garment chest range for tops, [low, high] inclusive.
 * waistCm: garment waist range for bottoms, [low, high] inclusive.
 */
export const US_SIZES = [
  { size: "XS", chestCm: [81, 89], waistCm: [66, 73.5] },
  { size: "S", chestCm: [89, 97], waistCm: [73.5, 81] },
  { size: "M", chestCm: [97, 104], waistCm: [81, 89] },
  { size: "L", chestCm: [104, 112], waistCm: [89, 97] },
  { size: "XL", chestCm: [112, 119.5], waistCm: [97, 104.5] },
  { size: "XXL", chestCm: [119.5, 127], waistCm: [104.5, 112] },
];

/** Midpoint of a range, for "which size is nearest" comparisons. */
export function rangeMid([lo, hi]) {
  return (lo + hi) / 2;
}

/**
 * The US size whose standard range lands nearest a garment measurement.
 * axis is "chest" for tops, "waist" for bottoms. Returns null for a
 * measurement far outside the table (children's sizes, extreme big-and-tall)
 * rather than naming a size the table cannot support.
 */
export function nearestUsSize(measurementCm, axis) {
  if (!Number.isFinite(measurementCm) || measurementCm <= 0) return null;
  const key = axis === "waist" ? "waistCm" : "chestCm";
  let best = null;
  let bestDistance = Infinity;
  for (const row of US_SIZES) {
    const range = row[key];
    if (!range) continue;
    const distance = Math.abs(measurementCm - rangeMid(range));
    if (distance < bestDistance) {
      best = row;
      bestDistance = distance;
    }
  }
  if (!best) return null;
  // 8cm of slack past the range edge: further and the nearest size is a guess.
  const halfWidth = (best[key][1] - best[key][0]) / 2;
  if (bestDistance > halfWidth + 8) return null;
  return best.size;
}
