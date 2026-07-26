import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  BrandIcon,
  ModalShell,
  PROVIDER_LABELS,
  SAMPLE_COUNT,
  itemMatchesCanonicalKey,
  localTitle,
  parseImport,
  usePrefersReducedMotion,
} from "../credenza-fashion.jsx";

// Import sources cycle (design handoff turn 8a). CO-22: the per-platform
// colored dots read as connection status — red beside Weidian/Reddit looked
// like faults. One neutral dot now (color lives in .cz-import-source-dot).
const IMPORT_SOURCES = [
  { name: "Yupoo" },
  { name: "Weidian" },
  { name: "Taobao" },
  { name: "Reddit post or comment" },
  { name: "Credenza backup" },
];

function ImportSourceCycle() {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState("idle"); // idle | exit | enter
  const reduced = usePrefersReducedMotion();
  const source = IMPORT_SOURCES[index];

  useEffect(() => {
    if (reduced) return undefined;
    let exitTimer = 0;
    let enterTimer = 0;
    const tick = window.setInterval(() => {
      setPhase("exit");
      window.clearTimeout(exitTimer);
      window.clearTimeout(enterTimer);
      exitTimer = window.setTimeout(() => {
        setIndex((i) => (i + 1) % IMPORT_SOURCES.length);
        setPhase("enter");
        enterTimer = window.setTimeout(() => setPhase("idle"), 20);
      }, 150);
    }, 1900);
    return () => {
      window.clearInterval(tick);
      window.clearTimeout(exitTimer);
      window.clearTimeout(enterTimer);
    };
  }, [reduced]);

  const phaseClass =
    phase === "exit" ? " is-exit" : phase === "enter" ? " is-enter-start" : "";

  return (
    <div className="cz-import-works">
      <div className="cz-import-works-label">Works with</div>
      <div className="cz-import-source-slot" aria-live="polite">
        <span className={"cz-import-source-swap" + phaseClass}>
          <span className="cz-import-source-dot" aria-hidden="true" />
          <span className="cz-import-source-name">{source.name}</span>
        </span>
      </div>
    </div>
  );
}

