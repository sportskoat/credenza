import { useEffect, useRef } from "react";
import { Heart, Search } from "lucide-react";
import { ModalShell } from "../credenza-fashion.jsx";

// Search sheet (design 7b, 2026-07-31). The phone magnifier opens this bottom
// sheet — not an inline field. The query filters the shelf live behind the
// scrim. "Likes only" further narrows to favourites. Recent chips re-fill the
// field with a prior seller, ID, or typed query.
export default function SearchSheet({
  query,
  onQuery,
  matchCount,
  likesOnly,
  onLikesOnly,
  recent = [],
  onPickRecent,
  onClose,
}) {
  const inputRef = useRef(null);

  useEffect(() => {
    // ModalShell focuses Close on mount. Move focus into the field so the
    // keyboard opens on a phone — the reason this is a sheet under the thumb.
    const id = requestAnimationFrame(() => {
      if (inputRef.current) inputRef.current.focus();
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const matchesLabel =
    matchCount === 1 ? "1 match" : matchCount + " matches";

  return (
    <ModalShell
      title="Search the shelf"
      onClose={onClose}
      maxWidth={520}
      surfaceClassName="cz-search-sheet-surface"
    >
      <div className="cz-search-sheet">
        <p className="cz-search-sheet-lead">
          Titles, sellers, listing IDs and haul notes.
        </p>

        <label className="cz-search-sheet-field">
          <Search
            className="cz-search-sheet-field-icon"
            size={16}
            strokeWidth={2.2}
            aria-hidden="true"
          />
          <input
            ref={inputRef}
            className="cz-search-sheet-input"
            type="search"
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            aria-label="Search your shelf"
            placeholder="Titles, sellers, IDs"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Escape") {
                if (query) {
                  onQuery("");
                  e.preventDefault();
                } else {
                  onClose();
                }
              }
            }}
          />
        </label>

        <div className="cz-search-sheet-meta">
          <span className="cz-search-sheet-count" aria-live="polite">
            {matchesLabel}
          </span>
          <div className="cz-search-sheet-like-track">
            <button
              type="button"
              className={
                "cz-search-sheet-like" + (likesOnly ? " is-active" : "")
              }
              aria-pressed={likesOnly}
              onClick={() => onLikesOnly(!likesOnly)}
            >
              <Heart
                size={13}
                strokeWidth={2.2}
                fill={likesOnly ? "currentColor" : "none"}
                aria-hidden="true"
              />
              Likes only
            </button>
          </div>
        </div>

        {recent.length > 0 && (
          <div className="cz-search-sheet-recent">
            <div className="cz-search-sheet-kicker" aria-hidden="true">
              Recent
            </div>
            <div className="cz-search-sheet-chips">
              {recent.map((chip) => (
                <button
                  type="button"
                  key={chip}
                  className="cz-search-sheet-chip"
                  onClick={() => onPickRecent(chip)}
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </ModalShell>
  );
}
