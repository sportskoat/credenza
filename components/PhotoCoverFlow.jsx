import { useCallback, useEffect, useRef, useState } from "react";
import { m as motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  GALLERY_MAX,
  RELAY_MAX,
  mergeFashionImages,
  usePrefersReducedMotion,
  yupooAlbumUrl,
} from "../credenza-fashion.jsx";

function clampIndex(index, length) {
  if (length <= 0) return 0;
  return Math.min(Math.max(0, index || 0), length - 1);
}

export default function PhotoCoverFlow({ item, images, startIndex, onClose, onSetPrimaryImage, onLoadPhotos }) {
  const [activeIndex, setActiveIndex] = useState(() => clampIndex(startIndex, (images || []).length));
  const closingRef = useRef(false);
  const [loadedImages, setLoadedImages] = useState(() => (Array.isArray(images) ? images : []));
  const [loading, setLoading] = useState(false);
  const reduced = usePrefersReducedMotion();
  const containerRef = useRef(null);
  const closeRef = useRef(null);
  const dialogRef = useRef(null);
  const [cardSize, setCardSize] = useState({ width: 300, height: 400 });
  const canSetCover = typeof onSetPrimaryImage === "function";

  useEffect(() => {
    // Native <dialog>.showModal() puts the gallery in the browser top layer
    // above any open sheet (fixed z-index cannot beat a modal dialog).
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    const t = setTimeout(() => closeRef.current?.focus(), 0);
    return () => {
      clearTimeout(t);
      // Close the dialog before React drops the node (Kyle 2026-07-26: "the
      // exit-out buttons when you're in the photos section love to just stick
      // around and not do anything"). React removes the element without ever
      // calling close(), so the browser keeps the stale dialog in the TOP
      // LAYER: it still paints above everything, but its React handlers are
      // gone, so every click on the ✕ does nothing. ModalShell already carries
      // this exact fix (Kyle 2026-07-24: "closing stuff gives me a blank
      // screen"); the gallery never got it.
      if (dialog && dialog.open) dialog.close();
    };
  }, []);

  // Keep local image state in sync when the parent swaps the item or gallery.
  useEffect(() => {
    setLoadedImages(Array.isArray(images) ? images : []);
  }, [item.id, images]);

  // Re-anchor when the open index or item changes. Clamp against the prop list
  // so a same-render item swap does not use the previous item's length.
  useEffect(() => {
    setActiveIndex(clampIndex(startIndex, (Array.isArray(images) ? images : []).length));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- images length only for clamp on item/start
  }, [item.id, startIndex]);

  // After merges or prop shrinks, keep the active index inside the list.
  useEffect(() => {
    setActiveIndex((i) => clampIndex(i, loadedImages.length));
  }, [loadedImages.length]);

  // One close per open. A second click while the parent is still unmounting
  // used to re-enter onClose and fight the teardown.
  const requestClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    const dialog = dialogRef.current;
    if (dialog && dialog.open) dialog.close();
    onClose();
  }, [onClose]);

  useEffect(() => {
    const w = typeof window !== "undefined" ? window.innerWidth : 300;
    const width = w <= 480 ? w * 0.74 : Math.min(w * 0.7, 300);
    const height = width * (4 / 3);
    setCardSize({ width, height });
  }, []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const load = async () => {
      // RELAY_MAX, not GALLERY_MAX: six relayed photos is a full album fetch,
      // so asking again only makes a round trip that returns the same six.
      // Use the prop list length so a same-id images refresh still gates
      // correctly without waiting for the sync effect.
      const baseLen = Array.isArray(images) ? images.length : 0;
      if (!yupooAlbumUrl(item) || baseLen >= RELAY_MAX || !onLoadPhotos) return;
      setLoading(true);
      try {
        const imgs = await onLoadPhotos(item, { signal: controller.signal });
        if (cancelled || controller.signal.aborted) return;
        setLoadedImages((cur) => mergeFashionImages(imgs || [], cur).slice(0, GALLERY_MAX));
      } catch {
        // Abort and network rejection both land here; ignore stale outcomes.
      } finally {
        // Always clear loading for this request while it is still current.
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        requestClose();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(0, i - 1));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(loadedImages.length - 1, i + 1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [loadedImages.length, requestClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const goNext = useCallback(() => setActiveIndex((i) => Math.min(loadedImages.length - 1, i + 1)), [loadedImages.length]);
  const goPrev = useCallback(() => setActiveIndex((i) => Math.max(0, i - 1)), []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const wheelAcc = { current: 0 };
    let wheelTimer = null;
    const onWheel = (event) => {
      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      if (Math.abs(delta) < 1) return;
      event.preventDefault();
      wheelAcc.current += delta;
      if (wheelTimer) clearTimeout(wheelTimer);
      wheelTimer = setTimeout(() => {
        if (wheelAcc.current > 40) goNext();
        else if (wheelAcc.current < -40) goPrev();
        wheelAcc.current = 0;
      }, 110);
    };
    container.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      container.removeEventListener("wheel", onWheel);
      if (wheelTimer) clearTimeout(wheelTimer);
    };
  }, [goNext, goPrev]);

  const markDragging = (info) => {
    if (Math.abs(info.offset.x) <= 4 && Math.abs(info.velocity.x) <= 50) return;
    const container = containerRef.current;
    if (!container) return;
    container.dataset.dragging = "true";
    if (container._dragClear) clearTimeout(container._dragClear);
    container._dragClear = setTimeout(() => delete container.dataset.dragging, 50);
  };

  const onPanEnd = useCallback((event, info) => {
    const threshold = cardSize.width * 0.25;
    if (info.offset.x < -threshold || info.velocity.x < -500) goNext();
    else if (info.offset.x > threshold || info.velocity.x > 500) goPrev();
    markDragging(info);
  }, [cardSize.width, goNext, goPrev]);

  const isDragClick = () => containerRef.current?.dataset.dragging === "true";

  const setCover = () => {
    if (!canSetCover) return;
    onSetPrimaryImage(item.id, loadedImages[activeIndex]);
    requestClose();
  };

  if (loadedImages.length === 0 && !loading) {
    return (
      // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- backdrop click + Escape close
      <dialog
        ref={dialogRef}
        className="cz-photo-coverflow-backdrop"
        aria-label="Album photo preview"
        onCancel={(e) => {
          e.preventDefault();
          requestClose();
        }}
        onClick={(e) => e.target === e.currentTarget && requestClose()}
      >
        <div className="cz-photo-coverflow">
          <button className="cz-photo-coverflow-close" ref={closeRef} onClick={requestClose} aria-label="Close photo preview">✕</button>
          <div style={{ color: "var(--cz-sub)" }}>No photos loaded.</div>
        </div>
      </dialog>
    );
  }

  const multiPhoto = loadedImages.length > 1;
  const safeIndex = clampIndex(activeIndex, loadedImages.length);

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- backdrop click + Escape close
    <dialog
      ref={dialogRef}
      className="cz-photo-coverflow-backdrop"
      aria-modal="true"
      aria-label="Album photo preview"
      onCancel={(e) => {
        e.preventDefault();
        requestClose();
      }}
      onClick={(e) => e.target === e.currentTarget && requestClose()}
    >
      <div className="cz-photo-coverflow">
        <button className="cz-photo-coverflow-close" ref={closeRef} onClick={requestClose} aria-label="Close photo preview">✕</button>
        <motion.div
          className="cz-photo-coverflow-stage"
          ref={containerRef}
          onPan={(_event, info) => markDragging(info)}
          onPanEnd={onPanEnd}
        >
          <div className="cz-photo-coverflow-track">
            {loadedImages.map((src, index) => {
              const offset = index - safeIndex;
              const abs = Math.abs(offset);
              const isPast = index < safeIndex;
              const x = offset * (cardSize.width * 0.55);
              const rotateY = offset === 0 ? 0 : isPast ? 35 : -35;
              const scale = 1 - Math.min(abs * 0.08, 0.22);
              const z = -Math.min(abs * 70, 210);
              const opacity = abs > 3 ? 0 : Math.max(0.5, 1 - abs * 0.2);
              return (
                <motion.div
                  key={src + index}
                  className="cz-photo-coverflow-card"
                  initial={false}
                  animate={{ x, rotateY, z, scale, opacity }}
                  transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 240, damping: 26 }}
                  style={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    marginLeft: -cardSize.width / 2,
                    marginTop: -cardSize.height / 2,
                    zIndex: 100 - abs,
                  }}
                  onClick={() => {
                    if (isDragClick()) {
                      delete containerRef.current.dataset.dragging;
                      return;
                    }
                    setActiveIndex(index);
                  }}
                >
                  <img src={src} alt={"Album photo " + (index + 1)} draggable={false} loading="lazy" decoding="async" />
                </motion.div>
              );
            })}
          </div>
          {/* Frosted chevrons flanking the active photo — hidden for single-photo albums. */}
          {multiPhoto && (
            <>
              <button
                type="button"
                className="cz-photo-coverflow-nav cz-photo-coverflow-nav-prev"
                aria-label="Previous photo"
                disabled={safeIndex <= 0}
                onClick={(e) => {
                  e.stopPropagation();
                  goPrev();
                }}
              >
                <ChevronLeft aria-hidden="true" size={20} strokeWidth={2.2} />
              </button>
              <button
                type="button"
                className="cz-photo-coverflow-nav cz-photo-coverflow-nav-next"
                aria-label="Next photo"
                disabled={safeIndex >= loadedImages.length - 1}
                onClick={(e) => {
                  e.stopPropagation();
                  goNext();
                }}
              >
                <ChevronRight aria-hidden="true" size={20} strokeWidth={2.2} />
              </button>
            </>
          )}
        </motion.div>
        {/* One caption for the active photo — outside card overflow:hidden. */}
        {item.title ? (
          <div
            className="cz-photo-coverflow-caption"
            style={{
              position: "static",
              bottom: "auto",
              left: "auto",
              transform: "none",
              textAlign: "center",
              marginTop: 6,
            }}
          >
            {item.title}
          </div>
        ) : null}
        <div className="cz-photo-coverflow-controls">
          {multiPhoto && (
            <span className="cz-photo-coverflow-counter" aria-live="polite">
              {safeIndex + 1} / {loadedImages.length}
            </span>
          )}
          {canSetCover ? (
            <button className="primary" onClick={setCover}>
              Use as cover
            </button>
          ) : null}
        </div>
        {loading && <div style={{ color: "var(--cz-sub)", fontSize: 12 }}>Loading album…</div>}
      </div>
    </dialog>
  );
}
