import { useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
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
//
// Kyle 2026-08-04: the menu uses position:fixed under the avatar and portals
// OUT of the masthead (masthead enter animation keeps transform: translateY(0)
// via fill-mode:both, which traps fixed descendants). Portal target is .cz-app,
// not document.body: theme tokens (incl. --cz-card-solid) live as inline style
// on .cz-app only. Body had no tokens → transparent card, shelf text bleeding
// through (Kyle 2026-08-04 "what happened to the sign in card").

const MENU_GAP = 10;
const MENU_EDGE = 12;
const MENU_WIDTH = 300;

function placeMenu(menu, toggle) {
  if (!menu || !toggle || typeof window === "undefined") return;
  const r = toggle.getBoundingClientRect();
  // A zero box means the toggle is not laid out yet — try again next frame.
  if (r.width === 0 && r.height === 0) return;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(MENU_WIDTH, Math.max(0, vw - MENU_EDGE * 2));
  // Prefer the right edge of the avatar; pull right if the left would clip.
  let left = r.right - width;
  if (left < MENU_EDGE) left = MENU_EDGE;
  if (left + width > vw - MENU_EDGE) left = Math.max(MENU_EDGE, vw - MENU_EDGE - width);
  let top = r.bottom + MENU_GAP;
  // If the card would hang past the bottom, open above the avatar instead.
  const approxHeight = menu.offsetHeight || 320;
  if (top + approxHeight > vh - MENU_EDGE && r.top - MENU_GAP - approxHeight > MENU_EDGE) {
    top = Math.max(MENU_EDGE, r.top - MENU_GAP - approxHeight);
  }
  menu.style.position = "fixed";
  menu.style.top = Math.round(top) + "px";
  menu.style.left = Math.round(left) + "px";
  menu.style.right = "auto";
  menu.style.bottom = "auto";
  menu.style.width = Math.round(width) + "px";
  menu.style.maxWidth = "none";
  menu.style.zIndex = "80";
}

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

  // Pin the card under the avatar and keep every edge on screen (Kyle 2026-08-04).
  // Portaled out of the masthead so its persistent transform cannot trap fixed.
  useLayoutEffect(() => {
    const menu = rootRef.current;
    const toggle = document.querySelector("[data-cz-avatar-toggle]");
    const place = () => placeMenu(menu, toggle);
    place();
    // Second pass after paint so offsetHeight is real if the first pass used the fallback.
    const raf = requestAnimationFrame(place);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, []);

  // Click outside or Escape closes, same contract as every other overlay.
  // The profile button is special: its own click toggles open/closed. If this
  // listener closes on mousedown, the button's click then re-opens the menu.
  // Skip the toggle button so one tap closes and stays closed.
  useEffect(() => {
    const onDown = (e) => {
      if (!rootRef.current) return;
      if (rootRef.current.contains(e.target)) return;
      if (e.target.closest?.("[data-cz-avatar-toggle]")) return;
      onClose();
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
  const isOwner = planState === "owner";
  const isPro = planState === "pro" || planState === "grace" || planState === "owner";
  const signedIn = !!accountSession;

  const go = (fn) => () => {
    onClose();
    fn();
  };

  // The line under the name is a projection of the live counter, never a
  // stored copy of it. A stored copy goes stale the moment a card resolves.
  // The counter shows while signed out — the only state with one meter. The
  // plan word names Owner first, because owner access never expires.
  const standing = [
    signedIn ? (isOwner ? "Owner" : isPro ? "Pro" : "Free") : "Signed out",
    !signedIn && limits ? limits.left + " of " + limits.cap + " free cards" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const node = (
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

  // Portal out of the masthead so its transform cannot re-base position:fixed,
  // but stay INSIDE .cz-app so --cz-card-solid / --cz-ink / etc. still resolve
  // (they are set as inline style on .cz-app, not on body). Fall back to body
  // only when the app root is missing (tests, early paint).
  if (typeof document === "undefined") return node;
  const host = document.querySelector(".cz-app") || document.body;
  return createPortal(node, host);
}
