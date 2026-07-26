import { useCallback, useEffect, useId, useRef, useState } from "react";
import { DISPLAY, HAIR, SUB } from "../credenza-fashion.jsx";

function readCloseMs() {
  if (typeof window === "undefined" || !window.getComputedStyle) return 150;
  const raw = getComputedStyle(document.documentElement).getPropertyValue("--modal-close-dur");
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : 150;
}

export function ModalShell({ title, onClose, children, maxWidth = 720, trailing, surfaceClassName = "" }) {
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

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- backdrop click-to-close; keyboard users close via Escape (onCancel)
    <dialog
      ref={dialogRef}
      className={"cz-modal t-modal" + phaseClass}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        requestClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
      style={{ maxWidth }}
    >
      <div className={("cz-modal-surface " + surfaceClassName).trim()}>
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
          <h2
            id={titleId}
            style={{ margin: 0, flex: 1, fontFamily: DISPLAY, fontSize: 21, fontWeight: 500, lineHeight: 1.1 }}
          >
            {title}
          </h2>
          {trailing}
          <button
            ref={closeRef}
            type="button"
            className="cz-icon-button"
            aria-label={"Close " + title}
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
        {children}
      </div>
    </dialog>
  );
}