// `embedded` renders the body alone, for the Profile modal's sub-page stack
// (Kyle 2026-07-26). The stack owns the shell, the title, and the back button.
export default function ImportSheet({ items, hasSamples, onImport, onAddSamples, onClearSamples, onClose, onExport, onClearShelf, onRestore, embedded = false }) {
  const [text, setText] = useState("");
  const fileRef = useRef(null);
  const importTextId = useId();

  const preview = useMemo(() => {
    if (!text.trim()) return null;
    const { candidates, provider, posterStats, poster } = parseImport(text);
    const fresh = candidates.filter((c) => !items.some((x) => itemMatchesCanonicalKey(x, c.key)));
    const dates = fresh.map((c) => c.createdAt).filter(Boolean);
    const oldest = dates.length ? Math.min(...dates) : null;
    return { candidates, fresh, dupes: candidates.length - fresh.length, provider, oldest, posterStats, poster };
  }, [text, items]);

  const readFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result || "");
      // A Credenza backup restores directly; anything else feeds the paste parser.
      if (/\.json$/i.test(file.name)) {
        try {
          const arr = JSON.parse(content);
          if (Array.isArray(arr) && arr.length && arr[0] && (arr[0].canonicalKey || arr[0].rawText != null)) {
            onRestore(arr);
            return;
          }
        } catch {}
      }
      setText((prev) => (prev ? prev + "\n" : "") + content);
    };
    reader.readAsText(file);
  };

  const canImport = !!(preview && preview.fresh.length > 0);
  const importLabel = canImport ? "Import " + preview.fresh.length : "Import haul";

  const body = (
      <div
        className="cz-import-body"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
          if (f) readFile(f);
        }}
      >
        <ImportSourceCycle />

        <label className="cz-import-paste-label" htmlFor={importTextId}>
          Paste links, a whole Reddit thread, or a list
        </label>
        <textarea
          id={importTextId}
          className="cz-import-paste"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            "weidian.com/item.html?id=7291…\n…x.yupoo.com/albums/…\nreddit.com/r/…/haul or pasted body\none per line"
          }
          rows={5}
          aria-label="Paste haul links"
        />

        <div className="cz-import-auto">
          <span className="cz-import-auto-star" aria-hidden="true">
            ✦
          </span>
          We auto-detect the source and pull price, photos and sizing.
        </div>

        {preview && (
          <div className="cz-import-preview">
            <div className="cz-import-preview-summary">
              {preview.candidates.length === 0
                ? "No links or notes found yet."
                : (preview.provider !== "paste"
                    ? "Looks like a " + PROVIDER_LABELS[preview.provider] + " · "
                    : "") +
                  preview.fresh.length +
                  " found" +
                  (preview.dupes > 0 ? " · " + preview.dupes + " already on the shelf" : "") +
                  (preview.oldest &&
                  new Date(preview.oldest).getFullYear() < new Date().getFullYear()
                    ? " · back to " + new Date(preview.oldest).getFullYear()
                    : "")}
            </div>
            {preview.posterStats && (
              <div className="cz-import-preview-meta">
                {[
                  preview.poster ? "u/" + preview.poster : null,
                  preview.posterStats.heightCm ? preview.posterStats.heightCm + "cm" : null,
                  preview.posterStats.weightKg ? preview.posterStats.weightKg + "kg" : null,
                  preview.posterStats.usualSize ? "size " + preview.posterStats.usualSize : null,
                  preview.posterStats.agent ? "agent: " + preview.posterStats.agent : null,
                  preview.posterStats.budget
                    ? "total " +
                      (preview.posterStats.budgetCurrency === "USD"
                        ? "$"
                        : preview.posterStats.budgetCurrency === "EUR"
                          ? "€"
                          : "¥") +
                      preview.posterStats.budget
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            )}
            {preview.fresh.slice(0, 5).map((c, i) => (
              <div key={i} className="cz-import-preview-row">
                <BrandIcon type={c.parsed.type} host={c.parsed.host} size={12} />
                <span className="cz-import-preview-title">
                  {c.titleHint || localTitle(c.parsed, c.rawText)}
                </span>
              </div>
            ))}
            {preview.fresh.length > 5 && (
              <div className="cz-import-preview-more">+ {preview.fresh.length - 5} more</div>
            )}
          </div>
        )}

        <div className="cz-import-actions">
          <button
            type="button"
            className="cz-import-primary"
            disabled={!canImport}
            onClick={() => onImport(text)}
          >
            {importLabel}
          </button>
          <label className="cz-import-restore">
            <span className="cz-import-restore-icon" aria-hidden="true">
              ⤓
            </span>
            Restore a .json backup
            <input
              ref={fileRef}
              type="file"
              accept=".json,.txt,.md"
              onChange={(e) => readFile(e.target.files && e.target.files[0])}
              className="cz-import-file"
            />
          </label>
        </div>

        {hasSamples ? (
          <button type="button" className="cz-import-sample is-clear" onClick={onClearSamples}>
            <div className="cz-import-sample-thumbs" aria-hidden="true">
              <span className="cz-import-sample-thumb t1" />
              <span className="cz-import-sample-thumb t2" />
              <span className="cz-import-sample-thumb t3" />
            </div>
            <div className="cz-import-sample-copy">
              <div className="cz-import-sample-title">Sample shelf is on</div>
              <div className="cz-import-sample-sub">Clear the demo finds in one tap.</div>
            </div>
            <span className="cz-import-sample-cta">Clear ›</span>
          </button>
        ) : (
          <button type="button" className="cz-import-sample" onClick={onAddSamples}>
            <div className="cz-import-sample-thumbs" aria-hidden="true">
              <span className="cz-import-sample-thumb t1" />
              <span className="cz-import-sample-thumb t2" />
              <span className="cz-import-sample-thumb t3" />
            </div>
            <div className="cz-import-sample-copy">
              <div className="cz-import-sample-title">Just exploring? Try a sample shelf</div>
              <div className="cz-import-sample-sub">
                {SAMPLE_COUNT} fashion finds to poke at. Clears in one tap.
              </div>
            </div>
            <span className="cz-import-sample-cta">Add ›</span>
          </button>
        )}

        {items.length > 0 && (
          <button type="button" className="cz-import-export" onClick={onExport}>
            Download your shelf as a .json backup
          </button>
        )}

        {items.length > 0 && (
          <button
            type="button"
            className="cz-import-export cz-import-clear"
            onClick={onClearShelf}
          >
            Clear the whole shelf…
          </button>
        )}
      </div>
  );

  if (embedded) return body;
  return (
    <ModalShell title="Bring a haul onto your shelf" onClose={onClose} maxWidth={520}>
      {body}
    </ModalShell>
  );
}
