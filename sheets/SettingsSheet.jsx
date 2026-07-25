import { ModalShell } from "../credenza-fashion.jsx";

// Settings sheet (mobile shelf handoff step 3, 2026-07-25). The fixed bottom
// bar is gone, so Agent lost its home. This sheet is where it lands, together
// with the other rows the bar used to carry: Import, Export, Theme and sizes.
// The ⋯ button in the phone masthead opens it.
//
// Every row is the same shape: label left, value + chevron right. Values come
// from the app; this component holds no state.
export default function SettingsSheet({
  agentLabel,
  onOpenAgent,
  onOpenImport,
  onExport,
  mode,
  onCycleTheme,
  onOpenSizes,
  storageLabel,
  storageColor,
  onClose,
}) {
  const themeLabel = mode === "light" ? "Gallery" : "Blackout";
  return (
    <ModalShell title="Settings" onClose={onClose} maxWidth={440} surfaceClassName="cz-settings-surface">
      <div className="cz-settings">
        <button type="button" className="cz-settings-row" onClick={onOpenAgent}>
          <span className="cz-settings-row-label">Buying agent</span>
          <span className="cz-settings-row-val">
            {agentLabel}
            <span className="cz-settings-row-chev" aria-hidden="true">›</span>
          </span>
        </button>
        <button type="button" className="cz-settings-row" onClick={onOpenImport}>
          <span className="cz-settings-row-label">Import from file</span>
          <span className="cz-settings-row-val">
            JSON · CSV
            <span className="cz-settings-row-chev" aria-hidden="true">›</span>
          </span>
        </button>
        <button type="button" className="cz-settings-row" onClick={onExport}>
          <span className="cz-settings-row-label">Export a backup</span>
          <span className="cz-settings-row-val">
            .json
            <span className="cz-settings-row-chev" aria-hidden="true">›</span>
          </span>
        </button>
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
        {/* The old bar showed an unlabeled colored dot. Here it gets a word. */}
        <div className="cz-settings-foot">
          <span
            className="cz-settings-foot-dot"
            style={{ background: storageColor }}
            aria-hidden="true"
          />
          Local · {storageLabel}
        </div>
      </div>
    </ModalShell>
  );
}
