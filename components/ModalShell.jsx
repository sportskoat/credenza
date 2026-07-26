import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { DISPLAY, HAIR, SUB } from "../credenza-fashion.jsx";

function readMs(name, fallback) {
  if (typeof window === "undefined" || !window.getComputedStyle) return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name);
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : fallback;
}

function readCloseMs() {
  return readMs("--modal-close-dur", 150);
}

/*
 * `subPage` turns the shell into a two-page stack (Kyle 2026-07-26): a
 * settings row does not open a second modal on top of the first. The same
 * modal slides sideways to the sub-page and resizes to it, and a back button
 * returns. It composes two transitions.dev primitives:
 *   - t-page-slide: page 1 exits left, page 2 enters from the right.
 *   - t-resize: the dialog tweens its max-width and the stack its height.
 *
 * Pass `subPage = { key, title, maxWidth, node }` to go forward and null to go
 * back. Set `stacked` on any shell that can hold sub-pages — the stack changes
 * the pages to absolute positioning, so it must be in place BEFORE the first
 * push or the height has nothing to tween from.
 */
export function ModalShell({
  title,
  onClose,
  children,
  maxWidth = 720,
  trailing,
  surfaceClassName = "",
  stacked = false,
  subPage = null,
  onBack,
}) {
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const titleId = useId();
  const triggerRef = useRef(null);
  const closeTimer = useRef(null);
  const [phase, setPhase] = useState("enter"); // enter | open | closing
  const reduced =
    typeof window !== "undefined" &&
    !!window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Lock the page behind the sheet. A native dialog blocks taps but iOS
  // still rubber-bands the body under it (Kyle 2026-07-25: "in the settings
  // and you swipe down, the background moves").
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    triggerRef.current = document.activeElement;
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    // Open class after paint so scale/opacity tween from the resting state.
    const openId = requestAnimationFrame(() => {
      setPhase("open");
      if (closeRef.current) closeRef.current.focus();
    });
    return () => {
      cancelAnimationFrame(openId);
      if (closeTimer.current) clearTimeout(closeTimer.current);
      // React removes the node without close(); a modal dialog dropped while
      // open can leave the page inert on iOS (Kyle 2026-07-24: "closing stuff
      // gives me a blank screen"). Close it first so the browser unwinds the
      // top layer and any scroll lock itself.
      if (dialog && dialog.open) dialog.close();
      const trigger = triggerRef.current;
      if (trigger && typeof trigger.focus === "function") trigger.focus();
    };
  }, []);

  const requestClose = useCallback(() => {
    if (phase === "closing") return;
    if (reduced) {
      onClose();
      return;
    }
    setPhase("closing");
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => {
      closeTimer.current = null;
      onClose();
    }, readCloseMs());
  }, [onClose, phase, reduced]);

  const phaseClass =
    phase === "open" ? " is-open" : phase === "closing" ? " is-closing" : "";

  // ─── Sub-page stack ───
  // `subPage` going null → set is a forward push; set → null is a back. The
  // outgoing page must stay mounted for the length of the slide, so `held`
  // keeps the last sub-page rendered until the transition ends.
  const [held, setHeld] = useState(subPage);
  const [stackH, setStackH] = useState(null);
  const page1Ref = useRef(null);
  const page2Ref = useRef(null);
  const holdTimer = useRef(null);
  const onSub = !!subPage;
  // Render the incoming sub-page in the SAME pass that sets it. Waiting for
  // the hold effect to copy it into state cost one render (~44ms measured),
  // during which the stack held the old height and then jumped. `held` still
  // covers the way back, where the outgoing page must outlive the prop.
  const shownSub = subPage || held;

  useEffect(() => {
    if (subPage) {
      if (holdTimer.current) {
        clearTimeout(holdTimer.current);
        holdTimer.current = null;
      }
      setHeld(subPage);
      return undefined;
    }
    // Going back: hold the old sub-page through the slide, then drop it.
    if (!held) return undefined;
    if (reduced) {
      setHeld(null);
      return undefined;
    }
    holdTimer.current = setTimeout(() => {
      holdTimer.current = null;
      setHeld(null);
    }, readMs("--page-slide-dur", 250) + 60);
    return () => {
      if (holdTimer.current) {
        clearTimeout(holdTimer.current);
        holdTimer.current = null;
      }
    };
    // `held` is intentionally excluded: re-running on its own change would
    // restart the hold timer forever.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subPage, reduced]);

  // The sub-page owns the header while it is up: its own title, and Back in
  // place of Close. Close stays reachable — Escape and the backdrop still work.
  // Declared above the measure effect, which reads the destination width.
  const headerTitle = onSub && subPage.title ? subPage.title : title;
  const shellMaxWidth = onSub && subPage.maxWidth ? subPage.maxWidth : maxWidth;

  // Measure the visible page and drive the stack height, so t-resize has two
  // pixel values to tween between. Layout effect: a paint at the wrong height
  // reads as a jump. jsdom reports 0 for every box — a 0 height would hide the
  // content in tests, so only a real measurement is applied.
  //
  // Measure the INNER wrapper, never the page box. The pages are absolutely
  // positioned, so a page box is sized BY the stack height — reading it back
  // returns the height just set and the stack can only ever grow.
  //
  // Measure at the FINAL width, not the live one (Kyle 2026-07-26: "it
  // stretches and locks into place a couple of times"). The dialog tweens its
  // width over 300ms. A height read mid-tween sees content wrapped to an
  // in-between width, so the target moved 4 times in one push and each move
  // restarted the height tween. Pinning the wrapper to the destination width
  // for the read gives one target, set once, before the tween starts.
  useLayoutEffect(() => {
    if (!stacked) return undefined;
    const inner = () => {
      const el = onSub ? page2Ref.current : page1Ref.current;
      return el && el.firstElementChild ? el.firstElementChild : null;
    };
    // The wrapper is inside the surface, which is inside the dialog. The
    // dialog's border box is what maxWidth caps, so subtract the surface
    // border to get the content width the wrapper will settle at.
    const finalInnerWidth = () => {
      const page = onSub ? page2Ref.current : page1Ref.current;
      const dialog = dialogRef.current;
      if (!page || !dialog || typeof window === "undefined") return null;
      const viewport = window.innerWidth || 0;
      if (!viewport) return null;
      // Mirrors .cz-modal: width: min(720px, 100% - 32px), capped by maxWidth.
      const outer = Math.min(720, viewport - 32, shellMaxWidth);
      const inset = dialog.getBoundingClientRect().width - page.clientWidth;
      const w = outer - (Number.isFinite(inset) && inset > 0 ? inset : 0);
      return w > 0 ? w : null;
    };
    const measure = () => {
      const el = inner();
      if (!el) return;
      const target = finalInnerWidth();
      // Pin, read, restore — all inside one layout pass, so nothing paints at
      // the pinned width.
      const prev = el.style.width;
      if (target != null) el.style.width = target + "px";
      const h = el.scrollHeight;
      if (target != null) el.style.width = prev;
      if (h > 0) setStackH(h);
    };
    measure();
    const el = inner();
    if (!el || typeof window === "undefined" || !window.ResizeObserver) return undefined;
    // Rows that expand in place (the fit-summary accordion) change the page
    // height without a page change; the observer keeps the stack in step.
    const ro = new window.ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [stacked, onSub, shownSub, children, shellMaxWidth]);

  const requestBack = useCallback(() => {
    if (onBack) onBack();
  }, [onBack]);

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- backdrop click-to-close; keyboard users close via Escape (onCancel)
    <dialog
      ref={dialogRef}
      className={"cz-modal t-modal" + phaseClass}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        // Escape peels one layer: a sub-page goes back to the parent page
        // first, matching the carousel's layer rule. A second Escape closes.
        if (onSub && onBack) {
          requestBack();
          return;
        }
        requestClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
      style={{ maxWidth: shellMaxWidth }}
    >
      <div className={("cz-modal-surface " + (stacked ? "cz-modal-surface-stacked " : "") + surfaceClassName).trim()}>
        <div
          className="cz-modal-header"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "14px 16px",
            borderBottom: "1px solid " + HAIR,
          }}
        >
          {onSub && (
            <button
              type="button"
              className="cz-modal-back"
              aria-label={"Back to " + title}
              onClick={requestBack}
            >
              <span aria-hidden="true">‹</span>
            </button>
          )}
          <h2
            id={titleId}
            style={{ margin: 0, flex: 1, fontFamily: DISPLAY, fontSize: 21, fontWeight: 500, lineHeight: 1.1 }}
          >
            {headerTitle}
          </h2>
          {trailing}
          <button
            ref={closeRef}
            type="button"
            className="cz-icon-button"
            aria-label={"Close " + headerTitle}
            onClick={requestClose}
            style={{
              width: 40,
              height: 40,
              border: 0,
              borderRadius: 999,
              background: "transparent",
              color: SUB,
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>
        {stacked ? (
          <div
            className="t-page-slide t-resize cz-modal-stack"
            data-page={onSub ? "2" : "1"}
            style={stackH == null ? undefined : { height: stackH }}
          >
            {/* Page 1 keeps its subtree mounted behind the sub-page: unmounting
                it would discard scroll position and any typed draft, and there
                would be nothing to slide back to. `inert` stops the hidden page
                taking focus or taps. */}
            <div
              className="t-page cz-modal-page"
              data-page-id="1"
              ref={page1Ref}
              aria-hidden={onSub || undefined}
              inert={onSub ? "" : undefined}
            >
              {/* Both pages wrap their content in one element on purpose: the
                  measure step reads this wrapper, which sizes to its content,
                  not the page box, which sizes to the stack. */}
              <div>{children}</div>
            </div>
            <div
              className="t-page cz-modal-page"
              data-page-id="2"
              ref={page2Ref}
              aria-hidden={!onSub || undefined}
              inert={!onSub ? "" : undefined}
            >
              {shownSub ? <div key={shownSub.key}>{shownSub.node}</div> : null}
            </div>
          </div>
        ) : (
          children
        )}
      </div>
    </dialog>
  );
}
