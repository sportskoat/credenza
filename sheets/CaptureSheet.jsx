import { useEffect, useState } from "react";
import { Check, Link2 } from "lucide-react";
import { ModalShell, stashPreview } from "../credenza-fashion.jsx";

// Stash sheet. Built for the phone (shelf handoff step 4, 2026-07-25), opened
// on every screen since 2026-07-27 — the desktop ＋ Stash button used to read
// the clipboard with no review step, which is the one thing this sheet exists
// to prevent.
//
// One rule governs this sheet: nothing is stashed that is not on screen
// first. Every button shows what it will create before it creates it.
//
// The sheet has four states:
//   A "detected" — the clipboard holds links. Show them, then "Stash this".
//   B "empty"    — the clipboard is empty or unreadable. Show a paste box.
//   C "multi"    — the text parses to more than one card. Show the list.
//   D "note"     — a clipboard read found no links. Require one more action.
//
// Removed in this step: the Yupoo/Weidian/Taobao/Reddit dot row, the "Paste"
// and "Stash this tab" text buttons, and the clipboard chip. The clipboard is
// a preview block now, not a chip.
export default function CaptureSheet({ clip, input, onInput, onStash, onClose, textareaRef }) {
  // The paste box opens only when the clipboard has nothing to show, or when
  // the user asks for it. State A is the common case.
  const [showBox, setShowBox] = useState(!clip);
  const [pasteError, setPasteError] = useState("");
  const [reviewAsNote, setReviewAsNote] = useState(false);

  const typed = (input || "").trim();
  // Typed text always wins: the user is looking at it.
  const source = typed || (showBox ? "" : (clip && clip.text) || "");
  const preview = stashPreview(source, { asNote: reviewAsNote });

  useEffect(() => {
    if (!showBox) return;
    // ModalShell focuses its close button on mount. Steal focus into the paste
    // box a frame later so the sheet opens ready to type. On a phone this opens
    // the keyboard, which is the point of a capture surface.
    const id = requestAnimationFrame(() => {
      if (textareaRef.current) textareaRef.current.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [showBox, textareaRef]);

  // This button reads the clipboard after a user gesture. Links can stash now.
  // URL-free text moves into the box and requires a second action.
  const pasteAndStash = async () => {
    setPasteError("");
    const fallback = (message) => {
      setPasteError(message);
      if (textareaRef.current) textareaRef.current.focus();
    };
    if (!navigator.clipboard || !navigator.clipboard.readText) {
      fallback("This browser keeps its clipboard private. Paste into the box instead.");
      return;
    }
    let text = "";
    try {
      text = await navigator.clipboard.readText();
    } catch {
      fallback("Allow clipboard access when your browser asks, or paste into the box.");
      return;
    }
    if (!text.trim()) {
      fallback("The clipboard is empty.");
      return;
    }
    onInput(text);
    const result = onStash(text, { linksOnly: true });
    if (result && result.status === "no-link") {
      setShowBox(true);
      setReviewAsNote(true);
      setPasteError("No links found.");
    }
  };

  const primaryLabel = () => {
    if (!preview) return "Paste & stash";
    if (reviewAsNote) return "Save as 1 note";
    if (preview.count > 1) return "Stash " + preview.count + " items";
    if (!typed) return "Stash this";
    return "Stash · 1 " + (preview.rows[0].code === "note" ? "note" : "link");
  };

  const readyLine = () => {
    if (!preview) return null;
    if (reviewAsNote) return "1 note from this text";
    if (preview.count > 1) return preview.count + " links in this haul · " + preview.platform;
    return typed ? "Ready to stash" : preview.label;
  };

  const rows = preview && preview.count > 1 ? preview.rows : [];
  const shown = rows.slice(0, 3);

  // What the paste becomes. In state A this sits inside the clipboard card,
  // under a hairline: the parse result belongs to the text above it.
  const readyBlock = preview ? (
    <div className="cz-stash-ready">
      <Check size={13} strokeWidth={2.6} aria-hidden="true" />
      <span className="cz-stash-ready-text">{readyLine()}</span>
    </div>
  ) : null;

  return (
    <ModalShell title="Stash to shelf" onClose={onClose} maxWidth={520} surfaceClassName="cz-stash-surface">
      <div className="cz-stash-body">
        {/* Kicker (shelf handoff 2026-07-28, README :122). The sheet title sits
            in the shell chrome; this names the job inside the body, where the
            eye lands first on a phone. */}
        <div className="cz-stash-kicker" aria-hidden="true">
          Stash a link
        </div>

        {/* State A: the clipboard preview. The raw text shows verbatim, so an
            obfuscated or truncated link is visible before it is stashed. */}
        {!showBox && clip && (
          <div className="cz-stash-clipcard">
            <div className="cz-stash-clipcard-head">
              <span className="cz-stash-clipcard-dot" style={{ background: clip.dot }} aria-hidden="true" />
              <span className="cz-stash-clipcard-label">On your clipboard</span>
            </div>
            <p className="cz-stash-clipcard-raw">{clip.text}</p>
            {readyBlock}
          </div>
        )}

        {/* State B: the paste box. 16px type is required — anything smaller
            makes iOS zoom the page on focus. */}
        {showBox && (
          <div className="cz-stash-pastewrap">
          <Link2 className="cz-stash-paste-glyph" size={15} strokeWidth={2.2} aria-hidden="true" />
          <textarea
            ref={textareaRef}
            className="cz-stash-paste"
            aria-label="Stash a link or note"
            value={input}
            onChange={(e) => {
              setReviewAsNote(false);
              setPasteError("");
              onInput(e.target.value);
            }}
            onKeyDown={(e) => {
              // Keep Stash keystrokes out of the window type-anywhere path.
              e.stopPropagation();
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (typed) onStash(typed, reviewAsNote ? { asNote: true } : {});
              }
            }}
            placeholder="Paste a link, or a whole haul block"
            rows={4}
          />
          </div>
        )}

        {pasteError && <p className="cz-stash-error">{pasteError}</p>}

        {/* States B and C read the same line, outside the card. */}
        {showBox && readyBlock}

        {/* State C: one row per card, so a bad haul is visible before it lands. */}
        {shown.length > 0 && (
          <div className="cz-stash-list">
            {shown.map((r) => (
              <div key={r.key} className="cz-stash-row">
                <span className="cz-stash-row-dot" style={{ background: r.dot }} aria-hidden="true" />
                <span className="cz-stash-row-title">{r.title}</span>
                <span className="cz-stash-row-code">{r.code}</span>
              </div>
            ))}
            {rows.length > shown.length && (
              <div className="cz-stash-list-more">+ {rows.length - shown.length} more</div>
            )}
          </div>
        )}

        <button
          type="button"
          className="cz-stash-primary"
          onClick={() => {
            if (!preview) {
              pasteAndStash();
              return;
            }
            if (reviewAsNote) {
              onStash(source, { asNote: true });
              return;
            }
            onStash(source, showBox ? {} : { linksOnly: true });
          }}
        >
          {primaryLabel()}
        </button>

        {!showBox && (
          <button
            type="button"
            className="cz-stash-alt"
            onClick={() => {
              onInput("");
              setPasteError("");
              setReviewAsNote(false);
              setShowBox(true);
            }}
          >
            Stash something else instead
          </button>
        )}

        {/* What a haul paste becomes (shelf handoff 2026-07-28, README :125).
            A person pastes a whole Reddit comment and expects one card. This
            line sets the expectation before the button, not after it. */}
        <p className="cz-stash-note">
          Paste a Reddit haul comment and Credenza splits it into one card per line. Lines it
          can&apos;t read stay as text — nothing is dropped.
        </p>

        {/* A way out that is not the ✕ (shelf handoff 2026-07-28, README :126).
            On a phone the ✕ sits at the far top corner, away from the thumb. */}
        <div className="cz-stash-cancel-row">
          <button type="button" className="cz-stash-cancel" onClick={onClose}>
            Cancel
          </button>
        </div>

        {/* This sheet takes text only. A file needs Profile → Import, on
            every screen, so the pointer belongs here. */}
        <p className="cz-stash-foot">Restoring a backup or a CSV? Profile → Import</p>
      </div>
    </ModalShell>
  );
}
