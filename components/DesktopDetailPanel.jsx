// Two-column desktop detail panel (design handoff turn 4 Fix B). At ≥1024px
// the expanded card stops flipping — both faces show at once: a contain-fit
// photo stage with pager + thumb strip on the left, the shared DetailBody on
// the right. The rack keeps its frozen physics; this is only the expanded
// layer. Below 1024px the app keeps the flip card / phone sheet.
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, MoreHorizontal, Plus, Share2, Trash2, X } from "lucide-react";
import {
  RELAY_MAX,
  itemPhotoList,
  mergeFashionImages,
  priceLabel,
  yupooAlbumUrl,
} from "../credenza-fashion.jsx";
import DetailBody from "./DetailBody.jsx";
import { SellerLink } from "./CardMetaLinks.jsx";
import { CoverPlaceholder } from "./CardCover.jsx";
import FavoriteButton from "./FavoriteButton.jsx";
import PhotoCoverFlow from "./PhotoCoverFlow.jsx";
import { useBodyScrollLock } from "./useBodyScrollLock.js";

export default function DesktopDetailPanel({
  item,
  // §3 seller cache: the whole shelf, passed straight to DetailBody.
  shelfItems = null,
  haulNames = [],
  bodyProfile,
  fitPrefs = null,
  onSaveBodyProfile = null,
  fitPromptSkipped = false,
  onSkipFitPrompt = null,
  onSaveFitPref = null,
  onCycleFitDetail = null,
  fitDetail = null,
  measureUnits = "cm",
  buyLabel = "Buy",
  preferredAgent = null,
  onSelectAgent = null,
  onSaveEdit,
  onOpen,
  onAttachPhoto,
  onRemovePhoto,
  onOpenSizes,
  onSetPrimaryImage,
  onLoadPhotos,
  onToggleFavorite,
  onShareCard,
  onDelete,
  onClose,
  closing = false,
  // §11 photo morph: true when this panel arrived from a card tap through a
  // view transition. The stage then claims the shared view-transition-name so
  // the card's photo grows into it, and the right rail wipes in from the
  // photo's inner edge. False on every other open — the panel just appears.
  morphing = false,
}) {
  const [photos, setPhotos] = useState(() => itemPhotoList(item, 24));
  const [photoIdx, setPhotoIdx] = useState(0);
  // Full-screen swipe gallery at the tapped photo (the entry the flip-card
  // hero pager used to provide). photoView = { startIndex } | null.
  const [photoView, setPhotoView] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [addBusy, setAddBusy] = useState(false);
  const [logNotesEl, setLogNotesEl] = useState(null);
  const [isWide, setIsWide] = useState(
    () =>
      typeof window !== "undefined" &&
      !!window.matchMedia &&
      window.matchMedia("(min-width: 1024px)").matches
  );
  const trackRef = useRef(null);
  // True while a programmatic smooth scroll runs. The scroll handler stands
  // down for that window so it cannot overwrite the target index.
  const programmatic = useRef(false);
  const settleTimer = useRef(null);
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const bodyFlushRef = useRef(null);
  const bodySnapshotRef = useRef(null);
  const openerRef = useRef(null);
  const menuRef = useRef(null);
  const addInputRef = useRef(null);
  const PHOTO_MAX = 12;

  // Use the same native dialog lifecycle as the mobile detail sheet. The
  // browser then keeps Escape and nested modal dialogs on the correct layer.
  useEffect(() => {
    const dialog = dialogRef.current;
    openerRef.current = document.activeElement;
    if (dialog && !dialog.open) dialog.showModal();
    const id = requestAnimationFrame(() => closeRef.current && closeRef.current.focus());
    return () => {
      cancelAnimationFrame(id);
      if (dialog && dialog.open) dialog.close();
      const opener = openerRef.current;
      if (opener && opener.isConnected && typeof opener.focus === "function") {
        opener.focus({ preventScroll: true });
      }
    };
  }, []);

  // Keep the shelf fixed behind this dialog. Nested editors share the same
  // reference-counted lock, so closing one layer cannot unlock another.
  useBodyScrollLock();

  const requestClose = useCallback(
    (reason = "close") => {
      // A nested native dialog owns Escape while it is open. This guard also
      // protects synthetic events and tests that bypass the browser top layer.
      if (dialogRef.current && dialogRef.current.querySelector("dialog[open]")) return;
      if (closing) return;
      if (bodyFlushRef.current) bodyFlushRef.current();
      if (reason === "remove" && onDelete) onDelete(item.id);
      onClose();
    },
    [closing, item.id, onClose, onDelete]
  );

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = () => setIsWide(mq.matches);
    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else mq.addListener(onChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", onChange);
      else mq.removeListener(onChange);
    };
  }, []);

  // Keep the stage in sync when attach/remove rewrites the item (or a new
  // card opens). Lazy Yupoo load still extends the list below.
  useEffect(() => {
    const next = itemPhotoList(item, 24);
    setPhotos(next);
    setPhotoIdx((i) => Math.min(i, Math.max(0, next.length - 1)));
  }, [item]);

  // Lazy Yupoo album fetch — the same contract PhotoCoverFlow uses, without
  // the 8-photo cap (the counter reads "1 / 14" for full albums).
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const base = itemPhotoList(item, 24);
      // RELAY_MAX, not GALLERY_MAX — see the note in PhotoCoverFlow.
      if (!!yupooAlbumUrl(item) && base.length < RELAY_MAX && onLoadPhotos) {
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
  // Release the index lock once the track has been quiet for 120ms. Every
  // scroll event re-arms it, so the lock lasts exactly as long as the motion.
  const armSettle = useCallback(() => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      programmatic.current = false;
      settleTimer.current = null;
    }, 120);
  }, []);
  useEffect(
    () => () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
    },
    []
  );
  const goTo = useCallback(
    (next) => {
      const clamped = Math.max(0, Math.min(photos.length - 1, next));
      setPhotoIdx(clamped);
      const track = trackRef.current;
      if (track && track.scrollTo) {
        // Own the index until the smooth scroll comes to rest (Kyle 2026-07-26:
        // "the little green square around the selected photo kind of glitches
        // left to right"). The scroll handler rounds scrollLeft to an index on
        // every frame, so a smooth scroll past a midpoint made the highlight
        // flip to a neighbour and back. While this flag is set the handler
        // stands down. The scroll handler clears it once scrolling stops —
        // a fixed timer cannot, because the browser decides the duration.
        programmatic.current = true;
        armSettle();
        track.scrollTo({ left: clamped * track.clientWidth, behavior: "smooth" });
      }
    },
    [photos.length, armSettle]
  );
  useEffect(() => {
    const onKey = (e) => {
      const interactive =
        e.target &&
        e.target.closest &&
        e.target.closest(
          'button, input, textarea, select, [contenteditable], [role="listbox"], [role="menu"], [role="radiogroup"]'
        );
      if (interactive) return;
      const keyDialog = e.target && e.target.closest && e.target.closest("dialog[open]");
      if (keyDialog && keyDialog !== dialogRef.current) return;
      if (dialogRef.current && dialogRef.current.querySelector("dialog[open]")) return;
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

  const price = priceLabel(item);
  const multiPhoto = photos.length > 1;
  const canAddPhoto = photos.length < PHOTO_MAX && !!onAttachPhoto;
  // Album total beyond the thumbs already on screen. albumPhotoCount is the
  // real album size when we know it; fall back to the loaded list.
  const albumKnown = Math.max(
    typeof item.albumPhotoCount === "number" && isFinite(item.albumPhotoCount)
      ? item.albumPhotoCount
      : 0,
    photos.length
  );
  const moreCount = Math.max(0, albumKnown - photos.length);
  const categoryLabel = (item.category ? String(item.category) : "garment").toUpperCase();

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
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- native backdrop click; Escape closes through onCancel
    <dialog
      ref={dialogRef}
      className={"cz-dpanel-scrim" + (closing ? " is-closing" : "")}
      style={{ width: "auto", maxWidth: "none", height: "auto", maxHeight: "none", margin: 0, padding: 0, border: 0, color: "inherit" }}
      aria-label={item.title || "Saved item"}
      onCancel={(e) => {
        e.preventDefault();
        requestClose();
      }}
      onClick={(e) => {
        // A click on the dialog element is a click on its native backdrop.
        if (e.target === e.currentTarget) requestClose();
      }}
    >
      <div className={"cz-dpanel" + (morphing ? " is-morphing" : "")}>
        <div className="cz-dpanel-left">
          <div className="cz-dpanel-stage">
            {photos.length ? (
              <div
                ref={trackRef}
                className="cz-dpanel-track"
                onScroll={(e) => {
                  // A programmatic smooth scroll already set the index. Reading
                  // it back from the intermediate scroll positions made the
                  // thumb highlight flip to a neighbour and back. Re-arm on
                  // every event so the lock ends when the motion does.
                  if (programmatic.current) {
                    armSettle();
                    return;
                  }
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
          <div
            className="cz-dpanel-thumbs-row"
            style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, minWidth: 0 }}
          >
            <div
              className="cz-dpanel-thumbs"
              style={{ flex: "1 1 auto", minWidth: 0, marginTop: 0 }}
            >
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
            <div className="cz-dpanel-thumb-side">
              <div className="cz-dpanel-thumb-side-text">
                <span className="cz-dpanel-cat">{categoryLabel}</span>
                {moreCount > 0 ? (
                  <span className="cz-dpanel-more">{moreCount} MORE</span>
                ) : null}
              </div>
            </div>
          </div>
          {/* Album opens the full-screen pager; seller is the store link.
              Replaces the old 2-up AlbumLinksRow tiles on this panel only. */}
          <div className="cz-dpanel-meta">
            <button
              type="button"
              className="cz-dpanel-meta-album"
              onClick={() => setPhotoView({ startIndex: 0 })}
            >
              <span className="cz-dpanel-meta-name">
                {photos.length} photo{photos.length === 1 ? "" : "s"}
              </span>
              <span className="cz-dpanel-meta-kicker">ALBUM</span>
            </button>
            <span className="cz-dpanel-meta-div" aria-hidden="true" />
            <div className="cz-dpanel-meta-seller">
              <SellerLink item={item} className="cz-dpanel-meta-name" />
              <span className="cz-dpanel-meta-kicker">SELLER</span>
            </div>
          </div>
          {/* Wide screens use the spare photo-column depth for the shared
              Timeline + Notes tree; DetailBody still owns its draft writer. */}
          {isWide ? <div className="cz-dpanel-lognotes" ref={setLogNotesEl} /> : null}
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
                  <button
                    type="button"
                    role="menuitem"
                    className="cz-card-action-row"
                    onClick={() => {
                      if (bodyFlushRef.current) bodyFlushRef.current();
                      setMenuOpen(false);
                      if (onShareCard) {
                        onShareCard({ ...item, ...(bodySnapshotRef.current || {}) });
                      }
                    }}
                  >
                    <Share2 size={15} strokeWidth={2.2} aria-hidden="true" />
                    <span>Share card</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="cz-card-action-row danger"
                    onClick={() => {
                      setMenuOpen(false);
                      requestClose("remove");
                    }}
                  >
                    <Trash2 size={15} strokeWidth={2.2} aria-hidden="true" />
                    <span>Remove card</span>
                  </button>
                </div>
              ) : null}
            </div>
            <button
              ref={closeRef}
              type="button"
              className="cz-dpanel-icon"
              aria-label="Close"
              onClick={() => requestClose()}
            >
              <X aria-hidden="true" size={18} strokeWidth={2.2} />
            </button>
          </div>
          <div className="cz-dpanel-body">
            <DetailBody
              item={item}
              shelfItems={shelfItems}
              haulNames={haulNames}
              bodyProfile={bodyProfile}
              fitPrefs={fitPrefs}
              onSaveBodyProfile={onSaveBodyProfile}
              fitPromptSkipped={fitPromptSkipped}
              onSkipFitPrompt={onSkipFitPrompt}
              onSaveFitPref={onSaveFitPref}
              onCycleFitDetail={onCycleFitDetail}
              fitDetail={fitDetail}
              measureUnits={measureUnits}
              buyLabel={buyLabel}
              preferredAgent={preferredAgent}
              onSelectAgent={onSelectAgent}
              onSaveEdit={onSaveEdit}
              onOpen={onOpen}
              onAttachPhoto={onAttachPhoto}
              onRemovePhoto={onRemovePhoto}
              onOpenSizes={onOpenSizes}
              onSetPrimaryImage={onSetPrimaryImage}
              onLoadPhotos={onLoadPhotos}
              footerPrice={price}
              logNotesTarget={isWide ? logNotesEl : undefined}
              flushRef={bodyFlushRef}
              snapshotRef={bodySnapshotRef}
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
    </dialog>
  );
}
