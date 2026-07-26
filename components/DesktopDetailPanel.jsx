// Two-column desktop detail panel (design handoff turn 4 Fix B). At ≥1024px
// the expanded card stops flipping — both faces show at once: a contain-fit
// photo stage with pager + thumb strip on the left, the shared DetailBody on
// the right. The rack keeps its frozen physics; this is only the expanded
// layer. Below 1024px the app keeps the flip card / phone sheet.
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, MoreHorizontal, Plus, Trash2, X } from "lucide-react";
import {
  itemPhotoList,
  mergeFashionImages,
  priceLabel,
  yupooAlbumUrl,
} from "../credenza-fashion.jsx";
import DetailBody from "./DetailBody.jsx";
import { CoverPlaceholder } from "./CardCover.jsx";
import FavoriteButton from "./FavoriteButton.jsx";
import PhotoCoverFlow from "./PhotoCoverFlow.jsx";

export default function DesktopDetailPanel({
  item,
  haulNames = [],
  bodyProfile,
  fitPrefs = null,
  measureUnits = "cm",
  buyLabel = "Buy",
  onSaveEdit,
  onOpen,
  onAttachPhoto,
  onRemovePhoto,
  onOpenSizes,
  onSetPrimaryImage,
  onLoadPhotos,
  onToggleFavorite,
  onDelete,
  onClose,
  closing = false,
}) {
  const [photos, setPhotos] = useState(() => itemPhotoList(item, 24));
  const [photoIdx, setPhotoIdx] = useState(0);
  // Full-screen swipe gallery at the tapped photo (the entry the flip-card
  // hero pager used to provide). photoView = { startIndex } | null.
  const [photoView, setPhotoView] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [haulDraft, setHaulDraft] = useState("");
  const [addBusy, setAddBusy] = useState(false);
  const trackRef = useRef(null);
  const menuRef = useRef(null);
  const addInputRef = useRef(null);
  const PHOTO_MAX = 12;

  // Keep the stage in sync when attach/remove rewrites the item (or a new
  // card opens). Lazy Yupoo load still extends the list below.
  useEffect(() => {
    const next = itemPhotoList(item, 24);
    setPhotos(next);
    setPhotoIdx((i) => Math.min(i, Math.max(0, next.length - 1)));
  }, [item.id, item.image, item.gallery]);

  // Lazy Yupoo album fetch — the same contract PhotoCoverFlow uses, without
  // the 8-photo cap (the counter reads "1 / 14" for full albums).
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const base = itemPhotoList(item, 24);
      if (!!yupooAlbumUrl(item) && base.length < 8 && onLoadPhotos) {
        const imgs = await onLoadPhotos(item, { signal: new AbortController().signal });
        if (!cancelled) {
          setPhotos((cur) => mergeFashionImages(imgs || [], cur).slice(0, 24));
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  // ← / → page the photos. Capture phase + stopPropagation so the rack's own
  // window listener never steps the carousel behind the panel. Escape is NOT
  // handled here — the app-level handler peels this layer (and a gallery
  // dialog guard keeps it from closing under an open album view).
  const goTo = useCallback(
    (next) => {
      const clamped = Math.max(0, Math.min(photos.length - 1, next));
      setPhotoIdx(clamped);
      const track = trackRef.current;
      if (track && track.scrollTo) track.scrollTo({ left: clamped * track.clientWidth, behavior: "smooth" });
    },
    [photos.length]
  );
  useEffect(() => {
    const onKey = (e) => {
      if (e.target && e.target.closest && e.target.closest("input, textarea, [contenteditable]")) return;
      if (document.querySelector("dialog[open]")) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        e.stopPropagation();
        goTo(photoIdx - 1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        e.stopPropagation();
        goTo(photoIdx + 1);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [photoIdx, goTo]);

  // Click-away closes the ⋯ menu.
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [menuOpen]);

  const assignHaul = (name) => {
    const trimmed = String(name || "").trim();
    if (!trimmed) return;
    onSaveEdit && onSaveEdit(item.id, { project: trimmed });
    setHaulDraft("");
    setMenuOpen(false);
  };

  const price = priceLabel(item);
  const multiPhoto = photos.length > 1;
  const canAddPhoto = photos.length < PHOTO_MAX && !!onAttachPhoto;

  const pickPhotoFile = async (file) => {
    if (!file || !onAttachPhoto) return;
    setAddBusy(true);
    try {
      await onAttachPhoto(item.id, file);
    } finally {
      setAddBusy(false);
    }
  };

  return (
    <div
      className={"cz-dpanel-scrim" + (closing ? " is-closing" : "")}
      role="dialog"
      aria-modal="true"
      aria-label={item.title || "Saved item"}
      onPointerDown={(e) => {
        // Scrim tap closes; panel taps never reach here.
        if (closing) return;
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="cz-dpanel">
        <div className="cz-dpanel-left">
          <div className="cz-dpanel-stage">
            {photos.length ? (
              <div
                ref={trackRef}
                className="cz-dpanel-track"
                onScroll={(e) => {
                  const el = e.currentTarget;
                  const next = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
                  if (next !== photoIdx) setPhotoIdx(next);
                }}
              >
                {photos.map((src, i) => (
                  // A still tap opens the full-screen gallery at this photo;
                  // a moved swipe cancels the click and only pages.
                  <button
                    key={src + "-" + i}
                    type="button"
                    className="cz-dpanel-slide"
                    aria-label={"Open photo " + (i + 1) + " full screen"}
                    onClick={() => setPhotoView({ startIndex: i })}
                  >
                    <img src={src} alt={item.title || "Item photo"} draggable={false} loading="lazy" decoding="async" />
                  </button>
                ))}
              </div>
            ) : (
              // Photo-less items get the grid's brand tile, not a white void.
              <div className="cz-dpanel-slide cz-dpanel-slide-empty">
                <CoverPlaceholder
                  item={item}
                  aspectRatio="auto"
                  style={{ width: "100%", height: "100%" }}
                />
              </div>
            )}
            {multiPhoto ? (
              <span className="cz-dpanel-counter" aria-live="polite">
                {photoIdx + 1} / {photos.length}
              </span>
            ) : null}
            <FavoriteButton item={item} onToggle={onToggleFavorite} className="cz-dpanel-fav" />
            {multiPhoto ? (
              <>
                <button
                  type="button"
                  className="cz-dpanel-arrow cz-dpanel-arrow-prev"
                  aria-label="Previous photo"
                  disabled={photoIdx <= 0}
                  onClick={() => goTo(photoIdx - 1)}
                >
                  <ChevronLeft aria-hidden="true" size={22} strokeWidth={2.4} />
                </button>
                <button
                  type="button"
                  className="cz-dpanel-arrow cz-dpanel-arrow-next"
                  aria-label="Next photo"
                  disabled={photoIdx >= photos.length - 1}
                  onClick={() => goTo(photoIdx + 1)}
                >
                  <ChevronRight aria-hidden="true" size={22} strokeWidth={2.4} />
                </button>
              </>
            ) : null}
          </div>
          {/* Always show the strip so add/delete lives under the stage once —
              never next to a second PHOTOS block (Kyle 2026-07-26). */}
          <div className="cz-dpanel-thumbs">
            {photos.map((src, i) => {
              const isCover = i === 0 && item.image === src;
              return (
                <div
                  key={"thumb-" + src + "-" + i}
                  className={"cz-dpanel-thumb-wrap" + (i === photoIdx ? " is-active" : "")}
                >
                  <button
                    type="button"
                    className={"cz-dpanel-thumb" + (i === photoIdx ? " is-active" : "")}
                    aria-label={"Show photo " + (i + 1)}
                    aria-current={i === photoIdx ? "true" : undefined}
                    onClick={() => goTo(i)}
                  >
                    <img src={src} alt="" draggable="false" loading="lazy" decoding="async" />
                    {isCover ? <span className="cz-dpanel-thumb-cover">Cover</span> : null}
                  </button>
                  {/* No trash on cover — same rule as EditPhotosManager. */}
                  {!isCover && onRemovePhoto ? (
                    <button
                      type="button"
                      className="cz-dpanel-thumb-delete"
                      aria-label={"Delete photo " + (i + 1)}
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemovePhoto(item.id, src);
                      }}
                    >
                      <Trash2 size={14} strokeWidth={2.2} aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
              );
            })}
            {canAddPhoto ? (
              <button
                type="button"
                className="cz-dpanel-thumb cz-dpanel-thumb-add"
                aria-label="Add photo"
                disabled={addBusy}
                onClick={() => addInputRef.current && addInputRef.current.click()}
              >
                <Plus size={20} strokeWidth={2.2} aria-hidden="true" />
                <span>{addBusy ? "Adding…" : "Add"}</span>
              </button>
            ) : null}
            <input
              ref={addInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files && e.target.files[0];
                e.target.value = "";
                pickPhotoFile(file);
              }}
            />
          </div>
        </div>

        <div className="cz-dpanel-right">
          <div className="cz-dpanel-head">
            <div className="cz-dpanel-menu-wrap" ref={menuRef}>
              <button
                type="button"
                className="cz-dpanel-icon"
                aria-label="Card actions"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((v) => !v)}
              >
                <MoreHorizontal aria-hidden="true" size={18} strokeWidth={2.2} />
              </button>
              {menuOpen ? (
                <div className="cz-dpanel-menu" role="menu" aria-label="Card actions">
                  <div className="cz-dpanel-menu-haul">
                    <input
                      type="text"
                      value={haulDraft}
                      placeholder={item.project ? "Move to haul…" : "Add to haul…"}
                      aria-label="Haul name"
                      onChange={(e) => setHaulDraft(e.target.value)}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === "Enter") {
                          e.preventDefault();
                          assignHaul(haulDraft);
                        }
                      }}
                    />
                    {haulNames.map((name) => (
                      <button
                        key={name}
                        type="button"
                        role="menuitem"
                        className={"cz-card-action-row" + (item.project === name ? " is-current" : "")}
                        onClick={() => assignHaul(name)}
                      >
                        <span>{name}</span>
                        {item.project === name ? <span className="cz-card-action-meta">Current</span> : null}
                      </button>
                    ))}
                  </div>
                  {item.project ? (
                    <button
                      type="button"
                      role="menuitem"
                      className="cz-card-action-row"
                      onClick={() => {
                        onSaveEdit && onSaveEdit(item.id, { project: "" });
                        setMenuOpen(false);
                      }}
                    >
                      <span>Remove from haul</span>
                    </button>
                  ) : null}
                  <button
                    type="button"
                    role="menuitem"
                    className="cz-card-action-row danger"
                    onClick={() => {
                      setMenuOpen(false);
                      onClose();
                      onDelete && onDelete(item.id);
                    }}
                  >
                    <span>Remove card</span>
                  </button>
                </div>
              ) : null}
            </div>
            <button type="button" className="cz-dpanel-icon" aria-label="Close" onClick={onClose}>
              <X aria-hidden="true" size={18} strokeWidth={2.2} />
            </button>
          </div>
          <div className="cz-dpanel-body">
            <DetailBody
              item={item}
              haulNames={haulNames}
              bodyProfile={bodyProfile}
              fitPrefs={fitPrefs}
              measureUnits={measureUnits}
              buyLabel={buyLabel}
              onSaveEdit={onSaveEdit}
              onOpen={onOpen}
              onAttachPhoto={onAttachPhoto}
              onRemovePhoto={onRemovePhoto}
              onOpenSizes={onOpenSizes}
              onSetPrimaryImage={onSetPrimaryImage}
              onLoadPhotos={onLoadPhotos}
              footerPrice={price}
              hidePhotosManager
            />
          </div>
        </div>
      </div>
      {photoView ? (
        <PhotoCoverFlow
          item={item}
          images={photos}
          startIndex={photoView.startIndex}
          onClose={() => setPhotoView(null)}
          onSetPrimaryImage={onSetPrimaryImage}
          onLoadPhotos={onLoadPhotos}
        />
      ) : null}
    </div>
  );
}
