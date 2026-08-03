import { useEffect, useMemo, useRef } from "react";
import { Check, ChevronLeft } from "lucide-react";
import { trackingView } from "../haul-fulfillment.js";

/* ═══════════════════════════════════════════════════════════════════════════
   HaulTracking — haul handoff README, screen 10 and 11.

   Where a haul sits longest. Credenza never polls a carrier and never asks an
   agent's site for a status, so every step on this screen is the person's own
   hand marking what already happened. The sub-line says exactly that.

   Three things earn their place here:

     Every step stays tappable, in both directions. A step marked early is a
     lie the app would otherwise make permanent, and a person who marks the
     wrong parcel has to be able to take it back.

     The landed total changes what it claims when the box arrives. Before that
     it is a projection, because duty is charged on arrival. After it, it is
     the answer to the only question anyone asks about a haul.

     Reaching "Received" opens the fit questions. This is the one place the app
     asks how a size call turned out, and the answer is what makes the next
     recommendation better than a guess.
   ═══════════════════════════════════════════════════════════════════════════ */

export default function HaulTracking({
  // The haul's items, already shaped by toHaulItem.
  items = [],
  // The parcel arithmetic, already worked out by the screen behind this one.
  maths = null,
  line = "EMS",
  domesticUsd = 18.4,
  milestone = 0,
  // Four slots, one per step, holding when the person marked it.
  stamps = [],
  // { [itemId]: "tight" | "right" | "roomy" }
  fits = {},
  tracking = "",
  // (item) -> { image, tint }, for the fit-row tiles.
  tileFor,
  onClose,
  // (index) — marks the parcel at that step.
  onPickStep,
  // (value) — saves the tracking number.
  onSetTracking,
  // (id, answer) — saves how one item fit. The same answer again clears it.
  onSetFit,
}) {
  const view = useMemo(
    () => trackingView({ items, maths, line, domesticUsd, milestone, stamps, fits }),
    [items, maths, line, domesticUsd, milestone, stamps, fits]
  );

  const dialogRef = useRef(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      if (dialog && dialog.open) dialog.close();
    };
  }, []);

  const tile = (id) => {
    const item = items.find((entry) => entry && entry.id === id);
    const face = item && tileFor ? tileFor(item) : null;
    const style = {};
    if (face && face.tint) style["--cz-ht-tint"] = face.tint;
    if (face && face.image) style.backgroundImage = "url(" + face.image + ")";
    return style;
  };

  return (
    <dialog
      ref={dialogRef}
      className="cz-ht"
      aria-label="Parcel A"
      onCancel={(event) => {
        event.preventDefault();
        if (onClose) onClose();
      }}
    >
      <div className="cz-ht-page">
        <div className="cz-ht-head">
          <button type="button" className="cz-ht-back" onClick={onClose}>
            <ChevronLeft aria-hidden="true" size={14} strokeWidth={2.2} />
            Back to the board
          </button>
          <h1 className="cz-ht-h1">Parcel A</h1>
          <span className="cz-ht-meta">{view.meta}</span>
        </div>
        <p className="cz-ht-lede">Tap each step as it happens. Nothing here polls your agent.</p>

        <div className="cz-ht-cols">
          <div className="cz-ht-left">
            <div className="cz-ht-card">
              {view.steps.map((step, i) => (
                <button
                  type="button"
                  className="cz-ht-step"
                  data-current={step.current ? "true" : "false"}
                  key={step.key}
                  aria-pressed={step.done}
                  onClick={() => onPickStep && onPickStep(i)}
                >
                  <span className="cz-ht-mark" data-done={step.done ? "true" : "false"}>
                    {step.done ? <Check aria-hidden="true" size={11} strokeWidth={2.2} /> : null}
                  </span>
                  <span className="cz-ht-steplabel" data-done={step.done ? "true" : "false"}>
                    {step.label}
                  </span>
                  <span className="cz-ht-when">{step.when}</span>
                </button>
              ))}

              <div className="cz-ht-trackrow">
                <input
                  className="cz-ht-input"
                  type="text"
                  placeholder="Tracking number"
                  aria-label="Tracking number"
                  value={tracking}
                  onChange={(event) => onSetTracking && onSetTracking(event.target.value)}
                />
                <a
                  className="cz-ht-track"
                  href={
                    "https://parcelsapp.com/en/tracking/" + encodeURIComponent(tracking || "")
                  }
                  target="_blank"
                  rel="noreferrer noopener"
                  aria-disabled={tracking ? "false" : "true"}
                  onClick={(event) => {
                    if (!tracking) event.preventDefault();
                  }}
                >
                  Track ↗
                </a>
              </div>
            </div>

            {view.received ? (
              <div className="cz-ht-card">
                <div className="cz-ht-fithead">
                  <span className="cz-ht-kicker">Did the size call hold?</span>
                  <span className="cz-ht-fitsub">
                    One tap each. This is what makes the next size recommendation better than a
                    guess.
                  </span>
                </div>

                {view.fits.map((row) => (
                  <div className="cz-ht-fitrow" key={row.id}>
                    <span className="cz-ht-tile" style={tile(row.id)} aria-hidden="true" />
                    <span className="cz-ht-fittext">
                      <span className="cz-ht-fittitle">{row.title}</span>
                      <span className="cz-ht-fitsize">{row.sizeLine}</span>
                    </span>
                    <span className="cz-ht-chips">
                      {row.options.map((option) => (
                        <button
                          type="button"
                          className="cz-ht-chip"
                          key={option}
                          data-active={row.answer === option ? "true" : "false"}
                          aria-pressed={row.answer === option}
                          onClick={() => onSetFit && onSetFit(row.id, option)}
                        >
                          {option}
                        </button>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="cz-ht-right">
            <div className="cz-ht-sum">
              <span className="cz-ht-kicker">What this haul cost</span>
              <div className="cz-ht-sumrow">
                <span className="cz-ht-sumlabel">Goods in this box</span>
                <span className="cz-ht-sumvalue">{view.goods}</span>
              </div>
              <div className="cz-ht-sumrow">
                <span className="cz-ht-sumlabel">Agent domestic</span>
                <span className="cz-ht-sumvalue">{view.domestic}</span>
              </div>
              <div className="cz-ht-sumrow">
                <span className="cz-ht-sumlabel">{view.line}</span>
                <span className="cz-ht-sumvalue">{view.international}</span>
              </div>
              <div className="cz-ht-rule" />
              <div className="cz-ht-sumrow">
                <span className="cz-ht-landlabel">Landed</span>
                <span className="cz-ht-landvalue">{view.landed}</span>
              </div>
              <p className="cz-ht-note">{view.landedNote}</p>
            </div>

            <div className="cz-ht-card">
              <span className="cz-ht-kicker">Still at the warehouse</span>
              <p className="cz-ht-remain">{view.remainingNote}</p>
              <button type="button" className="cz-ht-outline" onClick={onClose}>
                Back to the board
              </button>
            </div>
          </div>
        </div>
      </div>
    </dialog>
  );
}
