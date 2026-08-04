import { useMemo, useRef, useState } from "react";
import {
  ModalShell,
  Pill,
  SegmentedControl,
  computeRecommendedSize,
  parseSizeChart,
  sizeChartTextFor,
  formatMoney,
} from "../credenza-fashion.jsx";
import { buildSharedFit } from "../haul-fit-share.js";
import { nextReviewField } from "../haul-review-fields.js";

export { nextReviewField };

const RUN_OPTIONS = [
  { value: "small", label: "Runs small" },
  { value: "true", label: "True to size" },
  { value: "large", label: "Runs large" },
];

const PHOTO_SLOTS = 4;
// Design-mandated placeholder (verbatim, including its em dash).
const NOTE_PLACEHOLDER =
  "Fabric, stitching, print, smell — whatever you'd want told to you.";

function itemMetaLine(item) {
  const bits = [];
  const size = item && typeof item.size === "string" ? item.size.trim() : "";
  if (size) bits.push("SIZE " + size.toUpperCase());
  const usd = item && item.priceUsd != null ? Number(item.priceUsd) : NaN;
  if (Number.isFinite(usd) && usd > 0) bits.push(formatMoney(usd, "USD"));
  const grams = item && item.weightGrams != null ? Number(item.weightGrams) : NaN;
  if (Number.isFinite(grams) && grams > 0) bits.push(Math.round(grams) + " G");
  return bits.join(" · ");
}

function writtenCount(items) {
  let n = 0;
  for (const item of items) {
    const r = item && item.review;
    if (!r || typeof r !== "object") continue;
    if (r.note || r.rebuy === true || r.rebuy === false || r.rating || r.run || (r.photos && r.photos.length)) {
      n += 1;
    }
  }
  return n;
}

