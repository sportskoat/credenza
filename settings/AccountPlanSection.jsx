import { useState } from "react";
import { Pill } from "../credenza-fashion.jsx";
import { PLAN_CAPS, usageToday } from "../preview/src/usage.js";
import { PLAN_COPY } from "../components/plans.js";
import { useSettings } from "./SettingsContext.jsx";
import SettingsSection from "./SettingsSection.jsx";

// ═══════════════════════════════════════════════════════════════════════════
// Account and plan — sign-in handoff README, screen 4.
//
// "Report where the user stands and provide the door. No form, no price
// table." The old pane held both: an email field with a Google button, a
// billing switch, two price cards and an eight-row caps table. All of that
// now lives on two surfaces of its own — the sign-in modal (screen 2) and
// the /upgrade route (screen 3). This pane only reports and links.
//
// Every number is a projection, never a stored copy:
//   - The signed-out counter reads `limits`, which the app re-computes on
//     every spent read.
//   - The signed-in counters read usageToday() against PLAN_CAPS at render.
//     limitStatus() returns null for a Pro member, so Pro cannot use it.
//
// README deviations, for the morning report:
//   1. The README's 4a body says an account "makes the shelf unlimited".
//      The Kyle 2026-08-02 ruling forbids the word: a free account gets 20
//      cards a day, not a blank cheque. PLAN_COPY.settingsSignedOutBody is
//      the corrected sentence and this pane uses it.
//   2. The README's 4a Today row says "0 of 2 chart reads" for a signed-out
//      person. 2 is the signed-in free cap; a signed-out device has its own
//      allowance. The row prints the card counter only.
//   3. "renews 9 Aug" and the whole "2 devices · kept in step" row are
//      dropped. The signed entitlement the browser holds carries only
//      { sub, plan, state, lim, exp, graceUntil }. Neither the renewal date
//      nor a device count reaches this device, and a made-up date next to a
//      price is a false statement to someone who is paying.
//   4. Two rows the README does not draw survive here, because no other
//      surface offers them: "Restore purchase" and "Delete account".
// ═══════════════════════════════════════════════════════════════════════════

// One row of the standing group. The action sits on the right; the flag is
// the mono chip that stands in for an action on a row that has none.
function StandingRow({ title, value, mono, pill, action, flag }) {
  return (
    <div className="cz-plan-standing-row">
      <div className="cz-plan-standing-main">
        <div className="cz-plan-standing-title">
          {title}
          {pill ? <span className="cz-plan-pro-pill">{pill}</span> : null}
        </div>
        <div className={"cz-plan-standing-value" + (mono ? " is-mono" : "")}>{value}</div>
      </div>
      {action ? <div className="cz-plan-standing-action">{action}</div> : null}
      {flag ? <span className="cz-plan-flag">{flag}</span> : null}
    </div>
  );
}

export default function AccountPlanSection() {
  const {
    accountEnabled,
    accountSession,
    accountPlan,
    limits,
    onSignIn,
    onOpenUpgrade,
    onPortal,
    onSignOut,
    onDeleteAccount,
    onRestorePurchase,
  } = useSettings();

  const [busy, setBusy] = useState(""); // "portal" | "restore" | "signout" | "delete"
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
  const email = (signedIn && accountSession.user && accountSession.user.email) || "";

  // The Today line. Read at render, so a card resolved a second ago already
  // shows here. usageTick in the app re-renders this tree on every spend.
  const caps = isPro ? PLAN_CAPS.pro : PLAN_CAPS.free;
  const todaySignedIn =
    usageToday("chartVision") + " of " + caps.chartVisionPerDay + " chart reads · " +
    usageToday("resolve") + " of " + caps.resolvePerDay + " cards";
  const todaySignedOut = limits
    ? limits.cap - limits.left + " of " + limits.cap + " cards · resets at midnight"
    : "Counted on this device · resets at midnight";

  const heading = !signedIn
    ? "You are signed out."
    : isPro
      ? "Signed in. Pro is on."
      : "Signed in. You are on Free.";

  const body = signedIn
    ? isPro
      ? "Pro is on for this account. Your daily counters are raised and your shelf comes back on a new phone."
      : "Your account is free. It holds " + PLAN_CAPS.free.resolvePerDay +
        " cards a day and brings the shelf back if the phone goes."
    : PLAN_COPY.settingsSignedOutBody;

  return (
    <SettingsSection
      kicker="ACCOUNT AND PLAN"
      title={heading}
      sectionId="account"
      lead={body}
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

      {accountEnabled && (
        <div className={"cz-plan-standing" + (signedIn ? " is-tight" : "")}>
          {signedIn ? (
            <StandingRow
              title="Account"
              value={email || "Signed in"}
              mono={!!email}
              action={
                <Pill subtle disabled={!!busy} onClick={() => run("signout", onSignOut)}>
                  {busy === "signout" ? "Signing out…" : "Sign out"}
                </Pill>
              }
            />
          ) : (
            <StandingRow
              title="Account"
              value="Signed out · this device only"
              action={
                <Pill primary onClick={() => onSignIn()}>
                  Sign in
                </Pill>
              }
            />
          )}

          {/* A Pro member has nothing left to buy, so the upgrade door goes
              and the billing door takes its place. */}
          {isPro ? (
            <StandingRow
              title="Plan"
              pill="PRO"
              value={
                planState === "grace"
                  ? "Pro · a payment did not go through"
                  : "Pro · billed through Stripe · cancel any time"
              }
              action={
                <Pill disabled={!!busy} onClick={() => run("portal", onPortal)}>
                  {busy === "portal" ? "Opening…" : "Manage billing"}
                </Pill>
              }
            />
          ) : (
            <StandingRow
              title="Plan"
              value={
                signedIn ? "Free · $0" : "Free · $0 · no card, no trial clock"
              }
              action={
                <Pill onClick={() => onOpenUpgrade()}>See what Pro changes</Pill>
              }
            />
          )}

          <StandingRow
            title="Today"
            value={signedIn ? todaySignedIn : todaySignedOut}
            flag={!signedIn ? "LOCAL" : isPro ? "PRO CAPS" : "FREE CAPS"}
          />

          {/* Not in the README. It stays because a person who paid on another
              device has no other way to make this one notice. */}
          {signedIn && !isPro && (
            <StandingRow
              title="Purchases"
              value="Paid already on another device?"
              action={
                <Pill subtle disabled={!!busy} onClick={() => run("restore", onRestorePurchase)}>
                  {busy === "restore" ? "Checking…" : "Restore purchase"}
                </Pill>
              }
            />
          )}

          {/* Not in the README either. Deleting the account is the only door
              that no other pane holds. Your data holds the local erase. */}
          {signedIn && (
            <StandingRow
              title="Delete your account"
              value={
                deleteArmed
                  ? "No undo. Your shelf stays on this device."
                  : "Removes the sync copy, not the local one."
              }
              action={
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
              }
            />
          )}
        </div>
      )}

      {error && <div className="cz-profile-signin-error" role="alert">{error}</div>}

      {accountEnabled && (
        <p className="cz-plan-standing-note">
          {isPro && signedIn
            ? "Manage billing opens the Stripe portal. Credenza never sees your card number."
            : "Two rows and a counter. The sign-in form and the price table used to sit here; both moved to their own surface and this page links to them."}
        </p>
      )}
    </SettingsSection>
  );
}
