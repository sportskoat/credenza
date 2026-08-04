// Pure writer for item.review. Unset fields stay ABSENT, never null, "", or 0.
// Spec: haul sharing handoff README §3 + AGENT-NOTES answer 1.

/**
 * @param {object|null|undefined} review
 * @param {object} patch keys among note, rebuy, rating, run, photos
 * @returns {object}
 */
export function nextReviewField(review, patch) {
  const out = {};
  const base = review && typeof review === "object" ? review : {};
  const src = { ...base, ...(patch && typeof patch === "object" ? patch : {}) };

  if (typeof src.note === "string") {
    const note = src.note.replace(/\s+/g, " ").trim();
    if (note) out.note = note;
  }

  if (src.rebuy === true || src.rebuy === false) out.rebuy = src.rebuy;

  const rating = Number(src.rating);
  if (Number.isInteger(rating) && rating >= 1 && rating <= 10) out.rating = rating;

  if (src.run === "small" || src.run === "true" || src.run === "large") out.run = src.run;

  if (Array.isArray(src.photos)) {
    const photos = src.photos.filter((p) => typeof p === "string" && p);
    if (photos.length) out.photos = photos;
  }

  // When the patch explicitly clears a key, remove it even if base had it.
  if (patch && typeof patch === "object") {
    if ("note" in patch && (patch.note == null || patch.note === "")) delete out.note;
    if ("rebuy" in patch && patch.rebuy !== true && patch.rebuy !== false) delete out.rebuy;
    if ("rating" in patch) {
      const r = Number(patch.rating);
      if (!(Number.isInteger(r) && r >= 1 && r <= 10)) delete out.rating;
    }
    if ("run" in patch && patch.run !== "small" && patch.run !== "true" && patch.run !== "large") {
      delete out.run;
    }
    if ("photos" in patch) {
      if (!Array.isArray(patch.photos) || !patch.photos.length) delete out.photos;
    }
  }

  return out;
}
