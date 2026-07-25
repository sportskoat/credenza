import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  MoreHorizontal,
  Pen,
  RefreshCw,
} from "lucide-react";
import {
  buildEditDraft,
  buildEditPatch,
  carouselLayerZ,
  itemPhotoList,
  linkButtons,
  mergeFashionImages,
  usePrefersReducedMotion,
  useWriteThroughDraft,
  yupooAlbumUrl,
} from "../credenza-fashion.jsx";
import CardFrontInfo from "./CardFrontInfo.jsx";
import { CoverImage } from "./CardCover.jsx";
import FavoriteButton from "./FavoriteButton.jsx";
import InfoBubble from "./InfoBubble.jsx";
import DetailBody from "./DetailBody.jsx";
import ItemEditForm from "./ItemEditForm.jsx";
import MorphButton from "./MorphButton.jsx";
import PhotoCoverFlow from "./PhotoCoverFlow.jsx";
import { StatusPill } from "./atoms.jsx";

const CoverFlowCard = forwardRef(function CoverFlowCard(
  {
    item,
    expanded,
    isCenter,
    flipSignal,
    editSignal,
    haulNames = [],
    onDelete,
    onSaveEdit,
    onOpen,
    buyLabel,
    onAttachPhoto,
    onRemovePhoto,
    onToggleFavorite,
    onActivate,
    onDeactivate,
    onScrollTo,
    bodyProfile,
    measureUnits,
    onOpenSizes,
    onSetPrimaryImage,
    fitPref = null,
    reduced,
  },
  ref
) {
  const [flipped, setFlipped] = useState(false);
  const [editing, setEditing] = useState(false);
  const [ed, setEd] = useState(null);
  // false = edit sheet drops down out (back chevron); true = it slides back
  // up, the reverse of how it entered (save-check button).
  const [editExitUp, setEditExitUp] = useState(false);
  const [bubble, setBubble] = useState(null);
  // The whole exit runs in CSS on the live shell: framer's exit opacity freezes
  // on this shell, and a 0-height overflow-hidden shell still leaks ~14px into
  // the scroller's scrollHeight (one-frame snap at unmount). So closeBubble pins
  // the measured height, flips on .is-closing (fade + drift + contain: size —
  // which is why framer can't own this: size containment zeroes the box before
  // framer can measure it), transitions height to 0, then unmounts once the
  // shell is a contained 0-height box that leaves no residual scroll space.
  const [bubbleClosing, setBubbleClosing] = useState(false);
  const bubbleCloseTimer = useRef(null);
  const closeBubble = useCallback(() => {
    if (reduced) {
      setBubble(null);
      setBubbleClosing(false);
      return;
    }
    const el = bubbleRef.current;
    if (!el || bubbleClosing) {
      setBubble(null);
      return;
    }
    el.style.height = `${el.getBoundingClientRect().height}px`;
    // Force a style pass so the height transition starts from the pinned number
    // — without it the browser sees auto → 0, which is discrete (no transition).
    void el.offsetHeight;
    flushSync(() => setBubbleClosing(true));
    requestAnimationFrame(() => {
      el.style.height = "0px";
      // The shell is a flex item in a gapped column — the gap survives a
      // 0-height item and snaps shut at unmount. Collapse it alongside the
      // height so the whole close is one continuous motion.
      const gap = parseFloat(getComputedStyle(el.parentElement).rowGap) || 0;
      if (gap) el.style.marginBottom = `${-gap}px`;
    });
    bubbleCloseTimer.current = window.setTimeout(() => {
      setBubble(null);
      setBubbleClosing(false);
    }, 280);
  }, [reduced, bubbleClosing]);
  // details | actions | haul — actions/haul own the whole back face (no floating menus/prompts).
  const [backView, setBackView] = useState("details");
  const [haulDraft, setHaulDraft] = useState("");
  const bubbleRef = useRef(null);
  const rootRef = useRef(null);
  const haulInputRef = useRef(null);
  // Scroll-edge fade for the pinned Buy (CO-02): true when the back is at (or
  // too short to need) the scroll end, so the fade above Buy can drop.
  const [backAtEnd, setBackAtEnd] = useState(true);
  const backContentRef = useRef(null);
  const measureBackEnd = useCallback(() => {
    const el = backContentRef.current;
    if (!el) return;
    setBackAtEnd(el.scrollTop + el.clientHeight >= el.scrollHeight - 8);
  }, []);
  const handleBackScroll = useCallback(
    (e) => {
      const el = e.currentTarget;
      setBackAtEnd(el.scrollTop + el.clientHeight >= el.scrollHeight - 8);
    },
    []
  );
  useEffect(() => {
    measureBackEnd();
  }, [measureBackEnd, expanded, backView, editing, item.id]);

  useEffect(() => {
    setFlipped(Boolean(expanded));
    if (!expanded) {
      if (bubbleCloseTimer.current) {
        clearTimeout(bubbleCloseTimer.current);
        bubbleCloseTimer.current = null;
      }
      setEditing(false);
      setBubble(null);
      setBubbleClosing(false);
      setBackView("details");
      setHaulDraft("");
      // Closing the photo gallery restores focus to the fan. If the card then
      // unflips (arrow / space elsewhere), that focused fan is invisible but
      // still catches Space — blur it so keys go back to the active card.
      const active = document.activeElement;
      if (active && rootRef.current?.contains(active) && typeof active.blur === "function") {
        active.blur();
      }
    }
  }, [expanded]);

  useEffect(() => {
    if (bubble && bubbleRef.current) {
      bubbleRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [bubble]);

  useEffect(() => {
    if (backView === "haul" && haulInputRef.current) {
      haulInputRef.current.focus();
      haulInputRef.current.select?.();
    }
  }, [backView]);

  // Signals are one-shot commands, but they live in App state forever. A card
  // that MOUNTS while an old signal still matches its id would execute it
  // again (Kyle 2026-07-23: first card flipped on carousel entry after a
  // Space-flip earlier). Seed the ref with the current signal so only NEW
  // signals act.
  const lastFlipSignalRef = useRef(flipSignal);
  useEffect(() => {
    if (!flipSignal || flipSignal === lastFlipSignalRef.current) return;
    lastFlipSignalRef.current = flipSignal;
    if (flipSignal.startsWith(item.id + ":")) setFlipped(true);
  }, [flipSignal, item.id]);

  const lastEditSignalRef = useRef(editSignal);
  useEffect(() => {
    if (!editSignal || editSignal === lastEditSignalRef.current) return;
    lastEditSignalRef.current = editSignal;
    if (editSignal.startsWith(item.id + ":")) {
      setEd(buildEditDraft(item));
      setBubble(null);
      setBackView("details");
      setEditExitUp(false);
      setEditing(true);
    }
  }, [editSignal, item]);

  const activate = () => {
    if (!isCenter) {
      if (onScrollTo) onScrollTo(item.id);
      return;
    }
    if (onActivate) onActivate(item.id);
  };
  const deactivate = () => {
    if (onDeactivate) onDeactivate();
  };

  // Write-through commit — the edit form persists as you type, so leaving the
  // screen (back chevron, outside click, flip) never loses notes.
  const commitEditRef = useWriteThroughDraft(ed, (d) => onSaveEdit(item.id, buildEditPatch(d, item)));
  // "Saved" holds the top-right slot (same size as Save) so ⋯/pen don't jump.
  const [editSavedFlash, setEditSavedFlash] = useState(false);
  const editSavedTimer = useRef(null);
  useEffect(
    () => () => {
      if (editSavedTimer.current) clearTimeout(editSavedTimer.current);
    },
    []
  );

  const discardEdit = useCallback(() => {
    // Write-through means there's nothing to discard — flush the last keystrokes.
    // Leave via back chevron: no "Saved" hold — return ⋯/pen immediately.
    commitEditRef.current();
    setEditExitUp(false);
    setEditing(false);
    setEd(null);
    setEditSavedFlash(false);
    if (editSavedTimer.current) {
      clearTimeout(editSavedTimer.current);
      editSavedTimer.current = null;
    }
  }, [commitEditRef]);

  // Save: commit, slide edit sheet up, keep the TOP-RIGHT slot as a green
  // "Saved" pill (same size as Save) so ⋯/pen don't slam in and jump the
  // header. After a short beat, crossfade to the detail tools.
  // Enter uses this same path (handleEditKeyDown).
  const saveEditAndClose = useCallback(() => {
    commitEditRef.current();
    flushSync(() => setEditExitUp(true));
    setEditing(false);
    setEd(null);
    setEditSavedFlash(true);
    if (editSavedTimer.current) clearTimeout(editSavedTimer.current);
    editSavedTimer.current = setTimeout(() => setEditSavedFlash(false), 900);
  }, [commitEditRef]);

  const closeActions = useCallback(() => {
    setBackView("details");
    setHaulDraft("");
  }, []);

  const openActions = useCallback(() => {
    setBubble(null);
    setHaulDraft(item.project || "");
    setBackView("actions");
  }, [item.project]);

  const openHaulPicker = useCallback(() => {
    setBubble(null);
    setHaulDraft(item.project || "");
    setBackView("haul");
  }, [item.project]);

  const assignHaul = useCallback(
    (name) => {
      const next = String(name || "").trim();
      onSaveEdit?.(item.id, { project: next });
      setHaulDraft(next);
      setBackView("actions");
    },
    [item.id, onSaveEdit]
  );

  const dismissTopLayer = useCallback(() => {
    if (editing) {
      discardEdit();
      return true;
    }
    if (backView === "haul") {
      setBackView("actions");
      return true;
    }
    if (backView === "actions") {
      closeActions();
      return true;
    }
    if (bubble) {
      closeBubble();
      return true;
    }
    if (flipped) {
      onDeactivate?.();
      return true;
    }
    return false;
  }, [editing, backView, bubble, flipped, discardEdit, closeActions, closeBubble, onDeactivate]);

  useImperativeHandle(
    ref,
    () => ({
      dismissTopLayer,
      contains: (target) => Boolean(rootRef.current?.contains(target)),
    }),
    [dismissTopLayer]
  );

  const startEdit = () => {
    setEd(buildEditDraft(item));
    setBubble(null);
    setBackView("details");
    setEditExitUp(false);
    setEditSavedFlash(false);
    if (editSavedTimer.current) {
      clearTimeout(editSavedTimer.current);
      editSavedTimer.current = null;
    }
    setEditing(true);
  };

  // Enter saves from any plain field. Capture phase on the edit shell so it
  // always fires; skip open comboboxes (size picker) and bare textarea newlines.
  const handleEditKeyDown = useCallback(
    (e) => {
      if (!editing) return;
      if (e.key !== "Enter") return;
      const t = e.target;
      if (!t) return;
      // Size / haul combobox owns Enter while its menu is active.
      if (t.closest?.(".cz-combobox, .cz-combobox-menu, [role='listbox']")) return;
      if (t.getAttribute?.("role") === "combobox") return;
      const tag = (t.tagName || "").toUpperCase();
      if (tag === "TEXTAREA" && !(e.metaKey || e.ctrlKey)) return;
      // Don't steal Enter from chip/segment buttons (they toggle selection).
      if (tag === "BUTTON") return;
      if (tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT") return;
      e.preventDefault();
      e.stopPropagation();
      saveEditAndClose();
    },
    [editing, saveEditAndClose]
  );

  const knownHauls = Array.from(
    new Set(
      [...(haulNames || []), item.project || ""]
        .map((name) => String(name || "").trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b));

  // No autofocus on flip — the programmatic focus lit up the glow ring on
  // every flip, which reads as a highlight glitch, not affordance.

  // Front-facing gate, driven by the live flip rotation (true only inside the
  // front-facing 90°). The heart rides the front face — mounting it the moment
  // `flipped` goes false shows it mirrored over the back header for the first
  // half of the flip-back. The faces themselves need the same manual culling:
  // WebKit ignores backface-visibility here (confirmed 2026-07-21, Playwright
  // WebKit headed + headless) and paints the back face mirrored over the
  // front, so face visibility is gated on this rotation value too.
  const [frontFacing, setFrontFacing] = useState(!flipped);
  const frontFacingRef = useRef(!flipped);
  const handleCardRotate = useCallback((latest) => {
    const show = (parseFloat(latest.rotateY) || 0) < 90;
    if (show !== frontFacingRef.current) {
      frontFacingRef.current = show;
      setFrontFacing(show);
    }
  }, []);

  // Edit mode must NOT move the card shell (Kyle 2026-07-22). The old
  // is-editing width widen shifted the card a few px left — removed.
  // Shared padding + scrollbar-gutter: stable keep details/edit aligned.

  return (
    <div ref={rootRef} style={{ width: "100%", height: "100%", transformStyle: "preserve-3d" }}>
      <motion.div
        className={"cz-carousel-card-inner" + (flipped ? " is-flipped" : "")}
        animate={{ rotateY: flipped ? 180 : 0 }}
        onUpdate={handleCardRotate}
        transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 26 }}
        style={{
          width: "100%",
          height: "100%",
          transformStyle: "preserve-3d",
          borderRadius: 24,
        }}
      >
        {/* Front face. Visibility: state-driven at rest (WebKit ignores
            backface-visibility and would paint this mirrored over the back),
            rotation-gated mid-flip so flip-back doesn't flash it early. */}
        <div
          className="cz-carousel-face cz-carousel-front"
          style={{ visibility: !flipped || frontFacing ? "visible" : "hidden" }}
          role="button"
          tabIndex={0}
          aria-label={isCenter ? `Flip ${item.title}` : `Select ${item.title}`}
          onClick={(e) => {
            const carousel = e.currentTarget.closest(".cz-carousel");
            if (carousel && carousel.dataset.dragging === "true") {
              delete carousel.dataset.dragging;
              return;
            }
            e.stopPropagation();
            activate();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              activate();
            }
          }}
        >
          <div className="cz-carousel-image-wrap">
            <CoverImage
              item={item}
              fill
              className="cz-carousel-image"
              imgStyle={{ borderRadius: 0 }}
            />
            <StatusPill status={item.findStatus} className="cz-carousel-status" />
          </div>
          <div className="cz-carousel-front-meta">
            {/* Unified with the grid card (Kyle 2026-07-23): title → size →
                seller → green USD price text. No overlay price chip, no ¥. */}
            <h2 className="cz-carousel-title">{item.title}</h2>
            <CardFrontInfo
              item={item}
              bodyProfile={bodyProfile}
              fitPrefs={fitPref && item.category ? { [item.category]: fitPref } : null}
            />
            {(() => {
              const buy = linkButtons(item, { buyLabel }).find((b) => b.role === "buy");
              if (!buy || !isCenter) return null;
              return (
                <button
                  type="button"
                  className="cz-buy-btn cz-border-beam"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onOpen?.(item, buy.url);
                  }}
                >
                  <span className="cz-buy-btn-label">{buy.label}</span>
                  <span className="cz-border-beam-glow" aria-hidden="true" />
                </button>
              );
            })()}
            {isCenter && (
              /* Unboxed cue (Kyle 2026-07-22): text + rotating icon, no pill
                 chrome — the Buy button owns the only boxed/beam look. It's a
                 real button that runs the same activate() as the face tap. */
              <motion.button
                type="button"
                className="cz-flip-cue"
                aria-label="Flip card for details"
                initial="rest"
                animate="rest"
                whileHover="hover"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  activate();
                }}
              >
                <motion.span
                  className="cz-flip-cue-icon"
                  variants={{ rest: { rotate: 0 }, hover: { rotate: 180 } }}
                  transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 25 }}
                  aria-hidden="true"
                >
                  <RefreshCw size={13} />
                </motion.span>
                <span className="cz-flip-cue-label">Flip for more</span>
              </motion.button>
            )}
          </div>
        </div>

        {/* Heart is front-face only — gated on the live rotation so it never
            mirrors over the back header during the first half of flip-back. */}
        {frontFacing && (
          <FavoriteButton item={item} onToggle={onToggleFavorite} className="cz-card-favorite" />
        )}

        {/* Back-face clicks: interactive elements keep their own behavior and
            stay inert for navigation; INERT whitespace in details mode flips
            the card back to its front (Kyle 2026-07-22 — supersedes the old
            "all inside clicks are inert" contract). Edit/actions/bubble
            layers keep clicks inert so a stray tap never exits them. */}
        {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- flip-back affordance, keyboard uses the header back control */}
        <div
          className="cz-carousel-face cz-carousel-back"
          style={{ visibility: flipped || !frontFacing ? "visible" : "hidden" }}
          onClick={(e) => {
            const carousel = e.currentTarget.closest(".cz-carousel");
            if (carousel && carousel.dataset.dragging === "true") {
              delete carousel.dataset.dragging;
              return;
            }
            e.stopPropagation();
            if (!flipped || editing || backView !== "details" || bubble) return;
            if (e.target.closest("a, button, input, textarea, select, label, [role='button'], [contenteditable], dialog, img, .cz-corner-fan, .cz-photo-strip, .cz-sheet-pipeline, .cz-carousel-haul-block")) return;
            const sel = window.getSelection?.();
            if (sel && !sel.isCollapsed) return;
            deactivate();
          }}
        >
          <div
            className={
              "cz-carousel-back-header" +
              (editing || backView !== "details" ? " is-editing" : "")
            }
          >
            <button
              type="button"
              className="cz-icon-button cz-carousel-close"
              onClick={(e) => {
                e.stopPropagation();
                if (editing) discardEdit();
                else if (backView === "haul") setBackView("actions");
                else if (backView === "actions") closeActions();
                else if (bubble) closeBubble();
                else deactivate();
              }}
              aria-label={
                editing
                  ? "Back to card"
                  : backView === "haul"
                    ? "Back to actions"
                    : backView === "actions"
                      ? "Done with actions"
                      : bubble
                        ? "Close details"
                        : "Flip back"
              }
            >
              <ChevronLeft aria-hidden="true" size={20} strokeWidth={2.2} />
            </button>
            <span className="cz-carousel-back-spacer" aria-hidden="true" />
            {/* Fixed-width actions slot: Save → Saved → ⋯/pen crossfade.
                Never inserts a second row (that caused the header jump). */}
            <div className="cz-carousel-back-actions">
              <AnimatePresence mode="wait" initial={false}>
                {editing ? (
                  <motion.div
                    key="save"
                    className="cz-back-actions-slot"
                    initial={reduced ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={reduced ? undefined : { opacity: 0 }}
                    transition={{ duration: reduced ? 0 : 0.16 }}
                  >
                    <button
                      type="button"
                      className="cz-card-save-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        saveEditAndClose();
                      }}
                      aria-label="Save changes"
                      title="Save (Enter)"
                    >
                      <Check aria-hidden="true" size={16} strokeWidth={2.4} />
                      <span>Save</span>
                    </button>
                  </motion.div>
                ) : editSavedFlash ? (
                  <motion.div
                    key="saved"
                    className="cz-back-actions-slot"
                    initial={reduced ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={reduced ? undefined : { opacity: 0 }}
                    transition={{ duration: reduced ? 0 : 0.18 }}
                    role="status"
                    aria-live="polite"
                  >
                    <span className="cz-card-save-btn is-saved">
                      <Check aria-hidden="true" size={16} strokeWidth={2.4} />
                      <span>Saved</span>
                    </span>
                  </motion.div>
                ) : backView === "details" ? (
                  <motion.div
                    key="tools"
                    className="cz-back-actions-slot"
                    initial={reduced ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={reduced ? undefined : { opacity: 0 }}
                    transition={{ duration: reduced ? 0 : 0.16 }}
                  >
                    <button
                      type="button"
                      className={"cz-icon-button cz-card-menu-trigger" + (backView !== "details" ? " is-open" : "")}
                      aria-label="Card actions"
                      aria-expanded={false}
                      onClick={(e) => {
                        e.stopPropagation();
                        openActions();
                      }}
                    >
                      <MoreHorizontal aria-hidden="true" size={20} strokeWidth={2.2} />
                    </button>
                    <MorphButton
                      iconOnly
                      icon={Pen}
                      activeIcon={Check}
                      onClick={startEdit}
                      ariaLabel="Edit card"
                      title="Edit"
                      className="cz-card-edit-morph"
                    />
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </div>

          {/* Edit slides in from above — the reverse of the content below it. */}
          <AnimatePresence mode="wait" initial={false}>
          {editing && ed ? (
            <motion.div
              key="edit"
              className="cz-carousel-edit-shell"
              initial={reduced ? false : { opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? undefined : { opacity: 0, y: editExitUp ? -10 : 8 }}
              transition={reduced ? { duration: 0 } : { duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              onKeyDownCapture={handleEditKeyDown}
            >
            <ItemEditForm
              item={item}
              ed={ed}
              setEd={setEd}
              knownHauls={knownHauls}
              onAttachPhoto={onAttachPhoto}
              onRemovePhoto={onRemovePhoto}
            />
            <p className="cz-edit-save-hint">Enter to save · Esc to close</p>
            </motion.div>
          ) : (
            <motion.div
              key="content"
              ref={backContentRef}
              onScroll={handleBackScroll}
              className={
                "cz-carousel-back-content" + (backAtEnd ? " is-at-end" : "")
              }
              initial={reduced ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? undefined : { opacity: 0, y: -10 }}
              transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 32 }}
            >
              <AnimatePresence mode="wait" initial={false}>
                {backView === "actions" ? (
                  <motion.div
                    key="actions"
                    className="cz-card-actions-panel"
                    initial={reduced ? false : { opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduced ? undefined : { opacity: 0, y: -10 }}
                    transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 32 }}
                  >
                    <div className="cz-card-actions-heading">
                      <h3>Actions</h3>
                      {item.project ? <p className="cz-card-actions-sub">In haul · {item.project}</p> : null}
                    </div>
                    <div className="cz-card-actions-list" role="menu" aria-label="Card actions">
                      <button type="button" role="menuitem" className="cz-card-action-row" onClick={openHaulPicker}>
                        <span>{item.project ? "Move to haul" : "Add to haul"}</span>
                        <span className="cz-card-action-meta">{item.project || "Choose"}</span>
                      </button>
                      {item.project ? (
                        <button
                          type="button"
                          role="menuitem"
                          className="cz-card-action-row"
                          onClick={() => {
                            onSaveEdit?.(item.id, { project: "" });
                            setHaulDraft("");
                          }}
                        >
                          <span>Remove from haul</span>
                        </button>
                      ) : null}
                      <button
                        type="button"
                        role="menuitem"
                        className="cz-card-action-row danger"
                        onClick={() => onDelete(item.id)}
                      >
                        <span>Remove card</span>
                      </button>
                    </div>
                    <button type="button" className="cz-card-actions-done" onClick={closeActions}>
                      Done
                    </button>
                  </motion.div>
                ) : backView === "haul" ? (
                  <motion.div
                    key="haul"
                    className="cz-card-actions-panel"
                    initial={reduced ? false : { opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduced ? undefined : { opacity: 0, y: -10 }}
                    transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 32 }}
                  >
                    <div className="cz-card-actions-heading">
                      <h3>{item.project ? "Move to haul" : "Add to haul"}</h3>
                      <p className="cz-card-actions-sub">Pick an existing haul or name a new one.</p>
                    </div>
                    <label className="cz-card-haul-field">
                      <span>Haul name</span>
                      <input
                        ref={haulInputRef}
                        type="text"
                        value={haulDraft}
                        placeholder="e.g. Summer Europe"
                        onChange={(e) => setHaulDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            assignHaul(haulDraft);
                          }
                        }}
                      />
                    </label>
                    {knownHauls.length > 0 && (
                      <div className="cz-card-actions-list" role="listbox" aria-label="Existing hauls">
                        {knownHauls.map((name) => (
                          <button
                            key={name}
                            type="button"
                            role="option"
                            aria-selected={item.project === name}
                            className={"cz-card-action-row" + (item.project === name ? " is-current" : "")}
                            onClick={() => assignHaul(name)}
                          >
                            <span>{name}</span>
                            {item.project === name ? <span className="cz-card-action-meta">Current</span> : null}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="cz-card-haul-footer">
                      <button
                        type="button"
                        className="cz-card-actions-done primary"
                        onClick={() => assignHaul(haulDraft)}
                        disabled={!haulDraft.trim()}
                      >
                        Save haul
                      </button>
                      <button type="button" className="cz-card-actions-done subtle" onClick={() => setBackView("actions")}>
                        Back
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="details"
                    className="cz-card-details-panel cz-card-details-panel--sheet"
                    initial={reduced ? false : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduced ? undefined : { opacity: 0, y: -8 }}
                    transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 32 }}
                  >
                    {/* The back body IS the phone sheet body (Kyle
                        2026-07-25: "all backs of cards need to be
                        consistent — like the mobile back"). The pager has no
                        actions here: the card header already carries the
                        chevron, ⋯ and edit pen. */}
                    <DetailBody
                      item={item}
                      haulNames={knownHauls}
                      bodyProfile={bodyProfile}
                      fitPrefs={fitPref && item.category ? { [item.category]: fitPref } : null}
                      measureUnits={measureUnits}
                      buyLabel={buyLabel}
                      onSaveEdit={onSaveEdit}
                      onOpen={onOpen}
                      onAttachPhoto={onAttachPhoto}
                      onRemovePhoto={onRemovePhoto}
                      onOpenSizes={onOpenSizes}
                      heroPager
                      renderHeroActions={({ photos, photoIdx, resetPager }) => ({
                        // One-tap cover action on the desktop pager (same
                        // rule as the phone menu): it appears only when a
                        // non-cover photo is showing.
                        actions:
                          photos.length > 1 && photoIdx > 0 ? (
                            <button
                              type="button"
                              className="cz-detail-hero-btn"
                              aria-label="Make this photo the cover"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSetPrimaryImage && onSetPrimaryImage(item.id, photos[photoIdx]);
                                resetPager();
                              }}
                            >
                              <ImageIcon size={15} strokeWidth={2.2} aria-hidden="true" />
                            </button>
                          ) : null,
                        overlay: null,
                      })}
                    />

                    {/* The exit is fully CSS-driven (see closeBubble): the shell
                        stays mounted while .is-closing fades/drifts it and
                        transitions its pinned height to 0, then unmounts — one
                        continuous motion, no frozen-opacity blink, no unmount
                        scroll snap. */}
                    <AnimatePresence initial={false}>
                      {bubble && (
                        <motion.div
                          key={bubble.key}
                          ref={bubbleRef}
                          className={"cz-bubble-shell" + (bubbleClosing ? " is-closing" : "")}
                          initial={false}
                        >
                          <InfoBubble title={bubble.title} onClose={closeBubble}>
                            {bubble.content}
                          </InfoBubble>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
});

export default function CoverFlowCarousel({
  items,
  expandedId,
  selectedId,
  flipRequest,
  editRequest,
  focusSignal,
  haulNames = [],
  onDelete,
  onSaveEdit,
  onOpen,
  buyLabel,
  onSetPrimaryImage,
  onLoadPhotos,
  onAttachPhoto,
  onRemovePhoto,
  onToggleFavorite,
  onActivate,
  onDeactivate,
  onSelect,
  bodyProfile,
  measureUnits,
  fitPrefs = null,
  onOpenSizes,
  // When true, skip CoverFlow springs so a haul morph can hand off silently.
  suppressMotion = false,
}) {
  const containerRef = useRef(null);
  const [activeIndex, setActiveIndexState] = useState(0);
  const activeIndexRef = useRef(0);
  const [cardSize, setCardSize] = useState({ width: 320, height: 460 });
  const reduced = usePrefersReducedMotion();
  const [gallery, setGallery] = useState(null);
  const galleryTriggerRef = useRef(null);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const wheelAcc = useRef(0);
  const wheelTimer = useRef(null);
  const wheelLockUntil = useRef(0);
  const cardRefs = useRef(new Map());
  const outsideDismissedRef = useRef(false);
  // Wrap-around (front ↔ back of rack) takes two intentional steps: first
  // press/swipe rubber-bands with a short nudge, second within the arm window
  // commits the wrap. Mid-shelf steps stay single-action.
  const [edgeNudgeX, setEdgeNudgeX] = useState(0);
  const edgeArmRef = useRef(null); // { dir: "prev"|"next", at: number }
  const edgeNudgeBackTimer = useRef(null);
  const edgeArmExpireTimer = useRef(null);

  const dismissActiveLayer = useCallback(() => {
    const item = items[activeIndexRef.current];
    return item ? cardRefs.current.get(item.id)?.dismissTopLayer?.() === true : false;
  }, [items]);

  useEffect(() => {
    if (!expandedId || gallery) return;
    const onPointerDown = (event) => {
      if (event.button != null && event.button !== 0) return;
      const item = items[activeIndexRef.current];
      const card = item ? cardRefs.current.get(item.id) : null;
      if (!card || card.contains?.(event.target)) return;
      if (event.target.closest?.("dialog, .cz-photo-coverflow-backdrop")) return;
      if (card.dismissTopLayer?.()) {
        outsideDismissedRef.current = true;
        setTimeout(() => {
          outsideDismissedRef.current = false;
        }, 0);
      }
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [expandedId, gallery, items]);

  const setActiveIndex = useCallback((index) => {
    const next = Math.max(0, Math.min(items.length - 1, index));
    // Navigation always wins: leaving a centered card unflips it immediately
    // so arrow keys / swipes never fight a stuck flip state.
    if (next !== activeIndexRef.current && expandedId && onDeactivate) {
      onDeactivate();
    }
    // Drop focus trapped on the previous card's photo fan / back controls so
    // Space flips the new center card instead of reopening old photos.
    if (next !== activeIndexRef.current) {
      const prevItem = items[activeIndexRef.current];
      const prevCard = prevItem ? cardRefs.current.get(prevItem.id) : null;
      const active = document.activeElement;
      if (active && prevCard?.contains?.(active) && typeof active.blur === "function") {
        active.blur();
      }
      // Prefer landing focus on the stage after a step so keyboard stays live.
      // Never pull focus out of a field the user is typing in (KM-01 root
      // cause): a search keystroke reorders the list, selection follows, and
      // this focus() stole the caret mid-word — the next keys then hit the
      // global handler ("e" opened edit mode on a card).
      requestAnimationFrame(() => {
        const stage = containerRef.current;
        if (!stage || typeof stage.focus !== "function") return;
        const active = document.activeElement;
        if (stage.contains(active)) return;
        if (
          active &&
          (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable)
        )
          return;
        stage.focus({ preventScroll: true });
      });
      // Never keep an album open for a card that is no longer centered.
      setGallery((current) => (current ? null : current));
    }
    activeIndexRef.current = next;
    setActiveIndexState(next);
  }, [items, expandedId, onDeactivate]);

  // Grid tap → "open the carousel on this item" (Kyle 2026-07-22). Additive
  // only: a signal string (id:timestamp) that jumps the rack; geometry and
  // pan physics untouched. Fires on mount when the carousel remounts for the
  // viewMode switch.
  useEffect(() => {
    if (!focusSignal) return;
    const id = String(focusSignal).split(":")[0];
    const idx = items.findIndex((c) => c.id === id);
    if (idx >= 0 && idx !== activeIndexRef.current) {
      activeIndexRef.current = idx;
      setActiveIndexState(idx);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusSignal]);

  useEffect(() => {
    // Same card size for coverflow and the solo modal popup (Kyle 2026-07-23 —
    // enlarged solo cards were too big).
    const update = () => {
      const w = typeof window !== "undefined" ? window.innerWidth : 320;
      const width = w <= 480 ? w * 0.8 : Math.min(w * 0.72, 320);
      const height = w <= 480 ? 440 : 460;
      setCardSize({ width, height });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    const stage = containerRef.current?.parentElement;
    if (!stage || typeof window === "undefined" || !window.ResizeObserver) return;
    const obs = new window.ResizeObserver((entries) => {
      const cr = entries[0].contentRect;
      setStageSize({ width: cr.width, height: cr.height });
    });
    obs.observe(stage);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (items.length === 0) return;
    const expandedIdx = expandedId ? items.findIndex((i) => i.id === expandedId) : -1;
    if (expandedIdx >= 0) {
      setActiveIndex(expandedIdx);
      return;
    }
    const selectedIdx = selectedId ? items.findIndex((i) => i.id === selectedId) : -1;
    if (selectedIdx >= 0) {
      setActiveIndex(selectedIdx);
      return;
    }
    // Deleted or filtered out of the active card: stay on this index so the
    // former right neighbor becomes current. Never jump back to 0.
    const clamped = Math.min(activeIndexRef.current, items.length - 1);
    setActiveIndex(Math.max(0, clamped));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.map((i) => i.id).join(",")]);

  // Selection sync must be one-directional per event or the two effects echo
  // each other forever (select → center → select…). lastEmittedSelectRef marks
  // selection changes that originated here so the selectedId effect ignores
  // its own echo; only genuinely external selection (keyboard nav, grid view)
  // moves the carousel.
  const lastEmittedSelectRef = useRef(null);

  useEffect(() => {
    if (selectedId === lastEmittedSelectRef.current) return;
    const idx = items.findIndex((item) => item.id === selectedId);
    if (idx >= 0 && idx !== activeIndexRef.current) {
      setActiveIndex(idx);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  useEffect(() => {
    const item = items[activeIndex];
    if (item && item.id !== selectedId && onSelect) {
      lastEmittedSelectRef.current = item.id;
      onSelect(item.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex]);

  useEffect(() => {
    const item = items[activeIndex];
    if (expandedId && item && item.id !== expandedId && onDeactivate) {
      onDeactivate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex]);

  const clearEdgeArm = useCallback(() => {
    edgeArmRef.current = null;
    if (edgeNudgeBackTimer.current) {
      clearTimeout(edgeNudgeBackTimer.current);
      edgeNudgeBackTimer.current = null;
    }
    if (edgeArmExpireTimer.current) {
      clearTimeout(edgeArmExpireTimer.current);
      edgeArmExpireTimer.current = null;
    }
    setEdgeNudgeX(0);
  }, []);

  const pulseEdgeNudge = useCallback((dir) => {
    // Pull slightly against the edge so the press still feels interactive.
    const amount = dir === "prev" ? 22 : -22;
    setEdgeNudgeX(amount);
    if (edgeNudgeBackTimer.current) clearTimeout(edgeNudgeBackTimer.current);
    edgeNudgeBackTimer.current = setTimeout(() => {
      edgeNudgeBackTimer.current = null;
      setEdgeNudgeX(0);
    }, reduced ? 0 : 120);
  }, [reduced]);

  const tryEdgeStep = useCallback((dir) => {
    const len = Math.max(items.length, 1);
    if (len <= 1) return;
    const idx = activeIndexRef.current;
    const atStart = idx === 0;
    const atEnd = idx === len - 1;

    if (dir === "prev" && !atStart) {
      clearEdgeArm();
      setActiveIndex(idx - 1);
      return;
    }
    if (dir === "next" && !atEnd) {
      clearEdgeArm();
      setActiveIndex(idx + 1);
      return;
    }

    // At the edge: first attempt arms + nudges; second within the window wraps.
    const ARM_MS = 900;
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    const armed = edgeArmRef.current;
    if (armed && armed.dir === dir && now - armed.at < ARM_MS) {
      clearEdgeArm();
      if (dir === "prev") setActiveIndex(len - 1);
      else setActiveIndex(0);
      return;
    }

    edgeArmRef.current = { dir, at: now };
    pulseEdgeNudge(dir);
    if (edgeArmExpireTimer.current) clearTimeout(edgeArmExpireTimer.current);
    edgeArmExpireTimer.current = setTimeout(() => {
      edgeArmExpireTimer.current = null;
      // Only clear the arm if nothing re-armed it.
      if (edgeArmRef.current && edgeArmRef.current.at === now) {
        edgeArmRef.current = null;
      }
    }, ARM_MS);
  }, [items.length, setActiveIndex, clearEdgeArm, pulseEdgeNudge]);

  const goNext = useCallback(() => {
    tryEdgeStep("next");
  }, [tryEdgeStep]);

  const goPrev = useCallback(() => {
    tryEdgeStep("prev");
  }, [tryEdgeStep]);

  useEffect(
    () => () => {
      if (edgeNudgeBackTimer.current) clearTimeout(edgeNudgeBackTimer.current);
      if (edgeArmExpireTimer.current) clearTimeout(edgeArmExpireTimer.current);
    },
    []
  );

  const onKeyDown = useCallback((event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.target && /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
    if (event.target?.isContentEditable) return;
    // Gallery owns its keys while open: Escape (below) AND arrows — keydowns
    // from the dialog's focused button bubble through this container.
    if (event.key === "Escape") return;
    if (document.querySelector("dialog[open]")) return;
    if (suppressMotion) return;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      // Navigation always unflips first so keys never feel stuck.
      if (expandedId && onDeactivate) onDeactivate();
      goPrev();
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      if (expandedId && onDeactivate) onDeactivate();
      goNext();
    }
  }, [goPrev, goNext, expandedId, onDeactivate, suppressMotion]);

  // Window-level arrows so keys work even when the carousel isn't focused —
  // the global app handler also moves selection, but CoverFlow owns wrap/nudge.
  useEffect(() => {
    const onWindowKey = (event) => {
      if (event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.target && /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
      if (event.target?.isContentEditable) return;
      // Gallery owns arrows while open. NOTE: <dialog> has no role ATTRIBUTE,
      // so [role="dialog"] selectors never match it — must select dialog[open].
      if (document.querySelector("dialog[open]")) return;
      if (suppressMotion) return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      // Don't double-fire if the carousel element itself is already handling it.
      if (containerRef.current && containerRef.current.contains(document.activeElement)) return;
      event.preventDefault();
      if (expandedId && onDeactivate) onDeactivate();
      if (event.key === "ArrowLeft") goPrev();
      else goNext();
    };
    window.addEventListener("keydown", onWindowKey);
    return () => window.removeEventListener("keydown", onWindowKey);
  }, [goPrev, goNext, expandedId, onDeactivate, suppressMotion]);

  useEffect(() => {
    const onEscape = (event) => {
      if (event.key !== "Escape" || !expandedId || gallery) return;
      if (document.querySelector("dialog[open]")) return;
      if (dismissActiveLayer()) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("keydown", onEscape, true);
    return () => window.removeEventListener("keydown", onEscape, true);
  }, [expandedId, gallery, dismissActiveLayer]);

  const markDragging = useCallback((info) => {
    // Only mark as a drag if the pointer actually moved enough to be a swipe.
    // This prevents quick taps/clicks on side cards from being suppressed.
    if (Math.abs(info.offset.x) <= 8 && Math.abs(info.velocity.x) <= 80) return;
    const container = containerRef.current;
    if (!container) return;
    container.dataset.dragging = "true";
    if (container._dragClear) clearTimeout(container._dragClear);
    container._dragClear = setTimeout(() => {
      delete container.dataset.dragging;
    }, 50);
  }, []);

  const onPanEnd = useCallback((event, info) => {
    // Mouse needs a firmer intentional swipe than trackpad; don't let tiny
    // drags steal the card or advance the carousel.
    const threshold = cardSize.width * 0.32;
    if (info.offset.x < -threshold || info.velocity.x < -650) {
      goNext();
    } else if (info.offset.x > threshold || info.velocity.x > 650) {
      goPrev();
    }
    markDragging(info);
  }, [cardSize.width, goNext, goPrev, markDragging]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    // Trackpads fire a long tail of small deltas. Step as soon as the
    // cumulative gesture crosses the threshold, then lock briefly so one
    // flick cannot multi-page the carousel while springs settle.
    const STEP_THRESHOLD = 36;
    const LOCK_MS = 280;
    const onWheel = (event) => {
      // Off-card wheel belongs to the PAGE, not the carousel (Kyle 2026-07-22:
      // the full-width track hijacked every scroll that passed over it). No
      // preventDefault here — the gesture falls through to normal page scroll.
      if (!event.target.closest?.(".cz-carousel-card")) return;
      // Wheel over a flipped card's scrollable content must scroll that
      // content, not page the carousel — never preventDefault there.
      if (event.target.closest?.(".cz-carousel-back-content, .cz-carousel-edit, .cz-carousel-edit-shell, .cz-card-actions-panel, .cz-card-haul-field")) return;
      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      if (Math.abs(delta) < 0.5) return;
      event.preventDefault();
      const now = performance.now();
      if (now < wheelLockUntil.current) {
        wheelAcc.current = 0;
        return;
      }
      wheelAcc.current += delta;
      if (wheelAcc.current > STEP_THRESHOLD) {
        goNext();
        wheelAcc.current = 0;
        wheelLockUntil.current = now + LOCK_MS;
      } else if (wheelAcc.current < -STEP_THRESHOLD) {
        goPrev();
        wheelAcc.current = 0;
        wheelLockUntil.current = now + LOCK_MS;
      } else {
        // Quiet window: if the user stops mid-gesture without crossing the
        // threshold, drop the partial accumulation so the next flick is clean.
        if (wheelTimer.current) clearTimeout(wheelTimer.current);
        wheelTimer.current = setTimeout(() => {
          wheelTimer.current = null;
          wheelAcc.current = 0;
        }, 140);
      }
    };
    container.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      container.removeEventListener("wheel", onWheel);
      if (wheelTimer.current) clearTimeout(wheelTimer.current);
    };
  }, [goNext, goPrev]);

  const closeGallery = useCallback(() => {
    // Do NOT restore focus to the fan trigger. Space on that control opens
    // the gallery; after scroll/unflip the trigger still owns focus and Space
    // reopens the *previous* card's photos instead of flipping the active one.
    // Land keyboard focus on the carousel stage so Space/arrows hit the right card.
    galleryTriggerRef.current = null;
    setGallery(null);
    requestAnimationFrame(() => {
      const stage = containerRef.current;
      if (stage && typeof stage.focus === "function") stage.focus({ preventScroll: true });
    });
  }, []);

  const openPhotos = useCallback(async (item, triggerOrOpts) => {
    // Only the centered/active card should open the gallery. A focused fan on a
    // side card (stale after close + scroll) used to reopen the wrong album.
    const center = items[activeIndexRef.current];
    if (!center || center.id !== item.id) return;
    // A5: callers may pass an explicit image list (Warehouse QC photos) via
    // opts.images — then the Yupoo album load is skipped, so product photos
    // never leak into the QC viewer.
    const customImages =
      triggerOrOpts &&
      typeof triggerOrOpts === "object" &&
      !(triggerOrOpts instanceof Element) &&
      Array.isArray(triggerOrOpts.images)
        ? triggerOrOpts.images.filter(Boolean)
        : null;
    const seed = customImages || itemPhotoList(item, 8);
    const shouldLoad = !customImages && !!yupooAlbumUrl(item) && seed.length < 8 && !!onLoadPhotos;
    let trigger = null;
    let startIndex = 0;
    if (typeof triggerOrOpts === "number") {
      startIndex = triggerOrOpts;
    } else if (
      triggerOrOpts &&
      typeof triggerOrOpts === "object" &&
      !(triggerOrOpts instanceof Element) &&
      ("startIndex" in triggerOrOpts || "trigger" in triggerOrOpts)
    ) {
      startIndex = Number(triggerOrOpts.startIndex) || 0;
      trigger = triggerOrOpts.trigger || null;
    } else {
      trigger = triggerOrOpts || null;
    }
    startIndex = Math.max(0, Math.min(Math.max(seed.length - 1, 0), startIndex));
    galleryTriggerRef.current = trigger;
    setGallery({ item, images: seed, startIndex });
    if (!shouldLoad) return;
    const controller = new AbortController();
    const images = await onLoadPhotos(item, { signal: controller.signal });
    setGallery((current) =>
      current && current.item.id === item.id
        ? { ...current, images: mergeFashionImages(images || [], current.images).slice(0, 8) }
        : current
    );
  }, [onLoadPhotos, items]);

  if (items.length === 0) {
    return (
      <div className="cz-carousel-empty">
        <div>No cards to flip through yet.</div>
      </div>
    );
  }

  return (
    <div className="cz-carousel-stage">
      <motion.div
        className="cz-carousel"
        ref={containerRef}
        tabIndex={0}
        role="listbox"
        aria-label="Card carousel"
        aria-orientation="horizontal"
        aria-activedescendant={
          items[activeIndex] ? "card-" + items[activeIndex].id : undefined
        }
        onKeyDown={onKeyDown}
        onPanEnd={onPanEnd}
        onClick={(e) => {
          // Fallback for clicks that land on the track/container rather than a
          // transformed side-card front face (e.g. some 3D hit-testing scenarios).
          if (e.defaultPrevented) return;
          if (outsideDismissedRef.current) {
            outsideDismissedRef.current = false;
            return;
          }
          if (e.target.closest(".cz-carousel-card")) return;
          if (e.target.closest("button, a, input, textarea, [role='button']")) return;
          const box = containerRef.current?.getBoundingClientRect();
          if (!box || items.length < 2) return;
          const x = e.clientX - box.left;
          // Dead zone equals the active card width; clicks outside it navigate.
          const threshold = cardSize.width * 0.55;
          const center = box.width / 2;
          if (x < center - threshold) goPrev();
          else if (x > center + threshold) goNext();
        }}
        style={{ touchAction: "pan-y" }}
      >
        <div className="cz-carousel-track">
          {items.map((item, index) => {
            const offset = index - activeIndex;
            const abs = Math.abs(offset);
            const isPast = index < activeIndex;
            const x = offset * (cardSize.width * 0.62) + edgeNudgeX;
            const rotateY = offset === 0 ? 0 : isPast ? 38 : -38;
            const scale = 1 - Math.min(abs * 0.08, 0.22);
            const z = -Math.min(abs * 80, 240);
            // Never animate card opacity — translucent springs made the center
            // card see-through so neighbors flashed through it mid-swipe.
            // Dim sides with --cz-card-side + solid faces instead.
            const zIndex = carouselLayerZ(items.length, index, activeIndex);
            const sideAmount = Math.min(abs, 3);
            return (
              <motion.div
                key={item.id}
                className="cz-carousel-card"
                id={"card-" + item.id}
                data-foreground={String(index === activeIndex)}
                role="option"
                aria-selected={String(index === activeIndex)}
                animate={{
                  x,
                  rotateY,
                  z,
                  scale,
                }}
                transition={
                  reduced || suppressMotion
                    ? { duration: 0 }
                    : edgeNudgeX !== 0
                      // Snappier spring for the edge rubber-band press.
                      ? { type: "spring", stiffness: 520, damping: 28 }
                      : { type: "spring", stiffness: 260, damping: 28 }
                }
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  marginLeft: -cardSize.width / 2,
                  marginTop: -cardSize.height / 2,
                  transformOrigin: "center center",
                  // Snap stacking instantly; only geometry springs.
                  zIndex,
                  opacity: 1,
                  ["--cz-card-side"]: String(sideAmount),
                }}
                onClick={(e) => {
                  if (index === activeIndexRef.current) return;
                  if (e.target.closest("button, a, input, textarea, [role='button']")) return;
                  e.stopPropagation();
                  clearEdgeArm();
                  setActiveIndex(index);
                }}
                onPointerDown={(e) => {
                  if (index === activeIndexRef.current) return;
                  if (e.target.closest("button, a, input, textarea, [role='button']")) return;
                  e.stopPropagation();
                  clearEdgeArm();
                  setActiveIndex(index);
                }}
                onPointerDownCapture={(e) => {
                  if (index === activeIndexRef.current) return;
                  if (e.target.closest("button, a, input, textarea, [role='button']")) return;
                  e.stopPropagation();
                  clearEdgeArm();
                  setActiveIndex(index);
                }}
              >
                <CoverFlowCard
                  ref={(handle) => {
                    if (handle) cardRefs.current.set(item.id, handle);
                    else cardRefs.current.delete(item.id);
                  }}
                  item={item}
                  expanded={expandedId === item.id}
                  selected={index === activeIndex}
                  isCenter={index === activeIndex}
                  flipSignal={flipRequest}
                  editSignal={editRequest}
                  haulNames={haulNames}
                  onDelete={onDelete}
                  onSaveEdit={onSaveEdit}
                  onOpen={onOpen}
                  buyLabel={buyLabel}
                  onOpenPhotos={openPhotos}
                  onAttachPhoto={onAttachPhoto}
                  onRemovePhoto={onRemovePhoto}
                  onToggleFavorite={onToggleFavorite}
                  onActivate={onActivate}
                  onDeactivate={onDeactivate}
                  onScrollTo={(id) => {
                    const idx = items.findIndex((c) => c.id === id);
                    if (idx >= 0) setActiveIndex(idx);
                  }}
                  bodyProfile={bodyProfile}
                  measureUnits={measureUnits}
                  onOpenSizes={onOpenSizes}
                  onSetPrimaryImage={onSetPrimaryImage}
                  fitPref={
                    fitPrefs && item.category && fitPrefs[item.category]
                      ? fitPrefs[item.category]
                      : null
                  }
                  reduced={reduced}
                />
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* A rack of one has no navigation — the solo grid-tap overlay renders
          just the card, no chevrons or lone dot (Kyle 2026-07-22). */}
      {items.length > 1 && (
        <div className="cz-coverflow-controls" role="group" aria-label="Carousel navigation">
          <button
            type="button"
            className="cz-coverflow-arrow"
            aria-label="Previous card"
            disabled={items.length <= 1}
            onClick={goPrev}
          >
            <ChevronLeft aria-hidden="true" size={14} />
          </button>
          <div className="cz-coverflow-dots">
            {items.map((item, i) => (
              <button
                key={item.id}
                type="button"
                className={"cz-coverflow-dot" + (i === activeIndex ? " is-active" : "")}
                aria-label={"Go to " + (item.title || "card " + (i + 1))}
                aria-current={i === activeIndex ? "true" : undefined}
                onClick={() => {
                  clearEdgeArm();
                  setActiveIndex(i);
                }}
              />
            ))}
          </div>
          <button
            type="button"
            className="cz-coverflow-arrow"
            aria-label="Next card"
            disabled={items.length <= 1}
            onClick={goNext}
          >
            <ChevronRight aria-hidden="true" size={14} />
          </button>
        </div>
      )}

      {gallery && (
        <PhotoCoverFlow
          item={gallery.item}
          images={gallery.images}
          startIndex={gallery.startIndex}
          stageSize={stageSize}
          onClose={closeGallery}
          onSetPrimaryImage={onSetPrimaryImage}
          onLoadPhotos={onLoadPhotos}
        />
      )}
    </div>
  );
}
