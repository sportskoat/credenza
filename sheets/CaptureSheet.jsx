import { useEffect } from "react";
import { ModalShell } from "../credenza-fashion.jsx";

// Sources shown above the stash paste box (visual only — not mode controls).
// Dots + names, no chip boxes (Kyle 2026-07-23 handoff).
const STASH_SOURCES = [
  { name: "Yupoo", color: "#37b24d" },
  { name: "Weidian", color: "#ff5a3c" },
  { name: "Taobao", color: "#ff6a00" },
  { name: "Reddit", color: "#ff4500" },
];

// Capture sheet (design handoff PR3): the phone's capture surface behind the
// bottom bar's Stash pill. One box, one button — the app detects what the
// paste is (Kyle 2026-07-24: "one congruent setup"; the Link/Reddit haul/Note
// tabs and the "Import from Reddit" detour are gone).
export default function CaptureSheet({
  clip,
  input,
  onInput,
  canStashTab,
  onStashTab,
  onStash,
  onClose,
  textareaRef,
}) {
  useEffect(() => {
    // ModalShell focuses its close button on mount; steal focus into the paste
    // box a frame later so the sheet opens ready to type (on a phone this pops
    // the keyboard — that is the point of a capture surface).
    const id = requestAnimationFrame(() => {
      if (textareaRef.current) textareaRef.current.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [textareaRef]);

  return (
    <ModalShell title="Stash to shelf" onClose={onClose} maxWidth={520}>
      <div className="cz-stash-body">
        <div className="cz-stash-sources" aria-label="Works with">
          {STASH_SOURCES.map((s) => (
            <span key={s.name} className="cz-stash-source">
              <span
                className="cz-stash-source-dot"
                style={{ background: s.color }}
                aria-hidden="true"
              />
              <span className="cz-stash-source-name">{s.name}</span>
            </span>
          ))}
        </div>

        {clip && (
          <div className="cz-capture-clip">
            <span className="cz-clip-dot" style={{ background: clip.dot }} aria-hidden="true" />
            <span className="cz-capture-clip-text">Clipboard · {clip.host}</span>
          </div>
        )}

        <textarea
          ref={textareaRef}
          className="cz-stash-paste"
          aria-label="Stash a link or note"
          value={input}
          onChange={(e) => onInput(e.target.value)}
          onKeyDown={(e) => {
            // Keep Stash keystrokes out of the window type-anywhere path.
            e.stopPropagation();
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onStash();
            }
          }}
          placeholder={
            "Paste anything — the app sorts it out:\na link, a Reddit post or haul,\na note, a whole list"
          }
          rows={5}
        />

        <button type="button" className="cz-stash-primary" onClick={onStash}>
          {input.trim() ? "Stash" : "Stash clipboard"}
        </button>

        <div className="cz-capture-sheet-links">
          <button
            type="button"
            title="Focus the paste box, then ⌘V"
            onClick={() => textareaRef.current && textareaRef.current.focus()}
          >
            Paste
          </button>
          {canStashTab && (
            <button type="button" onClick={onStashTab}>
              Stash this tab
            </button>
          )}
        </div>
      </div>
    </ModalShell>
  );
}
