import { useEffect, useRef, useState } from "react";
import { MoreHorizontal, X } from "lucide-react";
import DetailBody from "../components/DetailBody.jsx";
import { usePrefersReducedMotion } from "../credenza-fashion.jsx";

// Mobile detail sheet (mobile shelf handoff step 5, 2026-07-25).
//
// This file is the SHELL only: native dialog, swipe-down grip, and the
// hero's shell chrome (close button, ⋯ menu). Every piece of body content —
// photo pager, title, spec cells, fit block, status, notes, photos, buy —
// lives in components/DetailBody.jsx so the desktop carousel card back
// renders the exact same body (Kyle 2026-07-25: "all backs of cards need to
// be consistent — like the mobile back").
//
// There is no edit mode and no Save button: every value is its own tap
// target, the tap opens exactly one editor, and the edit writes through the
// shared 600ms debounce. The "Saved" chip is the only save feedback.

export default function DetailSheet({
  item,
  haulNames = [],
  bodyProfile,
  fitPrefs,
  measureUnits = "cm",
  buyLabel = "Buy",
  onSaveEdit,
  onRemove,
  onOpen,
  onAttachPhoto,
  onRemovePhoto,
  onSetCover,
  onOpenSizes,
  onClose,
}) {
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const bodyFlushRef = useRef(null);
  const reduced = usePrefersReducedMotion();

  const [menuOpen, setMenuOpen] = useState(false);
  const surfaceRef = useRef(null);
  const gripDrag = useRef(null);

  // Native dialog for the scrim, Escape and the top layer. Closing it before
  // React drops the node keeps iOS from leaving the page inert (Kyle
  // 2026-07-24: "closing stuff gives me a blank screen").
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    const id = requestAnimationFrame(() => closeRef.current && closeRef.current.focus());
    return () => {
      cancelAnimationFrame(id);
      if (dialog && dialog.open) dialog.close();
    };
  }, []);

  // Lock the page behind the sheet — a native dialog blocks taps but iOS
  // still rubber-bands the body under it.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const closeSheet = () => {
    // Flush any pending write-through edit before the sheet unmounts.
    if (bodyFlushRef.current) bodyFlushRef.current();
    onClose();
  };

  // Swipe-down on the grip closes the sheet (Kyle 2026-07-25: "swiping down
  // on a card should take you back to the shelf"). The enter animation fills
  // FORWARDS, so its final translateY(0) keyframe outranks an inline drag
  // transform — clear the animation the moment a drag starts. Scoped to the
  // grip on purpose: a pull anywhere else fights the scroll rubber-band.
  const onGripTouchStart = (e) => {
    gripDrag.current = { y: e.touches[0].clientY, dy: 0 };
    const s = surfaceRef.current;
    if (s) {
      s.style.animation = "none";
      s.style.transition = "none";
    }
  };
  const onGripTouchMove = (e) => {
    const d = gripDrag.current;
    const s = surfaceRef.current;
    if (!d || !s) return;
    d.dy = Math.max(0, e.touches[0].clientY - d.y);
    s.style.transform = "translateY(" + d.dy + "px)";
  };
  const onGripTouchEnd = () => {
    const d = gripDrag.current;
    gripDrag.current = null;
    const s = surfaceRef.current;
    if (!d || !s) return;
    if (d.dy > 110) {
      s.style.transition = "transform 180ms ease-in";
      s.style.transform = "translateY(102%)";
      setTimeout(closeSheet, 170);
    } else {
      s.style.transition = "transform 200ms ease-out";
      s.style.transform = "";
      setTimeout(() => {
        if (s) s.style.transition = "";
      }, 220);
    }
  };

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- backdrop tap closes; keyboard closes via Escape (onCancel)
    <dialog
      ref={dialogRef}
      className="cz-modal cz-detail-modal"
      aria-label={item.title || "Saved item"}
      onCancel={(e) => {
        e.preventDefault();
        closeSheet();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) closeSheet();
      }}
    >
      <div ref={surfaceRef} className={"cz-detail-surface" + (reduced ? " is-still" : "")}>
        <div
          className="cz-detail-grip"
          aria-hidden="true"
          onTouchStart={onGripTouchStart}
          onTouchMove={onGripTouchMove}
          onTouchEnd={onGripTouchEnd}
          onTouchCancel={onGripTouchEnd}
        >
          <span />
        </div>

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
          heroPager
          flushRef={bodyFlushRef}
          renderHeroActions={({ photos, photoIdx, resetPager }) => ({
            actions: (
              <>
                {/* ⋯ opens a menu — never the delete itself (Kyle 2026-07-25:
                    "the three dots simply remove the article of clothing").
                    The cover action follows the pager: swipe to a photo, then
                    make it the cover. */}
                <button
                  type="button"
                  className="cz-detail-hero-btn"
                  aria-label="More actions"
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  onClick={() => setMenuOpen((v) => !v)}
                >
                  <MoreHorizontal size={17} strokeWidth={2.4} aria-hidden="true" />
                </button>
                <button
                  ref={closeRef}
                  type="button"
                  className="cz-detail-hero-btn"
                  aria-label="Close"
                  onClick={closeSheet}
                >
                  <X size={16} strokeWidth={2.4} aria-hidden="true" />
                </button>
              </>
            ),
            overlay: menuOpen ? (
              <div className="cz-detail-menu" role="menu">
                {photos.length > 1 && photoIdx > 0 ? (
                  <button
                    type="button"
                    role="menuitem"
                    className="cz-detail-menu-item"
                    onClick={() => {
                      onSetCover && onSetCover(item.id, photos[photoIdx]);
                      resetPager();
                      setMenuOpen(false);
                    }}
                  >
                    Make this photo the cover
                  </button>
                ) : null}
                <button
                  type="button"
                  role="menuitem"
                  className="cz-detail-menu-item is-danger"
                  onClick={() => {
                    setMenuOpen(false);
                    onRemove(item.id);
                    onClose();
                  }}
                >
                  Remove from shelf
                </button>
              </div>
            ) : null,
          })}
        />
      </div>
    </dialog>
  );
}
