/**
 * haul-fit-share.js — the fit lines on a shared haul card, computed once at
 * share time and frozen into the snapshot. Pure: no DOM, no React, no network.
 *
 * Every line comes from data the author already has: the seller's size chart
 * scan, the author's own measurements, the size bought, the item weight. The
 * reader's page never computes anything; it prints these strings and hides
 * the lines that are absent. Spec: haul sharing handoff README §Derivations.
 *
 * Translation ships for tops and bottoms only (AGENT-NOTES answer 3).
 * Footwear, outerwear and one-size items show the room line and the band.
 */

import { nearestUsSize } from "./us-size-reference.js";

/** Category ids that get a "fits like a US …" translation. */
const TOPS = new Set(["shirt"]);
const BOTTOMS = new Set(["pants", "shorts"]);

/** The axis a category is judged by: chest for tops, waist for bottoms. */
export function judgedAxis(category) {
  if (TOPS.has(category)) return "chest";
  if (BOTTOMS.has(category)) return "waist";
  if (category === "outerwear") return "chest";
  return null;
}

/**
 * The band word for a room measurement (README §Derivations).
 * < 8cm slim · 8–16cm regular · 16–26cm boxy · > 26cm oversized.
 */
export function fitBand(roomCm) {
  if (!Number.isFinite(roomCm)) return null;
  if (roomCm < 8) return "slim";
  if (roomCm <= 16) return "regular";
  if (roomCm <= 26) return "boxy";
  return "oversized";
}

/**
 * Line 2 of the fit block: the room sentence, with the band word.
 * "14cm of room on my 98cm. Regular fit." Formats match the design:
 * 3cm and under reads "True to size.", the 8–9cm edge reads
 * "Regular, on the slim edge.", a negative room reads as tight.
 */
export function roomLine(roomCm, wearerCm) {
  if (!Number.isFinite(roomCm) || !Number.isFinite(wearerCm)) return null;
  const room = Math.round(roomCm);
  const wearer = Math.round(wearerCm);
  if (room < 0) return "Sits " + Math.abs(room) + "cm under my " + wearer + "cm. Tight fit.";
  if (room <= 3) return room + "cm of room on my " + wearer + "cm. True to size.";
  const base = room + "cm of room on my " + wearer + "cm. ";
  if (room < 8) return base + "Slim fit.";
  if (room < 10) return base + "Regular, on the slim edge.";
  if (room <= 16) return base + "Regular fit.";
  if (room <= 26) return base + "Boxy fit.";
  return base + "Oversized fit.";
}

/**
 * Line 1 of the fit block: the translation. Tops map to a US letter size,
 * bottoms to a US waist in inches ("Their L fits like a US 30–31 waist.").
 * Returns { translation, short } or null when the table cannot place the
 * garment. The short form rides the receipt rows ("XL = US M").
 */
export function translationLines(sizeBought, garmentCm, axis) {
  const size = String(sizeBought || "").trim();
  if (!size || !Number.isFinite(garmentCm)) return null;
  if (axis === "chest") {
    const us = nearestUsSize(garmentCm, "chest");
    if (!us) return null;
    return {
      translation: "Their " + size + " fits like a US " + us + ".",
      short: size + " = US " + us,
    };
  }
  if (axis === "waist") {
    const inches = garmentCm / 2.54;
    if (!Number.isFinite(inches) || inches < 24 || inches > 60) return null;
    const hi = Math.round(inches);
    const lo = hi - 1;
    return {
      translation: "Their " + size + " fits like a US " + lo + "–" + hi + " waist.",
      short: size + " = US " + lo + "–" + hi,
    };
  }
  return null;
}

/**
 * Line 3 of the fit block: the advice. Only when a chart was read and the
 * app has a recommended size. "Around a 98cm chest? Take the XL."
 */
export function adviceLine(recommendedSize, wearerCm, axis) {
  const size = String(recommendedSize || "").trim();
  if (!size || !Number.isFinite(wearerCm) || !axis) return null;
  return "Around a " + Math.round(wearerCm) + "cm " + axis + "? Take the " + size + ".";
}

/**
 * The one-word fabric signal appended to the weight in the meta line
 * (README §Derivations). Tee classes only: < 180g thin, 180–220g midweight,
 * > 220g heavyweight. Every other class stays silent.
 */
export function fabricSignal(weightGrams, weightKey) {
  if (!Number.isFinite(weightGrams) || weightGrams <= 0) return null;
  const teeClass = weightKey === "tee" || weightKey === "long_sleeve_tee" || weightKey === "heavy_tee";
  if (!teeClass) return null;
  if (weightGrams < 180) return "thin";
  if (weightGrams <= 220) return "midweight";
  return "heavyweight";
}

/** The chart row for the size the author bought, or null. */
export function chartRowForSize(chart, sizeBought) {
  const size = String(sizeBought || "").trim().toUpperCase();
  if (!size || !chart || !Array.isArray(chart.rows)) return null;
  return chart.rows.find((r) => String(r.size).toUpperCase() === size) || null;
}

/**
 * Build the four fit lines for one shared item. Every field is absent when
 * its input is missing; the shared page hides those lines.
 *
 * @param {object} args
 * @param {string} args.category item category id (shirt, pants, shoes, …)
 * @param {string} args.sizeBought the size the author ordered
 * @param {object|null} args.chart parsed size chart ({ rows, runHint }) or null
 * @param {object} args.profile author measurements in cm ({ chest, waist })
 * @param {string} [args.recommendedSize] the app's size pick for the author
 * @returns {{translation?: string, short?: string, roomLine?: string,
 *   advice?: string, source: string} | null} null when there is nothing to say
 */
export function buildSharedFit({ category, sizeBought, chart, profile, recommendedSize }) {
  const hasChart = !!(chart && Array.isArray(chart.rows) && chart.rows.length >= 2);
  const source = hasChart ? "Read from the seller's chart" : "No chart on the listing";
  const axis = judgedAxis(category);
  const wearer = profile && axis ? Number(profile[axis]) : NaN;
  const row = chartRowForSize(chart, sizeBought);
  const garment = row && axis ? Number(row[axis]) : NaN;

  const out = { source };

  // Translation: tops and bottoms only, and only with the garment measure.
  if ((TOPS.has(category) || BOTTOMS.has(category)) && Number.isFinite(garment)) {
    const t = translationLines(sizeBought, garment, axis);
    if (t) {
      out.translation = t.translation;
      out.short = t.short;
    }
  }

  // Room: any category with a judged axis and both measurements.
  if (axis && Number.isFinite(garment) && Number.isFinite(wearer)) {
    out.roomLine = roomLine(garment - wearer, wearer);
  }

  // Advice: only when a chart was read and the app has a pick.
  if (hasChart) {
    const advice = adviceLine(recommendedSize, wearer, axis);
    if (advice) out.advice = advice;
  }

  // The kicker never stands alone: no lines means no block.
  if (!out.translation && !out.roomLine && !out.advice) return null;
  return out;
}
