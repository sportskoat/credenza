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
  accountEnabled,
  accountSession,
  accountPlan,
  onOpenAccount,
  onClose,
  subPage = null,
  onBack,
}) {
  const themeLabel = mode === "light" ? "Gallery" : "Blackout";
  // Account row value (Kyle 2026-07-26: "on the settings, the sign-in's kind
  // of gone"). It was never here — the account card only ever lived in the
  // Profile sheet behind the avatar. On a phone the ⋯ menu reads as "where
  // the settings are", so a person looking for sign-in looks here first.
  // This row does not duplicate the card; it points at it.
  const planState = accountPlan && accountPlan.state ? accountPlan.state : "free";
  const isPro = planState === "pro" || planState === "grace";
  const accountValue = !accountEnabled
    ? "Off in this build"
    : accountSession
      ? (accountSession.user && accountSession.user.email) || (isPro ? "Pro" : "Free")
      : "Sign in";
  return (
    <ModalShell
      title="Settings"
      onClose={onClose}
      maxWidth={440}
      surfaceClassName="cz-settings-surface"
      stacked
      subPage={subPage}
      onBack={onBack}
    >
      <div className="cz-settings">
        {/* Kyle 2026-07-27: "different options cleaner … the card that pops up
            with all the settings is just a little bit too bland."

            Six identical rows in one undifferentiated column. Account and
            Theme have nothing to do with each other, and the three fit rows
            belong together. They are now three named groups on their own card
            surfaces, the same shape the Profile sheet uses. */}
        <div className="cz-settings-label">Account</div>
        <div className="cz-settings-group">
        <button type="button" className="cz-settings-row" onClick={onOpenAccount}>
          <span className="cz-settings-row-label">Account</span>
          <span className="cz-settings-row-val">
            {accountValue}
            <span className="cz-settings-row-chev" aria-hidden="true">›</span>
          </span>
        </button>
        </div>
        <div className="cz-settings-label">Look</div>
        <div className="cz-settings-group">
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
        </div>
        <div className="cz-settings-label">Fit</div>
        <div className="cz-settings-group">
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
      </div>
    </ModalShell>
  );
}
