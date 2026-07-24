import { useEffect } from "react";
import { ModalShell } from "../credenza-fashion.jsx";

// Stash mode (Kyle 2026-07-22): the same paste makes one card from a link,
// N cards from a Reddit haul, or a plain note. Shared by the empty-state
// capture block and the capture sheet (design handoff PR3).
const STASH_MODES = [
  ["link", "Link", "One card from a link or short paste"],
  ["haul", "Reddit haul", "One card per item from a Reddit post link or pasted haul"],
  ["note", "Note", "Keep the paste as a plain note"],
];
function StashModeRow({ stashMode, onChange, disabled = false }) {
  return (
    <div className="cz-stashmode" role="group" aria-label="Stash mode">
      {STASH_MODES.map(([id, label, hint]) => (
        <button
          key={id}
          type="button"
          className={"cz-stashmode-btn" + (stashMode === id ? " is-active" : "")}
          aria-pressed={stashMode === id}
          title={hint}
          disabled={disabled}
          onClick={() => onChange(id)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// Sources shown above the stash paste box (visual only — not mode controls).
// Dots + names, no chip boxes (Kyle 2026-07-23 handoff).
const STASH_SOURCES = [
  { name: "Yupoo", color: "#37b24d" },
  { name: "Weidian", color: "#ff5a3c" },
  { name: "Taobao", color: "#ff6a00" },
  { name: "Reddit", color: "#ff4500" },
];

// Capture sheet (design handoff PR3 + import-shelf polish): review surface
// behind the bottom bar's Stash pill. Owns mode, paste box, and Stash CTA.
export default function CaptureSheet({
  clip,
  input,
  onInput,
  stashMode,
  onStashMode,
  canStashTab,
  onStashTab,
  onStash,
  onImportReddit,
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

  const placeholder =
    stashMode === "haul"
      ? "Paste a Reddit post link or haul text…"
      : stashMode === "note"
        ? "Write a note…"
        : "weidian.com/item.html?id=7291…\n…x.yupoo.com/albums/…\na Reddit haul post URL or its body\none per line";

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

        <StashModeRow stashMode={stashMode} onChange={onStashMode} />

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
          placeholder={placeholder}
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
          <button type="button" onClick={onImportReddit}>
            Import from Reddit
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
