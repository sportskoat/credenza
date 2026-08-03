import { useState } from "react";
import { PRICING, Pill, SegmentedControl } from "../credenza-fashion.jsx";
import { PLAN_CAPS } from "../preview/src/usage.js";
import { useSettings } from "./SettingsContext.jsx";
import SettingsSection from "./SettingsSection.jsx";
// Sign-in form no longer lives here (Kyle 2026-08-03): dedicated SignInPage.

// Account and plan (design 1f). The old modal sold Pro with two price
// buttons and no idea what you get. This screen states the caps as numbers,
// says out loud what Pro does not change, and discloses the referral money
// inline. Switching billing updates the price.
//
// Every number on this screen is bound:
//   - Prices come from PRICING (never a literal).
//   - Caps come from PLAN_CAPS, which plan-limits.test.js binds to the
//     server tables. The design doc's own table numbers were illustrative
//     and wrong; do not copy them here.

const BILLING_OPTIONS = [
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

const BILLING = {
  weekly: {
    price: PRICING.weekly,
    period: "a week",
    badge: PRICING.weeklyTrial,
    // FTC negative-option: the free days, the after-trial price, and the
    // cancel path sit next to the button that starts the trial.
    equiv: PRICING.weeklyTrialNote + ".",
  },
  monthly: {
    price: PRICING.monthly,
    period: "a month",
    badge: "",
    equiv: "Billed monthly. Cancel any time.",
  },
  yearly: {
    price: PRICING.yearly,
    period: "a year",
    badge: PRICING.yearlySaving,
    equiv: PRICING.yearlyPerMonth + ", billed yearly.",
  },
};

// The caps table. Each row's numbers read PLAN_CAPS; the cadence word sits
// in the cell so "5 a day" reads as one claim. Rows after the metered six
// are facts about the product, not caps — they have no server source.
const CAP_ROWS = [
  { label: "AI chart reads", note: "One read of one size chart.", free: PLAN_CAPS.free.chartVisionPerDay + " a day", pro: PLAN_CAPS.pro.chartVisionPerDay + " a day" },
  { label: "Link resolves", note: "One server read of one buy link.", free: PLAN_CAPS.free.resolvePerDay + " a day", pro: PLAN_CAPS.pro.resolvePerDay + " a day" },
  { label: "QC photos", note: "Stored on the card.", free: PLAN_CAPS.free.qcPhotosPerItem + " an item", pro: PLAN_CAPS.pro.qcPhotosPerItem + " an item" },
  { label: "Open hauls", note: "Archive a finished one to free a slot.", free: PLAN_CAPS.free.haulsMax + " at once", pro: PLAN_CAPS.pro.haulsMax + " at once" },
  { label: "Shared links", note: "A read-only link to a haul.", free: PLAN_CAPS.free.sharedLinksMax + " live", pro: PLAN_CAPS.pro.sharedLinksMax + " live" },
  { label: "Export a .csv", note: "For Numbers, Excel or Sheets.", free: "No", pro: "Yes" },
  { label: "Cards on the shelf", note: "The shelf itself is never capped.", free: "Unlimited", pro: "Unlimited" },
  { label: ".json backup and restore", note: "Your data leaves whenever you want.", free: "Yes", pro: "Yes" },
];

export default function AccountPlanSection() {
  const {
    accountEnabled,
    accountSession,
    accountPlan,
    onOpenSignIn,
    onUpgrade,
    onPortal,
    onSignOut,
    onDeleteAccount,
    onRestorePurchase,
  } = useSettings();

  const [billing, setBilling] = useState("weekly");
  const [busy, setBusy] = useState(""); // "upgrade" | "portal" | "restore" | "history" | "signout" | "delete"
  const [error, setError] = useState("");
  // Delete account is two-tap: the first tap arms it, the second sends it.
  const [deleteArmed, setDeleteArmed] = useState(false);

  const run = async (key, fn) => {
    if (busy) return;
    setBusy(key);
    setError("");
    try {
      await fn();
    } catch (err) {
      setError(err && err.message ? String(err.message) : "Something went wrong. Try again.");
    } finally {
      setBusy("");
    }
  };

  const planState = accountPlan && accountPlan.state ? accountPlan.state : "free";
  const isPro = planState === "pro" || planState === "grace";
  const signedIn = accountEnabled && !!accountSession;
  const plan = BILLING[billing];

  return (
    <SettingsSection
      kicker="ACCOUNT AND PLAN"
      title="Free is the whole app. Pro is more of it."
      sectionId="account"
      lead={
        signedIn
          ? "You are on " + (isPro ? "Pro" : "Free") + " as " + (accountSession.user.email || "this account") +
            ". Nothing on your shelf is locked. Pro raises the daily caps and funds the servers."
          : "Nothing on your shelf is locked. Pro raises the daily caps and funds the servers."
      }
    >
      {/* Accounts off = SAY so (same rule as the old profile sheet: a build
          with no Supabase keys must not silently lose the account UI). */}
      {!accountEnabled && (
        <div className="cz-profile-signin is-off">
          <div className="cz-profile-signin-title">Accounts are off in this build</div>
          <div className="cz-profile-signin-sub">
            This copy of Credenza has no sign-in server, so there is nothing to
            sign in to. Your shelf works exactly the same and stays on this
            device. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to turn
            accounts back on.
          </div>
        </div>
      )}

      {/* Signed out: open the dedicated sign-in page (Kyle 2026-08-03).
          Pro checkout still needs a session — upgrade stays shut until then. */}
      {accountEnabled && !accountSession && (
        <div className="cz-profile-signin">
          <div className="cz-profile-signin-title">Sign in to Credenza</div>
          <div className="cz-profile-signin-sub">
            Sign in on the dedicated page. An account keeps your shelf and
            limits in sync across devices. Your shelf stays on this device
            either way.
          </div>
          <Pill
            primary
            style={{ width: "100%", minHeight: 50, borderRadius: 15 }}
            onClick={() => onOpenSignIn && onOpenSignIn()}
          >
            Open sign-in
          </Pill>
        </div>
      )}

      <SegmentedControl
        label="Billing"
        value={billing}
        onChange={(v) => setBilling(v || "weekly")}
        options={BILLING_OPTIONS}
      />

      <div className="cz-account-plan-cards">
        <div className="cz-account-plan-card">
          <div className="cz-account-plan-card-top">
            <span className="cz-account-plan-name">Free</span>
            {!isPro ? <span className="cz-account-plan-badge">Your plan</span> : null}
          </div>
          <div className="cz-account-plan-price">
            <span className="cz-account-plan-amount">$0</span>
          </div>
          <div className="cz-account-plan-sub">No card, no trial clock. Stays free.</div>
        </div>

        <div className="cz-account-plan-card is-pro">
          <div className="cz-account-plan-card-top">
            <span className="cz-account-plan-name">Pro</span>
            {isPro ? (
              <span className="cz-account-plan-badge">Your plan</span>
            ) : plan.badge ? (
              <span className="cz-account-plan-badge is-money">{plan.badge}</span>
            ) : null}
          </div>
          <div className="cz-account-plan-price">
            <span className="cz-account-plan-amount">{plan.price}</span>
            <span className="cz-account-plan-period">{plan.period}</span>
          </div>
          <div className="cz-account-plan-equiv">{plan.equiv}</div>
          {isPro ? (
            <Pill
              style={{ width: "100%", minHeight: 44, borderRadius: 13 }}
              disabled={!!busy}
              onClick={() => run("portal", onPortal)}
            >
              {busy === "portal" ? "Opening…" : "Manage billing"}
            </Pill>
          ) : (
            <Pill
              primary
              style={{ width: "100%", minHeight: 44, borderRadius: 13 }}
              disabled={!!busy || !signedIn}
              title={!signedIn ? "Sign in first to upgrade." : undefined}
              onClick={() => run("upgrade", () => onUpgrade(billing))}
            >
              {busy === "upgrade"
                ? "Opening…"
                : billing === "weekly"
                  ? "Start " + PRICING.weeklyTrial
                  : "Upgrade to Pro"}
            </Pill>
          )}
          {!signedIn && accountEnabled ? (
            <div className="cz-account-plan-hint">Sign in to upgrade.</div>
          ) : null}
        </div>
      </div>

      <div className="cz-account-plan-table" role="table" aria-label="What changes with Pro">
        <div className="cz-account-plan-table-head" role="row">
          <span className="cz-account-plan-table-kicker" role="columnheader">What changes</span>
          <span role="columnheader">Free</span>
          <span role="columnheader">Pro</span>
        </div>
        {CAP_ROWS.map((r) => (
          <div className="cz-account-plan-table-row" role="row" key={r.label}>
            <span className="cz-account-plan-table-what" role="cell">
              <span className="cz-account-plan-table-label">{r.label}</span>
              <span className="cz-account-plan-table-note">{r.note}</span>
            </span>
            <span className="cz-account-plan-table-free" role="cell">{r.free}</span>
            <span className="cz-account-plan-table-pro" role="cell">{r.pro}</span>
          </div>
        ))}
      </div>

      <div className="cz-account-plan-keeps">
        <div className="cz-account-plan-keeps-title">What Pro does not change</div>
        <p>
          The shelf, the size engine, hauls and your data are free forever.
          Pro is a cap lift, not a key. Some agent links carry a referral code
          that funds the app. It never changes your price.
        </p>
      </div>

      <div className="cz-account-plan-billing">
        <div className="cz-account-plan-keeps-title">Billing</div>
        <p>
          Cancel any time from this page. Refund within 14 days, no email
          needed. Downgrading keeps every card you saved.
        </p>
        <div className="cz-account-plan-billing-actions">
          <Pill
            subtle
            disabled={!!busy || !signedIn}
            onClick={() => run("restore", onRestorePurchase)}
          >
            {busy === "restore" ? "Checking…" : "Restore purchase"}
          </Pill>
          <Pill
            subtle
            disabled={!!busy || !signedIn}
            onClick={() => run("history", onPortal)}
          >
            {busy === "history" ? "Opening…" : "Billing history"}
          </Pill>
        </div>
      </div>

      {signedIn ? (
        <div className="cz-account-plan-footer">
          <p>
            Sign out leaves your shelf on this device. Deleting the account
            removes the sync copy, not the local one.
          </p>
          <div className="cz-account-plan-billing-actions">
            <Pill
              subtle
              disabled={!!busy}
              onClick={() => run("signout", onSignOut)}
            >
              {busy === "signout" ? "Signing out…" : "Sign out"}
            </Pill>
            <Pill
              subtle
              disabled={!!busy}
              onClick={() => {
                if (!deleteArmed) {
                  setDeleteArmed(true);
                  setError("");
                  return;
                }
                run("delete", onDeleteAccount);
              }}
            >
              {busy === "delete"
                ? "Deleting…"
                : deleteArmed
                  ? "Tap again to delete your account"
                  : "Delete account"}
            </Pill>
          </div>
          {deleteArmed ? (
            <p className="cz-account-plan-hint">No undo. Your shelf stays on this device.</p>
          ) : null}
          {error && <div className="cz-profile-signin-error" role="alert">{error}</div>}
        </div>
      ) : null}
    </SettingsSection>
  );
}
