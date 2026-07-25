import { useEffect, useId, useRef } from "react";
import { DISPLAY, HAIR, SUB } from "../credenza-fashion.jsx";

export function ModalShell({ title, onClose, children, maxWidth = 720, trailing, surfaceClassName = "" }) {
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const titleId = useId();
  const triggerRef = useRef(null);

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
    requestAnimationFrame(() => closeRef.current && closeRef.current.focus());
    return () => {
      // React removes the node without close(); a modal dialog dropped while
      // open can leave the page inert on iOS (Kyle 2026-07-24: "closing stuff
      // gives me a blank screen"). Close it first so the browser unwinds the
      // top layer and any scroll lock itself.
      if (dialog && dialog.open) dialog.close();
      const trigger = triggerRef.current;
      if (trigger && typeof trigger.focus === "function") trigger.focus();
    };
  }, []);

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- backdrop click-to-close; keyboard users close via Escape (onCancel)
    <dialog
      ref={dialogRef}
      className="cz-modal"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
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
            onClick={onClose}
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
