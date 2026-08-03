import { useEffect, useMemo, useRef } from "react";
import { Check, X } from "lucide-react";
import { itemDrawer } from "../haul-fulfillment.js";

/* ═══════════════════════════════════════════════════════════════════════════
   HaulItemDrawer — haul handoff README, screen 8.

   One item, opened from the board. The drawer answers three questions in the
   order a person asks them: where is it, what does it weigh, what can I do
   next.

   Every stage row is tappable, including the ones already behind the item.
   A stage is a claim about the real world, and the real world corrects itself.
   A parcel gets split. An order gets cancelled. A one-way ratchet would force
   the person to lie to the app.

   The drawer edits the saved card directly. It stores the weight, the order
   number and the stage, because those are facts the person supplies. It stores
   no total, no count and no verdict summary: those are worked out on render.
   ═══════════════════════════════════════════════════════════════════════════ */

export default function HaulItemDrawer({
  // The open item, already shaped by toHaulItem.
  item = null,
  // { image, tint } for the cover picture and the platform's colour.
  face = null,
  onClose,
  // (id, patch) — the parent writes the card.
  onPatch,
  // (id) — opens QC review on this item.
  onReviewQc,
  // (id) — moves a green-lit item into the parcel.
  onAddToParcel,
  // (id) — puts the item back on the shelf, fulfillment numbers cleared.
  onBackToShelf,
}) {
  const view = useMemo(() => itemDrawer(item), [item]);

  const dialogRef = useRef(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      if (dialog && dialog.open) dialog.close();
    };
  }, []);

  if (!view) return null;

  const tileStyle = {};
  if (face && face.tint) tileStyle["--cz-hd-tint"] = face.tint;
  if (face && face.image) tileStyle.backgroundImage = "url(" + face.image + ")";

  const sizeLine = [item.size, (item.platform || "Link").toUpperCase()]
    .filter(Boolean)
    .join(" · ");

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- backdrop click closes; Escape closes through onCancel
    <dialog
      ref={dialogRef}
      className="cz-hd"
      aria-label={"Item details, " + (item.title || "item")}
      onCancel={(event) => {
        event.preventDefault();
        if (onClose) onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && onClose) onClose();
      }}
    >
      <div className="cz-hd-panel">
        <div className="cz-hd-head">
          <span className="cz-hd-tile" style={tileStyle}>
            <span className="cz-hd-platform">{item.platform || "Link"}</span>
          </span>
          <span className="cz-hd-headtext">
            <span className="cz-hd-title">{item.title}</span>
            <span className="cz-hd-size">{sizeLine}</span>
            <span className="cz-hd-price">${Number(item.price || 0).toFixed(2)}</span>
          </span>
          <button type="button" className="cz-hd-close" aria-label="Close" onClick={onClose}>
            <X aria-hidden="true" size={16} strokeWidth={2.2} />
          </button>
        </div>

        {/* Kyle 2026-08-02: a red light said "red" and nothing else. Now the
            drawer names the problem in words, and one button leads to the
            message that fixes it. The reason can be missing, and that is a
            different sentence: an unanswered question, not a silent one. */}
        {view.verdict === "red" ? (
          <div className="cz-hd-red" role="group" aria-label="Red light">
            <span className="cz-hd-red-kicker">Red light</span>
            <p className="cz-hd-red-text">
              {view.reasonText || "The reason is not set yet. Open QC to pick it."}
            </p>
            <button
              type="button"
              className="cz-hd-red-cta"
              onClick={() => onReviewQc && onReviewQc(view.id)}
            >
              Write the return message
            </button>
          </div>
        ) : null}

        {/* Where it is. Tapping a row moves the item there, forwards or back. */}
        <div className="cz-hd-section">
          <span className="cz-hd-kicker">Where it is</span>
          {view.stages.map((stage) => (
            <button
              type="button"
              key={stage.key}
              className="cz-hd-stage"
              data-state={stage.current ? "current" : stage.done ? "done" : "ahead"}
              aria-current={stage.current ? "step" : undefined}
              onClick={() => {
                if (stage.current || !onPatch) return;
                onPatch(view.id, { haulStage: stage.key, haulStageAt: Date.now() });
              }}
            >
              <span className="cz-hd-mark" aria-hidden="true">
                {stage.done || stage.current ? <Check size={12} strokeWidth={2.4} /> : null}
              </span>
              <span className="cz-hd-stage-label">{stage.label}</span>
              {stage.when ? <span className="cz-hd-when">now</span> : null}
            </button>
          ))}
        </div>

        {/* Numbers. Both fields are facts the person supplies, so both save. */}
        <div className="cz-hd-section">
          <span className="cz-hd-kicker">Numbers</span>

          <div className="cz-hd-row">
            <label className="cz-hd-fieldlabel" htmlFor="cz-hd-weight">
              Weight
            </label>
            <span className="cz-hd-input-wrap">
              <input
                id="cz-hd-weight"
                className="cz-hd-number"
                type="number"
                min="0"
                step="10"
                value={view.weight}
                onChange={(event) => {
                  if (!onPatch) return;
                  const next = Number(event.target.value);
                  const real = Number.isFinite(next) && next > 0;
                  // The date is stamped with the number and cleared with it.
                  // A date left behind on an emptied field would claim the
                  // warehouse weighed something the app no longer holds.
                  onPatch(view.id, {
                    haulActualGrams: real ? Math.round(next) : null,
                    haulWeighedAt: real ? Date.now() : null,
                  });
                }}
              />
              <span className="cz-hd-unit">g</span>
            </span>
          </div>
          {/* Kyle 2026-08-02: "you're making sure that it's not just an estimate.
              It is just what comes from the warehouse." The chip names the source
              of the number beside the number, so the two cannot be confused. */}
          <p className="cz-hd-source" data-weighed={view.weightSource.weighed ? "yes" : "no"}>
            <span className="cz-hd-source-mark" aria-hidden="true">
              {view.weightSource.weighed ? <Check size={11} strokeWidth={2.6} /> : null}
            </span>
            {view.weightSource.label}
          </p>
          <p className="cz-hd-note">{view.weightNote}</p>

          <div className="cz-hd-row">
            <label className="cz-hd-fieldlabel" htmlFor="cz-hd-order">
              Order no.
            </label>
            <input
              id="cz-hd-order"
              className="cz-hd-text"
              type="text"
              placeholder="SB-0000000"
              value={view.orderNo}
              onChange={(event) => {
                if (!onPatch) return;
                onPatch(view.id, { haulOrderNo: event.target.value });
              }}
            />
          </div>

          {view.storageNote ? <p className="cz-hd-storage">{view.storageNote}</p> : null}
        </div>

        <div className="cz-hd-section cz-hd-actions">
          {view.qcReady ? (
            <button
              type="button"
              className="cz-hd-cta"
              onClick={() => onReviewQc && onReviewQc(view.id)}
            >
              {view.qcLabel}
            </button>
          ) : null}
          {view.canParcel ? (
            <button
              type="button"
              className="cz-hd-outline"
              onClick={() => onAddToParcel && onAddToParcel(view.id)}
            >
              Add to parcel A
            </button>
          ) : null}
          <button
            type="button"
            className="cz-hd-subtle"
            onClick={() => onBackToShelf && onBackToShelf(view.id)}
          >
            Move back to the shelf
          </button>
        </div>
      </div>
    </dialog>
  );
}
