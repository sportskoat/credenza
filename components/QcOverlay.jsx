import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, X } from "lucide-react";
import {
  RED_REASONS,
  qcProgress,
  qcQueue,
  returnMessage,
  sellerRecord,
} from "../haul-fulfillment.js";
import { Pill } from "./atoms.jsx";

// ═══════════════════════════════════════════════════════════════════════════
// QcOverlay — haul handoff README, screens 3 to 5.
//
// The screen that has to be fast. Someone reviewing twelve items should be
// done in ninety seconds. Everything here serves that one number:
//
//   The keyboard is bound at the window, not at a focused element. A person
//   flicking through photos never has to click back into the right box first.
//   ← → walk the photos, G is green, R is red, Escape closes. The README
//   calls this the single highest-leverage detail in the design.
//
//   The verdict is one press. The overlay does not ask "are you sure": a
//   wrong call is fixed by pressing the other button.
//
//   "Next item →" walks the queue without going back to the board.
//
// Credenza writes the return request. It never sends it. The line under the
// copy button says so, and that sentence is the product's whole posture. Do
// not cut it.
// ═══════════════════════════════════════════════════════════════════════════

export default function QcOverlay({
  // The haul's items, in shelf order, already shaped by toHaulItem.
  items = [],
  // Which item is open. The overlay walks the queue from here.
  itemId = null,
  // The saved card behind the open item — the photos and the seller live on
  // the card, not on the haul-shaped copy.
  cardFor,
  // Every card on the shelf, for the seller's record across all hauls.
  allCards = [],
  onClose,
  // (id, verdict, reason) — the parent writes the verdict and the stage.
  onVerdict,
  // (id) — moves a green-lit item into the parcel.
  onAddToParcel,
  // (id) — the overlay asks the parent to open the next item.
  onOpenItem,
  onCopy,
  // (id, files) — pasted or dropped photos. The parent runs every file
  // through the qcPhotos gate (HTTPS/data-URL, plan cap), so the overlay
  // never validates on its own.
  onAddPhotos,
}) {
  const queue = useMemo(() => qcQueue(items), [items]);
  const item = useMemo(
    () => items.find((entry) => entry && entry.id === itemId) || null,
    [items, itemId]
  );
  const card = cardFor ? cardFor(itemId) : null;
  const photos = useMemo(() => {
    const list = card && Array.isArray(card.qcPhotos) ? card.qcPhotos.filter(Boolean) : [];
    return list;
  }, [card]);

  const [photoIndex, setPhotoIndex] = useState(0);
  // A new item starts at its first photo. Without this the index carries over
  // and lands past the end of a shorter set.
  useEffect(() => {
    setPhotoIndex(0);
  }, [itemId]);

  const verdict = item ? item.qc : null;
  const reason = (item && item.reason) || RED_REASONS[0].key;

  // STEPS-HANDOFF item 8: no verdict without a photo. Never let a person
  // red-light what they have not seen — the buttons and the G/R keys both
  // stay inert until the pane holds at least one picture.
  const canVerdict = photos.length > 0;

  // Pasted and dropped photos land through one intake, so the empty-state
  // drop target, a drop on a populated stage, and a bare ⌘V all behave the
  // same. Non-images never reach the gate.
  const takeFiles = useCallback(
    (fileList) => {
      if (!item || !onAddPhotos || !fileList) return;
      const files = [...fileList].filter((file) => file && /^image\//.test(file.type));
      if (files.length) onAddPhotos(item.id, files);
    },
    [item, onAddPhotos]
  );
  const [dragOver, setDragOver] = useState(false);

  const step = useCallback(
    (delta) => {
      if (photos.length < 2) return;
      setPhotoIndex((current) => (current + delta + photos.length) % photos.length);
    },
    [photos.length]
  );

  const rule = useCallback(
    (next) => {
      if (!item || !onVerdict || !canVerdict) return;
      onVerdict(item.id, next, next === "red" ? reason : null);
    },
    [item, onVerdict, reason, canVerdict]
  );

  // The queue minus the item on screen. "Next item →" goes to the first of
  // these; when it is empty the label becomes "Done".
  const nextItem = useMemo(
    () => queue.find((entry) => entry && entry.id !== itemId) || null,
    [queue, itemId]
  );

  const dialogRef = useRef(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      if (dialog && dialog.open) dialog.close();
    };
  }, []);

  // The keyboard, bound at the window while the overlay is up. Typing in the
  // rail is never the point here, so a bare letter is safe — but guard the
  // fields anyway, so a future note box does not swallow the letters.
  useEffect(() => {
    const onKey = (event) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const tag = event.target && event.target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (event.key === "Escape") {
        event.preventDefault();
        if (onClose) onClose();
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        step(-1);
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        step(1);
        return;
      }
      const key = event.key.toLowerCase();
      if (key === "g") {
        event.preventDefault();
        rule("green");
        return;
      }
      if (key === "r") {
        event.preventDefault();
        rule("red");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, rule, step]);

  // Paste lands at the window, like the keyboard: a person with agent photos
  // on the clipboard should not have to aim at the drop target. A paste meant
  // for a field stays with the field.
  useEffect(() => {
    const onPaste = (event) => {
      const tag = event.target && event.target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const files = event.clipboardData && event.clipboardData.files;
      if (files && files.length) takeFiles(files);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [takeFiles]);

  const progress = useMemo(() => qcProgress(items), [items]);
  const seller = useMemo(
    () => sellerRecord(allCards, card && card.seller),
    [allCards, card]
  );

  if (!item) return null;

  const message = returnMessage({ item, reason, photoIndex });

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- backdrop click closes; the keyboard closes with Escape above
    <dialog
      ref={dialogRef}
      className="cz-qcr"
      aria-label={"QC review, " + item.title}
      onCancel={(event) => {
        event.preventDefault();
        if (onClose) onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && onClose) onClose();
      }}
    >
      <div className="cz-qcr-surface">
        <div className="cz-qcr-photos">
          <div
            className={"cz-qcr-stage" + (dragOver ? " is-dragover" : "")}
            onDragOver={(event) => {
              event.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragOver(false);
              takeFiles(event.dataTransfer && event.dataTransfer.files);
            }}
          >
            {photos.length ? (
              <img
                className="cz-qcr-photo"
                src={photos[Math.min(photoIndex, photos.length - 1)]}
                alt={"QC photo " + (photoIndex + 1) + " of " + photos.length}
              />
            ) : (
              /* STEPS-HANDOFF item 8, § QC takeover deltas. Kyle banned em
                 dashes in rendered copy (2026-08-02), so the handoff's "—
                 up to 12" is its own sentence here. The words are the
                 handoff's. */
              <div className="cz-qcr-drop">
                <span className="cz-qcr-drop-title">
                  Your agent's QC photos live on their site.
                </span>
                <span className="cz-qcr-drop-sub">Paste or drop them here. Up to 12.</span>
              </div>
            )}
          </div>
          <div className="cz-qcr-strip">
            <button
              type="button"
              className="cz-qcr-arrow"
              aria-label="Previous photo"
              onClick={() => step(-1)}
              disabled={photos.length < 2}
            >
              <ChevronLeft aria-hidden="true" size={16} strokeWidth={2.2} />
            </button>
            <div className="cz-qcr-thumbs">
              {photos.map((src, i) => (
                <button
                  key={src.slice(-24) + "-" + i}
                  type="button"
                  className="cz-qcr-thumb"
                  aria-label={"Photo " + (i + 1)}
                  aria-current={i === photoIndex ? "true" : undefined}
                  data-current={i === photoIndex ? "true" : undefined}
                  onClick={() => setPhotoIndex(i)}
                >
                  <img src={src} alt="" />
                </button>
              ))}
            </div>
            <button
              type="button"
              className="cz-qcr-arrow"
              aria-label="Next photo"
              onClick={() => step(1)}
              disabled={photos.length < 2}
            >
              <ChevronRight aria-hidden="true" size={16} strokeWidth={2.2} />
            </button>
          </div>
        </div>

        <div className="cz-qcr-rail">
          <div className="cz-qcr-head">
            <div className="cz-qcr-kicker">
              QC review · {progress.done} of {progress.total} done
            </div>
            <button
              type="button"
              className="cz-qcr-close"
              aria-label="Close QC review"
              onClick={onClose}
            >
              <X aria-hidden="true" size={16} strokeWidth={2.2} />
            </button>
          </div>
          <h2 className="cz-qcr-title">{item.title}</h2>
          <div className="cz-qcr-meta">
            {item.size || "no size"}
            {item.order ? " · " + item.order : ""}
          </div>

          <div className="cz-qcr-verdicts">
            <button
              type="button"
              className="cz-qcr-verdict"
              data-verdict="green"
              aria-pressed={verdict === "green"}
              disabled={!canVerdict}
              onClick={() => rule("green")}
            >
              <Check aria-hidden="true" size={15} strokeWidth={2.2} />
              Green light
              <span className="cz-qcr-key" aria-hidden="true">G</span>
            </button>
            <button
              type="button"
              className="cz-qcr-verdict"
              data-verdict="red"
              aria-pressed={verdict === "red"}
              disabled={!canVerdict}
              onClick={() => rule("red")}
            >
              <X aria-hidden="true" size={15} strokeWidth={2.2} />
              Red light
              <span className="cz-qcr-key" aria-hidden="true">R</span>
            </button>
          </div>

          {verdict === "green" ? (
            <div className="cz-qcr-panel" data-verdict="green">
              <p className="cz-qcr-panel-line">
                Green-lit. It moves to <strong>QC done</strong> and can go in parcel A.
              </p>
              {item.stage !== "parcel" ? (
                <Pill
                  className="cz-pill cz-qcr-action"
                  onClick={() => onAddToParcel && onAddToParcel(item.id)}
                >
                  Add to parcel A
                </Pill>
              ) : null}
            </div>
          ) : null}

          {verdict === "red" ? (
            <div className="cz-qcr-panel" data-verdict="red">
              <div className="cz-qcr-reasons" role="group" aria-label="Reason">
                {RED_REASONS.map((entry) => (
                  <button
                    key={entry.key}
                    type="button"
                    className="cz-qcr-reason"
                    aria-pressed={entry.key === reason}
                    onClick={() => onVerdict && onVerdict(item.id, "red", entry.key)}
                  >
                    {entry.key}
                  </button>
                ))}
              </div>
              <pre className="cz-qcr-message">{message}</pre>
              <Pill
                className="cz-pill cz-qcr-action"
                onClick={() => onCopy && onCopy(message, "Return request copied.")}
              >
                Copy for your agent · EN + 中文
              </Pill>
              {/* README screen 5 prints this with an em dash. Kyle banned em
                  dashes in rendered copy on 2026-08-02 (CONTEXT.md), so the
                  clause becomes its own sentence. The words are the README's.
                  This sentence is the product's whole posture. Do not cut it. */}
              <p className="cz-qcr-posture">
                You send it. Credenza only writes it. Your agent has to receive
                the request from you.
              </p>
            </div>
          ) : null}

          <div className="cz-qcr-foot">
            <div className="cz-qcr-tally">
              {progress.green} green · {progress.red} red
            </div>
            <button
              type="button"
              className="cz-qcr-next"
              onClick={() => {
                if (nextItem && onOpenItem) onOpenItem(nextItem.id);
                else if (onClose) onClose();
              }}
            >
              {nextItem ? "Next item →" : "Done"}
            </button>
            {seller ? <div className="cz-qcr-seller">{seller.label}</div> : null}
          </div>
        </div>
      </div>
    </dialog>
  );
}
