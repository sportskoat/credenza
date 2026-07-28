import { useEffect, useRef } from "react";
import { PRICING, SegmentedControl } from "../credenza-fashion.jsx";

// Avatar quick menu (Profile Settings design 1c). Replaces the modal as the
// avatar's first surface: who you are, the switches you actually flip, and a
// door into the settings page. No scroll, no nesting.
//
// Prices come from PRICING. The upsell line is the trial note — it is a
// legal term, so it is never paraphrased.

export default function AvatarMenu({
  accountSession,
  accountPlan,
  avatarInitials,
  mode,
  onTheme,
  agentLabel,
  onOpenAgent,
  pricePrimary,
  onCycleCurrency,
  onOpenSettings,
  onSignOut,
  onClose,
}) {
  const rootRef = useRef(null);

  // Click outside or Escape closes, same contract as every other overlay.
  useEffect(() => {
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) onClose();
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const planState = accountPlan && accountPlan.state ? accountPlan.state : "free";
  const isPro = planState === "pro" || planState === "grace";
  const signedIn = !!accountSession;

  const go = (fn) => () => {
    onClose();
    fn();
  };

  return (
    <div className="cz-avatar-menu" role="menu" aria-label="Profile menu" ref={rootRef}>
      <div className="cz-avatar-menu-identity">
        <span className="cz-avatar cz-avatar-menu-mark" aria-hidden="true">
          {avatarInitials ? <span className="cz-avatar-initials">{avatarInitials}</span> : null}
        </span>
        <span className="cz-avatar-menu-who">
          <span className="cz-avatar-menu-email">
            {signedIn ? accountSession.user.email || "Signed in" : "Saved on this device"}
          </span>
          <span className="cz-avatar-menu-plan">
            {signedIn
              ? (isPro ? "Pro" : "Free") + " · saved on this device"
              : "No account. The shelf is yours either way."}
          </span>
        </span>
      </div>

      {!isPro && (
        <div className="cz-avatar-menu-upsell">
          <div className="cz-avatar-menu-upsell-title">Pro lifts the daily limits</div>
          <div className="cz-avatar-menu-upsell-note">{PRICING.weeklyTrialNote}</div>
          <button
            type="button"
            className="cz-avatar-menu-upsell-cta"
            onClick={go(() => onOpenSettings("account"))}
          >
            See Pro
          </button>
        </div>
      )}

      <div className="cz-avatar-menu-row is-control">
        <span className="cz-avatar-menu-label">Colourway</span>
        <SegmentedControl
          label="Colourway"
          value={mode === "light" ? "light" : "rainbow"}
          onChange={(v) => onTheme(v || "rainbow")}
          options={[
            { value: "light", label: "Gallery" },
            { value: "rainbow", label: "Blackout" },
          ]}
        />
      </div>

      <button type="button" className="cz-avatar-menu-row" onClick={go(onOpenAgent)}>
        <span className="cz-avatar-menu-label">Agent</span>
        <span className="cz-avatar-menu-value">{agentLabel} ›</span>
      </button>

      {/* Currency flips in place (Kyle 2026-07-28): closing the menu on a
          cycle made one tap do two jobs. The value updates live; the menu
          stays. */}
      <button type="button" className="cz-avatar-menu-row" onClick={onCycleCurrency}>
        <span className="cz-avatar-menu-label">Currency</span>
        <span className="cz-avatar-menu-value">{pricePrimary} ›</span>
      </button>

      <button type="button" className="cz-avatar-menu-row" onClick={go(() => onOpenSettings())}>
        <span className="cz-avatar-menu-label">All settings</span>
        <span className="cz-avatar-menu-value">Sizes, fit, data ›</span>
      </button>

      {signedIn ? (
        <button type="button" className="cz-avatar-menu-row" onClick={go(onSignOut)}>
          <span className="cz-avatar-menu-label">Sign out</span>
          <span className="cz-avatar-menu-value">This device only</span>
        </button>
      ) : (
        <button type="button" className="cz-avatar-menu-row" onClick={go(() => onOpenSettings("account"))}>
          <span className="cz-avatar-menu-label">Sign in</span>
          <span className="cz-avatar-menu-value">Pro, sync, links ›</span>
        </button>
      )}
    </div>
  );
}
