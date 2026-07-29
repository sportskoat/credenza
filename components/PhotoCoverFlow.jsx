import { useCallback, useEffect, useRef, useState } from "react";
import { m as motion } from "framer-motion";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";
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

// Round 7 (2026-07-29, Kyle: "any way to add a magnifying glass?"). The
// enlarged view is its OWN layer: it takes every pointer event, so the
// coverflow swipe underneath never sees the drag (plan rule: a build that
// shares one drag handler between both jobs fails). Opens at "whole photo"
// scale — never cropped like the cover card's object-fit: cover — and never
// past the photo's own pixels (plan rule: stop at the natural size). Drag
// pans once the photo is bigger than the screen; pinch and double-click move
// between the two scales.
function PhotoZoomLayer({ src, onExit }) {
  const layerRef = useRef(null);
  const [natural, setNatural] = useState(null);
  const [failed, setFailed] = useState(false);
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  const pointersRef = useRef(new Map());
  const gestureRef = useRef(null);

  // The fit scale shows the whole photo inside the layer, capped at the
  // natural size so a small photo is never upscaled past its own detail.
  const fitScale = useCallback(() => {
    const layer = layerRef.current;
    if (!layer || !natural || !natural.w || !natural.h) return 1;
    return Math.min(layer.clientWidth / natural.w, layer.clientHeight / natural.h, 1);
  }, [natural]);

  const clampView = useCallback((scale, x, y) => {
    const layer = layerRef.current;
    if (!layer || !natural) return { scale, x: 0, y: 0 };
    const maxX = Math.max(0, (natural.w * scale - layer.clientWidth) / 2);
    const maxY = Math.max(0, (natural.h * scale - layer.clientHeight) / 2);
    return {
      scale,
      x: Math.min(maxX, Math.max(-maxX, x)),
      y: Math.min(maxY, Math.max(-maxY, y)),
    };
  }, [natural]);

  const onLoad = (e) => {
    const img = e.currentTarget;
    if (!img.naturalWidth || !img.naturalHeight) {
      setFailed(true);
      return;
    }
    setNatural({ w: img.naturalWidth, h: img.naturalHeight });
  };

  // Enter at the whole-photo fit once the natural size is known.
  useEffect(() => {
    if (!natural) return;
    setView(clampView(fitScale(), 0, 0));
  }, [natural, fitScale, clampView]);

  // A photo that failed to load must not enlarge (plan rule 4) — leave.
  useEffect(() => {
    if (failed) onExit();
  }, [failed, onExit]);

  const onPointerDown = (e) => {
    if (!natural) return;
    e.preventDefault();
    try {
      layerRef.current?.setPointerCapture?.(e.pointerId);
    } catch {
      // Synthetic or already-released pointers have no capture to take.
    }
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size === 2) {
      const [a, b] = [...pointersRef.current.values()];
      gestureRef.current = {
        mode: "pinch",
        startDist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
        startScale: view.scale,
        startX: view.x,
        startY: view.y,
        midX: (a.x + b.x) / 2,
        midY: (a.y + b.y) / 2,
      };
    } else {
      gestureRef.current = { mode: "pan", startX: view.x, startY: view.y, px: e.clientX, py: e.clientY };
    }
  };

  const onPointerMove = (e) => {
    const g = gestureRef.current;
    if (!g || !pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (g.mode === "pinch" && pointersRef.current.size >= 2) {
      const [a, b] = [...pointersRef.current.values()];
      const dist = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
      const scale = Math.min(1, Math.max(fitScale(), g.startScale * (dist / g.startDist)));
      // The pinch midpoint drags the photo too, so the detail under the
      // fingers stays under the fingers.
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      setView(clampView(scale, g.startX + (mx - g.midX), g.startY + (my - g.midY)));
    } else if (g.mode === "pan") {
      setView(clampView(view.scale, g.startX + (e.clientX - g.px), g.startY + (e.clientY - g.py)));
    }
  };

  const onPointerUp = (e) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size === 1) {
      // Dropping from two fingers to one restarts the pan from here, so the
      // photo does not jump back to the one-finger start point.
      const [p] = [...pointersRef.current.values()];
      gestureRef.current = { mode: "pan", startX: view.x, startY: view.y, px: p.x, py: p.y };
    } else if (pointersRef.current.size === 0) {
      gestureRef.current = null;
    }
  };

  // Double-click (or double-tap) toggles between the whole-photo fit and the
  // natural size. A photo with no extra detail stays at the fit.
  const onDoubleClick = () => {
    if (!natural) return;
    const fit = fitScale();
    setView(view.scale >= 0.999 ? clampView(fit, 0, 0) : clampView(1, view.x, view.y));
  };

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- pointer-drag pan layer; keyboard exit is Escape on the parent
    <div
      ref={layerRef}
      className="cz-photo-coverflow-zoom"
      role="dialog"
      aria-label="Enlarged photo"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={onDoubleClick}
    >
      <img
        src={src}
        alt="Enlarged album photo"
        draggable={false}
        onLoad={onLoad}
        onError={() => setFailed(true)}
        style={
          natural
            ? {
                width: natural.w,
                height: natural.h,
                transform: `translate(-50%, -50%) translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
              }
            : { opacity: 0 }
        }
      />
      <button
        type="button"
        className="cz-photo-coverflow-zoom-exit"
        aria-label="Close enlarged photo"
        onClick={onExit}
      >
        <ZoomOut aria-hidden="true" size={18} strokeWidth={2.2} />
      </button>
    </div>
  );
}

export default function PhotoCoverFlow({ item, images, startIndex, onClose, onSetPrimaryImage, onRemovePhoto, onLoadPhotos }) {
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
  const canDelete = typeof onRemovePhoto === "function";
  // A tap on a photo opens it here, and the open photo offers both actions
  // (Kyle 2026-07-28: "a modal that says 'Delete' or 'Make as cover photo'").
  // Delete asks first, in place. It is the one action nothing undoes, and the
  // photo is already full screen, so a second window would only hide it.
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Round 7: the enlarged layer, and the photos that failed to load (a
  // broken photo must not enlarge — plan rule 4).
  const [zoomOpen, setZoomOpen] = useState(false);
  const [brokenSrcs, setBrokenSrcs] = useState(() => new Set());

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
    const h = typeof window !== "undefined" ? window.innerHeight : 400;
    // Round 5 point 5.8 (2026-07-29, Kyle: "make the photos here bigger").
    // Size from the window HEIGHT first — the photo is 3 wide by 4 tall, so
    // the height decides the width. The old 300px cap made the full-screen
    // viewer no bigger than the detail panel. Keep the CSS card width in
    // step with this math (credenza-fashion.css, .cz-photo-coverflow-card).
    const maxHeight = Math.min(h * 0.72, 900);
    const byHeight = maxHeight * 0.75;
    const byWidth = w <= 480 ? w * 0.82 : w * 0.42;
    const width = Math.max(300, Math.min(byHeight, byWidth));
    setCardSize({ width, height: width * (4 / 3) });
  }, []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const load = async () => {
      // Clear stale state before the next item decides whether it needs a request.
      setLoading(false);
      // RELAY_MAX, not GALLERY_MAX: six relayed photos is a full album fetch,
      // so asking again only makes a round trip that returns the same six.
      // Use the prop list so a same-id image refresh gates the request without
      // waiting for the synchronization effect.
      const base = Array.isArray(images) ? images : [];
      if (base.length < RELAY_MAX && onLoadPhotos && yupooAlbumUrl(item)) {
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
        // Escape closes the enlarged layer first, then the viewer (plan rule 3).
        if (zoomOpen) setZoomOpen(false);
        else requestClose();
      } else if (e.key === "ArrowLeft") {
        if (zoomOpen) return;
        e.preventDefault();
        setActiveIndex((i) => Math.max(0, i - 1));
      } else if (e.key === "ArrowRight") {
        if (zoomOpen) return;
        e.preventDefault();
        setActiveIndex((i) => Math.min(loadedImages.length - 1, i + 1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [loadedImages.length, requestClose, zoomOpen]);

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
    // While the enlarged layer is open the swipe belongs to it, not the album
    // (round 7: one drag handler must not serve both jobs).
    if (zoomOpen) return;
    const threshold = cardSize.width * 0.25;
    if (info.offset.x < -threshold || info.velocity.x < -500) goNext();
    else if (info.offset.x > threshold || info.velocity.x > 500) goPrev();
    markDragging(info);
  }, [cardSize.width, goNext, goPrev, zoomOpen]);

  const isDragClick = () => containerRef.current?.dataset.dragging === "true";

  const setCover = () => {
    if (!canSetCover) return;
    onSetPrimaryImage(item.id, loadedImages[activeIndex]);
    requestClose();
  };

  // Delete the photo on screen. The view stays open on the neighbour so a
  // customer can clear several photos in one visit; the last one closes it.
  const deletePhoto = () => {
    if (!canDelete) return;
    const src = loadedImages[activeIndex];
    if (!src) return;
    setConfirmDelete(false);
    onRemovePhoto(item.id, src);
    const rest = loadedImages.filter((s) => s !== src);
    setLoadedImages(rest);
    setActiveIndex((i) => clampIndex(i, rest.length));
    if (!rest.length) requestClose();
  };

  // Any move off this photo drops a pending confirmation. The question named
  // the photo you were looking at, so it must not follow you to the next one.
  useEffect(() => setConfirmDelete(false), [activeIndex, item.id]);

  // The enlarged layer belongs to one photo; a photo or item change closes it.
  useEffect(() => setZoomOpen(false), [activeIndex, item.id]);

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
                  <img
                    src={src}
                    alt={"Album photo " + (index + 1)}
                    draggable={false}
                    loading="lazy"
                    decoding="async"
                    onError={() =>
                      setBrokenSrcs((cur) => (cur.has(src) ? cur : new Set(cur).add(src)))
                    }
                  />
                  {/* Round 7: the magnifying glass sits on the active photo only,
                      and only when the photo loaded (plan rule 4). */}
                  {offset === 0 && !brokenSrcs.has(src) ? (
                    <button
                      type="button"
                      className="cz-photo-coverflow-zoom-btn"
                      aria-label="Enlarge photo"
                      onClick={(e) => {
                        e.stopPropagation();
                        setZoomOpen(true);
                      }}
                    >
                      <ZoomIn aria-hidden="true" size={18} strokeWidth={2.2} />
                    </button>
                  ) : null}
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
          {confirmDelete ? (
            <>
              <span className="cz-photo-coverflow-ask">Delete this photo?</span>
              <button className="cz-photo-coverflow-wide" onClick={() => setConfirmDelete(false)}>
                Keep
              </button>
              <button className="cz-photo-coverflow-wide is-danger" onClick={deletePhoto}>
                Delete
              </button>
            </>
          ) : (
            <>
              {canDelete ? (
                <button className="cz-photo-coverflow-wide" onClick={() => setConfirmDelete(true)}>
                  Delete
                </button>
              ) : null}
              {canSetCover ? (
                <button className="primary" onClick={setCover}>
                  Make cover photo
                </button>
              ) : null}
            </>
          )}
        </div>
        {loading && <div style={{ color: "var(--cz-sub)", fontSize: 12 }}>Loading album…</div>}
        {/* Round 7: the enlarged layer renders last so it takes every pointer
            event above the stage, the arrows, and the controls. */}
        {zoomOpen && loadedImages[safeIndex] ? (
          <PhotoZoomLayer src={loadedImages[safeIndex]} onExit={() => setZoomOpen(false)} />
        ) : null}
      </div>
    </dialog>
  );
}
