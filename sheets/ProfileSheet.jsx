import { ModalShell, Pill, SYNC_ENABLED } from "../credenza-fashion.jsx";

// Profile sheet (design handoff PR3): account entry up top, then the settings
// that used to crowd the bottom bar ⋯ menu — Theme, sizes, agent, currency,
// import, storage. Sign-in has no account backend yet; the button says so in
// a toast instead of faking a flow.
export default function ProfileSheet({
  mode,
  onTheme,
  agentLabel,
  onOpenAgent,
  pricePrimary,
  onCycleCurrency,
  fitSummary,
  onToggleFitSummary,
  fitDetail,
  onCycleFitDetail,
  onOpenSizes,
  onOpenFitPrefs,
  onOpenImport,
  storageLabel,
  storageColor,
  onSignIn,
  onClose,
}) {
  const themes = [
    ["light", "Gallery", "#F4F4F0", "1px solid rgba(0,0,0,.12)"],
    ["rainbow", "Blackout", "#000000", "1px solid rgba(255,255,255,.18)"],
  ];
  return (
    <ModalShell title="Profile" onClose={onClose} maxWidth={440}>
      <div className="cz-profile">
        {/* Hidden until sync exists (CO-05). SYNC_ENABLED brings it back. */}
        {SYNC_ENABLED && (
        <div className="cz-profile-signin">
          <div className="cz-profile-signin-title">Sign in to Credenza</div>
          <div className="cz-profile-signin-sub">
            Sync your shelf, sizes and agent across every device.
          </div>
          <Pill
            primary
            style={{ width: "100%", minHeight: 50, borderRadius: 15 }}
            onClick={onSignIn}
          >
            Log in / Sign up
          </Pill>
        </div>
        )}
        <div className="cz-profile-label">Theme</div>
        <div className="cz-profile-themes">
          {themes.map(([id, label, swatch, swatchBorder]) => {
            const active = mode === id;
            return (
              <button
                key={id}
                type="button"
                className={"cz-profile-theme" + (active ? " is-active" : "")}
                aria-pressed={active}
                onClick={() => onTheme(id)}
              >
                <span
                  className="cz-profile-theme-swatch"
                  style={{ background: swatch, border: swatchBorder }}
                  aria-hidden="true"
                />
                {label}
                <span className="cz-profile-theme-check" aria-hidden="true">
                  {active ? "✓" : ""}
                </span>
              </button>
            );
          })}
        </div>
        <button type="button" className="cz-profile-row" onClick={onOpenSizes}>
          <span>Your sizes</span>
          <span className="cz-profile-row-val">Body profile ›</span>
        </button>
        <button type="button" className="cz-profile-row" onClick={onOpenFitPrefs}>
          <span>Fit preferences</span>
          <span className="cz-profile-row-val">Length & looseness ›</span>
        </button>
        <button type="button" className="cz-profile-row" onClick={onOpenAgent}>
          <span>Default agent</span>
          <span className="cz-profile-row-val">{agentLabel} ›</span>
        </button>
        <button type="button" className="cz-profile-row" onClick={onCycleCurrency}>
          <span>Primary currency</span>
          <span className="cz-profile-row-val">{pricePrimary} ›</span>
        </button>
        <button type="button" className="cz-profile-row" onClick={onToggleFitSummary} aria-pressed={fitSummary}>
          <span>AI fit summary</span>
          <span className="cz-profile-row-val">{fitSummary ? "On" : "Off"} ›</span>
        </button>
        {/* Accordion so the Fit detail row animates in/out on toggle instead of
            popping. Same t-acc + t-panel-slide composite as the dropdowns. */}
        <div className="t-acc cz-profile-acc" data-open={fitSummary}>
          <div
            className="t-acc-panel"
            aria-hidden={!fitSummary}
            inert={!fitSummary ? "" : undefined}
          >
            <div className="t-acc-panel-inner">
              <div className="t-panel-slide" data-open={fitSummary}>
                <button type="button" className="cz-profile-row" onClick={onCycleFitDetail}>
                  <span>Fit detail</span>
                  <span className="cz-profile-row-val">{fitDetail === "detailed" ? "Detailed" : "Concise"} ›</span>
                </button>
              </div>
            </div>
          </div>
        </div>
        <button type="button" className="cz-profile-row" onClick={onOpenImport}>
          <span>Import &amp; backup</span>
          <span className="cz-profile-row-val">›</span>
        </button>
        <div className="cz-profile-row is-static">
          <span>Storage</span>
          <span className="cz-profile-row-val cz-profile-storage">
            <span
              className="cz-profile-storage-dot"
              style={{ background: storageColor }}
              aria-hidden="true"
            />
            {storageLabel}
          </span>
        </div>
      </div>
    </ModalShell>
  );
}
