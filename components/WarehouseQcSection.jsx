import { useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { compressImageBlob } from "../credenza-fashion.jsx";

// ═══ STANDARDIZED CARD BACK (standardization 2026-07-22, audit workstream B) ═══
// A5 (docs/Monetization.md): Warehouse QC — the agent's check photos live
// here, distinct from the product gallery, plus one-tap GL/RL. GL clears the
// card to ship; RL sends it back. Both stamp qcVerdictAt; the note is
// optional. The section appears once a card reaches the warehouse (qc/gl/rl)
// or already has QC photos.
export default function WarehouseQcSection({ item, onSaveEdit, onOpenPhotos, isCenter }) {
  const qcPhotos = Array.isArray(item.qcPhotos) ? item.qcPhotos.filter(Boolean) : [];
  const [noteDraft, setNoteDraft] = useState(item.qcNote || "");
  const fileRef = useRef(null);
  useEffect(() => {
    setNoteDraft(item.qcNote || "");
  }, [item.id, item.qcNote]);

  const QC_PHOTO_CAP = 12;
  const atCap = qcPhotos.length >= QC_PHOTO_CAP;

  const attachQc = async (file) => {
    if (!file || atCap) return;
    try {
      const dataUrl = await compressImageBlob(file);
      onSaveEdit?.(item.id, (x) => ({
        qcPhotos: [...(Array.isArray(x.qcPhotos) ? x.qcPhotos : []), dataUrl].slice(0, 12),
      }));
    } catch {
      // Read failure: leave the card untouched (graceful degradation, §11).
    }
  };

  // Task 10 (Part 5): pasting an image anywhere in the QC section attaches it
  // as a QC photo — agent screenshots rarely come as files. Text pastes fall
  // through to the note field untouched.
  const onPaste = (e) => {
    const clipItems = e.clipboardData?.items;
    if (!clipItems) return;
    for (const clipItem of clipItems) {
      if (clipItem.type && clipItem.type.startsWith("image/")) {
        const file = clipItem.getAsFile();
        if (file) {
          e.preventDefault();
          attachQc(file);
          return;
        }
      }
    }
  };

  const verdict = (v) =>
    onSaveEdit?.(item.id, {
      findStatus: v,
      qcVerdictAt: new Date().toISOString(),
      qcNote: String(noteDraft || "").trim(),
    });

  const verdictLabel = item.qcVerdictAt
    ? (item.findStatus === "gl" ? "GL" : item.findStatus === "rl" ? "RL" : "QC") +
      " · " +
      new Date(item.qcVerdictAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })
    : "";

  return (
    <section className="cz-sheet-section cz-qc" aria-label="Warehouse QC" onPaste={onPaste}>
      <div className="cz-qc-head">
        <span className="cz-qc-title">Warehouse QC</span>
        {verdictLabel ? <span className="cz-qc-verdict">{verdictLabel}</span> : null}
        <span className="cz-qc-cap" aria-label={qcPhotos.length + " of " + QC_PHOTO_CAP + " QC photos"}>
          {qcPhotos.length}/{QC_PHOTO_CAP}
        </span>
      </div>
      {qcPhotos.length > 0 ? (
        <div className="cz-qc-thumbs" role="list" aria-label="QC photos">
          {qcPhotos.map((src, i) => (
            <div className="cz-qc-thumb" role="listitem" key={src.slice(-24) + i}>
              <button
                type="button"
                className="cz-qc-thumb-open"
                aria-label={"Open QC photo " + (i + 1)}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isCenter) return;
                  onOpenPhotos?.(item, {
                    images: qcPhotos,
                    startIndex: i,
                    trigger: e.currentTarget,
                  });
                }}
              >
                <img src={src} alt="" loading="lazy" decoding="async" />
              </button>
              <button
                type="button"
                className="cz-qc-thumb-remove"
                aria-label={"Remove QC photo " + (i + 1)}
                onClick={(e) => {
                  e.stopPropagation();
                  onSaveEdit?.(item.id, (x) => ({
                    qcPhotos: (Array.isArray(x.qcPhotos) ? x.qcPhotos : []).filter(
                      (g) => g !== src
                    ),
                  }));
                }}
              >
                <X aria-hidden="true" size={11} strokeWidth={2.6} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="cz-qc-empty">No QC photos yet. Add the ones your agent sends.</p>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="cz-qc-file"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(e) => {
          attachQc(e.target.files && e.target.files[0]);
          e.target.value = "";
        }}
      />
      <div className="cz-qc-actions">
        <button
          type="button"
          className="cz-qc-add"
          onClick={() => fileRef.current?.click()}
          disabled={atCap}
          title={atCap ? "Photo cap reached — remove one first" : "Add a QC photo, or paste one anywhere in this section"}
        >
          <Plus aria-hidden="true" size={13} strokeWidth={2.4} />
          Add QC photo
        </button>
        <button
          type="button"
          className={"cz-qc-verdict-btn is-gl" + (item.findStatus === "gl" ? " is-active" : "")}
          onClick={() => verdict("gl")}
        >
          GL · ship it
        </button>
        <button
          type="button"
          className={"cz-qc-verdict-btn is-rl" + (item.findStatus === "rl" ? " is-active" : "")}
          onClick={() => verdict("rl")}
        >
          RL · send back
        </button>
      </div>
      {/* Task 10 (Part 5): after an RL, record what came of it. Returned =
          money back (leaves the haul weight and the cost totals); exchange =
          back to Bought with the ask noted. */}
      {item.findStatus === "rl" ? (
        <div className="cz-qc-followup" role="group" aria-label="RL follow-up">
          <span className="cz-qc-followup-label">Sent back. Then what?</span>
          <button
            type="button"
            className="cz-qc-followup-btn"
            onClick={() => onSaveEdit?.(item.id, { findStatus: "returned" })}
          >
            Mark returned
          </button>
          <button
            type="button"
            className="cz-qc-followup-btn"
            onClick={() =>
              onSaveEdit?.(item.id, (x) => ({
                findStatus: "bought",
                qcNote: [
                  String(x.qcNote || "").trim(),
                  "Exchange asked " +
                    new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" }),
                ]
                  .filter(Boolean)
                  .join(" · "),
              }))
            }
          >
            Ask for exchange
          </button>
        </div>
      ) : null}
      <input
        type="text"
        className="cz-qc-note"
        value={noteDraft}
        placeholder="QC note (optional) — flaw, exchange ask…"
        aria-label="QC note"
        onChange={(e) => setNoteDraft(e.target.value)}
        onBlur={() => {
          const next = String(noteDraft || "").trim();
          if (next !== (item.qcNote || "")) onSaveEdit?.(item.id, { qcNote: next });
        }}
      />
    </section>
  );
}
