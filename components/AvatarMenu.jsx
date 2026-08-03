import { useEffect, useRef } from "react";
import { ChevronRight } from "lucide-react";
import { PRICING } from "../credenza-fashion.jsx";
import { PLAN_COPY } from "./plans.js";

// Avatar quick menu — sign-in handoff README, screen 5.
//
// The old menu put "Sign in" last, under Agent and Currency, and labelled it
// "Pro, sync, links". That merged two separate decisions into one row: an
// account is free and Pro costs money, and a person could not tell which one
// the row was asking for.
//
// Now the two account decisions come first and read as two doors. The shelf
// switches follow, under a divider.
//
// Prices come from PRICING and cap numbers come from plans.js. The upsell
// line is the trial note. It is a legal term, so it is never paraphrased.
//
// Kyle 2026-08-01: Gallery colourway is parked. Blackout is the only look.

export default function AvatarMenu({
  accountSession,
  accountPlan,
  limits,
  avatarInitials,
  agentLabel,
  onOpenAgent,
  pricePrimary,
  onOpenCurrency,
  onOpenSettings,
  onSignIn,
  onOpenUpgrade,
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

  // The line under the name is a projection of the live counter, never a
  // stored copy of it. A stored copy goes stale the moment a card resolves.
  const standing = [
    signedIn ? (isPro ? "Pro" : "Free") : "Signed out",
    limits ? limits.left + " of " + limits.cap + " cards today" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="cz-avatar-menu" role="menu" aria-label="Profile menu" ref={rootRef}>
      <div className="cz-avatar-menu-head">
        <span className="cz-avatar cz-avatar-menu-mark" aria-hidden="true">
          {avatarInitials ? <span className="cz-avatar-initials">{avatarInitials}</span> : null}
        </span>
        <span className="cz-avatar-menu-who">
          <span className="cz-avatar-menu-email">
            {signedIn ? accountSession.user.email || "Signed in" : "Saved on this device"}
          </span>
          <span className="cz-avatar-menu-plan">{standing}</span>
        </span>
      </div>

      {/* The two account decisions, first and separate. An account is free.
          Pro costs money. One row each, so neither question hides inside
          the other. */}
      <div className="cz-avatar-menu-group">
        {signedIn ? (
          <button type="button" className="cz-avatar-menu-door" onClick={go(onSignOut)}>
            <span className="cz-avatar-menu-door-title">
              Sign out
              <ChevronRight size={13} strokeWidth={2.4} aria-hidden="true" />
            </span>
            <span className="cz-avatar-menu-door-sub">This device keeps your shelf.</span>
          </button>
        ) : (
          <button type="button" className="cz-avatar-menu-door" onClick={go(onSignIn)}>
            <span className="cz-avatar-menu-door-title">
              Sign in
              <ChevronRight size={13} strokeWidth={2.4} aria-hidden="true" />
            </span>
            <span className="cz-avatar-menu-door-sub">{PLAN_COPY.menuFreeSub}</span>
          </button>
        )}

        {/* A Pro member has nothing left to buy, so the row goes. */}
        {!isPro && (
          <button type="button" className="cz-avatar-menu-door" onClick={go(onOpenUpgrade)}>
            <span className="cz-avatar-menu-door-title">
              See what Pro changes
              <ChevronRight size={13} strokeWidth={2.4} aria-hidden="true" />
            </span>
            <span className="cz-avatar-menu-door-sub is-money">{PRICING.weeklyTrialNote}</span>
          </button>
        )}
      </div>

      <div className="cz-avatar-menu-divider" aria-hidden="true" />

      <div className="cz-avatar-menu-group">
        <button type="button" className="cz-avatar-menu-row" onClick={go(onOpenAgent)}>
          <span className="cz-avatar-menu-label">Agent</span>
          <span className="cz-avatar-menu-value">
            {agentLabel}
            <ChevronRight size={13} strokeWidth={2.4} aria-hidden="true" />
          </span>
        </button>

        {/* Currency opens the top-8 picker (lane 2, 2026-08-02). Closing the
            menu first keeps one surface on screen — same path as Agent. */}
        <button type="button" className="cz-avatar-menu-row" onClick={go(onOpenCurrency)}>
          <span className="cz-avatar-menu-label">Currency</span>
          <span className="cz-avatar-menu-value">
            {pricePrimary}
            <ChevronRight size={13} strokeWidth={2.4} aria-hidden="true" />
          </span>
        </button>

        <button type="button" className="cz-avatar-menu-row" onClick={go(() => onOpenSettings())}>
          <span className="cz-avatar-menu-label">All settings</span>
          <span className="cz-avatar-menu-value">
            Sizes, fit, data
            <ChevronRight size={13} strokeWidth={2.4} aria-hidden="true" />
          </span>
        </button>
      </div>
    </div>
  );
}
