import { useEffect, useRef, useState } from "react";
import { MoreHorizontal, Share2, X } from "lucide-react";
import DetailBody from "../components/DetailBody.jsx";
import FavoriteButton from "../components/FavoriteButton.jsx";
import { priceLabelShort, usePrefersReducedMotion } from "../credenza-fashion.jsx";
import { useBodyScrollLock } from "../components/useBodyScrollLock.js";

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
  // §3 seller cache: the whole shelf, passed straight to DetailBody so a chart
  // already read for this seller sizes this item with no network call.
  shelfItems = null,
  haulNames = [],
  bodyProfile,
  fitPrefs,
  onSaveBodyProfile = null,
  fitPromptSkipped = false,
  onSkipFitPrompt = null,
  onSaveFitPref = null,
  onCycleFitDetail = null,
  fitDetail = null,
  onToggleFitSummary = null,
  fitSummary = null,
  measureUnits = "cm",
  buyLabel = "Buy",
  // §8: the Buy notch picks the agent in place. Both must arrive together —
  // DetailBody hides the chevron when it cannot save the choice.
  preferredAgent = null,
  onSelectAgent = null,
  onSaveEdit,
  onRemove,
  onOpen,
  onAttachPhoto,
  onRemovePhoto,
  onSetCover,
  // §9: the heart joins the ⋯ / ✕ cluster on the photo. The phone had no way
  // to favourite an item from the detail at all — only from the shelf card.
  onToggleFavorite = null,
  onAttachQcPhoto = null,
  onLoadPhotos = null,
  onShareCard = null,
  onOpenSizes,
  onClose,
  // §11 photo morph: true when this sheet arrived from a card tap through a
  // view transition. The photo hero then claims the shared
  // view-transition-name and the sheet drops its own slide-up — the morph IS
  // the entrance, and playing both would slide the surface while the photo
  // inside it is still flying.
  morphing = false,
}) {
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const bodyFlushRef = useRef(null);
  const bodySnapshotRef = useRef(null);
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
    // Focus the SURFACE, not the ✕. iOS treats a programmatic focus as keyboard
    // focus, so focusing the ✕ left a dark ring on it for the life of the sheet
    // (Kyle 2026-07-28: "button on mobile for x stays highlighted a long time").
    // The surface is tabIndex=-1 and paints no ring, and a Tab from it still
    // lands on the ✕ first, so the keyboard path is unchanged.
    const id = requestAnimationFrame(() => surfaceRef.current && surfaceRef.current.focus());
    return () => {
      cancelAnimationFrame(id);
      if (dialog && dialog.open) dialog.close();
    };
  }, []);

  // Lock the page behind the sheet — a native dialog blocks taps but iOS
  // still rubber-bands the body under it. The lock is shared and
  // reference-counted: an editor modal over this sheet must not restore the
  // body while the sheet is still open.
  useBodyScrollLock();

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
        // A dismissed OS file picker fires a bubbling "cancel" on the hidden
        // <input type="file"> inside this sheet. Only the dialog's own Escape
        // closes the card. See the same guard in DesktopDetailPanel.
        if (e.target !== e.currentTarget) return;
        e.preventDefault();
        closeSheet();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) closeSheet();
      }}
    >
      <div
        ref={surfaceRef}
        tabIndex={-1}
        className={
          "cz-detail-surface" +
          (reduced ? " is-still" : "") +
          (morphing ? " is-morphing" : "")
        }
      >
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
          onToggleFitSummary={onToggleFitSummary}
          fitSummary={fitSummary}
          measureUnits={measureUnits}
          buyLabel={buyLabel}
          preferredAgent={preferredAgent}
          onSelectAgent={onSelectAgent}
          onRequestClose={closeSheet}
          onAttachQcPhoto={onAttachQcPhoto}
          // §9 footer: "price in a white hair-bordered box + the notched Buy
          // filling the rest". The price left the chip row in §1, so the
          // footer is now the only place the phone states it.
          footerPrice={priceLabelShort(item)}
          onSaveEdit={onSaveEdit}
          onOpen={onOpen}
          onAttachPhoto={onAttachPhoto}
          onRemovePhoto={onRemovePhoto}
          onOpenSizes={onOpenSizes}
          onSetPrimaryImage={onSetCover}
          onLoadPhotos={onLoadPhotos}
          heroPager
          flushRef={bodyFlushRef}
          snapshotRef={bodySnapshotRef}
          renderHeroActions={({ photos, photoIdx, resetPager }) => ({
            actions: (
              <>
                {/* §9 + Kyle 2026-08-02: one cluster in the mini-header —
                    heart, ⋯, ✕. Not on the photo (that made two close buttons
                    and left white drag space under the image). */}
                {onToggleFavorite ? (
                  <FavoriteButton
                    item={item}
                    onToggle={onToggleFavorite}
                    className="cz-detail-header-btn cz-detail-header-fav"
                  />
                ) : null}
                {/* ⋯ opens a menu — never the delete itself (Kyle 2026-07-25:
                    "the three dots simply remove the article of clothing").
                    The cover action follows the pager: swipe to a photo, then
                    make it the cover. */}
                <button
                  type="button"
                  className="cz-detail-header-btn"
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
                  className="cz-detail-header-btn"
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
                  className="cz-detail-menu-item"
                  onClick={() => {
                    if (bodyFlushRef.current) bodyFlushRef.current();
                    setMenuOpen(false);
                    if (onShareCard) {
                      onShareCard({ ...item, ...(bodySnapshotRef.current || {}) });
                    }
                  }}
                >
                  <Share2 size={16} strokeWidth={2.2} aria-hidden="true" />
                  Share card
                </button>
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