export default function HaulReviewSheet({
  items = [],
  bodyProfile = null,
  fitPrefs = null,
  onSaveItem,
  onCompressPhoto,
  onClose,
}) {
  const list = Array.isArray(items) ? items.filter(Boolean) : [];
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const slotTarget = useRef(null);

  const safeIndex = list.length ? Math.min(index, list.length - 1) : 0;
  const item = list[safeIndex] || null;
  const review = (item && item.review && typeof item.review === "object" ? item.review : {}) || {};
  const photos = Array.isArray(review.photos) ? review.photos.slice(0, PHOTO_SLOTS) : [];

  const fit = useMemo(() => {
    if (!item) return null;
    const chart = parseSizeChart(sizeChartTextFor(item));
    const recommended = computeRecommendedSize(item, bodyProfile, fitPrefs);
    return buildSharedFit({
      category: item.category,
      sizeBought: item.size,
      chart,
      profile: bodyProfile,
      recommendedSize: recommended,
    });
  }, [item, bodyProfile, fitPrefs]);

  if (!item) {
    return (
      <ModalShell title="Write the review" onClose={onClose} maxWidth={560} surfaceClassName="cz-haul-review-sheet">
        <p className="cz-haul-review-empty">This haul has no items to review.</p>
      </ModalShell>
    );
  }

  const patchReview = (patch) => {
    if (!onSaveItem || !item) return;
    const next = nextReviewField(review, patch);
    onSaveItem(item.id, { review: next });
  };

  const setRebuy = (value) => {
    // Tap the same answer again to clear (Skip-equivalent for Yes/No).
    if (value === "skip") {
      patchReview({ rebuy: null });
      return;
    }
    if (review.rebuy === value) {
      patchReview({ rebuy: null });
      return;
    }
    patchReview({ rebuy: value });
  };

  const setRating = (raw) => {
    if (raw === "" || raw == null) {
      patchReview({ rating: null });
      return;
    }
    const n = Math.round(Number(raw));
    patchReview({ rating: n });
  };

  const addPhoto = async (file) => {
    if (!file || !onCompressPhoto || photos.length >= PHOTO_SLOTS) return;
    setBusy(true);
    try {
      const dataUrl = await onCompressPhoto(file);
      if (!dataUrl) return;
      const next = photos.concat([dataUrl]).slice(0, PHOTO_SLOTS);
      patchReview({ photos: next });
    } finally {
      setBusy(false);
      slotTarget.current = null;
    }
  };

  const removePhoto = (idx) => {
    const next = photos.filter((_, i) => i !== idx);
    patchReview({ photos: next });
  };

  const goNext = (skip) => {
    if (!skip) {
      // Persist current draft as-is (already live-written).
    }
    if (safeIndex >= list.length - 1) {
      onClose && onClose();
      return;
    }
    setIndex(safeIndex + 1);
  };

  const written = writtenCount(list);
  const isLast = safeIndex >= list.length - 1;
  const thumb = (item.image || (item.photos && item.photos[0]) || "") || "";

  return (
    <ModalShell
      title="Write the review"
      onClose={onClose}
      maxWidth={560}
      surfaceClassName="cz-haul-review-sheet"
    >
      <div className="cz-haul-review">
        <header className="cz-haul-review-head">
          <div
            className="cz-haul-review-thumb"
            role="img"
            aria-label={item.title || "Item photo"}
            style={thumb ? { backgroundImage: "url(\"" + String(thumb).replace(/"/g, "") + "\")" } : undefined}
          />
          <div className="cz-haul-review-head-text">
            <div className="cz-kicker">
              ITEM {safeIndex + 1} OF {list.length}
            </div>
            <h3 className="cz-haul-review-name">{item.title || "Untitled"}</h3>
            {itemMetaLine(item) ? (
              <div className="cz-haul-review-meta">{itemMetaLine(item)}</div>
            ) : null}
          </div>
        </header>

        <section className="cz-haul-review-chart" aria-label="From the chart we scanned">
          <div className="cz-kicker">From the chart we scanned</div>
          {fit && fit.translation ? (
            <p className="cz-haul-review-chart-trans">{fit.translation}</p>
          ) : null}
          {fit && fit.roomLine ? <p className="cz-haul-review-chart-line">{fit.roomLine}</p> : null}
          {fit && fit.advice ? <p className="cz-haul-review-chart-line">{fit.advice}</p> : null}
          {!fit || (!fit.translation && !fit.roomLine && !fit.advice) ? (
            <p className="cz-haul-review-chart-line">No chart on the listing</p>
          ) : null}
        </section>

        <section className="cz-haul-review-block">
          <div className="cz-haul-review-label">Your photos</div>
          <div className="cz-haul-review-photos">
            {Array.from({ length: PHOTO_SLOTS }).map((_, i) => {
              const src = photos[i];
              return (
                <button
                  key={i}
                  type="button"
                  className={"cz-haul-review-slot" + (src ? " has-photo" : "")}
                  aria-label={src ? "Remove photo " + (i + 1) : "Add photo to slot " + (i + 1)}
                  disabled={busy}
                  onClick={() => {
                    if (src) {
                      removePhoto(i);
                      return;
                    }
                    slotTarget.current = i;
                    fileRef.current && fileRef.current.click();
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
                    if (file) addPhoto(file);
                  }}
                  style={
                    src
                      ? { backgroundImage: "url(\"" + String(src).replace(/"/g, "") + "\")" }
                      : undefined
                  }
                >
                  {!src ? <span className="cz-haul-review-slot-plus">+</span> : null}
                </button>
              );
            })}
          </div>
          <p className="cz-haul-review-caption">
            Worn shots go into the card&apos;s slideshow after the listing photos. Empty slots never
            show on the shared page.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="cz-haul-review-file"
            onChange={(e) => {
              const file = e.target.files && e.target.files[0];
              e.target.value = "";
              if (file) addPhoto(file);
            }}
          />
        </section>

        <section className="cz-haul-review-block">
          <div className="cz-haul-review-label">How did it run?</div>
          <SegmentedControl
            label="How did it run?"
            value={review.run || ""}
            allowUnset
            options={RUN_OPTIONS}
            onChange={(v) => patchReview({ run: v || null })}
          />
          <p className="cz-haul-review-caption">
            Leave it blank and the shared card shows the chart translation alone.
          </p>
        </section>

        <section className="cz-haul-review-block">
          <div className="cz-haul-review-label">Would you buy it again?</div>
          <div className="cz-haul-review-rebuy-row">
            <div className="cz-haul-review-chips" role="group" aria-label="Would you buy it again?">
              <button
                type="button"
                className={"cz-haul-review-chip" + (review.rebuy === true ? " is-on" : "")}
                aria-pressed={review.rebuy === true}
                onClick={() => setRebuy(true)}
              >
                Yes
              </button>
              <button
                type="button"
                className={"cz-haul-review-chip" + (review.rebuy === false ? " is-on" : "")}
                aria-pressed={review.rebuy === false}
                onClick={() => setRebuy(false)}
              >
                No
              </button>
              <button
                type="button"
                className={
                  "cz-haul-review-chip" +
                  (review.rebuy !== true && review.rebuy !== false ? " is-on" : "")
                }
                aria-pressed={review.rebuy !== true && review.rebuy !== false}
                onClick={() => setRebuy("skip")}
              >
                Skip
              </button>
            </div>
            <label className="cz-haul-review-rating">
              <span className="cz-haul-review-rating-label">Rating</span>
              <input
                type="number"
                min={1}
                max={10}
                inputMode="numeric"
                className="cz-haul-review-rating-input"
                placeholder="–"
                value={review.rating != null ? String(review.rating) : ""}
                onChange={(e) => setRating(e.target.value)}
                aria-label="Rating from 1 to 10"
              />
              <span className="cz-haul-review-rating-suffix">/10</span>
            </label>
          </div>
          <p className="cz-haul-review-caption">Skip and the row disappears from the shared card.</p>
        </section>

        <section className="cz-haul-review-block">
          <label className="cz-haul-review-label" htmlFor="cz-haul-review-note">
            Your note
          </label>
          <textarea
            id="cz-haul-review-note"
            className="cz-haul-review-note"
            rows={3}
            placeholder={NOTE_PLACEHOLDER}
            value={typeof review.note === "string" ? review.note : ""}
            onChange={(e) => patchReview({ note: e.target.value })}
          />
        </section>

        <footer className="cz-haul-review-foot">
          <div className="cz-kicker">
            {written} OF {list.length} WRITTEN
          </div>
          <div className="cz-haul-review-foot-actions">
            <Pill onClick={() => goNext(true)}>Skip item</Pill>
            <Pill primary onClick={() => goNext(false)}>
              {isLast ? "Done" : "Next item"}
            </Pill>
          </div>
        </footer>
      </div>
    </ModalShell>
  );
}
