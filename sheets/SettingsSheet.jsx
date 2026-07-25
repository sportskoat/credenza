import { ModalShell } from "../credenza-fashion.jsx";

// Settings sheet (mobile shelf handoff step 3, 2026-07-25). The phone's ⋯
// menu. It owns the look-and-fit rows: Theme, sizes, fit preferences and the
// fit-summary toggles. Account and data rows (agent, currency, import,
// storage) live in the Profile sheet — the two sheets used to duplicate each
// other (Kyle 2026-07-25).
//
// Every row is the same shape: label left, value + chevron right. Values come
// from the app; this component holds no state.
export default function SettingsSheet({
  mode,
  onCycleTheme,
  onOpenSizes,
  onOpenFitPrefs,
  fitSummary,
  onToggleFitSummary,
  fitDetail,
  onCycleFitDetail,
  onClose,
}) {
  const themeLabel = mode === "light" ? "Gallery" : "Blackout";
  return (
    <ModalShell title="Settings" onClose={onClose} maxWidth={440} surfaceClassName="cz-settings-surface">
      <div className="cz-settings">
        {/* Two themes only, so the row toggles instead of opening a picker.
            aria-label carries the destination — the visible value is the
            current theme, which a screen reader alone reads as ambiguous. */}
        <button
          type="button"
          className="cz-settings-row"
          aria-label={"Theme: " + themeLabel + ". Switch to " + (mode === "light" ? "Blackout" : "Gallery") + "."}
          onClick={onCycleTheme}
        >
          <span className="cz-settings-row-label">Theme</span>
          <span className="cz-settings-row-val">
            {themeLabel}
            <span className="cz-settings-row-chev" aria-hidden="true">›</span>
          </span>
        </button>
        <button type="button" className="cz-settings-row" onClick={onOpenSizes}>
          <span className="cz-settings-row-label">Your sizes</span>
          <span className="cz-settings-row-val">
            Body profile
            <span className="cz-settings-row-chev" aria-hidden="true">›</span>
          </span>
        </button>
        <button type="button" className="cz-settings-row" onClick={onOpenFitPrefs}>
          <span className="cz-settings-row-label">Fit preferences</span>
          <span className="cz-settings-row-val">
            Length &amp; looseness
            <span className="cz-settings-row-chev" aria-hidden="true">›</span>
          </span>
        </button>
        <button type="button" className="cz-settings-row" onClick={onToggleFitSummary} aria-pressed={fitSummary}>
          <span className="cz-settings-row-label">Fit summary</span>
          <span className="cz-settings-row-val">
            {fitSummary ? "On" : "Off"}
            <span className="cz-settings-row-chev" aria-hidden="true">›</span>
          </span>
        </button>
        {/* Fit detail only means something while the summary is on. */}
        {fitSummary ? (
          <button type="button" className="cz-settings-row" onClick={onCycleFitDetail}>
            <span className="cz-settings-row-label">Fit detail</span>
            <span className="cz-settings-row-val">
              {fitDetail === "detailed" ? "Detailed" : "Concise"}
              <span className="cz-settings-row-chev" aria-hidden="true">›</span>
            </span>
          </button>
        ) : null}
      </div>
    </ModalShell>
  );
}
